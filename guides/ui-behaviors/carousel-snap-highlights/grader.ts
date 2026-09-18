import { test, expect } from '@playwright/test';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE || path.join(import.meta.dirname, 'demo.html');
const targetUrl = `file://${targetFile}`;

test('The carousel container has scroll-snap-type: inline mandatory (or x mandatory) applied', async ({ page }) => {
  await page.goto(targetUrl);
  const scrollSnapType = await page.$eval('.carousel', (el: any) => {
    return window.getComputedStyle(el).scrollSnapType;
  });
  const isMandatory = scrollSnapType.includes('mandatory') && 
                     (scrollSnapType.includes('x') || scrollSnapType.includes('inline'));
  expect(isMandatory).toBe(true);
});

test('Each carousel item has container-type: scroll-state applied', async ({ page }) => {
  await page.goto(targetUrl);
  const containerTypes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.carousel-item')).map(
      el => window.getComputedStyle(el).containerType
    );
  });
  expect(containerTypes.length).toBeGreaterThan(0);
  expect(containerTypes.every(t => t === 'scroll-state')).toBe(true);
});

test('The carousel container has overflow-x: auto or overflow-inline: auto', async ({ page }) => {
  await page.goto(targetUrl);
  const overflowX = await page.$eval('.carousel', (el: any) => {
    const inline = el.style.overflowX || el.style.overflowInline;
    if (inline === 'auto') return 'auto';
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = sheet.cssRules;
        if (!rules) continue;
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSStyleRule && rule.selectorText.includes('.carousel')) {
            const ox = rule.style.overflowX;
            const oi = rule.style.overflowInline;
            if (ox === 'auto' || oi === 'auto') return 'auto';
          }
        }
      } catch (e: any) {
        if (e && e.name !== 'SecurityError') {
          throw e;
        }
      }
    }
    return window.getComputedStyle(el).overflowX;
  });
  expect(overflowX).toBe('auto');
});

test('The .card element inside a snapped .carousel-item has a blue background (rgb(0, 123, 255))', async ({ page }) => {
  await page.goto(targetUrl);
  const snappedCard = page.locator('.carousel-item:nth-child(1) .card');
  await expect(snappedCard).toHaveCSS('background-color', 'rgb(0, 123, 255)');
});

