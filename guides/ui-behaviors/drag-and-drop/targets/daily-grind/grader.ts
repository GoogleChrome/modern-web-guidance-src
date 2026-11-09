import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';
import { CSSStyleRule } from 'cssomnom';
import type { Page, Locator } from '@playwright/test';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getSeasonalSection(page: Page): Locator {
  return page.locator('section').filter({ has: page.locator('h2', { hasText: 'Seasonal Favorites' }) });
}

function getCards(page: Page): Locator {
  return getSeasonalSection(page).locator('.card');
}

function getCollectionContainer(page: Page): Locator {
  return getSeasonalSection(page).locator('.card').first().locator('..');
}

async function getCardTitles(page: Page): Promise<string[]> {
  const cards = getCards(page);
  const count = await cards.count();
  const titles: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = await cards.nth(i).locator('h3').textContent();
    titles.push(text?.trim() || '');
  }
  return titles;
}

async function moveKeyboard(page: Page, cardLocator: Locator, direction: 'earlier' | 'later'): Promise<void> {
  const moveBtn = cardLocator.locator('button, [role="button"]').filter({
    hasText: direction === 'earlier' ? /earlier|left|prev|start|up/i : /later|right|next|end|down/i,
  }).or(
    cardLocator.locator(`button[aria-label*="${direction === 'earlier' ? 'left' : 'right'}" i], button[aria-label*="${direction === 'earlier' ? 'earlier' : 'later'}" i]`),
  );
  if (await moveBtn.count() > 0) {
    await moveBtn.first().click();
    return;
  }

  const handle = cardLocator.locator('button, [role="button"]').first();
  await handle.focus();

  const arrowKey = direction === 'earlier' ? 'ArrowLeft' : 'ArrowRight';
  const altArrowKey = direction === 'earlier' ? 'Alt+ArrowLeft' : 'Alt+ArrowRight';

  const hasAriaPressed = await handle.getAttribute('aria-pressed');
  if (hasAriaPressed !== null) {
    // Grab–move–drop mode (Space or Enter to pick up, arrow to move, Space or Enter to drop)
    await page.keyboard.press('Space');
    await page.keyboard.press(arrowKey);
    await page.keyboard.press('Space');
  } else {
    // Modifier or direct arrow keys (Alt+Arrow or Arrow)
    const titlesBefore = (await getCardTitles(page)).join(',');
    await page.keyboard.press(altArrowKey);
    const titlesAfter = (await getCardTitles(page)).join(',');
    if (titlesBefore === titlesAfter) {
      await page.keyboard.press(arrowKey);
    }
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
      const handle0 = cards.nth(0).locator('button').first();
      expect(await handle0.count()).toBeGreaterThan(0);

      const handleBox = await handle0.boundingBox();
      const card1Box = await cards.nth(1).boundingBox();
      expect(handleBox).not.toBeNull();
      expect(card1Box).not.toBeNull();

      const startX = handleBox!.x + handleBox!.width / 2;
      const startY = handleBox!.y + handleBox!.height / 2;
      const targetX = card1Box!.x + card1Box!.width * 0.75;
      const targetY = card1Box!.y + card1Box!.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down({ button: 'left' });
      await page.mouse.move(targetX, targetY, { steps: 10 });
      await page.mouse.up({ button: 'left' });

      // Changes DOM position
      await expect.poll(async () => (await getCardTitles(page))[0]).toBe('Dark Roast Espresso');

      // Changes visible position
      await expect.poll(async () => {
        const box0 = await cards.nth(0).boundingBox();
        const box1 = await cards.nth(1).boundingBox();
        return box0 && box1 ? box0.x < box1.x : false;
      }, { timeout: 2000 }).toBe(true);
    });

    test('During a pointer drag, sibling items stay in place and a drop marker indicates landing spot, committing on release', async ({ page }) => {
      const cards = getCards(page);
      const handle0 = cards.first().locator('button').first();
      expect(await handle0.count()).toBeGreaterThan(0);
      const container = getCollectionContainer(page);
      expect(await container.count()).toBeGreaterThan(0);

      const handleBox = await handle0.boundingBox();
      const card1Box = await cards.nth(1).boundingBox();
      expect(handleBox).not.toBeNull();
      expect(card1Box).not.toBeNull();

      const startX = handleBox!.x + handleBox!.width / 2;
      const startY = handleBox!.y + handleBox!.height / 2;
      const targetX = card1Box!.x + card1Box!.width * 0.75;
      const targetY = card1Box!.y + card1Box!.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down({ button: 'left' });
      await page.mouse.move(targetX, targetY, { steps: 10 });

      // Sibling items stay in place in DOM during drag
      const titlesDuring = await getCardTitles(page);
      expect(titlesDuring[0]).toBe('Maple Oat Latte');

      // Drop marker indicates landing spot
      expect(await container.evaluate((el: HTMLElement) => el.hasAttribute('data-drop'))).toBe(true);

      // Commits DOM move once on release
      await page.mouse.up({ button: 'left' });
      await expect.poll(async () => (await getCardTitles(page))[0]).toBe('Dark Roast Espresso');
      expect(await container.evaluate((el: HTMLElement) => el.hasAttribute('data-drop'))).toBe(false);
    });

    test('Drop marker is drawn with list pseudo-elements rather than appended to body, and hidden on own slot', async ({ page }) => {
      const cards = getCards(page);
      const handle0 = cards.first().locator('button').first();
      expect(await handle0.count()).toBeGreaterThan(0);
      const container = getCollectionContainer(page);
      expect(await container.count()).toBeGreaterThan(0);

      // Verify static CSS rules define pseudo-elements for the drop marker
      const stylesheet = getCssStyleSheet(targetFiles);
      const styleRules = getRules(stylesheet, CSSStyleRule);
      const hasDropMarkerPseudo = styleRules.some(r =>
        r.selectorText.includes('data-drop') && (r.selectorText.includes('::before') || r.selectorText.includes('::after'))
      );
      expect(hasDropMarkerPseudo).toBe(true);

      const initialBodyChildCount = await page.evaluate(() => document.body.children.length);

      const handleBox = await handle0.boundingBox();
      const card1Box = await cards.nth(1).boundingBox();
      expect(handleBox).not.toBeNull();
      expect(card1Box).not.toBeNull();

      const startX = handleBox!.x + handleBox!.width / 2;
      const startY = handleBox!.y + handleBox!.height / 2;
      const targetX = card1Box!.x + card1Box!.width * 0.75;
      const targetY = card1Box!.y + card1Box!.height / 2;

      // Start drag and stay within item's own slot
      await page.mouse.move(startX, startY);
      await page.mouse.down({ button: 'left' });
      await page.mouse.move(startX + 6, startY, { steps: 2 });

      // No marker is shown when the drop spot is the item's own slot
      const markerOnOwnSlot = await container.evaluate((el: HTMLElement) => el.hasAttribute('data-drop'));
      expect(markerOnOwnSlot).toBe(false);

      // Move to another slot
      await page.mouse.move(targetX, targetY, { steps: 10 });
      const markerOnOtherSlot = await container.evaluate((el: HTMLElement) => el.hasAttribute('data-drop'));
      expect(markerOnOtherSlot).toBe(true);

      // Verify no element was appended to <body>
      const bodyChildCount = await page.evaluate(() => document.body.children.length);
      expect(bodyChildCount).toBe(initialBodyChildCount);

      await page.mouse.up({ button: 'left' });
    });

    test('Pressing Escape during a pointer drag cancels it, removes marker, and restores original position', async ({ page }) => {
      const cards = getCards(page);
      const handle0 = cards.first().locator('button').first();
      expect(await handle0.count()).toBeGreaterThan(0);
      const container = getCollectionContainer(page);
      expect(await container.count()).toBeGreaterThan(0);

      const handleBox = await handle0.boundingBox();
      const card1Box = await cards.nth(1).boundingBox();
      expect(handleBox).not.toBeNull();
      expect(card1Box).not.toBeNull();

      const startX = handleBox!.x + handleBox!.width / 2;
      const startY = handleBox!.y + handleBox!.height / 2;
      const targetX = card1Box!.x + card1Box!.width * 0.75;
      const targetY = card1Box!.y + card1Box!.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down({ button: 'left' });
      await page.mouse.move(targetX, targetY, { steps: 10 });

      expect(await container.evaluate((el: HTMLElement) => el.hasAttribute('data-drop'))).toBe(true);

      // Press Escape to cancel
      await page.keyboard.press('Escape');

      expect(await container.evaluate((el: HTMLElement) => el.hasAttribute('data-drop'))).toBe(false);

      await page.mouse.up({ button: 'left' });

      const titles = await getCardTitles(page);
      expect(titles[0]).toBe('Maple Oat Latte');
    });

    test('Reordering moves the existing DOM element rather than recreating it, preserving internal control state', async ({ page }) => {
      const cards = getCards(page);
      const handle1 = cards.nth(1).locator('button').first();
      expect(await handle1.count()).toBeGreaterThan(0);

      // Attach custom expando state to a control inside the second card
      await page.evaluate(() => {
        const card = document.querySelectorAll('.card')[1];
        const control = card?.querySelector('button, a');
        if (control) {
          (control as unknown as Record<string, unknown>).__preservedState = 'state-value-987';
        }
      });

      await moveKeyboard(page, cards.nth(1), 'earlier');

      await expect.poll(async () => (await getCardTitles(page))[0]).toBe('Dark Roast Espresso');

      // Verify that the element was moved in DOM preserving state rather than recreated
      const statePreserved = await page.evaluate(() => {
        const card = Array.from(document.querySelectorAll('.card')).find(c =>
          c.querySelector('h3')?.textContent?.includes('Dark Roast Espresso')
        );
        const control = card?.querySelector('button, a');
        return (control as unknown as Record<string, unknown>)?.__preservedState === 'state-value-987';
      });
      expect(statePreserved).toBe(true);
    });

    test('Each item provides an accessible keyboard reordering mechanism supporting arrow keys or movement buttons', async ({ page }) => {
      const cards = getCards(page);
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(3);

      for (let i = 0; i < count; i++) {
        const handle = cards.nth(i).locator('button').first();
        expect(await handle.count()).toBeGreaterThan(0);

        await handle.focus();
        expect(await handle.evaluate((el: HTMLElement) => document.activeElement === el)).toBe(true);

        const accessibleName = await handle.evaluate((el: HTMLElement) => {
          return el.getAttribute('aria-label') || el.textContent || '';
        });
        expect(accessibleName.toLowerCase()).toMatch(/reorder|move|latte|espresso|brew/i);
      }
    });

    test('Moving an item toward start of list with keyboard mechanism places it immediately before previous sibling', async ({ page }) => {
      const cards = getCards(page);
      const handle1 = cards.nth(1).locator('button').first();
      expect(await handle1.count()).toBeGreaterThan(0);

      await moveKeyboard(page, cards.nth(1), 'earlier');

      await expect.poll(async () => {
        const titles = await getCardTitles(page);
        return titles.slice(0, 2);
      }).toEqual(['Dark Roast Espresso', 'Maple Oat Latte']);
    });

    test('Moving an item toward end of list with keyboard mechanism places it immediately after next sibling', async ({ page }) => {
      const cards = getCards(page);
      const handle0 = cards.nth(0).locator('button').first();
      expect(await handle0.count()).toBeGreaterThan(0);

      await moveKeyboard(page, cards.nth(0), 'later');

      await expect.poll(async () => {
        const titles = await getCardTitles(page);
        return titles.slice(0, 2);
      }).toEqual(['Dark Roast Espresso', 'Maple Oat Latte']);
    });

    test('Focus remains on the keyboard reordering mechanism after reordering', async ({ page }) => {
      const cards = getCards(page);
      const handle1 = cards.nth(1).locator('button').first();
      expect(await handle1.count()).toBeGreaterThan(0);

      await handle1.focus();
      expect(await handle1.evaluate((el: HTMLElement) => document.activeElement === el)).toBe(true);

      await moveKeyboard(page, cards.nth(1), 'earlier');

      // Verify focus remains on the moved card's reordering mechanism or control
      await expect.poll(async () => {
        return page.evaluate(() => {
          const active = document.activeElement;
          const cardsList = Array.from(document.querySelectorAll('.card'));
          const movedCard = cardsList.find(c => c.querySelector('h3')?.textContent?.includes('Dark Roast Espresso'));
          return movedCard ? movedCard.contains(active) : false;
        });
      }).toBe(true);
    });

    test('Moving first item toward start or last item toward end with keyboard mechanism leaves DOM order unchanged', async ({ page }) => {
      const cards = getCards(page);
      const handle0 = cards.first().locator('button').first();
      expect(await handle0.count()).toBeGreaterThan(0);

      // Attempt to move first item toward start
      await moveKeyboard(page, cards.first(), 'earlier');
      expect(await getCardTitles(page)).toEqual(['Maple Oat Latte', 'Dark Roast Espresso', 'Cold Brew']);

      // Attempt to move last item toward end
      await moveKeyboard(page, cards.last(), 'later');
      expect(await getCardTitles(page)).toEqual(['Maple Oat Latte', 'Dark Roast Espresso', 'Cold Brew']);
    });

    test('Reordering is animated for displaced siblings and skipped under prefers-reduced-motion reduce', async ({ page }) => {
      const cards = getCards(page);
      const handle1 = cards.nth(1).locator('button').first();
      expect(await handle1.count()).toBeGreaterThan(0);

      // 1. Standard motion: displaced siblings should animate
      await page.evaluate(() => {
        (window as unknown as Record<string, unknown>).__animCount = 0;
        const orig = Element.prototype.animate;
        Element.prototype.animate = function (...args) {
          ((window as unknown as Record<string, unknown>).__animCount as number)++;
          return orig.apply(this, args);
        };
      });

      await moveKeyboard(page, cards.nth(1), 'earlier');
      const countStandard = await page.evaluate(() => (window as unknown as Record<string, unknown>).__animCount as number);
      expect(countStandard).toBeGreaterThan(0);

      // 2. Reduced motion: animations should be skipped
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.reload();
      await page.evaluate(() => {
        (window as unknown as Record<string, unknown>).__animCount = 0;
        const orig = Element.prototype.animate;
        Element.prototype.animate = function (...args) {
          ((window as unknown as Record<string, unknown>).__animCount as number)++;
          return orig.apply(this, args);
        };
      });

      const cardsReduced = getCards(page);
      await moveKeyboard(page, cardsReduced.nth(1), 'earlier');
      const countReduced = await page.evaluate(() => (window as unknown as Record<string, unknown>).__animCount as number);
      expect(countReduced).toBe(0);
    });

    test('During pointer drag, real item follows pointer via CSS translation, stays child of list, and animates on end', async ({ page }) => {
      const cards = getCards(page);
      const card0 = cards.nth(0);
      const handle0 = card0.locator('button').first();
      expect(await handle0.count()).toBeGreaterThan(0);
      const container = getCollectionContainer(page);
      expect(await container.count()).toBeGreaterThan(0);

      const handleBox = await handle0.boundingBox();
      expect(handleBox).not.toBeNull();
      const startX = handleBox!.x + handleBox!.width / 2;
      const startY = handleBox!.y + handleBox!.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down({ button: 'left' });
      await page.mouse.move(startX + 80, startY, { steps: 5 });

      // Real dragged item stays a child of the list
      const staysChild = await page.evaluate(() => {
        const section = document.querySelector('section');
        const cardsList = section?.querySelectorAll('.card');
        const first = cardsList?.[0];
        return Boolean(first && first.parentElement && first.parentElement !== document.body && section?.contains(first.parentElement));
      });
      expect(staysChild).toBe(true);

      // Item follows pointer via CSS translation
      const hasTranslate = await card0.evaluate((el: HTMLElement) => {
        const style = window.getComputedStyle(el);
        const inline = el.style.translate || el.style.transform;
        const computed = (style.translate && style.translate !== 'none' && style.translate !== '0px') ||
                         (style.transform && style.transform !== 'none' && style.transform !== 'matrix(1, 0, 0, 1, 0, 0)');
        return Boolean(inline || computed);
      });
      expect(hasTranslate).toBe(true);

      // Animates to its resting place when drag ends
      await page.evaluate(() => {
        (window as unknown as Record<string, unknown>).__settleAnimated = false;
        const orig = Element.prototype.animate;
        Element.prototype.animate = function (...args) {
          (window as unknown as Record<string, unknown>).__settleAnimated = true;
          return orig.apply(this, args);
        };
      });

      await page.mouse.up({ button: 'left' });
      const animated = await page.evaluate(() => (window as unknown as Record<string, unknown>).__settleAnimated as boolean);
      expect(animated).toBe(true);
    });

    test('Reordering actions are announced in a live region with the item new position', async ({ page }) => {
      const cards = getCards(page);
      const handle1 = cards.nth(1).locator('button').first();
      expect(await handle1.count()).toBeGreaterThan(0);
      const live = page.locator('[role="status"], [aria-live]');
      expect(await live.count()).toBeGreaterThan(0);

      await moveKeyboard(page, cards.nth(1), 'earlier');

      await expect.poll(async () => {
        const texts = await live.allTextContents();
        return texts.join(' ');
      }, { timeout: 4000 }).toMatch(/position 1|1 of 3|position:? 1|1/i);
    });

    test('Releasing a drag without changing position does not announce a move', async ({ page }) => {
      const cards = getCards(page);
      const handle0 = cards.first().locator('button').first();
      expect(await handle0.count()).toBeGreaterThan(0);
      const live = page.locator('[role="status"], [aria-live]');
      expect(await live.count()).toBeGreaterThan(0);

      await live.evaluate((el: HTMLElement) => { el.textContent = ''; });

      await handle0.click();

      // Wait longer than the ~500ms debounce
      await page.waitForTimeout(700);

      const text = (await live.allTextContents()).join(' ').toLowerCase();
      expect(text).not.toMatch(/moved|dropped at position/);
    });

    test('Collection renders its items in a readable and usable default DOM order before reordering', async ({ page }) => {
      const cards = getCards(page);
      const handles = cards.locator('button');
      expect(await handles.count()).toBeGreaterThan(0);

      const titles = await getCardTitles(page);
      expect(titles).toEqual(['Maple Oat Latte', 'Dark Roast Espresso', 'Cold Brew']);

      await expect(cards.nth(0)).toBeVisible();
      await expect(cards.nth(1)).toBeVisible();
      await expect(cards.nth(2)).toBeVisible();
    });

    test('On narrow mobile viewport, items and movement controls fit without horizontal scrolling', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 640 });
      const cards = getCards(page);
      const handles = cards.locator('button');
      expect(await handles.count()).toBeGreaterThan(0);

      const fits = await page.evaluate(() => {
        const section = document.querySelector('section');
        const cardsList = Array.from(section?.querySelectorAll('.card') || []);
        if (cardsList.length === 0) return false;
        return cardsList.every((card) => {
          const btn = card.querySelector('button');
          if (!btn) return false;
          const cRect = card.getBoundingClientRect();
          const bRect = btn.getBoundingClientRect();
          const insideX = bRect.left >= cRect.left - 2 && bRect.right <= cRect.right + 2;
          const noScroll = card.scrollWidth <= card.clientWidth + 2;
          return insideX && noScroll;
        });
      });
      expect(fits).toBe(true);
    });

  });
});
