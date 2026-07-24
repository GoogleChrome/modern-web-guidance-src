/// <reference types="node" />
import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetFile = process.env.TARGET_FILE || path.join(__dirname, 'demo.html');
const targetUrl = `file://${targetFile}`;

// Helper to click a link inside the currently active (non-inert) view
const clickActiveLink = async (page: any) => {
  const activeLink = page.locator('.Stack-view:not([inert]) a.item, .Stack-view:not([inert]) .item').first();
  if (await activeLink.isVisible()) {
    await activeLink.click({ force: true });
  } else {
    const fallbackLink = page.locator('a.item, .item').first();
    await fallbackLink.click({ force: true });
  }
};

// Helper to click the Back trigger on active view
const clickBackButton = async (page: any) => {
  const backBtn = page.locator('.Stack-view:not([inert]) .icon-back, .Stack-view:not([inert]) .back, .Stack-view:not([inert]) button[aria-label="Back"]');
  if (await backBtn.first().isVisible()) {
    await backBtn.first().click({ force: true });
  } else {
    // Try click the header if no button (fallback for negative demo structure)
    const activeHeader = page.locator('.Stack-view:not([inert]) header, .Stack-view:last-child header');
    await activeHeader.first().click({ force: true });
  }
};

test.describe('Stack Drill Down', () => {

  // --- Stack container and views ---

  test('Stack container uses CSS scroll-snap mandatory', async ({ page }) => {
    await page.goto(targetUrl);
    const snapType = await page.evaluate(() => {
      const stack = document.querySelector('.Stack');
      return stack ? window.getComputedStyle(stack).scrollSnapType : '';
    });
    expect(snapType).toContain('mandatory');
  });

  test('Stack container has overflow-x auto or scroll', async ({ page }) => {
    await page.goto(targetUrl);
    const overflowX = await page.evaluate(() => {
      const stack = document.querySelector('.Stack');
      return stack ? window.getComputedStyle(stack).overflowX : '';
    });
    expect(['auto', 'scroll']).toContain(overflowX);
  });

  test('Each view has width equal to stack width and is not absolutely positioned', async ({ page }) => {
    await page.goto(targetUrl);
    const viewPosition = await page.evaluate(() => {
      const view = document.querySelector('.Stack-view');
      return view ? window.getComputedStyle(view).position : '';
    });
    expect(viewPosition).not.toBe('absolute');
  });

  test('The stack uses overscroll-behavior-x: none', async ({ page }) => {
    await page.goto(targetUrl);
    const overscroll = await page.evaluate(() => {
      const stack = document.querySelector('.Stack');
      return stack ? window.getComputedStyle(stack).overscrollBehaviorX : '';
    });
    expect(overscroll).toBe('none');
  });

  test('The stack uses 100dvh for height', async ({ page }) => {
    await page.goto(targetUrl);
    const uses100dvh = await page.evaluate(() => {
      const findCSSRules = (sheet: CSSStyleSheet) => {
        const rules: CSSRule[] = [];
        const traverse = (ruleList: CSSRuleList | null) => {
          if (!ruleList) return;
          for (let i = 0; i < ruleList.length; i++) {
            const rule = ruleList[i];
            rules.push(rule);
            if ('cssRules' in rule) {
              traverse((rule as any).cssRules);
            }
          }
        };
        try { traverse(sheet.cssRules); } catch (e) {}
        return rules;
      };

      return Array.from(document.styleSheets).some(sheet => {
        return findCSSRules(sheet).some(rule => {
          if (rule instanceof CSSStyleRule && rule.selectorText.includes('.Stack')) {
            const h = rule.style.height || '';
            return h.replace(/\s+/g, '') === '100dvh';
          }
          return false;
        });
      });
    });
    expect(uses100dvh).toBe(true);
  });

  test('Each view applies scroll-snap-align: start', async ({ page }) => {
    await page.goto(targetUrl);
    const align = await page.evaluate(() => {
      const view = document.querySelector('.Stack-view');
      return view ? window.getComputedStyle(view).scrollSnapAlign : '';
    });
    expect(align).toContain('start');
  });

  test('Each view applies scroll-snap-stop: always', async ({ page }) => {
    await page.goto(targetUrl);
    const stop = await page.evaluate(() => {
      const view = document.querySelector('.Stack-view');
      return view ? window.getComputedStyle(view).scrollSnapStop : '';
    });
    expect(stop).toBe('always');
  });

  test('The visible horizontal scrollbar is hidden', async ({ page }) => {
    await page.goto(targetUrl);
    const hasHiddenScrollbar = await page.evaluate(() => {
      const findCSSRules = (sheet: CSSStyleSheet) => {
        const rules: CSSRule[] = [];
        const traverse = (ruleList: CSSRuleList | null) => {
          if (!ruleList) return;
          for (let i = 0; i < ruleList.length; i++) {
            const rule = ruleList[i];
            rules.push(rule);
            if ('cssRules' in rule) {
              traverse((rule as any).cssRules);
            }
          }
        };
        try { traverse(sheet.cssRules); } catch (e) {}
        return rules;
      };

      return Array.from(document.styleSheets).some(sheet => {
        return findCSSRules(sheet).some(rule => {
          if (rule instanceof CSSStyleRule && rule.selectorText.includes('::-webkit-scrollbar')) {
            return rule.style.display === 'none';
          }
          return false;
        });
      });
    });
    expect(hasHiddenScrollbar).toBe(true);
  });

  test('Parallax transform/animation is applied to nested inner element and NOT directly to the snap target', async ({ page }) => {
    await page.goto(targetUrl);
    const validParallax = await page.evaluate(() => {
      const findCSSRules = (sheet: CSSStyleSheet) => {
        const rules: CSSRule[] = [];
        const traverse = (ruleList: CSSRuleList | null) => {
          if (!ruleList) return;
          for (let i = 0; i < ruleList.length; i++) {
            const rule = ruleList[i];
            rules.push(rule);
            if ('cssRules' in rule) {
              traverse((rule as any).cssRules);
            }
          }
        };
        try { traverse(sheet.cssRules); } catch (e) {}
        return rules;
      };

      let bad = false;
      let good = false;
      for (const sheet of Array.from(document.styleSheets)) {
        for (const rule of findCSSRules(sheet)) {
          if (rule instanceof CSSStyleRule) {
            if (rule.selectorText === '.Stack-view' && (rule.style.transform || rule.style.animation || rule.style.transition)) {
              bad = true;
            }
            if (rule.selectorText.includes('.Stack-viewContent') && (rule.style.transform || rule.style.animation || rule.style.animationName)) {
              good = true;
            }
          }
        }
      }
      return !bad && good;
    });
    expect(validParallax).toBe(true);
  });

  // --- Parallax / scroll-driven animation ---

  test('The scroll-driven parallax effect is wrapped in @supports (animation-timeline: view())', async ({ page }) => {
    await page.goto(targetUrl);
    const supportsTimeline = await page.evaluate(() => {
      const findCSSRules = (sheet: CSSStyleSheet) => {
        const rules: CSSRule[] = [];
        const traverse = (ruleList: CSSRuleList | null) => {
          if (!ruleList) return;
          for (let i = 0; i < ruleList.length; i++) {
            const rule = ruleList[i];
            rules.push(rule);
            if ('cssRules' in rule) {
              traverse((rule as any).cssRules);
            }
          }
        };
        try { traverse(sheet.cssRules); } catch (e) {}
        return rules;
      };

      for (const sheet of Array.from(document.styleSheets)) {
        for (const rule of findCSSRules(sheet)) {
          if (rule instanceof CSSSupportsRule) {
            const cond = rule.conditionText;
            if (cond.includes('animation-timeline') || cond.includes('view()')) {
              return true;
            }
          }
        }
      }
      return false;
    });
    expect(supportsTimeline).toBe(true);
  });

  test('Parallax animation uses animation-timeline: view(inline) and animation-range confined to exit phase', async ({ page }) => {
    await page.goto(targetUrl);
    const hasTimelineAndRange = await page.evaluate(() => {
      const findCSSRules = (sheet: CSSStyleSheet) => {
        const rules: CSSRule[] = [];
        const traverse = (ruleList: CSSRuleList | null) => {
          if (!ruleList) return;
          for (let i = 0; i < ruleList.length; i++) {
            const rule = ruleList[i];
            rules.push(rule);
            if ('cssRules' in rule) {
              traverse((rule as any).cssRules);
            }
          }
        };
        try { traverse(sheet.cssRules); } catch (e) {}
        return rules;
      };

      for (const sheet of Array.from(document.styleSheets)) {
        for (const rule of findCSSRules(sheet)) {
          if (rule instanceof CSSStyleRule && rule.selectorText.includes('.Stack-viewContent')) {
            const timeline = (rule.style as any).animationTimeline || '';
            const range = (rule.style as any).animationRange || '';
            if (timeline.includes('view(inline)') && range.includes('exit')) {
              return true;
            }
          }
        }
      }
      return false;
    });
    expect(hasTimelineAndRange).toBe(true);
  });

  test('Drop-shadow is applied to drill-down views but NOT to the root view', async ({ page }) => {
    await page.goto(targetUrl);
    const rootShadow = await page.evaluate(() => {
      const view = document.querySelector('.Stack-view');
      if (!view) return 'none';
      const target = view.querySelector('.Stack-viewContent') || view;
      return window.getComputedStyle(target).boxShadow;
    });
    
    // Drill down to get a drill down view
    await clickActiveLink(page);
    await page.waitForTimeout(100);
    
    const drillDownShadow = await page.evaluate(() => {
      const views = document.querySelectorAll('.Stack-view');
      if (views.length < 2) return 'none';
      const target = views[1].querySelector('.Stack-viewContent') || views[1];
      return window.getComputedStyle(target).boxShadow;
    });

    const rootHasNoShadow = rootShadow === 'none' || rootShadow.includes('rgba(0, 0, 0, 0)') || rootShadow.includes('0px 0px 0px');
    const drillDownHasShadow = drillDownShadow !== 'none' && !drillDownShadow.includes('rgba(0, 0, 0, 0)') && !drillDownShadow.includes('0px 0px 0px');
    
    expect(rootHasNoShadow && drillDownHasShadow).toBe(true);
  });

  // --- Reduced motion ---

  test('scroll-behavior: smooth on the stack is declared only inside prefers-reduced-motion: no-preference', async ({ page }) => {
    await page.goto(targetUrl);
    const hasSmoothScrollOnlyInMedia = await page.evaluate(() => {
      const findCSSRules = (sheet: CSSStyleSheet) => {
        const rules: CSSRule[] = [];
        const traverse = (ruleList: CSSRuleList | null) => {
          if (!ruleList) return;
          for (let i = 0; i < ruleList.length; i++) {
            const rule = ruleList[i];
            rules.push(rule);
            if ('cssRules' in rule) {
              traverse((rule as any).cssRules);
            }
          }
        };
        try { traverse(sheet.cssRules); } catch (e) {}
        return rules;
      };

      let hasBaseSmooth = false;
      let hasMediaSmooth = false;

      for (const sheet of Array.from(document.styleSheets)) {
        for (const rule of findCSSRules(sheet)) {
          if (rule instanceof CSSStyleRule && rule.selectorText.includes('.Stack')) {
            if (rule.style.scrollBehavior === 'smooth') {
              let isMedia = false;
              let currentParent = rule.parentRule;
              while (currentParent) {
                if (currentParent instanceof CSSMediaRule && currentParent.conditionText.includes('prefers-reduced-motion: no-preference')) {
                  isMedia = true;
                  break;
                }
                currentParent = currentParent.parentRule;
              }
              if (isMedia) {
                hasMediaSmooth = true;
              } else {
                hasBaseSmooth = true;
              }
            }
          }
        }
      }
      return !hasBaseSmooth && hasMediaSmooth;
    });
    expect(hasSmoothScrollOnlyInMedia).toBe(true);
  });

  test('Programmatic scrolls are performed and do not use hardcoded smooth behavior', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__scrollCalls = [];
      const originalScrollTo = Element.prototype.scrollTo;
      const originalScrollBy = Element.prototype.scrollBy;
      Element.prototype.scrollTo = function(this: any) {
        const options = arguments[0];
        (window as any).__scrollCalls.push({ method: 'scrollTo', options });
        return originalScrollTo.apply(this, arguments as any);
      };
      Element.prototype.scrollBy = function(this: any) {
        const options = arguments[0];
        (window as any).__scrollCalls.push({ method: 'scrollBy', options });
        return originalScrollBy.apply(this, arguments as any);
      };
    });
    
    await page.goto(targetUrl);
    
    // Drill down to trigger programmatic scroll
    await clickActiveLink(page);
    await page.waitForTimeout(100);
    
    const scrollStatus = await page.evaluate(() => {
      const calls = (window as any).__scrollCalls || [];
      const hasCalls = calls.length > 0;
      const hasSmooth = calls.some((c: any) => c.options?.behavior === 'smooth');
      return { hasCalls, hasSmooth };
    });
    
    expect(scrollStatus.hasCalls && !scrollStatus.hasSmooth).toBe(true);
  });

  // --- Active-view-change detection ---

  test('Active-view-change detection uses scrollsnapchange event on the stack', async ({ page }) => {
    await page.goto(targetUrl);
    
    // Drill down first
    await clickActiveLink(page);
    // Wait for layout and transition to settle
    try {
      await page.waitForFunction(() => {
        const views = document.querySelectorAll('.Stack-view');
        return views.length >= 2 && views[0].hasAttribute('inert');
      }, { timeout: 1500 });
    } catch (e) {}
    
    const result = await page.evaluate(() => {
      const stack = document.querySelector('.Stack');
      const views = document.querySelectorAll('.Stack-view');
      if (!stack || views.length < 2) return { beforeInert: false, afterNotInert: false };
      
      const firstView = views[0];
      const beforeInert = firstView.hasAttribute('inert');
      
      // Dispatch scrollsnapchange to go back to the first view
      const event = new Event('scrollsnapchange');
      Object.defineProperty(event, 'snapTargetInline', { value: firstView, writable: true });
      stack.dispatchEvent(event);
      
      const afterNotInert = !firstView.hasAttribute('inert');
      return { beforeInert, afterNotInert };
    });
    
    expect(result.beforeInert && result.afterNotInert).toBe(true);
  });

  test('An IntersectionObserver fallback is provided for browsers without scrollsnapchange', async ({ page }) => {
    await page.addInitScript(() => {
      // Delete scrollsnapchange support
      delete (HTMLElement.prototype as any).onscrollsnapchange;
      
      (window as any).__intersectionObserverCalls = [];
      const originalObserver = window.IntersectionObserver;
      (window as any).IntersectionObserver = function(callback: any, options: any) {
        (window as any).__intersectionObserverCalls.push({ options });
        return new originalObserver(callback, options);
      };
    });
    
    await page.goto(targetUrl);
    
    const observerConfig = await page.evaluate(() => {
      const calls = (window as any).__intersectionObserverCalls || [];
      const stack = document.querySelector('.Stack');
      const matched = calls.find((c: any) => c.options?.root === stack && c.options?.threshold === 1);
      return !!matched;
    });
    
    expect(observerConfig).toBe(true);
  });

  // --- Inert and focus management ---

  test('Every view except the currently-active one carries the inert attribute', async ({ page }) => {
    await page.goto(targetUrl);
    
    // Initially at root
    const rootInertState = await page.evaluate(() => {
      const views = document.querySelectorAll('.Stack-view');
      if (views.length !== 1) return null;
      return views[0].hasAttribute('inert');
    });
    
    // Drill down
    await clickActiveLink(page);
    // Wait for layout and transition to settle
    try {
      await page.waitForFunction(() => {
        const views = document.querySelectorAll('.Stack-view');
        return views.length >= 2 && views[0].hasAttribute('inert');
      }, { timeout: 1500 });
    } catch (e) {}
    
    const drillInertStates = await page.evaluate(() => {
      const views = document.querySelectorAll('.Stack-view');
      if (views.length < 2) return null;
      return Array.from(views).map(v => v.hasAttribute('inert'));
    });

    expect(rootInertState === false && drillInertStates !== null && drillInertStates[0] === true && drillInertStates[1] === false).toBe(true);
  });

  test('Focus is moved to the back button of a freshly-pushed drill-down view', async ({ page }) => {
    await page.goto(targetUrl);
    
    // Click first link to drill down
    await clickActiveLink(page);
    // Wait for layout and transition to settle
    try {
      await page.waitForFunction(() => {
        const views = document.querySelectorAll('.Stack-view');
        return views.length >= 2 && views[0].hasAttribute('inert');
      }, { timeout: 1500 });
    } catch (e) {}
    
    const focusOnBack = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active) return false;
      const isBackButton = active.classList.contains('icon-back') || active.classList.contains('back') || active.getAttribute('aria-label') === 'Back';
      return isBackButton;
    });
    
    expect(focusOnBack).toBe(true);
  });

  test('Focus is restored to the link originally clicked when navigating back', async ({ page }) => {
    await page.goto(targetUrl);
    
    // Click first link to drill down
    const firstLinkText = await page.evaluate(() => {
      const firstLink = document.querySelector('a.item, .item');
      return firstLink ? firstLink.textContent : '';
    });
    
    await clickActiveLink(page);
    // Wait for layout and transition to settle
    try {
      await page.waitForFunction(() => {
        const views = document.querySelectorAll('.Stack-view');
        return views.length >= 2 && views[0].hasAttribute('inert');
      }, { timeout: 1500 });
    } catch (e) {}
    
    // Now click back
    await clickBackButton(page);
    
    // Wait for back transition to settle
    try {
      await page.waitForFunction(() => {
        const views = document.querySelectorAll('.Stack-view');
        return views.length >= 1 && !views[0].hasAttribute('inert');
      }, { timeout: 1500 });
    } catch (e) {}
    
    const focusOnOriginalLink = await page.evaluate((expectedText) => {
      const active = document.activeElement;
      return active ? active.textContent === expectedText : false;
    }, firstLinkText);
    
    expect(focusOnOriginalLink).toBe(true);
  });

  test('Calls to focus inside the stack pass preventScroll: true', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__focusCalls = [];
      const originalFocus = HTMLElement.prototype.focus;
      HTMLElement.prototype.focus = function(options?: FocusOptions) {
        (window as any).__focusCalls.push({
          tagName: this.tagName,
          preventScroll: options?.preventScroll
        });
        return originalFocus.call(this, options);
      };
    });
    
    await page.goto(targetUrl);
    
    // Click link to drill down
    await clickActiveLink(page);
    // Wait for layout and transition to settle
    try {
      await page.waitForFunction(() => {
        const views = document.querySelectorAll('.Stack-view');
        return views.length >= 2 && views[0].hasAttribute('inert');
      }, { timeout: 1500 });
    } catch (e) {}
    
    const focusPreventScroll = await page.evaluate(() => {
      const calls = (window as any).__focusCalls || [];
      if (calls.length === 0) return false;
      return calls.every((c: any) => c.preventScroll === true);
    });
    
    expect(focusPreventScroll).toBe(true);
  });

  // --- History / URL integration ---

  test('Drilling down calls history.pushState with depth tracking', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__pushStateCalls = [];
      const originalPush = history.pushState;
      history.pushState = function(state: any, title: string, url?: string | null) {
        (window as any).__pushStateCalls.push({ state, url });
        return originalPush.call(this, state, title, url);
      };
    });
    
    await page.goto(targetUrl);
    
    await clickActiveLink(page);
    await page.waitForTimeout(100);
    
    const pushStateCalled = await page.evaluate(() => {
      const calls = (window as any).__pushStateCalls || [];
      if (calls.length === 0) return false;
      const firstCall = calls[0];
      return typeof firstCall.state?.depth === 'number';
    });
    
    expect(pushStateCalled).toBe(true);
  });

  test('A popstate listener on window updates the visible view in response to back navigation', async ({ page }) => {
    await page.goto(targetUrl);
    
    await clickActiveLink(page);
    // Wait for layout and transition to settle
    try {
      await page.waitForFunction(() => {
        const views = document.querySelectorAll('.Stack-view');
        return views.length >= 2 && views[0].hasAttribute('inert');
      }, { timeout: 1500 });
    } catch (e) {}
    
    const initiallyAtDrillDown = await page.evaluate(() => {
      const views = document.querySelectorAll('.Stack-view');
      return views.length === 2 && !views[1].hasAttribute('inert');
    });
    
    await page.goBack();
    // Wait for back transition to settle
    try {
      await page.waitForFunction(() => {
        const views = document.querySelectorAll('.Stack-view');
        return views.length >= 1 && !views[0].hasAttribute('inert');
      }, { timeout: 1500 });
    } catch (e) {}
    
    const returnedToRoot = await page.evaluate(() => {
      const views = document.querySelectorAll('.Stack-view');
      return views.length >= 1 && !views[0].hasAttribute('inert');
    });
    
    expect(initiallyAtDrillDown && returnedToRoot).toBe(true);
  });

  test('Reconciles history via history.go when a manual scroll changes active view depth', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__goCalls = [];
      const originalGo = history.go;
      history.go = function(delta?: number) {
        (window as any).__goCalls.push(delta);
        return originalGo.call(this, delta);
      };
    });
    
    await page.goto(targetUrl);
    
    // Drill down first
    await clickActiveLink(page);
    // Wait for layout and transition to settle
    try {
      await page.waitForFunction(() => {
        const views = document.querySelectorAll('.Stack-view');
        return views.length >= 2 && views[0].hasAttribute('inert');
      }, { timeout: 1500 });
    } catch (e) {}
    
    const goCalled = await page.evaluate(() => {
      const stack = document.querySelector('.Stack');
      const views = document.querySelectorAll('.Stack-view');
      if (!stack || views.length < 2) return false;
      
      const event = new Event('scrollsnapchange');
      Object.defineProperty(event, 'snapTargetInline', { value: views[0], writable: true });
      stack.dispatchEvent(event);
      
      const calls = (window as any).__goCalls || [];
      return calls.includes(-1);
    });
    
    expect(goCalled).toBe(true);
  });

  test('Deep links are handled on initial load and depth-0 is seeded with replaceState', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__replaceCalls = [];
      const originalReplace = history.replaceState;
      history.replaceState = function(state: any, title: string, url?: string | null) {
        (window as any).__replaceCalls.push({ state, url });
        return originalReplace.call(this, state, title, url);
      };
    });
    
    await page.goto(`${targetUrl}#/view/1`);
    await page.waitForTimeout(100);
    
    const deepLinkHandled = await page.evaluate(() => {
      const views = document.querySelectorAll('.Stack-view');
      const onlyOneView = views.length === 1;
      
      const calls = (window as any).__replaceCalls || [];
      const seededDepth0 = calls.some((c: any) => c.state?.depth === 0);
      
      return onlyOneView && seededDepth0;
    });
    
    expect(deepLinkHandled).toBe(true);
  });

  test('Synthesizes a root entry when Back is clicked from a deep-linked entry with no in-app history', async ({ page }) => {
    await page.goto(`${targetUrl}#/view/1`);
    await page.waitForTimeout(100);
    
    await clickBackButton(page);
    // Wait for synthesized view to settle
    try {
      await page.waitForFunction(() => {
        const views = document.querySelectorAll('.Stack-view');
        return views.length >= 2 && !views[0].hasAttribute('inert');
      }, { timeout: 1500 });
    } catch (e) {}
    
    const synthesized = await page.evaluate(() => {
      const views = document.querySelectorAll('.Stack-view');
      const hasMultipleViews = views.length >= 2;
      const rootVisible = !views[0].hasAttribute('inert');
      return hasMultipleViews && rootVisible;
    });
    
    expect(synthesized).toBe(true);
  });

  // --- Click handling ---

  test('Drill-down triggers are real anchor elements with href attributes', async ({ page }) => {
    await page.goto(targetUrl);
    
    const realAnchors = await page.evaluate(() => {
      const items = document.querySelectorAll('.item');
      if (items.length === 0) return false;
      return Array.from(items).every(item => item.tagName === 'A' && item.hasAttribute('href'));
    });
    
    expect(realAnchors).toBe(true);
  });

  test('Click handler preserves modifier keys and middle click behavior', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__preventDefaultCalled = false;
      const originalPreventDefault = Event.prototype.preventDefault;
      Event.prototype.preventDefault = function() {
        (window as any).__preventDefaultCalled = true;
        return originalPreventDefault.call(this);
      };
    });
    
    await page.goto(targetUrl);
    
    const link = page.locator('.Stack-view:not([inert]) a.item, .Stack-view:not([inert]) .item, a.item, .item').first();
    if (await link.isVisible()) {
      await link.click({ modifiers: ['Shift'], force: true });
      await page.waitForTimeout(100);
    }
    
    const preventDefaultPreserved = await page.evaluate(() => {
      return (window as any).__preventDefaultCalled === false;
    });
    
    const isAnchor = await page.evaluate(() => {
      const item = document.querySelector('.item');
      return item ? item.tagName === 'A' : false;
    });
    
    expect(isAnchor && preventDefaultPreserved).toBe(true);
  });

  test('Clicks on external links do not trigger drill-down or call preventDefault', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__preventDefaultCalled = false;
      const originalPreventDefault = Event.prototype.preventDefault;
      Event.prototype.preventDefault = function() {
        (window as any).__preventDefaultCalled = true;
        return originalPreventDefault.call(this);
      };

      // Prevent actual navigation to keep context, using raw preventDefault
      window.addEventListener('click', (e) => {
        const link = (e.target as HTMLElement).closest('a');
        if (link && link.classList.contains('external-item')) {
          originalPreventDefault.call(e);
        }
      }, { capture: true });
    });
    
    await page.goto(targetUrl);
    
    await page.evaluate(() => {
      const firstView = document.querySelector('.Stack-view');
      if (firstView) {
        const externalLink = document.createElement('a');
        externalLink.className = 'external-item';
        externalLink.href = 'https://example.com/external';
        externalLink.textContent = 'External Link';
        firstView.appendChild(externalLink);
      }
    });
    
    const link = page.locator('.external-item');
    if (await link.isVisible()) {
      try {
        await link.click({ timeout: 1000, force: true });
      } catch (e) {
        // ignore navigation timeout
      }
    }
    
    const preventDefaultNotCalled = await page.evaluate(() => {
      return (window as any).__preventDefaultCalled === false;
    });
    
    const isScrollSnap = await page.evaluate(() => {
      const stack = document.querySelector('.Stack');
      return stack ? window.getComputedStyle(stack).scrollSnapType !== 'none' : false;
    });

    expect(preventDefaultNotCalled && isScrollSnap).toBe(true);
  });

  // --- Back button ---

  test('Drill-down views have an explicit back button, but root view does not', async ({ page }) => {
    await page.goto(targetUrl);
    
    const rootHasBack = await page.evaluate(() => {
      const root = document.querySelector('.Stack-view');
      if (!root) return false;
      const back = root.querySelector('.icon-back, .back, button[aria-label="Back"]');
      return !!back;
    });
    
    await clickActiveLink(page);
    await page.waitForTimeout(100);
    
    const drillDownHasBack = await page.evaluate(() => {
      const views = document.querySelectorAll('.Stack-view');
      if (views.length < 2) return false;
      const back = views[1].querySelector('.icon-back, .back, button[aria-label="Back"]');
      return !!back;
    });
    
    expect(!rootHasBack && drillDownHasBack).toBe(true);
  });

  // --- Scroll behavior selection on popstate ---

  test('Scroll behavior on popstate is correctly selected based on transition type', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__scrollCalls = [];
      const originalScrollTo = Element.prototype.scrollTo;
      Element.prototype.scrollTo = function(this: any) {
        const options = arguments[0];
        (window as any).__scrollCalls.push({ options });
        return originalScrollTo.apply(this, arguments as any);
      };
    });
    
    await page.goto(targetUrl);
    
    await clickActiveLink(page);
    // Wait for layout and transition to settle (first view becomes inert)
    try {
      await page.waitForFunction(() => {
        const views = document.querySelectorAll('.Stack-view');
        return views.length >= 2 && views[0].hasAttribute('inert');
      }, { timeout: 1500 });
    } catch (e) {}
    
    await page.goBack();
    // Wait for back scroll to settle (first view loses inert)
    try {
      await page.waitForFunction(() => {
        const views = document.querySelectorAll('.Stack-view');
        return views.length >= 1 && !views[0].hasAttribute('inert');
      }, { timeout: 1500 });
    } catch (e) {}
    
    await page.goForward();
    // Wait for forward scroll to settle (first view becomes inert again)
    try {
      await page.waitForFunction(() => {
        const views = document.querySelectorAll('.Stack-view');
        return views.length >= 2 && views[0].hasAttribute('inert');
      }, { timeout: 1500 });
    } catch (e) {}
    
    const behaviors = await page.evaluate(() => {
      const calls = (window as any).__scrollCalls || [];
      if (calls.length < 2) return null;
      return calls.map((c: any) => c.options?.behavior);
    });
    
    expect(behaviors !== null && behaviors[0] === 'auto' && behaviors[1] === 'instant').toBe(true);
  });

  // --- View pruning and rebuild ---

  test('Views that are swiped or navigated back past are removed from the DOM', async ({ page }) => {
    await page.goto(targetUrl);
    
    await clickActiveLink(page);
    // Wait for first view to become inert
    try {
      await page.waitForFunction(() => {
        const views = document.querySelectorAll('.Stack-view');
        return views.length >= 2 && views[0].hasAttribute('inert');
      }, { timeout: 1500 });
    } catch (e) {}
    
    await clickActiveLink(page);
    // Wait for second view to become inert
    try {
      await page.waitForFunction(() => {
        const views = document.querySelectorAll('.Stack-view');
        return views.length >= 3 && views[1].hasAttribute('inert');
      }, { timeout: 1500 });
    } catch (e) {}
    
    const threeViewsInDOM = await page.evaluate(() => {
      return document.querySelectorAll('.Stack-view').length === 3;
    });
    
    await page.goBack();
    await page.waitForTimeout(100);
    await page.goBack();
    // Wait for actual pruning to complete (views after root removed)
    try {
      await page.waitForFunction(() => {
        return document.querySelectorAll('.Stack-view').length === 1;
      }, { timeout: 2000 });
    } catch (e) {}
    
    const viewsPruned = await page.evaluate(() => {
      return document.querySelectorAll('.Stack-view').length === 1;
    });
    
    expect(threeViewsInDOM && viewsPruned).toBe(true);
  });

  test('Pruned views are successfully rebuilt from URL on forward navigation', async ({ page }) => {
    await page.goto(targetUrl);
    
    await clickActiveLink(page);
    // Wait for first view to become inert
    try {
      await page.waitForFunction(() => {
        const views = document.querySelectorAll('.Stack-view');
        return views.length >= 2 && views[0].hasAttribute('inert');
      }, { timeout: 1500 });
    } catch (e) {}
    
    const firstDrillDownText = await page.evaluate(() => {
      const headers = document.querySelectorAll('.Stack-view h2');
      return headers.length > 0 ? headers[headers.length - 1].textContent : '';
    });
    
    await page.goBack();
    // Wait for pruning to settle (only 1 view left in DOM)
    try {
      await page.waitForFunction(() => {
        return document.querySelectorAll('.Stack-view').length === 1;
      }, { timeout: 2000 });
    } catch (e) {}
    
    const isPruned = await page.evaluate(() => {
      return document.querySelectorAll('.Stack-view').length === 1;
    });
    
    await page.goForward();
    // Wait for view to be rebuilt and h2 to be rendered
    try {
      await page.waitForFunction(() => {
        return document.querySelectorAll('.Stack-view h2').length > 0;
      }, { timeout: 2000 });
    } catch (e) {}
    
    const rebuiltText = await page.evaluate(() => {
      const headers = document.querySelectorAll('.Stack-view h2');
      return headers.length > 0 ? headers[headers.length - 1].textContent : '';
    });
    
    expect(isPruned && rebuiltText === firstDrillDownText && rebuiltText !== '').toBe(true);
  });

});
