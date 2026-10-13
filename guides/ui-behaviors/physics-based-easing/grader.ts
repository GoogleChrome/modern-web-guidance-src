import { test, expect } from '@playwright/test';
import * as path from 'path';

test('should use the linear() timing function for animation or transition', async ({ page }) => {
  const targetFile = process.env.TARGET_FILE || path.resolve('demo.html');
  const fileUrl = targetFile.startsWith('http') ? targetFile : 'file://' + path.resolve(targetFile);
  await page.goto(fileUrl);

  const hasLinear = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    return elements.some(el => {
      const style = window.getComputedStyle(el);
      return style.transitionTimingFunction.includes('linear(') || 
             style.animationTimingFunction.includes('linear(');
    });
  });
  expect(hasLinear).toBe(true);
});

test('should include at least 5 stops to approximate a complex physics-based curve', async ({ page }) => {
  const targetFile = process.env.TARGET_FILE || path.resolve('demo.html');
  const fileUrl = targetFile.startsWith('http') ? targetFile : 'file://' + path.resolve(targetFile);
  await page.goto(fileUrl);

  const maxStops = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    let maxCount = 0;
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      for (const fn of [style.transitionTimingFunction, style.animationTimingFunction]) {
        const match = fn.match(/linear\(([^)]+)\)/);
        if (match) {
          const stops = match[1].split(',').map(s => s.trim());
          if (stops.length > maxCount) {
            maxCount = stops.length;
          }
        }
      }
    }
    return maxCount;
  });
  expect(maxStops).toBeGreaterThanOrEqual(5);
});

test('should contain at least one progress value greater than 1 or less than 0 on the spring box to demonstrate overshooting or anticipation', async ({ page }) => {
  const targetFile = process.env.TARGET_FILE || path.resolve('demo.html');
  const fileUrl = targetFile.startsWith('http') ? targetFile : 'file://' + path.resolve(targetFile);
  await page.goto(fileUrl);

  const hasOvershoot = await page.evaluate(() => {
    const springEl = document.querySelector('.spring');
    if (!springEl) return false;
    const style = window.getComputedStyle(springEl);
    for (const fn of [style.transitionTimingFunction, style.animationTimingFunction]) {
      const match = fn.match(/linear\(([^)]+)\)/);
      if (match) {
        const stops = match[1].split(',').map(s => s.trim());
        for (const stop of stops) {
          const tokens = stop.split(/\s+/);
          const val = parseFloat(tokens[0]);
          if (!isNaN(val) && (val > 1 || val < 0)) {
            return true;
          }
        }
      }
    }
    return false;
  });
  expect(hasOvershoot).toBe(true);
});

test('should define a non-zero transition or animation duration alongside the linear() timing function', async ({ page }) => {
  const targetFile = process.env.TARGET_FILE || path.resolve('demo.html');
  const fileUrl = targetFile.startsWith('http') ? targetFile : 'file://' + path.resolve(targetFile);
  await page.goto(fileUrl);

  const hasDurationWithLinear = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    let foundLinear = false;
    let validDuration = false;
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const isTransLinear = style.transitionTimingFunction.includes('linear(');
      const isAnimLinear = style.animationTimingFunction.includes('linear(');
      if (isTransLinear || isAnimLinear) {
        foundLinear = true;
        if (isTransLinear) {
          const durSecs = parseFloat(style.transitionDuration);
          if (durSecs > 0) validDuration = true;
        }
        if (isAnimLinear) {
          const durSecs = parseFloat(style.animationDuration);
          if (durSecs > 0) validDuration = true;
        }
      }
    }
    return foundLinear && validDuration;
  });
  expect(hasDurationWithLinear).toBe(true);
});

test('should disable or reduce the animation when prefers-reduced-motion is detected', async ({ page }) => {
  const targetFile = process.env.TARGET_FILE || path.resolve('demo.html');
  const fileUrl = targetFile.startsWith('http') ? targetFile : 'file://' + path.resolve(targetFile);
  await page.goto(fileUrl);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const isReduced = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('.box, .spring, .bounce'));
    if (elements.length === 0) return false;
    
    return elements.every(el => {
      const style = window.getComputedStyle(el);
      const hasTransition = style.transitionProperty !== 'none' && parseFloat(style.transitionDuration) > 0;
      const hasAnimation = style.animationName !== 'none' && parseFloat(style.animationDuration) > 0;
      return !hasTransition && !hasAnimation;
    });
  });
  expect(isReduced).toBe(true);
});

test('should not have steps above 1 or below 0 if opacity is transitioned with a linear() function', async ({ page }) => {
  const targetFile = process.env.TARGET_FILE || path.resolve('demo.html');
  const fileUrl = targetFile.startsWith('http') ? targetFile : 'file://' + path.resolve(targetFile);
  await page.goto(fileUrl);

  const opacityCheck = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    
    let hasAnyLinear = false;
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      if (style.transitionTimingFunction.includes('linear(') || style.animationTimingFunction.includes('linear(')) {
        hasAnyLinear = true;
        break;
      }
    }
    if (!hasAnyLinear) {
      return false; // Fail negative-demo.html because it lacks any linear() timing function
    }
    
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const transitionProperties = style.transitionProperty.split(',').map(s => s.trim());
      const isOpacityTransition = transitionProperties.includes('opacity') || transitionProperties.includes('all');
      const hasLinearTransition = style.transitionTimingFunction.includes('linear(');
      
      if (isOpacityTransition && hasLinearTransition) {
        const match = style.transitionTimingFunction.match(/linear\(([^)]+)\)/);
        if (match) {
          const stops = match[1].split(',').map(s => s.trim());
          for (const stop of stops) {
            const tokens = stop.split(/\s+/);
            const val = parseFloat(tokens[0]);
            if (!isNaN(val) && (val > 1 || val < 0)) {
              return false; // Found an overshoot/undershoot on opacity -> fail
            }
          }
        }
      }
    }
    return true;
  });
  expect(opacityCheck).toBe(true);
});
