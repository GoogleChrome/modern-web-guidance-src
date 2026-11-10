import { test, expect } from '@playwright/test';
import * as path from 'path';

test('Uses the linear() timing function for animation or transition', async ({ page }) => {
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

test('Includes at least 5 stops in the linear() timing function to approximate a complex physics-based curve', async ({ page }) => {
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

test('Contains a progress value greater than 1 or less than 0 on the spring element to demonstrate overshooting or anticipation', async ({ page }) => {
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

test('Defines a non-zero transition or animation duration alongside the linear() timing function', async ({ page }) => {
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

test('Provides a fallback easing function for browsers that do not support linear()', async ({ page }) => {
  const targetFile = process.env.TARGET_FILE || path.resolve('demo.html');
  const fileUrl = targetFile.startsWith('http') ? targetFile : 'file://' + path.resolve(targetFile);
  await page.goto(fileUrl);

  const hasFallback = await page.evaluate(() => {
    function collectRules(sheet: CSSStyleSheet): CSSRule[] {
      const results: CSSRule[] = [];
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          results.push(rule);
          if ('cssRules' in rule && (rule as any).cssRules) {
            results.push(...Array.from((rule as any).cssRules as CSSRule[]));
          }
        }
      } catch {}
      return results;
    }

    const sheets = Array.from(document.styleSheets);
    const allRules = sheets.flatMap(collectRules);

    // 1. Check for @supports block with linear( or easing
    for (const rule of allRules) {
      if (rule instanceof CSSSupportsRule || (rule.constructor && rule.constructor.name === 'CSSSupportsRule')) {
        const cond = (rule as CSSSupportsRule).conditionText || '';
        const css = rule.cssText || '';
        if (/linear\(|easing/i.test(cond) || /linear\(|easing/i.test(css)) {
          return true;
        }
      }
    }

    // 2. Check for rules targeting animated elements or defining easing
    const targetSelectorRegex = /\.box|\.spring|\.bounce|card/i;
    for (const rule of allRules) {
      if (rule instanceof CSSStyleRule) {
        const sel = rule.selectorText || '';
        const css = rule.cssText || '';
        if (targetSelectorRegex.test(sel)) {
          const hasLinear = /linear\(/i.test(css);
          const hasVarEasing = /var\(--[\w-]*easing\)/i.test(css);
          const hasStandard = /(?:cubic-bezier|ease-out|ease-in-out|ease-in|\bease\b)/i.test(css);
          if ((hasLinear || hasVarEasing) && hasStandard) {
            return true;
          }
        }
      }
    }

    // 3. Also check <style> elements directly for rule blocks targeting cards/boxes with fallback
    const styleTags = Array.from(document.querySelectorAll('style'));
    for (const tag of styleTags) {
      const text = tag.textContent || '';
      if (/@supports[^{]*linear\(/i.test(text)) return true;
      const blockRegex = /(?:^|\})([^{]*?(?:\.box|\.spring|\.bounce|\.card)[^{]*)\{([^}]+)\}/gi;
      let match;
      while ((match = blockRegex.exec(text)) !== null) {
        const body = match[2];
        const hasLinearOrVar = /linear\(|var\(--[\w-]*easing\)/i.test(body);
        const hasStandard = /(?:cubic-bezier|ease-out|ease-in-out|ease-in|\bease\b)/i.test(body);
        if (hasLinearOrVar && hasStandard) {
          return true;
        }
      }
    }

    return false;
  });
  expect(hasFallback).toBe(true);
});

test('Disables or reduces the animation when prefers-reduced-motion is detected', async ({ page }) => {
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

test('Avoids steps above 1 or below 0 if opacity is transitioned with a linear() function', async ({ page }) => {
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
