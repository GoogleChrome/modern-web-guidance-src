import { test, expect } from '@playwright/test';

const targetFile = process.env.TARGET_FILE;

test.beforeEach(async ({ page }) => {
  if (!targetFile) {
    throw new Error('TARGET_FILE environment variable is not set');
  }
  await page.goto(`file://${targetFile}`);
});

test('sets --mouse-x custom property when moving mouse over the card', async ({ page }) => {
  const container = page.locator('.product-card').first();
  const box = await container.boundingBox();
  if (box) {
    await page.mouse.move(box.x + 100, box.y + 150);
  }
  // Allow any pointermove handlers to execute
  await page.waitForTimeout(100);

  const mouseX = await container.evaluate((el) => {
    return window.getComputedStyle(el).getPropertyValue('--mouse-x').trim();
  });
  expect(mouseX).not.toBe('');
});

test('sets --mouse-y custom property when moving mouse over the card', async ({ page }) => {
  const container = page.locator('.product-card').first();
  const box = await container.boundingBox();
  if (box) {
    await page.mouse.move(box.x + 100, box.y + 150);
  }
  // Allow any pointermove handlers to execute
  await page.waitForTimeout(100);

  const mouseY = await container.evaluate((el) => {
    return window.getComputedStyle(el).getPropertyValue('--mouse-y').trim();
  });
  expect(mouseY).not.toBe('');
});

test('sets custom property --inner-size to 0px when card is not hovered', async ({ page }) => {
  const container = page.locator('.product-card').first();
  const innerSize = await container.evaluate((el) => {
    return window.getComputedStyle(el).getPropertyValue('--inner-size').trim();
  });
  expect(innerSize).toBe('0px');
});

test('sets custom property --outer-size to 0px when card is not hovered', async ({ page }) => {
  const container = page.locator('.product-card').first();
  const outerSize = await container.evaluate((el) => {
    return window.getComputedStyle(el).getPropertyValue('--outer-size').trim();
  });
  expect(outerSize).toBe('0px');
});

test('registers --inner-size property with @property', async ({ page }) => {
  const registered = await page.evaluate(() => {
    return Array.from(document.styleSheets).some((sheet) => {
      try {
        return Array.from(sheet.cssRules).some((rule) => {
          return (
            (rule.type === 16 || rule.constructor.name === 'CSSPropertyRule') &&
            (rule as any).name === '--inner-size'
          );
        });
      } catch (e) {
        return false;
      }
    });
  });
  expect(registered).toBe(true);
});

test('registers --outer-size property with @property', async ({ page }) => {
  const registered = await page.evaluate(() => {
    return Array.from(document.styleSheets).some((sheet) => {
      try {
        return Array.from(sheet.cssRules).some((rule) => {
          return (
            (rule.type === 16 || rule.constructor.name === 'CSSPropertyRule') &&
            (rule as any).name === '--outer-size'
          );
        });
      } catch (e) {
        return false;
      }
    });
  });
  expect(registered).toBe(true);
});

test('sets --inner-size to non-zero length when card is hovered', async ({ page }) => {
  const container = page.locator('.product-card').first();
  const box = await container.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  }
  await page.waitForTimeout(200);

  const innerSize = await container.evaluate((el) => {
    return window.getComputedStyle(el).getPropertyValue('--inner-size').trim();
  });
  const num = parseFloat(innerSize);
  expect(num).toBeGreaterThan(0);
});

test('sets --outer-size to non-zero length when card is hovered', async ({ page }) => {
  const container = page.locator('.product-card').first();
  const box = await container.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  }
  await page.waitForTimeout(200);

  const outerSize = await container.evaluate((el) => {
    return window.getComputedStyle(el).getPropertyValue('--outer-size').trim();
  });
  const num = parseFloat(outerSize);
  expect(num).toBeGreaterThan(0);
});

test('ensures revealed content is non-interactive with pointer-events: none', async ({ page }) => {
  const pointerEvents = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const style = window.getComputedStyle(el);
      const mask = style.maskImage || style.webkitMaskImage || '';
      if (mask.includes('radial-gradient')) {
        return style.pointerEvents;
      }
    }
    return 'not-found';
  });
  expect(pointerEvents).toBe('none');
});

test('ensures revealed content has a mask-image radial gradient from black to transparent', async ({ page }) => {
  const maskImage = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const style = window.getComputedStyle(el);
      const mask = style.maskImage || style.webkitMaskImage || '';
      if (mask.includes('radial-gradient')) {
        return mask;
      }
    }
    return '';
  });
  const hasRadial = maskImage.includes('radial-gradient');
  const hasBlack = maskImage.includes('black') || maskImage.includes('rgb(0, 0, 0)');
  const hasTransparent = maskImage.includes('transparent') || maskImage.includes('rgba(0, 0, 0, 0)');
  expect(hasRadial && hasBlack && hasTransparent).toBe(true);
});

