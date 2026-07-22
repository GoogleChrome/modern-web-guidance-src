import { test, expect } from '@playwright/test';
import * as path from 'path';

declare global {
  interface Window {
    __io_spies?: any[];
    __ro_spies?: any[];
    __animation_spies?: any[];
  }
}

const targetFile = process.env.TARGET_FILE || path.resolve((import.meta as any).dirname || process.cwd(), 'demo.html');
const url = `file://${targetFile}`;

// Helper to check if the main swipe initialized class is present on the list item
async function verifyInitialized(page: any): Promise<boolean> {
  return await page.evaluate(() => {
    const item = document.querySelector('.SwipeableList-item');
    return item ? item.classList.contains('is-initialized') : false;
  });
}

async function loadPage(page: any) {
  await page.goto(url);
  await page.waitForTimeout(200);
  const item = page.locator('.SwipeableList-item').first();
  if (await item.count() > 0) {
    await item.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
  }
}

test('1. Track has scroll-snap-type x mandatory', async ({ page }) => {
  await loadPage(page);
  const scrollSnapType = await page.evaluate(() => {
    const track = document.querySelector('.SwipeableList-track');
    if (!track) return '';
    const style = window.getComputedStyle(track);
    return style.scrollSnapType || style.getPropertyValue('scroll-snap-type');
  });
  expect(scrollSnapType).toMatch(/\bx\b/);
  expect(scrollSnapType).toMatch(/\bmandatory\b/);
});

test('2. Track has overscroll-behavior-x none', async ({ page }) => {
  await loadPage(page);
  const overscrollBehaviorX = await page.evaluate(() => {
    const track = document.querySelector('.SwipeableList-track');
    if (!track) return '';
    const style = window.getComputedStyle(track);
    return style.overscrollBehaviorX || style.getPropertyValue('overscroll-behavior-x');
  });
  expect(overscrollBehaviorX).toBe('none');
});

test('3. Track hides its scrollbar with scrollbar-width none', async ({ page }) => {
  await loadPage(page);
  const scrollbarWidth = await page.evaluate(() => {
    const track = document.querySelector('.SwipeableList-track');
    if (!track) return '';
    const style = window.getComputedStyle(track);
    return style.scrollbarWidth || style.getPropertyValue('scrollbar-width');
  });
  expect(scrollbarWidth).toBe('none');
});

test('4. Track spacers have scroll-snap-align set to be valid snap targets', async ({ page }) => {
  await loadPage(page);
  const snapAlign = await page.evaluate(() => {
    const track = document.querySelector('.SwipeableList-track');
    if (!track) return { beforeAlign: 'none', afterAlign: 'none' };
    const beforeStyle = window.getComputedStyle(track, '::before');
    const afterStyle = window.getComputedStyle(track, '::after');
    const beforeAlign = beforeStyle.scrollSnapAlign || beforeStyle.getPropertyValue('scroll-snap-align');
    const afterAlign = afterStyle.scrollSnapAlign || afterStyle.getPropertyValue('scroll-snap-align');
    return { beforeAlign, afterAlign };
  });
  expect(snapAlign.beforeAlign).not.toBe('none');
  expect(snapAlign.afterAlign).not.toBe('none');
});

test('5. Content element has scroll-snap-align set', async ({ page }) => {
  await loadPage(page);
  const contentSnapAlign = await page.evaluate(() => {
    const content = document.querySelector('.SwipeableList-content');
    if (!content) return 'none';
    const style = window.getComputedStyle(content);
    return style.scrollSnapAlign || style.getPropertyValue('scroll-snap-align');
  });
  expect(contentSnapAlign).not.toBe('none');
});

test('6. Content element has an opaque background to hide action behind it', async ({ page }) => {
  await loadPage(page);
  const isOpaque = await page.evaluate(() => {
    const content = document.querySelector('.SwipeableList-content');
    if (!content) return false;
    const style = window.getComputedStyle(content);
    const bg = style.backgroundColor;
    if (bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return false;
    const match = bg.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/);
    if (match && parseFloat(match[1]) === 0) return false;
    return true;
  });
  const isInit = await verifyInitialized(page);
  expect(isInit).toBe(true);
  expect(isOpaque).toBe(true);
});

