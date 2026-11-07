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
} from './trajectory-normalizer.ts';
import { extractModelFromResults, extractTokenUsageFromResults } from './collection.ts';
import { extractBase64TrajectoryPayloads } from './secret-guard.ts';
import { exportTrajectories } from './trajectory-export.ts';
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

test('exportTrajectories snapshots WAL rows and purges deleted freelist secrets via VACUUM INTO', async () => {
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

    const deletedSecret = 'freelist-deleted-secret-12345';
    const insertStep = db.prepare('INSERT INTO steps (idx, step_type, status, metadata, step_payload) VALUES (?, ?, ?, ?, ?)');
    insertStep.run(1, 21, 1, null, encodeField(5, 2, Buffer.from('npx -y modern-web-guidance@latest retrieve "translator"')));
    insertStep.run(2, 21, 1, null, Buffer.from(`secret=${deletedSecret}`));
    db.prepare('DELETE FROM steps WHERE idx = 2').run();

    exportTrajectories(sourceDir, '*.db', destDir, [deletedSecret]);

    const exportedPath = path.join(destDir, 'session-wal-test.db');
    assert.ok(fs.existsSync(exportedPath));
    assert.strictEqual(fs.existsSync(`${exportedPath}-wal`), false);
    assert.strictEqual(fs.existsSync(`${exportedPath}-shm`), false);
    assert.strictEqual(fs.readFileSync(exportedPath).includes(deletedSecret), false);
    assert.ok(fs.existsSync(path.join(destDir, 'session-wal-test.html')));

    db.close();
    assert.deepStrictEqual(parseJetskiCliSession(destDir).retrievedGuides, ['translator']);
  } finally {
    removeTempDir(sourceDir);
    removeTempDir(destDir);
  }
});

test('exportTrajectories rejects leaked credentials in SQLite .db before generating HTML export', () => {
  const sourceDir = createTempDir();
  const destDir = createTempDir();
  try {
    const dbPath = path.join(sourceDir, 'session-secret.db');
    const db = new DatabaseSync(dbPath);
    db.exec('CREATE TABLE steps (idx INTEGER, step_type INTEGER, status INTEGER, metadata BLOB, step_payload BLOB);');
    const fakeSecret = `sk-or-v1-${'a'.repeat(48)}`;
    db.prepare('INSERT INTO steps VALUES (1, 21, 1, NULL, ?)').run(Buffer.from(fakeSecret));
    db.close();

    assert.throws(
      () => exportTrajectories(sourceDir, '*.db', destDir, []),
      (err: Error) => /Refused to export trajectory session-secret\.db/.test(err.message) && !err.message.includes(fakeSecret),
    );
    assert.strictEqual(fs.existsSync(path.join(destDir, 'session-secret.db')), false);
    assert.strictEqual(fs.existsSync(path.join(destDir, 'session-secret.html')), false);
  } finally {
    removeTempDir(sourceDir);
    removeTempDir(destDir);
  }
});

