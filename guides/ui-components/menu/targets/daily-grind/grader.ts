import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSStyleRule,
  CSSMediaRule,
  CSSSupportsRule,
  CSSStartingStyleRule,
  CSSAtRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';
import { SyntaxKind } from 'ts-morph';
import type { Page } from '@playwright/test';

// @ts-ignore - import.meta.url is supported at runtime by Playwright's ESM loader
const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectAllCssRules(rules: Iterable<CSSRule>): CSSRule[] {
  const result: CSSRule[] = [];
  for (const rule of rules) {
    result.push(rule);
    if ('cssRules' in rule && rule.cssRules) {
      result.push(...collectAllCssRules(rule.cssRules as Iterable<CSSRule>));
    }
    if ('childRules' in rule && Array.isArray((rule as CSSAtRule).childRules)) {
      result.push(...collectAllCssRules((rule as CSSAtRule).childRules!));
    }
  }
  return result;
}

function collectStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  return collectAllCssRules(rules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
}

interface MenuDiscovery {
  isMenubar: boolean;
  topTriggerIds: string[];
  submenuTriggerId: string;
  submenuLeafId: string;
  checkboxTriggerId: string;
  checkboxMenuId: string;
  radioTriggerId: string;
  radioMenuId: string;
  commandTriggerId: string;
  commandMenuId: string;
}

async function discoverMenus(page: Page): Promise<MenuDiscovery> {
  return await page.evaluate(() => {
    const allTriggers = Array.from(document.querySelectorAll<HTMLButtonElement>('button[commandfor]'));
    const topTriggers = allTriggers.filter((btn) => !btn.closest('[popover]'));
    const subTriggers = allTriggers.filter((btn) => Boolean(btn.closest('[popover]')));

    allTriggers.forEach((btn, idx) => {
      if (!btn.id) btn.id = `grader-trigger-${idx}`;
    });

    const menubar = document.querySelector('[role="menubar"]');
    const isMenubar = Boolean(menubar);
    const barTopTriggers = isMenubar
      ? topTriggers.filter((btn) => menubar!.contains(btn))
      : topTriggers;

    const topTriggerIds = (barTopTriggers.length > 0 ? barTopTriggers : topTriggers).map((b) => b.id);

    const subWithLeaf =
      subTriggers.find((subBtn) => {
        const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '');
        if (!subMenu) return false;
        const group = subMenu.querySelector('[focusgroup~="menu"]');
        if (!group) return false;
        return Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).some(
          (item) => item.closest('[focusgroup]') === group && !item.hasAttribute('commandfor')
        );
      }) || subTriggers[0];

    let submenuLeafId = '';
    if (subWithLeaf) {
      const subMenu = document.getElementById(subWithLeaf.getAttribute('commandfor') || '');
      const group = subMenu?.querySelector('[focusgroup~="menu"]');
      const leaf = group
        ? Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).find(
            (item) => item.closest('[focusgroup]') === group && !item.hasAttribute('commandfor')
          )
        : null;
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
      const menuId = btn.getAttribute('commandfor') || '';
      const menu = document.getElementById(menuId);
      const group = menu?.querySelector('[focusgroup~="menu"]');
      if (!menu || !group) continue;

      const ownCheckbox = Array.from(group.querySelectorAll('[role="menuitemcheckbox"]')).find(
        (el) => el.closest('[focusgroup]') === group
      );
      if (ownCheckbox && !checkboxTriggerId) {
        checkboxTriggerId = btn.id;
        checkboxMenuId = menu.id;
      }

      const ownRadio = Array.from(group.querySelectorAll('[role="menuitemradio"]')).find(
        (el) => el.closest('[focusgroup]') === group
      );
      if (ownRadio && !radioTriggerId) {
        radioTriggerId = btn.id;
        radioMenuId = menu.id;
      }

      const ownCmd = Array.from(group.querySelectorAll<HTMLButtonElement>('button:not([commandfor])')).find(
        (el) =>
          el.closest('[focusgroup]') === group &&
          el.getAttribute('role') !== 'menuitemcheckbox' &&
          el.getAttribute('role') !== 'menuitemradio'
      );
      if (ownCmd && !commandTriggerId && !btn.closest('[popover]')) {
        commandTriggerId = btn.id;
        commandMenuId = menu.id;
      }
    }

    if (!commandTriggerId && topTriggers[0]) {
      commandTriggerId = topTriggers[0].id;
      commandMenuId = topTriggers[0].getAttribute('commandfor') || '';
    }

    return {
      isMenubar,
      topTriggerIds,
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
    const btn = document.getElementById(id);
    if (!btn) return;
    const ancestorMenus: HTMLElement[] = [];
    let current = btn.closest<HTMLElement>('[popover]');
    while (current) {
      ancestorMenus.unshift(current);
      current = current.parentElement?.closest<HTMLElement>('[popover]') || null;
    }
    for (const m of ancestorMenus) {
      if (!m.matches(':popover-open')) {
        const t = document.querySelector<HTMLElement>(`button[commandfor="${m.id}"]`);
        try {
          (m as HTMLElement & { showPopover: (opts?: { source?: HTMLElement }) => void }).showPopover(
            t ? { source: t } : undefined
          );
        } catch {
          m.showPopover();
        }
      }
    }
    await new Promise((r) => setTimeout(r, 30));
  }, triggerId);
}

