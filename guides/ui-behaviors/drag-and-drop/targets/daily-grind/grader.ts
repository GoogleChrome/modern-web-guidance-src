import { test, expect } from '../../../../../src/grading/test-fixture.ts';
import type { Page, Locator } from '@playwright/test';

const INITIAL_ORDER = ['Maple Oat Latte', 'Dark Roast Espresso', 'Cold Brew'];
const MOVE_PROPERTY = /^(translate|transform|left|top|inset|insetInline.*|marginLeft|marginInline.*)$/;

function getSeasonalSection(page: Page): Locator {
  return page.locator('section').filter({ has: page.locator('h2', { hasText: 'Seasonal Favorites' }) });
}

function getCards(page: Page): Locator {
  return getSeasonalSection(page).locator('.card');
}

function getCollectionContainer(page: Page): Locator {
  return getCards(page).first().locator('..');
}

function getCardByTitle(page: Page, title: string): Locator {
  return getCards(page).filter({ has: page.locator('h3', { hasText: title }) });
}

// Live regions that announce, excluding any region that wraps the cards themselves.
function getLiveRegions(page: Page): Locator {
  return page
    .locator('[role="status"], [role="alert"], [role="log"], [aria-live]:not([aria-live="off"])')
    .filter({ hasNot: page.locator('.card') });
}

async function getCardTitles(page: Page): Promise<string[]> {
  return getCards(page).locator('h3').evaluateAll((els) => els.map((el) => el.textContent?.trim() ?? ''));
}

// The handle is the card's reorder/drag-named button; otherwise its first button.
async function getHandle(card: Locator): Promise<Locator> {
  const named = card.getByRole('button', { name: /reorder|drag|grab|rearrange/i });
  if ((await named.count()) > 0) return named.first();
  return card.getByRole('button').first();
}

async function dragHandle(page: Page, handle: Locator, to: { x: number; y: number }, release = true): Promise<void> {
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(to.x, to.y, { steps: 10 });
  if (release) await page.mouse.up({ button: 'left' });
}

// Target point 75% across the second card (past its midpoint), recomputed after the handle scrolls into view.
async function pastSecondCard(page: Page): Promise<{ x: number; y: number }> {
  await getHandle(getCards(page).nth(0)).then((h) => h.scrollIntoViewIfNeeded());
  const box = await getCards(page).nth(1).boundingBox();
  expect(box).not.toBeNull();
  return box ? { x: box.x + box.width * 0.75, y: box.y + box.height / 2 } : { x: 0, y: 0 };
}

// True when the list's own ::before/::after renders something.
async function isMarkerShown(container: Locator): Promise<boolean> {
  return container.evaluate((el) =>
    ['::before', '::after'].some((pseudo) => {
      const style = getComputedStyle(el, pseudo);
      return style.content !== 'none' && style.content !== 'normal' && style.display !== 'none' &&
        style.visibility !== 'hidden' && Number(style.opacity) > 0;
    }),
  );
}

// Running movement animations (WAAPI, CSS transitions, or CSS animations) on the cards, sampled after two frames.
async function countCardMoveAnimations(page: Page, title?: string): Promise<number> {
  return getSeasonalSection(page).evaluate(async (section, { title, moveSource }) => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const moveProperty = new RegExp(moveSource);
    const cards = Array.from(section.querySelectorAll('.card'))
      .filter((card) => !title || card.querySelector('h3')?.textContent?.includes(title));
    return cards.flatMap((card) => card.getAnimations()).filter((animation) => {
      if (animation instanceof CSSTransition) {
        return moveProperty.test(animation.transitionProperty.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()));
      }
      const effect = animation.effect;
      if (!(effect instanceof KeyframeEffect)) return false;
      return effect.getKeyframes().some((frame) => Object.keys(frame).some((key) => moveProperty.test(key)));
    }).length;
  }, { title, moveSource: MOVE_PROPERTY.source });
}

async function moveKeyboard(page: Page, card: Locator, direction: 'earlier' | 'later'): Promise<void> {
  const before = (await getCardTitles(page)).join('|');
  const changed = async () => (await getCardTitles(page)).join('|') !== before;
  const handle = await getHandle(card);
  const handleEl = await handle.elementHandle();

  // Separate movement buttons: activate the one for this direction (a disabled one at a boundary is a valid no-op).
  const directionName = direction === 'earlier'
    ? /\b(earlier|left|previous|prev|back|before|up)\b/i
    : /\b(later|right|next|forward|after|down)\b/i;
  const candidates = card.getByRole('button', { name: directionName });
  for (let i = 0; i < (await candidates.count()); i++) {
    const button = candidates.nth(i);
    if (await button.evaluate((el, h) => el === h, handleEl)) continue;
    if (await button.isEnabled()) await button.click();
    return;
  }

  // Focusable handle: direct arrows, modifier + arrows, then grab–move–drop with Space or Enter.
  const key = direction === 'earlier' ? 'ArrowLeft' : 'ArrowRight';
  for (const sequence of [[key], [`Alt+${key}`], ['Space', key, 'Space'], ['Enter', key, 'Enter']]) {
    await handle.focus();
    for (const press of sequence) await page.keyboard.press(press);
    if (await changed()) return;
  }
}

