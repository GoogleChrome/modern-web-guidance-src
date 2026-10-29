import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { withVirtualSourceFile } from '../scanners/js-scanner.ts';
import {
  optimizeImagePriorityMatcher
} from './optimize-image-priority.ts';
void test('optimize-image-priority DOM matcher', async (t) => {
  await t.test('flags <link rel="preload" as="image"> without fetchpriority or imagesrcset when matching <img src> is present, plus <img> with deprecated importance, loading="auto", or conflicting fetchpriority="high" + loading="lazy"', () => {
    const html = `
      <head>
        <link rel="preload" as="image" href="/hero.jpg">
      </head>
      <body>
        <img src="/hero.jpg" alt="Hero">
        <img src="/sub.jpg" importance="high" alt="Sub">
        <img src="/card.jpg" loading="auto" alt="Card">
        <img src="/banner.jpg" fetchpriority="high" loading="lazy" alt="Banner">
      </body>
    `;
    const matches = scanHtml('index.html', html, [optimizeImagePriorityMatcher]);
    assert.equal(matches.length, 4);
    assert.equal(matches[0]?.line, 3);
  });

  await t.test('exempts <link rel="preload" as="image"> when href does not match an <img src> in the document', () => {
    const preloadHtml = `
      <head>
        <link rel="preload" as="image" href="/icons/zoom-in.svg">
        <link rel="preload" as="image" href="/bg-hero.jpg">
      </head>
      <body>
        <img src="/logo.png" alt="Logo">
      </body>
    `;
    assert.equal(
      scanHtml('preload.html', preloadHtml, [optimizeImagePriorityMatcher]).length,
      0,
    );
  });

  await t.test('flags hero/LCP <img loading="eager"> without fetchpriority="high"', () => {
    const html = `
      <main>
        <img src="/banner.webp" class="hero-image" loading="eager" alt="Hero">
        <img src="/lcp.webp" id="lcp-banner" loading="eager" alt="LCP">
      </main>
    `;
    const matches = scanHtml('hero.html', html, [optimizeImagePriorityMatcher]);
    assert.equal(matches.length, 2);
  });

  await t.test('flags JSX hero <img loading="eager"> lacking fetchpriority', () => {
    const code = `
      export function HeroSection() {
        return <img src="/hero.jpg" id="hero-img" loading="eager" alt="Hero" />;
      }
    `;
    const matches = withVirtualSourceFile('HeroSection.tsx', code, (sourceFile) =>
            scanJsx('HeroSection.tsx', sourceFile, [
            optimizeImagePriorityMatcher,
          ]),
          );
    assert.equal(matches.length, 1);
  });

  await t.test('exempts <link rel="preload" as="image"> with fetchpriority or imagesrcset and <img fetchpriority="high">', () => {
    const html = `
      <head>
        <link rel="preload" as="image" href="/hero.jpg" fetchpriority="high">
        <link rel="preload" as="image" imagesrcset="/hero-400.jpg 400w, /hero-800.jpg 800w">
      </head>
      <body>
        <img src="/hero.jpg" class="hero-image" loading="eager" fetchpriority="high" alt="Hero">
        <img src="/thumb.jpg" loading="lazy" alt="Thumb">
        <img src="/avatar.jpg" loading="eager" class="user-avatar" alt="Avatar">
      </body>
    `;
    const matches = scanHtml('modern.html', html, [optimizeImagePriorityMatcher]);
    assert.equal(matches.length, 0);
  });
});
