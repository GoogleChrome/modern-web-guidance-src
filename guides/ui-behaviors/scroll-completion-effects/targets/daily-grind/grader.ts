import { test, expect } from '../../../../../src/grading/test-fixture.ts';

interface ScrollCallRecord {
  method: string;
  targetTag: string | null;
  targetId: string | null;
  behavior: string | null;
  seq: number;
}

interface TargetSnapshot {
  classList: string[];
  attrs: Record<string, string>;
  hasFocus: boolean;
}

declare global {
  interface Window {
    __scrollLog: ScrollCallRecord[];
    __holdNextScroll: boolean;
    __heldScrollQueue: Array<() => void>;
    __origScrollSettled: boolean;
    __activeNativeScrolls: number;
    __longTimers: number;
    __resolveNextHeldScroll: () => boolean;
    __navEvents: {
      mutations: number;
      focusIn: number;
      focusCalls: number;
      addedClasses: string[];
    };
  }
}

const SCROLL_INSTRUMENTATION_SCRIPT = () => {
  window.__scrollLog = [];
  window.__holdNextScroll = false;
  window.__heldScrollQueue = [];
  window.__origScrollSettled = true;
  window.__activeNativeScrolls = 0;
  window.__longTimers = 0;
  let seq = 0;

  const origSetTimeout = window.setTimeout.bind(window);
  window.setTimeout = ((handler, delay = 0, ...rest) => {
    if (window.__holdNextScroll && Number(delay) >= 100) window.__longTimers++;
    return origSetTimeout(handler, delay, ...rest);
  }) as typeof window.setTimeout;

  window.__resolveNextHeldScroll = () => {
    const resolver = window.__heldScrollQueue.shift();
    if (!resolver) return false;
    resolver();
    return true;
  };

  function wrapScrollMethod(targetObj: Record<string, any>, methodName: string, isWindow = false) {
    const orig = targetObj[methodName];
    if (typeof orig !== 'function') return;

    targetObj[methodName] = function (this: any, ...args: any[]) {
      const firstArg = args[0];
      const opts =
        firstArg && typeof firstArg === 'object' ? (firstArg as ScrollIntoViewOptions & ScrollToOptions) : null;
      const behavior = opts && typeof opts.behavior === 'string' ? opts.behavior : null;
      const ctx = isWindow ? window : this;

      window.__scrollLog.push({
        method: methodName,
        targetTag: !isWindow && ctx && typeof ctx.tagName === 'string' ? ctx.tagName : 'WINDOW',
        targetId: !isWindow && ctx && typeof ctx.id === 'string' ? ctx.id : null,
        behavior,
        seq: ++seq,
      });

      if (!window.__holdNextScroll) {
        const res = orig.apply(ctx, args);
        if (res && typeof res.then === 'function') {
          window.__activeNativeScrolls++;
          Promise.resolve(res).finally(() => {
            window.__activeNativeScrolls = Math.max(0, window.__activeNativeScrolls - 1);
          });
        }
        return res;
      }

      // Trigger the instant scroll underneath so scroll/scrollend and rAF listeners see the
      // viewport move immediately, while holding the returned Promise pending until explicitly resolved.
      window.__origScrollSettled = false;
      let instantArgs = args;
      if (opts) {
        instantArgs = [{ ...opts, behavior: 'instant' as ScrollBehavior }, ...args.slice(1)];
      } else if (methodName === 'scrollIntoView' && args.length > 0) {
        instantArgs = [{ behavior: 'instant' as ScrollBehavior, block: args[0] === false ? 'end' : 'start' }];
      }

      const origResult = orig.apply(ctx, instantArgs);
      Promise.resolve(origResult).then(
        () => {
          window.__origScrollSettled = true;
        },
        () => {
          window.__origScrollSettled = true;
        },
      );

      return new Promise<void>((resolve) => {
        window.__heldScrollQueue.push(() => {
          Promise.resolve(origResult).then(
            () => resolve(),
            () => resolve(),
          );
        });
      });
    };
  }

  for (const name of ['scrollIntoView', 'scrollTo', 'scrollBy', 'scroll']) {
    wrapScrollMethod(Element.prototype as any, name, false);
  }
  for (const name of ['scrollTo', 'scrollBy', 'scroll']) {
    wrapScrollMethod(Window.prototype as any, name, true);
    if (Object.prototype.hasOwnProperty.call(window, name)) {
      wrapScrollMethod(window as any, name, true);
    }
  }
};

