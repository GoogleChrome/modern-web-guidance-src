import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  calculateTotalForegroundTimeMatcher,
} from './calculate-total-foreground-time.ts';

void test('calculate-total-foreground-time JS matcher', async (t) => {
  await t.test('flags visibilitychange listener manually accumulating foreground duration with performance.now()', () => {
    const code = `
      let visibleStart = performance.now();
      let totalForegroundTime = 0;

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          totalForegroundTime += performance.now() - visibleStart;
        } else {
          visibleStart = performance.now();
        }
      });
    `;
    const matches = matchJsRule(
      calculateTotalForegroundTimeMatcher,
      'engagement.js',
      code,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /visibility-state/);
  });

  await t.test('flags onvisibilitychange assignment accumulating elapsed visible time via Date.now()', () => {
    const code = `
      let lastVisibleAt = Date.now();
      let activeDurationMs = 0;

      document.onvisibilitychange = function () {
        if (document.hidden) {
          activeDurationMs = activeDurationMs + (Date.now() - lastVisibleAt);
        } else {
          lastVisibleAt = Date.now();
        }
      };
    `;
    const matches = matchJsRule(
      calculateTotalForegroundTimeMatcher,
      'session-timer.js',
      code,
    );
    assert.equal(matches.length, 1);
  });

  await t.test('exempts files that already query visibility-state entries or only pause timers', () => {
    const modernCode = `
      function getTotalForegroundTime() {
        const entries = performance.getEntriesByType('visibility-state');
        if (entries.length === 0) return performance.now();
        let total = 0;
        for (let i = 0; i < entries.length; i++) {
          if (entries[i].name === 'visible') {
            const end = i + 1 < entries.length ? entries[i + 1].startTime : performance.now();
            total += end - entries[i].startTime;
          }
        }
        return total;
      }
    `;
    assert.equal(
      matchJsRule(calculateTotalForegroundTimeMatcher, 'modern.js', modernCode).length,
      0,
    );

    const pauseOnlyCode = `
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          stopPolling();
        } else {
          startPolling();
        }
      });
    `;
    assert.equal(
      matchJsRule(calculateTotalForegroundTimeMatcher, 'polling.js', pauseOnlyCode).length,
      0,
    );
  });
});
