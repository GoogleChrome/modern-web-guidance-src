import {
  test,
  expect,
  expectNever,
  getTargetFiles,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSStyleRule,
  CSSPositionTryRule,
} from 'cssomnom';
import type { Page } from '@playwright/test';

// @ts-ignore - import.meta.url is supported at runtime by Playwright's ESM loader
const targetFiles: string[] = getTargetFiles(import.meta.url);

interface MenuDiscovery {
  isMenubar: boolean;
  topTriggerIds: string[];
  triggerToMenuId: Record<string, string>;
  submenuTriggerId: string;
  submenuLeafId: string;
  checkboxTriggerId: string;
  checkboxMenuId: string;
  radioTriggerId: string;
  radioMenuId: string;
  commandTriggerId: string;
  commandMenuId: string;
}

interface MenuGraderHelpers {
  resolveMenu: (btn: Element | null) => HTMLElement | null;
  getGroup: (menu: HTMLElement) => HTMLElement;
  getOwnItems: (menu: HTMLElement) => HTMLElement[];
  isMenuTrigger: (el: Element) => boolean;
  isMenuOpen: (menu: HTMLElement | null) => boolean;
  getOpenMenus: () => HTMLElement[];
  getParentMenu: (el: Element | null) => HTMLElement | null;
  openMenu: (menu: HTMLElement, trigger?: HTMLElement | null) => void;
  closeMenu: (menu: HTMLElement, trigger?: HTMLElement | null) => void;
  settle: () => Promise<void>;
}

declare global {
  interface Window {
    __menuGrader?: MenuGraderHelpers;
  }
}

async function installMenuHelpers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const isMenuTrigger = (el: Element): boolean =>
      el.matches(
        'button[commandfor], button[popovertarget], button[aria-haspopup="menu"], button[aria-haspopup="true"], [role="menuitem"][aria-haspopup]'
      );

    const resolveMenu = (btn: Element | null): HTMLElement | null => {
      if (!btn) return null;
      for (const attr of ['commandfor', 'popovertarget', 'aria-controls']) {
        const id = btn.getAttribute(attr);
        if (id) {
          const target = document.getElementById(id);
          if (target) return target;
        }
      }
      if (btn.id) {
        const labelled = Array.from(document.querySelectorAll<HTMLElement>('[role="menu"], [popover]')).find(
          (el) => el !== btn && (el.getAttribute('aria-labelledby') || '').split(/\s+/).includes(btn.id)
        );
        if (labelled) return labelled;
      }
      const next = btn.nextElementSibling as HTMLElement | null;
      if (
        next &&
        (next.matches('[popover], [role="menu"]') || Boolean(next.querySelector(':scope > [focusgroup~="menu"]')))
      ) {
        return next;
      }
      return null;
    };

    const getGroup = (menu: HTMLElement): HTMLElement =>
      menu.querySelector<HTMLElement>('[focusgroup~="menu"]') ||
      (menu.matches('[role="menu"]') ? menu : menu.querySelector<HTMLElement>('[role="menu"]')) ||
      menu;

    const getOwnItems = (menu: HTMLElement): HTMLElement[] => {
      const group = getGroup(menu);
      return Array.from(
        group.querySelectorAll<HTMLElement>(
          'button, a[href], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'
        )
      ).filter((el) => el.closest('[focusgroup], [role="menu"]') === group);
    };

    const isMenuOpen = (menu: HTMLElement | null): boolean => {
      if (!menu) return false;
      if (menu.hasAttribute('popover')) return menu.matches(':popover-open');
      if (menu.hasAttribute('hidden') || menu.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(menu);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.pointerEvents === 'none' ||
        (style.opacity === '0' && style.animationName === 'none')
      ) {
        return false;
      }
      const rect = menu.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const getOpenMenus = (): HTMLElement[] =>
      Array.from(document.querySelectorAll<HTMLElement>('[popover], [role="menu"]')).filter((el) => {
        if (el.hasAttribute('popover')) return el.matches(':popover-open');
        if (el.closest('[popover]')) return false;
        return isMenuOpen(el);
      });

    const getParentMenu = (el: Element | null): HTMLElement | null => {
      if (!el) return null;
      return el.closest<HTMLElement>('[popover]') || el.closest<HTMLElement>('[role="menu"]');
    };

    const openMenu = (menu: HTMLElement, trigger?: HTMLElement | null): void => {
      if (menu.hasAttribute('popover')) {
        if (!menu.matches(':popover-open')) {
          try {
            (menu as HTMLElement & { showPopover: (opts?: { source?: HTMLElement }) => void }).showPopover(
              trigger ? { source: trigger } : undefined
            );
          } catch {
            menu.showPopover();
          }
        }
        return;
      }
      if (!isMenuOpen(menu) && trigger) {
        trigger.click();
      }
    };

    const closeMenu = (menu: HTMLElement, trigger?: HTMLElement | null): void => {
      if (menu.hasAttribute('popover')) {
        if (menu.matches(':popover-open')) menu.hidePopover();
        return;
      }
      if (isMenuOpen(menu) && trigger) {
        trigger.click();
      }
    };

    window.__menuGrader = {
      resolveMenu,
      getGroup,
      getOwnItems,
      isMenuTrigger,
      isMenuOpen,
      getOpenMenus,
      getParentMenu,
      openMenu,
      closeMenu,
      settle: () =>
        new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30)))),
    };
  });
}

async function discoverMenus(page: Page): Promise<MenuDiscovery> {
  return await page.evaluate(() => {
    const h = window.__menuGrader!;
    const allTriggers = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button[commandfor], button[popovertarget], button[aria-haspopup="menu"], button[aria-haspopup="true"], [role="menuitem"][aria-haspopup]'
      )
    ).filter((btn) => Boolean(h.resolveMenu(btn)));

    allTriggers.forEach((btn, idx) => {
      if (!btn.id) btn.id = `grader-trigger-${idx}`;
    });

    const triggerToMenuId: Record<string, string> = {};
    allTriggers.forEach((btn, idx) => {
      const menu = h.resolveMenu(btn);
      if (menu) {
        if (!menu.id) menu.id = `grader-menu-${idx}`;
        triggerToMenuId[btn.id] = menu.id;
      }
    });

    const topTriggers = allTriggers.filter((btn) => !h.getParentMenu(btn));
    const subTriggers = allTriggers.filter((btn) => Boolean(h.getParentMenu(btn)));

    const menubar = document.querySelector('[role="menubar"]');
    const isMenubar = Boolean(menubar);
    const barTopTriggers = isMenubar
      ? topTriggers.filter((btn) => menubar!.contains(btn))
      : topTriggers;

    const topTriggerIds = (barTopTriggers.length > 0 ? barTopTriggers : topTriggers).map((b) => b.id);

    const subWithLeaf =
      subTriggers.find((subBtn) => {
        const subMenu = h.resolveMenu(subBtn);
        if (!subMenu) return false;
        const own = h.getOwnItems(subMenu);
        return (
          own.length > 0 &&
          !h.isMenuTrigger(own[0]) &&
          own.some((item) => !h.isMenuTrigger(item))
        );
      }) ||
      subTriggers.find((subBtn) => {
        const subMenu = h.resolveMenu(subBtn);
        if (!subMenu) return false;
        return h.getOwnItems(subMenu).some((item) => !h.isMenuTrigger(item));
      }) ||
      subTriggers[0];

    let submenuLeafId = '';
    if (subWithLeaf) {
      const subMenu = h.resolveMenu(subWithLeaf);
      const leaf = subMenu ? h.getOwnItems(subMenu).find((item) => !h.isMenuTrigger(item)) : null;
      if (leaf) {
        if (!leaf.id) leaf.id = 'grader-sub-leaf';
        submenuLeafId = leaf.id;
      }
    }

    let checkboxTriggerId = '';
    let checkboxMenuId = '';
    let radioTriggerId = '';
    let radioMenuId = '';
    let commandTriggerId = '';
    let commandMenuId = '';

    for (const btn of allTriggers) {
      const menu = h.resolveMenu(btn);
      if (!menu) continue;
      const group = h.getGroup(menu);

      const ownCheckbox = Array.from(group.querySelectorAll('[role="menuitemcheckbox"]')).find(
        (el) => el.closest('[focusgroup], [role="menu"]') === group
      );
      if (ownCheckbox && !checkboxTriggerId) {
        checkboxTriggerId = btn.id;
        checkboxMenuId = menu.id;
      }

      const ownRadio = Array.from(group.querySelectorAll('[role="menuitemradio"]')).find(
        (el) => el.closest('[focusgroup], [role="menu"]') === group
      );
      if (ownRadio && !radioTriggerId) {
        radioTriggerId = btn.id;
        radioMenuId = menu.id;
      }

      const ownCmd = h.getOwnItems(menu).find(
        (el) =>
          !el.matches('a[href]') &&
          !h.isMenuTrigger(el) &&
          el.getAttribute('role') !== 'menuitemcheckbox' &&
          el.getAttribute('role') !== 'menuitemradio'
      );
      if (ownCmd && !commandTriggerId && !h.getParentMenu(btn)) {
        commandTriggerId = btn.id;
        commandMenuId = menu.id;
      }
    }

    if (!commandTriggerId && topTriggers[0]) {
      commandTriggerId = topTriggers[0].id;
      commandMenuId = triggerToMenuId[topTriggers[0].id] || '';
    }

    return {
      isMenubar,
      topTriggerIds,
      triggerToMenuId,
      submenuTriggerId: subWithLeaf?.id || '',
      submenuLeafId,
      checkboxTriggerId,
      checkboxMenuId,
      radioTriggerId,
      radioMenuId,
      commandTriggerId,
      commandMenuId,
    };
  });
}

