/// <reference types="node" />
import { test, expect, Page } from '@playwright/test';
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

test.describe(`Interactive Content Reveal Expectations: ${demoName}`, () => {

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

  const getRevealElement = async (page: Page) => {
    return await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll('*')).find(el => {
        const style = window.getComputedStyle(el);
        const mask = style.maskImage || style.webkitMaskImage;
        return mask && mask.includes('radial-gradient');
      });
    });
  };

  test('An element should use mask-image with a radial gradient', async ({ page }) => {
    const elHandle = await getRevealElement(page);
    const el = elHandle.asElement();
    expect(el).not.toBeNull();
  });

  test('Moving the mouse over the container should update --mouse-x and --mouse-y', async ({ page }) => {
    const elHandle = await getRevealElement(page);
    const el = elHandle.asElement();
    expect(el).not.toBeNull();

    const getVars = () => page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      for (const el of allElements) {
        const style = window.getComputedStyle(el);
        const x = style.getPropertyValue('--mouse-x').trim();
        const y = style.getPropertyValue('--mouse-y').trim();
        if (x || y) return { x, y };
      }
      return { x: '', y: '' };
    });

    await page.mouse.move(10, 10);
    const varsBefore = await getVars();
    
    await page.mouse.move(200, 200);
    const varsAfter = await getVars();

    expect(varsAfter.x).not.toBe(varsBefore.x);
    expect(varsAfter.y).not.toBe(varsBefore.y);
  });

  test('--inner-size and --outer-size should be 0px when not hovered', async ({ page }) => {
    const elHandle = await getRevealElement(page);
    const el = elHandle.asElement();
    expect(el).not.toBeNull();

    const sizes = await page.evaluate((element) => {
      const style = window.getComputedStyle(element as HTMLElement);
      return {
        inner: style.getPropertyValue('--inner-size').trim(),
        outer: style.getPropertyValue('--outer-size').trim()
      };
    }, el);

    expect(sizes.inner).toBe('0px');
    expect(sizes.outer).toBe('0px');
  });

  test('--inner-size and --outer-size should be non-zero when hovered', async ({ page }) => {
    const elHandle = await getRevealElement(page);
    const el = elHandle.asElement();
    expect(el).not.toBeNull();

    const box = await (el as any).boundingBox();
    if (box) {
        // Move to the element
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    } else {
        await (el as any).hover({ force: true });
    }

    // Wait for transition
    await page.waitForTimeout(400);

    const sizes = await page.evaluate((element) => {
      const style = window.getComputedStyle(element as HTMLElement);
      return {
        inner: style.getPropertyValue('--inner-size').trim(),
        outer: style.getPropertyValue('--outer-size').trim()
      };
    }, el);

    expect(parseFloat(sizes.inner || '0')).toBeGreaterThan(0);
    expect(parseFloat(sizes.outer || '0')).toBeGreaterThan(0);
  });

  test('--inner-size and --outer-size should be registered with @property', async ({ page }) => {
    const isRegistered = await page.evaluate(() => {
      const rules = Array.from(document.styleSheets).flatMap(s => {
        try { return Array.from(s.cssRules); } catch(e) { return []; }
      });
      return rules.some(r => (r.constructor.name === 'CSSPropertyRule' || r.type === 15) && (r as any).name === '--inner-size') &&
             rules.some(r => (r.constructor.name === 'CSSPropertyRule' || r.type === 15) && (r as any).name === '--outer-size');
    });
    expect(isRegistered).toBe(true);
  });

  test('The reveal layer should have pointer-events: none', async ({ page }) => {
    const elHandle = await getRevealElement(page);
    const el = elHandle.asElement();
    expect(el).not.toBeNull();

    const pointerEvents = await page.evaluate((element) => {
      return window.getComputedStyle(element as HTMLElement).pointerEvents;
    }, el);
    expect(pointerEvents).toBe('none');
  });

  test('--inner-size and --outer-size should have a non-zero transition duration', async ({ page }) => {
    const elHandle = await getRevealElement(page);
    const el = elHandle.asElement();
    expect(el).not.toBeNull();

    const hasTransition = await page.evaluate((element) => {
      const style = window.getComputedStyle(element as HTMLElement);
      const props = style.transitionProperty.split(',').map(s => s.trim());
      const durations = style.transitionDuration.split(',').map(s => s.trim());
      
      const isNonZero = (dur: string) => parseFloat(dur) > 0;

      const innerIdx = props.indexOf('--inner-size');
      if (innerIdx !== -1 && isNonZero(durations[innerIdx])) return true;

      const outerIdx = props.indexOf('--outer-size');
      if (outerIdx !== -1 && isNonZero(durations[outerIdx])) return true;

      const allIdx = props.indexOf('all');
      if (allIdx !== -1 && isNonZero(durations[allIdx])) return true;

      return false;
    }, el);
    expect(hasTransition).toBe(true);
  });

  test('--mouse-x and --mouse-y should not have a transition', async ({ page }) => {
    const elHandle = await getRevealElement(page);
    const el = elHandle.asElement();
    expect(el).not.toBeNull();

    const hasPositionTransition = await page.evaluate((element) => {
      const style = window.getComputedStyle(element as HTMLElement);
      const props = style.transitionProperty.split(',').map(s => s.trim());
      const durations = style.transitionDuration.split(',').map(s => s.trim());
      
      const isNonZero = (dur: string) => parseFloat(dur) > 0;

      const xIdx = props.indexOf('--mouse-x');
      if (xIdx !== -1 && isNonZero(durations[xIdx])) return true;

      const yIdx = props.indexOf('--mouse-y');
      if (yIdx !== -1 && isNonZero(durations[yIdx])) return true;

      return false;
    }, el);
    expect(hasPositionTransition).toBe(false);
  });

  test('The radial gradient should use the custom properties for position and stops', async ({ page }) => {
    const elHandle = await getRevealElement(page);
    const el = elHandle.asElement();
    expect(el).not.toBeNull();

    const getMask = () => page.evaluate((element) => {
      const style = window.getComputedStyle(element as HTMLElement);
      return style.maskImage || style.webkitMaskImage;
    }, el);

    const maskBefore = await getMask();
    
    await page.evaluate((element) => {
      (element as HTMLElement).style.setProperty('--mouse-x', '35%');
      (element as HTMLElement).style.setProperty('--mouse-y', '45%');
    }, el);
    
    const maskAfter = await getMask();
    expect(maskAfter).not.toBe(maskBefore);
  });

  test('Respects prefers-reduced-motion: reduce', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(demoUrl); 

    const elHandle = await getRevealElement(page);
    const el = elHandle.asElement();
    expect(el).not.toBeNull();

    const hasMediaRule = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules);
          for (const rule of rules) {
            if ((rule.constructor.name === 'CSSMediaRule' || rule.type === 4) && (rule as CSSMediaRule).conditionText.includes('prefers-reduced-motion')) {
              const innerRules = Array.from((rule as CSSMediaRule).cssRules);
              return innerRules.length > 0;
            }
          }
        } catch (e) {}
      }
      return false;
    });

    const isImmediate = await page.evaluate((element) => {
      const style = window.getComputedStyle(element as HTMLElement);
      const durations = style.transitionDuration.split(',').map(d => parseFloat(d));
      return durations.every(d => d === 0);
    }, el);

    expect(hasMediaRule || isImmediate).toBe(true);
  });

});
