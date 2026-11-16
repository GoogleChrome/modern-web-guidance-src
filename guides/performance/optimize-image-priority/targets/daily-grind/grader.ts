import {
  test,
  expect,
  getTargetFiles,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';

import type { Document } from 'linkedom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getMainDocument(): Document {
  const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
  const indexDoc = docs.find((d) => /(?:^|[\\/])index\.html$/i.test(d.file) && !/[\\/]dist[\\/]/i.test(d.file));
  return (indexDoc || docs[0])?.document;
}

test.describe('optimize-image-priority Target Grader', () => {
  test('The primary Largest Contentful Paint (LCP) hero <img> element has the fetchpriority="high" attribute', () => {
    const doc = getMainDocument();
    expect(doc).toBeDefined();
    const heroImgs = Array.from<any>(doc.querySelectorAll('.hero img, header.hero img, header img'));
    expect(heroImgs.length).toBeGreaterThan(0);
    const hasHighPriority = heroImgs.some(
      (img) => img.getAttribute('fetchpriority')?.trim().toLowerCase() === 'high'
    );
    expect(hasHighPriority).toBe(true);
  });

  test('The primary Largest Contentful Paint (LCP) hero <img> element does NOT have the loading="lazy" attribute', () => {
    const doc = getMainDocument();
    expect(doc).toBeDefined();
    const heroImgs = Array.from<any>(doc.querySelectorAll('.hero img, header.hero img, header img'));
    expect(heroImgs.length).toBeGreaterThan(0);
    for (const img of heroImgs) {
      expect(img.getAttribute('loading')?.trim().toLowerCase()).not.toBe('lazy');
    }
  });

  test('No more than two <img> elements on the page have the fetchpriority="high" attribute', () => {
    const doc = getMainDocument();
    expect(doc).toBeDefined();
    const allImgs = Array.from<any>(doc.querySelectorAll('img'));
    expect(allImgs.length).toBeGreaterThan(0);
    const highPriorityImgs = allImgs.filter(
      (img) => img.getAttribute('fetchpriority')?.trim().toLowerCase() === 'high'
    );
    expect(highPriorityImgs.length).toBeGreaterThan(0);
    expect(highPriorityImgs.length).toBeLessThanOrEqual(2);
  });

  test('Initially hidden or off-screen above-the-fold <img> elements have the fetchpriority="low" attribute', () => {
    const doc = getMainDocument();
    expect(doc).toBeDefined();
    const navImgs = Array.from<any>(doc.querySelectorAll('nav img, details img'));
    expect(navImgs.length).toBeGreaterThan(0);
    for (const img of navImgs) {
      expect(img.getAttribute('fetchpriority')?.trim().toLowerCase()).toBe('low');
    }
  });

  test('Standard below-the-fold <img> elements use the loading="lazy" attribute', () => {
    const doc = getMainDocument();
    expect(doc).toBeDefined();
    const belowFoldImgs = Array.from<any>(doc.querySelectorAll('.card img, .grid img, main img, footer img'));
    expect(belowFoldImgs.length).toBeGreaterThanOrEqual(3);
    for (const img of belowFoldImgs) {
      expect(img.getAttribute('loading')?.trim().toLowerCase()).toBe('lazy');
    }
  });

  test('Standard below-the-fold <img> elements do NOT have the fetchpriority attribute', () => {
    const doc = getMainDocument();
    expect(doc).toBeDefined();
    const belowFoldImgs = Array.from<any>(doc.querySelectorAll('.card img, .grid img, main img, footer img'));
    expect(belowFoldImgs.length).toBeGreaterThanOrEqual(3);
    for (const img of belowFoldImgs) {
      expect(img.hasAttribute('fetchpriority')).toBe(false);
    }
  });

  test('No <img> elements have the deprecated importance attribute or invalid loading="auto" attribute', () => {
    const doc = getMainDocument();
    expect(doc).toBeDefined();
    const allImgs = Array.from<any>(doc.querySelectorAll('img'));
    expect(allImgs.length).toBeGreaterThan(0);
    for (const img of allImgs) {
      expect(img.hasAttribute('importance')).toBe(false);
      expect(img.getAttribute('loading')?.trim().toLowerCase()).not.toBe('auto');
    }
  });
});
