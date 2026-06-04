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

test.describe(`Scroll-driven Animations Parallax Expectations: ${demoName}`, () => {

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

  test('MANDATORY: The agent has defined an @keyframes block that animates the transform property to create the parallax effect', async ({ page }) => {
    const hasTransformKeyframes = await page.evaluate(() => {
      let found = false;
      const checkRule = (rule: any) => {
        if (rule.type === CSSRule.KEYFRAMES_RULE) {
          for (const kr of rule.cssRules) {
            if (kr.style && kr.style.transform) {
              found = true;
            }
          }
        } else if (rule.cssRules) {
          for (const r of rule.cssRules) {
            checkRule(r);
          }
        }
      };
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            checkRule(rule);
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'SecurityError') continue;
          throw e;
        }
      }
      return found;
    });
    expect(hasTransformKeyframes).toBe(true);
  });

  test('MANDATORY: The agent has defined a view-timeline on the wrapper element or uses an anonymous view timeline', async ({ page }) => {
    const hasViewTimeline = await page.evaluate(() => {
      let found = false;
      const elements = document.querySelectorAll('*');
      for (let i = 0; i < elements.length; i++) {
        const style = window.getComputedStyle(elements[i]);
        if (style.getPropertyValue('view-timeline-name') && style.getPropertyValue('view-timeline-name') !== 'none') found = true;
        if (style.getPropertyValue('animation-timeline') && (style.getPropertyValue('animation-timeline').includes('view(') || style.getPropertyValue('animation-timeline').includes('scroll('))) found = true;
      }
      return found;
    });
    
    const hasViewTimelineInCSS = await page.evaluate(() => {
      let found = false;
      const checkRule = (rule: any) => {
        if (rule.type === CSSRule.STYLE_RULE) {
          if (rule.style.viewTimeline || rule.style.viewTimelineName || rule.style.animationTimeline?.includes('view(') || rule.style.animationTimeline?.includes('scroll(')) {
            found = true;
          }
        } else if (rule.cssRules) {
          for (const r of rule.cssRules) {
            checkRule(r);
          }
        }
      };
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            checkRule(rule);
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'SecurityError') continue;
          throw e;
        }
      }
      return found;
    });
    expect(hasViewTimeline || hasViewTimelineInCSS).toBe(true);
  });

  test('MANDATORY: The agent has applied the animation-timeline property to the layers to link them to the timeline', async ({ page }) => {
    const hasAnimationTimeline = await page.evaluate(() => {
      let found = false;
      const elements = document.querySelectorAll('body *');
      for (let i = 0; i < elements.length; i++) {
        const style = window.getComputedStyle(elements[i]);
        const timeline = style.getPropertyValue('animation-timeline');
        if (timeline && timeline !== 'auto' && timeline !== 'none') {
          found = true;
        }
      }
      return found;
    });

    const hasAnimationTimelineInCSS = await page.evaluate(() => {
      let found = false;
      const checkRule = (rule: any) => {
        if (rule.type === CSSRule.STYLE_RULE) {
          if (rule.style.animationTimeline && rule.style.animationTimeline !== 'auto' && rule.style.animationTimeline !== 'none') {
            found = true;
          }
        } else if (rule.cssRules) {
          for (const r of rule.cssRules) {
            checkRule(r);
          }
        }
      };
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            checkRule(rule);
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'SecurityError') continue;
          throw e;
        }
      }
      return found;
    });

    expect(hasAnimationTimeline || hasAnimationTimelineInCSS).toBe(true);
  });

  test('MANDATORY: The agent has staggered the animations across different layers so they move at different rates', async ({ page }) => {
    const getPositions = async () => {
      return await page.evaluate(() => {
        const elements = document.querySelectorAll('body *');
        const pos: Record<string, number> = {};
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          if (el.children.length === 0 || el.textContent?.trim()) { 
            const rect = el.getBoundingClientRect();
            pos[`${i}`] = rect.top;
          }
        }
        return pos;
      });
    };

    const initialPositions = await getPositions();

    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(200);

    const scrolledPositions = await getPositions();

    const deltas = new Set<number>();
    for (const key in initialPositions) {
      if (scrolledPositions[key] !== undefined) {
        const delta = Math.round(Math.abs(scrolledPositions[key] - initialPositions[key]));
        deltas.add(delta);
      }
    }

    let uniqueParallaxDeltas = 0;
    for (const delta of deltas) {
      if (Math.abs(delta - 500) > 2 && delta > 2) {
        uniqueParallaxDeltas++;
      }
    }
    
    expect(uniqueParallaxDeltas).toBeGreaterThanOrEqual(2);
  });

  test('MANDATORY: The wrapper element has overflow: clip or overflow: hidden', async ({ page }) => {
    const hasWrapper = await page.evaluate(() => {
      const elements = document.querySelectorAll('body *');
      for (let i = 0; i < elements.length; i++) {
        const style = window.getComputedStyle(elements[i]);
        if (style.overflow === 'clip' || style.overflow === 'hidden' || style.overflowX === 'clip' || style.overflowY === 'clip' || style.overflowX === 'hidden' || style.overflowY === 'hidden') {
          if (elements[i].children.length > 1) {
             return true;
          }
        }
      }
      return false;
    });
    expect(hasWrapper).toBe(true);
  });

  test('MANDATORY: The implementation includes feature detection using @supports for scroll-driven animations', async ({ page }) => {
    const hasSupports = await page.evaluate(() => {
      let found = false;
      const checkRule = (rule: any) => {
        if (rule.type === CSSRule.SUPPORTS_RULE) {
          if (rule.conditionText && rule.conditionText.includes('animation-timeline')) {
            found = true;
          }
        } else if (rule.cssRules) {
          for (const r of rule.cssRules) {
            checkRule(r);
          }
        }
      };
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            checkRule(rule);
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'SecurityError') continue;
          throw e;
        }
      }
      return found;
    });
    expect(hasSupports).toBe(true);
  });

  test('MANDATORY: The implementation respects user preferences for reduced motion using @media (prefers-reduced-motion)', async ({ page }) => {
    const hasMedia = await page.evaluate(() => {
      let found = false;
      const checkRule = (rule: any) => {
        if (rule.type === CSSRule.MEDIA_RULE) {
          if (rule.conditionText && rule.conditionText.includes('prefers-reduced-motion')) {
            found = true;
          }
        } else if (rule.cssRules) {
          for (const r of rule.cssRules) {
            checkRule(r);
          }
        }
      };
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            checkRule(rule);
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'SecurityError') continue;
          throw e;
        }
      }
      return found;
    });
    expect(hasMedia).toBe(true);
  });

});
