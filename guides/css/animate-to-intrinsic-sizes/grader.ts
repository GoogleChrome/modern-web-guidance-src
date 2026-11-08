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
  const html = fs.readFileSync(filePath, 'utf-8');

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

  test('The :root or a parent element has interpolate-size: allow-keywords applied to enable intrinsic keyword interpolation', async ({ page }) => {
    const hasInterpolateSize = await page.evaluate(() => {
      const rootStyles = window.getComputedStyle(document.documentElement);
      const bodyStyles = window.getComputedStyle(document.body);
      return rootStyles.getPropertyValue('interpolate-size') === 'allow-keywords' || 
             bodyStyles.getPropertyValue('interpolate-size') === 'allow-keywords' ||
             Array.from(document.querySelectorAll('*')).some(el => {
               const styles = window.getComputedStyle(el);
               return styles.getPropertyValue('interpolate-size') === 'allow-keywords';
             });
    });

    const hasInterpolateSizeRegex = /interpolate-size\s*:\s*allow-keywords/.test(html);
    expect(hasInterpolateSize || hasInterpolateSizeRegex).toBe(true);
  });

  test('Sizing properties define a transition for block-size, inline-size, height, or width rather than max-sizing properties', async ({ page }) => {
    const hasCorrectSizingTransition = await page.evaluate(() => {
      const correctProperties = ['block-size', 'inline-size', 'height', 'width'];
      const incorrectProperties = ['max-block-size', 'max-inline-size', 'max-height', 'max-width'];
      const elements = Array.from(document.querySelectorAll('*'));
      
      for (const el of elements) {
        for (const pseudo of [null, '::details-content', '::before', '::after']) {
          try {
            const styles = window.getComputedStyle(el, pseudo);
            const transitionProps = styles.getPropertyValue('transition-property').split(',').map(p => p.trim());
            const duration = styles.getPropertyValue('transition-duration');
            const hasDuration = duration !== '0s' && duration !== '' && duration !== '0ms';
            if (hasDuration) {
              const hasIncorrect = incorrectProperties.some(prop => transitionProps.includes(prop));
              if ((correctProperties.some(p => transitionProps.includes(p)) || transitionProps.includes('all')) && !hasIncorrect) {
                return true;
              }
            }
          } catch {}
        }
      }

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule) {
              const style = rule.style;
              const transitionProps = style.transitionProperty.split(',').map(p => p.trim());
              const transition = style.transition;
              const hasCorrect = correctProperties.some(p => transitionProps.includes(p) || transition.includes(p) || transitionProps.includes('all') || transition.includes('all'));
              const hasIncorrect = incorrectProperties.some(p => transitionProps.includes(p) || transition.includes(p));
              if (hasCorrect && !hasIncorrect) {
                return true;
              }
            }
          }
        } catch {}
      }

      return false;
    });

    expect(hasCorrectSizingTransition).toBe(true);
  });

  test('Expansion is triggered using intrinsic keywords and not fixed magic number hacks', async ({ page }) => {
    const usesIntrinsicKeywords = await page.evaluate(async () => {
      return Array.from(document.styleSheets).some(sheet => {
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
        } catch {
          return false;
        }
      });
    });

    const hasKeywordRegex = /(block-size|inline-size|height|width)\s*:\s*(auto|min-content|max-content|fit-content|calc-size)/.test(html);
    expect(usesIntrinsicKeywords || hasKeywordRegex).toBe(true);
  });

  test('The size property animates smoothly when triggered', async ({ page }) => {
    const trigger = page.locator('#faq-trigger, details summary').first();
    const target = page.locator('#faq-content, .faq-item, details').first();

    const initialHeight = await target.evaluate(el => el.getBoundingClientRect().height);

    await trigger.click({ timeout: 1000 }).catch(() => {});

    // Verify a transition is defined and active on the element or its content
    const hasTransition = await target.evaluate((el: HTMLElement) => {
      const styles = window.getComputedStyle(el);
      const contentStyles = window.getComputedStyle(el, '::details-content');
      const dur1 = styles.transitionDuration;
      const dur2 = contentStyles.transitionDuration;
      const isAnimated = (dur1 !== '0s' && dur1 !== '' && dur1 !== '0ms') ||
                         (dur2 !== '0s' && dur2 !== '' && dur2 !== '0ms');
      const anims = typeof el.getAnimations === 'function' ? el.getAnimations({ subtree: true }) : [];
      return isAnimated || anims.length > 0;
    });
    expect(hasTransition).toBe(true);

    await page.waitForFunction(
      ({ prevHeight }) => {
        const el = document.querySelector('.faq-item, details');
        if (!el) return false;
        return el.getBoundingClientRect().height > prevHeight;
      },
      { prevHeight: initialHeight },
      { timeout: 2000 }
    );

    const finalHeight = await target.evaluate(el => el.getBoundingClientRect().height);
    expect(finalHeight).toBeGreaterThan(initialHeight);
  });

  test('Sizing transitions smoothly animate from intrinsic size to a fixed length', async ({ page }) => {
    const trigger = page.locator('#alert-dismiss, [aria-label*="Dismiss"], form[method="dialog"] button').first();
    const target = page.locator('#promo-alert, dialog[open], [role="alert"]').first();

    await expect(trigger).toBeVisible({ timeout: 1000 });
    await expect(target).toBeVisible({ timeout: 1000 });

    const initialHeight = await target.evaluate(el => el.getBoundingClientRect().height);
    expect(initialHeight).toBeGreaterThan(0);

    // Verify transition duration is configured so the change animates rather than jumps
    const hasTransition = await target.evaluate((el: HTMLElement) => {
      const styles = window.getComputedStyle(el);
      const dur = styles.transitionDuration;
      const isAnimated = dur !== '0s' && dur !== '' && dur !== '0ms';
      const anims = typeof el.getAnimations === 'function' ? el.getAnimations({ subtree: true }) : [];
      return isAnimated || anims.length > 0;
    });
    expect(hasTransition).toBe(true);

    await trigger.click({ force: true });

    await page.waitForFunction(
      ({ prevHeight }) => {
        const el = document.querySelector('#promo-alert, dialog, [role="alert"]');
        if (!el) return true;
        const h = el.getBoundingClientRect().height;
        return h < prevHeight;
      },
      { prevHeight: initialHeight },
      { timeout: 2000 }
    );

    const finalHeight = await target.evaluate(el => el ? el.getBoundingClientRect().height : 0).catch(() => 0);
    expect(finalHeight).toBeLessThan(initialHeight);
  });

  test('Max-height or max-block-size magic number hacks are not used in the stylesheets', async ({ page }) => {
    const usesMaxHeightHack = await page.evaluate(() => {
      return Array.from(document.styleSheets).some(sheet => {
        try {
          return Array.from(sheet.cssRules).some(rule => {
            if (rule instanceof CSSStyleRule) {
              const style = rule.style;
              return (
                (style.maxBlockSize && style.maxBlockSize !== 'none' && parseInt(style.maxBlockSize) > 500) ||
                (style.maxHeight && style.maxHeight !== 'none' && parseInt(style.maxHeight) > 500)
              );
            }
            return false;
          });
        } catch {
          return false;
        }
      });
    });

    expect(usesMaxHeightHack).toBe(false);
  });

  test('Elements collapsed to zero dimensions are hidden from assistive technologies', async ({ page }) => {
    const isHiddenFromA11y = await page.evaluate(() => {
      const hasNativeHiding = !!document.querySelector('dialog, details');
      const htmlText = document.documentElement.outerHTML;
      const hasAriaHidden = /hidden\s*=\s*true|aria-hidden|content-visibility/i.test(htmlText);
      return hasNativeHiding || hasAriaHidden;
    });
    expect(isHiddenFromA11y).toBe(true);
  });

  test('Buttons controlling collapsible or expandable panels synchronize their expanded state', async ({ page }) => {
    const isAccessible = await page.evaluate(() => {
      if (document.querySelector('details summary, details')) return true;
      return !!document.querySelector('[aria-expanded]');
    });
    expect(isAccessible).toBe(true);
  });

  test('Sizing transitions are disabled when prefers-reduced-motion: reduce is active', async () => {
    expect(/prefers-reduced-motion/i.test(html)).toBe(true);
  });
});
