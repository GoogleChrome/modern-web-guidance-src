import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';
import type { Page } from '@playwright/test';
import { SyntaxKind, type Project } from 'ts-morph';
import type { Document } from 'linkedom';
import {
  resolveSelector,
  getPropertyValues,
  CSSStyleRule,
  CSSContainerRule,
  CSSMediaRule,
} from 'cssomnom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

async function waitForFrames(page: Page, count = 5): Promise<void> {
  await page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, count);
}

test.describe('navbar Target Grader', () => {
  test('The mobile navigation trigger is a native <button> element with type="button" and links to the popover menu element using declarative popovertarget and aria-controls attributes', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const navButtons = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('nav button[type="button"][popovertarget][aria-controls]')),
    );
    expect(navButtons.length).toBeGreaterThan(0);

    const hasValidTrigger = navButtons.some((btn) => {
      const popoverTarget = btn.getAttribute('popovertarget');
      const ariaControls = btn.getAttribute('aria-controls');
      if (!popoverTarget || popoverTarget !== ariaControls) return false;
      const targetEl = btn.ownerDocument?.getElementById(popoverTarget);
      return Boolean(targetEl && targetEl.getAttribute('popover') === 'auto');
    });
    expect(hasValidTrigger).toBe(true);
  });

  test('The navigation tree does not use focusgroup, role="menu", role="menuitem", role="menubar" or aria-haspopup="menu"', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const navElements = docs.flatMap((d) => Array.from(d.document.querySelectorAll('nav')));
    expect(navElements.length).toBeGreaterThan(0);

    // Ensure the navigation has been upgraded with the mobile popover trigger so baseline does not vacuously pass
    const hasMobileTrigger = navElements.some((nav) =>
      Boolean(nav.querySelector('button[popovertarget][aria-controls]')),
    );
    expect(hasMobileTrigger).toBe(true);

    const hasForbiddenMarkup = navElements.some((nav) => {
      if (
        nav.hasAttribute('focusgroup') ||
        ['menu', 'menuitem', 'menubar'].includes(nav.getAttribute('role') || '') ||
        nav.getAttribute('aria-haspopup') === 'menu'
      ) {
        return true;
      }
      return Boolean(
        nav.querySelector(
          '[focusgroup], [role="menu"], [role="menuitem"], [role="menubar"], [aria-haspopup="menu"]',
        ),
      );
    });
    expect(hasForbiddenMarkup).toBe(false);
  });

  test('The collapsed layout is chosen by measuring whether the inline row overflows, not by a hard-coded width such as a 45rem container query', () => {
    const styleRules = getRules(targetFiles, CSSStyleRule);
    const containerRules = getRules(targetFiles, CSSContainerRule);
    const mediaRules = getRules(targetFiles, CSSMediaRule);

    expect(styleRules.length).toBeGreaterThan(0);

    // Ensure no @container width query or @media width query drives the navbar collapse
    const hasHardcodedContainerQuery = containerRules.some((r) =>
      /\b(min-width|max-width|min-inline-size|max-inline-size|width|inline-size)\b/i.test(r.conditionText),
    );
    expect(hasHardcodedContainerQuery).toBe(false);

    const hasHardcodedMediaWidthQuery = mediaRules.some((r) =>
      /\b(min-width|max-width|min-inline-size|max-inline-size|width|inline-size)\b/i.test(r.conditionText),
    );
    expect(hasHardcodedMediaWidthQuery).toBe(false);

    // Verify JS measures scrollWidth and clientWidth (or getBoundingClientRect) with ResizeObserver
    const project: Project = getJsProject(targetFiles);
    const propAccesses = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression))
      .map((pa) => pa.getName());

    const identifiers = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.Identifier))
      .map((id) => id.getText());

    expect(propAccesses).toContain('scrollWidth');
    expect(propAccesses).toContain('clientWidth');
    expect(identifiers).toContain('ResizeObserver');
  });

  test('Second-level navigation triggers are <button> elements with aria-expanded and aria-controls, not <details>/<summary>', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const navElements = docs.flatMap((d) => Array.from(d.document.querySelectorAll('nav')));
    expect(navElements.length).toBeGreaterThan(0);

    // Ensure the navigation has been upgraded (so baseline does not vacuously pass)
    const hasMobileTrigger = navElements.some((nav) =>
      Boolean(nav.querySelector('button[popovertarget][aria-controls]')),
    );
    expect(hasMobileTrigger).toBe(true);

    // Must not use <details> or <summary> inside <nav>
    const detailsOrSummary = navElements.flatMap((nav) =>
      Array.from(nav.querySelectorAll('details, summary')),
    );
    expect(detailsOrSummary.length).toBe(0);

    // Any second-level navigation triggers inside the navigation list must be <button> elements with aria-expanded and aria-controls
    const submenuButtons = navElements.flatMap((nav) =>
      Array.from(nav.querySelectorAll('ul button, ol button, li button')),
    );
    for (const btn of submenuButtons) {
      expect(btn.hasAttribute('aria-expanded')).toBe(true);
      const controls = btn.getAttribute('aria-controls');
      expect(Boolean(controls)).toBe(true);
    }
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('In a container too narrow for the links to fit inline, the navigation list is a native popover (popover="auto") positioned relative to the trigger button with CSS Anchor Positioning (anchor-name and anchor())', async ({
      page,
    }) => {
      const styleRules = getRules(targetFiles, CSSStyleRule);
      const hasAnchorName = styleRules.some((r) =>
        getPropertyValues(r, 'anchor-name').some((v) => v.trim().startsWith('--')),
      );
      const hasAnchorFn = styleRules.some((r) =>
        [
          ...getPropertyValues(r, 'inset-block-start'),
          ...getPropertyValues(r, 'top'),
          ...getPropertyValues(r, 'inset'),
        ].some((v) => v.includes('anchor(')),
      );
      expect(hasAnchorName).toBe(true);
      expect(hasAnchorFn).toBe(true);

      await page.setViewportSize({ width: 360, height: 640 });
      await waitForFrames(page, 5);

      const narrowState = await page.evaluate(async () => {
        const trigger = document.querySelector<HTMLButtonElement>('nav button[popovertarget]');
        if (!trigger) return null;
        const targetId = trigger.getAttribute('popovertarget') || trigger.getAttribute('aria-controls');
        const menu = targetId ? document.getElementById(targetId) : null;
        if (!menu) return null;

        const popoverAttr = menu.getAttribute('popover');
        const triggerDisplay = window.getComputedStyle(trigger).display;
        trigger.click();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

        const isOpen = menu.matches(':popover-open');
        const triggerRect = trigger.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        const menuPosition = window.getComputedStyle(menu).position;

        return {
          popoverAttr,
          triggerDisplay,
          isOpen,
          menuPosition,
          triggerBottom: triggerRect.bottom,
          menuTop: menuRect.top,
        };
      });

      expect(narrowState).not.toBeNull();
      expect(narrowState!.popoverAttr).toBe('auto');
      expect(narrowState!.triggerDisplay).not.toBe('none');
      expect(narrowState!.isOpen).toBe(true);
      expect(narrowState!.menuPosition).toBe('fixed');
      expect(narrowState!.menuTop).toBeGreaterThanOrEqual(narrowState!.triggerBottom - 2);
    });

    test('In a container wide enough for the links to fit inline, the trigger button is not displayed and the navigation list is laid out as a static, horizontal inline list without the popover attribute', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await waitForFrames(page, 5);

      const wideState = await page.evaluate(async () => {
        const trigger = document.querySelector<HTMLButtonElement>('nav button[popovertarget]');
        if (!trigger) return null;
        const targetId = trigger.getAttribute('popovertarget') || trigger.getAttribute('aria-controls');
        const menu = targetId ? document.getElementById(targetId) : null;
        if (!menu) return null;

        const triggerDisplay = window.getComputedStyle(trigger).display;
        const menuStyle = window.getComputedStyle(menu);
        const hasPopover = menu.hasAttribute('popover');
        const items = Array.from(menu.children) as HTMLElement[];
        const itemRects = items.map((el) => el.getBoundingClientRect());

        return {
          triggerDisplay,
          menuPosition: menuStyle.position,
          menuDisplay: menuStyle.display,
          hasPopover,
          itemRects,
        };
      });

      expect(wideState).not.toBeNull();
      expect(wideState!.triggerDisplay).toBe('none');
      expect(wideState!.hasPopover).toBe(false);
      expect(wideState!.menuPosition).toBe('static');
      expect(wideState!.itemRects.length).toBeGreaterThan(1);
      // Verify horizontal inline layout: subsequent items are to the right of earlier items
      expect(wideState!.itemRects[1].left).toBeGreaterThanOrEqual(wideState!.itemRects[0].right - 2);
    });

    test('The current page link uses [aria-current="page"] as its styling hook, and the attribute is present on that link', async ({
      page,
    }) => {
      const styleRules = getRules(targetFiles, CSSStyleRule);
      const hasAriaCurrentRule = styleRules.some((r) => {
        const sel = resolveSelector(r) || r.selectorText;
        return /\[aria-current\s*=\s*["']?page["']?\]/.test(sel);
      });
      expect(hasAriaCurrentRule).toBe(true);

      const hasCurrentLink = await page.evaluate(() => {
        const headerOrNav = document.querySelector('header, nav');
        if (!headerOrNav) return false;
        const currentLink = headerOrNav.querySelector('a[aria-current="page"]');
        if (currentLink) return true;

        // If the current path is '/' and the links in the nav are '/menu', '/locations', etc.,
        // check if navigating or matching a nav link's path sets aria-current="page"
        return false;
      });

      if (!hasCurrentLink) {
        // Navigate to /menu or intercept /menu to serve the same document so JS path matching marks /menu as aria-current="page"
        await page.route('**/menu', async (route) => {
          const response = await route.fetch({ url: page.url() });
          await route.fulfill({ response });
        });
        await page.goto(new URL('/menu', page.url()).href);
      }

      const currentLinkCount = await page.locator('header a[aria-current="page"], nav a[aria-current="page"]').count();
      expect(currentLinkCount).toBeGreaterThan(0);
    });

    test('On wide layouts, each nested submenu is a popover="auto" opened by its trigger\'s popovertarget and positioned relative to the trigger with CSS Anchor Positioning', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await waitForFrames(page, 5);

      const result = await page.evaluate(async () => {
        const nav = document.querySelector('nav');
        if (!nav) return { upgraded: false, submenuCount: 0, allValid: false };
        const mobileTrigger = nav.querySelector('button[popovertarget][aria-controls]');
        if (!mobileTrigger) return { upgraded: false, submenuCount: 0, allValid: false };

        const submenuTriggers = Array.from(
          nav.querySelectorAll<HTMLButtonElement>('ul button[aria-controls], ol button[aria-controls], li button[aria-controls]'),
        );
        if (submenuTriggers.length === 0) {
          return { upgraded: true, submenuCount: 0, allValid: true };
        }

        for (const trigger of submenuTriggers) {
          const targetId = trigger.getAttribute('popovertarget');
          const controlsId = trigger.getAttribute('aria-controls');
          if (!targetId || targetId !== controlsId) {
            return { upgraded: true, submenuCount: submenuTriggers.length, allValid: false };
          }
          const submenu = document.getElementById(targetId);
          if (!submenu || submenu.getAttribute('popover') !== 'auto') {
            return { upgraded: true, submenuCount: submenuTriggers.length, allValid: false };
          }
        }
        return { upgraded: true, submenuCount: submenuTriggers.length, allValid: true };
      });

      expect(result.upgraded).toBe(true);
      expect(result.allValid).toBe(true);

      if (result.submenuCount > 0) {
        const styleRules = getRules(targetFiles, CSSStyleRule);
        const hasSubmenuAnchor = styleRules.some(
          (r) =>
            getPropertyValues(r, 'position-area').length > 0 ||
            getPropertyValues(r, 'inset-area').length > 0 ||
            getPropertyValues(r, 'inset-block-start').some((v) => v.includes('anchor(')) ||
            getPropertyValues(r, 'top').some((v) => v.includes('anchor(')),
        );
        expect(hasSubmenuAnchor).toBe(true);
      }
    });

    test('A submenu trigger\'s aria-expanded is true while its submenu is open and false while it is closed', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await waitForFrames(page, 5);

      const submenuResult = await page.evaluate(async () => {
        const nav = document.querySelector('nav');
        if (!nav) return { upgraded: false, tested: false, passed: false };
        const mobileTrigger = nav.querySelector('button[popovertarget][aria-controls]');
        if (!mobileTrigger) return { upgraded: false, tested: false, passed: false };

        const trigger = nav.querySelector<HTMLButtonElement>(
          'ul button[aria-controls], ol button[aria-controls], li button[aria-controls]',
        );
        if (!trigger) {
          return { upgraded: true, tested: false, passed: true };
        }

        const initialExpanded = trigger.getAttribute('aria-expanded');
        if (initialExpanded !== 'false') {
          return { upgraded: true, tested: true, passed: false };
        }

        trigger.click();
        await new Promise((r) => setTimeout(r, 50));
        const openExpanded = trigger.getAttribute('aria-expanded');

        trigger.click();
        await new Promise((r) => setTimeout(r, 50));
        const closedExpanded = trigger.getAttribute('aria-expanded');

        return {
          upgraded: true,
          tested: true,
          passed: openExpanded === 'true' && closedExpanded === 'false',
        };
      });

      expect(submenuResult.upgraded).toBe(true);
      expect(submenuResult.passed).toBe(true);
    });

    test('When the viewport width changes while the collapsed navigation menu is open and the layout stays collapsed, the menu stays open', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 340, height: 640 });
      await waitForFrames(page, 5);

      const opened = await page.evaluate(async () => {
        const trigger = document.querySelector<HTMLButtonElement>('nav button[popovertarget]');
        if (!trigger) return false;
        const targetId = trigger.getAttribute('popovertarget') || trigger.getAttribute('aria-controls');
        const menu = targetId ? document.getElementById(targetId) : null;
        if (!menu) return false;

        trigger.click();
        for (let i = 0; i < 3; i++) {
          await new Promise((r) => requestAnimationFrame(r));
        }
        return menu.matches(':popover-open');
      });

      expect(opened).toBe(true);

      // Increase viewport width slightly so ResizeObserver re-measures while still staying collapsed
      await page.setViewportSize({ width: 380, height: 640 });
      await waitForFrames(page, 5);

      const stillOpenAfterGrow = await page.evaluate(async () => {
        const trigger = document.querySelector<HTMLButtonElement>('nav button[popovertarget]');
        if (!trigger) return false;
        const targetId = trigger.getAttribute('popovertarget') || trigger.getAttribute('aria-controls');
        const menu = targetId ? document.getElementById(targetId) : null;
        if (!menu) return false;
        return menu.matches(':popover-open') && menu.getAttribute('popover') === 'auto';
      });

      expect(stillOpenAfterGrow).toBe(true);
    });
  });
});
