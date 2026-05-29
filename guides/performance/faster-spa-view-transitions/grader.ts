import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Faster SPA View Transitions Grader', () => {
  test('inactive view elements must have content-visibility: hidden applied in computed styles', async ({ page }) => {
    const targetFile = process.env.TARGET_FILE || 'demo.html';
    await page.goto('file://' + path.resolve(targetFile));

    const allInactiveHidden = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('[data-target]'));
      const activeTarget = document.querySelector('[data-target].active')?.getAttribute('data-target');
      const inactiveIds = buttons
        .map(b => b.getAttribute('data-target'))
        .filter((id): id is string => !!id && id !== activeTarget);

      if (inactiveIds.length === 0) return false;

      return inactiveIds.every(id => {
        const el = document.getElementById(id);
        return el && window.getComputedStyle(el).contentVisibility === 'hidden';
      });
    });

    expect(allInactiveHidden).toBe(true);
  });

  test('the active view element must not have content-visibility: hidden applied', async ({ page }) => {
    const targetFile = process.env.TARGET_FILE || 'demo.html';
    await page.goto('file://' + path.resolve(targetFile));

    const activeNotHiddenAndFeatureExists = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('[data-target]'));
      const activeTarget = document.querySelector('[data-target].active')?.getAttribute('data-target');
      const inactiveIds = buttons
        .map(b => b.getAttribute('data-target'))
        .filter((id): id is string => !!id && id !== activeTarget);

      const activeEl = activeTarget ? document.getElementById(activeTarget) : null;
      const activeStyle = activeEl ? window.getComputedStyle(activeEl).contentVisibility : null;
      const activeNotHidden = activeStyle !== 'hidden';

      // Verify content-visibility is actually used on the page by checking if inactive has hidden
      const hasFeature = inactiveIds.length > 0 && inactiveIds.some(id => {
        const el = document.getElementById(id);
        return el && window.getComputedStyle(el).contentVisibility === 'hidden';
      });

      return activeNotHidden && hasFeature;
    });

    expect(activeNotHiddenAndFeatureExists).toBe(true);
  });

  test('the implementation must toggle the content-visibility state when switching between views', async ({ page }) => {
    const targetFile = process.env.TARGET_FILE || 'demo.html';
    await page.goto('file://' + path.resolve(targetFile));

    const toggleSuccess = await page.evaluate(async () => {
      const buttons = Array.from(document.querySelectorAll('[data-target]')) as HTMLElement[];
      const initialActiveBtn = document.querySelector('[data-target].active') as HTMLElement;
      const initialActiveTarget = initialActiveBtn?.getAttribute('data-target');

      const inactiveBtn = buttons.find(b => b.getAttribute('data-target') !== initialActiveTarget);
      if (!inactiveBtn) return false;
      const nextTarget = inactiveBtn.getAttribute('data-target');

      // Click the button to switch view
      inactiveBtn.click();

      // Give a small delay for any transition/JS execution
      await new Promise(resolve => setTimeout(resolve, 100));

      const prevActiveEl = initialActiveTarget ? document.getElementById(initialActiveTarget) : null;
      const nextActiveEl = nextTarget ? document.getElementById(nextTarget) : null;

      if (!prevActiveEl || !nextActiveEl) return false;

      const prevStyle = window.getComputedStyle(prevActiveEl).contentVisibility;
      const nextStyle = window.getComputedStyle(nextActiveEl).contentVisibility;

      return prevStyle === 'hidden' && nextStyle !== 'hidden';
    });

    expect(toggleSuccess).toBe(true);
  });

  test('the implementation must use aria-hidden="true" on inactive view elements', async ({ page }) => {
    const targetFile = process.env.TARGET_FILE || 'demo.html';
    await page.goto('file://' + path.resolve(targetFile));

    const inactiveAriaHiddenCorrect = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('[data-target]'));
      const activeTarget = document.querySelector('[data-target].active')?.getAttribute('data-target');
      const inactiveIds = buttons
        .map(b => b.getAttribute('data-target'))
        .filter((id): id is string => !!id && id !== activeTarget);

      if (inactiveIds.length === 0) return false;

      return inactiveIds.every(id => {
        const el = document.getElementById(id);
        return el && el.getAttribute('aria-hidden') === 'true';
      });
    });

    expect(inactiveAriaHiddenCorrect).toBe(true);
  });

  test('the implementation should maintain focus management by moving focus to the active view container upon transition', async ({ page }) => {
    const targetFile = process.env.TARGET_FILE || 'demo.html';
    await page.goto('file://' + path.resolve(targetFile));

    const focusManagedCorrectly = await page.evaluate(async () => {
      const buttons = Array.from(document.querySelectorAll('[data-target]')) as HTMLElement[];
      const initialActiveBtn = document.querySelector('[data-target].active') as HTMLElement;
      const initialActiveTarget = initialActiveBtn?.getAttribute('data-target');

      const inactiveBtn = buttons.find(b => b.getAttribute('data-target') !== initialActiveTarget);
      if (!inactiveBtn) return false;
      const nextTarget = inactiveBtn.getAttribute('data-target');

      // Click the button to switch view
      inactiveBtn.click();

      // Wait briefly for transition/JS to complete focus shift
      await new Promise(resolve => setTimeout(resolve, 100));

      const activeEl = nextTarget ? document.getElementById(nextTarget) : null;
      return document.activeElement === activeEl;
    });

    expect(focusManagedCorrectly).toBe(true);
  });

  test('if content-visibility is not supported, inactive view elements must have display: none applied in their computed styles', async ({ page }) => {
    const targetFile = process.env.TARGET_FILE || 'demo.html';
    await page.goto('file://' + path.resolve(targetFile));

    const fallbackTriggeredCorrectly = await page.evaluate(() => {
      // Replace content-visibility with a dummy property name to simulate lack of support
      const styleElements = Array.from(document.querySelectorAll('style'));
      styleElements.forEach(style => {
        style.textContent = style.textContent ? style.textContent.replace(/content-visibility/g, 'x-content-visibility') : '';
      });

      // Find inactive views based on active nav button
      const buttons = Array.from(document.querySelectorAll('[data-target]'));
      const activeTarget = document.querySelector('[data-target].active')?.getAttribute('data-target');
      const inactiveIds = buttons
        .map(b => b.getAttribute('data-target'))
        .filter((id): id is string => !!id && id !== activeTarget);

      if (inactiveIds.length === 0) return false;

      // Verify that the inactive views have display: none in computed styles now
      return inactiveIds.every(id => {
        const el = document.getElementById(id);
        if (!el) return false;
        const displayStyle = window.getComputedStyle(el).display;
        return displayStyle === 'none';
      });
    });

    expect(fallbackTriggeredCorrectly).toBe(true);
  });
});
