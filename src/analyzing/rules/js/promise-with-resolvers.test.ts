import assert from 'node:assert/strict';
import test from 'node:test';
import { scanFiles } from '../../scanners/index.ts';
import { matchJsRule } from '../../scanners/js-scanner.ts';
import jsDefaultRules, { jsPromiseWithResolversRule as exportedJsRule } from '../js.ts';
import { JS_GUIDE_HASH, jsPromiseWithResolversRule, promiseWithResolversMatcher } from './promise-with-resolvers.ts';

void test('js/promise-with-resolvers matcher', async (t) => {
  await t.test('wires js/promise-with-resolvers in src/rules/js.ts with locked guideHash', () => {
    assert.strictEqual(JS_GUIDE_HASH, '78d968c460dd');
    const matchingRules = jsDefaultRules.filter((rule) => rule.id === 'js/promise-with-resolvers');
    assert.strictEqual(matchingRules.length, 1);
    const [rule] = matchingRules;
    assert.strictEqual(rule?.guideId, 'js');
    assert.strictEqual(rule?.guideHash, '78d968c460dd');
    assert.strictEqual(rule, exportedJsRule);
  });

  await t.test('flags outer identifier, instance field, and object/element property assignments', () => {
    const code = `
      class DeferredQueue {
        constructor() {
          this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
          });
        }

        enqueue(id, holder) {
          let resolveFn, rejectFn;
          const p1 = new Promise((res, rej) => {
            resolveFn = res;
            rejectFn = rej;
          });
          const p2 = new Promise((r) => (holder.resolve = r));
          const p3 = new Promise(function (resolve) {
            this._pending[id] = resolve;
          });
          const p4 = new window.Promise((resolve, _reject) => {
            resolveFn = resolve;
          });
          const p5 = new Promise((res, rej) => (resolveFn = res, rejectFn = rej));
          return { p1, p2, p3, p4, p5, resolveFn, rejectFn };
        }
      }

      const outerConstShadowedByParam = () => {};
      function assignOuterParam(outerConstShadowedByParam, items) {
        for (let slot of items) {
          slot = new Promise((r) => (slot = r));
        }
        return new Promise((r) => {
          outerConstShadowedByParam = r;
        });
      }
    `;
    const matches = matchJsRule(promiseWithResolversMatcher, 'queue.js', code);
    assert.deepEqual(
      matches.map((m) => m.line),
      [4, 12, 16, 17, 20, 23, 31, 33],
    );
  });

  await t.test('flags TypeScript generic new Promise<T> and Vue SFC scripts', () => {
    const tsCode = `
      export function createTypedDeferred<T extends Record<string, unknown>>() {
        let resolve!: (value: T) => void;
        let reject!: (reason?: unknown) => void;
        const promise = new Promise<T>((res, rej) => {
          resolve = res!;
          reject = rej as (reason?: unknown) => void;
        });
        return { promise, resolve, reject };
      }
    `;
    const tsMatches = matchJsRule(promiseWithResolversMatcher, 'deferred.ts', tsCode);
    assert.deepEqual(
      tsMatches.map((m) => m.line),
      [5],
    );

    const vueCode = `
      <template><div /></template>
      <script setup lang="ts">
      let finishTransition: () => void;
      const ready = new globalThis.Promise<void>((resolve) => {
        finishTransition = resolve;
      });
      </script>
    `;
    const vueFindings = scanFiles(
      new Map([['src/components/TransitionGate.vue', vueCode]]),
      [jsPromiseWithResolversRule],
    );
    assert.strictEqual(vueFindings.length, 1);
    assert.strictEqual(vueFindings[0]?.ruleId, 'js/promise-with-resolvers');
  });

  await t.test('excludes mixed executors, async/generator executors, and non-trivial parameter shapes', () => {
    const code = `
      function nonPureExecutors(src, timerFn) {
        let extResolve;
        const withExtraWork = new Promise((resolve, reject) => {
          extResolve = resolve;
          timerFn(() => reject(new Error('timeout')), 100);
        });
        const eventWithSetup = new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = reject;
          img.src = src;
        });
        const asyncExec = new Promise(async (resolve) => {
          extResolve = resolve;
        });
        const zeroParams = new Promise(() => {});
        const defaultParam = new Promise((resolve = extResolve) => {
          extResolve = resolve;
        });
        const destructuredParam = new Promise(({ resolve }) => {
          extResolve = resolve;
        });
        const restParam = new Promise((...args) => {
          extResolve = args[0];
        });
        const extraCtorArg = new Promise((resolve) => {
          extResolve = resolve;
        }, 'extra');
        const duplicateAssign = new Promise((resolve) => {
          extResolve = resolve;
          timerFn.cb = resolve;
        });
        const threeItemCommaArrow = new Promise((resolve, reject) => (
          extResolve = resolve,
          extResolve = reject,
          timerFn()
        ));
        return {
          withExtraWork,
          eventWithSetup,
          asyncExec,
          zeroParams,
          defaultParam,
          destructuredParam,
          restParam,
          extraCtorArg,
          duplicateAssign,
          threeItemCommaArrow,
        };
      }
    `;
    assert.deepEqual(matchJsRule(promiseWithResolversMatcher, 'excluded.js', code), []);
  });

  await t.test('excludes self-shadowed/const/using/import/class/fn LHS, side-effectful receivers, and guards', async () => {
    const code = `
      import defaultImp, { namedImp, origImp as aliasedImp } from './deps.js';
      import * as nsImp from './ns.js';

      class CustomPromise extends Promise {}
      class OuterClass {}
      function outerDeclaredFn() {}
      const namedOuterFnExpr = function namedOuterFn() {
        return new window.Promise((r) => {
          namedOuterFn = r;
        });
      };

      async function trickyCases(getHolder, Promise, items, source) {
        let resolve;
        const constResolve = () => {};
        const { destructuredConst, nested: [arrayDestructured] } = source;
        using disposable = source.getDisposable();
        await using asyncDisposable = source.getAsyncDisposable();
        const shadowed = new self.Promise((resolve) => {
          resolve = resolve;
        });
        const selfNamedExec = new self.Promise(function execFn(r) {
          execFn = r;
        });
        const localVar = new window.Promise((r) => {
          var resolve = r;
        });
        const immutableLhs = new window.Promise((r) => {
          constResolve = r;
        });
        const destructuredLhs = new window.Promise((r) => {
          destructuredConst = r;
          arrayDestructured = r;
        });
        const usingLhs = new window.Promise((r) => {
          disposable = r;
          asyncDisposable = r;
        });
        const importLhs = new window.Promise((r) => {
          defaultImp = r;
          namedImp = r;
        });
        const aliasedImportLhs = new window.Promise((r) => {
          aliasedImp = r;
          nsImp = r;
        });
        const classAndFnLhs = new window.Promise((r) => {
          OuterClass = r;
          outerDeclaredFn = r;
        });
        for (const loopConst of items) {
          const inForOf = new window.Promise((r) => {
            loopConst = r;
          });
        }
        const callInBase = new window.Promise((r) => {
          getHolder().resolve = r;
        });
        const paramReceiver = new window.Promise((r) => {
          r.fn = r;
        });
        const parenParamReceiver = new window.Promise((r) => {
          (r).fn = r;
        });
        const nonGlobalCustom = new CustomPromise((r) => {
          resolve = r;
        });
        const localShadowedPromise = new Promise((r) => {
          resolve = r;
        });

        if (typeof globalThis.Promise !== 'undefined') {
          const legacyGuard = new window.Promise((r) => {
            resolve = r;
          });
        }

        if (typeof globalThis.Promise.withResolvers !== 'function') {
          globalThis.Promise.withResolvers = function withResolvers() {
            let res, rej;
            const promise = new window.Promise((a, b) => {
              res = a;
              rej = b;
            });
            return { promise, resolve: res, reject: rej };
          };
        }

        return {
          namedOuterFnExpr,
          shadowed,
          selfNamedExec,
          localVar,
          immutableLhs,
          destructuredLhs,
          usingLhs,
          importLhs,
          aliasedImportLhs,
          classAndFnLhs,
          callInBase,
          paramReceiver,
          parenParamReceiver,
          nonGlobalCustom,
          localShadowedPromise,
        };
      }
    `;
    assert.deepEqual(matchJsRule(promiseWithResolversMatcher, 'tricky.ts', code), []);
  });

  await t.test('flags awaited new Promise with pure external assignment and excludes extra work or .on* handlers', async () => {
    const code = `
      class ChunkedReader {
        #transferFinished!: (arg0: boolean) => void;
        async read() {
          return await new Promise((resolve) => {
            this.#transferFinished = resolve;
          });
        }
      }

      async function testAwaitAndEventHandlers(iframe, kickOff) {
        let extResolve;
        await new Promise((resolve) => {
          extResolve = resolve;
          kickOff();
        });
        await new Promise((resolve) => {
          iframe.onload = resolve;
        });
        const isReady = new Promise((resolve) => {
          window.onWasmInitialized = resolve;
        });
        return { extResolve, isReady };
      }
    `;
    assert.deepEqual(
      matchJsRule(promiseWithResolversMatcher, 'handlers.ts', code).map((m) => m.line),
      [5],
    );
  });

  await t.test('excludes .obsidian and .vitepress paths only on js/promise-with-resolvers', () => {
    const code = `
      let resolveFn;
      const p = new Promise((resolve) => {
        resolveFn = resolve;
      });
    `;
    assert.deepEqual(matchJsRule(promiseWithResolversMatcher, '.obsidian/plugins/main.js', code), []);
    assert.deepEqual(matchJsRule(promiseWithResolversMatcher, '.vitepress/theme/Layout.js', code), []);
    assert.equal(matchJsRule(promiseWithResolversMatcher, 'src/deferred.js', code).length, 1);
  });
});
