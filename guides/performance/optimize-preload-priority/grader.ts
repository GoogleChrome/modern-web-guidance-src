import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { parseHTML } from 'linkedom';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const demoName = path.basename(filePath);
const htmlStr = fs.readFileSync(filePath, 'utf-8');

// Initialize a static parser
const { document } = parseHTML(htmlStr);

// Tests
test.describe(`optimize-preload-priority Expectations: ${demoName}`, () => {
  // --- STATIC ASSERTIONS ---
  test('The <link rel="preload" as="image"> for poster.jpg has the fetchpriority="high" attribute', () => {
    const link = document.querySelector('link[rel="preload"][as="image"][href*="poster.jpg"]');
    expect(link?.getAttribute('fetchpriority')).toBe('high');
  });

  test('The <link rel="preload" as="font"> for brand-font.woff2 does not have the fetchpriority="high" attribute', () => {
    const link = document.querySelector('link[rel="preload"][as="font"][href*="brand-font.woff2"]');
    expect(link?.getAttribute('fetchpriority')).not.toBe('high');
  });

  test('The <link rel="preload" as="font"> includes the crossorigin attribute', () => {
    const link = document.querySelector('link[rel="preload"][as="font"][href*="brand-font.woff2"]');
    expect(link?.hasAttribute('crossorigin')).toBe(true);
  });

  test('The <link rel="preload" as="font"> for secondary-font.woff2 has the fetchpriority="low" attribute', () => {
    const link = document.querySelector('link[rel="preload"][as="font"][href*="secondary-font.woff2"]');
    expect(link?.getAttribute('fetchpriority')).toBe('low');
  });

  test('No more than two <link rel="preload" as="image"> elements on the entire page have the fetchpriority="high" attribute', () => {
    const links = document.querySelectorAll('link[rel="preload"][as="image"][fetchpriority="high"]');
    expect(links.length).toBeLessThanOrEqual(2);
  });

  test('No <link> elements have the deprecated importance attribute', () => {
    const links = document.querySelectorAll('link[importance]');
    expect(links.length).toBe(0);
  });
});
