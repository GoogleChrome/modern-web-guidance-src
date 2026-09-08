import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DatabaseSync } from 'node:sqlite';
import {
  generateNormalizedTrajectory,
  parseJetskiCliSession,
  writeTrajectorySummary,
  collectJetskiCliGuidesFromTrajectory,
  collectJetskiCliToolsFromTrajectory,
  extractJetskiCliModel,
  extractJetskiCliTokenUsage
} from '../lib/trajectory-normalizer.ts';
import { extractModelFromResults, extractTokenUsageFromResults } from '../lib/collection.ts';
import { exportTrajectories } from '../lib/agent-shared.ts';
import { Agents } from '../config.ts';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jetski-parsing-test-'));
}

function removeTempDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function encodeVarint(val: number): Buffer {
  const bytes: number[] = [];
  while (val >= 0x80) {
    bytes.push((val & 0x7f) | 0x80);
    val >>>= 7;
  }
  bytes.push(val);
  return Buffer.from(bytes);
}

function encodeField(tag: number, wireType: number, payload: Buffer | number): Buffer {
  const header = encodeVarint((tag << 3) | wireType);
  if (wireType === 2 && Buffer.isBuffer(payload)) {
    const len = encodeVarint(payload.length);
    return Buffer.concat([header, len, payload]);
  } else if (wireType === 0 && typeof payload === 'number') {
    return Buffer.concat([header, encodeVarint(payload)]);
  }
  return header;
}

test('Jetski CLI normalization', async () => {
  const tempDir = createTempDir();
  try {
    const dbPath = path.join(tempDir, 'session-123.db');
    const db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE steps (idx INTEGER, step_type INTEGER, status INTEGER, metadata BLOB, step_payload BLOB);
      CREATE TABLE gen_metadata (idx INTEGER, data BLOB);
    `);

    const mockActionJson = JSON.stringify({
      CommandLine: 'npx -y modern-web-guidance@latest retrieve "validate-input-after-interaction"',
      toolSummary: 'Retrieving guidance',
      toolAction: 'Searching'
    });
    const payload1 = Buffer.from(mockActionJson);

    const insertStep = db.prepare('INSERT INTO steps (idx, step_type, status, metadata, step_payload) VALUES (?, ?, ?, ?, ?)');
    insertStep.run(1, 21, 1, null, payload1);
    db.close();

    await generateNormalizedTrajectory(tempDir, Agents.JETSKI_CLI, 'Test prompt for Jetski');

    const summaryPath = path.join(tempDir, 'trajectory_summary.json');
    assert.ok(fs.existsSync(summaryPath), 'trajectory_summary.json should be created');

    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    assert.strictEqual(summary.agent, Agents.JETSKI_CLI);
    assert.strictEqual(summary.initialPrompt, 'Test prompt for Jetski');
    assert.ok(Array.isArray(summary.steps));
    
    assert.strictEqual(summary.steps.length, 1);
    assert.strictEqual(summary.steps[0].action?.type, 'run_command');
    assert.strictEqual(summary.steps[0].action?.name, 'npx');
    assert.strictEqual(summary.steps[0].action?.params?.command, 'npx -y modern-web-guidance@latest retrieve "validate-input-after-interaction"');

  } finally {
    removeTempDir(tempDir);
  }
});

test('collectJetski metrics from trajectory files', async () => {
  const tempDir = createTempDir();
  try {
    const dbPath = path.join(tempDir, 'session-123.db');
    const db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE steps (idx INTEGER, step_type INTEGER, status INTEGER, metadata BLOB, step_payload BLOB);
      CREATE TABLE gen_metadata (idx INTEGER, data BLOB);
    `);

    // 1. step_payload with command line, file read, and skill activation
    const payload1 = encodeField(5, 2, Buffer.from('npx -y modern-web-guidance@latest retrieve "validate-input-after-interaction,required-field-feedback"'));
    const payload2 = encodeField(5, 2, Buffer.from('/skills/modern-web-guidance/required-field-feedback/guide.md'));
    const payload3 = encodeField(5, 2, Buffer.from('/skills/modern-web-guidance/SKILL.md'));
    const payloadNeg1 = encodeField(5, 2, Buffer.from('npx modern-web retrieve obsolete-guide'));
    const payloadNeg2 = encodeField(5, 2, Buffer.from('curl https://example.com/retrieve/item'));
    const payloadNeg3 = encodeField(5, 2, Buffer.from('npx -y modern-web-guidance@latest search "validate"'));

    // 2. metadata with tag 9 -> tag 2 (1500), tag 5 (400)
    const statsInner = Buffer.concat([
      encodeField(2, 0, 1500),
      encodeField(5, 0, 400)
    ]);
    const metadataProto = encodeField(9, 2, statsInner);

    // 3. gen_metadata with tag 1 -> tag 21 ("gemini-3.6-flash")
    const modelInner = encodeField(21, 2, Buffer.from('gemini-3.6-flash'));
    const genDataProto = encodeField(1, 2, modelInner);

    const insertStep = db.prepare('INSERT INTO steps (idx, step_type, status, metadata, step_payload) VALUES (?, ?, ?, ?, ?)');
    insertStep.run(1, 21, 1, metadataProto, payload1);
    insertStep.run(2, 8, 1, null, payload2);
    insertStep.run(3, 8, 1, null, payload3);
    insertStep.run(4, 21, 1, null, payloadNeg1);
    insertStep.run(5, 21, 1, null, payloadNeg2);
    insertStep.run(6, 21, 1, null, payloadNeg3);

    const insertGen = db.prepare('INSERT INTO gen_metadata (idx, data) VALUES (?, ?)');
    insertGen.run(1, genDataProto);

    db.close();

    // 1. Verify session parsing
    const parsed = parseJetskiCliSession(tempDir);
    assert.deepStrictEqual(parsed.retrievedGuides, ['validate-input-after-interaction', 'required-field-feedback']);
    assert.deepStrictEqual(parsed.fileReadGuides, ['required-field-feedback']);
    assert.deepStrictEqual(parsed.toolsUsed, ['modern-web-guidance']);
    assert.strictEqual(parsed.model, 'gemini-3.6-flash');
    assert.deepStrictEqual(parsed.tokenUsage, { total: 1900, cached: 400 });

    // 2. Write summary file as done by the agent run() lifecycle
    writeTrajectorySummary(tempDir, parsed);

    // 3. Verify collection methods read strictly from summary
    const guides = await collectJetskiCliGuidesFromTrajectory(tempDir);
    assert.deepStrictEqual(guides.retrievedGuides, ['validate-input-after-interaction', 'required-field-feedback']);
    assert.deepStrictEqual(guides.fileReadGuides, ['required-field-feedback']);

    const tools = collectJetskiCliToolsFromTrajectory(tempDir);
    assert.deepStrictEqual(tools, ['modern-web-guidance']);

    const model = extractModelFromResults(tempDir);
    assert.strictEqual(model, 'gemini-3.6-flash');

    const tokens = extractTokenUsageFromResults(tempDir);
    assert.deepStrictEqual(tokens, { total: 1900, cached: 400 });

    const directModel = extractJetskiCliModel(tempDir);
    assert.strictEqual(directModel, 'gemini-3.6-flash');

    const directTokens = extractJetskiCliTokenUsage(tempDir);
    assert.deepStrictEqual(directTokens, { total: 1900, cached: 400 });
  } finally {
    removeTempDir(tempDir);
  }
});

