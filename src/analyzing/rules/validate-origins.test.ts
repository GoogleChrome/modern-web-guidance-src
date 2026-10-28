import assert from 'node:assert/strict';
import test from 'node:test';
import { scanJsSource } from '../scanners/js-scanner.ts';
import type { JsRuleMatcher } from '../schema.ts';
import { validateOriginsRule } from './validate-origins.ts';

if (validateOriginsRule.matcher.kind !== 'js') {
  throw new Error('Expected JS matcher');
}
const jsMatcher: JsRuleMatcher = validateOriginsRule.matcher;

void test('validate-origins: positive matches', async (t) => {
  await t.test('flags event.origin.startsWith() in message listener', () => {
    const code = `
      window.addEventListener('message', (event) => {
        if (!event.origin.startsWith('https://app.example.com')) return;
        processCommand(event.data);
      });
    `;
    const { matches } = scanJsSource('postmessage-prefix.js', code, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
    assert.match(matches[0]?.message ?? '', /Origin\.from/);
  });

  await t.test('flags event.origin.match() and RegExp.test(event.origin)', () => {
    const code = `
      window.addEventListener('message', function(e) {
        if (e.origin.match(/example\\.com$/)) {
          handleMessage(e.data);
        }
        if (/^https:\\/\\/.*\\.example\\.com$/.test(e.origin)) {
          handleSubdomain(e.data);
        }
      });
    `;
    const { matches } = scanJsSource('postmessage-regex.js', code, [jsMatcher]);
    assert.equal(matches.length, 2);
    assert.equal(matches[0]?.line, 3);
    assert.equal(matches[1]?.line, 6);
  });

  await t.test('flags manual location.protocol + "//" + location.host concatenation against event.origin', () => {
    const code = `
      window.onmessage = (evt) => {
        if (evt.origin !== window.location.protocol + '//' + window.location.host) {
          return;
        }
        runAction(evt.data);
      };
    `;
    const { matches } = scanJsSource('onmessage-concat.js', code, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
  });
});

void test('validate-origins: negative / exempt cases', async (t) => {
  await t.test('exempts exact fixed string literal comparison event.origin === "https://app.example.com"', () => {
    const code = `
      window.addEventListener('message', (event) => {
        if (event.origin !== 'https://app.example.com') return;
        handleTrusted(event.data);
      });
    `;
    const { matches } = scanJsSource('exact-literal.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts array allowlist membership check allowedOrigins.includes(event.origin)', () => {
    const code = `
      const allowedOrigins = ['https://app.example.com', 'https://admin.example.com'];
      window.addEventListener('message', (e) => {
        if (!allowedOrigins.includes(e.origin)) return;
        handleAllowed(e.data);
      });
    `;
    const { matches } = scanJsSource('allowlist.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts code already using Origin.from() and isSameOrigin()', () => {
    const code = `
      const TRUSTED = Origin.from('https://app.example.com');
      window.addEventListener('message', (event) => {
        if (!Origin.from(event).isSameOrigin(TRUSTED)) return;
        handleTrusted(event.data);
      });
    `;
    const { matches } = scanJsSource('modern-origin.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });
});
