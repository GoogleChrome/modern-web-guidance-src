import {
  test,
  expect,
  getTargetFiles,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('Application Menu Bar Grader', () => {

  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('The top-level triggers are direct children of a container with role="menubar" and an accessible name, and no [popover] element has role="menubar"', () => {
    const docs = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThan(0);

    const menubars: any[] = docs.flatMap((d) => Array.from(d.document.querySelectorAll('[role="menubar"]')));
    expect(menubars.length).toBeGreaterThan(0);

    for (const menubar of menubars) {
      const ariaLabel = menubar.getAttribute('aria-label');
      const ariaLabelledby = menubar.getAttribute('aria-labelledby');
      const title = menubar.getAttribute('title');
      const hasAccessibleName = Boolean(
        (ariaLabel && ariaLabel.trim()) ||
        (ariaLabelledby && ariaLabelledby.trim()) ||
        (title && title.trim())
      );
      expect(hasAccessibleName).toBe(true);

      const directTriggers = Array.from(menubar.children).filter((el: any) =>
        el.tagName.toLowerCase() === 'button' && (el.hasAttribute('commandfor') || el.hasAttribute('aria-haspopup'))
      );
      expect(directTriggers.length).toBeGreaterThan(0);

      const allDescendantTriggers = Array.from(menubar.querySelectorAll('button[commandfor], button[aria-haspopup]'))
        .filter((el: any) => !el.closest('[popover]'));
      expect(directTriggers.length).toBe(allDescendantTriggers.length);
    }

    const popoverMenubars = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('[popover][role="menubar"]'))
    );
    expect(popoverMenubars.length).toBe(0);
  });

  test('Each top-level trigger is a <button type="button"> with aria-haspopup="menu", commandfor, and command="toggle-popover", immediately followed by its popover="auto" menu, which contains an element with focusgroup="menu nomemory" labeled by the trigger via aria-labelledby', () => {
    const docs = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThan(0);

    const menubars: any[] = docs.flatMap((d) => Array.from(d.document.querySelectorAll('[role="menubar"]')));
    expect(menubars.length).toBeGreaterThan(0);

    let totalTriggersChecked = 0;

    for (const menubar of menubars) {
      const directTriggers: any[] = Array.from(menubar.children).filter((el: any) =>
        el.tagName.toLowerCase() === 'button'
      );
      expect(directTriggers.length).toBeGreaterThan(0);

      for (const trigger of directTriggers) {
        totalTriggersChecked++;

        expect(trigger.getAttribute('type')).toBe('button');
        expect(trigger.getAttribute('aria-haspopup')).toBe('menu');

        const commandfor = trigger.getAttribute('commandfor');
        expect(commandfor).toBeTruthy();
        expect(trigger.getAttribute('command')).toBe('toggle-popover');

        const nextSibling: any = trigger.nextElementSibling;
        expect(nextSibling).toBeTruthy();
        expect(nextSibling.id).toBe(commandfor);
        const popoverVal = nextSibling.getAttribute('popover');
        expect(popoverVal === 'auto' || popoverVal === '').toBe(true);

        const fgElement: any = nextSibling.querySelector('[focusgroup]');
        expect(fgElement).toBeTruthy();
        const fgAttr = (fgElement.getAttribute('focusgroup') || '').trim();
        const tokens = fgAttr.split(/\s+/);
        expect(tokens).toContain('menu');
        expect(tokens).toContain('nomemory');

        expect(fgElement.getAttribute('aria-labelledby')).toBe(trigger.id);
      }
    }

    expect(totalTriggersChecked).toBeGreaterThan(0);
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {

    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Exactly one top-level trigger in the menubar is in the Tab order (tabindex="0") and every other top-level trigger has tabindex="-1"', async ({ page }) => {
      const triggers = page.locator('[role="menubar"] > button, [role="menubar"] > [commandfor]');
      await expect(triggers.first()).toBeAttached();
      const count = await triggers.count();
      expect(count).toBeGreaterThan(0);

      const tabIndices = await triggers.evaluateAll((els) =>
        els.map((el) => (el as HTMLElement).tabIndex)
      );

      const zeroCount = tabIndices.filter((t) => t === 0).length;
      const minusOneCount = tabIndices.filter((t) => t === -1).length;

      expect(zeroCount).toBe(1);
      expect(minusOneCount).toBe(tabIndices.length - 1);
    });

    test('Focusing a top-level trigger previews its menu and sets aria-expanded="true" without moving focus into the menu, and blurring a trigger that is only previewing closes that menu and sets aria-expanded="false"', async ({ page }) => {
      const trigger = page.locator('[role="menubar"] > button').first();
      await expect(trigger).toBeAttached();
      const commandFor = await trigger.getAttribute('commandfor');
      expect(commandFor).toBeTruthy();
      const menu = page.locator(`#${commandFor}`);

      await trigger.focus();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(menu).toBeVisible();

      const activeId = await page.evaluate(() => document.activeElement?.id);
      const triggerId = await trigger.getAttribute('id');
      expect(activeId).toBe(triggerId);

      await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(menu).toBeHidden();
    });

    test('Focus returning to a trigger because the window regained focus does not preview or reopen its menu', async ({ page }) => {
      const trigger = page.locator('[role="menubar"] > button').first();
      await expect(trigger).toBeAttached();
      const commandFor = await trigger.getAttribute('commandfor');
      expect(commandFor).toBeTruthy();
      const menu = page.locator(`#${commandFor}`);

      await page.evaluate(() => {
        (document.activeElement as HTMLElement)?.blur?.();
      });
      await expect(menu).toBeHidden();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');

      await page.evaluate((cmdFor) => {
        window.dispatchEvent(new Event('blur'));
        window.dispatchEvent(new Event('focus'));
        const btn = document.querySelector(`[commandfor="${cmdFor}"]`) as HTMLElement;
        btn?.focus();
      }, commandFor);

      await expect(menu).toBeHidden();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    test('Pressing Enter or Space on a previewed top-level trigger closes that preview and sets aria-expanded="false" without moving focus from the trigger', async ({ page }) => {
      const triggers = page.locator('[role="menubar"] > button');
      await expect(triggers.first()).toBeAttached();
      const count = await triggers.count();
      expect(count).toBeGreaterThanOrEqual(2);

      const firstTrigger = triggers.nth(0);
      const firstCmdFor = await firstTrigger.getAttribute('commandfor');
      expect(firstCmdFor).toBeTruthy();
      const firstMenu = page.locator(`#${firstCmdFor}`);

      await firstTrigger.focus();
      await expect(firstMenu).toBeVisible();
      await expect(firstTrigger).toHaveAttribute('aria-expanded', 'true');

      await page.keyboard.press('Enter');
      await expect(firstMenu).toBeHidden();
      await expect(firstTrigger).toHaveAttribute('aria-expanded', 'false');
      let activeId = await page.evaluate(() => document.activeElement?.id);
      const firstId = await firstTrigger.getAttribute('id');
      expect(activeId).toBe(firstId);

      const secondTrigger = triggers.nth(1);
      const secondCmdFor = await secondTrigger.getAttribute('commandfor');
      expect(secondCmdFor).toBeTruthy();
      const secondMenu = page.locator(`#${secondCmdFor}`);

      await secondTrigger.focus();
      await expect(secondMenu).toBeVisible();
      await expect(secondTrigger).toHaveAttribute('aria-expanded', 'true');

      await page.keyboard.press('Space');
      await expect(secondMenu).toBeHidden();
      await expect(secondTrigger).toHaveAttribute('aria-expanded', 'false');
      activeId = await page.evaluate(() => document.activeElement?.id);
      const secondId = await secondTrigger.getAttribute('id');
      expect(activeId).toBe(secondId);
    });

    test('Pressing ArrowDown on a previewed top-level trigger converts it to open and moves focus to the first enabled item in the same turn', async ({ page }) => {
      const trigger = page.locator('[role="menubar"] > button').first();
      await expect(trigger).toBeAttached();
      const commandFor = await trigger.getAttribute('commandfor');
      expect(commandFor).toBeTruthy();
      const menu = page.locator(`#${commandFor}`);

      await trigger.focus();
      await expect(menu).toBeVisible();

      await page.keyboard.press('ArrowDown');
      await expect(menu).toBeVisible();

      const focusCheck = await page.evaluate((menuId) => {
        const m = document.getElementById(menuId);
        if (!m) return { inMenu: false, isFirst: false };
        const inMenu = m.contains(document.activeElement);
        const group = m.querySelector('[focusgroup]');
        const root = group || m;
        const items = Array.from(root.querySelectorAll('button, a[href]'))
          .filter((el) => {
            const item = el as HTMLElement;
            return item.closest('[popover]') === m && item.getAttribute('aria-disabled') !== 'true' && !(item as any).disabled;
          });
        const isFirst = items.length > 0 && items[0] === document.activeElement;
        return { inMenu, isFirst };
      }, commandFor!);

      expect(focusCheck.inMenu).toBe(true);
      expect(focusCheck.isFirst).toBe(true);
    });

    test('On a top-level trigger, Home and End open its menu if needed and move focus to the first or last enabled item', async ({ page }) => {
      const trigger = page.locator('[role="menubar"] > button').first();
      await expect(trigger).toBeAttached();
      const commandFor = await trigger.getAttribute('commandfor');
      expect(commandFor).toBeTruthy();
      const menu = page.locator(`#${commandFor}`);

      await trigger.focus();
      await page.keyboard.press('Home');
      await expect(menu).toBeVisible();

      const homeCheck = await page.evaluate((menuId) => {
        const m = document.getElementById(menuId);
        if (!m) return false;
        const group = m.querySelector('[focusgroup]');
        const root = group || m;
        const items = Array.from(root.querySelectorAll('button, a[href]'))
          .filter((el) => {
            const item = el as HTMLElement;
            return item.closest('[popover]') === m && item.getAttribute('aria-disabled') !== 'true' && !(item as any).disabled;
          });
        return items.length > 0 && items[0] === document.activeElement;
      }, commandFor!);
      expect(homeCheck).toBe(true);

      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expect(trigger).toBeFocused();

      await page.keyboard.press('End');
      await expect(menu).toBeVisible();

      const endCheck = await page.evaluate((menuId) => {
        const m = document.getElementById(menuId);
        if (!m) return false;
        const group = m.querySelector('[focusgroup]');
        const root = group || m;
        const items = Array.from(root.querySelectorAll('button, a[href]'))
          .filter((el) => {
            const item = el as HTMLElement;
            return item.closest('[popover]') === m && item.getAttribute('aria-disabled') !== 'true' && !(item as any).disabled;
          });
        return items.length > 0 && items[items.length - 1] === document.activeElement;
      }, commandFor!);
      expect(endCheck).toBe(true);
    });

    test('From a focused top-level trigger, ArrowRight and ArrowLeft move focus to the next and previous top-level trigger (wrapping at either end), move tabindex="0" to it, and preview its menu with focus staying on the trigger', async ({ page }) => {
      const triggers = page.locator('[role="menubar"] > button');
      await expect(triggers.first()).toBeAttached();
      const count = await triggers.count();
      expect(count).toBeGreaterThanOrEqual(2);

      const firstTrigger = triggers.nth(0);
      const secondTrigger = triggers.nth(1);
      const lastTrigger = triggers.nth(count - 1);

      const firstCmdFor = await firstTrigger.getAttribute('commandfor');
      const secondCmdFor = await secondTrigger.getAttribute('commandfor');
      const lastCmdFor = await lastTrigger.getAttribute('commandfor');

      const firstMenu = page.locator(`#${firstCmdFor}`);
      const secondMenu = page.locator(`#${secondCmdFor}`);
      const lastMenu = page.locator(`#${lastCmdFor}`);

      await firstTrigger.focus();
      await expect(firstMenu).toBeVisible();
      let activeId = await page.evaluate(() => document.activeElement?.id);
      expect(activeId).toBe(await firstTrigger.getAttribute('id'));

      await page.keyboard.press('ArrowRight');
      activeId = await page.evaluate(() => document.activeElement?.id);
      expect(activeId).toBe(await secondTrigger.getAttribute('id'));
      await expect(secondMenu).toBeVisible();
      await expect(firstMenu).toBeHidden();
      let secondTabIndex = await secondTrigger.evaluate((el) => (el as HTMLElement).tabIndex);
      let firstTabIndex = await firstTrigger.evaluate((el) => (el as HTMLElement).tabIndex);
      expect(secondTabIndex).toBe(0);
      expect(firstTabIndex).toBe(-1);

      await page.keyboard.press('ArrowLeft');
      activeId = await page.evaluate(() => document.activeElement?.id);
      expect(activeId).toBe(await firstTrigger.getAttribute('id'));
      await expect(firstMenu).toBeVisible();
      await expect(secondMenu).toBeHidden();
      firstTabIndex = await firstTrigger.evaluate((el) => (el as HTMLElement).tabIndex);
      expect(firstTabIndex).toBe(0);

      await page.keyboard.press('ArrowLeft');
      activeId = await page.evaluate(() => document.activeElement?.id);
      expect(activeId).toBe(await lastTrigger.getAttribute('id'));
      await expect(lastMenu).toBeVisible();
      let lastTabIndex = await lastTrigger.evaluate((el) => (el as HTMLElement).tabIndex);
      expect(lastTabIndex).toBe(0);

      await page.keyboard.press('ArrowRight');
      activeId = await page.evaluate(() => document.activeElement?.id);
      expect(activeId).toBe(await firstTrigger.getAttribute('id'));
      await expect(firstMenu).toBeVisible();
      firstTabIndex = await firstTrigger.evaluate((el) => (el as HTMLElement).tabIndex);
      expect(firstTabIndex).toBe(0);
    });

    test('From inside an open top-level menu, ArrowRight and ArrowLeft close the current menu and preview the next or previous top-level menu (wrapping at either end) with focus on its trigger and no item focused', async ({ page }) => {
      const triggers = page.locator('[role="menubar"] > button');
      await expect(triggers.first()).toBeAttached();
      const count = await triggers.count();
      expect(count).toBeGreaterThanOrEqual(2);

      const firstTrigger = triggers.nth(0);
      const secondTrigger = triggers.nth(1);
      const lastTrigger = triggers.nth(count - 1);

      const firstCmdFor = await firstTrigger.getAttribute('commandfor');
      const secondCmdFor = await secondTrigger.getAttribute('commandfor');
      const lastCmdFor = await lastTrigger.getAttribute('commandfor');

      const firstMenu = page.locator(`#${firstCmdFor}`);
      const secondMenu = page.locator(`#${secondCmdFor}`);
      const lastMenu = page.locator(`#${lastCmdFor}`);

      await firstTrigger.focus();
      await page.keyboard.press('ArrowDown');
      await expect(firstMenu).toBeVisible();

      // ArrowRight on a submenu trigger opens the submenu (per menu guide); focus a top-level leaf item to test menubar switching
      const leaf = firstMenu.locator('button:not([aria-haspopup]), a[href]').filter({ visible: true }).first();
      await leaf.focus();

      await page.keyboard.press('ArrowRight');
      await expect(firstMenu).toBeHidden();
      await expect(secondMenu).toBeVisible();
      let activeId = await page.evaluate(() => document.activeElement?.id);
      expect(activeId).toBe(await secondTrigger.getAttribute('id'));

      await page.keyboard.press('ArrowDown');
      await expect(secondMenu).toBeVisible();

      await page.keyboard.press('ArrowLeft');
      await expect(secondMenu).toBeHidden();
      await expect(firstMenu).toBeVisible();
      activeId = await page.evaluate(() => document.activeElement?.id);
      expect(activeId).toBe(await firstTrigger.getAttribute('id'));

      await page.keyboard.press('ArrowDown');
      await expect(firstMenu).toBeVisible();

      await page.keyboard.press('ArrowLeft');
      await expect(firstMenu).toBeHidden();
      await expect(lastMenu).toBeVisible();
      activeId = await page.evaluate(() => document.activeElement?.id);
      expect(activeId).toBe(await lastTrigger.getAttribute('id'));
    });

    test('Pressing ArrowRight on a submenu item without a child submenu closes the open hierarchy and previews the next top-level menu with focus on its trigger', async ({ page }) => {
      const triggers = page.locator('[role="menubar"] > button');
      await expect(triggers.first()).toBeAttached();
      const count = await triggers.count();
      expect(count).toBeGreaterThanOrEqual(2);

      const firstTrigger = triggers.nth(0);
      const secondTrigger = triggers.nth(1);
      const firstCmdFor = await firstTrigger.getAttribute('commandfor');
      const secondCmdFor = await secondTrigger.getAttribute('commandfor');
      expect(firstCmdFor).toBeTruthy();
      expect(secondCmdFor).toBeTruthy();

      const firstMenu = page.locator(`#${firstCmdFor}`);
      const secondMenu = page.locator(`#${secondCmdFor}`);

      await firstTrigger.focus();
      await page.keyboard.press('ArrowDown');
      await expect(firstMenu).toBeVisible();

      const existingSubmenuTrigger = firstMenu.locator('button[aria-haspopup="menu"], [commandfor]').first();
      const hasExistingSubmenu = (await existingSubmenuTrigger.count()) > 0;

      if (hasExistingSubmenu) {
        const subCmdFor = await existingSubmenuTrigger.getAttribute('commandfor');
        expect(subCmdFor).toBeTruthy();
        const subMenu = page.locator(`#${subCmdFor}`);

        await existingSubmenuTrigger.focus();
        await page.keyboard.press('ArrowRight');
        await expect(subMenu).toBeVisible();

        const leafItem = subMenu.locator('button:not([aria-haspopup="menu"]):not([commandfor]), a[href]').first();
        await expect(leafItem).toBeAttached();
        await leafItem.focus();

        await page.keyboard.press('ArrowRight');

        await expect(subMenu).toBeHidden();
        await expect(firstMenu).toBeHidden();
        await expect(secondMenu).toBeVisible();
        const activeId = await page.evaluate(() => document.activeElement?.id);
        expect(activeId).toBe(await secondTrigger.getAttribute('id'));
      } else {
        await page.evaluate((menuId) => {
          const parentMenu = document.getElementById(menuId);
          if (!parentMenu) return;
          const sub = document.createElement('div');
          sub.id = 'test-dynamic-submenu';
          sub.setAttribute('popover', 'auto');
          const group = document.createElement('div');
          group.setAttribute('focusgroup', 'menu nomemory');
          const item = document.createElement('button');
          item.id = 'test-dynamic-sub-item';
          item.type = 'button';
          item.textContent = 'Sub item';
          group.appendChild(item);
          sub.appendChild(group);
          parentMenu.appendChild(sub);
          try {
            sub.showPopover();
          } catch {}
          item.focus();
        }, firstCmdFor!);

        const dynamicItem = page.locator('#test-dynamic-sub-item');
        await expect(dynamicItem).toBeAttached();

        await page.keyboard.press('ArrowRight');

        await expect(firstMenu).toBeHidden();
        await expect(secondMenu).toBeVisible();
        const activeId = await page.evaluate(() => document.activeElement?.id);
        expect(activeId).toBe(await secondTrigger.getAttribute('id'));
      }
    });

    test('While a top-level menu is open, moving the pointer over a different top-level trigger closes the open menu and previews the hovered one with focus on that trigger and no :focus-visible match; with no menu open, hovering a trigger does nothing', async ({ page }) => {
      const triggers = page.locator('[role="menubar"] > button');
      await expect(triggers.first()).toBeAttached();
      const count = await triggers.count();
      expect(count).toBeGreaterThanOrEqual(2);

      const firstTrigger = triggers.nth(0);
      const secondTrigger = triggers.nth(1);
      const firstCmdFor = await firstTrigger.getAttribute('commandfor');
      const secondCmdFor = await secondTrigger.getAttribute('commandfor');
      expect(firstCmdFor).toBeTruthy();
      expect(secondCmdFor).toBeTruthy();

      const firstMenu = page.locator(`#${firstCmdFor}`);
      const secondMenu = page.locator(`#${secondCmdFor}`);

      await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
      await expect(firstMenu).toBeHidden();
      await expect(secondMenu).toBeHidden();

      await secondTrigger.hover();
      await page.waitForTimeout(500);
      await expect(secondMenu).toBeHidden();
      await expect(secondTrigger).toHaveAttribute('aria-expanded', 'false');

      await firstTrigger.click();
      await expect(firstMenu).toBeVisible();

      await secondTrigger.hover();
      await expect(firstMenu).toBeHidden();
      await expect(secondMenu).toBeVisible();

      const activeId = await page.evaluate(() => document.activeElement?.id);
      expect(activeId).toBe(await secondTrigger.getAttribute('id'));

      const matchesFocusVisible = await secondTrigger.evaluate((el) => el.matches(':focus-visible'));
      expect(matchesFocusVisible).toBe(false);
    });

    test('Pressing Tab from a top-level trigger or from inside an open menu closes all open menus and leaves the menubar instead of stepping through every trigger or command', async ({ page }) => {
      const menubar = page.locator('[role="menubar"]');
      await expect(menubar).toBeAttached();
      const triggers = page.locator('[role="menubar"] > button');
      const firstTrigger = triggers.first();
      const commandFor = await firstTrigger.getAttribute('commandfor');
      expect(commandFor).toBeTruthy();
      const menu = page.locator(`#${commandFor}`);

      await firstTrigger.focus();
      await expect(menu).toBeVisible();

      await page.keyboard.press('Tab');
      await expect(menu).toBeHidden();
      const isOutsideFromTrigger = await page.evaluate(() => {
        const bar = document.querySelector('[role="menubar"]');
        return !bar || !bar.contains(document.activeElement);
      });
      expect(isOutsideFromTrigger).toBe(true);

      await firstTrigger.focus();
      await page.keyboard.press('ArrowDown');
      await expect(menu).toBeVisible();
      const isInside = await page.evaluate((cmdFor) => {
        const m = document.getElementById(cmdFor);
        return Boolean(m && m.contains(document.activeElement));
      }, commandFor!);
      expect(isInside).toBe(true);

      await page.keyboard.press('Tab');
      await expect(menu).toBeHidden();
      const isOutsideFromMenu = await page.evaluate(() => {
        const bar = document.querySelector('[role="menubar"]');
        return !bar || !bar.contains(document.activeElement);
      });
      expect(isOutsideFromMenu).toBe(true);
    });

  });
});
