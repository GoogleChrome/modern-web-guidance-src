import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { createInMemoryProject, scanJsSource } from '../scanners/index.ts';
import {
  MANAGE_RECURRING_INTERVALS_GUIDE_HASH,
  manageRecurringIntervalsMatcher,
  manageRecurringIntervalsRule,
  manageRecurringIntervalsRules,
} from './manage-recurring-intervals.ts';

describe('manage-recurring-intervals rule', () => {
  const project = createInMemoryProject();

  test('has correct metadata and 12-char guideHash', () => {
    assert.equal(manageRecurringIntervalsRule.id, 'manage-recurring-intervals');
    assert.equal(manageRecurringIntervalsRule.guideId, 'manage-recurring-intervals');
    assert.equal(manageRecurringIntervalsRule.guideHash, MANAGE_RECURRING_INTERVALS_GUIDE_HASH);
    assert.equal(manageRecurringIntervalsRule.guideHash.length, 12);
    assert.ok(manageRecurringIntervalsRule.phase2Rubric.keepWhen.length >= 2);
    assert.ok(manageRecurringIntervalsRule.phase2Rubric.dropWhen.length >= 2);
    assert.equal(manageRecurringIntervalsRules.length, 1);
  });

  test('flags d.setMonth(d.getMonth() + 1) recurring month advance', () => {
    const code = `
      function advanceBillingCycle(date) {
        date.setMonth(date.getMonth() + 1);
        return date;
      }
    `;
    const { matches } = scanJsSource(
      'billing/cycle.js',
      code,
      [manageRecurringIntervalsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /Temporal\.PlainDate\.prototype\.add/);
  });

  test('flags d.setFullYear(d.getFullYear() + 1) annual renewal', () => {
    const code = `
      function renewYearly(subDate) {
        subDate.setFullYear(subDate.getFullYear() + 1);
      }
    `;
    const { matches } = scanJsSource(
      'subs/renew.js',
      code,
      [manageRecurringIntervalsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /Temporal\.PlainDate\.prototype\.add/);
  });

  test('flags moment(...).add(1, "months") interval arithmetic', () => {
    const code = `
      function getNextMonth(startDate) {
        return moment(startDate).add(1, 'month').toDate();
      }
    `;
    const { matches } = scanJsSource(
      'calendar/intervals.js',
      code,
      [manageRecurringIntervalsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /Temporal\.PlainDate\.prototype\.add/);
  });

  test('flags dayjs(...).add(1, "year") interval arithmetic', () => {
    const code = `
      function addYear(d) {
        return dayjs(d).add(1, 'year');
      }
    `;
    const { matches } = scanJsSource(
      'payroll/dates.js',
      code,
      [manageRecurringIntervalsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /Temporal\.PlainDate\.prototype\.add/);
  });

  test('ignores simple day offset (d.setDate(d.getDate() + 7))', () => {
    const code = `
      function nextWeek(date) {
        const next = new Date(date);
        next.setDate(next.getDate() + 7);
        return next;
      }
    `;
    const { matches } = scanJsSource(
      'schedule/recurrence.js',
      code,
      [manageRecurringIntervalsMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores dayjs day offset (.add(7, "days"))', () => {
    const code = `
      function addDays(d) {
        return dayjs(d).add(7, 'days');
      }
    `;
    const { matches } = scanJsSource(
      'schedule/days.js',
      code,
      [manageRecurringIntervalsMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores setter with constant without arithmetic (e.g. date.setMonth(0))', () => {
    const code = `
      function resetToJanuary(date) {
        date.setMonth(0);
        return date;
      }
    `;
    const { matches } = scanJsSource(
      'dates/anchor.js',
      code,
      [manageRecurringIntervalsMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores date operations guarded by Temporal', () => {
    const code = `
      function safeNextMonth(d) {
        if (typeof Temporal !== 'undefined') {
          const p = Temporal.PlainDate.from(d.toISOString().slice(0, 10));
          return p.add({ months: 1 });
        } else {
          d.setMonth(d.getMonth() + 1);
          return d;
        }
      }
    `;
    const { matches } = scanJsSource(
      'compat/month.js',
      code,
      [manageRecurringIntervalsMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });
});
