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

test.describe('Animate to Intrinsic Sizes Expectations', () => {

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

  test('should have interpolate-size: allow-keywords applied to :root or a parent', async ({ page }) => {
    const hasInterpolateSize = await page.evaluate(() => {
      const rootStyles = window.getComputedStyle(document.documentElement);
      const bodyStyles = window.getComputedStyle(document.body);
      
      // Check for the property. In some browsers it might be hyphenated or camelCase in the style object.
      // We check the computed value.
      return rootStyles.getPropertyValue('interpolate-size') === 'allow-keywords' || 
             bodyStyles.getPropertyValue('interpolate-size') === 'allow-keywords' ||
             // Check if any element has it inherited
             Array.from(document.querySelectorAll('*')).some(el => {
               const styles = window.getComputedStyle(el);
               return styles.getPropertyValue('interpolate-size') === 'allow-keywords';
             });
    });

    expect(hasInterpolateSize).toBe(true);
  });

  test('should define a transition for sizing properties (block-size, inline-size, height, or width) and NOT for max-sizing properties', async ({ page }) => {
    const hasCorrectSizingTransition = await page.evaluate(() => {
      const correctProperties = ['block-size', 'inline-size', 'height', 'width'];
      const incorrectProperties = ['max-block-size', 'max-inline-size', 'max-height', 'max-width'];
      const elements = Array.from(document.querySelectorAll('*'));
      
      return elements.some(el => {
        const styles = window.getComputedStyle(el);
        const transitionProps = styles.getPropertyValue('transition-property').split(',').map(p => p.trim());
        const duration = styles.getPropertyValue('transition-duration');
        const hasDuration = duration !== '0s' && duration !== '' && duration !== '0ms';
        
        if (!hasDuration) return false;

        const hasIncorrect = incorrectProperties.some(prop => transitionProps.includes(prop));
        
        return (correctProperties.some(p => transitionProps.includes(p)) || transitionProps.includes('all')) && !hasIncorrect;
      });
    });

    expect(hasCorrectSizingTransition).toBe(true);
  });

  test('should trigger expansion using intrinsic keywords and not magic number hacks', async ({ page }) => {
    const usesIntrinsicKeywords = await page.evaluate(async () => {
      // Since we can't easily know the 'expanded' class name, we can look at stylesheets.
      const hasIntrinsicKeyword = Array.from(document.styleSheets).some(sheet => {
        try {
          return Array.from(sheet.cssRules).some(rule => {
            if (rule instanceof CSSStyleRule) {
              const style = rule.style;
              return (
                style.blockSize === 'auto' || style.blockSize.includes('content') ||
                style.inlineSize === 'auto' || style.inlineSize.includes('content') ||
                style.height === 'auto' || style.height.includes('content') ||
                style.width === 'auto' || style.width.includes('content') ||
                style.blockSize.includes('calc-size') || style.inlineSize.includes('calc-size') ||
                style.height.includes('calc-size') || style.width.includes('calc-size')
              );
            }
            return false;
          });
        } catch (e) {
          return false;
        }
      });
      
      return hasIntrinsicKeyword;
    });

    expect(usesIntrinsicKeywords).toBe(true);
  });

  test('should smoothly animate size property when triggered', async ({ page }) => {
    const trigger = page.locator('#faq-trigger');
    const target = page.locator('.faq-item, details').first();

    const initialHeight = await target.evaluate(el => el.getBoundingClientRect().height);

    // Trigger
    await trigger.click().catch(() => {});

    // Wait a short duration (middle of transition)
    await page.waitForTimeout(250);

    const midHeight = await target.evaluate(el => el.getBoundingClientRect().height);

    // Wait for end of transition
    await page.waitForTimeout(600);

    const finalHeight = await target.evaluate(el => el.getBoundingClientRect().height);

    // It should be animating
    expect(finalHeight).toBeGreaterThan(initialHeight);
    expect(midHeight).toBeGreaterThan(initialHeight);
    expect(midHeight).toBeLessThan(finalHeight);
  });

  test('should smoothly animate from intrinsic size to a fixed length', async ({ page }) => {
    // Look for a dismissible element or similar (starts auto, goes to 0)
    const trigger = page.locator('#alert-dismiss');
    const target = page.locator('#promo-alert');

    // Ensure they are visible
    await expect(trigger).toBeVisible();
    await expect(target).toBeVisible();

    const initialHeight = await target.evaluate(el => el.getBoundingClientRect().height);
    expect(initialHeight).toBeGreaterThan(0);

    // Trigger dismissal - force click if necessary
    await trigger.click({ force: true });
    
    // Wait a short duration (middle of transition)
    await page.waitForTimeout(300);
    const midHeight = await target.evaluate(el => el.getBoundingClientRect().height);

    // Wait for end of transition (0.5s transition + buffer)
    await page.waitForTimeout(700);
    const finalHeight = await target.evaluate(el => el.getBoundingClientRect().height);

    expect(midHeight, `Mid height (${midHeight}) should be less than initial (${initialHeight})`).toBeLessThan(initialHeight);
    expect(finalHeight, `Final height (${finalHeight}) should be less than mid (${midHeight})`).toBeLessThan(midHeight);
    expect(finalHeight).toBeLessThanOrEqual(5); 
  });

  test('should not use max-height/max-block-size magic number hacks anywhere in the stylesheets', async ({ page }) => {
    const usesMaxHeightHack = await page.evaluate(() => {
      return Array.from(document.styleSheets).some(sheet => {
        try {
          return Array.from(sheet.cssRules).some(rule => {
            if (rule instanceof CSSStyleRule) {
              const style = rule.style;
              const hasMagicNumber = (
                (style.maxBlockSize && style.maxBlockSize !== 'none' && parseInt(style.maxBlockSize) > 500) ||
                (style.maxHeight && style.maxHeight !== 'none' && parseInt(style.maxHeight) > 500)
              );
              return hasMagicNumber;
            }
            return false;
          });
        } catch (e) {
          return false;
        }
      });
    });

    expect(usesMaxHeightHack).toBe(false);
  });

});
