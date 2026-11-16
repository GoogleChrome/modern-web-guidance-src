import { test, expect, expectNever } from '../../test-fixture.ts';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Page } from '@playwright/test';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

interface ScrollerDescriptor {
  index: number;
  axis: 'block' | 'inline';
  hintType: 'shadow' | 'fade' | 'none';
  hasHiddenScrollbar: boolean;
  hasExtraOverlayElements: boolean;
  startBlockedByPointer: boolean;
  endBlockedByPointer: boolean;
}

async function routeLocalhost(page: Page) {
  await page.route('http://localhost/*', async (route) => {
    const requestPath = new URL(route.request().url()).pathname;
    const filename = requestPath === '/' ? demoName : requestPath.slice(1);
    const localFilePath = path.join(targetDir, filename);

    if (fs.existsSync(localFilePath)) {
      await route.fulfill({ path: localFilePath });
    } else {
      await route.continue();
    }
  });
}

async function injectSpyInitScript(
  page: Page,
  options: { mockNoScrollState?: boolean; mockNoScrollTimeline?: boolean } = {},
) {
  await page.addInitScript(({ mockNoScrollState, mockNoScrollTimeline }) => {
    (window as any).__spied = {
      scrollListenersCount: 0,
      intersectionObserversCreated: 0,
      observedCount: 0,
      setIntervalCalls: 0,
    };

    const originalSupports = CSS.supports.bind(CSS);
    CSS.supports = function (propertyOrCondition: string, value?: string) {
      const joined = `${propertyOrCondition} ${value ?? ''}`.toLowerCase();
      if (mockNoScrollState && (joined.includes('scroll-state') || (joined.includes('container-type') && joined.includes('scroll-state')))) {
        return false;
      }
      if (mockNoScrollTimeline && joined.includes('animation-timeline')) {
        return false;
      }
      return value !== undefined
        ? originalSupports(propertyOrCondition, value)
        : originalSupports(propertyOrCondition);
    };

    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type: string, listener: any, opts?: any) {
      if (type === 'scroll') {
        (window as any).__spied.scrollListenersCount++;
      }
      return originalAddEventListener.call(this, type, listener, opts);
    };

    const OriginalIO = window.IntersectionObserver;
    if (OriginalIO) {
      window.IntersectionObserver = function (this: any, callback: any, opts?: any) {
        (window as any).__spied.intersectionObserversCreated++;
        const instance = new OriginalIO(callback, opts);
        const origObserve = instance.observe.bind(instance);
        instance.observe = function (target: Element) {
          (window as any).__spied.observedCount++;
          return origObserve(target);
        };
        return instance;
      } as any;
      window.IntersectionObserver.prototype = OriginalIO.prototype;
    }

    const originalSetInterval = window.setInterval;
    window.setInterval = function (this: any, ...args: any[]) {
      (window as any).__spied.setIntervalCalls++;
      return originalSetInterval.apply(window, args as any);
    } as any;
  }, options);
}

/**
 * Discovers scrollable containers and inspects their hint mechanism (`::before`/`::after`
 * shadows vs `mask-image` fades), scrollbar visibility, and any extra indicator markup.
 */
