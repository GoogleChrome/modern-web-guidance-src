import { test, expect } from '@playwright/test';
import * as path from 'path';

// Determine the target file from environment variable or default to demo.html
const targetFile = process.env.TARGET_FILE
  ? (process.env.TARGET_FILE.startsWith('file://') ? process.env.TARGET_FILE : 'file://' + path.resolve(process.env.TARGET_FILE))
  : 'file://' + path.resolve(import.meta.dirname, 'demo.html');

test('The scroll container has scroll-snap-type: y proximity or y mandatory applied', async ({ page }) => {
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  await page.goto(targetFile);
  
  const snapType = await page.evaluate(() => {
    const main = document.querySelector('main');
    if (main) {
      const style = window.getComputedStyle(main);
      console.log('MAIN scrollSnapType:', style.scrollSnapType);
      console.log('MAIN overflowY:', style.overflowY);
    }
    const elements = Array.from(document.querySelectorAll('*'));
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const val = style.scrollSnapType;
      // scroll-snap-type can be formatted as "y proximity", "proximity y", "y mandatory", "mandatory y", "y", etc.
      if (val && val !== 'none' && (val === 'y' || val.includes('y') || val.includes('proximity') || val.includes('mandatory'))) {
        return val;
      }
    }
    return null;
  });

  expect(snapType).not.toBeNull();
});

test('The section headers or containers within the container have scroll-snap-align: start applied', async ({ page }) => {
  await page.goto(targetFile);

  const hasSnappedSections = await page.evaluate(() => {
    // Find the scrollable container first via scroll-snap-type presence
    const elements = Array.from(document.querySelectorAll('*'));
    let container: HTMLElement | null = null;
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const snapType = style.scrollSnapType;
      if (snapType && snapType !== 'none') {
        container = el as HTMLElement;
        break;
      }
    }
    if (!container) return false;

    // Resolve snapped target blocks mapped by TOC local hash links dynamically
    const getTOCLinks = () => {
      return Array.from(document.querySelectorAll('a')).filter(a => {
        const href = a.getAttribute('href');
        if (!href || !href.startsWith('#')) return false;
        const parent = a.closest('.seasonal-toc, .toc, nav, aside, .sidebar, [role="directory"]');
        if (!parent) return false;
        if (parent.tagName === 'NAV' && parent.closest('header, nav ul')) return false;
        return true;
      });
    };
    const links = getTOCLinks();
    const targets = links.map(link => {
      const id = decodeURIComponent(link.getAttribute('href')!.slice(1));
      return document.getElementById(id);
    }).filter(Boolean) as HTMLElement[];

    if (targets.length === 0) return false;

    // Verify if any snap target blocks have scroll-snap-align applied
    const snapAlignedElements = targets.filter(el => {
      const style = window.getComputedStyle(el);
      const align = style.scrollSnapAlign;
      return align && align.startsWith('start');
    });

    // Fallback: check if inner headers have snap-align applied instead
    const innerHeaders = Array.from(container.querySelectorAll('h2, h3, [role="heading"]'));
    const snapAlignedHeaders = innerHeaders.filter(el => {
      const style = window.getComputedStyle(el);
      const align = style.scrollSnapAlign;
      return align && align.startsWith('start');
    });

    return snapAlignedElements.length > 0 || snapAlignedHeaders.length > 0;
  });

  expect(hasSnappedSections).toBe(true);
});