async function openParentChainForTrigger(page: Page, triggerId: string): Promise<void> {
  await page.evaluate(async (id) => {
    const h = window.__menuGrader!;
    const btn = document.getElementById(id);
    if (!btn) return;
    const ancestorMenus: HTMLElement[] = [];
    let current = h.getParentMenu(btn);
    while (current) {
      ancestorMenus.unshift(current);
      current = h.getParentMenu(current.parentElement);
    }
    const allTriggers = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button[commandfor], button[popovertarget], button[aria-haspopup="menu"], button[aria-haspopup="true"], [role="menuitem"][aria-haspopup]'
      )
    );
    for (const m of ancestorMenus) {
      const t = allTriggers.find((cand) => h.resolveMenu(cand) === m) || null;
      h.openMenu(m, t);
      const anims = m.getAnimations({ subtree: true }).filter((anim) => {
        const dur = anim.effect?.getComputedTiming().duration;
        return typeof dur === 'number' && Number.isFinite(dur);
      });
      await Promise.allSettled(anims.map((anim) => anim.finished));
      await h.settle();
    }
  }, triggerId);
}

test.describe('menu Target Grader', () => {
  // --- STATIC ASSERTIONS ---

  test('Menus are anchored to their triggers via CSS Anchor Positioning (using the invoker or showPopover({ source: trigger }) without per-menu CSS anchor rules), positioning top-level menus below their trigger and submenus beside their trigger on wide viewports, and falling back to directly below the submenu trigger, indented, when neither side fits so a submenu never covers its own trigger', () => {
    const styleRules = getRules(targetFiles, CSSStyleRule);

    const hasTopLevelPositionArea = styleRules.some((r) =>
      r.style.getPropertyValue('position-area').includes('block-end')
    );
    const hasSubmenuPositionArea = styleRules.some(
      (r) =>
        r.style.getPropertyValue('position-area').includes('inline-end') &&
        /--[a-zA-Z0-9_-]+/.test(r.style.getPropertyValue('position-try-fallbacks'))
    );
    const hasPositionTryRule = getRules(targetFiles, CSSPositionTryRule).some((r) =>
      r.name.startsWith('--')
    );

    expect(hasTopLevelPositionArea && hasSubmenuPositionArea && hasPositionTryRule).toBe(true);
  });

  test('Menu items align their content across rows with a fixed-size leading icon or check slot and trailing content at the inline end, without subgrid', () => {
    const styleRules = getRules(targetFiles, CSSStyleRule);

    const hasBaseLeadingSlot = styleRules.some(
      (r) =>
        r.selectorText.includes('::before') &&
        !r.selectorText.includes('aria-checked') &&
        Boolean(r.style.getPropertyValue('inline-size') || r.style.getPropertyValue('width'))
    );
    const hasTrailingEndAlignment = styleRules.some(
      (r) =>
        r.style.getPropertyValue('margin-inline-start').trim() === 'auto' ||
        r.style.getPropertyValue('margin-left').trim() === 'auto'
    );
    const usesSubgrid = styleRules.some(
      (r) =>
        r.style.getPropertyValue('grid-template-columns').includes('subgrid') ||
        r.style.getPropertyValue('grid-template-rows').includes('subgrid')
    );

    expect(hasBaseLeadingSlot && hasTrailingEndAlignment && !usesSubgrid).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await installMenuHelpers(page);
      await page.goto(TARGET_URL);
    });

    test('Each menu list has focusgroup="menu nomemory" on an element inside its popover (not on the popover element), exposes role="menu" labeled by its trigger via aria-labelledby, and exposes role="menuitem" on its command buttons', async ({
      page,
      TARGET_URL,
    }) => {
      const structureValid = await page.evaluate(() => {
        const popovers = Array.from(document.querySelectorAll<HTMLElement>('[popover]'));
        if (popovers.length < 2) return false;
        return popovers.every((pop) => {
          if (pop.hasAttribute('focusgroup')) return false;
          const fg = pop.querySelector<HTMLElement>(':scope > [focusgroup]');
          if (!fg) return false;
          const tokens = (fg.getAttribute('focusgroup') || '').trim().split(/\s+/);
          if (!tokens.includes('menu') || !tokens.includes('nomemory')) return false;
          const labelId = fg.getAttribute('aria-labelledby');
          if (!labelId) return false;
          const trigger = document.getElementById(labelId);
          return Boolean(trigger && trigger.getAttribute('commandfor') === pop.id);
        });
      });
      expect(structureValid).toBe(true);

      await page.addInitScript(() => {
        try {
          delete (HTMLElement.prototype as unknown as Record<string, unknown>).focusGroup;
        } catch {
          // ignore
        }
      });
      await page.goto(TARGET_URL);

      const fallbackRolesValid = await page.evaluate(() => {
        const groups = Array.from(document.querySelectorAll<HTMLElement>('[focusgroup~="menu"]'));
        if (groups.length === 0) return false;
        let totalCommandItems = 0;
        const groupsValid = groups.every((g) => {
          if (g.getAttribute('role') !== 'menu') return false;
          const items = Array.from(g.querySelectorAll<HTMLElement>('button'))
            .filter((b) => b.closest('[focusgroup]') === g)
            .filter((b) => {
              const r = b.getAttribute('role');
              return r !== 'menuitemcheckbox' && r !== 'menuitemradio';
            });
          totalCommandItems += items.length;
          return items.every((b) => b.getAttribute('role') === 'menuitem');
        });
        return groupsValid && totalCommandItems > 0;
      });
      expect(fallbackRolesValid).toBe(true);
    });

    test('Separators between item groups are <hr> elements, and checkable items are <button type="button"> elements with an explicit role="menuitemcheckbox" or role="menuitemradio" (radios wrapped in a named role="group") and aria-checked; Space on a checkbox item toggles it and keeps the menu open, Enter toggles it and closes the menu, and radio items close on either key', async ({
      page,
    }) => {
      const markupValid = await page.evaluate(() => {
        const containers = Array.from(document.querySelectorAll('[focusgroup~="menu"], [role="menu"]'));
        if (containers.length === 0) return false;
        const fakeSeparators = Array.from(
          document.querySelectorAll(
            ':is([focusgroup~="menu"], [role="menu"]) :is([role="separator"]:not(hr), .separator:not(hr), .divider:not(hr))'
          )
        );
        const checkboxes = Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            ':is([focusgroup~="menu"], [role="menu"]) [role="menuitemcheckbox"]'
          )
        );
        const radios = Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            ':is([focusgroup~="menu"], [role="menu"]) [role="menuitemradio"]'
          )
        );
        if (fakeSeparators.length > 0 || checkboxes.length === 0 || radios.length === 0) return false;

        const checkboxesValid = checkboxes.every(
          (cb) =>
            cb.tagName === 'BUTTON' &&
            cb.type === 'button' &&
            (cb.getAttribute('aria-checked') === 'true' || cb.getAttribute('aria-checked') === 'false')
        );
        const radiosValid = radios.every((r) => {
          const group = r.closest('[role="group"]');
          return (
            r.tagName === 'BUTTON' &&
            r.type === 'button' &&
            (r.getAttribute('aria-checked') === 'true' || r.getAttribute('aria-checked') === 'false') &&
            Boolean(group && (group.getAttribute('aria-label') || group.getAttribute('aria-labelledby')))
          );
        });
        return checkboxesValid && radiosValid;
      });
      expect(markupValid).toBe(true);

      const info = await discoverMenus(page);
      expect(info.checkboxTriggerId).not.toBe('');
      expect(info.checkboxMenuId).not.toBe('');
      await openParentChainForTrigger(page, info.checkboxTriggerId);

      const initialChecked = await page.evaluate(
        async ({ trigId, menuId }) => {
          const h = window.__menuGrader!;
          const trig = document.getElementById(trigId)!;
          const menu = document.getElementById(menuId)!;
          h.openMenu(menu, trig);
          await h.settle();
          const cb = menu.querySelector<HTMLButtonElement>('[role="menuitemcheckbox"]');
          if (!cb) return null;
          if (!cb.id) cb.id = 'grader-cb-item';
          cb.focus();
          return cb.getAttribute('aria-checked');
        },
        { trigId: info.checkboxTriggerId, menuId: info.checkboxMenuId }
      );
      expect(initialChecked).not.toBeNull();

      await page.keyboard.press(' ');

      await expect
        .poll(() =>
          page.evaluate(
            ({ menuId, init }) => {
              const h = window.__menuGrader!;
              const menu = document.getElementById(menuId)!;
              const cb = document.getElementById('grader-cb-item');
              return Boolean(cb && cb.getAttribute('aria-checked') !== init && h.isMenuOpen(menu));
            },
            { menuId: info.checkboxMenuId, init: initialChecked }
          )
        )
        .toBe(true);

      await page.keyboard.press('Enter');

      await expect
        .poll(() =>
          page.evaluate(
            ({ menuId, init }) => {
              const h = window.__menuGrader!;
              const menu = document.getElementById(menuId)!;
              const cb = document.getElementById('grader-cb-item');
              return Boolean(cb && cb.getAttribute('aria-checked') === init && !h.isMenuOpen(menu));
            },
            { menuId: info.checkboxMenuId, init: initialChecked }
          )
        )
        .toBe(true);

      expect(info.radioTriggerId).not.toBe('');
      expect(info.radioMenuId).not.toBe('');
      await openParentChainForTrigger(page, info.radioTriggerId);
      const radioPrepared = await page.evaluate(
        async ({ trigId, menuId }) => {
          const h = window.__menuGrader!;
          const trig = document.getElementById(trigId)!;
          const menu = document.getElementById(menuId)!;
          h.openMenu(menu, trig);
          await h.settle();
          const uncheckedRadio =
            menu.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="false"]') ||
            menu.querySelector<HTMLButtonElement>('[role="menuitemradio"]');
          if (!uncheckedRadio) return false;
          uncheckedRadio.id = 'grader-radio-target';
          uncheckedRadio.focus();
          return true;
        },
        { trigId: info.radioTriggerId, menuId: info.radioMenuId }
      );
      expect(radioPrepared).toBe(true);

      await page.keyboard.press('Enter');

      await expect
        .poll(() =>
          page.evaluate(() => {
            const h = window.__menuGrader!;
            const target = document.getElementById('grader-radio-target');
            const group = target?.closest('[role="group"], [focusgroup~="menu"], [role="menu"]');
            if (!target || !group) return false;
            const checkedInGroup = group.querySelectorAll('[role="menuitemradio"][aria-checked="true"]');
            const openMenus = h.getOpenMenus();
            return (
              target.getAttribute('aria-checked') === 'true' &&
              checkedInGroup.length === 1 &&
              openMenus.length === 0
            );
          })
        )
        .toBe(true);
    });

    test('The top-level triggers are either inside a container with role="menubar" that is styled as one continuous bar and acts as a single Tab stop, or are separate Tab stops with no role="menubar", no arrow-key movement between them, and no preview or hover switching; the role, keyboard model, and styling never disagree', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.topTriggerIds.length).toBeGreaterThan(0);
      const valid = await page.evaluate(
        ({ isMenubar, topTriggerIds }) => {
          if (topTriggerIds.length === 0) return false;
          const triggers = topTriggerIds.map((id) => document.getElementById(id)!);
          if (isMenubar) {
            const bar = document.querySelector<HTMLElement>('[role="menubar"]');
            if (!bar || bar.hasAttribute('popover')) return false;
            const style = window.getComputedStyle(bar);
            const gap = parseFloat(style.columnGap || style.gap || '0') || 0;
            const tabStops = triggers.filter((t) => t.tabIndex === 0);
            return gap === 0 && tabStops.length === 1;
          } else {
            return triggers.every((t) => !t.closest('[role="menubar"]') && t.tabIndex === 0);
          }
        },
        { isMenubar: info.isMenubar, topTriggerIds: info.topTriggerIds }
      );
      expect(valid).toBe(true);

      if (!info.isMenubar) {
        const firstId = info.topTriggerIds[0];
        await page.evaluate((id) => {
          document.getElementById(id)?.focus();
        }, firstId);
        await expectNever(
          page,
          (id) => {
            const h = window.__menuGrader!;
            const trig = document.getElementById(id);
            const menu = h.resolveMenu(trig);
            return !menu || h.isMenuOpen(menu) || trig?.getAttribute('aria-expanded') === 'true';
          },
          { forMs: 200, arg: firstId }
        );
      }
    });

    test('Each trigger is a <button type="button"> with aria-haspopup="menu", commandfor, and command="toggle-popover", and has no popovertarget or popovertargetaction attribute', async ({
      page,
    }) => {
      const valid = await page.evaluate(() => {
        const triggers = Array.from(document.querySelectorAll<HTMLButtonElement>('button[commandfor]'));
        if (triggers.length < 2) return false;
        return triggers.every(
          (btn) =>
            btn.tagName === 'BUTTON' &&
            btn.type === 'button' &&
            btn.getAttribute('aria-haspopup') === 'menu' &&
            btn.getAttribute('command') === 'toggle-popover' &&
            !btn.hasAttribute('popovertarget') &&
            !btn.hasAttribute('popovertargetaction')
        );
      });
      expect(valid).toBe(true);
    });

    test('Each popover is the immediate next sibling of its trigger (and each submenu is a popover="auto" placed after its trigger inside the parent menu\'s focusgroup), so no aria-details relation is exposed on the trigger and closed submenus are not rendered inline', async ({
      page,
    }) => {
      const valid = await page.evaluate(() => {
        const triggers = Array.from(document.querySelectorAll<HTMLButtonElement>('button[commandfor]'));
        if (triggers.length < 2) return false;
        const subTriggers = triggers.filter((t) => Boolean(t.closest('[popover]')));
        if (subTriggers.length === 0) return false;

        return triggers.every((btn) => {
          const menuId = btn.getAttribute('commandfor');
          const menu = btn.nextElementSibling as HTMLElement | null;
          if (!menu || menu.id !== menuId || menu.getAttribute('popover') !== 'auto') return false;
          if (btn.hasAttribute('aria-details')) return false;
          if (btn.closest('[popover]')) {
            if (!btn.closest('[focusgroup]')) return false;
            if (window.getComputedStyle(menu).display !== 'none') return false;
          }
          return true;
        });
      });
      expect(valid).toBe(true);
    });

    test('Focusing a submenu trigger (or a top-level trigger in a menubar) previews its menu and sets aria-expanded="true" without moving focus into the menu, and blurring a trigger that is only previewing closes that menu and sets aria-expanded="false"', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.submenuTriggerId).not.toBe('');
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.evaluate((subTriggerId) => {
        document.getElementById(subTriggerId)?.focus();
      }, info.submenuTriggerId);

      await expect
        .poll(() =>
          page.evaluate((subTriggerId) => {
            const h = window.__menuGrader!;
            const subTrigger = document.getElementById(subTriggerId) as HTMLButtonElement | null;
            if (!subTrigger) return false;
            const subMenu = h.resolveMenu(subTrigger);
            if (!subMenu) return false;
            return (
              h.isMenuOpen(subMenu) &&
              subTrigger.getAttribute('aria-expanded') === 'true' &&
              document.activeElement === subTrigger
            );
          }, info.submenuTriggerId)
        )
        .toBe(true);

      await page.evaluate((subTriggerId) => {
        const h = window.__menuGrader!;
        const subTrigger = document.getElementById(subTriggerId) as HTMLButtonElement | null;
        if (!subTrigger) return;
        const parentMenu = h.getParentMenu(subTrigger);
        const siblingItem = parentMenu
          ? h.getOwnItems(parentMenu).find((el) => el !== subTrigger)
          : null;
        if (siblingItem) {
          siblingItem.focus();
        } else {
          subTrigger.blur();
        }
      }, info.submenuTriggerId);

      await expect
        .poll(() =>
          page.evaluate((subTriggerId) => {
            const h = window.__menuGrader!;
            const subTrigger = document.getElementById(subTriggerId) as HTMLButtonElement | null;
            if (!subTrigger) return false;
            const subMenu = h.resolveMenu(subTrigger);
            if (!subMenu) return false;
            return !h.isMenuOpen(subMenu) && subTrigger.getAttribute('aria-expanded') === 'false';
          }, info.submenuTriggerId)
        )
        .toBe(true);
    });

    test('Focus returning to a trigger because the window regained focus does not preview or reopen its menu', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.submenuTriggerId).not.toBe('');
      await openParentChainForTrigger(page, info.submenuTriggerId);
      const firstTopId = info.submenuTriggerId;

      await page.evaluate(async (triggerId) => {
        const h = window.__menuGrader!;
        const trigger = document.getElementById(triggerId) as HTMLButtonElement | null;
        if (!trigger) return;
        const menu = h.resolveMenu(trigger);
        if (!menu) return;

        trigger.focus();
        h.closeMenu(menu, trigger);
        window.dispatchEvent(new Event('blur'));
        trigger.blur();
        window.dispatchEvent(new Event('focus'));
        trigger.focus();
        await h.settle();
      }, firstTopId);

      await expectNever(
        page,
        (triggerId) => {
          const h = window.__menuGrader!;
          const trigger = document.getElementById(triggerId);
          if (!trigger) return true;
          const menu = h.resolveMenu(trigger);
          return !menu || h.isMenuOpen(menu) || trigger.getAttribute('aria-expanded') !== 'false';
        },
        { forMs: 200, arg: firstTopId }
      );
    });

    test('Pressing Enter or Space on a previewed top-level or submenu trigger closes that preview and sets aria-expanded="false" without moving focus from the trigger', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.submenuTriggerId).not.toBe('');
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.evaluate(async (subTriggerId) => {
        const h = window.__menuGrader!;
        const subTrigger = document.getElementById(subTriggerId) as HTMLButtonElement;
        const subMenu = h.resolveMenu(subTrigger);
        if (!subMenu) return;
        h.openMenu(subMenu, subTrigger);
        await h.settle();
        subTrigger.focus();
      }, info.submenuTriggerId);

      await page.keyboard.press('Enter');

      await expect
        .poll(() =>
          page.evaluate((subTriggerId) => {
            const h = window.__menuGrader!;
            const subTrigger = document.getElementById(subTriggerId)!;
            const subMenu = h.resolveMenu(subTrigger);
            return (
              Boolean(subMenu) &&
              !h.isMenuOpen(subMenu) &&
              subTrigger.getAttribute('aria-expanded') === 'false' &&
              document.activeElement === subTrigger
            );
          }, info.submenuTriggerId)
        )
        .toBe(true);
    });

    test('Pressing Enter or Space on a closed trigger opens its menu, sets aria-expanded="true", and moves focus to the first enabled item', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.topTriggerIds.length).toBeGreaterThan(0);
      const triggerId = info.topTriggerIds[0];

      for (const key of ['Enter', ' '] as const) {
        await page.evaluate(async (id) => {
          const h = window.__menuGrader!;
          const btn = document.getElementById(id)!;
          const menu = h.resolveMenu(btn);
          btn.focus();
          if (menu) h.closeMenu(menu, btn);
          await h.settle();
        }, triggerId);

        await page.keyboard.press(key);

        await expect
          .poll(() =>
            page.evaluate((id) => {
              const h = window.__menuGrader!;
              const btn = document.getElementById(id)!;
              const menu = h.resolveMenu(btn);
              if (!menu) return false;
              const items = h.getOwnItems(menu).filter((el) => !(el as HTMLButtonElement).disabled);
              return (
                h.isMenuOpen(menu) &&
                btn.getAttribute('aria-expanded') === 'true' &&
                items.length > 0 &&
                document.activeElement === items[0]
              );
            }, triggerId)
          )
          .toBe(true);
      }
    });

    test('Pressing ArrowDown on a previewed top-level trigger converts it to open and moves focus to the first enabled item in the same turn', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.topTriggerIds.length).toBeGreaterThan(0);
      const triggerId = info.topTriggerIds[0];

      await page.evaluate(async (id) => {
        const h = window.__menuGrader!;
        const btn = document.getElementById(id)!;
        const menu = h.resolveMenu(btn);
        if (!menu) return;
        h.openMenu(menu, btn);
        await h.settle();
        btn.focus();
      }, triggerId);

      await page.keyboard.press('ArrowDown');

      await expect
        .poll(() =>
          page.evaluate((id) => {
            const h = window.__menuGrader!;
            const btn = document.getElementById(id)!;
            const menu = h.resolveMenu(btn);
            if (!menu) return false;
            const items = h.getOwnItems(menu).filter((el) => !(el as HTMLButtonElement).disabled);
            return h.isMenuOpen(menu) && items.length > 0 && document.activeElement === items[0];
          }, triggerId)
        )
        .toBe(true);
    });

    test('Inside an open menu, ArrowUp and ArrowDown move focus between enabled items, and Home and End move focus to the first and last enabled item; on a top-level trigger, Home and End enter its menu at the first or last enabled item', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.topTriggerIds.length).toBeGreaterThan(0);
      const triggerId = info.topTriggerIds[0];

      await page.evaluate(async (id) => {
        const h = window.__menuGrader!;
        const btn = document.getElementById(id)!;
        const menu = h.resolveMenu(btn);
        btn.focus();
        if (menu) h.closeMenu(menu, btn);
        await h.settle();
      }, triggerId);

      await page.keyboard.press('ArrowDown');
      await expect
        .poll(() =>
          page.evaluate((id) => {
            const h = window.__menuGrader!;
            const menu = h.resolveMenu(document.getElementById(id));
            if (!menu) return false;
            const items = h.getOwnItems(menu).filter((el) => !(el as HTMLButtonElement).disabled);
            return h.isMenuOpen(menu) && items.length > 0 && document.activeElement === items[0];
          }, triggerId)
        )
        .toBe(true);

      await page.keyboard.press('ArrowDown');
      await expect
        .poll(() =>
          page.evaluate((id) => {
            const h = window.__menuGrader!;
            const menu = h.resolveMenu(document.getElementById(id));
            if (!menu) return false;
            const items = h.getOwnItems(menu).filter((el) => !(el as HTMLButtonElement).disabled);
            return items.length > 1 && document.activeElement === items[1];
          }, triggerId)
        )
        .toBe(true);

      await page.keyboard.press('ArrowUp');
      await expect
        .poll(() =>
          page.evaluate((id) => {
            const h = window.__menuGrader!;
            const menu = h.resolveMenu(document.getElementById(id));
            if (!menu) return false;
            const items = h.getOwnItems(menu).filter((el) => !(el as HTMLButtonElement).disabled);
            return items.length > 0 && document.activeElement === items[0];
          }, triggerId)
        )
        .toBe(true);

      await page.keyboard.press('End');
      await expect
        .poll(() =>
          page.evaluate((id) => {
            const h = window.__menuGrader!;
            const menu = h.resolveMenu(document.getElementById(id));
            if (!menu) return false;
            const items = h.getOwnItems(menu).filter((el) => !(el as HTMLButtonElement).disabled);
            return items.length > 0 && document.activeElement === items[items.length - 1];
          }, triggerId)
        )
        .toBe(true);

      await page.keyboard.press('Home');
      await expect
        .poll(() =>
          page.evaluate((id) => {
            const h = window.__menuGrader!;
            const menu = h.resolveMenu(document.getElementById(id));
            if (!menu) return false;
            const items = h.getOwnItems(menu).filter((el) => !(el as HTMLButtonElement).disabled);
            return items.length > 0 && document.activeElement === items[0];
          }, triggerId)
        )
        .toBe(true);
    });

    test('Pressing ArrowRight on a submenu trigger opens the submenu and moves focus to its first enabled item, while pressing ArrowLeft in a submenu closes only that submenu and restores focus to its parent trigger', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.submenuTriggerId).not.toBe('');
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.evaluate(async (subId) => {
        const h = window.__menuGrader!;
        const subBtn = document.getElementById(subId)!;
        const subMenu = h.resolveMenu(subBtn);
        if (subMenu) h.closeMenu(subMenu, subBtn);
        subBtn.focus();
        await h.settle();
      }, info.submenuTriggerId);

      await page.keyboard.press('ArrowRight');

      await expect
        .poll(() =>
          page.evaluate((subId) => {
            const h = window.__menuGrader!;
            const subBtn = document.getElementById(subId)!;
            const subMenu = h.resolveMenu(subBtn);
            if (!subMenu) return false;
            const items = h.getOwnItems(subMenu).filter((el) => !(el as HTMLButtonElement).disabled);
            return h.isMenuOpen(subMenu) && items.length > 0 && document.activeElement === items[0];
          }, info.submenuTriggerId)
        )
        .toBe(true);

      await page.keyboard.press('ArrowLeft');

      await expect
        .poll(() =>
          page.evaluate((subId) => {
            const h = window.__menuGrader!;
            const subBtn = document.getElementById(subId)!;
            const subMenu = h.resolveMenu(subBtn);
            const parentMenu = h.getParentMenu(subBtn);
            return (
              Boolean(subMenu) &&
              !h.isMenuOpen(subMenu) &&
              h.isMenuOpen(parentMenu) &&
              document.activeElement === subBtn
            );
          }, info.submenuTriggerId)
        )
        .toBe(true);
    });

    test('Pressing ArrowRight on a submenu item without a child submenu closes the open hierarchy and previews the next top-level menu with focus on its trigger in a menubar, or keeps focus inside the submenu without switching top-level menus for separate menu buttons', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.submenuTriggerId).not.toBe('');
      expect(info.submenuLeafId).not.toBe('');
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.evaluate(
        async ({ subId, leafId }) => {
          const h = window.__menuGrader!;
          const subBtn = document.getElementById(subId)!;
          const subMenu = h.resolveMenu(subBtn);
          if (!subMenu) return;
          h.openMenu(subMenu, subBtn);
          await h.settle();
          const leaf = document.getElementById(leafId)!;
          leaf.focus();
        },
        { subId: info.submenuTriggerId, leafId: info.submenuLeafId }
      );

      await page.keyboard.press('ArrowRight');

      await expect
        .poll(() =>
          page.evaluate(
            ({ isMenubar, topTriggerIds, subId }) => {
              const h = window.__menuGrader!;
              const subBtn = document.getElementById(subId)!;
              const subMenu = h.resolveMenu(subBtn);
              if (!subMenu) return false;
              if (isMenubar && topTriggerIds.length > 1) {
                return (
                  !h.isMenuOpen(subMenu) &&
                  topTriggerIds.some((id) => document.activeElement === document.getElementById(id))
                );
              } else {
                return h.isMenuOpen(subMenu) && subMenu.contains(document.activeElement);
              }
            },
            { isMenubar: info.isMenubar, topTriggerIds: info.topTriggerIds, subId: info.submenuTriggerId }
          )
        )
        .toBe(true);
    });

    test('From a focused top-level trigger, ArrowRight and ArrowLeft move focus to the next and previous top-level trigger (wrapping at either end) and preview its menu with focus staying on the trigger in a menubar, or leave focus on the current trigger for separate menu buttons', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.topTriggerIds.length).toBeGreaterThan(0);
      const firstId = info.topTriggerIds[0];

      await page.evaluate((id) => {
        document.getElementById(id)!.focus();
      }, firstId);

      await page.keyboard.press('ArrowRight');

      await expect
        .poll(() =>
          page.evaluate(
            ({ isMenubar, topTriggerIds }) => {
              const h = window.__menuGrader!;
              const firstTrigger = document.getElementById(topTriggerIds[0])!;
              if (isMenubar && topTriggerIds.length > 1) {
                const secondTrigger = document.getElementById(topTriggerIds[1])!;
                const secondMenu = h.resolveMenu(secondTrigger);
                return document.activeElement === secondTrigger && h.isMenuOpen(secondMenu);
              } else {
                return document.activeElement === firstTrigger;
              }
            },
            { isMenubar: info.isMenubar, topTriggerIds: info.topTriggerIds }
          )
        )
        .toBe(true);

      await page.keyboard.press('ArrowLeft');

      await expect
        .poll(() =>
          page.evaluate(
            ({ isMenubar, topTriggerIds }) => {
              const h = window.__menuGrader!;
              const firstTrigger = document.getElementById(topTriggerIds[0])!;
              const firstMenu = h.resolveMenu(firstTrigger);
              if (isMenubar && topTriggerIds.length > 1) {
                return document.activeElement === firstTrigger && h.isMenuOpen(firstMenu);
              } else {
                return document.activeElement === firstTrigger;
              }
            },
            { isMenubar: info.isMenubar, topTriggerIds: info.topTriggerIds }
          )
        )
        .toBe(true);
    });

    test('From inside an open top-level menu, ArrowRight and ArrowLeft close the current menu and preview the next or previous top-level menu (wrapping at either end) with focus on its trigger and no item focused in a menubar (ArrowDown then enters it), or do not switch top-level menus for separate menu buttons', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.topTriggerIds.length).toBeGreaterThan(0);
      const firstId = info.topTriggerIds[0];

      await page.evaluate(async (id) => {
        const h = window.__menuGrader!;
        const btn = document.getElementById(id)!;
        const menu = h.resolveMenu(btn);
        if (!menu) return;
        h.openMenu(menu, btn);
        await h.settle();
        const nonSubItem = h.getOwnItems(menu).find((el) => !h.isMenuTrigger(el));
        if (nonSubItem) nonSubItem.focus();
      }, firstId);

      await page.keyboard.press('ArrowRight');

      await expect
        .poll(() =>
          page.evaluate(
            ({ isMenubar, topTriggerIds }) => {
              const h = window.__menuGrader!;
              const firstTrigger = document.getElementById(topTriggerIds[0])!;
              const firstMenu = h.resolveMenu(firstTrigger);
              if (isMenubar && topTriggerIds.length > 1) {
                const secondTrigger = document.getElementById(topTriggerIds[1])!;
                const secondMenu = h.resolveMenu(secondTrigger);
                return (
                  !h.isMenuOpen(firstMenu) &&
                  h.isMenuOpen(secondMenu) &&
                  document.activeElement === secondTrigger
                );
              } else {
                return h.isMenuOpen(firstMenu);
              }
            },
            { isMenubar: info.isMenubar, topTriggerIds: info.topTriggerIds }
          )
        )
        .toBe(true);
    });

    test('Pressing Escape closes only the current menu level, sets its trigger\'s aria-expanded to "false", and restores focus to the trigger that opened it, including for nested submenus', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.submenuTriggerId).not.toBe('');
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.evaluate(async (subId) => {
        const h = window.__menuGrader!;
        const subBtn = document.getElementById(subId)!;
        const subMenu = h.resolveMenu(subBtn);
        if (subMenu) h.closeMenu(subMenu, subBtn);
        subBtn.focus();
        await h.settle();
      }, info.submenuTriggerId);

      await page.keyboard.press('ArrowRight');
      await expect
        .poll(() =>
          page.evaluate((subId) => {
            const h = window.__menuGrader!;
            const subBtn = document.getElementById(subId)!;
            const subMenu = h.resolveMenu(subBtn);
            return Boolean(subMenu && h.isMenuOpen(subMenu) && subMenu.contains(document.activeElement));
          }, info.submenuTriggerId)
        )
        .toBe(true);

      await page.keyboard.press('Escape');

      await expect
        .poll(() =>
          page.evaluate((subId) => {
            const h = window.__menuGrader!;
            const subBtn = document.getElementById(subId)!;
            const subMenu = h.resolveMenu(subBtn);
            const parentMenu = h.getParentMenu(subBtn);
            return (
              Boolean(subMenu) &&
              !h.isMenuOpen(subMenu) &&
              subBtn.getAttribute('aria-expanded') === 'false' &&
              h.isMenuOpen(parentMenu) &&
              document.activeElement === subBtn
            );
          }, info.submenuTriggerId)
        )
        .toBe(true);
    });

    test('Pressing Tab from a trigger or inside an open menu closes all open menus and leaves the menu system instead of stepping through every command', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.submenuTriggerId).not.toBe('');
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.evaluate(async (subId) => {
        const h = window.__menuGrader!;
        const subBtn = document.getElementById(subId)!;
        subBtn.focus();
        await h.settle();
      }, info.submenuTriggerId);

      await page.keyboard.press('ArrowRight');
      await expect
        .poll(() =>
          page.evaluate((subId) => {
            const h = window.__menuGrader!;
            const subBtn = document.getElementById(subId)!;
            const subMenu = h.resolveMenu(subBtn);
            return Boolean(subMenu && h.isMenuOpen(subMenu) && subMenu.contains(document.activeElement));
          }, info.submenuTriggerId)
        )
        .toBe(true);

      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
        const stillInside = await page.evaluate(async () => {
          const h = window.__menuGrader!;
          await h.settle();
          return Boolean(h.getParentMenu(document.activeElement));
        });
        if (!stillInside) break;
      }

      await expect
        .poll(() =>
          page.evaluate(() => {
            const h = window.__menuGrader!;
            const openMenus = h.getOpenMenus();
            const activeInMenu = h.getParentMenu(document.activeElement);
            return openMenus.length === 0 && !activeInMenu;
          })
        )
        .toBe(true);
    });

    test('Clicking a closed trigger opens its menu with focus left on the trigger (no item focused), clicking an open or previewed trigger closes its menu and leaves focus on the trigger, and clicking outside closes every open menu level', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.topTriggerIds.length).toBeGreaterThan(0);
      const triggerId = info.topTriggerIds[0];

      await page.locator(`#${triggerId}`).click();

      await expect
        .poll(() =>
          page.evaluate((id) => {
            const h = window.__menuGrader!;
            const btn = document.getElementById(id)!;
            const menu = h.resolveMenu(btn);
            return (
              Boolean(menu) &&
              h.isMenuOpen(menu) &&
              document.activeElement === btn &&
              !menu!.contains(document.activeElement)
            );
          }, triggerId)
        )
        .toBe(true);

      await page.locator(`#${triggerId}`).click();

      await expect
        .poll(() =>
          page.evaluate((id) => {
            const h = window.__menuGrader!;
            const btn = document.getElementById(id)!;
            const menu = h.resolveMenu(btn);
            return Boolean(menu) && !h.isMenuOpen(menu) && btn.getAttribute('aria-expanded') === 'false';
          }, triggerId)
        )
        .toBe(true);

      await page.locator(`#${triggerId}`).click();
      await expect
        .poll(() =>
          page.evaluate((id) => {
            const h = window.__menuGrader!;
            const menu = h.resolveMenu(document.getElementById(id));
            return Boolean(menu && h.isMenuOpen(menu));
          }, triggerId)
        )
        .toBe(true);

      await page.locator('body').click({ position: { x: 5, y: 5 } });

      await expect
        .poll(() =>
          page.evaluate(() => {
            return window.__menuGrader!.getOpenMenus().length === 0;
          })
        )
        .toBe(true);
    });

    test('Opening a menu by pointer keeps focus on its trigger with no item focused or matching :focus-visible; opening by keyboard focuses the first enabled item', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.topTriggerIds.length).toBeGreaterThan(0);
      const triggerId = info.topTriggerIds[0];

      await page.locator(`#${triggerId}`).click();

      await expect
        .poll(() =>
          page.evaluate((id) => {
            const h = window.__menuGrader!;
            const btn = document.getElementById(id)!;
            const menu = h.resolveMenu(btn);
            if (!menu) return false;
            const anyFocusVisibleInMenu = menu.querySelector(':focus-visible') !== null;
            return (
              h.isMenuOpen(menu) &&
              document.activeElement === btn &&
              !menu.contains(document.activeElement) &&
              !anyFocusVisibleInMenu
            );
          }, triggerId)
        )
        .toBe(true);

      await page.locator(`#${triggerId}`).click();
      await expect
        .poll(() =>
          page.evaluate((id) => {
            const h = window.__menuGrader!;
            const btn = document.getElementById(id)!;
            const menu = h.resolveMenu(btn);
            return Boolean(menu) && !h.isMenuOpen(menu) && btn.getAttribute('aria-expanded') === 'false';
          }, triggerId)
        )
        .toBe(true);

      await page.evaluate((id) => document.getElementById(id)!.focus(), triggerId);
      await page.keyboard.press('Enter');

      await expect
        .poll(() =>
          page.evaluate((id) => {
            const h = window.__menuGrader!;
            const btn = document.getElementById(id)!;
            const menu = h.resolveMenu(btn);
            if (!menu) return false;
            const items = h.getOwnItems(menu).filter((el) => !(el as HTMLButtonElement).disabled);
            return h.isMenuOpen(menu) && items.length > 0 && document.activeElement === items[0];
          }, triggerId)
        )
        .toBe(true);
    });

    test('Moving the pointer over a menu item focuses that item without a visible focus ring, so at most one item is styled as active at a time', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.topTriggerIds.length).toBeGreaterThan(0);
      const triggerId = info.topTriggerIds[0];

      await page.locator(`#${triggerId}`).click();

      const itemSelector = await page.evaluate((id) => {
        const h = window.__menuGrader!;
        const btn = document.getElementById(id)!;
        const menu = h.resolveMenu(btn);
        if (!menu) return '';
        const items = h.getOwnItems(menu);
        const target = items[0];
        if (!target) return '';
        if (!target.id) target.id = 'grader-hover-item';
        return `#${target.id}`;
      }, triggerId);
      expect(itemSelector).not.toBe('');

      await page.locator(itemSelector).hover();

      await expect
        .poll(() =>
          page.evaluate((sel) => {
            const item = document.querySelector<HTMLElement>(sel)!;
            return document.activeElement === item && !item.matches(':focus-visible');
          }, itemSelector)
        )
        .toBe(true);
    });

    test('With no menu open, hovering a top-level trigger does nothing; while a top-level menu is open, moving the pointer over a different top-level trigger closes the open menu and previews the hovered one with focus on that trigger in a menubar, or leaves the open menu unchanged for separate menu buttons', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.topTriggerIds.length).toBeGreaterThan(0);
      const firstId = info.topTriggerIds[0];

      await page.locator(`#${firstId}`).hover();
      await expect
        .poll(() => page.evaluate(() => window.__menuGrader!.getOpenMenus().length === 0))
        .toBe(true);

      if (info.topTriggerIds.length > 1) {
        const secondId = info.topTriggerIds[1];
        await page.locator(`#${firstId}`).click();
        await page.locator(`#${secondId}`).hover();
        await expect
          .poll(() =>
            page.evaluate(
              ({ isMenubar, fId, sId }) => {
                const h = window.__menuGrader!;
                const firstMenu = h.resolveMenu(document.getElementById(fId));
                const secondTrigger = document.getElementById(sId)!;
                const secondMenu = h.resolveMenu(secondTrigger);
                if (isMenubar) {
                  return (
                    !h.isMenuOpen(firstMenu) &&
                    h.isMenuOpen(secondMenu) &&
                    document.activeElement === secondTrigger
                  );
                } else {
                  return h.isMenuOpen(firstMenu) && !h.isMenuOpen(secondMenu);
                }
              },
              { isMenubar: info.isMenubar, fId: firstId, sId: secondId }
            )
          )
          .toBe(true);
      }
    });

    test('Moving the pointer over a submenu trigger previews its submenu after a short delay, and moving to a sibling item closes that submenu', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.submenuTriggerId).not.toBe('');
      await openParentChainForTrigger(page, info.submenuTriggerId);

      const triggerCenter = await page.evaluate((subId) => {
        const subBtn = document.getElementById(subId)!;
        const r = subBtn.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, info.submenuTriggerId);

      await page.mouse.move(triggerCenter.x, triggerCenter.y);

      // The submenu must not open synchronously on pointer entry; it opens only after a short delay.
      await expectNever(
        page,
        (subId) => {
          const h = window.__menuGrader!;
          const subBtn = document.getElementById(subId);
          const subMenu = subBtn ? h.resolveMenu(subBtn) : null;
          return h.isMenuOpen(subMenu);
        },
        { forMs: 40, arg: info.submenuTriggerId }
      );

      await expect
        .poll(() =>
          page.evaluate((subId) => {
            const h = window.__menuGrader!;
            const subBtn = document.getElementById(subId)!;
            const subMenu = h.resolveMenu(subBtn);
            return h.isMenuOpen(subMenu) && subBtn.getAttribute('aria-expanded') === 'true';
          }, info.submenuTriggerId)
        )
        .toBe(true);

      const siblingId = await page.evaluate((subId) => {
        const h = window.__menuGrader!;
        const subBtn = document.getElementById(subId)!;
        const parentMenu = h.getParentMenu(subBtn);
        const sib = parentMenu ? h.getOwnItems(parentMenu).find((el) => el !== subBtn) : null;
        if (sib && !sib.id) sib.id = 'grader-sib-item';
        return sib ? sib.id : '';
      }, info.submenuTriggerId);

      expect(Boolean(siblingId)).toBe(true);
      await page.locator(`#${siblingId}`).hover();
      await expect
        .poll(() =>
          page.evaluate((subId) => {
            const h = window.__menuGrader!;
            const subBtn = document.getElementById(subId)!;
            const subMenu = h.resolveMenu(subBtn);
            return Boolean(subMenu) && !h.isMenuOpen(subMenu);
          }, info.submenuTriggerId)
        )
        .toBe(true);
    });

    test('A diagonal move from the middle of a submenu trigger to any item in its submenu keeps the submenu open (a pointer-following safe triangle), while moving to a sibling item outside that path closes it', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.submenuTriggerId).not.toBe('');
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.locator(`#${info.submenuTriggerId}`).hover();

      await expect
        .poll(() =>
          page.evaluate((subId) => {
            const h = window.__menuGrader!;
            const subBtn = document.getElementById(subId)!;
            const subMenu = h.resolveMenu(subBtn);
            return h.isMenuOpen(subMenu);
          }, info.submenuTriggerId)
        )
        .toBe(true);

      const coords = await page.evaluate(
        ({ subId, leafId }) => {
          const h = window.__menuGrader!;
          const subBtn = document.getElementById(subId)!;
          const subMenu = h.resolveMenu(subBtn);
          if (!subMenu || !h.isMenuOpen(subMenu)) return null;
          const leaf = document.getElementById(leafId) || h.getOwnItems(subMenu)[0];
          if (!leaf) return null;
          const tRect = subBtn.getBoundingClientRect();
          const lRect = leaf.getBoundingClientRect();
          return {
            startX: tRect.left + tRect.width / 2,
            startY: tRect.top + tRect.height / 2,
            endX: lRect.left + lRect.width / 2,
            endY: lRect.top + lRect.height / 2,
          };
        },
        { subId: info.submenuTriggerId, leafId: info.submenuLeafId }
      );
      expect(coords).not.toBeNull();

      await page.mouse.move(coords!.startX, coords!.startY);
      await page.mouse.move(coords!.endX, coords!.endY, { steps: 5 });

      await expectNever(
        page,
        (subId) => {
          const h = window.__menuGrader!;
          const subBtn = document.getElementById(subId);
          const subMenu = subBtn ? h.resolveMenu(subBtn) : null;
          return !subMenu || !h.isMenuOpen(subMenu);
        },
        { forMs: 400, arg: info.submenuTriggerId }
      );
    });

    test('Activating a command item closes all open menu levels, restores focus to the root menu trigger, and never leaves focus inside hidden content', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.commandTriggerId).not.toBe('');
      expect(info.commandMenuId).not.toBe('');
      await openParentChainForTrigger(page, info.commandTriggerId);

      const focusedCmd = await page.evaluate(
        async ({ trigId, menuId }) => {
          const h = window.__menuGrader!;
          const trig = document.getElementById(trigId)!;
          const menu = document.getElementById(menuId)!;
          h.openMenu(menu, trig);
          await h.settle();
          const cmd = h.getOwnItems(menu).find(
            (b) =>
              !b.matches('a[href]') &&
              !h.isMenuTrigger(b) &&
              b.getAttribute('role') !== 'menuitemcheckbox' &&
              b.getAttribute('role') !== 'menuitemradio'
          );
          if (!cmd) return false;
          cmd.focus();
          return true;
        },
        { trigId: info.commandTriggerId, menuId: info.commandMenuId }
      );
      expect(focusedCmd).toBe(true);

      await page.keyboard.press('Enter');

      await expect
        .poll(() =>
          page.evaluate((trigId) => {
            const h = window.__menuGrader!;
            const trig = document.getElementById(trigId)!;
            const openMenus = h.getOpenMenus();
            const activeInMenu = h.getParentMenu(document.activeElement);
            return openMenus.length === 0 && document.activeElement === trig && !activeInMenu;
          }, info.commandTriggerId)
        )
        .toBe(true);
    });

    test('A submenu trigger only opens its submenu and never also runs a command; a default action is the first submenu item or a separate command item', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.submenuTriggerId).not.toBe('');
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.evaluate(async (subId) => {
        const h = window.__menuGrader!;
        const subBtn = document.getElementById(subId)!;
        const subMenu = h.resolveMenu(subBtn);
        subBtn.focus();
        if (subMenu) {
          h.openMenu(subMenu, subBtn);
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
          h.closeMenu(subMenu, subBtn);
        }
        await h.settle();
      }, info.submenuTriggerId);

      await page.keyboard.press('Enter');

      await expect
        .poll(() =>
          page.evaluate((subId) => {
            const h = window.__menuGrader!;
            const subBtn = document.getElementById(subId)!;
            const subMenu = h.resolveMenu(subBtn);
            const parentMenu = h.getParentMenu(subBtn);
            if (!subMenu || !parentMenu) return false;
            const ownActionItems = h.getOwnItems(subMenu).filter((el) => !h.isMenuTrigger(el));
            return h.isMenuOpen(parentMenu) && h.isMenuOpen(subMenu) && ownActionItems.length > 0;
          }, info.submenuTriggerId)
        )
        .toBe(true);
    });

    test('Checked items render a visible check mark in the leading slot (::before content is not empty); unchecked items don\'t', async ({
      page,
    }) => {
      const valid = await page.evaluate(() => {
        const checked = document.querySelector<HTMLElement>(
          ':is([focusgroup~="menu"], [role="menu"]) :is(button, [role="menuitemcheckbox"], [role="menuitemradio"])[aria-checked="true"]'
        );
        const unchecked = document.querySelector<HTMLElement>(
          ':is([focusgroup~="menu"], [role="menu"]) :is(button, [role="menuitemcheckbox"], [role="menuitemradio"])[aria-checked="false"]'
        );
        if (!checked || !unchecked) return false;
        const checkedContent = window
          .getComputedStyle(checked, '::before')
          .content.replace(/['"]/g, '')
          .trim();
        const uncheckedContent = window
          .getComputedStyle(unchecked, '::before')
          .content.replace(/['"]/g, '')
          .trim();
        return (
          checkedContent.length > 0 &&
          checkedContent !== 'none' &&
          (uncheckedContent === '' || uncheckedContent === 'none')
        );
      });

      expect(valid).toBe(true);
    });

    test('At a 375 px viewport, an open submenu sits directly below its trigger item and its box does not intersect the trigger\'s box', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      const info = await discoverMenus(page);
      expect(info.submenuTriggerId).not.toBe('');
      await openParentChainForTrigger(page, info.submenuTriggerId);

      const geometry = await page.evaluate(async (subId) => {
        const h = window.__menuGrader!;
        const subBtn = document.getElementById(subId)!;
        const subMenu = h.resolveMenu(subBtn);
        if (!subMenu) return { intersectsTrigger: true, sitsBelowTrigger: false };
        h.openMenu(subMenu, subBtn);
        await h.settle();
        const tRect = subBtn.getBoundingClientRect();
        const mRect = subMenu.getBoundingClientRect();
        const horizontallyOverlaps = mRect.left < tRect.right && mRect.right > tRect.left;
        const verticallyOverlaps = mRect.top < tRect.bottom - 1 && mRect.bottom > tRect.top + 1;
        const intersectsTrigger = horizontallyOverlaps && verticallyOverlaps;
        const sitsBelowTrigger = mRect.top >= tRect.bottom - 1;
        return { intersectsTrigger, sitsBelowTrigger };
      }, info.submenuTriggerId);

      expect(geometry.sitsBelowTrigger && !geometry.intersectsTrigger).toBe(true);
    });

    test('After a pointer activation of a command, focus returns to the root trigger without :focus-visible', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      expect(info.commandTriggerId).not.toBe('');
      expect(info.commandMenuId).not.toBe('');

      await page.locator(`#${info.commandTriggerId}`).scrollIntoViewIfNeeded();
      await page.locator(`#${info.commandTriggerId}`).click();
      await expect
        .poll(() =>
          page.evaluate((menuId) => {
            const h = window.__menuGrader!;
            const menu = document.getElementById(menuId);
            return h.isMenuOpen(menu);
          }, info.commandMenuId)
        )
        .toBe(true);

      const cmdSelector = await page.evaluate(
        ({ menuId }) => {
          const h = window.__menuGrader!;
          const menu = document.getElementById(menuId)!;
          const cmd = h.getOwnItems(menu).find(
            (b) =>
              !b.matches('a[href]') &&
              !h.isMenuTrigger(b) &&
              b.getAttribute('role') !== 'menuitemcheckbox' &&
              b.getAttribute('role') !== 'menuitemradio'
          );
          if (!cmd) return '';
          if (!cmd.id) cmd.id = 'grader-cmd-btn';
          return `#${cmd.id}`;
        },
        { menuId: info.commandMenuId }
      );
      expect(cmdSelector).not.toBe('');

      await page.locator(cmdSelector).click();

      await expect
        .poll(() =>
          page.evaluate((trigId) => {
            const h = window.__menuGrader!;
            const trig = document.getElementById(trigId)!;
            const openMenus = h.getOpenMenus();
            return (
              openMenus.length === 0 &&
              document.activeElement === trig &&
              !trig.matches(':focus-visible')
            );
          }, info.commandTriggerId)
        )
        .toBe(true);
    });
  });
});
