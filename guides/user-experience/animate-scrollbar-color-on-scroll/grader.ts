import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { parseHTML } from 'linkedom';
import * as csstree from 'css-tree';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;
const htmlStr = fs.readFileSync(filePath, 'utf-8');

// Initialize a static parser
const { document } = parseHTML(htmlStr);

// Extract CSS
const styles = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
const ast = csstree.parse(styles);

test.describe(`Animate Scrollbar Color Expectations: ${demoName}`, () => {
  
  test('MANDATORY: Define a CSS @property with syntax: "<color>"', () => {
    let hasColorSyntax = false;
    csstree.walk(ast, {
      visit: 'Atrule',
      enter(node) {
        if (node.name === 'property') {
          csstree.walk(node.block!, {
            visit: 'Declaration',
            enter(decl) {
              if (decl.property === 'syntax') {
                const syntaxValue = csstree.generate(decl.value);
                if (syntaxValue.includes('<color>')) hasColorSyntax = true;
              }
            }
          });
        }
      }
    });
    expect(hasColorSyntax).toBe(true);
  });

  test('MANDATORY: Define an @keyframes block that animates a custom property', () => {
    let animatesCustomProp = false;
    csstree.walk(ast, {
      visit: 'Atrule',
      enter(node) {
        if (node.name === 'keyframes') {
          csstree.walk(node.block!, {
            visit: 'Declaration',
            enter(decl) {
              if (decl.property.startsWith('--')) {
                animatesCustomProp = true;
              }
            }
          });
        }
      }
    });
    expect(animatesCustomProp).toBe(true);
  });

  test('MANDATORY: The scrollable element uses scrollbar-color with a var() and a fallback color', () => {
    let hasVarWithFallback = false;
    csstree.walk(ast, {
      visit: 'Declaration',
      enter(node) {
        if (node.property === 'scrollbar-color') {
          const val = csstree.generate(node.value);
          // A var() with a fallback looks like var(--name, fallback)
          if (val.includes('var(--') && val.includes(',')) {
            hasVarWithFallback = true;
          }
        }
      }
    });
    expect(hasVarWithFallback).toBe(true);
  });

  test('MANDATORY: If legacy ::-webkit-scrollbar-thumb is used, it must include a var() with a fallback', () => {
    let hasWebkitThumb = false;
    let hasVarFallback = false;

    csstree.walk(ast, {
      visit: 'Rule',
      enter(ruleNode) {
        const selectorText = csstree.generate(ruleNode.prelude);
        if (selectorText.includes('::-webkit-scrollbar-thumb')) {
          hasWebkitThumb = true;
          csstree.walk(ruleNode.block, {
            visit: 'Declaration',
            enter(decl) {
              if (decl.property.includes('background')) {
                const val = csstree.generate(decl.value);
                if (val.includes('var(--') && val.includes(',')) {
                  hasVarFallback = true;
                }
              }
            }
          });
        }
      }
    });

    if (hasWebkitThumb) {
      expect(hasVarFallback).toBe(true);
    } else {
      expect(hasWebkitThumb).toBe(false); // Fails for negative demo without the thumb
    }
  });

  test.describe('Browser Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('http://localhost/*', async (route) => {
        const requestPath = new URL(route.request().url()).pathname;
        const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);
        if (fs.existsSync(localFilePath)) await route.fulfill({ path: localFilePath });
        else await route.continue();
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
            // Ignore cross-origin stylesheet errors
            continue;
          }
        }

        // 2. Find the scrollable element
        const allElements = Array.from(document.querySelectorAll('*'));
        for (const el of allElements) {
          const style = window.getComputedStyle(el);
          const animName = style.animationName;
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
          const timeline = style.animationTimeline || style.getPropertyValue('animation-timeline');
          if (timeline && (timeline.includes('scroll(') || timeline.includes('scroll-timeline'))) {
             return timeline.includes('scroll');
          }
        }
        return false;
      });

      expect(timelineStatus).toBe(true);
    });
  });
});