test('The .card element inside a snapped .carousel-item is scaled up to 1.15', async ({ page }) => {
  await page.goto(targetUrl);
  const card = page.locator('.carousel-item:nth-child(1) .card');
  await expect.poll(async () => {
    return await card.evaluate((el: any) => {
      const style = window.getComputedStyle(el);
      const scaleProp = style.scale;
      if (scaleProp && scaleProp !== 'none') {
        return parseFloat(scaleProp);
      }
      const transform = style.transform;
      if (transform && transform !== 'none') {
        const matrix = transform.match(/^matrix\(([^,]+),/);
        if (matrix) {
          return parseFloat(matrix[1]);
        }
      }
      return 1.0;
    });
  }).toBeCloseTo(1.15, 2);
});

test('The .card element inside a snapped .carousel-item has a box shadow applied', async ({ page }) => {
  await page.goto(targetUrl);
  const card = page.locator('.carousel-item:nth-child(1) .card');
  await expect.poll(async () => {
    return await card.evaluate((el: any) => {
      const shadow = window.getComputedStyle(el).boxShadow;
      return shadow !== 'none' && shadow.trim() !== '';
    });
  }).toBe(true);
});

test('The highlight effects (scale, background, shadow) are NOT applied when the user prefers reduced motion', async ({ page }) => {
  // First get normal condition highlight state
  await page.goto(targetUrl);
  const firstCard = page.locator('.carousel-item:nth-child(1) .card');
  await expect(firstCard).toHaveCSS('background-color', 'rgb(0, 123, 255)');

  const normalStats = await firstCard.evaluate((el: any) => {
    const style = window.getComputedStyle(el);
    let scaleVal = 1.0;
    if (style.scale && style.scale !== 'none') {
      scaleVal = parseFloat(style.scale);
    } else if (style.transform && style.transform !== 'none') {
      const matrix = style.transform.match(/^matrix\(([^,]+),/);
      if (matrix) scaleVal = parseFloat(matrix[1]);
    }
    return {
      scale: scaleVal,
      backgroundColor: style.backgroundColor,
    };
  });

  // Now emulate reduced motion
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(targetUrl);
  await page.waitForTimeout(600);

  const reducedStats = await firstCard.evaluate((el: any) => {
    const style = window.getComputedStyle(el);
    let scaleVal = 1.0;
    if (style.scale && style.scale !== 'none') {
      scaleVal = parseFloat(style.scale);
    } else if (style.transform && style.transform !== 'none') {
      const matrix = style.transform.match(/^matrix\(([^,]+),/);
      if (matrix) scaleVal = parseFloat(matrix[1]);
    }
    return {
      scale: scaleVal,
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
    };
  });

  const normalIsHighlighted = normalStats.scale > 1.1 && normalStats.backgroundColor === 'rgb(0, 123, 255)';
  const reducedIsNotHighlighted = reducedStats.scale < 1.05 && 
                                  reducedStats.backgroundColor !== 'rgb(0, 123, 255)' &&
                                  (reducedStats.boxShadow === 'none' || !reducedStats.boxShadow.includes('rgb(0, 123, 255)'));

  expect(normalIsHighlighted && reducedIsNotHighlighted).toBe(true);
});

test("When the carousel is scrolled so a different item is snapped, the highlight styles move to the new snapped item's card", async ({ page }) => {
  await page.goto(targetUrl);
  await page.waitForTimeout(300);

  await page.$eval('.carousel', (el: any) => {
    const second = el.querySelectorAll('.carousel-item')[1] as HTMLElement;
    el.scrollLeft = second.offsetLeft - (el.clientWidth / 2) + (second.clientWidth / 2);
  });

  await page.waitForTimeout(600);

  const secondCardColor = await page.$eval('.carousel-item:nth-child(2) .card', (el: any) => {
    return window.getComputedStyle(el).backgroundColor;
  });

  expect(secondCardColor).toBe('rgb(0, 123, 255)');
});

test('Non-snapped items remain in their default state (grey background, no scale)', async ({ page }) => {
  await page.goto(targetUrl);
  const firstCard = page.locator('.carousel-item:nth-child(1) .card');
  await expect(firstCard).toHaveCSS('background-color', 'rgb(0, 123, 255)');

  const firstCardStats = await firstCard.evaluate((el: any) => {
    const style = window.getComputedStyle(el);
    let scaleVal = 1.0;
    if (style.scale && style.scale !== 'none') {
      scaleVal = parseFloat(style.scale);
    } else if (style.transform && style.transform !== 'none') {
      const matrix = style.transform.match(/^matrix\(([^,]+),/);
      if (matrix) scaleVal = parseFloat(matrix[1]);
    }
    return {
      scale: scaleVal,
      backgroundColor: style.backgroundColor,
    };
  });

  const secondCard = page.locator('.carousel-item:nth-child(2) .card');
  const secondCardStats = await secondCard.evaluate((el: any) => {
    const style = window.getComputedStyle(el);
    let scaleVal = 1.0;
    if (style.scale && style.scale !== 'none') {
      scaleVal = parseFloat(style.scale);
    } else if (style.transform && style.transform !== 'none') {
      const matrix = style.transform.match(/^matrix\(([^,]+),/);
      if (matrix) scaleVal = parseFloat(matrix[1]);
    }
    return {
      scale: scaleVal,
      backgroundColor: style.backgroundColor,
    };
  });

  const firstIsHighlighted = firstCardStats.scale > 1.1 && firstCardStats.backgroundColor === 'rgb(0, 123, 255)';
  const secondIsDefault = secondCardStats.scale < 1.05 && secondCardStats.backgroundColor === 'rgb(224, 224, 224)';

  expect(firstIsHighlighted && secondIsDefault).toBe(true);
});

test('If scroll-state is not supported, the .is-snapped class is correctly toggled by JavaScript', async ({ page }) => {
  await page.addInitScript(() => {
    const originalSupports = CSS.supports;
    Object.defineProperty(CSS, 'supports', {
      value: (property: string, value?: string) => {
        if (property === 'container-type' && value === 'scroll-state') {
          return false;
        }
        if (property === 'container-type: scroll-state') {
          return false;
        }
        if (value === undefined) {
          return originalSupports(property);
        }
        return originalSupports(property, value);
      }
    });
  });

  await page.goto(targetUrl);
  await page.waitForTimeout(300);

  const initialClassState = await page.evaluate(() => {
    const items = document.querySelectorAll('.carousel-item');
    return {
      firstHasClass: items[0]?.classList.contains('is-snapped') || false,
      secondHasClass: items[1]?.classList.contains('is-snapped') || false,
    };
  });

  await page.$eval('.carousel', (el: any) => {
    const second = el.querySelectorAll('.carousel-item')[1] as HTMLElement;
    el.scrollLeft = second.offsetLeft - (el.clientWidth / 2) + (second.clientWidth / 2);
  });

  await page.waitForTimeout(600);

  const scrolledClassState = await page.evaluate(() => {
    const items = document.querySelectorAll('.carousel-item');
    return {
      firstHasClass: items[0]?.classList.contains('is-snapped') || false,
      secondHasClass: items[1]?.classList.contains('is-snapped') || false,
    };
  });

  const correctToggling = initialClassState.firstHasClass && !initialClassState.secondHasClass &&
                          !scrolledClassState.firstHasClass && scrolledClassState.secondHasClass;

  expect(correctToggling).toBe(true);
});
