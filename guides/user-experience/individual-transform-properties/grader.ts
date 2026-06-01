import { test, expect } from '@playwright/test';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE || path.resolve('demo.html');
const targetUrl = targetFile.startsWith('http') ? targetFile : `file://${path.resolve(targetFile)}`;

test.beforeEach(async ({ page }) => {
  await page.goto(targetUrl);
});

test('target element has its translate property explicitly initialized to its identity value in CSS', async ({ page }) => {
  const hasTranslate = await page.evaluate(() => {
    const el = document.querySelector('.target') as HTMLElement;
    if (!el) return false;

    const matchedRules: any[] = [];
    function traverse(rules: any) {
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        if (rule.selectorText) {
          if (el.matches(rule.selectorText) && !rule.selectorText.includes(':hover')) {
            matchedRules.push(rule);
          }
        } else if (rule.cssRules) {
          if (rule.conditionText && rule.conditionText.toLowerCase().includes('not')) {
            continue;
          }
          traverse(rule.cssRules);
        }
      }
    }

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        if (sheet.cssRules) traverse(sheet.cssRules);
      } catch (e) {}
    }

    return matchedRules.some(r => {
      const t = r.style.translate.trim();
      if (!t) return false;
      const parts = t.split(/\s+/);
      return parts.every((p: string) => {
        const num = parseFloat(p);
        return num === 0 || p === 'none';
      });
    });
  });

  expect(hasTranslate).toBe(true);
});

test('target element has its scale property explicitly initialized to its identity value in CSS', async ({ page }) => {
  const hasScale = await page.evaluate(() => {
    const el = document.querySelector('.target') as HTMLElement;
    if (!el) return false;

    const matchedRules: any[] = [];
    function traverse(rules: any) {
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        if (rule.selectorText) {
          if (el.matches(rule.selectorText) && !rule.selectorText.includes(':hover')) {
            matchedRules.push(rule);
          }
        } else if (rule.cssRules) {
          if (rule.conditionText && rule.conditionText.toLowerCase().includes('not')) {
            continue;
          }
          traverse(rule.cssRules);
        }
      }
    }

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        if (sheet.cssRules) traverse(sheet.cssRules);
      } catch (e) {}
    }

    return matchedRules.some(r => {
      const s = r.style.scale.trim();
      if (!s) return false;
      const parts = s.split(/\s+/);
      return parts.every((p: string) => {
        const num = parseFloat(p);
        return num === 1 || p === 'none';
      });
    });
  });

  expect(hasScale).toBe(true);
});

test('target element has its rotate property explicitly initialized to its identity value in CSS', async ({ page }) => {
  const hasRotate = await page.evaluate(() => {
    const el = document.querySelector('.target') as HTMLElement;
    if (!el) return false;

    const matchedRules: any[] = [];
    function traverse(rules: any) {
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        if (rule.selectorText) {
          if (el.matches(rule.selectorText) && !rule.selectorText.includes(':hover')) {
            matchedRules.push(rule);
          }
        } else if (rule.cssRules) {
          if (rule.conditionText && rule.conditionText.toLowerCase().includes('not')) {
            continue;
          }
          traverse(rule.cssRules);
        }
      }
    }

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        if (sheet.cssRules) traverse(sheet.cssRules);
      } catch (e) {}
    }

    return matchedRules.some(r => {
      const rot = r.style.rotate.trim();
      if (!rot) return false;
      const num = parseFloat(rot);
      return num === 0 || rot === 'none';
    });
  });

  expect(hasRotate).toBe(true);
});

test('does not use the will-change property to ensure the stacking context', async ({ page }) => {
  const willChange = await page.evaluate(() => {
    const el = document.querySelector('.target') as HTMLElement;
    if (!el) return 'transform'; // fail by default if target is missing
    return window.getComputedStyle(el).willChange || 'auto';
  });

  const isClean = !willChange.includes('transform') &&
                  !willChange.includes('translate') &&
                  !willChange.includes('rotate') &&
                  !willChange.includes('scale');
  expect(isClean).toBe(true);
});

