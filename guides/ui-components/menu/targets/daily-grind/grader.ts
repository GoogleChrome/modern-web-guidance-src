import * as path from 'path';
import { pathToFileURL } from 'url';

import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';

import {
  CSSStyleRule,
  CSSSupportsRule,
  CSSPositionTryRule,
} from 'cssomnom';

import type { Page, Locator } from '@playwright/test';

// @ts-ignore
const metaUrl = typeof import.meta !== 'undefined' ? (import.meta as any).url : undefined;
const currentFileUrl = metaUrl || (typeof __filename !== 'undefined' ? pathToFileURL(__filename).toString() : pathToFileURL(path.resolve(process.cwd(), 'grader.ts')).toString());

const targetFiles: string[] = getTargetFiles(currentFileUrl);

// --- Browser Helpers ---

async function isPopoverOpen(page: Page, selectorOrLocator: string | Locator): Promise<boolean> {
  const locator = typeof selectorOrLocator === 'string' ? page.locator(selectorOrLocator) : selectorOrLocator;
  if ((await locator.count()) === 0) return false;
  return await locator.evaluate((el: HTMLElement) => {
    return el.matches(':popover-open, .\\:popover-open');
  });
}

async function getTopLevelTrigger(page: Page): Promise<Locator> {
  const id = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll<HTMLElement>('button[commandfor]'));
    const top = btns.find(b => !b.closest('[popover]'));
    if (!top) return null;
    if (!top.id) top.id = `_trig_${Math.random().toString(36).slice(2)}`;
    return top.id;
  });
  if (!id) return page.locator('nonexistent-top-level-trigger');
  return page.locator(`#${id}`);
}

async function getSubmenuTrigger(page: Page): Promise<Locator> {
  const id = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll<HTMLElement>('button[commandfor]'));
    const sub = btns.find(b => Boolean(b.closest('[popover]')));
    if (!sub) return null;
    if (!sub.id) sub.id = `_subtrig_${Math.random().toString(36).slice(2)}`;
    return sub.id;
  });
  if (!id) return page.locator('nonexistent-submenu-trigger');
  return page.locator(`#${id}`);
}

async function getSiblingItem(page: Page, triggerLocator: Locator): Promise<Locator> {
  const id = await triggerLocator.evaluate((el: HTMLElement) => {
    const group = el.closest('[focusgroup]');
    if (!group) return null;
    const items = Array.from(group.querySelectorAll<HTMLElement>('button, a'))
      .filter(item => item.closest('[focusgroup]') === group && item !== el);
    const sibling = items[0];
    if (!sibling) return null;
    if (!sibling.id) sibling.id = `_sib_${Math.random().toString(36).slice(2)}`;
    return sibling.id;
  });
  if (!id) return page.locator('nonexistent-sibling');
  return page.locator(`#${id}`);
}

async function openMenuPathTo(page: Page, targetSelector: string): Promise<void> {
  const triggerIds = await page.evaluate((selector: string) => {
    const target = document.querySelector(selector);
    if (!target) return null;
    const ids: string[] = [];
    let current: Element | null = target;
    while (current) {
      const popover = current.closest('[popover]');
      if (!popover) break;
      const trigger = document.querySelector<HTMLElement>(`[commandfor="${popover.id}"]`);
      if (!trigger) break;
      if (!trigger.id) trigger.id = `_path_trig_${Math.random().toString(36).slice(2)}`;
      ids.unshift(trigger.id);
      current = trigger.parentElement;
    }
    return ids;
  }, targetSelector);

  if (!triggerIds) return;
  for (const id of triggerIds) {
    const trig = page.locator(`#${id}`);
    const popoverId = await trig.getAttribute('commandfor');
    const popover = page.locator(`#${popoverId}`);
    const isOpen = await isPopoverOpen(page, popover);
    if (!isOpen) {
      await trig.click();
      await page.waitForTimeout(50);
    }
  }
}

