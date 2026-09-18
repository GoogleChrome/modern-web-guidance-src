import { test, expect } from '@playwright/test';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is not defined');
}
const url = `file://${path.resolve(targetFile)}`;

test.describe('Scroll Snap Realtime Feedback', () => {

  test('The number of .thumbnail elements must equal the number of .gallery-item elements', async ({ page }) => {
    await page.goto(url);
    const thumbnailCount = await page.locator('.thumbnail').count();
    const galleryItemCount = await page.locator('.gallery-item').count();
    expect(thumbnailCount).toBeGreaterThan(0);
    expect(thumbnailCount).toBe(galleryItemCount);
  });

  test('Each thumbnail is rendered as a button element with aria-current="true" applied to the currently-active thumbnail', async ({ page }) => {
    await page.goto(url);
    const results = await page.evaluate(() => {
      const thumbnails = Array.from(document.querySelectorAll('.thumbnail'));
      if (thumbnails.length === 0) return { error: 'No thumbnails found' };
      
      const allAreButtons = thumbnails.every(el => el.tagName === 'BUTTON');
      if (!allAreButtons) return { error: 'Not all thumbnails are BUTTON elements' };

      const activeThumbnails = thumbnails.filter(el => el.classList.contains('active'));
      const ariaCurrentTrueThumbnails = thumbnails.filter(el => el.getAttribute('aria-current') === 'true');

      // Currently-active thumbnail must have aria-current="true"
      const activeIsAriaCurrent = activeThumbnails.length > 0 && 
        activeThumbnails.every(el => el.getAttribute('aria-current') === 'true') &&
        ariaCurrentTrueThumbnails.every(el => el.classList.contains('active')) &&
        ariaCurrentTrueThumbnails.length === 1;

      if (!activeIsAriaCurrent) {
        return { error: 'Active thumbnail does not match aria-current="true" or there is not exactly one active thumbnail' };
      }
      return { success: true };
    });

    expect(results).toEqual({ success: true });
  });

  test('The gallery contains child elements with class .gallery-item, one per photo', async ({ page }) => {
    await page.goto(url);
    const isValid = await page.evaluate(() => {
      const gallery = document.getElementById('gallery');
      if (!gallery) return false;
      const items = Array.from(gallery.children);
      if (items.length === 0) return false;
      const allHaveClass = items.every(item => item.classList.contains('gallery-item'));
      const thumbnailCount = document.querySelectorAll('.thumbnail').length;
      return allHaveClass && items.length === thumbnailCount;
    });
    expect(isValid).toBe(true);
  });

  test('The Nth .thumbnail element corresponds to the Nth .gallery-item element', async ({ page }) => {
    await page.goto(url);
    
    const result = await page.evaluate(async () => {
      const gallery = document.getElementById('gallery') as HTMLElement;
      const thumbnails = Array.from(document.querySelectorAll('.thumbnail')) as HTMLElement[];
      const items = Array.from(document.querySelectorAll('.gallery-item')) as HTMLElement[];
      
      if (thumbnails.length < 3 || items.length < 3 || !gallery) {
        return { error: 'Insufficient elements or missing gallery' };
      }
      
      // Click third thumbnail (index 2)
      thumbnails[2].click();
      
      // Wait for smooth scroll to finish (up to 1000ms)
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const galleryCenter = gallery.scrollLeft + gallery.clientWidth / 2;
      let closestIndex = -1;
      let minDistance = Infinity;
      items.forEach((item, index) => {
        const itemCenter = item.offsetLeft + item.offsetWidth / 2;
        const distance = Math.abs(galleryCenter - itemCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      });
      
      return { closestIndex };
    });
    
    expect(result).toEqual({ closestIndex: 2 });
  });

  test('The JavaScript implementation uses a feature detection check to determine if scrollsnapchanging is supported', async ({ page }) => {
    // Scenario A: Normal load (force native feature supported)
    await page.addInitScript(() => {
      if (!('onscrollsnapchanging' in Element.prototype)) {
        Object.defineProperty(Element.prototype, 'onscrollsnapchanging', {
          value: null,
          writable: true,
          configurable: true
        });
      }
    });
    await page.goto(url);

    const supportedResult = await page.evaluate(() => {
      const gallery = document.getElementById('gallery');
      const thumbnails = Array.from(document.querySelectorAll('.thumbnail'));
      const items = Array.from(document.querySelectorAll('.gallery-item'));
      if (!gallery || thumbnails.length < 2 || items.length < 2) return null;

      // Clear any existing pending classes
      thumbnails.forEach(t => t.classList.remove('pending'));

      // Dispatch a custom scrollsnapchanging event
      const event = new Event('scrollsnapchanging') as any;
      event.snapTargetInline = items[1];
      gallery.dispatchEvent(event);

      return thumbnails[1].classList.contains('pending');
    });

    // Scenario B: Load with onscrollsnapchanging deleted (feature unsupported)
    const context2 = await page.context().browser()!.newContext();
    const page2 = await context2.newPage();
    await page2.addInitScript(() => {
      delete (Element.prototype as any).onscrollsnapchanging;
      if ('onscrollsnapchanging' in window) {
        delete (window as any).onscrollsnapchanging;
      }
    });
    await page2.goto(url);

    const unsupportedResult = await page2.evaluate(() => {
      const gallery = document.getElementById('gallery');
      const thumbnails = Array.from(document.querySelectorAll('.thumbnail'));
      const items = Array.from(document.querySelectorAll('.gallery-item'));
      if (!gallery || thumbnails.length < 2 || items.length < 2) return null;

      // Clear any existing pending classes
      thumbnails.forEach(t => t.classList.remove('pending'));

      // Dispatch custom scrollsnapchanging event
      const event = new Event('scrollsnapchanging') as any;
      event.snapTargetInline = items[1];
      gallery.dispatchEvent(event);

      return thumbnails[1].classList.contains('pending');
    });

    await page2.close();
    await context2.close();

    expect({ supportedResult, unsupportedResult }).toEqual({
      supportedResult: true,
      unsupportedResult: false
    });
  });

  test('The element with class .thumbnail corresponding to the pending snap target receives the class pending during scroll', async ({ page }) => {
    // Force native feature support
    await page.addInitScript(() => {
      if (!('onscrollsnapchanging' in Element.prototype)) {
        Object.defineProperty(Element.prototype, 'onscrollsnapchanging', {
          value: null,
          writable: true,
          configurable: true
        });
      }
    });
    await page.goto(url);

    const hasPending = await page.evaluate(() => {
      const gallery = document.getElementById('gallery');
      const thumbnails = Array.from(document.querySelectorAll('.thumbnail'));
      const items = Array.from(document.querySelectorAll('.gallery-item'));
      if (!gallery || thumbnails.length < 2 || items.length < 2) return false;

      // Dispatch scrollsnapchanging event targeting item 1
      const event = new Event('scrollsnapchanging') as any;
      event.snapTargetInline = items[1];
      gallery.dispatchEvent(event);

      return thumbnails[1].classList.contains('pending') && !thumbnails[0].classList.contains('pending');
    });

    expect(hasPending).toBe(true);
  });

  test('The thumbnail corresponding to the final snap target receives active and does not have pending after scroll completes', async ({ page }) => {
    // Force native feature support
    await page.addInitScript(() => {
      if (!('onscrollsnapchanging' in Element.prototype)) {
        Object.defineProperty(Element.prototype, 'onscrollsnapchanging', {
          value: null,
          writable: true,
          configurable: true
        });
      }
    });
    await page.goto(url);

    const result = await page.evaluate(() => {
      const gallery = document.getElementById('gallery');
      const thumbnails = Array.from(document.querySelectorAll('.thumbnail'));
      const items = Array.from(document.querySelectorAll('.gallery-item'));
      if (!gallery || thumbnails.length < 2 || items.length < 2) return null;

      // Simulate state: set index 1 to pending
      thumbnails.forEach(t => {
        t.classList.remove('active', 'pending');
        t.removeAttribute('aria-current');
      });
      thumbnails[1].classList.add('pending');

      // Dispatch scrollsnapchange event targeting item 1
      const event = new Event('scrollsnapchange') as any;
      event.snapTargetInline = items[1];
      gallery.dispatchEvent(event);

      const index1IsActive = thumbnails[1].classList.contains('active');
      const index1IsNotPending = !thumbnails[1].classList.contains('pending');
      const index1IsAriaCurrent = thumbnails[1].getAttribute('aria-current') === 'true';

      const othersAreClean = thumbnails.every((t, i) => {
        if (i === 1) return true;
        return !t.classList.contains('active') && !t.classList.contains('pending') && t.getAttribute('aria-current') !== 'true';
      });

      return index1IsActive && index1IsNotPending && index1IsAriaCurrent && othersAreClean;
    });

    expect(result).toBe(true);
  });

  test('When scrollsnapchanging is unsupported, the fallback toggles pending on the thumbnail corresponding to the gallery-item nearest the viewport center during scrolling', async ({ page }) => {
    // Disable native scrollsnapchanging support
    await page.addInitScript(() => {
      delete (Element.prototype as any).onscrollsnapchanging;
      if ('onscrollsnapchanging' in window) {
        delete (window as any).onscrollsnapchanging;
      }
    });

    await page.goto(url);

    const result = await page.evaluate(async () => {
      const gallery = document.getElementById('gallery') as HTMLElement;
      const thumbnails = Array.from(document.querySelectorAll('.thumbnail')) as HTMLElement[];
      if (!gallery || thumbnails.length < 2) return null;

      // Clear any existing classes to start clean
      thumbnails.forEach(t => t.classList.remove('pending'));

      // Scroll gallery to be closer to the second item (index 1)
      gallery.scrollLeft = gallery.clientWidth * 0.75; 
      
      // Dispatch scroll event programmatically to ensure the listener is triggered
      gallery.dispatchEvent(new Event('scroll'));

      // Wait a couple of animation frames for requestAnimationFrame to execute
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const index1IsPending = thumbnails[1].classList.contains('pending');
      const index0IsNotPending = !thumbnails[0].classList.contains('pending');

      return index1IsPending && index0IsNotPending;
    });

    expect(result).toBe(true);
  });

  test('When scrollsnapchanging is unsupported, the fallback promotes the thumbnail to active when scrolling settles', async ({ page }) => {
    // Disable native scrollsnapchanging support
    await page.addInitScript(() => {
      delete (Element.prototype as any).onscrollsnapchanging;
      if ('onscrollsnapchanging' in window) {
        delete (window as any).onscrollsnapchanging;
      }
    });

    await page.goto(url);

    const result = await page.evaluate(async () => {
      const gallery = document.getElementById('gallery') as HTMLElement;
      const thumbnails = Array.from(document.querySelectorAll('.thumbnail')) as HTMLElement[];
      if (!gallery || thumbnails.length < 2) return null;

      // Clear active/pending on all thumbnails
      thumbnails.forEach(t => {
        t.classList.remove('pending', 'active');
        t.removeAttribute('aria-current');
      });

      // Scroll to the second item
      gallery.scrollLeft = gallery.clientWidth;

      // Dispatch scroll and scrollend events
      gallery.dispatchEvent(new Event('scroll'));
      
      // Wait for the settling timeout/scrollend handler to finish (at least 100ms for demo.html timeout)
      await new Promise(resolve => setTimeout(resolve, 250));

      // Dispatch scrollend to be absolutely sure the scrollend listener runs
      gallery.dispatchEvent(new Event('scrollend'));

      // Wait another short moment
      await new Promise(resolve => setTimeout(resolve, 50));

      // Thumbnail 1 should now be active with aria-current="true"
      const index1IsActive = thumbnails[1].classList.contains('active');
      const index1IsNotPending = !thumbnails[1].classList.contains('pending');
      const index1IsAriaCurrent = thumbnails[1].getAttribute('aria-current') === 'true';

      return index1IsActive && index1IsNotPending && index1IsAriaCurrent;
    });

    expect(result).toBe(true);
  });

});
