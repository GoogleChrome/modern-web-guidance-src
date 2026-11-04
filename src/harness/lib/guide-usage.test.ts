import fs from 'fs';
import os from 'os';
import path from 'path';
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeUsageFromLog,
  collectGuidesUsed,
  collectGuidanceToolsUsed,
  guideIdsFromLog,
  hasTrajectoryGuideLeak,
  retrieveUsageFromLog,
  searchUsageFromLog,
} from './guide-usage.ts';

const tempDir = path.join(os.tmpdir(), `guide-usage-test-${process.pid}`);

describe('guide-usage', () => {
  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('guideIdsFromLog keeps only string ids from get_best_practices, deduped in order', () => {
    const ids = guideIdsFromLog([
      { tool: 'get_best_practices', result: [{ id: 'guide-a' }, { id: 'guide-b' }] },
      { tool: 'other_tool', result: [{ id: 'guide-c' }] },
      { tool: 'get_best_practices', result: 'not-an-array' },
      { tool: 'get_best_practices', result: [null, 42, { id: 7 }, { id: 'guide-a' }, { id: 'guide-d' }] },
      null as any, // a literal `null` JSONL line passes through parseJsonlFile
      {}
    ]);
    assert.deepEqual(ids, ['guide-a', 'guide-b', 'guide-d']);
  });

  test('collectGuidesUsed falls back to modern-web.log', async () => {
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Create an empty trajectory_summary to simulate parser failure
    fs.writeFileSync(path.join(tempDir, 'trajectory_summary.json'), '{}');
    
    // Create modern-web.log with some get_best_practices usage
    const logContent = [
      JSON.stringify({ tool: 'get_best_practices', result: [{ id: 'guide-a' }, { id: 'guide-b' }] }),
      JSON.stringify({ tool: 'other_tool', result: [{ id: 'guide-c' }] }), // Should be ignored
      JSON.stringify({ tool: 'get_best_practices', result: [{ id: 'guide-a' }] }) // Duplicate, should not add twice
    ].join('\n');
    fs.writeFileSync(path.join(tempDir, 'modern-web.log'), logContent);

    const usage = await collectGuidesUsed(tempDir);
    assert.deepEqual(usage.retrievedGuides, ['guide-a', 'guide-b']);
    assert.deepEqual(usage.fileReadGuides, []);
  });

  test('collectGuidanceToolsUsed adds modern-web-guidance if log exists', async () => {
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Create trajectory_summary missing the tool
    fs.writeFileSync(path.join(tempDir, 'trajectory_summary.json'), '{"toolsUsed": ["other-tool"]}');
    
    fs.writeFileSync(path.join(tempDir, 'modern-web.log'), 'some log data');

    const tools = await collectGuidanceToolsUsed(tempDir);
    assert.deepEqual(tools, ['other-tool', 'modern-web-guidance']);
  });

  test('collectGuidanceToolsUsed ignores empty 0-byte modern-web.log', async () => {
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'trajectory_summary.json'), '{"toolsUsed": ["other-tool"]}');
    fs.writeFileSync(path.join(tempDir, 'modern-web.log'), '');

    const tools = await collectGuidanceToolsUsed(tempDir);
    assert.deepEqual(tools, ['other-tool']);
  });

  test('hasTrajectoryGuideLeak checks modern-web.log', () => {
    fs.mkdirSync(tempDir, { recursive: true });
    
    fs.writeFileSync(path.join(tempDir, 'trajectory_summary.json'), '{}');
    
    // log contains the leak
    fs.writeFileSync(path.join(tempDir, 'modern-web.log'), 'some text with the secret-guide-name');

    assert.equal(hasTrajectoryGuideLeak(tempDir, 'secret-guide-name'), true);
    assert.equal(hasTrajectoryGuideLeak(tempDir, 'other-guide'), false);
  });

  test('gracefully handles missing modern-web.log', async () => {
    fs.mkdirSync(tempDir, { recursive: true });
    
    fs.writeFileSync(path.join(tempDir, 'trajectory_summary.json'), '{"retrievedGuides": ["guide-from-summary"], "toolsUsed": ["modern-web-guidance"]}');
    
    const usage = await collectGuidesUsed(tempDir);
    assert.deepEqual(usage.retrievedGuides, ['guide-from-summary']);

    const tools = await collectGuidanceToolsUsed(tempDir);
    assert.deepEqual(tools, ['modern-web-guidance']);

    assert.equal(hasTrajectoryGuideLeak(tempDir, 'guide-from-summary'), true);
  });

  test('handles malformed modern-web.log safely', async () => {
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'trajectory_summary.json'), '{}');
    fs.writeFileSync(path.join(tempDir, 'modern-web.log'), 'not-json\n{ "tool": "get_best_practices", "result": [{ "id": "guide-x" }] }\nmore-invalid');
    
    const usage = await collectGuidesUsed(tempDir);
    assert.deepEqual(usage.retrievedGuides, ['guide-x']);
  });

  test('guideIdsFromLog can filter specifically by analyze or retrieve', () => {
    const entries = [
      { tool: 'get_best_practices', result: [{ id: 'retrieved-1' }] },
      { tool: 'search_use_cases', result: [{ id: 'searched-1' }] },
      { tool: 'analyze', result: [{ id: 'analyzed-1' }, { id: 'analyzed-2' }] },
      { tool: 'analyze', result: [{ id: 'analyzed-1' }] }, // duplicate
    ];

    assert.deepEqual(guideIdsFromLog(entries), ['retrieved-1']);
    assert.deepEqual(guideIdsFromLog(entries, 'analyze'), ['analyzed-1', 'analyzed-2']);
    assert.deepEqual(guideIdsFromLog(entries, ['search_use_cases']), ['searched-1']);
  });

  test('analyzeUsageFromLog, searchUsageFromLog, and retrieveUsageFromLog parse metrics without conflation', () => {
    const entries = [
      { tool: 'get_best_practices', result: [{ id: 'guide-retrieved' }] },
      { tool: 'search_use_cases', result: [{ id: 'guide-searched' }] },
      { tool: 'analyze', result: [{ id: 'guide-analyzed-1' }, { id: 'guide-analyzed-2' }] },
      { tool: 'analyze', result: [{ id: 'guide-analyzed-1' }] },
    ];

    const analyzeStats = analyzeUsageFromLog(entries);
    assert.strictEqual(analyzeStats.callCount, 2);
    assert.deepEqual(analyzeStats.guideIds, ['guide-analyzed-1', 'guide-analyzed-2']);

    const searchStats = searchUsageFromLog(entries);
    assert.strictEqual(searchStats.callCount, 1);
    assert.deepEqual(searchStats.guideIds, ['guide-searched']);

    const retrieveStats = retrieveUsageFromLog(entries);
    assert.strictEqual(retrieveStats.callCount, 1);
    assert.deepEqual(retrieveStats.guideIds, ['guide-retrieved']);
  });

  test('collectGuidesUsed does not conflate analyze or search with retrievedGuides', async () => {
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'trajectory_summary.json'), '{}');

    const logContent = [
      JSON.stringify({ tool: 'get_best_practices', result: [{ id: 'retrieved-guide' }] }),
      JSON.stringify({ tool: 'search_use_cases', result: [{ id: 'searched-guide' }] }),
      JSON.stringify({ tool: 'analyze', result: [{ id: 'analyzed-guide' }] }),
    ].join('\n');
    fs.writeFileSync(path.join(tempDir, 'modern-web.log'), logContent);

    const usage = await collectGuidesUsed(tempDir);
    // retrievedGuides must only contain get_best_practices / retrieve guides
    assert.deepEqual(usage.retrievedGuides, ['retrieved-guide']);
    assert.deepEqual(usage.fileReadGuides, []);
  });
});
