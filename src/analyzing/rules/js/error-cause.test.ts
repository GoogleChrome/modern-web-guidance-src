import assert from 'node:assert/strict';
import test from 'node:test';
import { scanFiles } from '../../scanners/index.ts';
import { matchJsRuleWithFastTokens as matchJsRule } from '../../scanners/js-scanner.ts';
import jsDefaultRules, { jsErrorCauseRule as exportedJsRule } from '../js.ts';
import { JS_GUIDE_HASH, jsErrorCauseMatcher, jsErrorCauseRule } from './error-cause.ts';

void test('js/error-cause matcher', async (t) => {
  await t.test('wires js/error-cause in src/rules/js.ts with the locked guideHash', () => {
    assert.strictEqual(JS_GUIDE_HASH, '78d968c460dd');
    const matchingRules = jsDefaultRules.filter((rule) => rule.id === 'js/error-cause');
    assert.strictEqual(matchingRules.length, 1);
    const [rule] = matchingRules;
    assert.strictEqual(rule?.guideId, 'js');
    assert.strictEqual(rule?.guideHash, '78d968c460dd');
    assert.strictEqual(rule, exportedJsRule);
  });

  await t.test('flags Shape A manual .cause assignments and Object.assign patterns', () => {
    const code = `
      function shapeAVariants(raw, cause) {
        try {
          return JSON.parse(raw);
        } catch (err) {
          const e1 = new Error('Failed to parse JSON');
          e1.cause = err;
          throw e1;
        }
      }

      function reassignAndObjectAssign( cause ) {
        let e2;
        try {
          riskyOp();
        } catch (err) {
          if (mode === 1) {
            e2 = new TypeError('Invalid input');
            e2.cause = err;
            throw e2;
          }
          if (mode === 1.5) {
            e2 = new SyntaxError('Conditional outer mutation');
          }
          if (mode === 2) {
            throw Object.assign(new Error('Wrapped failure'), { cause: err });
          }
          throw Object.assign(new RangeError('Out of bounds'), { cause });
        }
      }
    `;
    const matches = matchJsRule(jsErrorCauseMatcher, 'shape-a.js', code);
    assert.deepEqual(
      matches.map((m) => m.line),
      [6, 18, 23, 26, 28],
    );
    for (const m of matches) {
      assert.match(m.message, /\{ cause: err \}/);
    }
  });

  await t.test('flags Shape B across all 7 built-in Error constructors and outer message guidance', () => {
    const code = `
      function allBuiltins(err) {
        try {
          run();
        } catch (e) {
          if (k === 1) throw new Error('Failed: ' + e.message);
          if (k === 2) throw new TypeError(\`Type mismatch: \${e.message}\`);
          if (k === 3) throw new RangeError(\`Out of range: \${e}\`);
          if (k === 4) throw new SyntaxError('Bad syntax: ' + e);
          if (k === 5) throw new URIError(\`Bad URI: \${e.message}\`);
          if (k === 6) throw new ReferenceError('Missing ref: ' + e.message);
          if (k === 7) throw new EvalError(\`Eval failed: \${e}\`);
          throw new globalThis.Error('Global error: ' + e.message);
        }
      }
    `;
    const matches = matchJsRule(jsErrorCauseMatcher, 'builtins.js', code);
    assert.deepEqual(
      matches.map((m) => m.line),
      [6, 7, 8, 9, 10, 11, 12, 13],
    );
    assert.match(matches[0]!.message, /keep the outer \.message intact/i);
  });

  await t.test('flags TypeScript casts, local message vars, Promise .catch, callbacks, and HTML script blocks', () => {
    const tsCode = `
      async function fetchWithContext(url: string, callback: (err: Error) => void) {
        try {
          await fetch(url);
        } catch (err) {
          throw new Error(\`Request to \${url} failed: \${(err as Error).message}\`);
        }

        try {
          decodeImage();
        } catch (reason) {
          const detail = reason instanceof Error ? reason.message : String(reason);
          const msg = \`Unable to decode image: "\${detail}".\`;
          throw new Error(msg);
        }

        try {
          readSocket();
        } catch (err) {
          return callback(new Error("Unable to write to unix socket: " + (err as { code?: string }).code));
        }

        return fetch(url).catch((err) => {
          throw new Error(\`Failed to read \${url}: \${err}\`);
        });
      }
    `;
    const tsMatches = matchJsRule(jsErrorCauseMatcher, 'client.ts', tsCode);
    assert.deepEqual(
      tsMatches.map((m) => m.line),
      [6, 14, 20, 24],
    );

    const htmlCode = `
      <!doctype html>
      <html>
        <head><title>App</title></head>
        <body>
          <script type="module">
            try {
              initWidget();
            } catch (err) {
              throw new Error(\`Widget initialization failed: \${err.message}\`);
            }
          </script>
        </body>
      </html>
    `;
    const htmlFindings = scanFiles(
      new Map([['index.html', htmlCode]]),
      [jsErrorCauseRule],
    );
    assert.deepEqual(
      htmlFindings.map((f) => f.line),
      [10],
    );
  });

  await t.test('allows custom properties ONLY when e.cause is also explicitly set', () => {
    const code = `
      function customProps(err) {
        try {
          op1();
        } catch (e) {
          const withBoth = new Error(\`Op1 failed: \${e.message}\`);
          withBoth.code = 'E_OP1';
          withBoth.cause = e;
          throw withBoth;
        }

        try {
          op2();
        } catch (e) {
          const onlyCode = new Error(\`Op2 failed: \${e.message}\`);
          onlyCode.code = 'E_OP2';
          onlyCode.originalError = e;
          throw onlyCode;
        }

        try {
          op3();
        } catch (validationError) {
          const httpErr = new Error(\`"fields" is not valid: \${validationError.message}\`);
          if (validationError.status) {
            httpErr.status = 400;
          }
          return next(httpErr);
        }
      }
    `;
    const matches = matchJsRule(jsErrorCauseMatcher, 'custom-props.js', code);
    assert.deepEqual(
      matches.map((m) => m.line),
      [6],
    );
  });

  await t.test('excludes custom Error subclasses, shadowed Error, and calls already passing 2nd argument', () => {
    const code = `
      import { Error as ShadowedError } from './errors';
      class HttpError extends Error {
        constructor(status, message) {
          super(message);
          this.status = status;
        }
      }
      class AppError extends Error {}

      function exclusions(err) {
        try {
          work();
        } catch (e) {
          if (a === 1) throw new HttpError(502, \`Upstream failed: \${e.message}\`);
          if (a === 2) throw new AppError('Failed: ' + e.message);
          if (a === 3) throw new CustomError(\`Custom failed: \${e.message}\`);
          if (a === 4) throw new AggregateError([e], \`Batch failed: \${e.message}\`);
          if (a === 5) throw new ShadowedError(\`Shadowed: \${e.message}\`);
          if (a === 6) throw new Error(\`Already caused: \${e.message}\`, { cause: e });
          if (a === 7) throw new Error('Already caused short', { cause: e });
          throw new Error(\`Extra options: \${e.message}\`, existingOptions);
        }
      }

      {
        const Error = class LocalError {};
        try {
          work();
        } catch (e) {
          throw new Error('Local shadowed: ' + e.message);
        }
      }
    `;
    const matches = matchJsRule(jsErrorCauseMatcher, 'subclasses.ts', code);
    assert.deepEqual(matches, []);
  });

  await t.test('excludes unknown coercion ternaries, bare clones, stack embedding, logging, and unrelated errors', () => {
    const code = `
      function falsePositiveTraps(err) {
        try {
          step1();
        } catch (e) {
          if (t === 1) throw e instanceof Error ? e : new Error(String(e));
          if (t === 2) throw e instanceof Error ? e : new Error(JSON.stringify(e));
          if (t === 3) throw typeof e === 'string' ? new Error(e) : e;
          if (t === 4) throw e || new Error(String(e));
          if (t === 4.1) throw e ?? new Error(\`Fallback: \${e}\`);
          if (t === 4.2) throw e || new Error('Fallback: ' + e.message);
          if (t === 4.3) throw new Error(e instanceof Error ? e.message : 'Unknown error');
          if (t === 4.4) throw new Error(e?.message || 'Unknown error');
          if (t === 4.5) throw new Error(e?.message ?? 'Unknown error');
          if (t === 5) throw new Error(e);
          if (t === 6) throw new Error(e.message);
          if (t === 7) throw new Error((e.message + '').replace(': /foo/', ''));
          if (t === 8) throw new Error(\`Render failed:\n\${e.stack}\`);
          if (t === 9) throw new Error(e.stack);
          function innerHelper() {
            return new Error('Inner helper: ' + e.message);
          }
          console.error(new Error(\`Logged failure: \${e.message}\`));
          this.logger.warn(new Error('Warn failure: ' + e.message));
          ctx.log.info(new Error('Info failure: ' + e.message));
          throw new Error('AUTH_REQUIRED');
        }

        try {
          step2();
        } catch {
          throw new Error('Parameterless catch');
        }

        return promise
          .catch((e) => (e instanceof Error ? e : new Error(String(e))))
          .catch((e) => e ?? new Error(\`Promise fallback: \${e}\`));
      }
    `;
    const matches = matchJsRule(jsErrorCauseMatcher, 'traps.js', code);
    assert.deepEqual(matches, []);
  });

  await t.test('recognizes bracket mutations and non-object-literal Object.assign sources', () => {
    const code = `
      function bracketAndAssignSources(extraMeta) {
        try {
          step1();
        } catch (e) {
          const withBracketCause = new Error('Step 1 failed');
          withBracketCause['cause'] = e;
          throw withBracketCause;
        }

        try {
          step2();
        } catch (e) {
          const withBracketCode = new Error(\`Step 2 failed: \${e.message}\`);
          withBracketCode['code'] = 'E_STEP2';
          throw withBracketCode;
        }

        try {
          step3();
        } catch (e) {
          throw Object.assign(new Error(\`Step 3 failed: \${e.message}\`), extraMeta);
        }

        try {
          step4();
        } catch (e) {
          throw Object.assign(new Error('Step 4 failed'), extraMeta, { cause: e });
        }
      }
    `;
    const matches = matchJsRule(jsErrorCauseMatcher, 'brackets-and-assign.js', code);
    assert.deepEqual(
      matches.map((m) => m.line),
      [6, 28],
    );
    for (const m of matches) {
      assert.match(m.message, /\{ cause: err \}/);
    }
  });

  await t.test('matches fastTokens on standalone bracket cause assignment without catch keyword', () => {
    const code = `
      function wrapCause(msg, cause) {
        const err = new Error(msg);
        err['cause'] = cause;
        return err;
      }
    `;
    const matches = matchJsRule(jsErrorCauseMatcher, 'bracket-cause-no-catch.js', code);
    assert.deepEqual(matches.map((m) => m.line), [3]);
  });
});
