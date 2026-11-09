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

  test('Named view-timelines are defined on tracked elements.', async ({ page }) => {
    const hasViewTimeline = await page.evaluate(() => {
      const sections = document.querySelectorAll('#tracked section');
      if (sections.length === 0) return false;
      return Array.from(sections).some(el => {
        const style = window.getComputedStyle(el);
        return style.getPropertyValue('view-timeline-name') !== 'none';
      });
    });
    expect(hasViewTimeline).toBe(true);
  });

  test('timeline-scope is used on a common ancestor to make named timelines accessible.', async ({ page }) => {
    const hasTimelineScope = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      return Array.from(elements).some(el => {
        const style = window.getComputedStyle(el);
        const timelineScope = style.getPropertyValue('timeline-scope');
        return timelineScope !== 'none' && timelineScope !== '' && timelineScope !== 'none none';
      });
    });

    expect(hasTimelineScope).toBe(true);
  });

  test('Target elements use animation-timeline linked to the named timelines.', async ({ page }) => {
    const hasAnimationTimeline = await page.evaluate(() => {
      const sections = document.querySelectorAll('#animated section');
      if (sections.length === 0) return false;
      return Array.from(sections).some(el => {
        const style = window.getComputedStyle(el);
        const animationTimeline = style.getPropertyValue('animation-timeline');
        return animationTimeline !== 'auto' && animationTimeline !== 'none' && animationTimeline !== '';
      });
    });
    expect(hasAnimationTimeline).toBe(true);
  });

  test('animation-range controls animation timing relative to the tracked elements.', async ({ page }) => {
    const hasAnimationRange = await page.evaluate(() => {
      const sections = document.querySelectorAll('#animated section');
      if (sections.length === 0) return false;
      return Array.from(sections).some(el => {
        const style = window.getComputedStyle(el);
        return style.getPropertyValue('animation-range-start') !== 'normal' || style.getPropertyValue('animation-range-end') !== 'normal';
      });
    });
    expect(hasAnimationRange).toBe(true);
  });

  test('The implementation includes feature detection using @supports for scroll-driven animations.', async ({ page }) => {
    const isCompliant = await page.evaluate(() => {
      let hasSupports = false;
      for (let i = 0; i < document.styleSheets.length; i++) {
        try {
          const rules = document.styleSheets[i].cssRules;
          const checkRules = (rulesList: CSSRuleList) => {
            for (let j = 0; j < rulesList.length; j++) {
              const rule = rulesList[j];
              if (rule instanceof CSSSupportsRule) {
                const cond = rule.conditionText.toLowerCase();
                if (
                  cond.includes('animation-timeline') ||
                  cond.includes('view-timeline') ||
                  cond.includes('animation-range') ||
                  cond.includes('scroll-driven')
                ) {
                  hasSupports = true;
                }
                checkRules(rule.cssRules);
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
      return hasSupports;
    });
    expect(isCompliant).toBe(true);
  });

  test('The implementation respects user preferences for reduced motion using @media (prefers-reduced-motion: no-preference).', async ({ page }) => {
    const isCompliant = await page.evaluate(() => {
      let hasMedia = false;
      for (let i = 0; i < document.styleSheets.length; i++) {
        try {
          const rules = document.styleSheets[i].cssRules;
          const checkRules = (rulesList: CSSRuleList) => {
            for (let j = 0; j < rulesList.length; j++) {
              const rule = rulesList[j];
              if (rule instanceof CSSMediaRule) {
                if (rule.conditionText.toLowerCase().includes('prefers-reduced-motion')) {
                  hasMedia = true;
                }
                checkRules(rule.cssRules);
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
      return hasMedia;
    });
    expect(isCompliant).toBe(true);
  });
});