async function findNavTargetPairs(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>('nav a, [data-scroll-target], [data-target], a[href^="#"]'),
    );

    const seenTargets = new Set<HTMLElement>();
    const pairs: Array<{
      controlSelector: string;
      targetId: string;
      targetTop: number;
    }> = [];

    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
      const cRect = el.getBoundingClientRect();
      if (cRect.width === 0 || cRect.height === 0) continue;

      const explicitTarget =
        el.getAttribute('data-scroll-target') || el.getAttribute('data-target') || '';
      const href = el.getAttribute('href') || '';

      let rawId = '';
      if (explicitTarget.trim()) {
        rawId = explicitTarget.trim().replace(/^#/, '');
      } else if (href.includes('#')) {
        const hashPart = href.slice(href.indexOf('#') + 1).trim();
        if (hashPart) rawId = hashPart;
      }

      if (!rawId) continue;
      const target = document.getElementById(rawId);
      if (!target || seenTargets.has(target)) continue;

      const tRect = target.getBoundingClientRect();
      if (tRect.height === 0 || tRect.width === 0) continue;

      seenTargets.add(target);
      el.setAttribute('data-grader-nav-idx', String(pairs.length));
      pairs.push({
        controlSelector: `[data-grader-nav-idx="${pairs.length}"]`,
        targetId: rawId,
        targetTop: tRect.top + window.scrollY,
      });
    }

    return pairs;
  });
}

async function waitForOrigScrollAndFrames(page: import('@playwright/test').Page, frameCount = 4) {
  await page.waitForFunction(() => window.__origScrollSettled === true);
  await page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let remaining = count;
        const step = () => {
          if (--remaining <= 0) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    frameCount,
  );
}

async function captureTargetSnapshot(
  page: import('@playwright/test').Page,
  targetId: string,
): Promise<TargetSnapshot> {
  return page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing target #${id}`);
    const attrs: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      if (attr.name !== 'class' && attr.name !== 'id') {
        attrs[attr.name] = attr.value;
      }
    }
    const active = document.activeElement;
    return {
      classList: Array.from(el.classList),
      attrs,
      hasFocus: Boolean(active && (active === el || el.contains(active))),
    };
  }, targetId);
}

function getAppliedPostScrollState(before: TargetSnapshot, after: TargetSnapshot) {
  const addedClasses = after.classList.filter((c) => !before.classList.includes(c));
  const changedAttrs = Object.keys(after.attrs).filter((k) => after.attrs[k] !== before.attrs[k]);
  const gainedFocus = !before.hasFocus && after.hasFocus;
  return {
    addedClasses,
    changedAttrs,
    gainedFocus,
    hasAnyEffect: addedClasses.length > 0 || changedAttrs.length > 0 || after.hasFocus,
  };
}

