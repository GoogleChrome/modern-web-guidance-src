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
    assert.match(matches[0].message, /hours/);
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

  test('ignores simple elapsed performance timer (Date.now() - startMs without calendar unit division)', () => {
    const code = `
      function measureTask() {
        const start = Date.now();
        runTask();
        const elapsedMs = Date.now() - start;
        return elapsedMs;
      }
    `;
    const { matches } = scanJsSource(
      'perf/timer.js',
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

  test('ignores Unix epoch seconds conversion (dividing by 1000)', () => {
    const code = `
      function getUnixTimestamp() {
        return Math.floor(Date.now() / 1000);
      }
    `;
    const { matches } = scanJsSource(
      'auth/epoch.js',
      code,
      [calculateEventDifferentialsMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores non-date diff methods (e.g. Set.diff, lovefield table.diff)', () => {
    const code = `
      function getSetDiff(set1, set2) {
        return lf.structs.set.diff(set1, set2);
      }
    `;
    const { matches } = scanJsSource(
      'structs/set.js',
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
