import { test, expect } from '../../../../../src/grading/test-fixture.ts';
import type { Page, Locator } from '@playwright/test';

// Spies installed before page scripts run. They wrap startViewTransition (element-scoped and
// document-level) to record, at update-callback time, whether the cards were reordered inside the
// callback and which view-transition-name each card has; they also keep the transition objects so
// tests can wait for them to finish instead of sleeping.
async function instrument(page: Page, { removeViewTransitions = false } = {}) {
  await page.addInitScript((removeVT: boolean) => {
    const w = window as any;
    w.__vt = { calls: [] as any[], transitions: [] as any[] };
    w.__moveBeforeCards = 0;

    const cardOrder = () =>
      Array.from(document.querySelectorAll('.card')).map((c) => c.querySelector('h3')?.textContent?.trim());

    if (removeVT) {
      delete (Element.prototype as any).startViewTransition;
      delete (Document.prototype as any).startViewTransition;
    } else {
      for (const proto of [Element.prototype, Document.prototype] as any[]) {
        const orig = proto.startViewTransition;
        if (typeof orig !== 'function') continue;
        proto.startViewTransition = function (arg: any) {
          const call: any = { scope: this === document ? 'document' : 'element', reorderedInside: false, names: [] };
          w.__vt.calls.push(call);
          const userUpdate = typeof arg === 'function' ? arg : arg?.update;
          const wrapped = async () => {
            call.names = Array.from(document.querySelectorAll('.card')).map(
              (c) => getComputedStyle(c).viewTransitionName,
            );
            const before = JSON.stringify(cardOrder());
            await userUpdate?.();
            call.reorderedInside = JSON.stringify(cardOrder()) !== before;
          };
          const t = orig.call(this, typeof arg === 'function' || !arg ? wrapped : { ...arg, update: wrapped });
          w.__vt.transitions.push(t);
          return t;
        };
      }
    }

    const origMove = (Element.prototype as any).moveBefore;
    if (typeof origMove === 'function') {
      (Element.prototype as any).moveBefore = function (node: Node, ref: Node | null) {
        if ((node as Element)?.classList?.contains('card')) w.__moveBeforeCards++;
        return origMove.call(this, node, ref);
      };
    }
  }, removeViewTransitions);
}

const cardTitles = (page: Page) =>
  page.evaluate(() => Array.from(document.querySelectorAll('.card h3')).map((h) => h.textContent?.trim() ?? ''));

async function orderChangedFrom(page: Page, before: string[], timeout = 1000): Promise<boolean> {
  return page
    .waitForFunction(
      (prev) => JSON.stringify(Array.from(document.querySelectorAll('.card h3')).map((h) => h.textContent?.trim() ?? '')) !== prev,
      JSON.stringify(before),
      { timeout },
    )
    .then(() => true, () => false);
}

// Activates the sort control (a <select>, radio group, or button) until the card order changes.
// Returns the control the user activated. `beforeAttempt` runs before each activation so callers
// can reset per-reorder counters when an option happens to leave the order unchanged.
async function triggerReorder(page: Page, beforeAttempt: () => Promise<unknown> = async () => {}): Promise<Locator> {
  const before = await cardTitles(page);
  expect(before.length).toBeGreaterThan(1);

  const select = page.locator('select').first();
  if ((await select.count()) > 0) {
    const n = await select.locator('option').count();
    const current = await select.evaluate((el: HTMLSelectElement) => el.selectedIndex);
    for (let i = 0; i < n; i++) {
      if (i === current) continue;
      await beforeAttempt();
      await select.focus();
      await select.selectOption({ index: i });
      if (await orderChangedFrom(page, before)) return select;
    }
  }

  const radios = page.locator('input[type="radio"]');
  for (let i = 0; i < (await radios.count()); i++) {
    const radio = radios.nth(i);
    if ((await radio.isChecked()) || !(await radio.isVisible())) continue;
    await beforeAttempt();
    await radio.check();
    if (await orderChangedFrom(page, before)) return radio;
  }

  const buttons = page.locator('main button');
  for (let i = 0; i < (await buttons.count()); i++) {
    const btn = buttons.nth(i);
    if (!(await btn.isVisible())) continue;
    await beforeAttempt();
    await btn.click();
    if (await orderChangedFrom(page, before)) return btn;
  }

  throw new Error('No control on the page reordered the Seasonal Favorites cards');
}

async function waitForTransitions(page: Page) {
  await page.evaluate(() =>
    Promise.all(((window as any).__vt?.transitions ?? []).map((t: any) => t.finished.catch(() => {}))),
  );
}

