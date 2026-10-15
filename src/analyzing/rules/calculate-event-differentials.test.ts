import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { createInMemoryProject, scanJsSource } from '../scanners/index.ts';
import {
  CALCULATE_EVENT_DIFFERENTIALS_GUIDE_HASH,
  calculateEventDifferentialsMatcher,
  calculateEventDifferentialsRule,
} from './calculate-event-differentials.ts';

describe('calculate-event-differentials rule', () => {
  const project = createInMemoryProject();

  test('has correct metadata and 12-char guideHash', () => {
    assert.equal(calculateEventDifferentialsRule.id, 'calculate-event-differentials');
    assert.equal(calculateEventDifferentialsRule.guideId, 'calculate-event-differentials');
    assert.equal(calculateEventDifferentialsRule.guideHash, CALCULATE_EVENT_DIFFERENTIALS_GUIDE_HASH);
    assert.equal(calculateEventDifferentialsRule.guideHash.length, 12);
    assert.ok(calculateEventDifferentialsRule.phase2Rubric.keepWhen.length >= 2);
    assert.ok(calculateEventDifferentialsRule.phase2Rubric.dropWhen.length >= 2);
  });

  test('flags Date difference divided by 86400000 (days)', () => {
    const code = `
      function getDaysBetween(date1, date2) {
        const diffDays = (date1.getTime() - date2.getTime()) / 86400000;
        return diffDays;
      }
    `;
    const { matches } = scanJsSource(
      'time/days.js',
      code,
      [calculateEventDifferentialsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /Temporal/);
  });

  test('flags Date difference divided by (1000 * 60 * 60 * 24)', () => {
    const code = `
      function daysUntilExpiration(endDate, startDate) {
        return (endDate - startDate) / (1000 * 60 * 60 * 24);
      }
    `;
    const { matches } = scanJsSource(
      'time/calc.js',
      code,
      [calculateEventDifferentialsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /Temporal/);
  });

  test('flags timestamp difference divided by 3600000 (hours)', () => {
    const code = `
      function getHoursElapsed(startTime) {
        return (Date.now() - startTime) / 3600000;
      }
    `;
    const { matches } = scanJsSource(
      'time/hours.js',
      code,
      [calculateEventDifferentialsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /Temporal/);
  });

  test('flags real-world tiddlywiki week calculation pattern', () => {
    const code = `
      function calcWeek(dt, x) {
        var n = Math.floor((dt.getTime() - x.getTime()) / 86400000);
        return n;
      }
    `;
    const { matches } = scanJsSource(
      'core/modules/utils/utils.js',
      code,
      [calculateEventDifferentialsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /86400000/);
  });

  test('flags direct Date timestamp subtraction (a.getTime() - b.getTime())', () => {
    const code = `
      function getDurationMs(eventA, eventB) {
        return eventA.getTime() - eventB.getTime();
      }
    `;
    const { matches } = scanJsSource(
      'events/duration.js',
      code,
      [calculateEventDifferentialsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /subtraction/);
  });

  test('flags direct Date subtraction divided by 1000 for seconds', () => {
    const code = `
      function secondsRemaining(expiresAt) {
        return (expiresAt.getTime() - Date.now()) / 1000;
      }
    `;
    const { matches } = scanJsSource(
      'auth/token.js',
      code,
      [calculateEventDifferentialsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /1000/);
  });

  test('flags division where dividend is a local variable from Date subtraction', () => {
    const code = `
      function computeElapsedDays(dateA, dateB) {
        const delta = dateA.getTime() - dateB.getTime();
        const days = delta / 86400000;
        return days;
      }
    `;
    const { matches } = scanJsSource(
      'time/elapsed.js',
      code,
      [calculateEventDifferentialsMatcher],
      project,
    );
    assert.ok(matches.length >= 1);
  });

  test('flags moment.diff with calendar unit', () => {
    const code = `
      function getDiffInDays(d1, d2) {
        return moment(d1).diff(moment(d2), 'days');
      }
    `;
    const { matches } = scanJsSource(
      'time/moment-diff.js',
      code,
      [calculateEventDifferentialsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /moment\.diff/);
  });

  test('flags .diff() call with hours unit', () => {
    const code = `
      function durationHours(dateEnd, dateStart) {
        return dateEnd.diff(dateStart, 'hours');
      }
    `;
    const { matches } = scanJsSource(
      'time/diff.js',
      code,
      [calculateEventDifferentialsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /diff\(\)/);
  });

  test('ignores benchmark timer with variable named t0 / perf', () => {
    const code = `
      function runBenchmark() {
        const t0 = Date.now();
        computeHeavyWork();
        const perfElapsed = Date.now() - t0;
        return perfElapsed;
      }
    `;
    const { matches } = scanJsSource(
      'perf/benchmark.js',
      code,
      [calculateEventDifferentialsMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores high-precision performance.now() elapsed timers', () => {
    const code = `
      function bench() {
        const t0 = performance.now();
        compute();
        return performance.now() - t0;
      }
    `;
    const { matches } = scanJsSource(
      'perf/bench.js',
      code,
      [calculateEventDifferentialsMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores date diff math when guarded by Temporal feature guard', () => {
    const code = `
      function getDiffDays(d1, d2) {
        if (typeof Temporal === 'undefined') {
          return (d1.getTime() - d2.getTime()) / 86400000;
        }
        return 0;
      }
    `;
    const { matches } = scanJsSource(
      'time/guarded.js',
      code,
      [calculateEventDifferentialsMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });
});