test('When the user scrolls to a section, the corresponding link in the Table of Contents (TOC) is visually highlighted', async ({ page }) => {
  await page.addInitScript(() => {
    delete (HTMLElement.prototype as any).onscrollsnapchange;
    if ('onscrollsnapchange' in window) {
      delete (window as any).onscrollsnapchange;
    }
  });

  await page.goto(targetFile);

  // Scroll to second section programmatically
  await page.evaluate(async () => {
    const elements = Array.from(document.querySelectorAll('*'));
    let container: HTMLElement | null = null;
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const snapType = style.scrollSnapType;
      if (snapType && snapType !== 'none') {
        container = el as HTMLElement;
        break;
      }
    }
    if (!container) return;

    const getTOCLinks = () => {
      return Array.from(document.querySelectorAll('a')).filter(a => {
        const href = a.getAttribute('href');
        if (!href || !href.startsWith('#')) return false;
        const parent = a.closest('.seasonal-toc, .toc, nav, aside, .sidebar, [role="directory"]');
        if (!parent) return false;
        if (parent.tagName === 'NAV' && parent.closest('header, nav ul')) return false;
        return true;
      });
    };
    const links = getTOCLinks();
    const targets = links.map(link => {
      const id = decodeURIComponent(link.getAttribute('href')!.slice(1));
      return document.getElementById(id);
    }).filter(Boolean) as HTMLElement[];

    const sortedTargets = targets.sort((a, b) => a.offsetTop - b.offsetTop);
    if (sortedTargets.length < 2) return;
    const target = sortedTargets[1];

    // Temporarily expand body height to bypass scroll boundary clamping limits!
    document.body.style.paddingBottom = '2000px';

    // Scroll window to container absolute offset top to align viewport-relative coordinate frames!
    let absoluteTop = 0;
    let curr: HTMLElement | null = container;
    while (curr) {
      absoluteTop += curr.offsetTop;
      curr = curr.offsetParent as HTMLElement | null;
    }
    window.scrollTo(0, absoluteTop);

    container.scrollTop = target.offsetTop - container.offsetTop + 1;
    container.dispatchEvent(new Event('scroll'));
    
    // Flush paint frames for native IntersectionObservers triggers!
    await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    await new Promise(resolve => setTimeout(resolve, 300));
  });

  const isHighlighted = await page.evaluate(() => {
    const getTOCLinks = () => {
      return Array.from(document.querySelectorAll('a')).filter(a => {
        const href = a.getAttribute('href');
        if (!href || !href.startsWith('#')) return false;
        const parent = a.closest('.seasonal-toc, .toc, nav, aside, .sidebar, [role="directory"]');
        if (!parent) return false;
        if (parent.tagName === 'NAV' && parent.closest('header, nav ul')) return false;
        return true;
      });
    };
    const links = getTOCLinks();
    if (links.length < 2) return false;

    const activeLink = links[1];
    const inactiveLink = links[0];
    if (!activeLink || !inactiveLink) return false;

    const activeStyle = window.getComputedStyle(activeLink);
    const inactiveStyle = window.getComputedStyle(inactiveLink);

    return (
      activeStyle.backgroundColor !== inactiveStyle.backgroundColor ||
      activeStyle.fontWeight !== inactiveStyle.fontWeight ||
      activeStyle.color !== inactiveStyle.color ||
      activeLink.getAttribute('aria-current') === 'true'
    );
  });

  expect(isHighlighted).toBe(true);
});