test('7. scroll-initial-target nearest is gated behind initialization class', async ({ page }) => {
  await loadPage(page);
  const results = await page.evaluate(() => {
    const item = document.querySelector('.SwipeableList-item');
    const content = item?.querySelector('.SwipeableList-content');
    if (!item || !content) return { initial: '', afterRemoval: '' };
    
    const initialStyle = window.getComputedStyle(content);
    const initialVal = initialStyle.getPropertyValue('scroll-initial-target');
    
    const possibleClasses = Array.from(item.classList).filter(c => c.includes('init'));
    const oldClassList = [...item.classList];
    for (const c of possibleClasses) {
      item.classList.remove(c);
    }
    
    const styleAfter = window.getComputedStyle(content);
    const valAfter = styleAfter.getPropertyValue('scroll-initial-target');
    
    for (const c of oldClassList) {
      item.classList.add(c);
    }
    
    return { initial: initialVal, afterRemoval: valAfter };
  });

  expect(results.initial).toBe('nearest');
  expect(results.afterRemoval).not.toBe('nearest');
});

test('8. Swipe detector IntersectionObserver is rooted at the track', async ({ page }) => {
  await page.addInitScript(() => {
    window.__io_spies = [];
    const OriginalIntersectionObserver = window.IntersectionObserver;
    window.IntersectionObserver = class SpyIntersectionObserver extends OriginalIntersectionObserver {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        super(callback, options);
        const record = {
          root: options?.root || null,
          thresholds: options?.threshold || null,
          targets: [] as Element[]
        };
        window.__io_spies!.push(record);
        
        const originalObserve = this.observe;
        this.observe = function(target: Element) {
          record.targets.push(target);
          return originalObserve.call(this, target);
        };
      }
    };
  });

  await loadPage(page);

  const hasTrackRootedObserver = await page.evaluate(() => {
    if (!window.__io_spies) return false;
    return window.__io_spies.some(spy => {
      if (!spy.root) return false;
      const isTrack = spy.root.classList?.contains('SwipeableList-track');
      const observesContent = spy.targets.some((t: any) => t.classList?.contains('SwipeableList-content'));
      return isTrack && observesContent;
    });
  });

  expect(hasTrackRootedObserver).toBe(true);
});

test('9. Swipe detector has low commit and high activate thresholds', async ({ page }) => {
  await page.addInitScript(() => {
    window.__io_spies = [];
    const OriginalIntersectionObserver = window.IntersectionObserver;
    window.IntersectionObserver = class SpyIntersectionObserver extends OriginalIntersectionObserver {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        super(callback, options);
        const record = {
          root: options?.root || null,
          thresholds: options?.threshold || null,
          targets: [] as Element[]
        };
        window.__io_spies!.push(record);
        
        const originalObserve = this.observe;
        this.observe = function(target: Element) {
          record.targets.push(target);
          return originalObserve.call(this, target);
        };
      }
    };
  });

  await loadPage(page);

  const thresholds = await page.evaluate(() => {
    if (!window.__io_spies) return null;
    const spy = window.__io_spies.find(spy => {
      if (!spy.root) return false;
      const isTrack = spy.root.classList?.contains('SwipeableList-track');
      const observesContent = spy.targets.some((t: any) => t.classList?.contains('SwipeableList-content'));
      return isTrack && observesContent;
    });
    if (!spy) return null;
    const ths = spy.thresholds;
    if (Array.isArray(ths)) return ths;
    if (typeof ths === 'number') return [ths];
    return null;
  });

  expect(thresholds).not.toBeNull();
  expect(thresholds!.length).toBeGreaterThanOrEqual(2);
  
  const lowThreshold = thresholds!.find((t: number) => t <= 0.3);
  const highThreshold = thresholds!.find((t: number) => t >= 0.7);

  expect(lowThreshold).toBeLessThanOrEqual(0.3);
  expect(highThreshold).toBeGreaterThanOrEqual(0.7);
});

