/// <reference types="node" />
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetFile = process.env.TARGET_FILE || path.join(__dirname, 'demo.html');
const targetDir = path.dirname(targetFile);
const targetUrl = `http://localhost/${path.basename(targetFile)}`;

const STACK_SEL = '.Stack, .stack';
const VIEW_SEL = '.Stack-view, .stack-view';
const VIEW_CONTENT_SEL = '.Stack-viewContent, .stack-view-content, .view-content';
const BACK_SEL = '.icon-back, .back, [class*="back" i], button[aria-label*="Back" i]';

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost/**', async (route) => {
    const reqUrl = new URL(route.request().url());
    const relPath = decodeURIComponent(reqUrl.pathname).replace(/^\/+/, '');
    let filePath = path.resolve(targetDir, relPath || path.basename(targetFile));

    if (!filePath.startsWith(targetDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      // Support pathname-based routing (e.g. /menu, /view/1) by serving targetFile
      if (!path.extname(relPath)) {
        filePath = targetFile;
      } else {
        await route.abort();
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.mjs': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
    };

    await route.fulfill({
      status: 200,
      contentType: contentTypeMap[ext] || 'text/html; charset=utf-8',
      body: fs.readFileSync(filePath),
    });
  });
});

const ITEM_LINK_SEL =
  '.Stack-view:not([inert]) a.item, .Stack-view:not([inert]) .item, .stack-view:not([inert]) a.item, .stack-view:not([inert]) .item';
const MAIN_DRILL_LINK_SEL =
  '.Stack-view:not([inert]) main a[href]:not(.external-item):not([href^="http"]):not([href^="mailto:"]):not([href="/order-online"]), .stack-view:not([inert]) main a[href]:not(.external-item):not([href^="http"]):not([href^="mailto:"]):not([href="/order-online"])';
const FALLBACK_DRILL_LINK_SEL =
  '.Stack-view:not([inert]) a[href]:not(nav a):not(header a):not(footer a):not(.external-item):not([href^="http"]):not([href^="mailto:"]):not([href="/order-online"]), .stack-view:not([inert]) a[href]:not(nav a):not(header a):not(footer a):not(.external-item):not([href^="http"]):not([href^="mailto:"]):not([href="/order-online"])';

const getActiveDrillLink = async (page: any) => {
  for (const sel of [ITEM_LINK_SEL, MAIN_DRILL_LINK_SEL, FALLBACK_DRILL_LINK_SEL]) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0 && (await loc.isVisible())) {
      return loc;
    }
  }
  return page.locator('a.item, .item, main a[href], .Stack-view a[href], .stack-view a[href]').first();
};

const clickActiveLink = async (page: any) => {
  const link = await getActiveDrillLink(page);
  await link.click({ force: true });
};

const clickBackButton = async (page: any) => {
  const backBtn = page.locator(
    `.Stack-view:not([inert]) .icon-back, .Stack-view:not([inert]) .back, .Stack-view:not([inert]) [class*="back" i], .Stack-view:not([inert]) button[aria-label*="Back" i], .stack-view:not([inert]) .icon-back, .stack-view:not([inert]) .back, .stack-view:not([inert]) [class*="back" i], .stack-view:not([inert]) button[aria-label*="Back" i]`
  );
  if ((await backBtn.count()) > 0 && (await backBtn.first().isVisible())) {
    await backBtn.first().click({ force: true });
  } else {
    const activeHeader = page.locator('.Stack-view:not([inert]) header, .Stack-view:last-child header, .stack-view:not([inert]) header, .stack-view:last-child header');
    await activeHeader.first().click({ force: true });
  }
};

const getDeepLinkUrl = async (page: any): Promise<string> => {
  await page.goto(targetUrl);
  const link = await getActiveDrillLink(page);
  const href = (await link.count()) > 0 ? await link.getAttribute('href') : null;
  await page.goto('about:blank');
  if (href) {
    if (href.startsWith('#')) return `${targetUrl}${href}`;
    if (href.startsWith('/')) return `http://localhost${href}`;
  }
  return `${targetUrl}#/view/1`;
};

test.describe('Stack Drill Down', () => {

  // --- Stack container and views ---

  test('Stack container uses CSS scroll-snap mandatory', async ({ page }) => {
    await page.goto(targetUrl);
    const snapType = await page.evaluate((sel) => {
      const stack = document.querySelector(sel);
      return stack ? window.getComputedStyle(stack).scrollSnapType : '';
    }, STACK_SEL);
    expect(snapType).toContain('mandatory');
  });

  test('Stack container has overflow-x auto or scroll', async ({ page }) => {
    await page.goto(targetUrl);
    const overflowX = await page.evaluate((sel) => {
      const stack = document.querySelector(sel);
      return stack ? window.getComputedStyle(stack).overflowX : '';
    }, STACK_SEL);
    expect(['auto', 'scroll']).toContain(overflowX);
  });

  test('Each view has width equal to stack width and is not absolutely positioned', async ({ page }) => {
    await page.goto(targetUrl);
    const valid = await page.evaluate(({ stackSel, viewSel }) => {
      const stack = document.querySelector(stackSel);
      const view = document.querySelector(viewSel);
      if (!stack || !view) return false;
      const pos = window.getComputedStyle(view).position;
      const stackWidth = stack.getBoundingClientRect().width;
      const viewWidth = view.getBoundingClientRect().width;
      return pos !== 'absolute' && stackWidth > 0 && Math.abs(viewWidth - stackWidth) <= 1;
    }, { stackSel: STACK_SEL, viewSel: VIEW_SEL });
    expect(valid).toBe(true);
  });

  test('The stack uses overscroll-behavior-x: none', async ({ page }) => {
    await page.goto(targetUrl);
    const overscroll = await page.evaluate((sel) => {
      const stack = document.querySelector(sel);
      return stack ? window.getComputedStyle(stack).overscrollBehaviorX : '';
    }, STACK_SEL);
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
          if (rule instanceof CSSStyleRule && rule.selectorText.toLowerCase().includes('.stack')) {
            const h = rule.style.height || rule.style.blockSize || '';
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
    const align = await page.evaluate((sel) => {
      const view = document.querySelector(sel);
      return view ? window.getComputedStyle(view).scrollSnapAlign : '';
    }, VIEW_SEL);
    expect(align).toContain('start');
  });

  test('Each view applies scroll-snap-stop: always', async ({ page }) => {
    await page.goto(targetUrl);
    const stop = await page.evaluate((sel) => {
      const view = document.querySelector(sel);
      return view ? window.getComputedStyle(view).scrollSnapStop : '';
    }, VIEW_SEL);
    expect(stop).toBe('always');
  });

  test('The visible horizontal scrollbar is hidden', async ({ page }) => {
    await page.goto(targetUrl);
    const hasHiddenScrollbar = await page.evaluate((stackSel) => {
      const stack = document.querySelector(stackSel);
      if (stack && window.getComputedStyle(stack).scrollbarWidth === 'none') {
        return true;
      }

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
          if (rule instanceof CSSStyleRule) {
            if (rule.selectorText.includes('::-webkit-scrollbar') && rule.style.display === 'none') {
              return true;
            }
            if (rule.selectorText.toLowerCase().includes('.stack') && (rule.style as any).scrollbarWidth === 'none') {
              return true;
            }
          }
          return false;
        });
      });
    }, STACK_SEL);
    expect(hasHiddenScrollbar).toBe(true);
  });

  test('Parallax transform/animation is applied to nested inner element and NOT directly to the snap target', async ({ page }) => {
    await page.goto(targetUrl);
    const validParallax = await page.evaluate(({ viewSel, contentSel }) => {
      const view = document.querySelector(viewSel);
      const innerEl = (view?.querySelector(contentSel) || view?.firstElementChild) as HTMLElement | null;
      if (!view || !innerEl) return false;
      const innerStyle = window.getComputedStyle(innerEl);
      const hasVerticalScroll = ['auto', 'scroll'].includes(innerStyle.overflowY);
      const hasOpaqueBg = innerStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && innerStyle.backgroundColor !== 'transparent';

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
            const sel = rule.selectorText.toLowerCase();
            if (sel === '.stack-view' && (rule.style.transform || rule.style.animation || rule.style.transition)) {
              bad = true;
            }
            let matchesInner = sel.includes('.stack-viewcontent') || sel.includes('.stack-view-content') || sel.includes('.view-content');
            if (!matchesInner) {
              try { matchesInner = innerEl.matches(rule.selectorText) && !view.matches(rule.selectorText); } catch (e) {}
            }
            if (matchesInner && (rule.style.transform || rule.style.animation || rule.style.animationName)) {
              good = true;
            }
          }
        }
      }
      return !bad && good && hasVerticalScroll && hasOpaqueBg;
    }, { viewSel: VIEW_SEL, contentSel: VIEW_CONTENT_SEL });
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
    const hasTimelineAndRange = await page.evaluate(({ viewSel, contentSel }) => {
      const view = document.querySelector(viewSel);
      const innerEl = (view?.querySelector(contentSel) || view?.firstElementChild) as HTMLElement | null;

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
          if (rule instanceof CSSStyleRule) {
            const sel = rule.selectorText.toLowerCase();
            let matchesInner = sel.includes('.stack-viewcontent') || sel.includes('.stack-view-content') || sel.includes('.view-content');
            if (!matchesInner && innerEl && view) {
              try { matchesInner = innerEl.matches(rule.selectorText) && !view.matches(rule.selectorText); } catch (e) {}
            }
            if (matchesInner) {
              const timeline = (rule.style as any).animationTimeline || '';
              const range = (rule.style as any).animationRange || '';
              if (timeline.includes('view(inline)') && range.includes('exit')) {
                return true;
              }
            }
          }
        }
      }
      return false;
    }, { viewSel: VIEW_SEL, contentSel: VIEW_CONTENT_SEL });
    expect(hasTimelineAndRange).toBe(true);
  });

  test('Drop-shadow is applied to drill-down views but NOT to the root view', async ({ page }) => {
    await page.goto(targetUrl);
    const rootShadow = await page.evaluate(({ viewSel, contentSel }) => {
      const view = document.querySelector(viewSel);
      if (!view) return 'none';
      const target = view.querySelector(contentSel) || view;
      return window.getComputedStyle(target).boxShadow;
    }, { viewSel: VIEW_SEL, contentSel: VIEW_CONTENT_SEL });
    
    await clickActiveLink(page);
    await page.waitForTimeout(100);
    
    const drillDownShadow = await page.evaluate(({ viewSel, contentSel }) => {
      const views = document.querySelectorAll(viewSel);
      if (views.length < 2) return 'none';
      const target = views[1].querySelector(contentSel) || views[1];
      return window.getComputedStyle(target).boxShadow;
    }, { viewSel: VIEW_SEL, contentSel: VIEW_CONTENT_SEL });

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
          if (rule instanceof CSSStyleRule && rule.selectorText.toLowerCase().includes('.stack')) {
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
    
    await clickActiveLink(page);
    try {
      await page.waitForFunction((viewSel: string) => {
        const views = document.querySelectorAll(viewSel);
        return views.length >= 2 && views[0].hasAttribute('inert');
      }, VIEW_SEL, { timeout: 1500 });
    } catch (e) {}
    
    const result = await page.evaluate(({ stackSel, viewSel }) => {
      const stack = document.querySelector(stackSel);
      const views = document.querySelectorAll(viewSel);
      if (!stack || views.length < 2) return { beforeInert: false, afterNotInert: false };
      
      const firstView = views[0];
      const beforeInert = firstView.hasAttribute('inert');
      
      const event = new Event('scrollsnapchange');
      Object.defineProperty(event, 'snapTargetInline', { value: firstView, writable: true });
      stack.dispatchEvent(event);
      
      const afterNotInert = !firstView.hasAttribute('inert');
      return { beforeInert, afterNotInert };
    }, { stackSel: STACK_SEL, viewSel: VIEW_SEL });
    
    expect(result.beforeInert && result.afterNotInert).toBe(true);
  });

  test('An IntersectionObserver fallback is provided for browsers without scrollsnapchange', async ({ page }) => {
    await page.addInitScript(() => {
      delete (HTMLElement.prototype as any).onscrollsnapchange;
      
      (window as any).__intersectionObserverCalls = [];
      const originalObserver = window.IntersectionObserver;
      (window as any).IntersectionObserver = function(callback: any, options: any) {
        (window as any).__intersectionObserverCalls.push({ options });
        return new originalObserver(callback, options);
      };
    });
    
    await page.goto(targetUrl);
    
    const observerConfig = await page.evaluate((stackSel) => {
      const calls = (window as any).__intersectionObserverCalls || [];
      const stack = document.querySelector(stackSel);
      const matched = calls.find((c: any) => {
        const t = c.options?.threshold;
        const isOne = t === 1 || (Array.isArray(t) && t.length === 1 && t[0] === 1);
        return c.options?.root === stack && isOne;
      });
      return !!matched;
    }, STACK_SEL);
    
    expect(observerConfig).toBe(true);
  });

  // --- Inert, focus management, and DOM pruning ---

  test('Every view except the currently-active one carries the inert attribute', async ({ page }) => {
    await page.goto(targetUrl);
    
    const rootInertState = await page.evaluate((viewSel) => {
      const views = document.querySelectorAll(viewSel);
      if (views.length !== 1) return null;
      return views[0].hasAttribute('inert');
    }, VIEW_SEL);
    
    await clickActiveLink(page);
    try {
      await page.waitForFunction((viewSel: string) => {
        const views = document.querySelectorAll(viewSel);
        return views.length >= 2 && views[0].hasAttribute('inert');
      }, VIEW_SEL, { timeout: 1500 });
    } catch (e) {}
    
    const drillInertStates = await page.evaluate((viewSel) => {
      const views = document.querySelectorAll(viewSel);
      if (views.length < 2) return null;
      return Array.from(views).map(v => v.hasAttribute('inert'));
    }, VIEW_SEL);

    expect(rootInertState === false && drillInertStates !== null && drillInertStates[0] === true && drillInertStates[1] === false).toBe(true);
  });

  test('Views that are swiped or navigated back past are removed from the DOM', async ({ page }) => {
    await page.goto(targetUrl);
    
    await clickActiveLink(page);
    try {
      await page.waitForFunction((viewSel: string) => {
        const views = document.querySelectorAll(viewSel);
        return views.length >= 2 && views[0].hasAttribute('inert');
      }, VIEW_SEL, { timeout: 1500 });
    } catch (e) {}
    
    const twoViewsInDOM = await page.evaluate((viewSel) => {
      return document.querySelectorAll(viewSel).length >= 2;
    }, VIEW_SEL);
    
    await page.goBack();
    try {
      await page.waitForFunction((viewSel: string) => {
        return document.querySelectorAll(viewSel).length === 1;
      }, VIEW_SEL, { timeout: 2000 });
    } catch (e) {}
    
    const viewsPruned = await page.evaluate((viewSel) => {
      return document.querySelectorAll(viewSel).length === 1;
    }, VIEW_SEL);
    
    expect(twoViewsInDOM && viewsPruned).toBe(true);
  });

  test('Focus is moved to the back button of a freshly-pushed drill-down view', async ({ page }) => {
    await page.goto(targetUrl);
    
    await clickActiveLink(page);
    try {
      await page.waitForFunction((viewSel: string) => {
        const views = document.querySelectorAll(viewSel);
        return views.length >= 2 && views[0].hasAttribute('inert');
      }, VIEW_SEL, { timeout: 1500 });
    } catch (e) {}
    
    const focusOnBack = await page.evaluate((backSel) => {
      const active = document.activeElement;
      if (!active) return false;
      return active.matches(backSel);
    }, BACK_SEL);
    
    expect(focusOnBack).toBe(true);
  });

  test('Focus is restored to the link originally clicked when navigating back', async ({ page }) => {
    await page.goto(targetUrl);
    
    const firstLink = await getActiveDrillLink(page);
    const firstLinkHref = (await firstLink.getAttribute('href')) || '';
    const firstLinkText = ((await firstLink.textContent()) || '').trim();
    
    await clickActiveLink(page);
    try {
      await page.waitForFunction((viewSel: string) => {
        const views = document.querySelectorAll(viewSel);
        return views.length >= 2 && views[0].hasAttribute('inert');
      }, VIEW_SEL, { timeout: 1500 });
    } catch (e) {}
    
    await clickBackButton(page);
    
    try {
      await page.waitForFunction((viewSel: string) => {
        const views = document.querySelectorAll(viewSel);
        return views.length >= 1 && !views[0].hasAttribute('inert');
      }, VIEW_SEL, { timeout: 1500 });
    } catch (e) {}
    
    const focusOnOriginalLink = await page.evaluate(({ expectedHref, expectedText }) => {
      const active = document.activeElement;
      if (!active) return false;
      const href = active.getAttribute('href') || '';
      const text = (active.textContent || '').trim();
      return (expectedHref !== '' && href === expectedHref) || text === expectedText;
    }, { expectedHref: firstLinkHref, expectedText: firstLinkText });
    
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
    await clickActiveLink(page);
    try {
      await page.waitForFunction((viewSel: string) => {
        const views = document.querySelectorAll(viewSel);
        return views.length >= 2 && views[0].hasAttribute('inert');
      }, VIEW_SEL, { timeout: 1500 });
    } catch (e) {}
    
    const focusPreventScroll = await page.evaluate(() => {
      const calls = (window as any).__focusCalls || [];
      if (calls.length === 0) return false;
      return calls.every((c: any) => c.preventScroll === true);
    });
    
    expect(focusPreventScroll).toBe(true);
  });

  // --- Click handling, back button, and History sync ---

  test('Drill-down triggers are real anchor elements with href attributes', async ({ page }) => {
    await page.goto(targetUrl);
    
    const realAnchors = await page.evaluate((viewSel) => {
      const items = document.querySelectorAll('.item');
      if (items.length > 0) {
        return Array.from(items).every(item => item.tagName === 'A' && item.hasAttribute('href'));
      }
      const viewAnchors = document.querySelectorAll(`:is(${viewSel}) a[href]`);
      return viewAnchors.length > 0;
    }, VIEW_SEL);
    
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
    
    const link = await getActiveDrillLink(page);
    if (await link.isVisible()) {
      await link.click({ modifiers: ['Shift'], force: true });
      await page.waitForTimeout(100);
    }
    
    const preventDefaultPreserved = await page.evaluate(() => {
      return (window as any).__preventDefaultCalled === false;
    });
    
    const isAnchor = await page.evaluate((viewSel) => {
      const item = document.querySelector('.item');
      if (item) return item.tagName === 'A';
      return document.querySelectorAll(`:is(${viewSel}) a[href]`).length > 0;
    }, VIEW_SEL);
    
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

      window.addEventListener('click', (e) => {
        const link = (e.target as HTMLElement).closest('a');
        if (link && link.classList.contains('external-item')) {
          originalPreventDefault.call(e);
        }
      }, { capture: false });
    });
    
    await page.goto(targetUrl);
    
    await page.evaluate((viewSel) => {
      const firstView = document.querySelector(viewSel);
      if (firstView) {
        const externalLink = document.createElement('a');
        externalLink.className = 'external-item';
        externalLink.href = 'https://example.com/external';
        externalLink.textContent = 'External Link';
        firstView.appendChild(externalLink);
      }
    }, VIEW_SEL);
    
    const link = page.locator('.external-item');
    if (await link.isVisible()) {
      try {
        await link.click({ timeout: 1000, force: true });
      } catch (e) {}
    }
    
    const preventDefaultNotCalled = await page.evaluate(() => {
      return (window as any).__preventDefaultCalled === false;
    });
    
    const isScrollSnap = await page.evaluate((stackSel) => {
      const stack = document.querySelector(stackSel);
      return stack ? window.getComputedStyle(stack).scrollSnapType !== 'none' : false;
    }, STACK_SEL);

    expect(preventDefaultNotCalled && isScrollSnap).toBe(true);
  });

  test('Drill-down views have an explicit back button, but root view does not', async ({ page }) => {
    await page.goto(targetUrl);
    
    const rootHasBack = await page.evaluate(({ viewSel, backSel }) => {
      const root = document.querySelector(viewSel);
      if (!root) return false;
      const back = root.querySelector(backSel);
      return !!back;
    }, { viewSel: VIEW_SEL, backSel: BACK_SEL });
    
    await clickActiveLink(page);
    await page.waitForTimeout(100);
    
    const drillDownHasBack = await page.evaluate(({ viewSel, backSel }) => {
      const views = document.querySelectorAll(viewSel);
      if (views.length < 2) return false;
      const back = views[1].querySelector(backSel);
      return !!back;
    }, { viewSel: VIEW_SEL, backSel: BACK_SEL });
    
    expect(!rootHasBack && drillDownHasBack).toBe(true);
  });

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
      return calls.some((c: any) => typeof c.state?.depth === 'number' || Boolean(c.url));
    });
    
    expect(pushStateCalled).toBe(true);
  });

  test('A popstate listener on window updates the visible view in response to back navigation', async ({ page }) => {
    await page.goto(targetUrl);
    
    await clickActiveLink(page);
    try {
      await page.waitForFunction((viewSel: string) => {
        const views = document.querySelectorAll(viewSel);
        return views.length >= 2 && views[0].hasAttribute('inert');
      }, VIEW_SEL, { timeout: 1500 });
    } catch (e) {}
    
    const initiallyAtDrillDown = await page.evaluate((viewSel) => {
      const views = document.querySelectorAll(viewSel);
      return views.length === 2 && !views[1].hasAttribute('inert');
    }, VIEW_SEL);
    
    await page.goBack();
    try {
      await page.waitForFunction((viewSel: string) => {
        const views = document.querySelectorAll(viewSel);
        return views.length >= 1 && !views[0].hasAttribute('inert');
      }, VIEW_SEL, { timeout: 1500 });
    } catch (e) {}
    
    const returnedToRoot = await page.evaluate((viewSel) => {
      const views = document.querySelectorAll(viewSel);
      return views.length >= 1 && !views[0].hasAttribute('inert');
    }, VIEW_SEL);
    
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
    
    await clickActiveLink(page);
    try {
      await page.waitForFunction((viewSel: string) => {
        const views = document.querySelectorAll(viewSel);
        return views.length >= 2 && views[0].hasAttribute('inert');
      }, VIEW_SEL, { timeout: 1500 });
    } catch (e) {}
    
    const goCalled = await page.evaluate(({ stackSel, viewSel }) => {
      const stack = document.querySelector(stackSel);
      const views = document.querySelectorAll(viewSel);
      if (!stack || views.length < 2) return false;
      
      const event = new Event('scrollsnapchange');
      Object.defineProperty(event, 'snapTargetInline', { value: views[0], writable: true });
      stack.dispatchEvent(event);
      
      const calls = (window as any).__goCalls || [];
      return calls.includes(-1);
    }, { stackSel: STACK_SEL, viewSel: VIEW_SEL });
    
    expect(goCalled).toBe(true);
  });

  test('Loading a deep-linked URL opens the drill-down view and Back navigates to the root view', async ({ page }) => {
    const deepLinkUrl = await getDeepLinkUrl(page);
    await page.goto(deepLinkUrl);
    try {
      await page.waitForFunction(({ viewSel, backSel }: { viewSel: string; backSel: string }) => {
        const activeView = document.querySelector(`:is(${viewSel}):not([inert])`) || document.querySelector(`:is(${viewSel}):last-child`);
        return !!activeView?.querySelector(backSel);
      }, { viewSel: VIEW_SEL, backSel: BACK_SEL }, { timeout: 1500 });
    } catch (e) {}
    
    const openedDeepView = await page.evaluate(({ viewSel, backSel }) => {
      const activeView = document.querySelector(`:is(${viewSel}):not([inert])`) || document.querySelector(`:is(${viewSel}):last-child`);
      if (!activeView) return false;
      return !!activeView.querySelector(backSel);
    }, { viewSel: VIEW_SEL, backSel: BACK_SEL });
    
    await clickBackButton(page);
    try {
      await page.waitForFunction(({ viewSel, backSel }: { viewSel: string; backSel: string }) => {
        const views = document.querySelectorAll(viewSel);
        return views.length >= 1 && !views[0].hasAttribute('inert') && !views[0].querySelector(backSel);
      }, { viewSel: VIEW_SEL, backSel: BACK_SEL }, { timeout: 1500 });
    } catch (e) {}
    
    const returnedToRoot = await page.evaluate(({ viewSel, backSel }) => {
      const views = document.querySelectorAll(viewSel);
      if (views.length === 0) return false;
      return !views[0].hasAttribute('inert') && !views[0].querySelector(backSel);
    }, { viewSel: VIEW_SEL, backSel: BACK_SEL });
    
    expect(openedDeepView && returnedToRoot).toBe(true);
  });

});
