import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { createInMemoryProject, scanJsSource } from '../scanners/index.ts';
import {
  CALCULATE_EVENT_DIFFERENTIALS_GUIDE_HASH,
  calculateEventDifferentialsMatcher,
  calculateEventDifferentialsRule,
  calculateEventDifferentialsRules,
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
    assert.equal(calculateEventDifferentialsRules.length, 0);
  });

  test('flags Date difference divided by 86400000 (days) with .getTime() on both sides', () => {
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

  test('flags new Date differences divided by 86400000', () => {
    const code = `
      function diffInDays(a, b) {
        return (new Date(a) - new Date(b)) / 86400000;
      }
    `;
    const { matches } = scanJsSource(
      'time/new-date.js',
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
        return (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
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

  test('flags moment.diff with calendar days unit', () => {
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
    assert.match(matches[0].message, /diff/);
  });

  test('flags dayjs.diff with calendar months unit', () => {
    const code = `
      function getDiffInMonths(d1, d2) {
        return dayjs(d1).diff(d2, 'months');
      }
    `;
    const { matches } = scanJsSource(
      'time/dayjs-diff.js',
      code,
      [calculateEventDifferentialsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /diff/);
  });

  test('ignores Date.now() cache expiration or elapsed timers', () => {
    const code = `
      function isExpired(cachedAt) {
        return (Date.now() - cachedAt.getTime()) / 86400000 > 7;
      }
    `;
    const { matches } = scanJsSource(
      'cache/ttl.js',
      code,
      [calculateEventDifferentialsMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores intra-day divisions (/ 3600000 for hours, / 60000 for minutes, / 1000 for seconds)', () => {
    const code = `
      function getHours(a, b) {
        const hours = (a.getTime() - b.getTime()) / 3600000;
        const seconds = (a.getTime() - b.getTime()) / 1000;
        return { hours, seconds };
      }
    `;
    const { matches } = scanJsSource(
      'time/hours.js',
      code,
      [calculateEventDifferentialsMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores .diff() with intra-day hours unit or minute m unit', () => {
    const code = `
      function durationHours(dateEnd, dateStart) {
        const h = dateEnd.diff(dateStart, 'hours');
        const m = dateEnd.diff(dateStart, 'm');
        return { h, m };
      }
    `;
    const { matches } = scanJsSource(
      'time/diff.js',
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

  test('ignores Math.round or Date.UTC or new Date() with 0 args subtraction', () => {
    const code = `
      function calc(a, b) {
        const roundVal = Math.round((a.getTime() - b.getTime()) / 86400000);
        const utcVal = (new Date(Date.UTC(2024, 0, 1)) - new Date(Date.UTC(2023, 0, 1))) / 86400000;
        const nowVal = (new Date() - new Date(a)) / 86400000;
        return { roundVal, utcVal, nowVal };
      }
    `;
    const { matches } = scanJsSource(
      'time/now-round.js',
      code,
      [calculateEventDifferentialsMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });
});