test('10. Updates data-swipe-direction attribute during swipe', async ({ page }) => {
  await loadPage(page);
  const result = await page.evaluate(async () => {
    const item = document.querySelector('.SwipeableList-item') as HTMLElement;
    const track = item?.querySelector('.SwipeableList-track') as HTMLElement;
    if (!track || !item) return null;
    
    // Temporarily disable scroll snapping to prevent auto snapback
    track.style.scrollSnapType = 'none';
    const initialScrollLeft = track.scrollLeft;
    
    // Swipe right (pull content right -> decrease scrollLeft)
    track.scrollLeft = initialScrollLeft - Math.round(track.clientWidth * 0.3);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    const dirLeft = item.getAttribute('data-swipe-direction') || item.dataset.swipeDirection;
    
    // Reset back to center so that the next scroll crosses the threshold again
    track.scrollLeft = initialScrollLeft;
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Swipe left (pull content left -> increase scrollLeft)
    track.scrollLeft = initialScrollLeft + Math.round(track.clientWidth * 0.3);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    const dirRight = item.getAttribute('data-swipe-direction') || item.dataset.swipeDirection;
    
    // Restore scroll snap type
    track.style.scrollSnapType = '';
    
    const hasInitClass = item.classList.contains('is-initialized');
    return { dirLeft, dirRight, hasInitClass };
  });

  expect(result).not.toBeNull();
  expect(result!.hasInitClass).toBe(true);
  expect(result!.dirLeft).toBe('left');
  expect(result!.dirRight).toBe('right');
});

test('11. Toggles is-activating class during swipe before commit', async ({ page }) => {
  await loadPage(page);
  const result = await page.evaluate(async () => {
    const item = document.querySelector('.SwipeableList-item') as HTMLElement;
    const track = item?.querySelector('.SwipeableList-track') as HTMLElement;
    if (!track || !item) return null;
    
    // Temporarily disable scroll snapping to prevent auto snapback
    track.style.scrollSnapType = 'none';
    const initialScrollLeft = track.scrollLeft;
    const width = track.clientWidth;
    
    track.scrollLeft = initialScrollLeft - Math.round(width * 0.4);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const isActivating = item.classList.contains('is-activating');
    const isRemoving = item.classList.contains('is-removing');
    
    // Restore scroll snap type
    track.style.scrollSnapType = '';
    
    return { isActivating, isRemoving };
  });

  expect(result).not.toBeNull();
  expect(result!.isActivating).toBe(true);
  expect(result!.isRemoving).toBe(false);
});

test('12. Triggers row collapse animation when swiped past commit threshold', async ({ page }) => {
  await loadPage(page);
  const result = await page.evaluate(async () => {
    const item = document.querySelector('.SwipeableList-item') as HTMLElement;
    const track = item?.querySelector('.SwipeableList-track') as HTMLElement;
    if (!track || !item) return null;
    
    // Temporarily disable scroll snapping to prevent auto snapback
    track.style.scrollSnapType = 'none';
    const initialScrollLeft = track.scrollLeft;
    const width = track.clientWidth;
    
    track.scrollLeft = initialScrollLeft - Math.round(width * 0.85);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const isRemoving = item.classList.contains('is-removing');
    return { isRemoving };
  });

  expect(result).not.toBeNull();
  expect(result!.isRemoving).toBe(true);
});

test('13. Does not drive the swipe with manual pointermove transform updates', async ({ page }) => {
  await loadPage(page);
  const content = page.locator('.SwipeableList-content').first();
  const box = await content.boundingBox();
  expect(box).not.toBeNull();
  
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 50, box!.y + box!.height / 2);
  
  const inlineTransform = await content.evaluate(el => el.style.transform || el.style.translate);
  
  await page.mouse.up();
  
  const isInit = await verifyInitialized(page);
  expect(isInit).toBe(true);
  expect(inlineTransform).not.toContain('translate');
});

test('14. MutationObserver wires up dynamically added list items', async ({ page }) => {
  await loadPage(page);
  const isWiredUp = await page.evaluate(async () => {
    const list = document.querySelector('.SwipeableList');
    if (!list) return false;
    
    const newItem = document.createElement('li');
    newItem.className = 'SwipeableList-item';
    newItem.innerHTML = `
      <div class="SwipeableList-track">
        <div class="SwipeableList-content">Dynamic Item</div>
      </div>
    `;
    list.insertBefore(newItem, list.firstChild); // Prepend so it is at the top (in viewport)!
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const hasInitClass = newItem.classList.contains('is-initialized');
    return hasInitClass;
  });

  expect(isWiredUp).toBe(true);
});

