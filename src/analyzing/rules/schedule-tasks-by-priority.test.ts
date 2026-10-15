import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { createInMemoryProject, scanJsSource } from '../scanners/index.ts';
import {
  SCHEDULE_TASKS_BY_PRIORITY_GUIDE_HASH,
  scheduleTasksByPriorityMatcher,
  scheduleTasksByPriorityRule,
} from './schedule-tasks-by-priority.ts';

describe('schedule-tasks-by-priority rule', () => {
  const project = createInMemoryProject();

  test('has correct metadata and 12-char guideHash', () => {
    assert.equal(scheduleTasksByPriorityRule.id, 'schedule-tasks-by-priority');
    assert.equal(scheduleTasksByPriorityRule.guideId, 'schedule-tasks-by-priority');
    assert.equal(scheduleTasksByPriorityRule.guideHash, SCHEDULE_TASKS_BY_PRIORITY_GUIDE_HASH);
    assert.equal(scheduleTasksByPriorityRule.guideHash.length, 12);
    assert.ok(scheduleTasksByPriorityRule.phase2Rubric.keepWhen.length >= 2);
    assert.ok(scheduleTasksByPriorityRule.phase2Rubric.dropWhen.length >= 2);
  });

  test('flags global requestIdleCallback call', () => {
    const code = `
      function sendAnalyticsBeacon(data) {
        requestIdleCallback(() => {
          navigator.sendBeacon('/log', JSON.stringify(data));
        });
      }
    `;
    const { matches } = scanJsSource(
      'analytics/beacon.js',
      code,
      [scheduleTasksByPriorityMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /scheduler\.postTask/);
  });

  test('flags window.requestIdleCallback with options', () => {
    const code = `
      function schedulePreload() {
        window.requestIdleCallback(runPreload, { timeout: 2000 });
      }
    `;
    const { matches } = scanJsSource(
      'perf/preload.js',
      code,
      [scheduleTasksByPriorityMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /scheduler\.postTask/);
  });

  test('flags idle utility wrapper (like openstreetmap-id call_when_idle)', () => {
    const code = `
      export function utilCallWhenIdle(func, timeout) {
        return function(...args) {
          window.requestIdleCallback(() => {
            func(...args);
          }, { timeout });
        };
      }
    `;
    const { matches } = scanJsSource(
      'util/call-when-idle.js',
      code,
      [scheduleTasksByPriorityMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /scheduler\.postTask/);
  });

  test('ignores requestIdleCallback inside scheduler.postTask feature check else branch', () => {
    const code = `
      function runTask(task) {
        if ('scheduler' in window && 'postTask' in window.scheduler) {
          scheduler.postTask(task, { priority: 'background' });
        } else {
          window.requestIdleCallback(task);
        }
      }
    `;
    const { matches } = scanJsSource(
      'perf/safe-task.js',
      code,
      [scheduleTasksByPriorityMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores requestIdleCallback inside negative scheduler check then branch', () => {
    const code = `
      function fallbackSchedule(cb) {
        if (!('scheduler' in window && 'postTask' in window.scheduler)) {
          requestIdleCallback(cb);
        }
      }
    `;
    const { matches } = scanJsSource(
      'perf/fallback.js',
      code,
      [scheduleTasksByPriorityMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores requestIdleCallback when shadowed by parameter', () => {
    const code = `
      function testScheduler(requestIdleCallback) {
        requestIdleCallback(() => {});
      }
    `;
    const { matches } = scanJsSource(
      'test/scheduler.js',
      code,
      [scheduleTasksByPriorityMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores requestIdleCallback method on custom non-window object', () => {
    const code = `
      const myQueue = {
        requestIdleCallback(fn) {
          fn();
        }
      };
      myQueue.requestIdleCallback(() => {});
    `;
    const { matches } = scanJsSource(
      'queue/custom.js',
      code,
      [scheduleTasksByPriorityMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });
});
