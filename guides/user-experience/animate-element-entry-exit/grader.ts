import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`animate-element-entry-exit Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath.substring(1));

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
    // Give time for initial layout and potential initial transitions to settle
    await page.waitForTimeout(500);
  });

  test(`uses @starting-style to define starting property values for entry animation`, async ({ page }) => {
    const hasStartingStyle = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule.constructor.name === 'CSSStartingStyleRule') return true;
            if (rule.cssText && rule.cssText.includes('@starting-style')) return true;
          }
        } catch(e) {
          if (e instanceof DOMException && e.name === 'SecurityError') {
             // Ignore cross-origin stylesheet errors
          } else {
             throw e;
          }
        }
      }
      return false;
    });
    expect(hasStartingStyle).toBe(true);
  });

  test(`includes transition-behavior: allow-discrete or allow-discrete keyword for display`, async ({ page }) => {
    const el = page.locator('.card').first();
    const transitionBehavior = await el.evaluate(e => window.getComputedStyle(e).transitionBehavior);
    expect(transitionBehavior).toMatch(/allow-discrete/);
  });

  test(`includes display property in transition list`, async ({ page }) => {
    const el = page.locator('.card').first();
    const transitionProperty = await el.evaluate(e => window.getComputedStyle(e).transitionProperty);
    expect(transitionProperty).toContain('display');
  });

  test(`smoothly transitions properties when added to DOM`, async ({ page }) => {
    await page.click('#addBtn');
    const newCard = page.locator('#domContainer .card').last();
    const animations = await newCard.evaluate(el => el.getAnimations().length);
    expect(animations).toBeGreaterThan(0);
  });

  test(`smoothly transitions to hidden values before being hidden from layout`, async ({ page }) => {
    const toggleCard = page.locator('#toggleCard');
    
    // Ensure the card is visible initially
    const displayInitial = await toggleCard.evaluate(el => window.getComputedStyle(el).display);
    expect(displayInitial).not.toBe('none');

    // Click to hide
    await page.click('#toggleBtn');
    
    // Immediately after click, the display should NOT be none (because transition is active)
    const displayImmediatelyAfterClick = await toggleCard.evaluate(el => window.getComputedStyle(el).display);
    expect(displayImmediatelyAfterClick).not.toBe('none');

    // Also check if animations are running
    const animations = await toggleCard.evaluate(el => el.getAnimations().length);
    expect(animations).toBeGreaterThan(0);
  });

  test(`smoothly transitions properties from @starting-style values when display changes from none to visible`, async ({ page }) => {
    const toggleCard = page.locator('#toggleCard');
    
    // Hide it first
    await page.click('#toggleBtn');
    await toggleCard.evaluate(async (el) => {
      const animations = el.getAnimations();
      await Promise.allSettled(animations.map(a => a.finished));
    });
    
    const displayHidden = await toggleCard.evaluate(el => window.getComputedStyle(el).display);
    expect(displayHidden).toBe('none');

    // Show it
    await page.click('#toggleBtn');
    
    // It should have entry animations active immediately
    const animations = await toggleCard.evaluate(el => el.getAnimations().length);
    expect(animations).toBeGreaterThan(0);
  });

  test(`waits for exit transition to complete before removing element from DOM`, async ({ page }) => {
    const container = page.locator('#domContainer');
    const cardsBefore = await container.locator('.card').count();
    
    await page.click('#removeBtn');
    
    // Immediately after click, it should still be in the DOM
    const cardsImmediatelyAfterClick = await container.locator('.card').count();
    expect(cardsImmediatelyAfterClick).toBe(cardsBefore);
    
    const lastCard = container.locator('.card').last();
    const animations = await lastCard.evaluate(el => el.getAnimations().length);
    expect(animations).toBeGreaterThan(0);
    
    // Eventually it gets removed
    await expect(container.locator('.card')).toHaveCount(cardsBefore - 1, { timeout: 2000 });
  });

  test(`transition durations for entry and exit are reasonable (0.3s to 1s)`, async ({ page }) => {
    const el = page.locator('.card').first();
    const transitionDuration = await el.evaluate(e => window.getComputedStyle(e).transitionDuration);
    const durations = transitionDuration.split(',').map(s => parseFloat(s));
    
    const hasReasonableDuration = durations.some(d => d >= 0.3 && d <= 1.0);
    expect(hasReasonableDuration).toBe(true);
  });

});
