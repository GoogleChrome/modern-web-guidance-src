import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const targetFile = process.env.TARGET_FILE || '';

test.describe('Linear Easing Grader', () => {
  test.beforeEach(async ({ page }) => {
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is required');
    }
    const absolutePath = path.isAbsolute(targetFile) 
      ? `file://${targetFile}` 
      : `file://${path.join(process.cwd(), targetFile)}`;
    await page.goto(absolutePath);
  });

  test('The agent has defined an animation or transition that uses the linear() easing function inline.', async ({ page }) => {
    const linearUsedInline = await page.evaluate(() => {
      const styles = Array.from(document.styleSheets);
      for (const sheet of styles) {
        try {
          const rules = Array.from(sheet.cssRules) as CSSStyleRule[];
          for (const rule of rules) {
            if (!rule.style) continue;
            const props = ['animation-timing-function', 'transition-timing-function', 'animation', 'transition'];
            for (const prop of props) {
              const val = rule.style.getPropertyValue(prop);
              if (val.includes('linear(')) {
                return true;
              }
            }
          }
        } catch (e) {}
      }
      return false;
    });
    expect(linearUsedInline).toBe(true);
  });

  test('The linear() function contains at least three comma-separated progress points.', async ({ page }) => {
    const pointCount = await page.evaluate(() => {
      let maxPoints = 0;
      const styles = Array.from(document.styleSheets);
      for (const sheet of styles) {
        try {
          const rules = Array.from(sheet.cssRules) as CSSStyleRule[];
          for (const rule of rules) {
            if (!rule.style) continue;
            const props = ['animation-timing-function', 'transition-timing-function', 'animation', 'transition'];
            for (const prop of props) {
              const val = rule.style.getPropertyValue(prop);
              if (val.includes('linear(')) {
                const match = val.match(/linear\((.*)\)/);
                if (match) {
                  const points = match[1].split(',').filter(s => s.trim().length > 0);
                  maxPoints = Math.max(maxPoints, points.length);
                }
              }
            }
          }
        } catch (e) {}
      }
      return maxPoints;
    });
    expect(pointCount).toBeGreaterThanOrEqual(3);
  });

  test('The agent MUST NOT abstract the linear() function into a CSS variable.', async ({ page }) => {
    const usesVariable = await page.evaluate(() => {
      const styles = Array.from(document.styleSheets);
      for (const sheet of styles) {
        try {
          const rules = Array.from(sheet.cssRules) as CSSStyleRule[];
          for (const rule of rules) {
            if (!rule.style) continue;
            // Check if any custom property is defined with linear()
            if (/--[\w-]+\s*:\s*linear\(/.test(rule.cssText)) {
              return true;
            }
          }
        } catch (e) {}
      }
      return false;
    });
    expect(usesVariable).toBe(false);
  });

  test('The agent has provided a fallback easing function immediately before the linear() declaration.', async () => {
    let rawCss = '';
    const htmlPath = path.isAbsolute(targetFile) ? targetFile : path.join(process.cwd(), targetFile);
    const html = fs.readFileSync(htmlPath, 'utf-8');
    
    const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    if (styleMatches) {
      rawCss += styleMatches.map(m => m.replace(/<\/?style[^>]*>/gi, '')).join('\n');
    }
    
    const linkMatches = html.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/gi);
    if (linkMatches) {
      for (const link of linkMatches) {
        const match = link.match(/href="([^"]+)"/);
        if (match) {
          const href = match[1];
          const cssPath = path.join(path.dirname(htmlPath), href);
          if (fs.existsSync(cssPath)) {
            rawCss += fs.readFileSync(cssPath, 'utf-8');
          }
        }
      }
    }

    const propPatterns = [
      { short: 'animation', long: 'animation-timing-function' },
      { short: 'transition', long: 'transition-timing-function' }
    ];

    let hasFallback = false;
    const whitespaceAndComments = '(?:\\/\\*[\\s\\S]*?\\*\\/|\\s)*';
    for (const prop of propPatterns) {
      const propGroup = `(?:${prop.short}|${prop.long})`;
      const regex = new RegExp(
        `${propGroup}${whitespaceAndComments}:${whitespaceAndComments}(?!linear\\()[^;{}]+;${whitespaceAndComments}${propGroup}${whitespaceAndComments}:[^;{}]*linear\\(`,
        'g'
      );
      if (regex.test(rawCss)) {
        hasFallback = true;
        break;
      }
    }
    
    expect(hasFallback).toBe(true);
  });
});
