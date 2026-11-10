import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import type { Document, Element } from 'linkedom';
import { CSSStyleRule } from 'cssomnom';

// @ts-ignore - package.json does not specify "type": "module", causing TS1470 under --module nodenext
const targetFiles: string[] = getTargetFiles(import.meta.url);

function findToolbar(docs: Array<{ file: string; document: Document }>): Element | null {
  for (const { document } of docs) {
    const byId = document.querySelector('#favorites-actions');
    if (byId) return byId;
    const byRole = document.querySelector('[role="toolbar"]');
    if (byRole) return byRole;
  }
  return null;
}

test.describe('toolbar Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('The toolbar container has role="toolbar"', () => {
    const docs = getHtmlDocuments(targetFiles);
    const toolbar = findToolbar(docs);
    expect(toolbar).not.toBeNull();
    expect(toolbar!.getAttribute('role')).toBe('toolbar');
  });

  test('The toolbar container has a non-empty aria-label', () => {
    const docs = getHtmlDocuments(targetFiles);
    const toolbar = findToolbar(docs);
    expect(toolbar).not.toBeNull();
    const label = toolbar!.getAttribute('aria-label')?.trim() ?? '';
    expect(label.length).toBeGreaterThan(0);
  });

  test('Related toolbar controls are wrapped in role="group" elements that each have a non-empty aria-label', () => {
    const docs = getHtmlDocuments(targetFiles);
    const toolbar = findToolbar(docs);
    expect(toolbar).not.toBeNull();
    const groups = Array.from(toolbar!.querySelectorAll('[role="group"]'));
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      const label = group.getAttribute('aria-label')?.trim() ?? '';
      expect(label.length).toBeGreaterThan(0);
      const controls = group.querySelectorAll('button, [role="button"], input, select');
      expect(controls.length).toBeGreaterThan(0);
    }
  });

  test('Adjacent role="group" elements in the toolbar are divided by an element with role="separator"', () => {
    const docs = getHtmlDocuments(targetFiles);
    const toolbar = findToolbar(docs);
    expect(toolbar).not.toBeNull();
    const groups = Array.from(toolbar!.querySelectorAll('[role="group"]'));
    const separators = Array.from(toolbar!.querySelectorAll('[role="separator"]'));
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(separators.length).toBeGreaterThan(0);

    const children = Array.from(toolbar!.children);
    const groupIndices = groups.map((g) => children.indexOf(g)).filter((idx) => idx !== -1);
    expect(groupIndices.length).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < groupIndices.length - 1; i++) {
      const between = children.slice(groupIndices[i] + 1, groupIndices[i + 1]);
      const hasSeparatorBetween = between.some(
        (el) => el.getAttribute('role') === 'separator' || Boolean(el.querySelector('[role="separator"]'))
      );
      expect(hasSeparatorBetween).toBe(true);
    }
  });

  test('Every icon-only toolbar button has a non-empty aria-label', () => {
    const docs = getHtmlDocuments(targetFiles);
    const toolbar = findToolbar(docs);
    expect(toolbar).not.toBeNull();
    const buttons = Array.from(toolbar!.querySelectorAll('button, [role="button"]'));
    expect(buttons.length).toBeGreaterThan(0);

    const iconOnlyButtons = buttons.filter((btn) => {
      const clone = btn.cloneNode(true) as Element;
      clone.querySelectorAll('svg, img, [aria-hidden="true"]').forEach((el) => el.remove());
      return (clone.textContent?.trim() ?? '').length === 0;
    });
    expect(iconOnlyButtons.length).toBeGreaterThan(0);

    for (const btn of iconOnlyButtons) {
      const label = btn.getAttribute('aria-label')?.trim() ?? '';
      expect(label.length).toBeGreaterThan(0);
    }
  });

  test('The toolbar container has a focusgroup attribute whose value includes toolbar', () => {
    const docs = getHtmlDocuments(targetFiles);
    const toolbar = findToolbar(docs);
    expect(toolbar).not.toBeNull();
    const focusgroup = toolbar!.getAttribute('focusgroup') ?? '';
    expect(/\btoolbar\b/.test(focusgroup)).toBe(true);
  });

  test('Action buttons that have no on/off state do not have an aria-pressed attribute', () => {
    const docs = getHtmlDocuments(targetFiles);
    const toolbar = findToolbar(docs);
    expect(toolbar).not.toBeNull();
    const buttons = Array.from(toolbar!.querySelectorAll('button, [role="button"]'));
    expect(buttons.length).toBeGreaterThan(0);

    const nonMenuButtons = buttons.filter(
      (btn) => !btn.hasAttribute('aria-haspopup') && !btn.hasAttribute('popovertarget')
    );
    const actionButtons = nonMenuButtons.filter((btn) => !btn.hasAttribute('aria-pressed'));
    expect(actionButtons.length).toBeGreaterThan(0);
  });

  test('In a horizontal toolbar, when popover="hint" tooltips are present, each hint is positioned along the block axis with position-area (block-end or block-start), not the inline axis', () => {
    const docs = getHtmlDocuments(targetFiles);
    const toolbar = findToolbar(docs);
    expect(toolbar).not.toBeNull();

    const collectStyleRules = (rules: Iterable<any>): CSSStyleRule[] => {
      const result: CSSStyleRule[] = [];
      for (const r of rules) {
        if (r instanceof CSSStyleRule) result.push(r);
        else if ('cssRules' in r && r.cssRules) result.push(...collectStyleRules(r.cssRules));
      }
      return result;
    };

    const stylesheet = getCssStyleSheet(targetFiles);
    const hintRules = collectStyleRules(stylesheet.cssRules).filter(
      (r) => r.selectorText.includes('popover="hint"') || r.selectorText.includes("popover='hint'")
    );
    expect(hintRules.length).toBeGreaterThan(0);

    const posAreas = hintRules
      .map((r) => r.style.getPropertyValue('position-area').trim())
      .filter(Boolean);
    expect(posAreas.length).toBeGreaterThan(0);

    for (const posArea of posAreas) {
      expect(/\bblock-(end|start)\b/.test(posArea)).toBe(true);
      expect(/\binline-(end|start)\b/.test(posArea)).toBe(false);
    }
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Pressing Tab from the first toolbar item moves focus out of the toolbar rather than to the next item', async ({
      page,
    }) => {
      const toolbar = page.locator('#favorites-actions, [role="toolbar"]').first();
      await expect(toolbar).toBeVisible();

      const buttons = toolbar.locator('button, [role="button"]');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(1);

      await buttons.first().focus();
      await page.keyboard.press('Tab');

      const focusStillInToolbar = await toolbar.evaluate((bar) => bar.contains(document.activeElement));
      expect(focusStillInToolbar).toBe(false);
    });

    test('In a horizontal toolbar, pressing ArrowRight on an item moves focus to the next item', async ({
      page,
    }) => {
      const toolbar = page.locator('#favorites-actions, [role="toolbar"]').first();
      await expect(toolbar).toBeVisible();

      const buttons = toolbar.locator('button, [role="button"]');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(1);

      await buttons.first().focus();
      await page.keyboard.press('ArrowRight');

      const activeIndex = await toolbar.evaluate((bar) => {
        const items = Array.from(bar.querySelectorAll('button, [role="button"]'));
        return items.indexOf(document.activeElement as globalThis.Element);
      });
      expect(activeIndex).toBe(1);
    });

    test('Pressing Home on a toolbar item moves focus to the first item', async ({ page }) => {
      const toolbar = page.locator('#favorites-actions, [role="toolbar"]').first();
      await expect(toolbar).toBeVisible();

      const buttons = toolbar.locator('button, [role="button"]');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(1);

      await buttons.nth(1).focus();
      await page.keyboard.press('Home');

      const activeIndex = await toolbar.evaluate((bar) => {
        const items = Array.from(bar.querySelectorAll('button, [role="button"]'));
        return items.indexOf(document.activeElement as globalThis.Element);
      });
      expect(activeIndex).toBe(0);
    });

    test('Clicking a toggle button that is not part of a mutually exclusive set flips its aria-pressed value between true and false', async ({
      page,
    }) => {
      const toolbar = page.locator('#favorites-actions, [role="toolbar"]').first();
      await expect(toolbar).toBeVisible();

      const result = await toolbar.evaluate((bar) => {
        const toggleButtons = Array.from(
          bar.querySelectorAll<HTMLElement>(
            'button[aria-pressed]:not([aria-disabled="true"]), [role="button"][aria-pressed]:not([aria-disabled="true"])'
          )
        );
        for (const btn of toggleButtons) {
          const initial = btn.getAttribute('aria-pressed');
          btn.click();
          const afterFirst = btn.getAttribute('aria-pressed');
          if (afterFirst !== null && afterFirst !== initial) {
            btn.click();
            const afterSecond = btn.getAttribute('aria-pressed');
            if (afterSecond === initial) {
              return { hasIndependentToggle: true, flippedBothWays: true };
            }
          }
        }
        return { hasIndependentToggle: false, flippedBothWays: false };
      });

      expect(result.hasIndependentToggle).toBe(true);
      expect(result.flippedBothWays).toBe(true);
    });

    test('In a browser that supports interest invokers and anchor positioning, each icon-only toolbar button upgrades its title tooltip at runtime to an interestfor attribute referencing an element with popover="hint", or retains its non-empty title where unsupported', async ({
      page,
    }) => {
      const toolbar = page.locator('#favorites-actions, [role="toolbar"]').first();
      await expect(toolbar).toBeVisible();

      const check = await page.evaluate(() => {
        const bar = document.querySelector('#favorites-actions, [role="toolbar"]');
        if (!bar) return { hasToolbar: false, valid: false };

        const supportsUpgrade =
          'interestForElement' in HTMLButtonElement.prototype &&
          typeof CSS !== 'undefined' &&
          CSS.supports('position-area', 'block-end');

        const buttons = Array.from(bar.querySelectorAll('button, [role="button"]'));
        if (buttons.length === 0) return { hasToolbar: true, valid: false };

        const iconOnlyButtons = buttons.filter((btn) => {
          const clone = btn.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('svg, img, [aria-hidden="true"]').forEach((el) => el.remove());
          return (clone.textContent?.trim() ?? '').length === 0;
        });
        if (iconOnlyButtons.length === 0) return { hasToolbar: true, valid: false };

        for (const btn of iconOnlyButtons) {
          if (supportsUpgrade) {
            const interestId = btn.getAttribute('interestfor');
            if (!interestId || btn.hasAttribute('title')) {
              return { hasToolbar: true, valid: false };
            }
            const hint = document.getElementById(interestId);
            if (!hint || hint.getAttribute('popover') !== 'hint' || bar.contains(hint)) {
              return { hasToolbar: true, valid: false };
            }
          } else {
            const title = btn.getAttribute('title')?.trim() ?? '';
            if (!title) {
              return { hasToolbar: true, valid: false };
            }
          }
        }

        return { hasToolbar: true, valid: true };
      });

      expect(check.hasToolbar).toBe(true);
      expect(check.valid).toBe(true);
    });

    test('No tooltip element or its invoker button sets role="tooltip", aria-describedby, or aria-details manually', async ({
      page,
    }) => {
      const toolbar = page.locator('#favorites-actions, [role="toolbar"]').first();
      await expect(toolbar).toBeVisible();

      const check = await page.evaluate(() => {
        const bar = document.querySelector('#favorites-actions, [role="toolbar"]');
        if (!bar) return { hasToolbar: false, manualTooltipAttrs: true };

        const buttons = Array.from(bar.querySelectorAll('button, [role="button"]'));
        const tooltips = Array.from(document.querySelectorAll('[popover="hint"], [role="tooltip"]'));

        const hasForbiddenOnButton = buttons.some(
          (b) =>
            b.getAttribute('role') === 'tooltip' ||
            b.hasAttribute('aria-describedby') ||
            b.hasAttribute('aria-details')
        );
        const hasForbiddenOnTooltip = tooltips.some(
          (t) =>
            t.getAttribute('role') === 'tooltip' ||
            t.hasAttribute('aria-describedby') ||
            t.hasAttribute('aria-details')
        );

        return {
          hasToolbar: buttons.length > 0,
          manualTooltipAttrs: hasForbiddenOnButton || hasForbiddenOnTooltip,
        };
      });

      expect(check.hasToolbar).toBe(true);
      expect(check.manualTooltipAttrs).toBe(false);
    });
  });
});