async function discoverScrollers(page: Page): Promise<ScrollerDescriptor[]> {
  return page.evaluate(() => {
    const cssTextAll = (() => {
      const chunks: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const walk = (rules: CSSRuleList) => {
            for (const r of Array.from(rules)) {
              chunks.push(r.cssText);
              if ('cssRules' in r && (r as any).cssRules) {
                walk((r as any).cssRules);
              }
            }
          };
          if (sheet.cssRules) walk(sheet.cssRules);
        } catch {
          // Ignore cross-origin sheets
        }
      }
      return chunks.join('\n').toLowerCase();
    })();

    const hasWebkitHiddenScrollbarRule =
      /::-webkit-scrollbar\s*\{[^}]*(display\s*:\s*none|width\s*:\s*0|height\s*:\s*0)/.test(cssTextAll);

    const scrollers: ScrollerDescriptor[] = [];
    let nextIdx = 0;

    for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
      const style = window.getComputedStyle(el);
      const canScrollY =
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight + 2;
      const canScrollX =
        (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
        el.scrollWidth > el.clientWidth + 2;

      if (!canScrollY && !canScrollX) continue;

      const idx = nextIdx++;
      el.setAttribute('data-grader-scroller', String(idx));

      const beforeStyle = window.getComputedStyle(el, '::before');
      const afterStyle = window.getComputedStyle(el, '::after');
      const hasPseudoHints =
        beforeStyle.content !== 'none' &&
        beforeStyle.content !== 'normal' &&
        afterStyle.content !== 'none' &&
        afterStyle.content !== 'normal';

      const maskImg = style.maskImage && style.maskImage !== 'none'
        ? style.maskImage
        : (style as any).webkitMaskImage || 'none';
      const hasMaskHint = maskImg !== 'none' && maskImg.includes('gradient');

      const hintType: 'shadow' | 'fade' | 'none' = hasPseudoHints
        ? 'shadow'
        : hasMaskHint
          ? 'fade'
          : 'none';

      const hasHiddenScrollbar =
        style.scrollbarWidth === 'none' ||
        (hasWebkitHiddenScrollbarRule && el.offsetWidth === el.clientWidth && el.offsetHeight === el.clientHeight);

      // Detect extra indicator/shadow/fade DOM elements placed inside or immediately over the scroller
      const extraOverlays = Array.from(el.querySelectorAll<HTMLElement>('*')).filter((child) => {
        const textLen = child.textContent?.trim().length || 0;
        if (textLen > 30) return false;
        const cs = window.getComputedStyle(child);
        const name = `${child.className} ${child.id}`.toLowerCase();
        const isPositioned = cs.position === 'sticky' || cs.position === 'absolute' || cs.position === 'fixed';
        const looksLikeIndicator =
          /\b(shadow|indicator|fade|overlay|scrim|hint)\b/.test(name) ||
          (cs.backgroundImage.includes('gradient') && cs.pointerEvents !== 'none');
        return (isPositioned && looksLikeIndicator) || /\b(shadow|indicator|fade)-(top|bottom|left|right|start|end)\b/.test(name);
      });

      const rect = el.getBoundingClientRect();
      const axis: 'block' | 'inline' = canScrollY ? 'block' : 'inline';

      // Check whether elementFromPoint near the start/end edge hits an obscuring overlay instead of content/scroller
      const startPt = axis === 'block'
        ? { x: rect.left + rect.width / 2, y: rect.top + 6 }
        : { x: rect.left + 6, y: rect.top + rect.height / 2 };
      const endPt = axis === 'block'
        ? { x: rect.left + rect.width / 2, y: rect.bottom - 6 }
        : { x: rect.right - 6, y: rect.top + rect.height / 2 };

      const startHit = document.elementFromPoint(startPt.x, startPt.y);
      const endHit = document.elementFromPoint(endPt.x, endPt.y);

      const startBlocked =
        (hintType === 'shadow' && beforeStyle.pointerEvents !== 'none') ||
        (startHit ? extraOverlays.includes(startHit as HTMLElement) : false);
      const endBlocked =
        (hintType === 'shadow' && afterStyle.pointerEvents !== 'none') ||
        (endHit ? extraOverlays.includes(endHit as HTMLElement) : false);

      scrollers.push({
        index: idx,
        axis,
        hintType,
        hasHiddenScrollbar,
        hasExtraOverlayElements: extraOverlays.length > 0,
        startBlockedByPointer: startBlocked,
        endBlockedByPointer: endBlocked,
      });
    }

    return scrollers;
  });
}

