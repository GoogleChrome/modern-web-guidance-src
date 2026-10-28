import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { scanHtml } from '../scanners/dom-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  crossDocumentTransitionsDomMatcher,
  crossDocumentTransitionsJsMatcher,
  crossDocumentTransitionsPackageMatcher,
} from './cross-document-transitions.ts';

void test('cross-document-transitions: positive brownfield matches', async (t) => {
  await t.test('flags barba.js and swup in package.json', () => {
    const pkgJson = JSON.stringify({
      dependencies: {
        'barba.js': '^1.0.0',
        swup: '^4.0.0',
      },
    });
    const matches = scanPackageJson('package.json', pkgJson, [
      crossDocumentTransitionsPackageMatcher,
    ]);
    assert.equal(matches.length, 2);
  });

  await t.test('flags barba.init() and new Swup()', () => {
    const code = `
      import barba from '@barba/core';
      import Swup from 'swup';
      barba.init({ transitions: [] });
      const swup = new Swup();
    `;
    const matches = matchJsRule(crossDocumentTransitionsJsMatcher, 'transitions.ts', code);
    assert.equal(matches.length, 2);
  });

  await t.test('flags legacy <meta name="view-transition" content="same-origin"> tag', () => {
    const html = `
      <html>
        <head>
          <meta name="view-transition" content="same-origin">
        </head>
      </html>
    `;
    const matches = scanHtml('index.html', html, [crossDocumentTransitionsDomMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /@view-transition/);
  });
});

void test('cross-document-transitions: negative / exempt cases', async (t) => {
  await t.test('exempts files already using @view-transition or pagereveal', () => {
    const code = `
      import barba from '@barba/core';
      window.addEventListener('pagereveal', () => {});
      barba.init();
    `;
    const matches = matchJsRule(crossDocumentTransitionsJsMatcher, 'modern.ts', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts standard meta tags', () => {
    const html = `<meta name="viewport" content="width=device-width, initial-scale=1">`;
    const matches = scanHtml('index.html', html, [crossDocumentTransitionsDomMatcher]);
    assert.equal(matches.length, 0);
  });
});
