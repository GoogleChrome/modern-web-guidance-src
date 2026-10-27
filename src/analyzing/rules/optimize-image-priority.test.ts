import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { withVirtualSourceFile } from '../scanners/js-scanner.ts';
import {
  optimizeImagePriorityMatcher
} from './optimize-image-priority.ts';
void test('optimize-image-priority DOM matcher', async (t) => {
  await t.test('flags <link rel="preload" as="image"> without fetchpriority or imagesrcset when <img> is present', () => {
    const html = `
      <head>
        <link rel="preload" as="image" href="/hero.jpg">
      </head>
      <body>
        <img src="/hero.jpg" alt="Hero">
      </body>
    `;
    const matches = scanHtml('index.html', html, [optimizeImagePriorityMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
  });

  await t.test('exempts <link rel="preload" as="image"> for CSS background-image or when no <img> exists in document', () => {
    const bgHtml = `
      <head>
        <link rel="preload" as="image" href="/bg-hero.jpg">
        <style>
          .hero { background-image: url('/bg-hero.jpg'); }
        </style>
      </head>
      <body>
        <div class="hero"></div>
        <img src="/logo.png" alt="Logo">
      </body>
    `;
    assert.equal(
      scanHtml('bg.html', bgHtml, [optimizeImagePriorityMatcher]).length,
      0,
    );

    const noImgHtml = `
      <head>
        <link rel="preload" as="image" href="/hero.jpg">
      </head>
      <body>
        <div class="hero-banner"></div>
      </body>
    `;
    assert.equal(
      scanHtml('no-img.html', noImgHtml, [optimizeImagePriorityMatcher]).length,
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
