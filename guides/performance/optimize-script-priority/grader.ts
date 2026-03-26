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
test.describe(`optimize-script-priority Expectations: ${demoName}`, () => {
  // --- STATIC ASSERTIONS ---
  test(`The script at /js/app.js has both the async and fetchpriority="high" attributes`, () => {
    const scripts = document.querySelectorAll('script[src="/js/app.js"][async][fetchpriority="high"]');
    expect(scripts.length).toBe(1);
  });

  test(`The script at /js/legacy-widgets.js has the fetchpriority="low" attribute`, () => {
    const script = document.querySelector('script[src="/js/legacy-widgets.js"]');
    expect(script?.getAttribute('fetchpriority')).toBe('low');
  });

  test(`The script at /js/tracker.js does NOT have the fetchpriority="high" attribute`, () => {
    const script = document.querySelector('script[src="/js/tracker.js"]');
    expect(script?.getAttribute('fetchpriority')).not.toBe('high');
  });

  test(`No more than two <script> elements total on the page have the fetchpriority="high" attribute`, () => {
    const scripts = document.querySelectorAll('script[fetchpriority="high"]');
    expect(scripts.length).toBeLessThanOrEqual(2);
  });

  test(`No <script> elements have the deprecated importance attribute`, () => {
    const scripts = document.querySelectorAll('script[importance]');
    expect(scripts.length).toBe(0);
  });
});
