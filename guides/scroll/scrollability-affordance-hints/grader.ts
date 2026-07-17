import { test, expect } from '@playwright/test';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is not set');
}
const url = `file://${path.resolve(targetFile)}`;

// Shared helper to dynamically discover the scroller and indicators, then tag them
async function getPageElements(page: any) {
  return await page.evaluate(() => {
    // Find the scroll container
    const scroller = [...document.querySelectorAll('*')].find(el => {
      const style = window.getComputedStyle(el);
      return (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
    });

    if (!scroller) return null;

    // Candidates are elements inside the scroller (or adjacent if they overlap, but usually inside)
    const candidates = [...scroller.querySelectorAll('*')].filter(el => {
      const textLength = el.textContent?.trim().length || 0;
      if (textLength > 100) return false; // Exclude main content blocks with lots of text
      const style = window.getComputedStyle(el);
      const pos = style.position;
      const isPositioned = pos === 'sticky' || pos === 'absolute' || pos === 'fixed';
      const isOverlay = style.backgroundImage?.includes('gradient') || style.boxShadow !== 'none' || el.className.includes('shadow') || el.className.includes('indicator');
      return isPositioned || isOverlay;
    });

    // Find top candidate
    const topCandidates = candidates.filter(el => {
      const name = (el.className + ' ' + el.id).toLowerCase();
      return name.includes('top') || name.includes('up');
    });
    const topIndicator = topCandidates[0] || candidates.find(el => {
      const rect = el.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      return rect.top < scrollerRect.top + scrollerRect.height / 2;
    });

    // Find bottom candidate
    const bottomCandidates = candidates.filter(el => {
      const name = (el.className + ' ' + el.id).toLowerCase();
      return name.includes('bottom') || name.includes('down');
    });
    const bottomIndicator = bottomCandidates[0] || candidates.find(el => {
      const rect = el.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      return rect.bottom > scrollerRect.top + scrollerRect.height / 2;
    });

    if (topIndicator) {
      topIndicator.setAttribute('data-test-role', 'top-indicator');
    }
    if (bottomIndicator) {
      bottomIndicator.setAttribute('data-test-role', 'bottom-indicator');
    }
    scroller.setAttribute('data-test-role', 'scroller');

    return {
      hasScroller: !!scroller,
      hasTopIndicator: !!topIndicator,
      hasBottomIndicator: !!bottomIndicator
    };
  });
}

test.beforeEach(async ({ page }) => {
  // Spying and mocking setup
  await page.addInitScript(() => {
    (window as any).__spied = {
      intersectionObserversCreated: 0,
      observedElements: [],
      scrollListenersCount: 0,
      getBoundingClientRectCallsAfterInit: 0,
      setIntervalCalls: [],
    };

    // 1. Mock CSS.supports to return false for scroll-state-queries by default.
    // This triggers the fallback path under the tests to verify the fallback logic works.
    const originalSupports = CSS.supports;
    CSS.supports = function(property: string, value?: string) {
      const propLower = property.toLowerCase();
      const valLower = value ? value.toLowerCase() : '';
      if (propLower === 'container-type' && valLower === 'scroll-state') {
        return false;
      }
      if (propLower.includes('scroll-state')) {
        return false;
      }
      return originalSupports.apply(this, arguments as any);
    };

    // 2. Spy on IntersectionObserver
    const OriginalIntersectionObserver = window.IntersectionObserver;
    if (OriginalIntersectionObserver) {
      window.IntersectionObserver = function(this: any, callback: any, options: any) {
        (window as any).__spied.intersectionObserversCreated++;
        const observerInstance = new OriginalIntersectionObserver((entries, observer) => {
          return callback(entries, observer);
        }, options);

        const originalObserve = observerInstance.observe;
        observerInstance.observe = function(this: any, target: Element) {
          (window as any).__spied.observedElements.push({
            tagName: target.tagName.toLowerCase(),
            className: target.className,
            id: target.id,
            width: (target as HTMLElement).offsetWidth,
            height: (target as HTMLElement).offsetHeight,
          });
          return originalObserve.call(this, target);
        };

        return observerInstance;
      } as any;
      window.IntersectionObserver.prototype = OriginalIntersectionObserver.prototype;
    }

    // 3. Spy on EventTarget.prototype.addEventListener to catch scroll listeners
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (type === 'scroll') {
        (window as any).__spied.scrollListenersCount++;
      }
      return originalAddEventListener.call(this, type, listener, options);
    };

    // 4. Spy on Element.prototype.getBoundingClientRect to count calls
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    let isInit = true;
    setTimeout(() => { isInit = false; }, 400); // Allow some initialization time

    Element.prototype.getBoundingClientRect = function() {
      if (!isInit) {
        (window as any).__spied.getBoundingClientRectCallsAfterInit++;
      }
      return originalGetBoundingClientRect.call(this);
    };

    // 5. Spy on setInterval
    const originalSetInterval = window.setInterval;
    window.setInterval = function(this: any, callback: any, delay: any, ...args: any[]) {
      (window as any).__spied.setIntervalCalls.push({ delay });
      return originalSetInterval.call(this, callback, delay, ...args);
    } as any;
  });
});

