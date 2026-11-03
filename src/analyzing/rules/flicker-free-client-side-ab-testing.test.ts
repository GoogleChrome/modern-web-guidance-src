import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { scanFiles } from '../scanners/index.ts';
import {
  flickerFreeClientSideAbTestingMatcher,
  flickerFreeClientSideAbTestingRule,
} from './flicker-free-client-side-ab-testing.ts';

void test('flicker-free-client-side-ab-testing CSS matcher', async (t) => {
  await t.test('flags .async-hide { opacity: 0 !important } anti-flicker rule', () => {
    const css = `
      .async-hide { opacity: 0 !important; }
    `;
    const matches = scanCss('index.html', css, [flickerFreeClientSideAbTestingMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags html.async-hide and .ab-loading anti-flicker rules', () => {
    const css = `
      html.async-hide {
        opacity: 0 !important;
      }
      html.ab-loading {
        opacity: 0;
      }
    `;
    const matches = scanCss('ab.css', css, [flickerFreeClientSideAbTestingMatcher]);
    assert.equal(matches.length, 2);
    assert.equal(matches[0]?.line, 2);
    assert.equal(matches[1]?.line, 5);
  });

  await t.test('exempts unrelated opacity: 0 rules and tab-loading classes', () => {
    const css = `
      .fade-enter { opacity: 0; }
      .tab-loading { opacity: 0; }
      .async-hide { opacity: 1; }
    `;
    const matches = scanCss('styles.css', css, [flickerFreeClientSideAbTestingMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts HTML file when script already uses blocking="render"', () => {
    const htmlWithBlocking = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>.async-hide { opacity: 0 !important; }</style>
          <script async blocking="render" src="https://example.com/ab.js"></script>
        </head>
      </html>
    `;
    const findingsWithBlocking = scanFiles(
      new Map([['index.html', htmlWithBlocking]]),
      [flickerFreeClientSideAbTestingRule],
    );
    assert.equal(findingsWithBlocking.length, 0);

    const htmlWithoutBlocking = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>.async-hide { opacity: 0 !important; }</style>
          <script async src="https://example.com/ab.js"></script>
        </head>
      </html>
    `;
    const findingsWithoutBlocking = scanFiles(
      new Map([['index.html', htmlWithoutBlocking]]),
      [flickerFreeClientSideAbTestingRule],
    );
    assert.equal(findingsWithoutBlocking.length, 1);
  });
});