test('target element has an active animation or transition on its translate property', async ({ page }) => {
  const hasTranslateMotion = await page.evaluate(() => {
    const el = document.querySelector('.target') as HTMLElement;
    if (!el) return false;

    const computed = window.getComputedStyle(el);

    // Check transition
    const transitionProperties = (computed.transitionProperty || '').split(',').map(s => s.trim());
    const hasTransition = transitionProperties.includes('translate') || transitionProperties.includes('all');

    // Check animation
    const animationNames = (computed.animationName || '').split(',').map(s => s.trim());
    let hasAnimation = false;

    const keyframeRules: any[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        if (sheet.cssRules) {
          for (let i = 0; i < sheet.cssRules.length; i++) {
            const rule = sheet.cssRules[i] as any;
            if (rule.name && animationNames.includes(rule.name) && rule.cssRules) {
              keyframeRules.push(rule);
            }
          }
        }
      } catch (e) {}
    }

    for (const kfRule of keyframeRules) {
      for (let j = 0; j < kfRule.cssRules.length; j++) {
        const keyframe = kfRule.cssRules[j];
        if (keyframe.style && (keyframe.style.translate || keyframe.style.getPropertyValue('translate'))) {
          hasAnimation = true;
        }
      }
    }

    return hasTransition || hasAnimation;
  });

  expect(hasTranslateMotion).toBe(true);
});

test('target element has an active animation or transition on its rotate property', async ({ page }) => {
  const hasRotateMotion = await page.evaluate(() => {
    const el = document.querySelector('.target') as HTMLElement;
    if (!el) return false;

    const computed = window.getComputedStyle(el);

    // Check transition
    const transitionProperties = (computed.transitionProperty || '').split(',').map(s => s.trim());
    const hasTransition = transitionProperties.includes('rotate') || transitionProperties.includes('all');

    // Check animation
    const animationNames = (computed.animationName || '').split(',').map(s => s.trim());
    let hasAnimation = false;

    const keyframeRules: any[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        if (sheet.cssRules) {
          for (let i = 0; i < sheet.cssRules.length; i++) {
            const rule = sheet.cssRules[i] as any;
            if (rule.name && animationNames.includes(rule.name) && rule.cssRules) {
              keyframeRules.push(rule);
            }
          }
        }
      } catch (e) {}
    }

    for (const kfRule of keyframeRules) {
      for (let j = 0; j < kfRule.cssRules.length; j++) {
        const keyframe = kfRule.cssRules[j];
        if (keyframe.style && (keyframe.style.rotate || keyframe.style.getPropertyValue('rotate'))) {
          hasAnimation = true;
        }
      }
    }

    return hasTransition || hasAnimation;
  });

  expect(hasRotateMotion).toBe(true);
});

test('target element scale property transitions to a new value on hover', async ({ page }) => {
  const initialScale = await page.evaluate(() => {
    const el = document.querySelector('.target') as HTMLElement;
    if (!el) return 'none';
    return window.getComputedStyle(el).scale;
  });

  await page.locator('.target').hover({ force: true });
  await page.waitForTimeout(400);

  const hoveredScale = await page.evaluate(() => {
    const el = document.querySelector('.target') as HTMLElement;
    if (!el) return 'none';
    return window.getComputedStyle(el).scale;
  });

  const changedAndValid = (initialScale !== hoveredScale) && (hoveredScale !== 'none') && (initialScale !== 'none');
  expect(changedAndValid).toBe(true);
});

test('translate and rotate animations continue to run when target is hovered', async ({ page }) => {
  await page.locator('.target').hover({ force: true });
  
  const playState = await page.evaluate(() => {
    const el = document.querySelector('.target') as HTMLElement;
    if (!el) return 'paused';
    return window.getComputedStyle(el).animationPlayState || 'running';
  });

  const isRunning = !playState.includes('paused');
  expect(isRunning).toBe(true);
});

test('implementation includes a fallback strategy using supports for browsers without individual transform support', async ({ page }) => {
  const hasSupportsFallback = await page.evaluate(() => {
    let fallbackFound = false;
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        if (sheet.cssRules) {
          for (let i = 0; i < sheet.cssRules.length; i++) {
            const rule = sheet.cssRules[i] as any;
            if (rule.conditionText) {
              const cond = rule.conditionText.toLowerCase();
              if (cond.includes('translate') || cond.includes('rotate') || cond.includes('scale')) {
                fallbackFound = true;
              }
            }
          }
        }
      } catch (e) {}
    }
    return fallbackFound;
  });

  expect(hasSupportsFallback).toBe(true);
});
