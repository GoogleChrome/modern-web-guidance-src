import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { createInMemoryProject, scanJsSource } from '../scanners/index.ts';
import {
  BREAK_UP_LONG_TASKS_GUIDE_HASH,
  breakUpLongTasksMatcher,
  breakUpLongTasksRule,
  breakUpLongTasksRules,
} from './break-up-long-tasks.ts';

describe('break-up-long-tasks rule', () => {
  const project = createInMemoryProject();

  test('has correct metadata and 12-char guideHash', () => {
    assert.equal(breakUpLongTasksRule.id, 'break-up-long-tasks');
    assert.equal(breakUpLongTasksRule.guideId, 'break-up-long-tasks');
    assert.equal(breakUpLongTasksRule.guideHash, BREAK_UP_LONG_TASKS_GUIDE_HASH);
    assert.equal(breakUpLongTasksRule.guideHash.length, 12);
    assert.ok(breakUpLongTasksRule.verifierRubric.keepWhen.length >= 2);
    assert.ok(breakUpLongTasksRule.verifierRubric.dropWhen.length >= 2);
    assert.equal(breakUpLongTasksRules.length, 1);
  });

  test('flags new Promise(resolve => setTimeout(resolve, 0)) yielding', () => {
    const code = `
      async function processArray(items) {
        for (const item of items) {
          processItem(item);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    `;
    const { matches } = scanJsSource(
      'perf/chunk.js',
      code,
      [breakUpLongTasksMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /scheduler\.yield/);
  });

  test('flags new Promise(r => setTimeout(r)) with omitted delay', () => {
    const code = `
      const yieldToMain = () => new Promise(r => setTimeout(r));
    `;
    const { matches } = scanJsSource(
      'perf/yield.js',
      code,
      [breakUpLongTasksMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /scheduler\.yield/);
  });

  test('flags new Promise with setImmediate(resolve)', () => {
    const code = `
      function yieldControl() {
        return new Promise(resolve => setImmediate(resolve));
      }
    `;
    const { matches } = scanJsSource(
      'perf/immediate.js',
      code,
      [breakUpLongTasksMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /setImmediate/);
  });

  test('flags setImmediate inside a processing loop', () => {
    const code = `
      function processBatch(queue) {
        while (queue.length > 0) {
          const task = queue.shift();
          task();
          setImmediate(() => processBatch(queue));
        }
      }
    `;
    const { matches } = scanJsSource(
      'perf/batch.js',
      code,
      [breakUpLongTasksMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /setImmediate/);
  });

  test('flags MessageChannel port postMessage task yielding helper', () => {
    const code = `
      function createYieldScheduler() {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          runNextTask();
        };
        return () => channel.port2.postMessage(null);
      }
    `;
    const { matches } = scanJsSource(
      'perf/channel.js',
      code,
      [breakUpLongTasksMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /MessageChannel/);
  });

  test('ignores standalone setTimeout(fn, 0) without Promise (high-precision constraint)', () => {
    const code = `
      function handleClick() {
        setTimeout(function() {
          document.getElementById('search').focus();
        }, 0);
      }
    `;
    const { matches } = scanJsSource(
      'ui/focus.js',
      code,
      [breakUpLongTasksMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores sleep or delay promises with non-zero timeout (e.g. 200ms)', () => {
    const code = `
      async function delayOperation() {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    `;
    const { matches } = scanJsSource(
      'utils/delay.js',
      code,
      [breakUpLongTasksMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores yielding fallback when guarded by scheduler.yield check', () => {
    const code = `
      async function processWithFallback(items) {
        for (const item of items) {
          if ('scheduler' in window && 'yield' in window.scheduler) {
            await scheduler.yield();
          } else {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
      }
    `;
    const { matches } = scanJsSource(
      'perf/guarded.js',
      code,
      [breakUpLongTasksMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores code guarded by optional chaining scheduler.yield fallback', () => {
    const code = `
      async function yieldNext() {
        await (globalThis.scheduler?.yield?.() ?? new Promise(r => setTimeout(r, 0)));
      }
    `;
    const { matches } = scanJsSource(
      'perf/optional-yield.js',
      code,
      [breakUpLongTasksMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores test files and node files', () => {
    const code = `
      async function flushQueue() {
        await new Promise(r => setTimeout(r, 0));
      }
    `;
    const { matches } = scanJsSource(
      'test/helpers.test.js',
      code,
      [breakUpLongTasksMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores MessageChannel when port is passed in transfer list to worker', () => {
    const code = `
      function createWorkerRpc(worker) {
        const channel = new MessageChannel();
        worker.postMessage({ type: 'HANDSHAKE' }, [channel.port2]);
        channel.port1.onmessage = (e) => {
          handleResponse(e.data);
        };
      }
    `;
    const { matches } = scanJsSource(
      'rpc/worker.js',
      code,
      [breakUpLongTasksMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores MessageChannel when port2.postMessage is never invoked locally', () => {
    const code = `
      function getChannel() {
        const channel = new MessageChannel();
        channel.port1.onmessage = (e) => console.log(e);
        return channel;
      }
    `;
    const { matches } = scanJsSource(
      'rpc/channel.js',
      code,
      [breakUpLongTasksMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores new Promise with setTimeout only invoking .focus(), .select(), or .scrollIntoView()', () => {
    const code = `
      function focusInputDeferred(input) {
        return new Promise((resolve) => {
          setTimeout(() => {
            input.focus();
            resolve();
          }, 0);
        });
      }

      function selectInputDeferred(input) {
        return new Promise((resolve) => {
          input.select();
          setTimeout(resolve, 0);
        });
      }

      function scrollPanelDeferred(panel) {
        return new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
          panel.scrollIntoView();
        });
      }
    `;
    const { matches } = scanJsSource(
      'ui/dom-defer.js',
      code,
      [breakUpLongTasksMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });
});
