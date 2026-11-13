import assert from 'node:assert/strict';
import test from 'node:test';
import { scanFiles } from '../../scanners/index.ts';
import { matchJsRuleWithFastTokens as matchJsRule } from '../../scanners/js-scanner.ts';
import jsDefaultRules, { abortSignalTimeoutRule as exportedJsRule } from '../js.ts';
import {
  JS_GUIDE_HASH,
  abortSignalTimeoutMatcher,
  abortSignalTimeoutRule,
} from './abort-signal-timeout.ts';

void test('js/abort-signal-timeout matcher', async (t) => {
  await t.test('wires js/abort-signal-timeout in src/rules/js.ts with the locked guideHash', () => {
    assert.strictEqual(JS_GUIDE_HASH, '78d968c460dd');
    const matchingRules = jsDefaultRules.filter((rule) => rule.id === 'js/abort-signal-timeout');
    assert.strictEqual(matchingRules.length, 1);
    const [rule] = matchingRules;
    assert.strictEqual(rule?.guideId, 'js');
    assert.strictEqual(rule?.guideHash, '78d968c460dd');
    assert.strictEqual(rule, exportedJsRule);
  });

  await t.test('flags pure AbortController + setTimeout timeout scaffolding across callback and scope variants', () => {
    const code = `
      async function conciseArrow(url, ms) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ms);
        try {
          return await fetch(url, { signal: controller.signal });
        } finally {
          clearTimeout(timer);
        }
      }

      async function blockArrowAndDestructured(url) {
        const controller = new window.AbortController();
        const { signal } = controller;
        window.setTimeout(() => {
          controller.abort();
        }, 5000);
        return fetch(url, { signal });
      }

      function boundAndFunctionExpr(url) {
        let first = new globalThis.AbortController();
        globalThis.setTimeout(first.abort.bind(first), 2500);

        var second = (new AbortController()) as AbortController;
        setTimeout(function () {
          second.abort();
        }, 1500);

        const third = new AbortController();
        setTimeout(third['abort'].bind(third), 1000);

        function shadowHelper(first) {
          first.abort();
        }
        return [first.signal, second.signal, third.signal, shadowHelper];
      }

      function dualCatchAllowsTimeoutError(url) {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 3000);
        return fetch(url, { signal: controller.signal }).catch((err) => {
          if (err.name === 'AbortError' || err.name === 'TimeoutError') {
            return null;
          }
          throw err;
        });
      }

      function unguardedBesideDirectCall(url) {
        const fastSignal = AbortSignal.timeout(500);
        if (!url) return fastSignal;
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 4000);
        return fetch(url, { signal: controller.signal });
      }
    `;
    const matches = matchJsRule(abortSignalTimeoutMatcher, 'timeouts.ts', code);
    assert.deepEqual(
      matches.map((m) => m.line),
      [3, 13, 22, 25, 30, 40, 53],
    );
  });

  await t.test('flags inline script blocks in HTML files with accurate line numbers', () => {
    const html = `<!doctype html>
<html>
  <head><title>Test</title></head>
  <body>
    <script>
      async function ping(url) {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 3000);
        await fetch(url, { signal: controller.signal });
      }
    </script>
  </body>
</html>
`;
    const findings = scanFiles(new Map([['public/index.html', html]]), [abortSignalTimeoutRule]);
    assert.deepEqual(
      findings.map((f) => ({ file: f.file, line: f.line, ruleId: f.ruleId })),
      [{ file: 'public/index.html', line: 7, ruleId: 'js/abort-signal-timeout' }],
    );
  });

  await t.test('exempts timeout callbacks with side effects, custom abort reasons, or unbound tear-offs', () => {
    const code = `
      function withExtraStatement(url) {
        let timedOut = false;
        const controller = new AbortController();
        setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, 5000);
        return fetch(url, { signal: controller.signal }).then((r) => ({ r, timedOut }));
      }

      function withCommaSideEffect(url) {
        let flag = false;
        const controller = new AbortController();
        setTimeout(() => (flag = true, controller.abort()), 5000);
        return { signal: controller.signal, flag };
      }

      function withCustomReason(url) {
        const c1 = new AbortController();
        setTimeout(() => c1.abort('Timed out'), 5000);

        const c2 = new AbortController();
        setTimeout(c2.abort.bind(c2, new Error('Timed out')), 5000);

        const c3 = new AbortController();
        setTimeout((reason) => c3.abort(reason), 5000);
        return [c1.signal, c2.signal, c3.signal];
      }

      function withInvalidBindOrTearOff(other) {
        const c1 = new AbortController();
        setTimeout(c1.abort, 5000);

        const c2 = new AbortController();
        setTimeout(c2.abort.bind(other), 5000);

        const c3 = new AbortController();
        const cb = () => c3.abort();
        setTimeout(cb, 5000);

        const c4 = new AbortController();
        setTimeout(async () => { c4.abort(); }, 5000);

        const c5 = new AbortController();
        setTimeout(function* () { c5.abort(); }, 5000);

        const c6 = new AbortController();
        setTimeout?.(() => c6.abort(), 5000);
        return [c1.signal, c2.signal, c3.signal, c4.signal, c5.signal, c6.signal];
      }
    `;
    assert.equal(matchJsRule(abortSignalTimeoutMatcher, 'callbacks.js', code).length, 0);
  });

  await t.test('isolates top-level script declarations across multiple files in the same Project', () => {
    const fileA = `
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000);
      fetch('/a', { signal: controller.signal });
    `;
    const fileB = `
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 3000);
      document.getElementById('cancel')?.addEventListener('click', () => controller.abort());
      fetch('/b', { signal: controller.signal });
    `;
    const findings = scanFiles(
      new Map([
        ['a.js', fileA],
        ['b.js', fileB],
      ]),
      [abortSignalTimeoutRule],
    );
    assert.deepEqual(
      findings.map((f) => ({ file: f.file, line: f.line, ruleId: f.ruleId })),
      [{ file: 'a.js', line: 2, ruleId: 'js/abort-signal-timeout' }],
    );
  });

  await t.test('exempts controllers with external or manual abort paths, escapes, or loop sharing', () => {
    const code = `
      export const exportedController = new AbortController();
      setTimeout(() => exportedController.abort(), 5000);

      function withManualCancel(url, cancelBtn) {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5000);
        cancelBtn.addEventListener('click', () => controller.abort());
        return fetch(url, { signal: controller.signal });
      }

      function withDestructuredAbort() {
        const controller = new AbortController();
        const { signal, abort } = controller;
        setTimeout(() => controller.abort(), 5000);
        return { signal, abort };
      }

      function withEscapeOrReassign(register) {
        const returned = new AbortController();
        setTimeout(() => returned.abort(), 5000);
        register(returned);

        let reassigned = new AbortController();
        setTimeout(() => reassigned.abort(), 5000);
        reassigned = new AbortController();

        const mutated = new AbortController();
        mutated.onabort = () => {};
        setTimeout(() => mutated.abort(), 5000);
        return returned;
      }

      async function sharedAcrossLoop(urls) {
        const controller = new AbortController();
        for (const url of urls) {
          setTimeout(() => controller.abort(), 5000);
          await fetch(url, { signal: controller.signal });
        }
      }
    `;
    assert.equal(matchJsRule(abortSignalTimeoutMatcher, 'manual-abort.js', code).length, 0);
  });

  await t.test('exempts try/catch and promise handlers checking AbortError without TimeoutError', () => {
    const code = `
      async function siblingTryCatch(url) {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5000);
        try {
          return await fetch(url, { signal: controller.signal });
        } catch (err) {
          if (err.name === 'AbortError') {
            return null;
          }
          throw err;
        }
      }

      async function enclosingTryCatch(url) {
        try {
          const controller = new AbortController();
          setTimeout(() => controller.abort(), 5000);
          return await fetch(url, { signal: controller.signal });
        } catch (error) {
          if (error?.code === DOMException.ABORT_ERR) {
            return 'timed-out';
          }
          throw error;
        }
      }

      function promiseCatch(url) {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5000);
        return fetch(url, { signal: controller.signal }).catch((e) => {
          if (e.name === 'AbortError') return [];
          throw e;
        });
      }

      function promiseTwoArgThenReject(url, onOk) {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5000);
        return fetch(url, { signal: controller.signal }).then(onOk, (e) => {
          if (e.name === 'AbortError') return [];
          throw e;
        });
      }

      async function numericCodeCatch(url) {
        try {
          const controller = new AbortController();
          setTimeout(() => controller.abort(), 5000);
          return await fetch(url, { signal: controller.signal });
        } catch (err) {
          if (err.code === 20) return;
        }
      }
    `;
    assert.equal(matchJsRule(abortSignalTimeoutMatcher, 'abort-error.js', code).length, 0);
  });

  await t.test('isolates feature guards per function, ignores non-error AbortError strings, and handles var/destructured shadowing', () => {
    const code = `
      function guardedHelper(ms) {
        if (Reflect.has(AbortSignal, 'timeout')) return AbortSignal.timeout(ms);
        const controller = new AbortController();
        setTimeout(() => controller.abort(), ms);
        return controller.signal;
      }

      function hasOwnGuardedHelper(ms) {
        if (Object.prototype.hasOwnProperty.call(AbortSignal, 'timeout')) {
          return AbortSignal.timeout(ms);
        }
        const controller = new AbortController();
        setTimeout(() => controller.abort(), ms);
        return controller.signal;
      }

      function unguardedWithLogAndInnerVar(url, obj, flag, track) {
        track(AbortSignal, 'timeout');
        console.debug('AbortError outside catch does not suppress');
        const controller = new AbortController();
        function innerHoistedVar() {
          if (flag) {
            var controller = { abort() {} };
          }
          controller.abort();
        }
        if (flag) {
          const { controller } = obj;
          controller.abort();
        }
        const innerDestructuredParam = ({ controller }) => controller.abort();
        const { controller: renamedSignal } = obj;
        setTimeout(() => controller.abort(), 5000);
        return [fetch(url, { signal: controller.signal }), innerHoistedVar, innerDestructuredParam, renamedSignal];
      }
    `;
    const matches = matchJsRule(abortSignalTimeoutMatcher, 'isolation.js', code);
    assert.deepEqual(
      matches.map((m) => m.line),
      [21],
    );
  });

  await t.test('exempts AbortSignal.timeout and AbortController feature guards, polyfills, shadowed globals, and invalid setTimeout arity', () => {
    const guarded1 = `
      function timeoutSignal(ms) {
        if (typeof AbortSignal.timeout === 'function') {
          return AbortSignal.timeout(ms);
        }
        const controller = new AbortController();
        setTimeout(() => controller.abort(), ms);
        return controller.signal;
      }
    `;
    assert.equal(matchJsRule(abortSignalTimeoutMatcher, 'guard-typeof.js', guarded1).length, 0);

    const guarded2 = `
      const signal =
        'timeout' in AbortSignal
          ? AbortSignal.timeout(5000)
          : (() => {
              const controller = new AbortController();
              setTimeout(() => controller.abort(), 5000);
              return controller.signal;
            })();
    `;
    assert.equal(matchJsRule(abortSignalTimeoutMatcher, 'guard-in.js', guarded2).length, 0);

    const polyfill = `
      if (!AbortSignal.timeout) {
        AbortSignal.timeout = function timeout(ms) {
          const controller = new AbortController();
          setTimeout(() => controller.abort(), ms);
          return controller.signal;
        };
      }
    `;
    assert.equal(matchJsRule(abortSignalTimeoutMatcher, 'polyfill.js', polyfill).length, 0);

    const optionalChainGuard = `
      function smartTimeout(ms) {
        const sig = AbortSignal?.timeout?.(ms);
        if (sig) return sig;
        const controller = new AbortController();
        setTimeout(() => controller.abort(), ms);
        return controller.signal;
      }
    `;
    assert.equal(matchJsRule(abortSignalTimeoutMatcher, 'guard-optional.js', optionalChainGuard).length, 0);

    const controllerGuardAndShadowed = `
      function legacyEnv() {
        if (typeof AbortController !== 'undefined') {
          const controller = new AbortController();
          setTimeout(() => controller.abort(), 5000);
          return controller.signal;
        }
        return undefined;
      }

      function shadowedGlobals(AbortController, setTimeout) {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5000);
        return controller.signal;
      }

      function wrongTimeoutArity() {
        const c1 = new AbortController();
        setTimeout(() => c1.abort());
        const c2 = new AbortController();
        setTimeout(() => c2.abort(), 1000, 'extra');
        // const c3 = new AbortController(); setTimeout(() => c3.abort(), 1000);
        const raw = 'const c4 = new AbortController(); setTimeout(() => c4.abort(), 1000);';
        return [c1.signal, c2.signal, raw];
      }
    `;
    assert.equal(
      matchJsRule(abortSignalTimeoutMatcher, 'misc-negatives.js', controllerGuardAndShadowed).length,
      0,
    );
  });

  await t.test('recognizes parenthesized/type-asserted AbortController member accesses', () => {
    const code = `
      function typedControllerTimeout(url: string, ms: number) {
        const ctrl = new AbortController();
        setTimeout(() => (ctrl as AbortController).abort(), ms);
        return fetch(url, { signal: (ctrl as AbortController).signal });
      }
    `;
    const matches = matchJsRule(abortSignalTimeoutMatcher, 'typed-abort.ts', code);
    assert.deepEqual(
      matches.map((m) => m.line),
      [3],
    );
  });
});