test('When a TOC link is selected, it should have appropriate accessibility attributes like aria-current="true" or "location"', async ({ page }) => {
  await page.addInitScript(() => {
    delete (HTMLElement.prototype as any).onscrollsnapchange;
    if ('onscrollsnapchange' in window) {
      delete (window as any).onscrollsnapchange;
    }
  });

  await page.goto(targetFile);

  await page.evaluate(async () => {
    const elements = Array.from(document.querySelectorAll('*'));
    let container: HTMLElement | null = null;
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const snapType = style.scrollSnapType;
      if (snapType && snapType !== 'none') {
        container = el as HTMLElement;
        break;
      }
    }
    if (!container) return;

    const getTOCLinks = () => {
      return Array.from(document.querySelectorAll('a')).filter(a => {
        const href = a.getAttribute('href');
        if (!href || !href.startsWith('#')) return false;
        const parent = a.closest('.seasonal-toc, .toc, nav, aside, .sidebar, [role="directory"]');
        if (!parent) return false;
        if (parent.tagName === 'NAV' && parent.closest('header, nav ul')) return false;
        return true;
      });
    };
    const links = getTOCLinks();
    const targets = links.map(link => {
      const id = decodeURIComponent(link.getAttribute('href')!.slice(1));
      return document.getElementById(id);
    }).filter(Boolean) as HTMLElement[];

    const sortedTargets = targets.sort((a, b) => a.offsetTop - b.offsetTop);
    if (sortedTargets.length < 2) return;
    const target = sortedTargets[1];

    // Temporarily expand body height to bypass scroll boundary clamping limits!
    document.body.style.paddingBottom = '2000px';

    // Scroll window to container absolute offset top to align viewport-relative coordinate frames!
    let absoluteTop = 0;
    let curr: HTMLElement | null = container;
    while (curr) {
      absoluteTop += curr.offsetTop;
      curr = curr.offsetParent as HTMLElement | null;
    }
    window.scrollTo(0, absoluteTop);

    container.scrollTop = target.offsetTop - container.offsetTop + 1;
    container.dispatchEvent(new Event('scroll'));
    
    // Flush paint frames for native IntersectionObservers triggers!
    await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    await new Promise(resolve => setTimeout(resolve, 300));
  });

  const ariaCurrent = await page.evaluate(() => {
    const getTOCLinks = () => {
      return Array.from(document.querySelectorAll('a')).filter(a => {
        const href = a.getAttribute('href');
        if (!href || !href.startsWith('#')) return false;
        const parent = a.closest('.seasonal-toc, .toc, nav, aside, .sidebar, [role="directory"]');
        if (!parent) return false;
        if (parent.tagName === 'NAV' && parent.closest('header, nav ul')) return false;
        return true;
      });
    };
    const links = getTOCLinks();
    if (links.length < 2) return null;
    const activeLink = links[1];
    return activeLink ? activeLink.getAttribute('aria-current') : null;
  });

  expect(ariaCurrent).toMatch(/^(true|location)$/);
});

test('When the user scrolls to a section, only one TOC link is highlighted as the active one', async ({ page }) => {
  await page.addInitScript(() => {
    delete (HTMLElement.prototype as any).onscrollsnapchange;
    if ('onscrollsnapchange' in window) {
      delete (window as any).onscrollsnapchange;
    }
  });

  await page.goto(targetFile);

  await page.evaluate(async () => {
    const elements = Array.from(document.querySelectorAll('*'));
    let container: HTMLElement | null = null;
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const snapType = style.scrollSnapType;
      if (snapType && snapType !== 'none') {
        container = el as HTMLElement;
        break;
      }
    }
    if (!container) return;

    const getTOCLinks = () => {
      return Array.from(document.querySelectorAll('a')).filter(a => {
        const href = a.getAttribute('href');
        if (!href || !href.startsWith('#')) return false;
        const parent = a.closest('.seasonal-toc, .toc, nav, aside, .sidebar, [role="directory"]');
        if (!parent) return false;
        if (parent.tagName === 'NAV' && parent.closest('header, nav ul')) return false;
        return true;
      });
    };
    const links = getTOCLinks();
    const targets = links.map(link => {
      const id = decodeURIComponent(link.getAttribute('href')!.slice(1));
      return document.getElementById(id);
    }).filter(Boolean) as HTMLElement[];

    const sortedTargets = targets.sort((a, b) => a.offsetTop - b.offsetTop);
    if (sortedTargets.length < 2) return;
    const target = sortedTargets[1];

    // Temporarily expand body height to bypass scroll boundary clamping limits!
    document.body.style.paddingBottom = '2000px';

    // Scroll window to container absolute offset top to align viewport-relative coordinate frames!
    let absoluteTop = 0;
    let curr: HTMLElement | null = container;
    while (curr) {
      absoluteTop += curr.offsetTop;
      curr = curr.offsetParent as HTMLElement | null;
    }
    window.scrollTo(0, absoluteTop);

    container.scrollTop = target.offsetTop - container.offsetTop + 1;
    container.dispatchEvent(new Event('scroll'));
    
    // Flush paint frames for native IntersectionObservers triggers!
    await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    await new Promise(resolve => setTimeout(resolve, 300));
  });

  const activeCount = await page.evaluate(() => {
    const getTOCLinks = () => {
      return Array.from(document.querySelectorAll('a')).filter(a => {
        const href = a.getAttribute('href');
        if (!href || !href.startsWith('#')) return false;
        const parent = a.closest('.seasonal-toc, .toc, nav, aside, .sidebar, [role="directory"]');
        if (!parent) return false;
        if (parent.tagName === 'NAV' && parent.closest('header, nav ul')) return false;
        return true;
      });
    };
    const links = getTOCLinks();
    return links.filter(l => {
      const current = l.getAttribute('aria-current');
      return current === 'true' || current === 'location';
    }).length;
  });

  expect(activeCount).toBe(1);
});

