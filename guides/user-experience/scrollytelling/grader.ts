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

test.describe(`Scrollytelling Expectations: ${demoName}`, () => {
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

  test('MANDATORY: The agent has defined named `view-timeline`s on the tracked elements.', async ({ page }) => {
    const hasViewTimeline = await page.evaluate(() => {
      const sections = document.querySelectorAll('#tracked section');
      if (sections.length === 0) return false;
      return Array.from(sections).some(el => {
        const style = window.getComputedStyle(el);
        return style.viewTimelineName !== 'none';
      });
    });
    expect(hasViewTimeline).toBe(true);
  });

  test('MANDATORY: The agent has used `timeline-scope` on a common ancestor (e.g., `html` or `:root`) to make the named timelines accessible.', async ({ page }) => {
    const hasTimelineScope = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      return Array.from(elements).some(el => {
        const style = window.getComputedStyle(el);
        return style.timelineScope !== 'none' && style.timelineScope !== '' && style.timelineScope !== 'none none';
      });
    });

    expect(hasTimelineScope).toBe(true);
  });

  test('MANDATORY: The agent has applied animations to the target elements using `animation-timeline` linked to the named timelines.', async ({ page }) => {
    const hasAnimationTimeline = await page.evaluate(() => {
      const sections = document.querySelectorAll('#animated section');
      if (sections.length === 0) return false;
      return Array.from(sections).some(el => {
        const style = window.getComputedStyle(el);
        return style.animationTimeline !== 'auto' && style.animationTimeline !== 'none' && style.animationTimeline !== '';
      });
    });
    expect(hasAnimationTimeline).toBe(true);
  });

  test('MANDATORY: The agent has used `animation-range` to control the animation timing relative to the tracked elements.', async ({ page }) => {
    const hasAnimationRange = await page.evaluate(() => {
      const sections = document.querySelectorAll('#animated section');
      if (sections.length === 0) return false;
      return Array.from(sections).some(el => {
        const style = window.getComputedStyle(el);
        return style.animationRangeStart !== 'normal' || style.animationRangeEnd !== 'normal';
      });
    });
    expect(hasAnimationRange).toBe(true);
  });

  test('MANDATORY: The implementation includes feature detection using `@supports` for scroll-driven animations.', async ({ page }) => {
    const isCompliant = await page.evaluate(() => {
      let hasSupports = false;
      for (let i = 0; i < document.styleSheets.length; i++) {
        try {
          const rules = document.styleSheets[i].cssRules;
          const checkRules = (rulesList: CSSRuleList) => {
            for (let j = 0; j < rulesList.length; j++) {
              const rule = rulesList[j];
              if (rule instanceof CSSSupportsRule && (rule.conditionText.includes('animation-timeline') || rule.conditionText.includes('scroll-driven'))) {
                hasSupports = true;
              } else if (rule instanceof CSSLayerBlockRule || rule instanceof CSSMediaRule) {
                checkRules(rule.cssRules);
              }
            }
          };
          checkRules(rules);
        } catch (e) {
            if (e instanceof DOMException && e.name === 'SecurityError') {
              // Ignore cross-origin stylesheet errors
            } else {
              throw e;
            }
        }
      }
      const hasJsFallback = document.querySelectorAll('script').length > 0;
      return hasSupports || !hasJsFallback;
    });
    expect(isCompliant).toBe(true);
  });

  test('MANDATORY: The implementation respects user preferences for reduced motion using `@media (prefers-reduced-motion: no-preference)`.', async ({ page }) => {
    const isCompliant = await page.evaluate(() => {
      let hasMedia = false;
      for (let i = 0; i < document.styleSheets.length; i++) {
        try {
          const rules = document.styleSheets[i].cssRules;
          const checkRules = (rulesList: CSSRuleList) => {
            for (let j = 0; j < rulesList.length; j++) {
              const rule = rulesList[j];
              if (rule instanceof CSSMediaRule && rule.conditionText.includes('prefers-reduced-motion')) {
                hasMedia = true;
              } else if (rule instanceof CSSLayerBlockRule || rule instanceof CSSSupportsRule) {
                checkRules(rule.cssRules);
              }
            }
          };
          checkRules(rules);
        } catch (e) {
            if (e instanceof DOMException && e.name === 'SecurityError') {
              // Ignore cross-origin stylesheet errors
            } else {
              throw e;
            }
        }
      }
      const hasJsFallback = document.querySelectorAll('script').length > 0;
      return hasMedia || !hasJsFallback;
    });
    expect(isCompliant).toBe(true);
  });
});
