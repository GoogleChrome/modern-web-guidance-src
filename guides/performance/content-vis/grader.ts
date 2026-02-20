import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

function runTests(filePath: string, isNegative: boolean = false) {
  const demoUrl = `file://${filePath}`;
  const demoName = path.basename(filePath);

  test.describe(`Content Visibility Expectations: ${demoName}`, () => {

    // 1. Static Analysis
    test('Static: Source code contains content-visibility: auto', async () => {
      const html = fs.readFileSync(filePath, 'utf-8');
      expect(html).toContain('content-visibility: auto');
    });

    test.beforeEach(async ({ page }) => {
      await page.goto(demoUrl);
      // Wait for content to stabilize
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
    });

    // 2. Browser Assertions
    test('Browser: Elements with content-visibility: auto must have contain-intrinsic-size', async ({ page }) => {
      const violations = await page.evaluate(() => {
        const results: { tag: string; class: string; cis: string }[] = [];
        const elements = document.querySelectorAll('*');
        for (const el of elements) {
          const style = window.getComputedStyle(el);
          if (style.contentVisibility === 'auto') {
            const cis = style.containIntrinsicSize;
            // 'none' is the default. If it is none, 0px, or empty, it's a violation.
            // also 'auto none' (default in some browsers for cv:auto) implies 0px placeholder.
            if (!cis || cis === 'none' || cis === '0px' || cis === 'auto none') {
              results.push({ tag: el.tagName.toLowerCase(), class: el.className, cis });
            }
          }
        }
        return results;
      });

      if (isNegative) {
        // Negative demo is expected to fail this (violations > 0)
        expect(violations.length).toBeGreaterThan(0);
      } else {
        expect(violations, 'Found elements with content-visibility: auto but missing valid contain-intrinsic-size').toEqual([]);
      }
    });

    test('Browser: contain-intrinsic-size should use the "auto" keyword', async ({ page }) => {
      const violations = await page.evaluate(() => {
        const results: { tag: string; class: string; cis: string }[] = [];
        const elements = document.querySelectorAll('*');
        for (const el of elements) {
          const style = window.getComputedStyle(el);
          if (style.contentVisibility === 'auto') {
            const cis = style.containIntrinsicSize;
            // Best practice: "auto <length>"
            // If it exists but doesn't contain 'auto', it's a violation of best practice
            if (cis && cis !== 'none' && !cis.includes('auto')) {
              results.push({ tag: el.tagName.toLowerCase(), class: el.className, cis });
            }
          }
        }
        return results;
      });

      if (isNegative) {
        // This test might pass for negative demo if it has NO cis (cis='none').
        // That is acceptable as the previous test catches the missing cis.
      } else {
        expect(violations, 'contain-intrinsic-size should include "auto" keyword (e.g. "auto 500px")').toEqual([]);
      }
    });

    test('Browser: Strategic Application - Should not target leaf nodes/granular elements', async ({ page }) => {
      const leafCount = await page.evaluate(() => {
        let count = 0;
        const elements = document.querySelectorAll('*');
        for (const el of elements) {
          if (window.getComputedStyle(el).contentVisibility === 'auto') {
            // Check if it's a leaf node (no element children)
            if (el.children.length === 0) {
              count++;
            }
          }
        }
        return count;
      });

      if (isNegative) {
        // Negative demo applies to small leaf elements
        expect(leafCount).toBeGreaterThan(0);
      } else {
        expect(leafCount, 'content-visibility: auto should be applied to containers (DOM islands), not leaf nodes').toBe(0);
      }
    });

  });
}

const targetFile = process.env.TARGET_FILE;
if (targetFile) {
  runTests(path.resolve(targetFile));
} else {
  runTests(path.join(__dirname, 'demo.html'));
  runTests(path.join(__dirname, 'negative-demo.html'), true);
}