async function readHintStates(page: Page, scrollerIndex: number) {
  return page.evaluate((idx) => {
    const el = document.querySelector<HTMLElement>(`[data-grader-scroller="${idx}"]`);
    if (!el) return null;

    const style = window.getComputedStyle(el);
    const beforeStyle = window.getComputedStyle(el, '::before');
    const afterStyle = window.getComputedStyle(el, '::after');

    const hasPseudoHints =
      beforeStyle.content !== 'none' &&
      beforeStyle.content !== 'normal' &&
      afterStyle.content !== 'none' &&
      afterStyle.content !== 'normal';

    if (hasPseudoHints) {
      const isPseudoVisible = (ps: CSSStyleDeclaration) =>
        ps.display !== 'none' &&
        ps.visibility !== 'hidden' &&
        parseFloat(ps.opacity || '1') > 0.05;

      return {
        hintType: 'shadow' as const,
        startVisible: isPseudoVisible(beforeStyle),
        endVisible: isPseudoVisible(afterStyle),
      };
    }

    const maskImg = style.maskImage && style.maskImage !== 'none'
      ? style.maskImage
      : (style as any).webkitMaskImage || 'none';

    if (maskImg !== 'none' && maskImg.includes('gradient')) {
      // Parse resolved gradient color stops, e.g.:
      // linear-gradient(to right, rgba(0, 0, 0, 0), rgb(0, 0, 0) 48px, rgb(0, 0, 0) calc(100% - 48px), rgba(0, 0, 0, 0))
      const parseFadeFromMask = (mask: string, axisLength: number) => {
        // Split top-level comma arguments inside the first linear-gradient(...)
        const startIdx = mask.indexOf('(');
        if (startIdx < 0) return { startVisible: false, endVisible: false };
        let depth = 0;
        let current = '';
        const parts: string[] = [];
        for (let i = startIdx + 1; i < mask.length; i++) {
          const ch = mask[i];
          if (ch === '(') depth++;
          else if (ch === ')') {
            if (depth === 0) {
              if (current.trim()) parts.push(current.trim());
              break;
            }
            depth--;
          }
          if (ch === ',' && depth === 0) {
            parts.push(current.trim());
            current = '';
          } else {
            current += ch;
          }
        }

        // First part may be direction (`to right`, `to bottom`, `90deg`, etc.)
        const stops = parts.filter((p) => !/^to\s+|^-?\d+(\.\d+)?(deg|rad|grad|turn)$/i.test(p));
        if (stops.length < 3) return { startVisible: false, endVisible: false };

        const extractPxOffsetFromZero = (stop: string): number | null => {
          // Match trailing position token (e.g. `48px`, `0px`, `10%`, `calc(100% - 48px)`)
          const calcMatch = stop.match(/calc\(\s*100%\s*-\s*([-+]?\d*\.?\d+)px\s*\)\s*$/);
          if (calcMatch) return Math.max(0, axisLength - parseFloat(calcMatch[1]));
          const pxMatch = stop.match(/([-+]?\d*\.?\d+)px\s*$/);
          if (pxMatch) return parseFloat(pxMatch[1]);
          const pctMatch = stop.match(/([-+]?\d*\.?\d+)%\s*$/);
          if (pctMatch) return (parseFloat(pctMatch[1]) / 100) * axisLength;
          return null;
        };

        const firstOpaquePos = extractPxOffsetFromZero(stops[1]);
        const lastOpaqueStop = stops[stops.length - 2];
        let endFadePx = 0;
        const calcEndMatch = lastOpaqueStop.match(/calc\(\s*100%\s*-\s*([-+]?\d*\.?\d+)px\s*\)\s*$/);
        if (calcEndMatch) {
          endFadePx = parseFloat(calcEndMatch[1]);
        } else {
          const lastOpaquePos = extractPxOffsetFromZero(lastOpaqueStop);
          if (lastOpaquePos !== null) {
            endFadePx = Math.max(0, axisLength - lastOpaquePos);
          }
        }

        return {
          startVisible: firstOpaquePos !== null && firstOpaquePos > 2,
          endVisible: endFadePx > 2,
        };
      };

      const axisLen = el.scrollHeight > el.clientHeight + 2 ? el.clientHeight : el.clientWidth;
      const parsed = parseFadeFromMask(maskImg, axisLen);
      return {
        hintType: 'fade' as const,
        ...parsed,
      };
    }

    return {
      hintType: 'none' as const,
      startVisible: false,
      endVisible: false,
    };
  }, scrollerIndex);
}

