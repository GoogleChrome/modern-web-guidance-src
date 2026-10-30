import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { scanJsSource } from '../scanners/index.ts';
import { durationJsMatcher } from './calculate-event-differentials.ts';

describe('format-human-readable-durations/js-duration-formatter rule', () => {
  test('flags humanizeDuration and prettyMs calls', () => {
    const code = `
      function renderSpan(ms) {
        const a = humanizeDuration(ms);
        const b = prettyMs(ms);
        return a + b;
      }
    `;
    const { matches } = scanJsSource('ui/duration.js', code, [durationJsMatcher]);
    assert.equal(matches.length, 2);
    assert.match(matches[0]!.message, /Temporal\.Duration/);
  });

  test('flags moment.duration().humanize() and custom formatDuration function', () => {
    const code = `
      const label = moment.duration(5000).humanize();
      function formatDuration(sec) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return h + 'hr ' + m + 'min';
      }
    `;
    const { matches } = scanJsSource('ui/format.js', code, [durationJsMatcher]);
    assert.equal(matches.length, 2);
  });

  test('ignores duration calls guarded by Intl.DurationFormat feature detection', () => {
    const code = `
      function renderSpan(ms) {
        if (typeof Intl.DurationFormat === 'undefined') {
          return humanizeDuration(ms);
        }
        return '';
      }
    `;
    const { matches } = scanJsSource('ui/guarded.js', code, [durationJsMatcher]);
    assert.equal(matches.length, 0);
  });
});
