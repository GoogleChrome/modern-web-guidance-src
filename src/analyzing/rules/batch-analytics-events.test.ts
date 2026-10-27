import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  batchAnalyticsEventsMatcher
} from './batch-analytics-events.ts';
void test('batch-analytics-events JS matcher', async (t) => {
  await t.test('flags unload and beforeunload listeners calling sendBeacon, fetch, or synchronous XMLHttpRequest', () => {
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
    const matches = matchJsRule(batchAnalyticsEventsMatcher, 'analytics.js', code);
    assert.equal(matches.length, 3);
    assert.match(matches[0]?.message ?? '', /visibilitychange/);
    assert.doesNotMatch(matches[0]?.message ?? '', /fetchLater/);
  });

  await t.test('exempts visibilitychange / pagehide listeners and unsaved-changes beforeunload prompts', () => {
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

      window.addEventListener('pagehide', () => {
        navigator.sendBeacon('/analytics', data);
      });
    `;
    const matches = matchJsRule(batchAnalyticsEventsMatcher, 'safe.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('flags onunload assignment and named listener functions sending telemetry', () => {
    const code = `
      function sendTelemetry() {
        navigator.sendBeacon('/log', JSON.stringify({ event: 'exit' }));
      }
      window.addEventListener('unload', sendTelemetry);

      window.onunload = () => {
        navigator.sendBeacon('/onunload-log', payload);
      };
    `;
    const matches = matchJsRule(batchAnalyticsEventsMatcher, 'named-handler.js', code);
    assert.equal(matches.length, 2);
  });
});
