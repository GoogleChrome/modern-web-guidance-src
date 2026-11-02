import fs from 'fs';
import path from 'path';
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { collectGuidesUsed, collectGuidanceToolsUsed, guideIdsFromLog, hasTrajectoryGuideLeak } from './guide-usage.ts';

const tempDir = path.join(process.cwd(), 'temp-guide-usage-test');

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
});