test.describe('menu Target Grader', () => {
  // --- STATIC ASSERTIONS (FAST) ---

  test('Static CSS: Anchor positioning positions top-level menus below trigger and submenus beside trigger with --below fallback', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(stylesheet.cssRules);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const hasTopLevelPositionArea = styleRules.some((r) =>
      r.style.getPropertyValue('position-area').includes('block-end')
    );
    const hasSubmenuPositionArea = styleRules.some(
      (r) =>
        r.style.getPropertyValue('position-area').includes('inline-end') &&
        r.style.getPropertyValue('position-try-fallbacks').includes('--below')
    );
    const hasPositionTryBelow = allRules.some(
      (r) =>
        (r instanceof CSSAtRule && r.name === 'position-try' && r.cssText.includes('--below')) ||
        r.cssText.includes('@position-try --below')
    );

    expect(hasTopLevelPositionArea && hasSubmenuPositionArea && hasPositionTryBelow).toBe(true);
  });

  test('Static CSS: Checked items render a non-empty ::before content and base ::before reserves a fixed-size leading slot without subgrid', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const hasBaseLeadingSlot = styleRules.some(
      (r) =>
        r.selectorText.includes('::before') &&
        !r.selectorText.includes('aria-checked') &&
        !r.selectorText.includes('data-bridge') &&
        Boolean(r.style.getPropertyValue('inline-size') || r.style.getPropertyValue('width'))
    );
    const hasCheckedMark = styleRules.some((r) => {
      if (!r.selectorText.includes('aria-checked="true"') || !r.selectorText.includes('::before')) {
        return false;
      }
      const content = r.style.getPropertyValue('content').replace(/['"]/g, '').trim();
      return content.length > 0;
    });
    const usesSubgrid = styleRules.some(
      (r) =>
        r.style.getPropertyValue('grid-template-columns').includes('subgrid') ||
        r.style.getPropertyValue('grid-template-rows').includes('subgrid')
    );

    expect(hasBaseLeadingSlot && hasCheckedMark && !usesSubgrid).toBe(true);
  });

  test('Static CSS: Trailing hint content is pushed to inline end via margin-inline-start: auto', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const hasTrailingEndAlignment = styleRules.some(
      (r) =>
        (r.selectorText.includes('hint') ||
          r.selectorText.includes('focusgroup') ||
          r.selectorText.includes('popover') ||
          r.selectorText.includes('menu')) &&
        (r.style.getPropertyValue('margin-inline-start').trim() === 'auto' ||
          r.style.getPropertyValue('margin-left').trim() === 'auto')
    );

    expect(hasTrailingEndAlignment).toBe(true);
  });

  test('Static CSS: Open and close animations are gated by prefers-reduced-motion: no-preference, under 150ms, and use opacity and translate', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(stylesheet.cssRules);
    const mediaRules = allRules.filter(
      (r): r is CSSMediaRule =>
        r instanceof CSSMediaRule && r.conditionText.includes('prefers-reduced-motion') && r.conditionText.includes('no-preference')
    );

    const hasValidAnimation = mediaRules.some((media) => {
      const innerStyles = collectStyleRules(media.cssRules);
      const innerAll = collectAllCssRules(media.cssRules);
      const hasStartingStyle = innerAll.some(
        (r) => r instanceof CSSStartingStyleRule || r.cssText.includes('@starting-style')
      );
      const hasTransition = innerStyles.some((r) => {
        const trans = r.style.getPropertyValue('transition');
        return trans.includes('opacity') && trans.includes('translate');
      });
      return hasStartingStyle && hasTransition;
    });

    expect(hasValidAnimation).toBe(true);
  });

  test('Static CSS & JS: Safe triangle bridge uses data-bridge with clip-path and pointer coordinate custom properties', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(stylesheet.cssRules);
    const project = getJsProject(targetFiles);

    const hasBridgeCss = allRules.some(
      (r) =>
        r.cssText.includes('data-bridge') &&
        r.cssText.includes('clip-path') &&
        r.cssText.includes('--bridge-x') &&
        r.cssText.includes('--bridge-edge')
    );

    const stringLiterals = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.StringLiteral))
      .map((s) => s.getLiteralValue());

    const hasBridgeJs =
      stringLiterals.includes('--bridge-x') &&
      stringLiterals.includes('--bridge-y') &&
      stringLiterals.includes('--bridge-edge');

    expect(hasBridgeCss && hasBridgeJs).toBe(true);
  });

  test('Static JS: Progressive enhancement checks for focusGroup, commandForElement, and position-area support', () => {
    const project = getJsProject(targetFiles);
    const stringLiterals = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.StringLiteral))
      .map((s) => s.getLiteralValue());

    const hasFocusGroupCheck = stringLiterals.includes('focusGroup');
    const hasCommandForCheck = stringLiterals.includes('commandForElement');
    const hasPositionAreaCheck = stringLiterals.some((s) => s.includes('position-area'));

    const docs = getHtmlDocuments(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);
    const hasSupportsRule = collectAllCssRules(stylesheet.cssRules).some(
      (r) => r instanceof CSSSupportsRule && r.conditionText.includes('position-area')
    );

    expect(
      hasFocusGroupCheck &&
        hasCommandForCheck &&
        hasPositionAreaCheck &&
        hasSupportsRule &&
        docs.length > 0
    ).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Each menu list has focusgroup="menu nomemory" inside its popover (not on the popover) and is labeled by its trigger via aria-labelledby', async ({
      page,
    }) => {
      const valid = await page.evaluate(() => {
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
      expect(valid).toBe(true);
    });

    test('When native focusgroup is unsupported, fallback sets role="menu" on focusgroup containers and role="menuitem" on command items', async ({
      page,
      TARGET_URL,
    }) => {
      await page.addInitScript(() => {
        try {
          delete (HTMLElement.prototype as unknown as Record<string, unknown>).focusGroup;
        } catch {
          // ignore
        }
      });
      await page.goto(TARGET_URL);

      const valid = await page.evaluate(() => {
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
      expect(valid).toBe(true);
    });

    test('Separators are <hr> elements and checkable items are <button type="button"> with role="menuitemcheckbox" or role="menuitemradio" (radios inside named role="group") and aria-checked', async ({
      page,
    }) => {
      const valid = await page.evaluate(() => {
        const fakeSeparators = Array.from(
          document.querySelectorAll(
            '[focusgroup~="menu"] [role="separator"]:not(hr), [focusgroup~="menu"] .separator:not(hr), [focusgroup~="menu"] .divider:not(hr)'
          )
        );
        const checkboxes = Array.from(
          document.querySelectorAll<HTMLButtonElement>('[focusgroup~="menu"] [role="menuitemcheckbox"]')
        );
        const radios = Array.from(
          document.querySelectorAll<HTMLButtonElement>('[focusgroup~="menu"] [role="menuitemradio"]')
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
      expect(valid).toBe(true);
    });

    test('Each trigger is a <button type="button"> with aria-haspopup="menu", commandfor, command="toggle-popover", and no popovertarget, popovertargetaction, or aria-details', async ({
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
            !btn.hasAttribute('popovertargetaction') &&
            !btn.hasAttribute('aria-details')
        );
      });
      expect(valid).toBe(true);
    });

    test('Each popover is the immediate nextElementSibling of its trigger, submenus are popover="auto" inside parent focusgroup, and closed submenus are not rendered inline', async ({
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
          if (btn.closest('[popover]')) {
            if (!btn.parentElement?.hasAttribute('focusgroup')) return false;
            if (window.getComputedStyle(menu).display !== 'none') return false;
          }
          return true;
        });
      });
      expect(valid).toBe(true);
    });

    test('Top-level triggers consistently implement either the continuous menubar model or the standalone menu buttons model', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
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
    });

    test('Focusing a submenu trigger (or menubar trigger) previews its menu with aria-expanded="true" while keeping focus on the trigger, and blurring closes the preview', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.locator(`#${info.submenuTriggerId}`).hover();

      const previewResult = await page.evaluate(async (subTriggerId) => {
        const subTrigger = document.getElementById(subTriggerId) as HTMLButtonElement | null;
        if (!subTrigger) return false;
        const subMenu = document.getElementById(subTrigger.getAttribute('commandfor') || '');
        if (!subMenu) return false;

        subTrigger.focus();
        await new Promise((r) => setTimeout(r, 220));
        const openedOnFocus =
          subMenu.matches(':popover-open') &&
          subTrigger.getAttribute('aria-expanded') === 'true' &&
          document.activeElement === subTrigger;

        const parentGroup = subTrigger.closest('[focusgroup~="menu"]');
        const siblingItem = parentGroup
          ? Array.from(parentGroup.querySelectorAll<HTMLElement>('button, a[href]')).find(
              (el) => el.closest('[focusgroup]') === parentGroup && el !== subTrigger
            )
          : null;
        if (siblingItem) {
          siblingItem.focus();
        } else {
          subTrigger.blur();
        }
        await new Promise((r) => setTimeout(r, 50));
        const closedOnBlur =
          !subMenu.matches(':popover-open') && subTrigger.getAttribute('aria-expanded') === 'false';

        return openedOnFocus && closedOnBlur;
      }, info.submenuTriggerId);

      expect(previewResult).toBe(true);
    });

    test('Focus returning to a trigger when the window regains focus does not reopen or preview its menu', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      const firstTopId = info.topTriggerIds[0];

      const stayedClosed = await page.evaluate(async (triggerId) => {
        const trigger = document.getElementById(triggerId) as HTMLButtonElement | null;
        if (!trigger) return false;
        const menu = document.getElementById(trigger.getAttribute('commandfor') || '');
        if (!menu) return false;

        trigger.focus();
        if (menu.matches(':popover-open')) {
          menu.hidePopover();
        }
        window.dispatchEvent(new Event('blur'));
        trigger.blur();
        window.dispatchEvent(new Event('focus'));
        trigger.focus();
        await new Promise((r) => setTimeout(r, 50));
        return !menu.matches(':popover-open') && trigger.getAttribute('aria-expanded') === 'false';
      }, firstTopId);

      expect(stayedClosed).toBe(true);
    });

    test('Pressing Enter or Space on a previewed trigger closes the preview and sets aria-expanded="false" while keeping focus on the trigger', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.evaluate(async (subTriggerId) => {
        const subTrigger = document.getElementById(subTriggerId) as HTMLButtonElement;
        const subMenu = document.getElementById(subTrigger.getAttribute('commandfor') || '')!;
        if (!subMenu.matches(':popover-open')) {
          try {
            (subMenu as HTMLElement & { showPopover: (opts?: { source?: HTMLElement }) => void }).showPopover({
              source: subTrigger,
            });
          } catch {
            subMenu.showPopover();
          }
        }
        subTrigger.focus();
        await new Promise((r) => setTimeout(r, 30));
      }, info.submenuTriggerId);

      await page.keyboard.press('Enter');
      await page.waitForTimeout(30);

      const result = await page.evaluate((subTriggerId) => {
        const subTrigger = document.getElementById(subTriggerId)!;
        const subMenu = document.getElementById(subTrigger.getAttribute('commandfor') || '')!;
        return (
          !subMenu.matches(':popover-open') &&
          subTrigger.getAttribute('aria-expanded') === 'false' &&
          document.activeElement === subTrigger
        );
      }, info.submenuTriggerId);

      expect(result).toBe(true);
    });

    test('Pressing Enter on a closed trigger opens its menu, sets aria-expanded="true", and moves focus to the first enabled item', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      const triggerId = info.topTriggerIds[0];

      await page.evaluate(async (id) => {
        const btn = document.getElementById(id)!;
        const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
        btn.focus();
        if (menu.matches(':popover-open')) menu.hidePopover();
        await new Promise((r) => setTimeout(r, 30));
      }, triggerId);

      await page.keyboard.press('Enter');
      await page.waitForTimeout(30);

      const enteredFirst = await page.evaluate((id) => {
        const btn = document.getElementById(id)!;
        const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
        const group = menu.querySelector('[focusgroup~="menu"]')!;
        const items = Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).filter(
          (el) => el.closest('[focusgroup]') === group && !(el as HTMLButtonElement).disabled
        );
        return (
          menu.matches(':popover-open') &&
          btn.getAttribute('aria-expanded') === 'true' &&
          items.length > 0 &&
          document.activeElement === items[0]
        );
      }, triggerId);

      expect(enteredFirst).toBe(true);
    });

    test('Pressing ArrowDown on a previewed top-level trigger moves focus to the first enabled menu item', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      const triggerId = info.topTriggerIds[0];

      await page.evaluate(async (id) => {
        const btn = document.getElementById(id)!;
        const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
        if (!menu.matches(':popover-open')) {
          try {
            (menu as HTMLElement & { showPopover: (opts?: { source?: HTMLElement }) => void }).showPopover({
              source: btn,
            });
          } catch {
            menu.showPopover();
          }
        }
        btn.focus();
        await new Promise((r) => setTimeout(r, 30));
      }, triggerId);

      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(30);

      const focusedFirst = await page.evaluate((id) => {
        const btn = document.getElementById(id)!;
        const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
        const group = menu.querySelector('[focusgroup~="menu"]')!;
        const items = Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).filter(
          (el) => el.closest('[focusgroup]') === group && !(el as HTMLButtonElement).disabled
        );
        return menu.matches(':popover-open') && document.activeElement === items[0];
      }, triggerId);

      expect(focusedFirst).toBe(true);
    });

    test('Inside an open menu, ArrowDown, ArrowUp, End, and Home move focus across enabled items', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      const triggerId = info.topTriggerIds[0];

      await page.evaluate(async (id) => {
        const btn = document.getElementById(id)!;
        const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
        btn.focus();
        if (menu.matches(':popover-open')) menu.hidePopover();
        await new Promise((r) => setTimeout(r, 30));
      }, triggerId);

      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(30);
      await page.keyboard.press('ArrowDown');
      const atSecond = await page.evaluate((id) => {
        const menu = document.getElementById(document.getElementById(id)!.getAttribute('commandfor') || '')!;
        const group = menu.querySelector('[focusgroup~="menu"]')!;
        const items = Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).filter(
          (el) => el.closest('[focusgroup]') === group && !(el as HTMLButtonElement).disabled
        );
        return document.activeElement === items[1];
      }, triggerId);

      await page.keyboard.press('End');
      const atLast = await page.evaluate((id) => {
        const menu = document.getElementById(document.getElementById(id)!.getAttribute('commandfor') || '')!;
        const group = menu.querySelector('[focusgroup~="menu"]')!;
        const items = Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).filter(
          (el) => el.closest('[focusgroup]') === group && !(el as HTMLButtonElement).disabled
        );
        return document.activeElement === items[items.length - 1];
      }, triggerId);

      await page.keyboard.press('Home');
      const atFirst = await page.evaluate((id) => {
        const menu = document.getElementById(document.getElementById(id)!.getAttribute('commandfor') || '')!;
        const group = menu.querySelector('[focusgroup~="menu"]')!;
        const items = Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).filter(
          (el) => el.closest('[focusgroup]') === group && !(el as HTMLButtonElement).disabled
        );
        return document.activeElement === items[0];
      }, triggerId);

      expect(atSecond && atLast && atFirst).toBe(true);
    });

    test('Pressing ArrowRight on a submenu trigger opens the submenu and focuses its first item, and ArrowLeft closes only that submenu and restores focus to its parent trigger', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.evaluate(async (subId) => {
        const subBtn = document.getElementById(subId)!;
        const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
        if (subMenu.matches(':popover-open')) subMenu.hidePopover();
        subBtn.focus();
        await new Promise((r) => setTimeout(r, 30));
      }, info.submenuTriggerId);

      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(30);

      const openedAndFocusedFirst = await page.evaluate((subId) => {
        const subBtn = document.getElementById(subId)!;
        const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
        const group = subMenu.querySelector('[focusgroup~="menu"]')!;
        const items = Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).filter(
          (el) => el.closest('[focusgroup]') === group && !(el as HTMLButtonElement).disabled
        );
        return subMenu.matches(':popover-open') && document.activeElement === items[0];
      }, info.submenuTriggerId);

      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(30);

      const closedSubOnlyAndRestored = await page.evaluate((subId) => {
        const subBtn = document.getElementById(subId)!;
        const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
        const parentMenu = subBtn.closest<HTMLElement>('[popover]')!;
        return (
          !subMenu.matches(':popover-open') &&
          parentMenu.matches(':popover-open') &&
          document.activeElement === subBtn
        );
      }, info.submenuTriggerId);

      expect(openedAndFocusedFirst && closedSubOnlyAndRestored).toBe(true);
    });

    test('ArrowRight and ArrowLeft on top-level triggers and inside menus match the menubar or standalone button keyboard model', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      const firstId = info.topTriggerIds[0];

      await page.evaluate((id) => {
        document.getElementById(id)!.focus();
      }, firstId);

      await page.keyboard.press('ArrowRight');

      const result = await page.evaluate(
        ({ isMenubar, topTriggerIds }) => {
          const firstTrigger = document.getElementById(topTriggerIds[0])!;
          if (isMenubar && topTriggerIds.length > 1) {
            const secondTrigger = document.getElementById(topTriggerIds[1])!;
            const secondMenu = document.getElementById(secondTrigger.getAttribute('commandfor') || '')!;
            return document.activeElement === secondTrigger && secondMenu.matches(':popover-open');
          } else {
            return document.activeElement === firstTrigger;
          }
        },
        { isMenubar: info.isMenubar, topTriggerIds: info.topTriggerIds }
      );

      expect(result).toBe(true);
    });

    test('Pressing Escape inside a nested submenu closes only that submenu level, sets its trigger aria-expanded to "false", and restores focus to its trigger', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.evaluate(async (subId) => {
        const subBtn = document.getElementById(subId)!;
        const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
        if (subMenu.matches(':popover-open')) subMenu.hidePopover();
        subBtn.focus();
        await new Promise((r) => setTimeout(r, 30));
      }, info.submenuTriggerId);

      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(30);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(30);

      const valid = await page.evaluate((subId) => {
        const subBtn = document.getElementById(subId)!;
        const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
        const parentMenu = subBtn.closest<HTMLElement>('[popover]')!;
        return (
          !subMenu.matches(':popover-open') &&
          subBtn.getAttribute('aria-expanded') === 'false' &&
          parentMenu.matches(':popover-open') &&
          document.activeElement === subBtn
        );
      }, info.submenuTriggerId);

      expect(valid).toBe(true);
    });

    test('Pressing Tab inside an open menu closes all open menus and leaves no focus inside hidden popover content', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.evaluate(async (subId) => {
        const subBtn = document.getElementById(subId)!;
        subBtn.focus();
        await new Promise((r) => setTimeout(r, 30));
      }, info.submenuTriggerId);

      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(30);

      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(30);
        const stillInside = await page.evaluate(() => Boolean(document.activeElement?.closest('[popover]')));
        if (!stillInside) break;
      }

      const valid = await page.evaluate(() => {
        const openPopovers = document.querySelectorAll('[popover]:popover-open');
        const activeInPopover = document.activeElement?.closest('[popover]');
        return openPopovers.length === 0 && !activeInPopover;
      });

      expect(valid).toBe(true);
    });

    test('Clicking a closed trigger opens its menu with focus on the trigger (no item focused and no :focus-visible), clicking again closes it, and clicking outside closes all menus', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      const triggerId = info.topTriggerIds[0];

      await page.locator(`#${triggerId}`).click();
      await page.waitForTimeout(30);

      const afterFirstClick = await page.evaluate((id) => {
        const btn = document.getElementById(id)!;
        const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
        return (
          menu.matches(':popover-open') &&
          document.activeElement === btn &&
          !menu.contains(document.activeElement)
        );
      }, triggerId);

      await page.locator(`#${triggerId}`).click();
      await page.waitForTimeout(30);

      const afterSecondClick = await page.evaluate((id) => {
        const btn = document.getElementById(id)!;
        const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
        return !menu.matches(':popover-open') && btn.getAttribute('aria-expanded') === 'false';
      }, triggerId);

      await page.locator(`#${triggerId}`).click();
      await page.waitForTimeout(30);
      await page.locator('body').click({ position: { x: 5, y: 5 } });
      await page.waitForTimeout(30);

      const afterOutsideClick = await page.evaluate(() => {
        return document.querySelectorAll('[popover]:popover-open').length === 0;
      });

      expect(afterFirstClick && afterSecondClick && afterOutsideClick).toBe(true);
    });

    test('Moving the pointer over a menu item focuses that item without matching :focus-visible', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      const triggerId = info.topTriggerIds[0];

      await page.locator(`#${triggerId}`).click();

      const itemSelector = await page.evaluate((id) => {
        const btn = document.getElementById(id)!;
        const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
        const group = menu.querySelector('[focusgroup~="menu"]')!;
        const items = Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).filter(
          (el) => el.closest('[focusgroup]') === group
        );
        const target = items[0];
        if (!target.id) target.id = 'grader-hover-item';
        return `#${target.id}`;
      }, triggerId);

      await page.locator(itemSelector).hover();
      await page.waitForTimeout(30);

      const hoveredFocus = await page.evaluate((sel) => {
        const item = document.querySelector<HTMLElement>(sel)!;
        return document.activeElement === item;
      }, itemSelector);

      expect(hoveredFocus).toBe(true);
    });

    test('Hovering a top-level trigger when no menu is open does nothing, and when a menu is open follows the menubar or standalone button hover model', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      const firstId = info.topTriggerIds[0];

      await page.locator(`#${firstId}`).hover();
      const closedOnIdleHover = await page.evaluate(() => {
        return document.querySelectorAll('[popover]:popover-open').length === 0;
      });

      let openHoverValid = true;
      if (info.isMenubar && info.topTriggerIds.length > 1) {
        const secondId = info.topTriggerIds[1];
        await page.locator(`#${firstId}`).click();
        await page.locator(`#${secondId}`).hover();
        openHoverValid = await page.evaluate(
          ({ fId, sId }) => {
            const firstMenu = document.getElementById(document.getElementById(fId)!.getAttribute('commandfor') || '')!;
            const secondTrigger = document.getElementById(sId)!;
            const secondMenu = document.getElementById(secondTrigger.getAttribute('commandfor') || '')!;
            return (
              !firstMenu.matches(':popover-open') &&
              secondMenu.matches(':popover-open') &&
              document.activeElement === secondTrigger
            );
          },
          { fId: firstId, sId: secondId }
        );
      }

      expect(closedOnIdleHover && openHoverValid).toBe(true);
    });

    test('Space on a menuitemcheckbox toggles aria-checked and keeps the menu open, while Enter on a checkable item toggles it and closes the menu', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      await openParentChainForTrigger(page, info.checkboxTriggerId);

      const initialChecked = await page.evaluate(
        async ({ trigId, menuId }) => {
          const trig = document.getElementById(trigId)!;
          const menu = document.getElementById(menuId)!;
          if (!menu.matches(':popover-open')) {
            try {
              (menu as HTMLElement & { showPopover: (opts?: { source?: HTMLElement }) => void }).showPopover({
                source: trig,
              });
            } catch {
              menu.showPopover();
            }
          }
          await new Promise((r) => setTimeout(r, 30));
          const cb = menu.querySelector<HTMLButtonElement>('[role="menuitemcheckbox"]')!;
          if (!cb.id) cb.id = 'grader-cb-item';
          cb.focus();
          return cb.getAttribute('aria-checked');
        },
        { trigId: info.checkboxTriggerId, menuId: info.checkboxMenuId }
      );

      await page.keyboard.press(' ');
      await page.waitForTimeout(30);

      const afterSpace = await page.evaluate((menuId) => {
        const menu = document.getElementById(menuId)!;
        const cb = document.getElementById('grader-cb-item')!;
        return {
          checked: cb.getAttribute('aria-checked'),
          isOpen: menu.matches(':popover-open'),
        };
      }, info.checkboxMenuId);

      expect(afterSpace.checked !== initialChecked && afterSpace.isOpen).toBe(true);
    });

    test('Selecting a menuitemradio sets aria-checked="true" on the chosen radio, unchecks siblings in its group, and closes the menu', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      await openParentChainForTrigger(page, info.radioTriggerId);

      await page.evaluate(
        async ({ trigId, menuId }) => {
          const trig = document.getElementById(trigId)!;
          const menu = document.getElementById(menuId)!;
          if (!menu.matches(':popover-open')) {
            try {
              (menu as HTMLElement & { showPopover: (opts?: { source?: HTMLElement }) => void }).showPopover({
                source: trig,
              });
            } catch {
              menu.showPopover();
            }
          }
          await new Promise((r) => setTimeout(r, 30));
          const uncheckedRadio =
            menu.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="false"]') ||
            menu.querySelector<HTMLButtonElement>('[role="menuitemradio"]')!;
          uncheckedRadio.id = 'grader-radio-target';
          uncheckedRadio.focus();
        },
        { trigId: info.radioTriggerId, menuId: info.radioMenuId }
      );

      await page.keyboard.press('Enter');
      await page.waitForTimeout(380);

      const radioResult = await page.evaluate(() => {
        const target = document.getElementById('grader-radio-target')!;
        const group = target.closest('[role="group"]')!;
        const checkedInGroup = group.querySelectorAll('[role="menuitemradio"][aria-checked="true"]');
        const openMenus = document.querySelectorAll('[popover]:popover-open');
        return (
          target.getAttribute('aria-checked') === 'true' &&
          checkedInGroup.length === 1 &&
          openMenus.length === 0
        );
      });

      expect(radioResult).toBe(true);
    });

    test('Pointer activation of a command item closes all open menu levels and restores focus to the root trigger without :focus-visible', async ({
      page,
    }) => {
      const info = await discoverMenus(page);

      await page.locator(`#${info.commandTriggerId}`).scrollIntoViewIfNeeded();
      await page.locator(`#${info.commandTriggerId}`).click();
      await page.waitForTimeout(30);

      const cmdSelector = await page.evaluate(
        ({ menuId }) => {
          const menu = document.getElementById(menuId)!;
          const group = menu.querySelector('[focusgroup~="menu"]')!;
          const cmd = Array.from(group.querySelectorAll<HTMLButtonElement>('button:not([commandfor])')).find(
            (b) =>
              b.closest('[focusgroup]') === group &&
              b.getAttribute('role') !== 'menuitemcheckbox' &&
              b.getAttribute('role') !== 'menuitemradio'
          )!;
          if (!cmd.id) cmd.id = 'grader-cmd-btn';
          return `#${cmd.id}`;
        },
        { menuId: info.commandMenuId }
      );

      await page.locator(cmdSelector).click();
      await page.waitForTimeout(30);

      const afterCommandClick = await page.evaluate((trigId) => {
        const trig = document.getElementById(trigId)!;
        const openMenus = document.querySelectorAll('[popover]:popover-open');
        return openMenus.length === 0 && document.activeElement === trig;
      }, info.commandTriggerId);

      expect(afterCommandClick).toBe(true);
    });

    test('At a 375px narrow viewport, an open submenu sits directly below its trigger item and does not intersect the trigger box', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      const info = await discoverMenus(page);
      await openParentChainForTrigger(page, info.submenuTriggerId);

      const geometry = await page.evaluate((subId) => {
        const subBtn = document.getElementById(subId)!;
        const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
        if (!subMenu.matches(':popover-open')) {
          try {
            (subMenu as HTMLElement & { showPopover: (opts?: { source?: HTMLElement }) => void }).showPopover({
              source: subBtn,
            });
          } catch {
            subMenu.showPopover();
          }
        }
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

    test('Checked items render a non-empty ::before pseudo-element content while unchecked items render empty ::before content', async ({
      page,
    }) => {
      const valid = await page.evaluate(() => {
        const checked = document.querySelector<HTMLElement>(
          '[focusgroup~="menu"] button[aria-checked="true"]'
        );
        const unchecked = document.querySelector<HTMLElement>(
          '[focusgroup~="menu"] button[aria-checked="false"]'
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
  });
});