test.describe('dynamic-sort Target Grader', () => {
  test('A user action reorders the list items in the DOM so DOM order matches visual order', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    await triggerReorder(page);
    await waitForTransitions(page);

    const visualMatchesDom = await page.evaluate(() => {
      const rects = Array.from(document.querySelectorAll('.card')).map((c) => c.getBoundingClientRect());
      return rects.every((a, i) => {
        const b = rects[i + 1];
        if (!b) return true;
        const nextRow = b.top >= a.bottom - 5;
        const sameRowToRight = b.left >= a.left - 5 && b.top <= a.bottom && a.top <= b.bottom;
        return nextRow || sameRowToRight;
      });
    });
    expect(visualMatchesDom).toBe(true);
  });

  test('Item elements captured before a reorder are the same connected elements after the reorder, rather than being recreated', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    await page.evaluate(() => {
      (window as any).__captured = Array.from(document.querySelectorAll('.card'));
    });
    await triggerReorder(page);

    const same = await page.evaluate(() => {
      const captured: Element[] = (window as any).__captured;
      const now = Array.from(document.querySelectorAll('.card'));
      return now.length === captured.length && captured.every((c) => c.isConnected && now.includes(c));
    });
    expect(same).toBe(true);
  });

  test('Items are reordered with moveBefore() when Object.hasOwn(Element.prototype, "moveBefore") is true', async ({ page, TARGET_URL }) => {
    await instrument(page);
    await page.goto(TARGET_URL);
    expect(await page.evaluate(() => Object.hasOwn(Element.prototype, 'moveBefore'))).toBe(true);
    await triggerReorder(page);
    await waitForTransitions(page);
    expect(await page.evaluate(() => (window as any).__moveBeforeCards)).toBeGreaterThan(0);
  });

  test('When the reorder is animated, it runs inside a view transition started with startViewTransition(), guarded by feature detection', async ({ page, TARGET_URL }) => {
    await instrument(page);
    await page.goto(TARGET_URL);
    await triggerReorder(page);
    await waitForTransitions(page);
    const calls = await page.evaluate(() => (window as any).__vt.calls);
    expect(calls.length, 'startViewTransition() was not called').toBeGreaterThan(0);
    expect(calls.some((c: any) => c.reorderedInside), 'cards were not reordered inside the update callback').toBe(true);
  });

  test('Reorder still works when startViewTransition() is unsupported (feature detection)', async ({ page, TARGET_URL }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await instrument(page, { removeViewTransitions: true });
    await page.goto(TARGET_URL);
    await triggerReorder(page);
    expect(errors).toEqual([]);
  });

  test('When the reorder is animated, each list item has a unique view-transition-name or uses match-element', async ({ page, TARGET_URL }) => {
    await instrument(page);
    await page.goto(TARGET_URL);
    await triggerReorder(page);
    await waitForTransitions(page);
    const calls = await page.evaluate(() => (window as any).__vt.calls);
    const call = calls.find((c: any) => c.reorderedInside);
    expect(call, 'no view transition wrapped the reorder').toBeTruthy();
    const names: string[] = call.names;
    expect(names.length).toBeGreaterThan(1);
    expect(names.every((n) => n && n !== 'none'), `card names at capture: ${names.join(', ')}`).toBe(true);
    const explicit = names.filter((n) => n !== 'match-element' && n !== 'auto');
    expect(new Set(explicit).size).toBe(explicit.length);
  });

  test('When the reorder is animated, view transition animations are disabled when prefers-reduced-motion: reduce is active', async ({ page, TARGET_URL }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await instrument(page);
    await page.goto(TARGET_URL);
    await triggerReorder(page);
    // Skipping the transition entirely is fine; if one runs, it must have no running animations.
    const animated = await page.evaluate(async () => {
      const ts: any[] = (window as any).__vt.transitions;
      await Promise.all(ts.map((t) => t.ready.catch(() => {})));
      return document
        .getAnimations()
        .filter((a: any) => String(a.effect?.pseudoElement ?? '').startsWith('::view-transition'))
        .filter((a) => a.playState === 'running' && Number(a.effect?.getComputedTiming().duration) > 0)
        .map((a: any) => `${a.effect.pseudoElement} ${a.animationName ?? ''}`);
    });
    expect(animated).toEqual([]);
  });

  test('The list element does not have aria-live, and one role="status" region has its text set once per reorder', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const liveAncestor = await page.evaluate(
      () => document.querySelector('.card')?.parentElement?.closest('[aria-live]:not([aria-live="off"]), [role="status"], [role="log"], [role="alert"]')?.outerHTML.slice(0, 120) ?? null,
    );
    expect(liveAncestor).toBeNull();

    const status = page.locator('[role="status"]');
    await expect(status).toHaveCount(1);
    await page.evaluate(() => {
      const el = document.querySelector('[role="status"]')!;
      const w = window as any;
      w.__statusTexts = [] as string[];
      // One record per write, so a loop that writes once per item is counted per write.
      // Clearing the region before writing (to force a repeat announcement) is not counted.
      new MutationObserver((records) => {
        for (const r of records) {
          const t = (r.type === 'characterData'
            ? (r.target as CharacterData).data
            : Array.from(r.addedNodes).map((n) => n.textContent).join('')).trim();
          if (t) w.__statusTexts.push(t);
        }
      }).observe(el, { childList: true, characterData: true, subtree: true });
    });

    await triggerReorder(page, () => page.evaluate(() => { (window as any).__statusTexts = []; }));
    await expect(status).not.toBeEmpty();
    await page.evaluate(() => Promise.all(((window as any).__vt?.transitions ?? []).map((t: any) => t.finished.catch(() => {}))));
    const texts = await page.evaluate(() => (window as any).__statusTexts);
    expect(texts, `status announcements: ${JSON.stringify(texts)}`).toHaveLength(1);
  });

  test('Focus remains on the activated control after the reorder completes', async ({ page, TARGET_URL }) => {
    await instrument(page);
    await page.goto(TARGET_URL);
    const control = await triggerReorder(page);
    await expect(control).toBeFocused();
    await waitForTransitions(page);
    // Catch solutions that move focus after the animation ends.
    await expect(control).toBeFocused();
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await expect(control).toBeFocused();
  });
});
