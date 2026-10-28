import assert from 'node:assert/strict';
import test from 'node:test';
import { withVirtualSourceFile } from '../scanners/js-scanner.ts';
import { deprioritizeBackgroundFetchesMatcher } from './deprioritize-background-fetches.ts';

function runMatcher(code: string, filePath = 'app.ts') {
  return withVirtualSourceFile(filePath, code, (sourceFile) =>
    deprioritizeBackgroundFetchesMatcher.matchFile(sourceFile, {
      filePath,
      fileContent: code,
    }),
  );
}

void test('deprioritize-background-fetches JS matcher', async (t) => {
  await t.test('flags fetch() and new Request() using deprecated importance option', () => {
    const code = `
      fetch('/api/analytics', {
        method: 'POST',
        body: JSON.stringify({ event: 'ping' }),
        importance: 'low',
      });

      const init = { importance: 'high' };
      window.fetch('/api/critical', init);

      const req = new Request('/api/sync', { importance: 'low' });
    `;
    const matches = runMatcher(code);
    assert.equal(matches.length, 3);
    assert.equal(matches[0]?.line, 2);
    assert.equal(matches[1]?.line, 9);
    assert.equal(matches[2]?.line, 11);
  });

  await t.test('exempts fetch() using standard priority option or non-fetch objects', () => {
    const code = `
      fetch('/api/analytics', {
        method: 'POST',
        priority: 'low',
      });

      fetch('/api/compat', {
        importance: 'low',
        priority: 'low',
      });

      const taskConfig = { importance: 'high' };
      scheduleJob('/api/job', taskConfig);
    `;
    const matches = runMatcher(code);
    assert.equal(matches.length, 0);
  });
});