test.describe('Menu Component Grader', () => {

  // --- STATIC PARSER TESTS (STRUCTURE & API USAGE) ---

  test('Each trigger is a button[type="button"] with aria-haspopup="menu", commandfor, command="toggle-popover", and no popovertarget or popovertargetaction', () => {
    const docs = getHtmlDocuments(targetFiles);
    const triggers = docs.flatMap(d =>
      Array.from(d.document.querySelectorAll('button[commandfor], button[aria-haspopup="menu"], [commandfor]')) as any[]
    );
    expect(triggers.length).toBeGreaterThan(0);

    for (const trigger of triggers) {
      expect(trigger.tagName.toLowerCase()).toBe('button');
      expect(trigger.getAttribute('type')).toBe('button');
      expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
      expect(trigger.getAttribute('commandfor')).toBeTruthy();
      expect(trigger.getAttribute('command')).toBe('toggle-popover');
      expect(trigger.hasAttribute('popovertarget')).toBe(false);
      expect(trigger.hasAttribute('popovertargetaction')).toBe(false);
    }
  });

  test('Menus are anchored to their triggers via CSS Anchor Positioning without per-menu CSS anchor rules, positioning top-level menus below and submenus beside with indented fallback', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    expect(stylesheet.cssRules.length).toBeGreaterThan(0);

    const tryRules = getRules(stylesheet, CSSPositionTryRule);
    const belowRule = tryRules.find(r => r.name === '--below');
    expect(belowRule).toBeDefined();

    const belowArea = belowRule?.style.getPropertyValue('position-area') || '';
    expect(belowArea).toContain('block-end');

    const belowMargin = belowRule?.style.getPropertyValue('margin-inline-start') || '';
    expect(belowMargin).toBeTruthy();

    const supportsRules = getRules(stylesheet, CSSSupportsRule);
    const anchorSupports = supportsRules.find(r => r.conditionText.includes('position-area'));
    expect(anchorSupports).toBeDefined();

    const nestedRules = getRules(anchorSupports!, CSSStyleRule);
    expect(nestedRules.length).toBeGreaterThan(0);

    const submenuRule = nestedRules.find(r => r.selectorText.includes('[focusgroup') && (r.selectorText.includes('popover') || r.selectorText.includes('.popup')));
    expect(submenuRule).toBeDefined();
    expect(submenuRule?.style.getPropertyValue('position-area')).toContain('inline-end');
    expect(submenuRule?.style.getPropertyValue('position-try-fallbacks')).toContain('--below');

    const topRule = nestedRules.find(r => !r.selectorText.includes('[focusgroup') && (r.selectorText.includes('popover') || r.selectorText.includes('.popup')));
    expect(topRule).toBeDefined();
    expect(topRule?.style.getPropertyValue('position-area')).toContain('block-end');
  });

  test('Menu items align their content across rows with fixed-size leading icon or check slot and trailing content at inline end, without subgrid', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    expect(stylesheet.cssRules.length).toBeGreaterThan(0);

    const styleRules = getRules(stylesheet, CSSStyleRule);

    const subgridRule = styleRules.find(r =>
      r.style.getPropertyValue('grid-template-columns')?.includes('subgrid') ||
      r.style.getPropertyValue('grid-template-rows')?.includes('subgrid')
    );
    expect(subgridRule).toBeUndefined();

    const beforeRule = styleRules.find(r => r.selectorText.includes('[focusgroup') && r.selectorText.includes('::before'));
    expect(beforeRule).toBeDefined();
    const slotSize = beforeRule?.style.getPropertyValue('inline-size') || beforeRule?.style.getPropertyValue('width');
    expect(slotSize).toBeTruthy();

    const hintRule = styleRules.find(r => r.selectorText.includes('.hint') || r.selectorText.includes('hint'));
    expect(hintRule).toBeDefined();
    const marginEnd = hintRule?.style.getPropertyValue('margin-inline-start') || hintRule?.style.getPropertyValue('margin-left');
    expect(marginEnd).toContain('auto');
  });

  // --- BROWSER TESTS (RUNTIME BEHAVIOR & INTERACTION) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Each menu list has focusgroup="menu nomemory" on an element inside its popover, exposes role="menu" labeled by its trigger via aria-labelledby, and exposes role="menuitem" on command buttons', async ({ page }) => {
      const result = await page.evaluate(() => {
        const popovers = Array.from(document.querySelectorAll<HTMLElement>('[popover]'));
        if (popovers.length === 0) return { error: 'no popovers found', count: 0 };

        for (const popover of popovers) {
          if (popover.hasAttribute('focusgroup')) {
            return { error: 'focusgroup should not be on popover element itself', count: popovers.length };
          }
          const group = popover.querySelector<HTMLElement>('[focusgroup]');
          if (!group) {
            return { error: 'no element with focusgroup found inside popover', count: popovers.length };
          }
          const fg = group.getAttribute('focusgroup') || '';
          if (!/\bmenu\b/.test(fg) || !/\bnomemory\b/.test(fg)) {
            return { error: `focusgroup attribute "${fg}" missing "menu" or "nomemory"`, count: popovers.length };
          }
          const role = group.getAttribute('role');
          if (role !== 'menu') {
            return { error: `expected role="menu" but got "${role}"`, count: popovers.length };
          }
          const labelledBy = group.getAttribute('aria-labelledby');
          if (!labelledBy || !document.getElementById(labelledBy)) {
            return { error: `missing or invalid aria-labelledby on menu: "${labelledBy}"`, count: popovers.length };
          }
          const commandButtons = Array.from(group.querySelectorAll<HTMLElement>('button'))
            .filter(btn => btn.closest('[focusgroup]') === group)
            .filter(btn => {
              const r = btn.getAttribute('role');
              return !r || r === 'menuitem';
            });
          for (const btn of commandButtons) {
            if (btn.getAttribute('role') !== 'menuitem') {
              return { error: 'command button missing role="menuitem"', count: popovers.length };
            }
          }
        }
        return { ok: true, count: popovers.length };
      });

      expect(result.count).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
      expect(result.ok).toBe(true);
    });

    test('Separators between item groups are <hr> elements, checkable items are button[type="button"] with role="menuitemcheckbox" or "menuitemradio" (radios in named role="group") and aria-checked, Space toggles checkbox and keeps open, Enter toggles and closes, radios close on either key', async ({ page }) => {
      const domCheck = await page.evaluate(() => {
        const hrs = Array.from(document.querySelectorAll('[focusgroup] hr'));
        const checkboxes = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]'));
        const radios = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemradio"]'));

        if (hrs.length === 0) return { error: 'no <hr> separators found in menus' };
        if (checkboxes.length === 0) return { error: 'no role="menuitemcheckbox" items found' };
        if (radios.length === 0) return { error: 'no role="menuitemradio" items found' };

        for (const cb of checkboxes) {
          if (cb.tagName !== 'BUTTON' || cb.getAttribute('type') !== 'button') {
            return { error: 'checkbox item must be a <button type="button">' };
          }
          const checked = cb.getAttribute('aria-checked');
          if (checked !== 'true' && checked !== 'false') {
            return { error: 'checkbox item must have aria-checked="true" or "false"' };
          }
        }

        for (const rd of radios) {
          if (rd.tagName !== 'BUTTON' || rd.getAttribute('type') !== 'button') {
            return { error: 'radio item must be a <button type="button">' };
          }
          const checked = rd.getAttribute('aria-checked');
          if (checked !== 'true' && checked !== 'false') {
            return { error: 'radio item must have aria-checked="true" or "false"' };
          }
          const group = rd.closest('[role="group"]');
          if (!group) {
            return { error: 'radio item must be wrapped in role="group"' };
          }
          const name = group.getAttribute('aria-label') || group.getAttribute('aria-labelledby');
          if (!name) {
            return { error: 'role="group" wrapping radios must be named via aria-label or aria-labelledby' };
          }
        }

        return { ok: true, checkboxCount: checkboxes.length, radioCount: radios.length };
      });

      expect(domCheck.error).toBeUndefined();
      expect(domCheck.checkboxCount).toBeGreaterThan(0);
      expect(domCheck.radioCount).toBeGreaterThan(0);

      await openMenuPathTo(page, '[role="menuitemcheckbox"]');
      const checkbox = page.locator('[role="menuitemcheckbox"]').first();
      const checkboxPopoverId = await checkbox.evaluate(el => el.closest('[popover]')?.id);
      expect(checkboxPopoverId).toBeTruthy();
      const checkboxPopover = page.locator(`#${checkboxPopoverId}`);
      expect(await isPopoverOpen(page, checkboxPopover)).toBe(true);

      await checkbox.focus();
      const initialChecked = (await checkbox.getAttribute('aria-checked')) === 'true';

      await page.keyboard.press('Space');
      await page.waitForTimeout(100);
      const checkedAfterSpace = (await checkbox.getAttribute('aria-checked')) === 'true';
      expect(checkedAfterSpace).toBe(!initialChecked);
      expect(await isPopoverOpen(page, checkboxPopover)).toBe(true);

      await page.keyboard.press('Enter');
      await page.waitForTimeout(350);
      const checkedAfterEnter = (await checkbox.getAttribute('aria-checked')) === 'true';
      expect(checkedAfterEnter).toBe(initialChecked);
      expect(await isPopoverOpen(page, checkboxPopover)).toBe(false);

      await openMenuPathTo(page, '[role="menuitemradio"]');
      const radio = page.locator('[role="menuitemradio"]').first();
      const radioPopoverId = await radio.evaluate(el => el.closest('[popover]')?.id);
      expect(radioPopoverId).toBeTruthy();
      const radioPopover = page.locator(`#${radioPopoverId}`);
      expect(await isPopoverOpen(page, radioPopover)).toBe(true);

      await radio.focus();
      await page.keyboard.press('Space');
      await page.waitForTimeout(350);
      expect(await isPopoverOpen(page, radioPopover)).toBe(false);
    });

    test('Each popover is the immediate next sibling of its trigger, submenus are popover="auto" placed after trigger inside parent focusgroup without aria-details, and closed submenus are not inline', async ({ page }) => {
      const result = await page.evaluate(() => {
        const popovers = Array.from(document.querySelectorAll<HTMLElement>('[popover]'));
        if (popovers.length === 0) return { error: 'no popovers found', count: 0 };
        for (const popover of popovers) {
          const trigger = document.querySelector<HTMLElement>(`[commandfor="${popover.id}"]`);
          if (!trigger) {
            return { error: `no trigger found for popover #${popover.id}`, count: popovers.length };
          }
          if (trigger.nextElementSibling !== popover) {
            return { error: `popover #${popover.id} is not the immediate next sibling of its trigger`, count: popovers.length };
          }
          if (trigger.hasAttribute('aria-details')) {
            return { error: `trigger for #${popover.id} exposes aria-details relation`, count: popovers.length };
          }
          const parentMenu = trigger.closest('[focusgroup]');
          if (parentMenu) {
            if (popover.getAttribute('popover') !== 'auto') {
              return { error: `submenu popover #${popover.id} does not have popover="auto"`, count: popovers.length };
            }
            if (popover.parentElement !== parentMenu && !parentMenu.contains(popover)) {
              return { error: `submenu popover #${popover.id} is not placed inside parent focusgroup`, count: popovers.length };
            }
            const display = window.getComputedStyle(popover).display;
            if (display !== 'none') {
              return { error: `closed submenu #${popover.id} has computed display "${display}" instead of "none"`, count: popovers.length };
            }
          }
        }
        return { ok: true, count: popovers.length };
      });

      expect(result.count).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
      expect(result.ok).toBe(true);
    });

    test('Focusing a submenu trigger previews its submenu and sets aria-expanded="true" without moving focus into the submenu, and moving focus to a sibling item closes that submenu and sets aria-expanded="false"', async ({ page }) => {
      const rootTrigger = await getTopLevelTrigger(page);
      expect(await rootTrigger.count()).toBeGreaterThan(0);
      await rootTrigger.click();
      await page.waitForTimeout(100);

      const subTrigger = await getSubmenuTrigger(page);
      expect(await subTrigger.count()).toBeGreaterThan(0);

      const subId = await subTrigger.getAttribute('commandfor');
      const subMenu = page.locator(`#${subId}`);

      await subTrigger.focus();
      await page.waitForTimeout(200);

      expect(await isPopoverOpen(page, subMenu)).toBe(true);
      expect(await subTrigger.getAttribute('aria-expanded')).toBe('true');

      const isTriggerFocused = await subTrigger.evaluate((el: HTMLElement) => document.activeElement === el);
      expect(isTriggerFocused).toBe(true);

      const siblingItem = await getSiblingItem(page, subTrigger);
      expect(await siblingItem.count()).toBeGreaterThan(0);
      await siblingItem.focus();
      await page.waitForTimeout(200);

      expect(await isPopoverOpen(page, subMenu)).toBe(false);
      expect(await subTrigger.getAttribute('aria-expanded')).toBe('false');
    });

    test('Pressing Enter or Space on a previewed submenu trigger closes that preview and sets aria-expanded="false" without moving focus from the trigger', async ({ page }) => {
      const rootTrigger = await getTopLevelTrigger(page);
      expect(await rootTrigger.count()).toBeGreaterThan(0);
      await rootTrigger.click();
      await page.waitForTimeout(100);

      const subTrigger = await getSubmenuTrigger(page);
      expect(await subTrigger.count()).toBeGreaterThan(0);

      await subTrigger.focus();
      await page.waitForTimeout(200);

      const subId = await subTrigger.getAttribute('commandfor');
      const subMenu = page.locator(`#${subId}`);
      expect(await isPopoverOpen(page, subMenu)).toBe(true);
      expect(await subTrigger.getAttribute('aria-expanded')).toBe('true');

      await page.keyboard.press('Enter');
      await page.waitForTimeout(150);

      expect(await isPopoverOpen(page, subMenu)).toBe(false);
      expect(await subTrigger.getAttribute('aria-expanded')).toBe('false');

      const isTriggerStillFocused = await subTrigger.evaluate((el: HTMLElement) => document.activeElement === el);
      expect(isTriggerStillFocused).toBe(true);
    });

    test('Pressing Enter or Space on a closed trigger opens its menu, sets aria-expanded="true", and moves focus to the first enabled item', async ({ page }) => {
      const rootTrigger = await getTopLevelTrigger(page);
      expect(await rootTrigger.count()).toBeGreaterThan(0);

      const menuId = await rootTrigger.getAttribute('commandfor');
      const rootMenu = page.locator(`#${menuId}`);
      expect(await isPopoverOpen(page, rootMenu)).toBe(false);

      await rootTrigger.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);

      expect(await isPopoverOpen(page, rootMenu)).toBe(true);
      expect(await rootTrigger.getAttribute('aria-expanded')).toBe('true');

      const firstItem = rootMenu.locator('button, a').first();
      expect(await firstItem.count()).toBeGreaterThan(0);
      const isFirstFocused = await firstItem.evaluate((el: HTMLElement) => document.activeElement === el);
      expect(isFirstFocused).toBe(true);
    });

    test('Pressing ArrowDown on a top-level trigger opens its menu if closed and moves focus to the first enabled item, including when opened by pointer and focus is on trigger', async ({ page }) => {
      const rootTrigger = await getTopLevelTrigger(page);
      expect(await rootTrigger.count()).toBeGreaterThan(0);

      const menuId = await rootTrigger.getAttribute('commandfor');
      const rootMenu = page.locator(`#${menuId}`);

      await rootTrigger.focus();
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);

      expect(await isPopoverOpen(page, rootMenu)).toBe(true);
      const firstItem = rootMenu.locator('button, a').first();
      expect(await firstItem.count()).toBeGreaterThan(0);
      const isFirstFocused1 = await firstItem.evaluate((el: HTMLElement) => document.activeElement === el);
      expect(isFirstFocused1).toBe(true);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      expect(await isPopoverOpen(page, rootMenu)).toBe(false);

      await rootTrigger.click();
      await page.waitForTimeout(100);
      expect(await isPopoverOpen(page, rootMenu)).toBe(true);

      const isTriggerFocused = await rootTrigger.evaluate((el: HTMLElement) => document.activeElement === el);
      expect(isTriggerFocused).toBe(true);

      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);

      const isFirstFocused2 = await firstItem.evaluate((el: HTMLElement) => document.activeElement === el);
      expect(isFirstFocused2).toBe(true);
    });

    test('Inside an open menu, ArrowUp and ArrowDown move focus between enabled items, and Home and End move focus to first and last enabled item', async ({ page }) => {
      const rootTrigger = await getTopLevelTrigger(page);
      expect(await rootTrigger.count()).toBeGreaterThan(0);
      await rootTrigger.click();
      await page.waitForTimeout(100);

      const menuId = await rootTrigger.getAttribute('commandfor');
      const rootMenu = page.locator(`#${menuId}`);
      expect(await isPopoverOpen(page, rootMenu)).toBe(true);

      const group = rootMenu.locator('[focusgroup]').first();
      const items = group.locator('> button, > a, > [role="group"] > button');
      const count = await items.count();
      expect(count).toBeGreaterThan(1);

      await items.first().focus();
      await page.waitForTimeout(50);
      expect(await items.first().evaluate((el: HTMLElement) => document.activeElement === el)).toBe(true);

      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(50);
      expect(await items.nth(1).evaluate((el: HTMLElement) => document.activeElement === el)).toBe(true);

      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(50);
      expect(await items.first().evaluate((el: HTMLElement) => document.activeElement === el)).toBe(true);

      await page.keyboard.press('End');
      await page.waitForTimeout(50);
      expect(await items.last().evaluate((el: HTMLElement) => document.activeElement === el)).toBe(true);

      await page.keyboard.press('Home');
      await page.waitForTimeout(50);
      expect(await items.first().evaluate((el: HTMLElement) => document.activeElement === el)).toBe(true);
    });

    test('Pressing ArrowRight on a submenu trigger opens the submenu and moves focus to its first enabled item, while pressing ArrowLeft in a submenu closes only that submenu and restores focus to its parent trigger', async ({ page }) => {
      const rootTrigger = await getTopLevelTrigger(page);
      expect(await rootTrigger.count()).toBeGreaterThan(0);
      await rootTrigger.click();
      await page.waitForTimeout(100);

      const subTrigger = await getSubmenuTrigger(page);
      expect(await subTrigger.count()).toBeGreaterThan(0);

      const subId = await subTrigger.getAttribute('commandfor');
      const subMenu = page.locator(`#${subId}`);

      await subTrigger.focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(150);

      expect(await isPopoverOpen(page, subMenu)).toBe(true);
      const firstSubItem = subMenu.locator('button, a').first();
      expect(await firstSubItem.count()).toBeGreaterThan(0);

      const isFirstFocused = await firstSubItem.evaluate((el: HTMLElement) => document.activeElement === el);
      expect(isFirstFocused).toBe(true);

      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(150);

      expect(await isPopoverOpen(page, subMenu)).toBe(false);

      const topMenuId = await rootTrigger.getAttribute('commandfor');
      expect(await isPopoverOpen(page, page.locator(`#${topMenuId}`))).toBe(true);

      const isSubTriggerFocused = await subTrigger.evaluate((el: HTMLElement) => document.activeElement === el);
      expect(isSubTriggerFocused).toBe(true);
    });

    test('Pressing Escape closes only current menu level, sets trigger aria-expanded to "false", and restores focus to the trigger that opened it, including for nested submenus', async ({ page }) => {
      const rootTrigger = await getTopLevelTrigger(page);
      expect(await rootTrigger.count()).toBeGreaterThan(0);
      await rootTrigger.click();
      await page.waitForTimeout(100);

      const rootMenuId = await rootTrigger.getAttribute('commandfor');
      const rootMenu = page.locator(`#${rootMenuId}`);
      expect(await isPopoverOpen(page, rootMenu)).toBe(true);

      const subTrigger1 = await getSubmenuTrigger(page);
      expect(await subTrigger1.count()).toBeGreaterThan(0);
      await subTrigger1.click();
      await page.waitForTimeout(100);

      const subId1 = await subTrigger1.getAttribute('commandfor');
      const subMenu1 = page.locator(`#${subId1}`);
      expect(await isPopoverOpen(page, subMenu1)).toBe(true);

      const subTrigger2Id = await subMenu1.evaluate((el: HTMLElement) => {
        const btn = el.querySelector<HTMLElement>('[focusgroup] button[commandfor]');
        return btn ? btn.id || (btn.id = `_subtrig2_${Math.random().toString(36).slice(2)}`, btn.id) : null;
      });

      if (subTrigger2Id) {
        const subTrigger2 = page.locator(`#${subTrigger2Id}`);
        await subTrigger2.click();
        await page.waitForTimeout(100);

        const subId2 = await subTrigger2.getAttribute('commandfor');
        const subMenu2 = page.locator(`#${subId2}`);
        expect(await isPopoverOpen(page, subMenu2)).toBe(true);

        const subItem2 = subMenu2.locator('button, a').first();
        await subItem2.focus();
        await page.waitForTimeout(50);

        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);

        expect(await isPopoverOpen(page, subMenu2)).toBe(false);
        expect(await subTrigger2.getAttribute('aria-expanded')).toBe('false');
        expect(await isPopoverOpen(page, subMenu1)).toBe(true);
        const isSub2TriggerFocused = await subTrigger2.evaluate((el: HTMLElement) => document.activeElement === el);
        expect(isSub2TriggerFocused).toBe(true);
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);

      expect(await isPopoverOpen(page, subMenu1)).toBe(false);
      expect(await subTrigger1.getAttribute('aria-expanded')).toBe('false');
      expect(await isPopoverOpen(page, rootMenu)).toBe(true);
      const isSub1TriggerFocused = await subTrigger1.evaluate((el: HTMLElement) => document.activeElement === el);
      expect(isSub1TriggerFocused).toBe(true);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);

      expect(await isPopoverOpen(page, rootMenu)).toBe(false);
      expect(await rootTrigger.getAttribute('aria-expanded')).toBe('false');
      const isRootTriggerFocused = await rootTrigger.evaluate((el: HTMLElement) => document.activeElement === el);
      expect(isRootTriggerFocused).toBe(true);
    });

    test('Pressing Tab from a trigger or inside an open menu closes all open menus and leaves the menu system instead of stepping through every command', async ({ page }) => {
      const rootTrigger = await getTopLevelTrigger(page);
      expect(await rootTrigger.count()).toBeGreaterThan(0);

      await rootTrigger.focus();
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);

      const menuId = await rootTrigger.getAttribute('commandfor');
      const rootMenu = page.locator(`#${menuId}`);
      expect(await isPopoverOpen(page, rootMenu)).toBe(true);

      await page.keyboard.press('Tab');
      await page.waitForTimeout(150);

      const anyOpen = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('[popover]')).some(p => p.matches(':popover-open, .\\:popover-open'));
      });
      expect(anyOpen).toBe(false);

      const inPopover = await page.evaluate(() => {
        return Boolean(document.activeElement?.closest('[popover]'));
      });
      expect(inPopover).toBe(false);
    });

    test('Clicking a closed trigger opens its menu with focus left on the trigger (no item focused), clicking an open trigger closes its menu and leaves focus on the trigger, and clicking outside closes every open menu level', async ({ page }) => {
      const rootTrigger = await getTopLevelTrigger(page);
      expect(await rootTrigger.count()).toBeGreaterThan(0);

      const menuId = await rootTrigger.getAttribute('commandfor');
      const rootMenu = page.locator(`#${menuId}`);
      expect(await isPopoverOpen(page, rootMenu)).toBe(false);

      await rootTrigger.click();
      await page.waitForTimeout(100);

      expect(await isPopoverOpen(page, rootMenu)).toBe(true);
      const focusedOnTrigger1 = await rootTrigger.evaluate((el: HTMLElement) => document.activeElement === el);
      expect(focusedOnTrigger1).toBe(true);

      await rootTrigger.click();
      await page.waitForTimeout(100);

      expect(await isPopoverOpen(page, rootMenu)).toBe(false);
      const focusedOnTrigger2 = await rootTrigger.evaluate((el: HTMLElement) => document.activeElement === el);
      expect(focusedOnTrigger2).toBe(true);

      await rootTrigger.click();
      await page.waitForTimeout(100);
      expect(await isPopoverOpen(page, rootMenu)).toBe(true);

      const outside = page.locator('h1, h2, main, footer').first();
      await outside.click({ position: { x: 5, y: 5 } });
      await page.waitForTimeout(150);

      const anyOpen = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('[popover]')).some(p => p.matches(':popover-open, .\\:popover-open'));
      });
      expect(anyOpen).toBe(false);
    });

    test('Opening a menu by pointer keeps focus on its trigger with no item focused or matching :focus-visible; opening by keyboard focuses the first enabled item', async ({ page }) => {
      const rootTrigger = await getTopLevelTrigger(page);
      expect(await rootTrigger.count()).toBeGreaterThan(0);

      const menuId = await rootTrigger.getAttribute('commandfor');
      const rootMenu = page.locator(`#${menuId}`);

      await rootTrigger.click();
      await page.waitForTimeout(100);

      expect(await isPopoverOpen(page, rootMenu)).toBe(true);

      const pointerState = await rootTrigger.evaluate((el: HTMLElement) => {
        const isFocused = document.activeElement === el;
        const hasFocusVisible = el.matches(':focus-visible');
        const inMenu = Boolean(document.activeElement?.closest('[popover]'));
        return { isFocused, hasFocusVisible, inMenu };
      });

      expect(pointerState.isFocused).toBe(true);
      expect(pointerState.hasFocusVisible).toBe(false);
      expect(pointerState.inMenu).toBe(false);

      await rootTrigger.click();
      await page.waitForTimeout(100);

      await rootTrigger.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);

      expect(await isPopoverOpen(page, rootMenu)).toBe(true);

      const firstItem = rootMenu.locator('button, a').first();
      expect(await firstItem.count()).toBeGreaterThan(0);

      const isFirstFocused = await firstItem.evaluate((el: HTMLElement) => document.activeElement === el);
      expect(isFirstFocused).toBe(true);
    });

    test('Any open or close animation is under 150 ms, changes only opacity and a small translate, is off under prefers-reduced-motion: reduce, and never delays focus', async ({ page }) => {
      const rootTrigger = await getTopLevelTrigger(page);
      expect(await rootTrigger.count()).toBeGreaterThan(0);
      const menuId = await rootTrigger.getAttribute('commandfor');
      const rootMenu = page.locator(`#${menuId}`);

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(50);

      const reducedDuration = await rootMenu.evaluate((el: HTMLElement) => {
        const style = window.getComputedStyle(el);
        const parseTime = (val: string) => {
          const times = val.split(',').map(s => s.trim());
          return Math.max(...times.map(t => {
            if (t.endsWith('ms')) return parseFloat(t);
            if (t.endsWith('s')) return parseFloat(t) * 1000;
            return 0;
          }));
        };
        const tDur = parseTime(style.transitionDuration || '0s');
        const aDur = parseTime(style.animationDuration || '0s');
        return Math.max(tDur, aDur);
      });
      expect(reducedDuration).toBe(0);

      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForTimeout(50);

      const noPrefAnim = await rootMenu.evaluate((el: HTMLElement) => {
        const style = window.getComputedStyle(el);
        const parseTime = (val: string) => {
          const times = val.split(',').map(s => s.trim());
          return Math.max(...times.map(t => {
            if (t.endsWith('ms')) return parseFloat(t);
            if (t.endsWith('s')) return parseFloat(t) * 1000;
            return 0;
          }));
        };
        const tDur = parseTime(style.transitionDuration || '0s');
        const aDur = parseTime(style.animationDuration || '0s');
        const maxDur = Math.max(tDur, aDur);
        const tProp = style.transitionProperty || '';
        return { maxDur, tProp };
      });

      expect(noPrefAnim.maxDur).toBeLessThanOrEqual(150);

      await rootTrigger.focus();
      const startTime = Date.now();
      await page.keyboard.press('ArrowDown');

      const firstItem = rootMenu.locator('button, a').first();
      await expect(firstItem).toBeFocused({ timeout: 200 });
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(250);
    });

    test('Moving the pointer over a menu item focuses that item without a visible focus ring, so at most one item is styled as active at a time', async ({ page }) => {
      const rootTrigger = await getTopLevelTrigger(page);
      expect(await rootTrigger.count()).toBeGreaterThan(0);
      await rootTrigger.click();
      await page.waitForTimeout(100);

      const menuId = await rootTrigger.getAttribute('commandfor');
      const rootMenu = page.locator(`#${menuId}`);
      const items = rootMenu.locator('[focusgroup] > button, [focusgroup] > a, [focusgroup] > [role="group"] > button');
      expect(await items.count()).toBeGreaterThan(1);

      const item1 = items.nth(1);
      await item1.hover();
      await page.waitForTimeout(100);

      const state = await item1.evaluate((el: HTMLElement) => {
        return {
          isFocused: document.activeElement === el,
          hasFocusVisible: el.matches(':focus-visible'),
        };
      });

      expect(state.isFocused).toBe(true);
      expect(state.hasFocusVisible).toBe(false);

      const activeCount = await rootMenu.evaluate((el: HTMLElement) => {
        const list = Array.from(el.querySelectorAll('button, a'));
        return list.filter(item => item === document.activeElement).length;
      });
      expect(activeCount).toBeLessThanOrEqual(1);
    });

    test('Moving the pointer over a submenu trigger previews its submenu after a short delay, and moving to a sibling item closes that submenu', async ({ page }) => {
      const rootTrigger = await getTopLevelTrigger(page);
      expect(await rootTrigger.count()).toBeGreaterThan(0);
      await rootTrigger.click();
      await page.waitForTimeout(100);

      const subTrigger = await getSubmenuTrigger(page);
      expect(await subTrigger.count()).toBeGreaterThan(0);

      const subId = await subTrigger.getAttribute('commandfor');
      const subMenu = page.locator(`#${subId}`);
      expect(await isPopoverOpen(page, subMenu)).toBe(false);

      await subTrigger.hover();
      await page.waitForTimeout(200);

      expect(await isPopoverOpen(page, subMenu)).toBe(true);

      const siblingItem = await getSiblingItem(page, subTrigger);
      expect(await siblingItem.count()).toBeGreaterThan(0);
      await siblingItem.hover();
      await page.waitForTimeout(200);

      expect(await isPopoverOpen(page, subMenu)).toBe(false);
    });

    test('A diagonal move from the middle of a submenu trigger to any item in its submenu keeps the submenu open (a safe triangle), while moving to a sibling item outside that path closes it', async ({ page }) => {
      const rootTrigger = await getTopLevelTrigger(page);
      expect(await rootTrigger.count()).toBeGreaterThan(0);
      await rootTrigger.click();
      await page.waitForTimeout(100);

      const subTrigger = await getSubmenuTrigger(page);
      expect(await subTrigger.count()).toBeGreaterThan(0);

      await subTrigger.hover();
      await page.waitForTimeout(200);

      const subId = await subTrigger.getAttribute('commandfor');
      expect(subId).toBeTruthy();
      const subMenu = page.locator(`#${subId}`);
      expect(await isPopoverOpen(page, subMenu)).toBe(true);

      const subItem = subMenu.locator('button, a').first();
      expect(await subItem.count()).toBeGreaterThan(0);

      const triggerBox = await subTrigger.boundingBox();
      const itemBox = await subItem.boundingBox();
      expect(triggerBox).not.toBeNull();
      expect(itemBox).not.toBeNull();

      await page.mouse.move(triggerBox!.x + triggerBox!.width / 2, triggerBox!.y + triggerBox!.height / 2);
      await page.mouse.move(itemBox!.x + itemBox!.width / 2, itemBox!.y + itemBox!.height / 2, { steps: 5 });
      await page.waitForTimeout(100);

      expect(await isPopoverOpen(page, subMenu)).toBe(true);

      const siblingItem = await getSiblingItem(page, subTrigger);
      expect(await siblingItem.count()).toBeGreaterThan(0);
      const siblingBox = await siblingItem.boundingBox();
      expect(siblingBox).not.toBeNull();

      await page.mouse.move(siblingBox!.x + siblingBox!.width / 2, siblingBox!.y + siblingBox!.height / 2);
      await page.waitForTimeout(300);

      expect(await isPopoverOpen(page, subMenu)).toBe(false);
    });

    test('Activating a command item closes all open menu levels, restores focus to the root menu trigger, and never leaves focus inside hidden content', async ({ page }) => {
      const rootTrigger = await getTopLevelTrigger(page);
      expect(await rootTrigger.count()).toBeGreaterThan(0);
      await rootTrigger.click();
      await page.waitForTimeout(100);

      const menuId = await rootTrigger.getAttribute('commandfor');
      const rootMenu = page.locator(`#${menuId}`);
      expect(await isPopoverOpen(page, rootMenu)).toBe(true);

      const subTrigger = await getSubmenuTrigger(page);
      expect(await subTrigger.count()).toBeGreaterThan(0);
      await subTrigger.click();
      await page.waitForTimeout(100);

      const subId = await subTrigger.getAttribute('commandfor');
      const subMenu = page.locator(`#${subId}`);
      expect(await isPopoverOpen(page, subMenu)).toBe(true);

      const commandItem = subMenu.locator('button:not([role="menuitemcheckbox"]):not([role="menuitemradio"]):not([commandfor])').first();
      expect(await commandItem.count()).toBeGreaterThan(0);

      await commandItem.click();
      await page.waitForTimeout(200);

      expect(await isPopoverOpen(page, subMenu)).toBe(false);
      expect(await isPopoverOpen(page, rootMenu)).toBe(false);

      const rootFocused = await rootTrigger.evaluate((el: HTMLElement) => document.activeElement === el);
      expect(rootFocused).toBe(true);

      const insideHidden = await page.evaluate(() => {
        const active = document.activeElement;
        if (!active) return false;
        const pop = active.closest('[popover]');
        return Boolean(pop && !pop.matches(':popover-open, .\\:popover-open'));
      });
      expect(insideHidden).toBe(false);
    });

    test('A submenu trigger only opens its submenu and never also runs a command; a default action is the first submenu item or a separate command item', async ({ page }) => {
      const rootTrigger = await getTopLevelTrigger(page);
      expect(await rootTrigger.count()).toBeGreaterThan(0);
      await rootTrigger.click();
      await page.waitForTimeout(100);

      const subTrigger = await getSubmenuTrigger(page);
      expect(await subTrigger.count()).toBeGreaterThan(0);

      const subId = await subTrigger.getAttribute('commandfor');
      expect(subId).toBeTruthy();
      const subMenu = page.locator(`#${subId}`);

      const actionAttr = await subTrigger.getAttribute('data-action');
      expect(actionAttr).toBeNull();

      await subTrigger.click();
      await page.waitForTimeout(100);

      expect(await isPopoverOpen(page, subMenu)).toBe(true);
      const topMenuId = await rootTrigger.getAttribute('commandfor');
      expect(await isPopoverOpen(page, page.locator(`#${topMenuId}`))).toBe(true);

      const firstSubItem = subMenu.locator('button, a').first();
      expect(await firstSubItem.count()).toBeGreaterThan(0);
      const firstId = await firstSubItem.getAttribute('id');
      const triggerId = await subTrigger.getAttribute('id');
      expect(firstId).not.toBe(triggerId);
    });

    test('Checked items render a visible check mark in the leading slot (::before content is not empty); unchecked items do not', async ({ page }) => {
      await openMenuPathTo(page, '[role="menuitemcheckbox"], [role="menuitemradio"]');

      const checkables = page.locator('[role="menuitemcheckbox"], [role="menuitemradio"]');
      expect(await checkables.count()).toBeGreaterThan(0);

      const result = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"], [role="menuitemradio"]'));
        if (all.length === 0) return { error: 'no checkable items found', count: 0 };

        const checked = all.find(el => el.getAttribute('aria-checked') === 'true');
        const unchecked = all.find(el => el.getAttribute('aria-checked') === 'false');

        if (!checked || !unchecked) {
          return { error: 'both checked and unchecked items must exist', count: all.length };
        }

        const checkedContent = window.getComputedStyle(checked, '::before').content;
        const uncheckedContent = window.getComputedStyle(unchecked, '::before').content;

        return {
          ok: true,
          count: all.length,
          checkedContent,
          uncheckedContent,
        };
      });

      expect(result.count).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
      expect(result.ok).toBe(true);

      expect(result.uncheckedContent).toMatch(/^(""|none|normal)?$/);
      expect(result.checkedContent).not.toBe('none');
      expect(result.checkedContent).not.toBe('""');
      expect(result.checkedContent).not.toBe('');
    });

    test('At a 375 px viewport, an open submenu sits directly below its trigger item and its box does not intersect the trigger box', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const rootTrigger = await getTopLevelTrigger(page);
      expect(await rootTrigger.count()).toBeGreaterThan(0);
      await rootTrigger.click();
      await page.waitForTimeout(100);

      const subTrigger = await getSubmenuTrigger(page);
      expect(await subTrigger.count()).toBeGreaterThan(0);

      await subTrigger.click();
      await page.waitForTimeout(150);

      const subId = await subTrigger.getAttribute('commandfor');
      const subMenu = page.locator(`#${subId}`);
      expect(await isPopoverOpen(page, subMenu)).toBe(true);

      const triggerBox = await subTrigger.boundingBox();
      const subBox = await subMenu.boundingBox();
      expect(triggerBox).not.toBeNull();
      expect(subBox).not.toBeNull();

      expect(subBox!.y).toBeGreaterThanOrEqual(triggerBox!.y + triggerBox!.height - 2);

      const intersects = !(
        triggerBox!.x + triggerBox!.width <= subBox!.x ||
        subBox!.x + subBox!.width <= triggerBox!.x ||
        triggerBox!.y + triggerBox!.height <= subBox!.y ||
        subBox!.y + subBox!.height <= triggerBox!.y
      );
      expect(intersects).toBe(false);
    });

    test('After a pointer activation of a command, focus returns to the root trigger without :focus-visible', async ({ page }) => {
      const rootTrigger = await getTopLevelTrigger(page);
      expect(await rootTrigger.count()).toBeGreaterThan(0);
      await rootTrigger.click();
      await page.waitForTimeout(100);

      const menuId = await rootTrigger.getAttribute('commandfor');
      const rootMenu = page.locator(`#${menuId}`);
      expect(await isPopoverOpen(page, rootMenu)).toBe(true);

      const commandItem = rootMenu.locator('button:not([role="menuitemcheckbox"]):not([role="menuitemradio"]):not([commandfor])').first();
      expect(await commandItem.count()).toBeGreaterThan(0);

      await commandItem.click();
      await page.waitForTimeout(200);

      expect(await isPopoverOpen(page, rootMenu)).toBe(false);

      const state = await rootTrigger.evaluate((el: HTMLElement) => {
        return {
          isFocused: document.activeElement === el,
          hasVisibleFocus: el.matches(':focus-visible'),
        };
      });

      expect(state.isFocused).toBe(true);
      expect(state.hasVisibleFocus).toBe(false);
    });

  });
});
