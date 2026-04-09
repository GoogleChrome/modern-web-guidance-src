/// <reference types="node" />
import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Animate to Intrinsic Sizes Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  test('interpolate-size: allow-keywords should be applied to :root or a parent', async ({ page }) => {
    const rootInterpolateSize = await page.evaluate(() => {
      const el = document.documentElement;
      return window.getComputedStyle(el).getPropertyValue('interpolate-size');
    });
    
    // Check root first
    if (rootInterpolateSize === 'allow-keywords') return;

    // Check if any parent of the transitioning element has it
    const parentInterpolateSize = await page.evaluate(() => {
      const content = document.querySelector('[class*="content"], [class*="inner"]');
      if (!content) return null;
      let current = content.parentElement;
      while (current) {
        if (window.getComputedStyle(current).getPropertyValue('interpolate-size') === 'allow-keywords') {
          return 'allow-keywords';
        }
        current = current.parentElement;
      }
      return null;
    });

    expect(rootInterpolateSize === 'allow-keywords' || parentInterpolateSize === 'allow-keywords').toBe(true);
  });

  test('The transitioning element should have a block-size/inline-size transition', async ({ page }) => {
    const transition = await page.evaluate(() => {
      const el = document.querySelector('[class*="content"], [class*="inner"], [class*="accordion"] div:not([class*="header"])');
      if (!el) return 'none';
      return window.getComputedStyle(el).getPropertyValue('transition-property');
    });
    // We want specifically logical block-size or inline-size, or physical height/width (still valid but we prefer logical in guide)
    const properties = transition.split(',').map(p => p.trim());
    const hasCorrectProperty = properties.some(p => p === 'block-size' || p === 'inline-size' || p === 'height' || p === 'width' || p === 'all');
    const hasIncorrectProperty = properties.some(p => p === 'max-block-size' || p === 'max-inline-size' || p === 'max-height' || p === 'max-width');
    
    expect(hasCorrectProperty).toBe(true);
    expect(hasIncorrectProperty).toBe(false);
  });

  test('The element should not use the max-size hack', async ({ page }) => {
    // Trigger the interaction to expand the element
    const button = page.locator('button, [role="button"], .accordion-header, label').first();
    await button.click();
    
    // Toggle the class if it's not already there (sometimes click is finicky in tests)
    await page.evaluate(() => {
      const accordion = document.querySelector('.accordion');
      if (accordion && !accordion.classList.contains('is-open')) {
        accordion.classList.add('is-open');
      }
    });

    // Wait for the transition to progress
    await page.waitForTimeout(200);

    const sizes = await page.evaluate(() => {
      const el = document.querySelector('[class*="content"]');
      if (!el) return { maxBlockSize: 'none', maxHeight: 'none' };
      const style = window.getComputedStyle(el);
      return {
        maxBlockSize: style.getPropertyValue('max-block-size'),
        maxHeight: style.getPropertyValue('max-height')
      };
    });
    
    // If either max-block-size or max-height is set to a large value, it's likely the hack
    const valBlock = parseInt(sizes.maxBlockSize);
    const valHeight = parseInt(sizes.maxHeight);
    const isMaxHack = (!isNaN(valBlock) && valBlock > 500) || (!isNaN(valHeight) && valHeight > 500);
    expect(isMaxHack).toBe(false);
  });

  test('Should use calc-size() for properties requiring calculations on intrinsic sizes', async ({ page }) => {
    // We check the badge element specifically for calc-size in the source if possible,
    // or at least verify it's used in the demo.
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toMatch(/(inline-size|width)\s*:\s*calc-size\(/);
  });

  test('The implementation should provide an interactive element with appropriate attributes', async ({ page }) => {
    const button = page.locator('button, [role="button"], label');
    await expect(button.first()).toBeVisible();
    
    // Check for some level of accessibility or semantic correctness that we might have in demo but not negative
    const hasAria = await button.first().evaluate(el => {
      return el.hasAttribute('aria-expanded') || el.tagName === 'BUTTON' || el.hasAttribute('onclick');
    });
    expect(hasAria).toBe(true);
  });

});
