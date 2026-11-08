import { test, expect } from '@playwright/test';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is not defined');
}
const url = `file://${path.resolve(targetFile)}`;

const THUMBNAIL_SELECTOR = 'button.thumbnail, button[class*="thumb"], button[data-index], button[data-slide], .indicators button, .thumbnails button, [role="tab"], .thumbnail';

test.describe('Scroll Snap Realtime Feedback', () => {

  test('The number of .thumbnail elements equals the number of .gallery-item elements', async ({ page }) => {
    await page.goto(url);
    const thumbnailCount = await page.locator(THUMBNAIL_SELECTOR).count();
    const galleryItemCount = await page.locator('.gallery-item').count();
    expect(thumbnailCount).toBeGreaterThan(0);
    expect(thumbnailCount).toBe(galleryItemCount);
  });

  test('Each thumbnail is rendered as a button element with aria-current="true" applied to the currently-active thumbnail', async ({ page }) => {
    await page.goto(url);
    const results = await page.evaluate((selector) => {
      const thumbnails = Array.from(document.querySelectorAll(selector));
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
    }, THUMBNAIL_SELECTOR);

    expect(results).toEqual({ success: true });
  });

  test('The gallery contains child elements with class .gallery-item, one per photo', async ({ page }) => {
    await page.goto(url);
    const isValid = await page.evaluate((selector) => {
      const gallery = document.getElementById('gallery');
      if (!gallery) return false;
      const items = Array.from(gallery.children);
      if (items.length === 0) return false;
      const allHaveClass = items.every(item => item.classList.contains('gallery-item'));
      const thumbnailCount = document.querySelectorAll(selector).length;
      return allHaveClass && items.length === thumbnailCount;
    }, THUMBNAIL_SELECTOR);
    expect(isValid).toBe(true);
  });

  test('The Nth .thumbnail element corresponds to the Nth .gallery-item element', async ({ page }) => {
    await page.goto(url);
    
    const result = await page.evaluate(async (selector) => {
      const gallery = document.getElementById('gallery') as HTMLElement;
      const thumbnails = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
      const items = Array.from(document.querySelectorAll('.gallery-item')) as HTMLElement[];
      
      if (thumbnails.length < 3 || items.length < 3 || !gallery) {
        return { error: 'Insufficient elements or missing gallery' };
      }
      
      // Dispatch scrollsnapchange to target item 2
      const event = new Event('scrollsnapchange') as any;
      event.snapTargetInline = items[2];
      gallery.dispatchEvent(event);

      // Or scroll to item 2 directly for fallback implementations
      const targetLeft = items[2].offsetLeft - (gallery.clientWidth - items[2].offsetWidth) / 2;
      gallery.scrollTo({ left: targetLeft, behavior: 'instant' });
      gallery.dispatchEvent(new Event('scroll'));
      gallery.dispatchEvent(new Event('scrollend'));

      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const isIndex2Active = thumbnails[2].classList.contains('active') || thumbnails[2].getAttribute('aria-current') === 'true';
      return { isIndex2Active };
    }, THUMBNAIL_SELECTOR);
    
    expect(result).toEqual({ isIndex2Active: true });
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
      if (!('onscrollsnapchange' in Element.prototype)) {
        Object.defineProperty(Element.prototype, 'onscrollsnapchange', {
          value: null,
          writable: true,
          configurable: true
        });
      }
    });
    await page.goto(url);

    const supportedResult = await page.evaluate((selector) => {
      const gallery = document.getElementById('gallery');
      const thumbnails = Array.from(document.querySelectorAll(selector));
      const items = Array.from(document.querySelectorAll('.gallery-item'));
      if (!gallery || thumbnails.length < 2 || items.length < 2) return null;

      // Clear any existing pending classes
      thumbnails.forEach(t => t.classList.remove('pending'));

      // Dispatch a custom scrollsnapchanging event
      const event = new Event('scrollsnapchanging') as any;
      event.snapTargetInline = items[1];
      gallery.dispatchEvent(event);

      return thumbnails[1].classList.contains('pending');
    }, THUMBNAIL_SELECTOR);

    // Scenario B: Load with onscrollsnapchanging deleted (feature unsupported)
    const context2 = await page.context().browser()!.newContext();
    const page2 = await context2.newPage();
    await page2.addInitScript(() => {
      delete (Element.prototype as any).onscrollsnapchanging;
      delete (Element.prototype as any).onscrollsnapchange;
      if ('onscrollsnapchanging' in window) {
        delete (window as any).onscrollsnapchanging;
      }
      if ('onscrollsnapchange' in window) {
        delete (window as any).onscrollsnapchange;
      }
    });
    await page2.goto(url);

    const unsupportedResult = await page2.evaluate((selector) => {
      const gallery = document.getElementById('gallery');
      const thumbnails = Array.from(document.querySelectorAll(selector));
      const items = Array.from(document.querySelectorAll('.gallery-item'));
      if (!gallery || thumbnails.length < 2 || items.length < 2) return null;

      // Clear any existing pending classes
      thumbnails.forEach(t => t.classList.remove('pending'));

      // Dispatch custom scrollsnapchanging event
      const event = new Event('scrollsnapchanging') as any;
      event.snapTargetInline = items[1];
      gallery.dispatchEvent(event);

      return thumbnails[1].classList.contains('pending');
    }, THUMBNAIL_SELECTOR);

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
      if (!('onscrollsnapchange' in Element.prototype)) {
        Object.defineProperty(Element.prototype, 'onscrollsnapchange', {
          value: null,
          writable: true,
          configurable: true
        });
      }
    });
    await page.goto(url);

    const hasPending = await page.evaluate((selector) => {
      const gallery = document.getElementById('gallery');
      const thumbnails = Array.from(document.querySelectorAll(selector));
      const items = Array.from(document.querySelectorAll('.gallery-item'));
      if (!gallery || thumbnails.length < 2 || items.length < 2) return false;

      // Dispatch scrollsnapchanging event targeting item 1
      const event = new Event('scrollsnapchanging') as any;
      event.snapTargetInline = items[1];
      gallery.dispatchEvent(event);

      return thumbnails[1].classList.contains('pending') && !thumbnails[0].classList.contains('pending');
    }, THUMBNAIL_SELECTOR);

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
      if (!('onscrollsnapchange' in Element.prototype)) {
        Object.defineProperty(Element.prototype, 'onscrollsnapchange', {
          value: null,
          writable: true,
          configurable: true
        });
      }
    });
    await page.goto(url);

    const result = await page.evaluate((selector) => {
      const gallery = document.getElementById('gallery');
      const thumbnails = Array.from(document.querySelectorAll(selector));
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
    }, THUMBNAIL_SELECTOR);

    expect(result).toBe(true);
  });

  test('When scrollsnapchanging is unsupported, the fallback toggles pending on the thumbnail corresponding to the gallery-item nearest the viewport center during scrolling', async ({ page }) => {
    // Disable native scrollsnapchanging support
    await page.addInitScript(() => {
      delete (Element.prototype as any).onscrollsnapchanging;
      delete (Element.prototype as any).onscrollsnapchange;
      if ('onscrollsnapchanging' in window) {
        delete (window as any).onscrollsnapchanging;
      }
      if ('onscrollsnapchange' in window) {
        delete (window as any).onscrollsnapchange;
      }
    });

    await page.goto(url);

    const result = await page.evaluate(async (selector) => {
      const gallery = document.getElementById('gallery') as HTMLElement;
      const thumbnails = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
      if (!gallery || thumbnails.length < 2) return null;

      // Clear any existing classes to start clean
      thumbnails.forEach(t => t.classList.remove('pending'));

      // Scroll gallery to be closer to the second item (index 1)
      gallery.scrollTo({ left: gallery.clientWidth * 0.75, behavior: 'instant' }); 
      
      // Dispatch scroll event programmatically to ensure the listener is triggered
      gallery.dispatchEvent(new Event('scroll'));

      // Wait a couple of animation frames for requestAnimationFrame to execute
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const index1IsPending = thumbnails[1].classList.contains('pending') || thumbnails[1].classList.contains('active');
      const index0IsNotPending = !thumbnails[0].classList.contains('pending');

      return index1IsPending && index0IsNotPending;
    }, THUMBNAIL_SELECTOR);

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

    const result = await page.evaluate(async (selector) => {
      const gallery = document.getElementById('gallery') as HTMLElement;
      const thumbnails = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
      const items = Array.from(gallery?.querySelectorAll('.gallery-item') || []) as HTMLElement[];
      if (!gallery || thumbnails.length < 2 || items.length < 2) return null;

      // Clear active/pending on all thumbnails
      thumbnails.forEach(t => {
        t.classList.remove('pending', 'active');
        t.removeAttribute('aria-current');
      });

      // Scroll to the second item using instant behavior to prevent smooth-scroll delays
      const targetLeft = items[1].offsetLeft - (gallery.clientWidth - items[1].offsetWidth) / 2;
      gallery.scrollTo({ left: targetLeft, behavior: 'instant' });

      // Dispatch scroll event and wait for rAF
      gallery.dispatchEvent(new Event('scroll'));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      // Dispatch scrollend to trigger settling
      gallery.dispatchEvent(new Event('scrollend'));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      // Thumbnail 1 should now be active with aria-current="true"
      const index1IsActive = thumbnails[1].classList.contains('active');
      const index1IsNotPending = !thumbnails[1].classList.contains('pending');
      const index1IsAriaCurrent = thumbnails[1].getAttribute('aria-current') === 'true';

      return index1IsActive && index1IsNotPending && index1IsAriaCurrent;
    }, THUMBNAIL_SELECTOR);

    expect(result).toBe(true);
  });

  async function getGalleryContainerInfo(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
      const el =
        document.getElementById('gallery') ||
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

  test('The gallery container has an accessible name provided using `aria-label` or `aria-labelledby`.', async ({ page }) => {
    await page.goto(url);
    const info = await getGalleryContainerInfo(page);
    expect(info).not.toBeNull();
    expect(info!.hasAccessibleName).toBe(true);
  });

  test('The gallery container has an accessible role of `role="region"`.', async ({ page }) => {
    await page.goto(url);
    const info = await getGalleryContainerInfo(page);
    expect(info).not.toBeNull();
    expect(info!.hasRegionRole).toBe(true);
  });

  test('The gallery container can receive focus with `tabindex="0"`.', async ({ page }) => {
    await page.goto(url);
    const info = await getGalleryContainerInfo(page);
    expect(info).not.toBeNull();
    expect(info!.tabindex).toBe('0');
  });

});