test.describe('drag-and-drop Target Grader', () => {
  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Dragging an item with a pointer changes its DOM and visible position within the collection', async ({ page }) => {
      const cards = getCards(page);
      expect(await cards.count()).toBeGreaterThanOrEqual(2);
      const handle0 = await getHandle(cards.nth(0));
      expect(await handle0.count()).toBeGreaterThan(0);

      await dragHandle(page, handle0, await pastSecondCard(page));

      await expect.poll(async () => (await getCardTitles(page)).slice(0, 2)).toEqual(['Dark Roast Espresso', 'Maple Oat Latte']);
      await expect.poll(async () => {
        const box0 = await cards.nth(0).boundingBox();
        const box1 = await cards.nth(1).boundingBox();
        return box0 && box1 ? box0.x < box1.x : false;
      }).toBe(true);
    });

    test('During a pointer drag, sibling items stay in place and a drop marker indicates landing spot, committing on release', async ({ page }) => {
      const cards = getCards(page);
      const handle0 = await getHandle(cards.first());
      expect(await handle0.count()).toBeGreaterThan(0);
      const container = getCollectionContainer(page);

      const target = await pastSecondCard(page);
      const siblingBoxesBefore = await Promise.all([cards.nth(1).boundingBox(), cards.nth(2).boundingBox()]);
      await dragHandle(page, handle0, target, false);

      // Siblings stay in place: same DOM order and same painted position.
      expect(await getCardTitles(page)).toEqual(INITIAL_ORDER);
      const siblingBoxesDuring = await Promise.all([cards.nth(1).boundingBox(), cards.nth(2).boundingBox()]);
      siblingBoxesDuring.forEach((box, i) => {
        expect(Math.abs((box?.x ?? NaN) - (siblingBoxesBefore[i]?.x ?? NaN))).toBeLessThan(2);
      });

      await expect.poll(() => isMarkerShown(container)).toBe(true);

      await page.mouse.up({ button: 'left' });
      await expect.poll(async () => (await getCardTitles(page))[0]).toBe('Dark Roast Espresso');
      await expect.poll(() => isMarkerShown(container)).toBe(false);
    });

    test('Drop marker is drawn with list pseudo-elements rather than appended to body, and hidden on own slot', async ({ page }) => {
      const cards = getCards(page);
      const handle0 = await getHandle(cards.first());
      expect(await handle0.count()).toBeGreaterThan(0);
      const container = getCollectionContainer(page);

      const target = await pastSecondCard(page);
      const countElements = () => page.evaluate(() => ({
        body: document.body.children.length,
        list: document.querySelector('.card')?.parentElement?.children.length ?? -1,
      }));
      const before = await countElements();

      // Small move: drop spot is still the item's own slot, so no marker.
      const box = await handle0.boundingBox();
      expect(box).not.toBeNull();
      if (!box) return;
      await dragHandle(page, handle0, { x: box.x + box.width / 2 + 6, y: box.y + box.height / 2 }, false);
      expect(await isMarkerShown(container)).toBe(false);

      // Over another slot: the list's own pseudo-element draws the marker and no element is added.
      await page.mouse.move(target.x, target.y, { steps: 10 });
      await expect.poll(() => isMarkerShown(container)).toBe(true);
      expect(await countElements()).toEqual(before);

      await page.mouse.up({ button: 'left' });
    });

    test('Pressing Escape during a pointer drag cancels it, removes marker, and restores original position', async ({ page }) => {
      const cards = getCards(page);
      const handle0 = await getHandle(cards.first());
      expect(await handle0.count()).toBeGreaterThan(0);
      const container = getCollectionContainer(page);

      await dragHandle(page, handle0, await pastSecondCard(page), false);
      await expect.poll(() => isMarkerShown(container)).toBe(true);

      await page.keyboard.press('Escape');
      await expect.poll(() => isMarkerShown(container)).toBe(false);

      await page.mouse.up({ button: 'left' });
      await expect.poll(() => getCardTitles(page)).toEqual(INITIAL_ORDER);
    });

    test('Reordering moves the existing DOM element rather than recreating it, preserving internal control state', async ({ page }) => {
      const cards = getCards(page);
      expect(await (await getHandle(cards.nth(1))).count()).toBeGreaterThan(0);

      await getCardByTitle(page, 'Dark Roast Espresso').evaluate((card) => {
        for (const control of card.querySelectorAll('button, a, [role="button"]')) {
          (control as unknown as Record<string, unknown>).__preservedState = 'state-value-987';
        }
      });

      await moveKeyboard(page, cards.nth(1), 'earlier');
      await expect.poll(async () => (await getCardTitles(page))[0]).toBe('Dark Roast Espresso');

      const statePreserved = await getCardByTitle(page, 'Dark Roast Espresso').evaluate((card) =>
        Array.from(card.querySelectorAll('a')).every((control) => (control as unknown as Record<string, unknown>).__preservedState === 'state-value-987'),
      );
      expect(statePreserved).toBe(true);
    });

    test('Each item provides an accessible keyboard reordering mechanism supporting arrow keys or movement buttons', async ({ page }) => {
      const cards = getCards(page);
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(3);

      for (let i = 0; i < count; i++) {
        const handle = await getHandle(cards.nth(i));
        expect(await handle.count()).toBeGreaterThan(0);
        await handle.focus();
        await expect(handle).toBeFocused();
        await expect(handle).toHaveAccessibleName(/reorder|move|drag|rearrange/i);
      }
    });

    test('Moving an item toward start of list with keyboard mechanism places it immediately before previous sibling', async ({ page }) => {
      const cards = getCards(page);
      expect(await (await getHandle(cards.nth(1))).count()).toBeGreaterThan(0);
      await moveKeyboard(page, cards.nth(1), 'earlier');
      await expect.poll(() => getCardTitles(page)).toEqual(['Dark Roast Espresso', 'Maple Oat Latte', 'Cold Brew']);
    });

    test('Moving an item toward end of list with keyboard mechanism places it immediately after next sibling', async ({ page }) => {
      const cards = getCards(page);
      expect(await (await getHandle(cards.nth(0))).count()).toBeGreaterThan(0);
      await moveKeyboard(page, cards.nth(0), 'later');
      await expect.poll(() => getCardTitles(page)).toEqual(['Dark Roast Espresso', 'Maple Oat Latte', 'Cold Brew']);
    });

    test('Focus remains on the keyboard reordering mechanism after reordering', async ({ page }) => {
      const cards = getCards(page);
      const handle1 = await getHandle(cards.nth(1));
      expect(await handle1.count()).toBeGreaterThan(0);

      await moveKeyboard(page, cards.nth(1), 'earlier');
      await expect.poll(async () => (await getCardTitles(page))[0]).toBe('Dark Roast Espresso');

      // Focus stays on a reorder control (handle or movement button) inside the moved card.
      await expect.poll(() => getCardByTitle(page, 'Dark Roast Espresso').evaluate((card) => {
        const active = document.activeElement;
        return Boolean(active && card.contains(active) && active.closest('a') === null && (active.matches('button, [role="button"]')));
      })).toBe(true);
    });

    test('Moving first item toward start or last item toward end with keyboard mechanism leaves DOM order unchanged', async ({ page }) => {
      const cards = getCards(page);
      expect(await (await getHandle(cards.first())).count()).toBeGreaterThan(0);

      // Presence: the mechanism moves an interior item.
      await moveKeyboard(page, cards.nth(1), 'later');
      await expect.poll(() => getCardTitles(page)).toEqual(['Maple Oat Latte', 'Cold Brew', 'Dark Roast Espresso']);

      await moveKeyboard(page, getCardByTitle(page, 'Maple Oat Latte'), 'earlier');
      expect(await getCardTitles(page)).toEqual(['Maple Oat Latte', 'Cold Brew', 'Dark Roast Espresso']);

      await moveKeyboard(page, getCardByTitle(page, 'Dark Roast Espresso'), 'later');
      expect(await getCardTitles(page)).toEqual(['Maple Oat Latte', 'Cold Brew', 'Dark Roast Espresso']);
    });

    test('Reordering is animated for displaced siblings and skipped under prefers-reduced-motion reduce', async ({ page }) => {
      const cards = getCards(page);
      expect(await (await getHandle(cards.nth(1))).count()).toBeGreaterThan(0);

      await moveKeyboard(page, cards.nth(1), 'earlier');
      await expect.poll(async () => (await getCardTitles(page))[0]).toBe('Dark Roast Espresso');
      // The displaced sibling travels to its new slot.
      expect(await countCardMoveAnimations(page, 'Maple Oat Latte')).toBeGreaterThan(0);

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.reload();
      await moveKeyboard(page, getCards(page).nth(1), 'earlier');
      await expect.poll(async () => (await getCardTitles(page))[0]).toBe('Dark Roast Espresso');
      expect(await countCardMoveAnimations(page)).toBe(0);
    });

    test('During pointer drag, real item follows pointer via CSS translation, stays child of list, and animates on end', async ({ page }) => {
      const cards = getCards(page);
      const card0 = cards.nth(0);
      const handle0 = await getHandle(card0);
      expect(await handle0.count()).toBeGreaterThan(0);
      const containerEl = await getCollectionContainer(page).elementHandle();

      const box = await handle0.boundingBox();
      expect(box).not.toBeNull();
      if (!box) return;
      await dragHandle(page, handle0, { x: box.x + box.width / 2 + 80, y: box.y + box.height / 2 }, false);

      // The real item (not a clone) stays a child of the list.
      expect(await card0.evaluate((el, list) => el.parentElement === list, containerEl)).toBe(true);
      expect(await page.locator('h3', { hasText: 'Maple Oat Latte' }).count()).toBe(1);

      // It follows the pointer with a CSS translation.
      await expect.poll(() => card0.evaluate((el) => {
        const style = getComputedStyle(el);
        const translated = style.translate !== 'none' && !/^0px( 0px)?$/.test(style.translate);
        const transformed = style.transform !== 'none' && style.transform !== 'matrix(1, 0, 0, 1, 0, 0)';
        return translated || transformed;
      })).toBe(true);

      // It animates to its resting place on release.
      await page.mouse.up({ button: 'left' });
      expect(await countCardMoveAnimations(page, 'Maple Oat Latte')).toBeGreaterThan(0);
    });

    test('Reordering actions are announced in a live region with the item new position', async ({ page }) => {
      const cards = getCards(page);
      expect(await (await getHandle(cards.nth(1))).count()).toBeGreaterThan(0);
      const live = getLiveRegions(page);
      expect(await live.count()).toBeGreaterThan(0);

      await moveKeyboard(page, cards.nth(1), 'earlier');

      await expect.poll(async () => (await live.allTextContents()).join(' '), { timeout: 4000 })
        .toMatch(/\b1\s*(of|\/)\s*3\b|position:?\s*1\b|\bfirst\b/i);
    });

    test('Releasing a drag without changing position does not announce a move', async ({ page }) => {
      const cards = getCards(page);
      const handle0 = await getHandle(cards.first());
      expect(await handle0.count()).toBeGreaterThan(0);
      const live = getLiveRegions(page);
      expect(await live.count()).toBeGreaterThan(0);

      // Record every text the live regions receive, including ones replaced before the check.
      await live.evaluateAll((regions) => {
        const log: string[] = [];
        (window as unknown as Record<string, unknown>).__liveLog = log;
        for (const region of regions) {
          region.textContent = '';
          new MutationObserver(() => log.push(region.textContent ?? '')).observe(region, { childList: true, characterData: true, subtree: true });
        }
      });

      await handle0.click();
      // Absence check: outlast the guide's ~500 ms announcement debounce.
      await page.waitForTimeout(800);

      const log = await page.evaluate(() => ((window as unknown as Record<string, unknown>).__liveLog as string[]).join(' '));
      const positional = /\b(moved|dropped)\b|\bposition\s*\d|\b\d+\s*of\s*\d+\b/i;
      const pickup = /grab|pick(ed)?\s*up|lifted/i;
      expect(positional.test(log) && !pickup.test(log)).toBe(false);
    });

    test('Collection renders its items in a readable and usable default DOM order before reordering', async ({ page }) => {
      const cards = getCards(page);
      expect(await (await getHandle(cards.first())).count()).toBeGreaterThan(0);
      expect(await getCardTitles(page)).toEqual(INITIAL_ORDER);
      for (let i = 0; i < 3; i++) await expect(cards.nth(i)).toBeVisible();
    });

    test('On narrow mobile viewport, items and movement controls fit without horizontal scrolling', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 640 });
      const cards = getCards(page);
      expect(await cards.getByRole('button').count()).toBeGreaterThan(0);

      const fits = await getSeasonalSection(page).evaluate((section) => {
        // The row itself may scroll internally; it must not overflow the viewport (the base app's nav already does).
        const list = section.querySelector('.card')?.parentElement;
        const listRect = list?.getBoundingClientRect();
        const pageFits = Boolean(listRect && listRect.left >= -1 && listRect.right <= window.innerWidth + 1);
        const cardsFit = Array.from(section.querySelectorAll('.card')).every((card) => {
          const cardRect = card.getBoundingClientRect();
          const controls = Array.from(card.querySelectorAll('button, [role="button"]'));
          return controls.length > 0 && card.scrollWidth <= card.clientWidth + 2 && controls.every((control) => {
            const rect = control.getBoundingClientRect();
            return rect.left >= cardRect.left - 2 && rect.right <= cardRect.right + 2;
          });
        });
        return pageFits && cardsFit;
      });
      expect(fits).toBe(true);
    });
  });
});
