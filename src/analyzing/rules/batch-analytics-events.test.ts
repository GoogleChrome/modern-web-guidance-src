import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  BATCH_ANALYTICS_EVENTS_GUIDE_HASH,
  batchAnalyticsEventsMatcher,
  batchAnalyticsEventsRule,
  batchAnalyticsEventsRules,
} from './batch-analytics-events.ts';

void test('batch-analytics-events: rule metadata', () => {
  assert.equal(batchAnalyticsEventsRule.id, 'batch-analytics-events');
  assert.equal(batchAnalyticsEventsRule.guideId, 'batch-analytics-events');
  assert.equal(
    batchAnalyticsEventsRule.guideHash,
    BATCH_ANALYTICS_EVENTS_GUIDE_HASH,
  );
  assert.equal(BATCH_ANALYTICS_EVENTS_GUIDE_HASH.length, 12);
  assert.equal(batchAnalyticsEventsRules.length, 1);
  assert.ok(batchAnalyticsEventsRule.phase2Rubric.keepWhen.length >= 1);
  assert.ok(batchAnalyticsEventsRule.phase2Rubric.dropWhen.length >= 2);
});

void test('batch-analytics-events JS matcher', async (t) => {
  await t.test('flags unload and beforeunload listeners calling sendBeacon, fetch, or synchronous XMLHttpRequest', () => {
    const project = createInMemoryProject();
    const code = `
      window.addEventListener('unload', () => {
        navigator.sendBeacon('/analytics', JSON.stringify(events));
      });

      window.addEventListener('beforeunload', () => {
        fetch('/telemetry', { method: 'POST', body: JSON.stringify(queue) });
      });

      window.addEventListener('beforeunload', () => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/log', false);
        xhr.send(payload);
      });
    `;
    const sourceFile = project.createSourceFile('analytics.js', code);
    const matches = batchAnalyticsEventsMatcher.matchFile(sourceFile, {
      filePath: 'analytics.js',
      fileContent: code,
    });
    assert.equal(matches.length, 3);
  });

  await t.test('exempts visibilitychange / pagehide listeners and unsaved-changes beforeunload prompts', () => {
    const project = createInMemoryProject();
    const code = `
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          navigator.sendBeacon('/analytics', data);
        }
      });

      window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges) {
          e.preventDefault();
          e.returnValue = '';
        }
      });
    `;
    const sourceFile = project.createSourceFile('safe.js', code);
    const matches = batchAnalyticsEventsMatcher.matchFile(sourceFile, {
      filePath: 'safe.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