test('15. scroll-initial-target fallback scrolls track programmatically when CSS.supports is false', async ({ page }) => {
  await page.addInitScript(() => {
    const originalSupports = CSS.supports;
    (CSS as any).supports = function(property: string, value?: string) {
      if (property === 'scroll-initial-target') return false;
      return value === undefined ? (originalSupports as any)(property) : (originalSupports as any)(property, value);
    };
  });

  await loadPage(page);

  const scrollResult = await page.evaluate(() => {
    const track = document.querySelector('.SwipeableList-track');
    if (!track) return null;
    return {
      scrollLeft: track.scrollLeft,
      clientWidth: track.clientWidth
    };
  });

  const isInit = await verifyInitialized(page);
  expect(isInit).toBe(true);
  expect(scrollResult).not.toBeNull();
  expect(scrollResult!.scrollLeft).toBe(scrollResult!.clientWidth);
});

test('16. ResizeObserver is attached to track when fallback is active', async ({ page }) => {
  await page.addInitScript(() => {
    const originalSupports = CSS.supports;
    (CSS as any).supports = function(property: string, value?: string) {
      if (property === 'scroll-initial-target') return false;
      return value === undefined ? (originalSupports as any)(property) : (originalSupports as any)(property, value);
    };

    window.__ro_spies = [];
    const OriginalResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class SpyResizeObserver extends OriginalResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        super(callback);
        const record = {
          targets: [] as Element[]
        };
        window.__ro_spies!.push(record);
        
        const originalObserve = this.observe;
        this.observe = function(target: Element) {
          record.targets.push(target);
          return originalObserve.call(this, target);
        };
      }
    };
  });

  await loadPage(page);

  const hasTrackResizeObserver = await page.evaluate(() => {
    if (!window.__ro_spies) return false;
    return window.__ro_spies.some(spy => {
      return spy.targets.some((t: any) => t.classList?.contains('SwipeableList-track'));
    });
  });

  const isInit = await verifyInitialized(page);
  expect(isInit).toBe(true);
  expect(hasTrackResizeObserver).toBe(true);
});

test('17. ResizeObserver is NOT attached to track when scroll-initial-target is supported', async ({ page }) => {
  await page.addInitScript(() => {
    const originalSupports = CSS.supports;
    (CSS as any).supports = function(property: string, value?: string) {
      if (property === 'scroll-initial-target') return true;
      return value === undefined ? (originalSupports as any)(property) : (originalSupports as any)(property, value);
    };

    window.__ro_spies = [];
    const OriginalResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class SpyResizeObserver extends OriginalResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        super(callback);
        const record = {
          targets: [] as Element[]
        };
        window.__ro_spies!.push(record);
        
        const originalObserve = this.observe;
        this.observe = function(target: Element) {
          record.targets.push(target);
          return originalObserve.call(this, target);
        };
      }
    };
  });

  await loadPage(page);

  const hasTrackResizeObserver = await page.evaluate(() => {
    if (!window.__ro_spies) return false;
    return window.__ro_spies.some(spy => {
      return spy.targets.some((t: any) => t.classList?.contains('SwipeableList-track'));
    });
  });

  const isInit = await verifyInitialized(page);
  expect(isInit).toBe(true);
  expect(hasTrackResizeObserver).toBe(false);
});

test('18. Safari scroll-latching workaround defers item removal and sets inert', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).GestureEvent = class GestureEvent {};
  });

  await loadPage(page);
  const result = await page.evaluate(async () => {
    const item = document.querySelector('.SwipeableList-item') as HTMLElement;
    const track = item?.querySelector('.SwipeableList-track') as HTMLElement;
    if (!track || !item) return null;
    
    // Temporarily disable scroll snapping to prevent auto snapback
    track.style.scrollSnapType = 'none';
    const initialScrollLeft = track.scrollLeft;
    const width = track.clientWidth;
    
    track.scrollLeft = initialScrollLeft - Math.round(width * 0.85);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const isInDOM = !!item.parentNode;
    const isInert = item.inert;
    const hasInitClass = item.classList.contains('is-initialized');
    
    return { isInDOM, isInert, hasInitClass };
  });

  expect(result).not.toBeNull();
  expect(result!.hasInitClass).toBe(true);
  expect(result!.isInDOM).toBe(true);
  expect(result!.isInert).toBe(true);
});