test('The implementation uses CSS container-scroll-state-queries as the primary method for scroll state detection', async ({ page }) => {
  await page.goto(url);
  const usesContainerQueries = await page.evaluate(() => {
    let foundContainerType = false;
    let foundScrollStateQuery = false;

    function checkRules(rules: CSSRuleList) {
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const cssText = rule.cssText.toLowerCase();

        if (cssText.includes('container-type') && cssText.includes('scroll-state')) {
          foundContainerType = true;
        }

        if (rule.type === 17 || cssText.includes('@container')) {
          if (cssText.includes('scroll-state') || cssText.includes('scrollable')) {
            foundScrollStateQuery = true;
          }
        }

        if ('cssRules' in rule && rule.cssRules) {
          checkRules(rule.cssRules as CSSRuleList);
        }
      }
    }

    for (let i = 0; i < document.styleSheets.length; i++) {
      try {
        const sheet = document.styleSheets[i];
        if (sheet.cssRules) {
          checkRules(sheet.cssRules);
        }
      } catch (e) {
        // Ignore cross-origin stylesheet errors
      }
    }

    return foundContainerType && foundScrollStateQuery;
  });

  expect(usesContainerQueries).toBe(true);
});

test('The implementation includes a fallback for browsers that do not support the feature', async ({ page }) => {
  // Overwrite the init script specifically for this test to mock CSS.supports as TRUE
  await page.addInitScript(() => {
    (window as any).__spied = {
      intersectionObserversCreated: 0,
      observedElements: [],
      scrollListenersCount: 0,
      getBoundingClientRectCallsAfterInit: 0,
      setIntervalCalls: [],
    };
    CSS.supports = function(property: string, value?: string) {
      const propLower = property.toLowerCase();
      const valLower = value ? value.toLowerCase() : '';
      if (propLower === 'container-type' && valLower === 'scroll-state') {
        return true;
      }
      return true;
    };
  });

  await page.goto(url);
  await page.waitForTimeout(500);

  const spied = await page.evaluate(() => (window as any).__spied);
  
  // No JS-based scroll tracking fallback should run if container queries are supported.
  const isFallbackInactiveWhenSupported = 
    spied.intersectionObserversCreated === 0 &&
    spied.scrollListenersCount === 0 &&
    spied.setIntervalCalls.length === 0;

  expect(isFallbackInactiveWhenSupported).toBe(true);
});

test('The fallback uses the IntersectionObserver API on sentinel elements, NOT continuous scroll event listeners or polling with getBoundingClientRect()', async ({ page }) => {
  await page.goto(url);
  await page.waitForTimeout(500);

  const elements = await getPageElements(page);
  const spied = await page.evaluate(() => (window as any).__spied);

  const hasIntersectionObserver = spied.intersectionObserversCreated >= 1;
  const hasAtLeastTwoSentinels = spied.observedElements.length >= 2;
  const allAreSentinels = spied.observedElements.every((el: any) => {
    const name = (el.className + ' ' + el.id).toLowerCase();
    const isSmall = el.width <= 5 && el.height <= 5;
    const hasSentinelName = name.includes('sentinel');
    return isSmall || hasSentinelName;
  });
  const noScrollListeners = spied.scrollListenersCount === 0;
  const noPollingIntervals = spied.setIntervalCalls.length === 0;

  const fallbackRequirementsPassed = 
    !!elements && 
    hasIntersectionObserver && 
    hasAtLeastTwoSentinels && 
    allAreSentinels && 
    noScrollListeners && 
    noPollingIntervals;

  expect(fallbackRequirementsPassed).toBe(true);
});