test('exportTrajectories copies SQLite WAL and SHM companion files and enables valid parsing', async () => {
  const sourceDir = createTempDir();
  const destDir = createTempDir();
  try {
    const dbPath = path.join(sourceDir, 'session-wal-test.db');
    const db = new DatabaseSync(dbPath);
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA wal_autocheckpoint = 0;
      CREATE TABLE steps (idx INTEGER, step_type INTEGER, status INTEGER, metadata BLOB, step_payload BLOB);
      CREATE TABLE gen_metadata (idx INTEGER, data BLOB);
    `);

    const payload = encodeField(5, 2, Buffer.from('npx -y modern-web-guidance@latest retrieve "translator"'));
    const insertStep = db.prepare('INSERT INTO steps (idx, step_type, status, metadata, step_payload) VALUES (?, ?, ?, ?, ?)');
    insertStep.run(1, 21, 1, null, payload);

    // Keep WAL open / uncheckpointed and export
    exportTrajectories(sourceDir, '*.db', destDir);

    // Verify companion files were copied
    assert.ok(fs.existsSync(path.join(destDir, 'session-wal-test.db')));
    if (fs.existsSync(`${dbPath}-wal`)) {
      assert.ok(fs.existsSync(path.join(destDir, 'session-wal-test.db-wal')));
    }

    db.close();

    // Verify destination DB can be parsed cleanly
    const parsed = parseJetskiCliSession(destDir);
    assert.deepStrictEqual(parsed.retrievedGuides, ['translator']);
  } finally {
    removeTempDir(sourceDir);
    removeTempDir(destDir);
  }
});

test('parseJetskiCliSession sanitizes pipe-delimited experimental model names', () => {
  const tempDir = createTempDir();
  try {
    const dbPath = path.join(tempDir, 'session-pipe-model.db');
    const db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE steps (idx INTEGER, step_type INTEGER, status INTEGER, metadata BLOB, step_payload BLOB);
      CREATE TABLE gen_metadata (idx INTEGER, data BLOB);
    `);

    const rawModelString = 'gemini-3.7-flash-medium|experimental-routing-path/checkpoint/1';
    const modelInner = encodeField(19, 2, Buffer.from(rawModelString));
    const genDataProto = encodeField(1, 2, modelInner);

    const insertGen = db.prepare('INSERT INTO gen_metadata (idx, data) VALUES (?, ?)');
    insertGen.run(1, genDataProto);
    db.close();

    const parsed = parseJetskiCliSession(tempDir);
    assert.strictEqual(parsed.model, 'gemini-3.7-flash-medium');

    writeTrajectorySummary(tempDir, parsed);
    const model = extractModelFromResults(tempDir);
    assert.strictEqual(model, 'gemini-3.7-flash-medium');
  } finally {
    removeTempDir(tempDir);
  }
});
