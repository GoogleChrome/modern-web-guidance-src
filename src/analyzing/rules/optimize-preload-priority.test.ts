import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { withVirtualSourceFile } from '../scanners/js-scanner.ts';
import { optimizeImagePriorityMatcher } from './optimize-image-priority.ts';
import { optimizePreloadPriorityMatcher } from './optimize-preload-priority.ts';

void test('optimize-preload-priority DOM matcher', async (t) => {
  await t.test('flags <link rel="preload" importance="high|low"> without fetchpriority', () => {
    const html = `
      <head>
        <link rel="preload" href="/fonts/brand.woff2" as="font" type="font/woff2" importance="high" crossorigin>
        <link rel="preload" href="/video/poster.jpg" as="image" importance="high">
      </head>
      <body>
        <video poster="/video/poster.jpg"></video>
      </body>
    `;
    const matches = scanHtml('index.html', html, [optimizePreloadPriorityMatcher]);
    assert.equal(matches.length, 2);
    assert.equal(matches[0]?.line, 3);
    assert.equal(matches[1]?.line, 4);
  });

  await t.test('flags <link rel="preload"> when importance conflicts with fetchpriority', () => {
    const html = `
      <head>
        <link rel="preload" href="/poster.jpg" as="image" importance="high" fetchpriority="low">
      </head>
    `;
    const matches = scanHtml('conflict.html', html, [optimizePreloadPriorityMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
  });

  await t.test('flags JSX <link rel="preload" importance="low" />', () => {
    const code = `
      export function HeadLinks() {
        return <link rel="preload" href="/secondary.woff2" as="font" importance="low" crossOrigin="anonymous" />;
      }
    `;
    const matches = withVirtualSourceFile('HeadLinks.tsx', code, (sourceFile) =>
      scanJsx('HeadLinks.tsx', sourceFile, [optimizePreloadPriorityMatcher]),
    );
    assert.equal(matches.length, 1);
  });

  await t.test('exempts <link rel="preload"> with matching fetchpriority or non-preload rel', () => {
    const html = `
      <head>
        <link rel="preload" href="/hero.jpg" as="image" fetchpriority="high">
        <link rel="preload" href="/font.woff2" as="font" importance="low" fetchpriority="low" crossorigin>
        <link rel="prefetch" href="/next.js" importance="low">
        <link rel="stylesheet" href="/app.css" importance="low">
      </head>
    `;
    const matches = scanHtml('modern.html', html, [optimizePreloadPriorityMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('carves out <link rel="preload" as="image"> owned by optimize-image-priority', () => {
    const html = `
      <head>
        <link rel="preload" as="image" href="/hero.jpg" importance="high">
      </head>
      <body>
        <img src="/hero.jpg" alt="Hero">
      </body>
    `;
    const preloadMatches = scanHtml('overlap.html', html, [optimizePreloadPriorityMatcher]);
    const imageMatches = scanHtml('overlap.html', html, [optimizeImagePriorityMatcher]);
    assert.equal(preloadMatches.length, 0);
    assert.equal(imageMatches.length, 1);
  });
});