test('exportTrajectories copies raw .pb binaries without UTF-8 corruption and fails closed on leaks', () => {
  const sourceDir = createTempDir();
  const destDir = createTempDir();
  try {
    const cleanBytes = Buffer.concat([
      Buffer.from([0x0a, 0xff, 0xfe, 0x80, 0x12, 0x0b]),
      Buffer.from('clean trace'),
    ]);
    fs.writeFileSync(path.join(sourceDir, 'clean.pb'), cleanBytes);
    exportTrajectories(sourceDir, 'clean.pb', destDir, []);

    const copiedClean = fs.readFileSync(path.join(destDir, 'clean.pb'));
    assert.strictEqual(Buffer.compare(copiedClean, cleanBytes), 0);
    const html = fs.readFileSync(path.join(destDir, 'session-clean.html'), 'utf8');
    assert.deepStrictEqual(extractBase64TrajectoryPayloads(html), [cleanBytes]);

    const fakeSecret = `sk-or-v1-${'b'.repeat(48)}`;
    const leakyBytes = Buffer.concat([Buffer.from([0x0a, 0xff, 0xfe]), Buffer.from(fakeSecret)]);
    fs.writeFileSync(path.join(sourceDir, 'leak.pb'), leakyBytes);

    assert.throws(
      () => exportTrajectories(sourceDir, 'leak.pb', destDir, []),
      (err: Error) => /Refused to export trajectory leak\.pb/.test(err.message) && !err.message.includes(fakeSecret),
    );
    assert.strictEqual(fs.existsSync(path.join(destDir, 'leak.pb')), false);
    assert.strictEqual(fs.existsSync(path.join(destDir, 'session-leak.html')), false);
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

test('parseJetskiCliSession accumulates cached tokens across turns instead of peak Math.max', () => {
  const tempDir = createTempDir();
  try {
    const dbPath = path.join(tempDir, 'session-accum-cache.db');
    const db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE steps (idx INTEGER, step_type INTEGER, status INTEGER, metadata BLOB, step_payload BLOB);
      CREATE TABLE gen_metadata (idx INTEGER, data BLOB);
    `);

    // Turn 1: input=1000, output=100, cached=400
    const statsInner1 = Buffer.concat([
      encodeField(2, 0, 1000),
      encodeField(3, 0, 100),
      encodeField(5, 0, 400)
    ]);
    const metadataProto1 = encodeField(9, 2, statsInner1);

    // Turn 2: input=800, output=200, cached=600
    const statsInner2 = Buffer.concat([
      encodeField(2, 0, 800),
      encodeField(3, 0, 200),
      encodeField(5, 0, 600)
    ]);
    const metadataProto2 = encodeField(9, 2, statsInner2);

    const insertStep = db.prepare('INSERT INTO steps (idx, step_type, status, metadata, step_payload) VALUES (?, ?, ?, ?, ?)');
    insertStep.run(1, 21, 1, metadataProto1, null);
    insertStep.run(2, 21, 1, metadataProto2, null);
    db.close();

    const parsed = parseJetskiCliSession(tempDir);
    // Cumulative cached: 400 + 600 = 1000
    // Cumulative total: (1000 + 800) + (400 + 600) + (100 + 200) = 3100
    assert.deepStrictEqual(parsed.tokenUsage, { total: 3100, cached: 1000 });
  } finally {
    removeTempDir(tempDir);
  }
});

test('parseJetskiCliSession extracts Antigravity CLI ReadFile, FileEdit, WriteFile steps and UTF-8 strings', () => {
  const tempDir = createTempDir();
  try {
    const dbPath = path.join(tempDir, 'session-agy-tools.db');
    const db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE steps (idx INTEGER, step_type INTEGER, status INTEGER, metadata BLOB, step_payload BLOB);
      CREATE TABLE gen_metadata (idx INTEGER, data BLOB);
    `);

    const readJson = JSON.stringify({ Path: '/tmp/base_app/src/index.ts', StartLine: 1, EndLine: 50 });
    const editJson = JSON.stringify({
      Path: '/tmp/base_app/src/index.ts',
      Target: 'const oldVal = 1;',
      Replacement: 'const newVal = 2; // — UTF-8 dash'
    });
    const writeJson = JSON.stringify({
      Path: '/tmp/base_app/src/new-file.ts',
      Content: 'export const x = "hello • world";',
      Overwrite: true
    });
    const utf8Cmd = 'echo "— UTF-8 dash" && npx -y modern-web-guidance@latest retrieve "consistent-cross-document-transitions"';

    const insertStep = db.prepare('INSERT INTO steps (idx, step_type, status, metadata, step_payload) VALUES (?, ?, ?, ?, ?)');
    insertStep.run(1, 15, 1, null, encodeField(5, 2, Buffer.from(readJson)));
    // Duplicate tool execution row (type 132) should be deduplicated
    insertStep.run(2, 132, 1, null, encodeField(5, 2, Buffer.from(readJson)));
    insertStep.run(3, 15, 1, null, encodeField(5, 2, Buffer.from(editJson)));
    insertStep.run(4, 15, 1, null, encodeField(5, 2, Buffer.from(writeJson)));
    insertStep.run(5, 21, 1, null, encodeField(5, 2, Buffer.from(utf8Cmd)));
    db.close();

    const parsed = parseJetskiCliSession(tempDir);
    assert.strictEqual(parsed.steps.length, 3);
    assert.strictEqual(parsed.steps[0]?.action?.type, 'read_file');
    assert.strictEqual(parsed.steps[0]?.action?.params?.path, '/tmp/base_app/src/index.ts');
    assert.strictEqual(parsed.steps[1]?.action?.type, 'write_file');
    assert.strictEqual(parsed.steps[1]?.action?.name, 'replace_file_content');
    assert.strictEqual(parsed.steps[1]?.action?.params?.path, '/tmp/base_app/src/index.ts');
    assert.strictEqual(parsed.steps[2]?.action?.type, 'write_file');
    assert.strictEqual(parsed.steps[2]?.action?.name, 'write_to_file');
    assert.strictEqual(parsed.steps[2]?.action?.params?.path, '/tmp/base_app/src/new-file.ts');
    assert.deepStrictEqual(parsed.retrievedGuides, ['consistent-cross-document-transitions']);
  } finally {
    removeTempDir(tempDir);
  }
});


