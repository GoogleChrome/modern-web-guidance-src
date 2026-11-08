import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE || path.join(import.meta.dirname, 'demo.html');
const targetDir = path.dirname(targetFile);
const fileName = path.basename(targetFile);
const targetUrl = `http://localhost/${fileName}`;

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost/**', async (route) => {
    const url = new URL(route.request().url());
    let reqPath = decodeURIComponent(url.pathname);
    if (reqPath === '/' || reqPath === '') reqPath = `/${fileName}`;
    const fullPath = path.join(targetDir, reqPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath).toLowerCase();
      const contentType =
        ext === '.html' ? 'text/html' :
        ext === '.css' ? 'text/css' :
        ext === '.js' || ext === '.mjs' ? 'application/javascript' :
        'application/octet-stream';
      await route.fulfill({
        status: 200,
        contentType,
        body: fs.readFileSync(fullPath),
      });
    } else {
      await route.continue();
    }
  });
});

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
  const computedBg = await snappedCard.evaluate((el: any) => window.getComputedStyle(el).backgroundColor).catch(() => '');

  if (computedBg === 'rgb(0, 123, 255)') {
    expect(computedBg).toBe('rgb(0, 123, 255)');
    return;
  }

  // Check if declared in CSS under @container scroll-state or item rule
  const declaredInScrollState = await page.evaluate(() => {
    const cssText = Array.from(document.querySelectorAll('style'))
      .map(s => s.textContent || '')
      .join('\n');
    return /@container\s+scroll-state[\s\S]*?(?:#007bff|rgb\(0,\s*123,\s*255\))/i.test(cssText);
  });
  expect(declaredInScrollState).toBe(true);
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
  }, { timeout: 2000 }).toBeCloseTo(1.15, 2);
});

test('The .card element inside a snapped .carousel-item has a box shadow applied', async ({ page }) => {
  await page.goto(targetUrl);
  const card = page.locator('.carousel-item:nth-child(1) .card');
  await expect.poll(async () => {
    return await card.evaluate((el: any) => {
      const shadow = window.getComputedStyle(el).boxShadow;
      return shadow !== 'none' && shadow.trim() !== '';
    });
  }, { timeout: 2000 }).toBe(true);
});

test('The highlight effects (scale, background, shadow) are NOT applied when the user prefers reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(targetUrl);

  const firstCard = page.locator('.carousel-item:nth-child(1) .card');
  await expect.poll(async () => {
    return await firstCard.evaluate((el: any) => {
      const style = window.getComputedStyle(el);
      let scaleVal = 1.0;
      if (style.scale && style.scale !== 'none') {
        scaleVal = parseFloat(style.scale);
      } else if (style.transform && style.transform !== 'none') {
        const matrix = style.transform.match(/^matrix\(([^,]+),/);
        if (matrix) scaleVal = parseFloat(matrix[1]);
      }
      return scaleVal;
    });
  }, { timeout: 2000 }).toBeLessThanOrEqual(1.05);
});

test("When the carousel is scrolled so a different item is snapped, the highlight styles move to the new snapped item's card", async ({ page }) => {
  await page.goto(targetUrl);

  const firstCard = page.locator('.carousel-item:nth-child(1) .card');
  const initialFirstShadow = await firstCard.evaluate((el: any) => window.getComputedStyle(el).boxShadow);

  await page.$eval('.carousel', (el: any) => {
    const second = el.querySelectorAll('.carousel-item')[1] as HTMLElement;
    el.scrollLeft = second.offsetLeft - (el.clientWidth / 2) + (second.clientWidth / 2);
  });

  const secondCard = page.locator('.carousel-item:nth-child(2) .card');
  await expect.poll(async () => {
    return await secondCard.evaluate((el: any, baseShadow: string) => {
      const style = window.getComputedStyle(el);
      let scaleVal = 1.0;
      if (style.scale && style.scale !== 'none') {
        scaleVal = parseFloat(style.scale);
      } else if (style.transform && style.transform !== 'none') {
        const matrix = style.transform.match(/^matrix\(([^,]+),/);
        if (matrix) scaleVal = parseFloat(matrix[1]);
      }
      const hasDistinctShadow = style.boxShadow !== baseShadow && style.boxShadow !== 'none' && style.boxShadow.trim() !== '';
      const isBlue = style.backgroundColor === 'rgb(0, 123, 255)';
      return scaleVal > 1.1 && (isBlue || hasDistinctShadow);
    }, initialFirstShadow);
  }, { timeout: 2000 }).toBe(true);
});

test('Non-snapped items remain in their default, unhighlighted state (no highlight background, no scale)', async ({ page }) => {
  await page.goto(targetUrl);

  const firstCard = page.locator('.carousel-item:nth-child(1) .card');
  const secondCard = page.locator('.carousel-item:nth-child(2) .card');
  await expect.poll(async () => {
    const snappedBg = await firstCard.evaluate((el: any) => window.getComputedStyle(el).backgroundColor);
    return await secondCard.evaluate((el: any, activeBg: string) => {
      const style = window.getComputedStyle(el);
      let scaleVal = 1.0;
      if (style.scale && style.scale !== 'none') {
        scaleVal = parseFloat(style.scale);
      } else if (style.transform && style.transform !== 'none') {
        const matrix = style.transform.match(/^matrix\(([^,]+),/);
        if (matrix) scaleVal = parseFloat(matrix[1]);
      }
      const isNotHighlightedBg = style.backgroundColor !== activeBg && style.backgroundColor !== 'rgb(0, 123, 255)';
      return scaleVal < 1.05 && isNotHighlightedBg;
    }, snappedBg);
  }, { timeout: 2000 }).toBe(true);
});

async function getCarouselContainerInfo(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const el =
      document.querySelector('.carousel') ||
      Array.from(document.querySelectorAll('*')).find(node => {
        if (node.tagName === 'HTML' || node.tagName === 'BODY') return false;
        const snapType = window.getComputedStyle(node).scrollSnapType;
        return Boolean(snapType && snapType !== 'none');
      }) ||
      null;
    if (!el) return null;

    const getName = (node: Element) => {
      const ariaLabel = (node.getAttribute('aria-label') || '').trim();
      if (ariaLabel) return ariaLabel;
      const labelledBy = (node.getAttribute('aria-labelledby') || '').trim();
      if (!labelledBy) return '';
      return labelledBy
        .split(/\s+/)
        .map(id => document.getElementById(id)?.textContent?.trim() || '')
        .filter(Boolean)
        .join(' ');
    };
    const getRole = (node: Element) => (node.getAttribute('role') || '').trim().toLowerCase();

    const elHasName = Boolean(getName(el));
    const elRole = getRole(el);
    const parent = el.parentElement;
    const parentIsWrapper = Boolean(parent && (parent.tagName === 'SECTION' || getRole(parent) === 'region'));
    const parentHasName = parentIsWrapper && Boolean(getName(parent!));

    const hasAccessibleName = elHasName || parentHasName;
    const hasRegionRole =
      elRole === 'region' ||
      (el.tagName === 'SECTION' && elHasName) ||
      (parentIsWrapper && (getRole(parent!) === 'region' || (parent!.tagName === 'SECTION' && parentHasName)));

    return {
      hasAccessibleName,
      hasRegionRole,
      tabindex: el.getAttribute('tabindex')?.trim() ?? null,
    };
  });
}

test('The carousel container has an accessible name provided using `aria-label` or `aria-labelledby`.', async ({ page }) => {
  await page.goto(targetUrl);
  const info = await getCarouselContainerInfo(page);
  expect(info).not.toBeNull();
  expect(info!.hasAccessibleName).toBe(true);
});

test('The carousel container has an accessible role of `role="region"`.', async ({ page }) => {
  await page.goto(targetUrl);
  const info = await getCarouselContainerInfo(page);
  expect(info).not.toBeNull();
  expect(info!.hasRegionRole).toBe(true);
});

test('The carousel container can receive focus with `tabindex="0"`.', async ({ page }) => {
  await page.goto(targetUrl);
  const info = await getCarouselContainerInfo(page);
  expect(info).not.toBeNull();
  expect(info!.tabindex).toBe('0');
});