async function scrollScroller(page: Page, scrollerIndex: number, axis: 'block' | 'inline', position: 'start' | 'middle' | 'end') {
  await page.evaluate(({ idx, ax, pos }) => {
    const el = document.querySelector<HTMLElement>(`[data-grader-scroller="${idx}"]`);
    if (!el) return;
    if (ax === 'block') {
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTop = pos === 'start' ? 0 : pos === 'end' ? max : Math.round(max / 2);
    } else {
      const max = el.scrollWidth - el.clientWidth;
      el.scrollLeft = pos === 'start' ? 0 : pos === 'end' ? max : Math.round(max / 2);
    }
  }, { idx: scrollerIndex, ax: axis, pos: position });
}

test.describe(`scrollability-affordance-hints Expectations: ${demoName}`, () => {
  test.beforeEach(async ({ page }) => {
    await routeLocalhost(page);
    await injectSpyInitScript(page);
  });

  test('The hint at the start edge of the scroller is not visible when the scroller is scrolled to the start.', async ({ page }) => {
    await page.goto(demoUrl);
    const scrollers = await discoverScrollers(page);
    expect(scrollers.length).toBeGreaterThan(0);

    for (const scroller of scrollers) {
      expect(scroller.hintType).not.toBe('none');
      await scrollScroller(page, scroller.index, scroller.axis, 'start');
      await expect.poll(async () => (await readHintStates(page, scroller.index))?.startVisible).toBe(false);
    }
  });

  test('The hint at the start edge of the scroller is visible when the scroller is scrolled away from the start.', async ({ page }) => {
    await page.goto(demoUrl);
    const scrollers = await discoverScrollers(page);
    expect(scrollers.length).toBeGreaterThan(0);

    for (const scroller of scrollers) {
      expect(scroller.hintType).not.toBe('none');
      await scrollScroller(page, scroller.index, scroller.axis, 'middle');
      await expect.poll(async () => (await readHintStates(page, scroller.index))?.startVisible).toBe(true);
    }
  });

  test('The hint at the end edge of the scroller is visible when there is more content to scroll to.', async ({ page }) => {
    await page.goto(demoUrl);
    const scrollers = await discoverScrollers(page);
    expect(scrollers.length).toBeGreaterThan(0);

    for (const scroller of scrollers) {
      expect(scroller.hintType).not.toBe('none');
      await scrollScroller(page, scroller.index, scroller.axis, 'start');
      await expect.poll(async () => (await readHintStates(page, scroller.index))?.endVisible).toBe(true);
    }
  });

  test('The hint at the end edge of the scroller is not visible when the scroller is scrolled to the end.', async ({ page }) => {
    await page.goto(demoUrl);
    const scrollers = await discoverScrollers(page);
    expect(scrollers.length).toBeGreaterThan(0);

    for (const scroller of scrollers) {
      expect(scroller.hintType).not.toBe('none');
      await scrollScroller(page, scroller.index, scroller.axis, 'end');
      await expect.poll(async () => (await readHintStates(page, scroller.index))?.endVisible).toBe(false);
    }
  });

  test('When the content fits in the scroller without scrolling, neither hint is visible.', async ({ page }) => {
    await page.goto(demoUrl);
    const scrollers = await discoverScrollers(page);
    expect(scrollers.length).toBeGreaterThan(0);

    for (const scroller of scrollers) {
      await page.evaluate(({ idx, ax }) => {
        const el = document.querySelector<HTMLElement>(`[data-grader-scroller="${idx}"]`);
        if (!el) return;
        if (ax === 'block') {
          el.style.maxBlockSize = 'none';
          el.style.blockSize = `${el.scrollHeight + 40}px`;
        } else {
          // Make horizontal scroller wide enough or trim overflowing items so content fits without scrolling
          while (el.scrollWidth > el.clientWidth && el.children.length > 1) {
            el.lastElementChild?.remove();
          }
        }
      }, { idx: scroller.index, ax: scroller.axis });

      await expect.poll(async () => {
        const st = await readHintStates(page, scroller.index);
        return st ? !st.startVisible && !st.endVisible : false;
      }).toBe(true);
    }
  });

  test('The hints are drawn with ::before/::after pseudo-elements of the scroller or a mask-image on the scroller, not with extra elements in the markup.', async ({ page }) => {
    await page.goto(demoUrl);
    const scrollers = await discoverScrollers(page);
    expect(scrollers.length).toBeGreaterThan(0);

    for (const scroller of scrollers) {
      expect(['shadow', 'fade']).toContain(scroller.hintType);
      expect(scroller.hasExtraOverlayElements).toBe(false);
    }
  });

  test('The hints do not intercept clicks on the scrollable content.', async ({ page }) => {
    await page.goto(demoUrl);
    const scrollers = await discoverScrollers(page);
    expect(scrollers.length).toBeGreaterThan(0);

    for (const scroller of scrollers) {
      expect(scroller.startBlockedByPointer).toBe(false);
      expect(scroller.endBlockedByPointer).toBe(false);
    }
  });

  test('Scroll state is detected with CSS scroll-state container queries or scroll-driven animations.', async ({ page }) => {
    await page.goto(demoUrl);
    const detection = await page.evaluate(() => {
      let hasContainerScrollState = false;
      let hasContainerQuery = false;
      let hasScrollTimeline = false;

      const walk = (rules: CSSRuleList) => {
        for (const r of Array.from(rules)) {
          const text = r.cssText.toLowerCase();
          if (text.includes('container-type') && text.includes('scroll-state')) {
            hasContainerScrollState = true;
          }
          if (text.includes('@container') && text.includes('scroll-state(')) {
            hasContainerQuery = true;
          }
          if (text.includes('animation-timeline') && text.includes('scroll(')) {
            hasScrollTimeline = true;
          }
          if ('cssRules' in r && (r as any).cssRules) {
            walk((r as any).cssRules);
          }
        }
      };

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          if (sheet.cssRules) walk(sheet.cssRules);
        } catch {
          // Ignore cross-origin
        }
      }

      return {
        usesScrollStateQueries: hasContainerScrollState && hasContainerQuery,
        usesScrollDrivenAnimations: hasScrollTimeline,
      };
    });

    expect(detection.usesScrollStateQueries || detection.usesScrollDrivenAnimations).toBe(true);
  });

  test('No scroll event listeners are used to show or hide the hints.', async ({ page }) => {
    await page.goto(demoUrl);
    const scrollers = await discoverScrollers(page);
    expect(scrollers.length).toBeGreaterThan(0);

    for (const scroller of scrollers) {
      await scrollScroller(page, scroller.index, scroller.axis, 'middle');
    }

    await expectNever(page, () => (window as any).__spied.scrollListenersCount > 0, { forMs: 150 });
    const spied = await page.evaluate(() => (window as any).__spied);
    expect(spied.scrollListenersCount).toBe(0);
    expect(spied.setIntervalCalls).toBe(0);
  });

  test("When the scroller's scrollbar is hidden and scroll-state container queries are unsupported, the hints still appear and disappear as described above.", async ({ page }) => {
    await injectSpyInitScript(page, { mockNoScrollState: true });
    await page.goto(demoUrl);

    const scrollers = await discoverScrollers(page);
    expect(scrollers.length).toBeGreaterThan(0);
    const hiddenScrollStateScrollers = scrollers.filter((s) => s.hasHiddenScrollbar);
    // For hidden-scrollbar scrollers using scroll-state container queries, verify fallback rules or IO fallback exist
    const cssInfo = await page.evaluate(() => {
      let hasScrollStateRule = false;
      let hasSupportsNotScrollState = false;
      let hasScrollTimelineRule = false;
      const walk = (rules: CSSRuleList) => {
        for (const r of Array.from(rules)) {
          const t = r.cssText.toLowerCase();
          if (t.includes('@container') && t.includes('scroll-state(')) hasScrollStateRule = true;
          if (t.includes('@supports') && t.includes('not') && t.includes('scroll-state')) hasSupportsNotScrollState = true;
          if (t.includes('animation-timeline') && t.includes('scroll(')) hasScrollTimelineRule = true;
          if ('cssRules' in r && (r as any).cssRules) walk((r as any).cssRules);
        }
      };
      for (const sheet of Array.from(document.styleSheets)) {
        try { if (sheet.cssRules) walk(sheet.cssRules); } catch {}
      }
      return { hasScrollStateRule, hasSupportsNotScrollState, hasScrollTimelineRule };
    });

    if (hiddenScrollStateScrollers.length > 0 && cssInfo.hasScrollStateRule && !cssInfo.hasScrollTimelineRule) {
      const spied = await page.evaluate(() => (window as any).__spied);
      expect(cssInfo.hasSupportsNotScrollState || spied.intersectionObserversCreated > 0).toBe(true);
    }

    for (const scroller of hiddenScrollStateScrollers) {
      await scrollScroller(page, scroller.index, scroller.axis, 'middle');
      await expect.poll(async () => (await readHintStates(page, scroller.index))?.startVisible).toBe(true);
      await scrollScroller(page, scroller.index, scroller.axis, 'end');
      await expect.poll(async () => (await readHintStates(page, scroller.index))?.endVisible).toBe(false);
    }
  });

  test("When the scroller's scrollbar is hidden and scroll-driven animations are unsupported, the hints still appear and disappear as described above.", async ({ page }) => {
    await injectSpyInitScript(page, { mockNoScrollTimeline: true });
    await page.goto(demoUrl);

    const scrollers = await discoverScrollers(page);
    expect(scrollers.length).toBeGreaterThan(0);
    const hiddenScrollers = scrollers.filter((s) => s.hasHiddenScrollbar);

    if (hiddenScrollers.length > 0) {
      const spied = await page.evaluate(() => (window as any).__spied);
      if (spied.intersectionObserversCreated > 0) {
        // When the JS IntersectionObserver fallback runs, cancel CSS scroll-driven animation override so IO class/attribute styles govern the mask/shadows
        await page.addStyleTag({ content: '* { animation: none !important; transition-duration: 0s !important; }' });
      }

      for (const scroller of hiddenScrollers) {
        await scrollScroller(page, scroller.index, scroller.axis, 'start');
        await expect.poll(async () => {
          const st = await readHintStates(page, scroller.index);
          return st ? !st.startVisible && st.endVisible : false;
        }).toBe(true);

        await scrollScroller(page, scroller.index, scroller.axis, 'middle');
        await expect.poll(async () => {
          const st = await readHintStates(page, scroller.index);
          return st ? st.startVisible && st.endVisible : false;
        }).toBe(true);

        await scrollScroller(page, scroller.index, scroller.axis, 'end');
        await expect.poll(async () => {
          const st = await readHintStates(page, scroller.index);
          return st ? st.startVisible && !st.endVisible : false;
        }).toBe(true);
      }
    }
  });

  test("When the scroller's scrollbar is hidden and both scroll-driven animations and scroll-state container queries are unsupported, a CSS fallback or an IntersectionObserver-powered fallback is used.", async ({ page }) => {
    await injectSpyInitScript(page, { mockNoScrollState: true, mockNoScrollTimeline: true });
    await page.goto(demoUrl);

    const scrollers = await discoverScrollers(page);
    expect(scrollers.length).toBeGreaterThan(0);
    const hiddenScrollers = scrollers.filter((s) => s.hasHiddenScrollbar);

    const fallbackCheck = await page.evaluate(() => {
      let hasCssAttachmentFallback = false;
      const walk = (rules: CSSRuleList) => {
        for (const r of Array.from(rules)) {
          const t = r.cssText.toLowerCase();
          if (
            t.includes('@supports') &&
            t.includes('not') &&
            t.includes('scroll-state') &&
            t.includes('animation-timeline') &&
            t.includes('local')
          ) {
            hasCssAttachmentFallback = true;
          }
          if ('cssRules' in r && (r as any).cssRules) walk((r as any).cssRules);
        }
      };
      for (const sheet of Array.from(document.styleSheets)) {
        try { if (sheet.cssRules) walk(sheet.cssRules); } catch {}
      }
      return {
        hasCssAttachmentFallback,
        intersectionObserversCreated: (window as any).__spied.intersectionObserversCreated as number,
        observedCount: (window as any).__spied.observedCount as number,
        scrollListenersCount: (window as any).__spied.scrollListenersCount as number,
      };
    });

    if (hiddenScrollers.length > 0) {
      const hasIoFallback =
        fallbackCheck.intersectionObserversCreated > 0 && fallbackCheck.observedCount >= 2;
      expect(fallbackCheck.hasCssAttachmentFallback || hasIoFallback).toBe(true);
      expect(fallbackCheck.scrollListenersCount).toBe(0);
    }
  });
});
