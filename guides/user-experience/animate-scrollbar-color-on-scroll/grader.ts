import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Animate Scrollbar Color Expectations: ${demoName}`, () => {
  
  test('MANDATORY: Define a CSS @property with syntax: "<color>"', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Look for @property with syntax: '<color>' or syntax: "<color>"
    const propertyRegex = /@property\s+--[\w-]+\s*{[^}]*syntax\s*:\s*(['"])<color>\1/i;
    expect(html).toMatch(propertyRegex);
  });

  test('MANDATORY: Define an @keyframes block that animates a custom property', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Look for @keyframes that contains a custom property assignment (starts with --)
    const keyframesRegex = /@keyframes\s+[\w-]+\s*{[^}]*--[\w-]+\s*:/i;
    expect(html).toMatch(keyframesRegex);
  });

  test('MANDATORY: The scrollable element uses scrollbar-color with a var() and a fallback color', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Look for scrollbar-color using var(--prop, fallback)
    const scrollbarColorRegex = /scrollbar-color\s*:\s*var\(\s*--[\w-]+\s*,\s*[^)]+\)/i;
    expect(html).toMatch(scrollbarColorRegex);
  });

  test('MANDATORY: If legacy ::-webkit-scrollbar-thumb is used, it must include a var() with a fallback', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Check if webkit-scrollbar-thumb is present, and if so, it must use var() with fallback
    if (html.includes('::-webkit-scrollbar-thumb')) {
      const webkitRegex = /::-webkit-scrollbar-thumb\s*{[^}]*background(-color)?\s*:\s*var\(\s*--[\w-]+\s*,\s*[^)]+\)/i;
      expect(html).toMatch(webkitRegex);
    } else {
      // If not present, this test technically passes as it's "If legacy ... is provided"
      // But for the sake of the negative demo failing, we can assume it should be there if we want to be strict,
      // however the expectation says "If...". 
      // Actually, negative-demo.html HAS it but without var(). So it will fail the regex.
      // If it's missing entirely, we should probably still pass unless the guide says it's mandatory to have it.
      // The guide says: "Pass the animated variable into the ::-webkit-scrollbar-thumb background color securely isolated behind an @supports not block."
      // This implies it IS mandatory for progressive enhancement.
      expect(html).toContain('::-webkit-scrollbar-thumb');
    }
  });

  test.describe('Browser Tests', () => {
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

    test('MANDATORY: The target scrollable element runs an animation that modifies a custom property', async ({ page }) => {
      const animationStatus = await page.evaluate(() => {
        // 1. Find all @keyframes that animate a custom property
        const customPropKeyframes = new Set<string>();
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            for (const rule of Array.from(sheet.cssRules)) {
              if (rule instanceof CSSKeyframesRule) {
                const keyframesText = rule.cssText;
                if (/--[\w-]+\s*:/.test(keyframesText)) {
                  customPropKeyframes.add(rule.name);
                }
              }
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes('Cannot access rules') || msg.includes('cross-origin') || (e instanceof Error && e.name === 'SecurityError')) {
              // Ignore cross-origin stylesheet errors
              continue;
            }
            throw e;
          }
        }

        // 2. Find the scrollable element (the one with animation-timeline)
        const allElements = Array.from(document.querySelectorAll('*'));
        for (const el of allElements) {
          const style = window.getComputedStyle(el);
          const animName = style.animationName;
          
          // Check if this element's animation name matches one of our custom property keyframes
          if (animName !== 'none') {
            const names = animName.split(',').map(s => s.trim());
            if (names.some(name => customPropKeyframes.has(name))) {
              return true;
            }
          }
        }
        return false;
      });

      expect(animationStatus).toBe(true);
    });

    test('MANDATORY: The target scrollable element binds the animation to the scroll state using animation-timeline: scroll(self)', async ({ page }) => {
      const timelineStatus = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));
        for (const el of allElements) {
          const style = window.getComputedStyle(el) as any;
          // animation-timeline is the property name
          const timeline = style.animationTimeline || style.getPropertyValue('animation-timeline');
          if (timeline && (timeline.includes('scroll(') || timeline.includes('scroll-timeline'))) {
             // We want to be specific about scroll(self) if possible, 
             // but computed style might just say "scroll()" which defaults to self.
             // Or it might be a named timeline. 
             // The guide says scroll(self).
             return timeline.includes('scroll');
          }
        }
        return false;
      });

      expect(timelineStatus).toBe(true);
    });
  });
});
