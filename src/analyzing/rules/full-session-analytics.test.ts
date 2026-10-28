import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  fullSessionAnalyticsMatcher,
} from './full-session-analytics.ts';

void test('full-session-analytics JS matcher', async (t) => {
  await t.test('flags visibilitychange and pagehide listeners dispatching navigator.sendBeacon or fetch keepalive', () => {
    const code = `
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          navigator.sendBeacon('/analytics', JSON.stringify(sessionMetrics));
        }
      });

      window.addEventListener('pagehide', () => {
        fetch('/telemetry', {
          method: 'POST',
          body: JSON.stringify(queue),
          keepalive: true,
        });
      });
    `;
    const matches = matchJsRule(fullSessionAnalyticsMatcher, 'analytics.js', code);
    assert.equal(matches.length, 2);
    assert.match(matches[0]?.message ?? '', /fetchLater/);
  });

  await t.test('exempts code that already uses fetchLater() or unload/beforeunload listeners handled by batch-analytics-events', () => {
    const modernCode = `
      let controller = null;
      function updateSessionBeacon(data) {
        if (controller) controller.abort();
        controller = new AbortController();
        fetchLater('/analytics', {
          method: 'POST',
          body: JSON.stringify(data),
          signal: controller.signal,
        });
      }
    `;
    assert.equal(
      matchJsRule(fullSessionAnalyticsMatcher, 'modern.js', modernCode).length,
      0,
    );

    const unloadCode = `
      window.addEventListener('unload', () => {
        navigator.sendBeacon('/analytics', JSON.stringify(events));
      });
    `;
    assert.equal(
      matchJsRule(fullSessionAnalyticsMatcher, 'unload.js', unloadCode).length,
      0,
    );
  });
});