test('The top indicator is styled to be hidden by default and only becomes visible when the container can be scrolled up', async ({ page }) => {
  await page.goto(url);
  await page.waitForTimeout(300);
  
  const elements = await getPageElements(page);
  if (!elements || !elements.hasScroller || !elements.hasTopIndicator) {
    throw new Error('Required page elements not found');
  }

  const scroller = page.locator('[data-test-role="scroller"]');
  const topIndicator = page.locator('[data-test-role="top-indicator"]');

  // Verify non-interactive
  const pointerEvents = await topIndicator.evaluate((el) => window.getComputedStyle(el).pointerEvents);
  const isNonInteractive = pointerEvents === 'none';

  // Helper to check visibility based on computed styles
  const checkTopVisibility = async () => {
    return await topIndicator.evaluate((el) => {
      const style = window.getComputedStyle(el);
      const opacity = parseFloat(style.opacity || '1');
      return style.display !== 'none' && style.visibility !== 'hidden' && opacity > 0.05;
    });
  };

  // 1. Hidden by default at scrollTop = 0
  const isInitiallyHidden = !(await checkTopVisibility());

  // 2. Scroll down to middle (making container scrollable up)
  await scroller.evaluate((el) => {
    el.scrollTop = 100;
  });
  // Wait for transition/observer
  await page.waitForTimeout(300);
  const isVisibleAfterScroll = await checkTopVisibility();

  // 3. Scroll back to top (making container non-scrollable up)
  await scroller.evaluate((el) => {
    el.scrollTop = 0;
  });
  // Wait for transition/observer
  await page.waitForTimeout(300);
  const isHiddenAfterScrollBack = !(await checkTopVisibility());

  const topIndicatorPassed = 
    isNonInteractive && 
    isInitiallyHidden && 
    isVisibleAfterScroll && 
    isHiddenAfterScrollBack;

  expect(topIndicatorPassed).toBe(true);
});

test('The bottom indicator is styled to be hidden by default and only becomes visible when the container can be scrolled down', async ({ page }) => {
  await page.goto(url);
  await page.waitForTimeout(300);
  
  const elements = await getPageElements(page);
  if (!elements || !elements.hasScroller || !elements.hasBottomIndicator) {
    throw new Error('Required page elements not found');
  }

  const scroller = page.locator('[data-test-role="scroller"]');
  const bottomIndicator = page.locator('[data-test-role="bottom-indicator"]');

  // Verify non-interactive
  const pointerEvents = await bottomIndicator.evaluate((el) => window.getComputedStyle(el).pointerEvents);
  const isNonInteractive = pointerEvents === 'none';

  // Helper to check visibility based on computed styles
  const checkBottomVisibility = async () => {
    return await bottomIndicator.evaluate((el) => {
      const style = window.getComputedStyle(el);
      const opacity = parseFloat(style.opacity || '1');
      return style.display !== 'none' && style.visibility !== 'hidden' && opacity > 0.05;
    });
  };

  // 1. Visible by default at scrollTop = 0 (since it can be scrolled down)
  const isInitiallyVisible = await checkBottomVisibility();

  // 2. Scroll to the very bottom (making container non-scrollable down)
  await scroller.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  // Wait for transition/observer
  await page.waitForTimeout(300);
  const isHiddenAfterScrollToBottom = !(await checkBottomVisibility());

  // 3. Scroll back up a bit (making container scrollable down again)
  await scroller.evaluate((el) => {
    el.scrollTop = el.scrollHeight - el.clientHeight - 50;
  });
  // Wait for transition/observer
  await page.waitForTimeout(300);
  const isVisibleAfterScrollUp = await checkBottomVisibility();

  const bottomIndicatorPassed = 
    isNonInteractive && 
    isInitiallyVisible && 
    isHiddenAfterScrollToBottom && 
    isVisibleAfterScrollUp;

  console.log('DEBUG TEST 5:', {
    isNonInteractive,
    isInitiallyVisible,
    isHiddenAfterScrollToBottom,
    isVisibleAfterScrollUp,
  });

  expect(bottomIndicatorPassed).toBe(true);
});