test('determines gradient position using --mouse-x and --mouse-y properties', async ({ page }) => {
  const positionMatch = await page.evaluate(() => {
    const card = document.querySelector('.product-card') as HTMLElement;
    if (!card) return false;
    card.style.setProperty('--mouse-x', '25%');
    card.style.setProperty('--mouse-y', '75%');

    const all = document.querySelectorAll('*');
    for (const el of all) {
      const style = window.getComputedStyle(el);
      const mask = style.maskImage || style.webkitMaskImage || '';
      if (mask.includes('radial-gradient')) {
        return mask.includes('25% 75%');
      }
    }
    return false;
  });
  expect(positionMatch).toBe(true);
});

test('sets gradient stops via --inner-size and --outer-size properties', async ({ page }) => {
  const stopsMatch = await page.evaluate(() => {
    const card = document.querySelector('.product-card') as HTMLElement;
    if (!card) return false;

    // Find the reveal element
    let revealEl: HTMLElement | null = null;
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const style = window.getComputedStyle(el);
      const mask = style.maskImage || style.webkitMaskImage || '';
      if (mask.includes('radial-gradient')) {
        revealEl = el as HTMLElement;
        break;
      }
    }
    if (!revealEl) return false;

    // Temporarily disable transition on the reveal element to get immediate computed style
    const originalTransition = revealEl.style.transition;
    revealEl.style.transition = 'none';

    card.style.setProperty('--inner-size', '15px');
    card.style.setProperty('--outer-size', '35px');

    const styleAfter = window.getComputedStyle(revealEl);
    const maskAfter = styleAfter.maskImage || styleAfter.webkitMaskImage || '';

    // Restore transition
    revealEl.style.transition = originalTransition;

    return maskAfter.includes('15px') && maskAfter.includes('35px');
  });
  expect(stopsMatch).toBe(true);
});

test('uses immediate transition (duration 0) for reduced motion users', async ({ page }) => {
  const hasReducedMotionText = await page.evaluate(() => {
    const styles = Array.from(document.querySelectorAll('style'));
    return styles.some((style) => {
      const text = style.textContent || '';
      if (!text.includes('prefers-reduced-motion')) return false;
      const cleanText = text.replace(/\s+/g, '');
      return (
        cleanText.includes('transition:none') ||
        cleanText.includes('transition-duration:0') ||
        cleanText.includes('transition-duration:0s') ||
        cleanText.includes('transition:0') ||
        cleanText.includes('transition:0s') ||
        cleanText.includes('transition-duration:none')
      );
    });
  });
  expect(hasReducedMotionText).toBe(true);
});

test('ensures size properties have a non-zero transition duration by default', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const nonZeroTransition = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const style = window.getComputedStyle(el);
      const mask = style.maskImage || style.webkitMaskImage || '';
      if (mask.includes('radial-gradient')) {
        const duration = style.transitionDuration;
        const prop = style.transitionProperty;
        const hasNonZero = duration
          .split(',')
          .map((s) => parseFloat(s.trim()))
          .some((v) => v > 0);
        const targetsSize = prop.includes('--inner-size') || prop.includes('--outer-size') || prop === 'all';
        return hasNonZero && targetsSize;
      }
    }
    return false;
  });
  expect(nonZeroTransition).toBe(true);
});

test('ensures --mouse-x and --mouse-y have no transition on the revealed content', async ({ page }) => {
  const noMouseTransition = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const style = window.getComputedStyle(el);
      const mask = style.maskImage || style.webkitMaskImage || '';
      if (mask.includes('radial-gradient')) {
        const prop = style.transitionProperty;
        return !prop.includes('--mouse-x') && !prop.includes('--mouse-y');
      }
    }
    return false;
  });
  expect(noMouseTransition).toBe(true);
});

test('guarantees underlying content remains fully persistent and visible by default', async ({ page }) => {
  const underlyingContentVisible = await page.evaluate(() => {
    const card = document.querySelector('.product-card');
    if (!card) return false;
    const descendants = Array.from(card.querySelectorAll('*'));
    let hasUnderlyingVisibleContent = false;
    let hasHiddenUnderlyingContent = false;
    for (const el of descendants) {
      const style = window.getComputedStyle(el);
      const mask = style.maskImage || style.webkitMaskImage || '';
      const isMask = mask.includes('radial-gradient');
      if (!isMask && !el.classList.contains('spotlight') && el.id !== 'spotlight') {
        const isHidden = style.display === 'none' || style.visibility === 'hidden';
        if (isHidden) {
          hasHiddenUnderlyingContent = true;
        } else if (el.textContent && el.textContent.trim().length > 0) {
          hasUnderlyingVisibleContent = true;
        }
      }
    }
    return hasUnderlyingVisibleContent && !hasHiddenUnderlyingContent;
  });
  expect(underlyingContentVisible).toBe(true);
});