test('19. Non-Safari browsers remove the item immediately after collapse', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as any).GestureEvent;
  });

  await loadPage(page);
  const result = await page.evaluate(async () => {
    const list = document.querySelector('.SwipeableList');
    const item = list?.firstElementChild as HTMLElement;
    const track = item?.querySelector('.SwipeableList-track') as HTMLElement;
    if (!track || !item) return null;
    
    // Temporarily disable scroll snapping to prevent auto snapback
    track.style.scrollSnapType = 'none';
    const initialScrollLeft = track.scrollLeft;
    const width = track.clientWidth;
    
    track.scrollLeft = initialScrollLeft - Math.round(width * 0.85);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const isInDOM = list?.contains(item);
    const initialItem = document.querySelector('.SwipeableList-item') as HTMLElement;
    const hasInitClass = initialItem ? initialItem.classList.contains('is-initialized') : false;
    
    return { isInDOM, hasInitClass };
  });

  expect(result).not.toBeNull();
  expect(result!.hasInitClass).toBe(true);
  expect(result!.isInDOM).toBe(false);
});

test('20. Uses WAAPI animations to collapse row height and translate content', async ({ page }) => {
  await page.addInitScript(() => {
    window.__animation_spies = [];
    const originalAnimate = Element.prototype.animate;
    Element.prototype.animate = function(keyframes: Keyframe[] | PropertyIndexedKeyframes | null, options?: number | KeyframeAnimationOptions) {
      const record = {
        className: this.className,
        keyframes,
        options
      };
      window.__animation_spies!.push(record);
      return originalAnimate.call(this, keyframes, options);
    };
  });

  await loadPage(page);
  const result = await page.evaluate(async () => {
    const item = document.querySelector('.SwipeableList-item') as HTMLElement;
    const track = item?.querySelector('.SwipeableList-track') as HTMLElement;
    if (!track || !item) return null;
    
    // Temporarily disable scroll snapping to prevent auto snapback
    track.style.scrollSnapType = 'none';
    const initialScrollLeft = track.scrollLeft;
    const width = track.clientWidth;
    
    track.scrollLeft = initialScrollLeft - Math.round(width * 0.85);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const hasInitClass = item.classList.contains('is-initialized');
    return { hasInitClass, animations: window.__animation_spies };
  });

  expect(result).not.toBeNull();
  expect(result!.hasInitClass).toBe(true);
  
  const animations = result!.animations || [];
  const heightAnim = animations.find(a => 
    a.className.includes('SwipeableList-item') &&
    a.keyframes.some((k: any) => k.height !== undefined)
  );
  expect(heightAnim).toBeDefined();
  
  const translateAnim = animations.find(a => 
    a.className.includes('SwipeableList-content') &&
    a.keyframes.some((k: any) => k.translate !== undefined || k.transform?.includes('translate'))
  );
  expect(translateAnim).toBeDefined();
});

test('21. Projects focus affordance onto content element when track has focus', async ({ page }) => {
  await loadPage(page);
  const result = await page.evaluate(() => {
    const item = document.querySelector('.SwipeableList-item') as HTMLElement;
    const track = item?.querySelector('.SwipeableList-track') as HTMLElement;
    const content = track?.querySelector('.SwipeableList-content') as HTMLElement;
    if (!track || !content) return null;
    
    const hadTabindex = track.hasAttribute('tabindex');
    if (!hadTabindex) {
      track.setAttribute('tabindex', '0');
    }
    
    track.focus();
    const styleFocused = window.getComputedStyle(content);
    const outlineStyleFocused = styleFocused.outlineStyle || styleFocused.getPropertyValue('outline-style');
    
    track.blur();
    const styleBlurred = window.getComputedStyle(content);
    const outlineStyleBlurred = styleBlurred.outlineStyle || styleBlurred.getPropertyValue('outline-style');
    
    return {
      outlineStyleFocused,
      outlineStyleBlurred,
      hasInitClass: item.classList.contains('is-initialized')
    };
  });

  expect(result).not.toBeNull();
  expect(result!.hasInitClass).toBe(true);
  expect(result!.outlineStyleFocused).not.toBe('none');
});