test('The implementation uses the scrollsnapchange event listener on the scroll container', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__registeredListeners = [];
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, _listener, _options) {
      (window as any).__registeredListeners.push({
        type,
        elementTagName: (this as any).tagName,
        elementId: (this as any).id,
        elementClass: (this as any).className
      });
      return originalAddEventListener.apply(this, arguments as any);
    };
  });

  await page.goto(targetFile);

  const hasScrollSnapChangeListener = await page.evaluate(() => {
    const listeners = (window as any).__registeredListeners || [];
    return listeners.some((l: any) => l.type === 'scrollsnapchange');
  });

  expect(hasScrollSnapChangeListener).toBe(true);
});

test('The implementation includes an IntersectionObserver fallback when scrollsnapchange is unsupported', async ({ page }) => {
  await page.addInitScript(() => {
    delete (HTMLElement.prototype as any).onscrollsnapchange;
    if ('onscrollsnapchange' in window) {
      delete (window as any).onscrollsnapchange;
    }

    (window as any).__intersectionObserverCreated = false;
    (window as any).__observedElementsCount = 0;

    const OriginalIntersectionObserver = window.IntersectionObserver;
    // @ts-ignore
    window.IntersectionObserver = class MockIntersectionObserver {
      private observer: any;
      constructor(callback: any, options: any) {
        (window as any).__intersectionObserverCreated = true;
        this.observer = new OriginalIntersectionObserver(callback, options);
      }
      observe(target: any) {
        (window as any).__observedElementsCount++;
        return this.observer.observe(target);
      }
      unobserve(target: any) {
        return this.observer.unobserve(target);
      }
      disconnect() {
        return this.observer.disconnect();
      }
    };
  });

  await page.goto(targetFile);

  const fallbackTriggered = await page.evaluate(() => {
    const fallbackCreated = (window as any).__intersectionObserverCreated;
    const observedCount = (window as any).__observedElementsCount;
    return fallbackCreated && observedCount > 0;
  });

  expect(fallbackTriggered).toBe(true);
});

test('Clicking a TOC link causes the container to scroll to the corresponding section', async ({ page }) => {
  await page.goto(targetFile);

  // Click the second link in TOC dynamically using browser click dispatcher
  await page.evaluate(() => {
    const getTOCLinks = () => {
      return Array.from(document.querySelectorAll('a')).filter(a => {
        const href = a.getAttribute('href');
        if (!href || !href.startsWith('#')) return false;
        const parent = a.closest('.seasonal-toc, .toc, nav, aside, .sidebar, [role="directory"]');
        if (!parent) return false;
        if (parent.tagName === 'NAV' && parent.closest('header, nav ul')) return false;
        return true;
      });
    };
    const links = getTOCLinks();
    if (links.length >= 2) {
      links[1].click();
    }
  });

  // Wait for scrolling to finish
  await page.waitForTimeout(500);

  const finalScrollTop = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    let container: HTMLElement | null = null;
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const overflow = style.overflowY;
      if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight) {
        container = el as HTMLElement;
        break;
      }
    }
    return container ? container.scrollTop : 0;
  });

  expect(finalScrollTop).toBeGreaterThan(0);
});