test.describe('daily-grind Target Grader', () => {
  test('Clicking a navigation control scrolls the corresponding target element into view using a programmatic scroll method (scrollIntoView(), scrollTo(), scrollBy(), or scroll()) with smooth behavior (behavior: \'smooth\')', async ({
    page,
    TARGET_URL,
  }) => {
    await page.addInitScript(SCROLL_INSTRUMENTATION_SCRIPT);
    await page.setViewportSize({ width: 1280, height: 480 });
    await page.goto(TARGET_URL);

    const pairs = await findNavTargetPairs(page);
    expect(pairs.length).toBeGreaterThanOrEqual(2);
    const sorted = [...pairs].sort((a, b) => a.targetTop - b.targetTop);
    const firstPair = sorted[sorted.length - 1];

    await page.locator(firstPair.controlSelector).click();

    await page.waitForFunction(() => window.__scrollLog.length >= 1);
    const scrollCalls = await page.evaluate(() => window.__scrollLog.slice());
    expect(scrollCalls.some((c) => c.behavior === 'smooth')).toBe(true);
    await page.waitForFunction(() => window.scrollY > 0);
  });

  test('The implementation waits for the scroll operation to finish using the Promise returned directly by the scroll method, rather than relying on a hardcoded setTimeout() delay to guess when scrolling ends', async ({
    page,
    TARGET_URL,
  }) => {
    await page.addInitScript(SCROLL_INSTRUMENTATION_SCRIPT);
    await page.setViewportSize({ width: 1280, height: 480 });
    await page.goto(TARGET_URL);

    const pairs = await findNavTargetPairs(page);
    expect(pairs.length).toBeGreaterThanOrEqual(2);
    const sorted = [...pairs].sort((a, b) => a.targetTop - b.targetTop);
    const firstPair = sorted[sorted.length - 1];
    const before = await captureTargetSnapshot(page, firstPair.targetId);

    await page.evaluate(() => {
      window.__holdNextScroll = true;
      window.__scrollLog = [];
    });

    await page.locator(firstPair.controlSelector).click();
    await page.waitForFunction(() => window.__scrollLog.length >= 1);

    // Even after the underlying viewport scroll and scrollend/frames have completed,
    // post-scroll state must stay unapplied until the scroll method's returned Promise resolves.
    await waitForOrigScrollAndFrames(page, 4);
    const whilePending = await captureTargetSnapshot(page, firstPair.targetId);
    expect(getAppliedPostScrollState(before, whilePending).hasAnyEffect).toBe(false);
    expect(await page.evaluate(() => window.__longTimers)).toBe(0);

    const resolved = await page.evaluate(() => window.__resolveNextHeldScroll());
    expect(resolved).toBe(true);

    await expect
      .poll(async () => {
        const after = await captureTargetSnapshot(page, firstPair.targetId);
        return getAppliedPostScrollState(before, after).hasAnyEffect;
      })
      .toBe(true);
  });

  test('Any active highlight or post-scroll state on previously targeted elements is cleared when a new scroll navigation is triggered', async ({
    page,
    TARGET_URL,
  }) => {
    await page.addInitScript(SCROLL_INSTRUMENTATION_SCRIPT);
    await page.setViewportSize({ width: 1280, height: 480 });
    await page.goto(TARGET_URL);

    const pairs = await findNavTargetPairs(page);
    expect(pairs.length).toBeGreaterThanOrEqual(2);
    const sorted = [...pairs].sort((a, b) => a.targetTop - b.targetTop);
    const firstPair = sorted[sorted.length - 1];
    const secondPair = sorted[0];

    const firstBefore = await captureTargetSnapshot(page, firstPair.targetId);
    await page.locator(firstPair.controlSelector).click();

    let firstAfter = firstBefore;
    await expect
      .poll(async () => {
        firstAfter = await captureTargetSnapshot(page, firstPair.targetId);
        return getAppliedPostScrollState(firstBefore, firstAfter).hasAnyEffect;
      })
      .toBe(true);
    const firstArrivalState = getAppliedPostScrollState(firstBefore, firstAfter);

    await page.waitForFunction(() => window.__activeNativeScrolls === 0);
    await page.evaluate(() => {
      window.__holdNextScroll = true;
      window.__scrollLog = [];
    });

    await page.locator(secondPair.controlSelector).click();
    await page.waitForFunction(() => window.__scrollLog.length >= 1);
    await waitForOrigScrollAndFrames(page, 4);

    const firstDuringSecond = await captureTargetSnapshot(page, firstPair.targetId);
    for (const cls of firstArrivalState.addedClasses) {
      expect(firstDuringSecond.classList).not.toContain(cls);
    }
    for (const attr of firstArrivalState.changedAttrs) {
      expect(firstDuringSecond.attrs[attr]).toBe(firstBefore.attrs[attr]);
    }
    if (firstArrivalState.addedClasses.length === 0 && firstArrivalState.changedAttrs.length === 0) {
      expect(firstDuringSecond.hasFocus).toBe(false);
    }

    await page.evaluate(() => window.__resolveNextHeldScroll());
  });

  test('The post-scroll effect (such as adding a highlight class to the target element) is applied only after the scroll method\'s returned Promise resolves when scrolling settles, not synchronously while the smooth scroll is still in progress', async ({
    page,
    TARGET_URL,
  }) => {
    await page.addInitScript(SCROLL_INSTRUMENTATION_SCRIPT);
    await page.setViewportSize({ width: 1280, height: 480 });
    await page.goto(TARGET_URL);

    const pairs = await findNavTargetPairs(page);
    expect(pairs.length).toBeGreaterThanOrEqual(2);
    const sorted = [...pairs].sort((a, b) => a.targetTop - b.targetTop);
    const firstPair = sorted[sorted.length - 1];
    const before = await captureTargetSnapshot(page, firstPair.targetId);

    await page.evaluate(() => {
      window.__holdNextScroll = true;
      window.__scrollLog = [];
    });

    await page.locator(firstPair.controlSelector).click();
    await page.waitForFunction(() => window.__scrollLog.length >= 1);

    const immediateSnap = await captureTargetSnapshot(page, firstPair.targetId);
    expect(getAppliedPostScrollState(before, immediateSnap).hasAnyEffect).toBe(false);

    await waitForOrigScrollAndFrames(page, 1);
    const midScrollSnap = await captureTargetSnapshot(page, firstPair.targetId);
    expect(getAppliedPostScrollState(before, midScrollSnap).hasAnyEffect).toBe(false);

    const resolved = await page.evaluate(() => window.__resolveNextHeldScroll());
    expect(resolved).toBe(true);

    await expect
      .poll(async () => {
        const after = await captureTargetSnapshot(page, firstPair.targetId);
        return getAppliedPostScrollState(before, after).hasAnyEffect;
      })
      .toBe(true);
  });

  test('Triggering a scroll to a target element that is already in view at its target position still resolves the awaited scroll call and applies the post-scroll effect without hanging', async ({
    page,
    TARGET_URL,
  }) => {
    await page.addInitScript(SCROLL_INSTRUMENTATION_SCRIPT);
    await page.setViewportSize({ width: 1280, height: 480 });
    await page.goto(TARGET_URL);

    const pairs = await findNavTargetPairs(page);
    expect(pairs.length).toBeGreaterThanOrEqual(2);

    const sorted = [...pairs].sort((a, b) => a.targetTop - b.targetTop);
    const targetPair = sorted[sorted.length - 1];

    // Perform an unintercepted smooth scroll first so the target is at its destination position
    const initialSnap = await captureTargetSnapshot(page, targetPair.targetId);
    await page.locator(targetPair.controlSelector).click();

    await expect
      .poll(async () => {
        const snap = await captureTargetSnapshot(page, targetPair.targetId);
        return getAppliedPostScrollState(initialSnap, snap).hasAnyEffect;
      })
      .toBe(true);

    // Wait for native smooth scroll to settle completely at the destination
    await page.waitForFunction(() => window.__activeNativeScrolls === 0);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    // Instrument DOM/focus observer on the target element before clicking again while already in view
    await page.evaluate((id) => {
      const target = document.getElementById(id);
      if (!target) throw new Error(`Missing target #${id}`);

      window.__scrollLog = [];
      window.__navEvents = {
        mutations: 0,
        focusIn: 0,
        focusCalls: 0,
        addedClasses: [],
      };

      const observer = new MutationObserver((records) => {
        for (const rec of records) {
          window.__navEvents.mutations++;
          if (rec.attributeName === 'class') {
            window.__navEvents.addedClasses.push(target.className);
          }
        }
      });
      observer.observe(target, { attributes: true, subtree: true });

      target.addEventListener('focusin', () => {
        window.__navEvents.focusIn++;
      });
      target.addEventListener('focus', () => {
        window.__navEvents.focusCalls++;
      });

      // Blur before re-triggering so re-focusing is observable too
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }, targetPair.targetId);

    // Click the same navigation control again while the target is already in view
    await page.locator(targetPair.controlSelector).click();

    await expect
      .poll(async () => {
        return page.evaluate((id) => {
          const target = document.getElementById(id);
          const active = document.activeElement;
          const focused = Boolean(target && active && (active === target || target.contains(active)));
          return {
            scrolled: window.__scrollLog.length > 0,
            applied:
              focused ||
              window.__navEvents.mutations > 0 ||
              window.__navEvents.focusIn > 0 ||
              window.__navEvents.focusCalls > 0,
          };
        }, targetPair.targetId);
      })
      .toEqual({ scrolled: true, applied: true });
  });
});
