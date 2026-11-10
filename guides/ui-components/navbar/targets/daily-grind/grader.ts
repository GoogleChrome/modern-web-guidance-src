import {
  test,
  expect,
  getTargetFiles,
  getHtmlDocuments,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';
import type { Document } from 'linkedom';
import {
  resolveSelector,
  getPropertyValues,
  CSSStyleRule,
} from 'cssomnom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

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

  test('The navigation tree does not use focusgroup, role="menu", role="menuitem", role="menubar" or aria-haspopup="menu"', async ({
    page,
    TARGET_URL,
  }) => {
    const forbiddenSelector =
      '[focusgroup], [role="menu"], [role="menuitem"], [role="menubar"], [aria-haspopup="menu"]';
    const hasForbiddenInNav = (nav: {
      hasAttribute(name: string): boolean;
      getAttribute(name: string): string | null;
      querySelector(sel: string): unknown;
    }) =>
      nav.hasAttribute('focusgroup') ||
      ['menu', 'menuitem', 'menubar'].includes(nav.getAttribute('role') || '') ||
      nav.getAttribute('aria-haspopup') === 'menu' ||
      Boolean(nav.querySelector(forbiddenSelector));

    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const navElements = docs.flatMap((d) => Array.from(d.document.querySelectorAll('nav')));
    expect(navElements.length).toBeGreaterThan(0);
    expect(
      navElements.some((nav) => Boolean(nav.querySelector('button[popovertarget][aria-controls]'))),
    ).toBe(true);
    expect(navElements.some(hasForbiddenInNav)).toBe(false);

    await page.goto(TARGET_URL);
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await expect.poll(() =>
        page.evaluate((sel) => {
          const navs = Array.from(document.querySelectorAll('nav'));
          if (navs.length === 0) return null;
          return navs.some(
            (nav) =>
              nav.hasAttribute('focusgroup') ||
              ['menu', 'menuitem', 'menubar'].includes(nav.getAttribute('role') || '') ||
              nav.getAttribute('aria-haspopup') === 'menu' ||
              Boolean(nav.querySelector(sel)),
          );
        }, forbiddenSelector),
      ).toBe(false);
    }
  });

  test('The collapsed layout is chosen by measuring whether the inline row overflows, not by a hard-coded width such as a 45rem container query', async ({
    page,
    TARGET_URL,
  }) => {
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.goto(TARGET_URL);

    const readLayoutMode = () =>
      page.evaluate(() => {
        const trigger = document.querySelector<HTMLButtonElement>(
          'nav button[popovertarget]:not(ul *, ol *)',
        );
        if (!trigger) return 'missing';
        const targetId = trigger.getAttribute('popovertarget') || trigger.getAttribute('aria-controls');
        const menu = targetId ? document.getElementById(targetId) : null;
        if (!menu) return 'missing';
        const triggerHidden = window.getComputedStyle(trigger).display === 'none';
        const hasPopover = menu.hasAttribute('popover');
        if (triggerHidden && !hasPopover) return 'inline';
        if (!triggerHidden && menu.getAttribute('popover') === 'auto') return 'collapsed';
        return 'transitional';
      });

    // 1. Default links fit inline at 1000px
    await expect.poll(readLayoutMode).toBe('inline');

    // 2. Widen the inline nav items and grow viewport to 1001px (+1px wider, so no fixed width
    //    breakpoint <= 1000px could switch from inline to collapsed) -> must collapse on overflow
    await page.evaluate(() => {
      const trigger = document.querySelector<HTMLButtonElement>(
        'nav button[popovertarget]:not(ul *, ol *)',
      );
      const targetId = trigger?.getAttribute('popovertarget') || trigger?.getAttribute('aria-controls');
      const menu = targetId ? document.getElementById(targetId) : null;
      const links = Array.from(
        menu?.querySelectorAll<HTMLElement>(':scope > li > a, :scope > li > button') || [],
      );
      for (const link of links) {
        link.dataset.origText = link.textContent || '';
        link.textContent = `${link.dataset.origText} — Artisanal Single-Origin Reserve`;
      }
    });
    await page.setViewportSize({ width: 1001, height: 800 });
    await expect.poll(readLayoutMode).toBe('collapsed');

    // 3. Restore original link text and grow viewport by +1px to 1002px -> fits inline again
    await page.evaluate(() => {
      const trigger = document.querySelector<HTMLButtonElement>(
        'nav button[popovertarget]:not(ul *, ol *)',
      );
      const targetId = trigger?.getAttribute('popovertarget') || trigger?.getAttribute('aria-controls');
      const menu = targetId ? document.getElementById(targetId) : null;
      const links = Array.from(
        menu?.querySelectorAll<HTMLElement>(':scope > li > a, :scope > li > button') || [],
      );
      for (const link of links) {
        if (link.dataset.origText !== undefined) {
          link.textContent = link.dataset.origText;
          delete link.dataset.origText;
        }
      }
    });
    await page.setViewportSize({ width: 1002, height: 800 });
    await expect.poll(readLayoutMode).toBe('inline');
  });

  test('Second-level navigation triggers are <button> elements with aria-expanded and aria-controls, not <details>/<summary>', async ({
    page,
    TARGET_URL,
  }) => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const navElements = docs.flatMap((d) => Array.from(d.document.querySelectorAll('nav')));
    expect(navElements.length).toBeGreaterThan(0);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(TARGET_URL);

    await expect.poll(() =>
      page.evaluate(() => {
        const navs = Array.from(document.querySelectorAll('nav'));
        const upgraded = navs.some((nav) =>
          Boolean(nav.querySelector('button[popovertarget][aria-controls]')),
        );
        if (!upgraded) return { upgraded: false, valid: false };

        const hasDetailsOrSummary = navs.some((nav) =>
          Boolean(nav.querySelector('details, summary')),
        );
        if (hasDetailsOrSummary) return { upgraded: true, valid: false };

        // Every nested navigation list must be controlled by a <button> in its parent <li>
        const nestedLists = navs.flatMap((nav) =>
          Array.from(nav.querySelectorAll<HTMLElement>('ul ul, ul ol, ol ul, ol ol')),
        );
        if (nestedLists.length === 0) return { upgraded: true, valid: false };
        for (const list of nestedLists) {
          const parentLi = list.parentElement;
          const btn = parentLi?.querySelector<HTMLButtonElement>(':scope > button');
          const expanded = btn?.getAttribute('aria-expanded');
          const controls = btn?.getAttribute('aria-controls');
          if (
            !btn ||
            (expanded !== 'true' && expanded !== 'false') ||
            !controls ||
            !list.id ||
            controls !== list.id
          ) {
            return { upgraded: true, valid: false };
          }
        }

        // Any button inside a navigation list must carry valid aria-expanded and aria-controls
        const listButtons = navs.flatMap((nav) =>
          Array.from(nav.querySelectorAll<HTMLButtonElement>('ul button, ol button')),
        );
        for (const btn of listButtons) {
          const expanded = btn.getAttribute('aria-expanded');
          const controls = btn.getAttribute('aria-controls');
          if (
            (expanded !== 'true' && expanded !== 'false') ||
            !controls ||
            !document.getElementById(controls)
          ) {
            return { upgraded: true, valid: false };
          }
        }

        return { upgraded: true, valid: true };
      }),
    ).toEqual({ upgraded: true, valid: true });
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('In a container too narrow for the links to fit inline, the navigation list is a native popover (popover="auto") positioned relative to the trigger button with CSS Anchor Positioning (anchor-name and anchor())', async ({
      page,
    }) => {
      const styleRules = getRules(targetFiles, CSSStyleRule);
      const declaredAnchorNames = new Set<string>();
      const declaredPositionAnchors = new Set<string>();
      for (const r of styleRules) {
        for (const val of getPropertyValues(r, 'anchor-name')) {
          for (const match of val.matchAll(/--[a-zA-Z0-9_-]+/g)) {
            declaredAnchorNames.add(match[0]);
          }
        }
        for (const val of getPropertyValues(r, 'position-anchor')) {
          for (const match of val.matchAll(/--[a-zA-Z0-9_-]+/g)) {
            declaredPositionAnchors.add(match[0]);
          }
        }
      }
      expect(declaredAnchorNames.size).toBeGreaterThan(0);

      const hasLinkedPosAnchor = Array.from(declaredPositionAnchors).some((name) =>
        declaredAnchorNames.has(name),
      );
      const hasLinkedAnchorFn = styleRules.some((r) =>
        Array.from({ length: r.style.length }, (_, i) => r.style.item(i)).some((prop) =>
          getPropertyValues(r, prop).some(
            (v) =>
              v.includes('anchor(') &&
              (hasLinkedPosAnchor ||
                Array.from(declaredAnchorNames).some((name) => v.includes(name))),
          ),
        ),
      );
      expect(hasLinkedAnchorFn).toBe(true);

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 360, height: 640 });

      await expect.poll(() =>
        page.evaluate(() => {
          const trigger = document.querySelector<HTMLButtonElement>(
            'nav button[popovertarget]:not(ul *, ol *)',
          );
          if (!trigger) return null;
          const targetId = trigger.getAttribute('popovertarget') || trigger.getAttribute('aria-controls');
          const menu = targetId ? document.getElementById(targetId) : null;
          if (!menu) return null;
          return {
            popoverAttr: menu.getAttribute('popover'),
            triggerVisible: window.getComputedStyle(trigger).display !== 'none',
          };
        }),
      ).toEqual({ popoverAttr: 'auto', triggerVisible: true });

      await page.evaluate(() => {
        document.querySelector<HTMLButtonElement>('nav button[popovertarget]:not(ul *, ol *)')?.click();
      });

      const checkOpenPosition = () =>
        page.evaluate(() => {
          const trigger = document.querySelector<HTMLButtonElement>(
            'nav button[popovertarget]:not(ul *, ol *)',
          );
          if (!trigger) return null;
          const targetId = trigger.getAttribute('popovertarget') || trigger.getAttribute('aria-controls');
          const menu = targetId ? document.getElementById(targetId) : null;
          if (!menu) return null;
          const triggerRect = trigger.getBoundingClientRect();
          const menuRect = menu.getBoundingClientRect();
          const pos = window.getComputedStyle(menu).position;
          return (
            menu.matches(':popover-open') &&
            (pos === 'fixed' || pos === 'absolute') &&
            menuRect.top >= triggerRect.bottom - 2
          );
        });

      await expect.poll(checkOpenPosition).toBe(true);

      // Push the header/trigger down so a static fallback offset (e.g. inset-block-start: 4.75rem)
      // would stay near the top of the viewport instead of tracking the anchored trigger button
      await page.evaluate(() => {
        const spacer = document.createElement('div');
        spacer.style.blockSize = '160px';
        document.body.prepend(spacer);
      });

      await expect.poll(checkOpenPosition).toBe(true);
    });

    test('In a container wide enough for the links to fit inline, the trigger button is not displayed and the navigation list is laid out as a static, horizontal inline list without the popover attribute', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });

      await expect.poll(() =>
        page.evaluate(() => {
          const trigger = document.querySelector<HTMLButtonElement>(
            'nav button[popovertarget]:not(ul *, ol *)',
          );
          if (!trigger) return null;
          const targetId = trigger.getAttribute('popovertarget') || trigger.getAttribute('aria-controls');
          const menu = targetId ? document.getElementById(targetId) : null;
          if (!menu) return null;

          const triggerDisplay = window.getComputedStyle(trigger).display;
          const menuStyle = window.getComputedStyle(menu);
          const hasPopover = menu.hasAttribute('popover');
          const items = Array.from(menu.children) as HTMLElement[];
          const itemRects = items.map((el) => el.getBoundingClientRect());

          const menuVisible =
            menuStyle.display !== 'none' &&
            menuStyle.visibility !== 'hidden' &&
            Number.parseFloat(menuStyle.opacity) > 0;
          const horizontalAndSized =
            itemRects.length > 1 &&
            itemRects[0].width > 0 &&
            itemRects[0].height > 0 &&
            itemRects[1].left > itemRects[0].left &&
            itemRects[1].left >= itemRects[0].right - 2;

          return {
            triggerDisplay,
            menuPosition: menuStyle.position,
            hasPopover,
            menuVisible,
            horizontalAndSized,
          };
        }),
      ).toEqual({
        triggerDisplay: 'none',
        menuPosition: 'static',
        hasPopover: false,
        menuVisible: true,
        horizontalAndSized: true,
      });
    });

    test('The current page link uses [aria-current="page"] as its styling hook, and the attribute is present on that link', async ({
      page,
    }) => {
      const styleRules = getRules(targetFiles, CSSStyleRule);
      const hasAriaCurrentRule = styleRules.some((r) => {
        const sel = resolveSelector(r) || r.selectorText;
        return r.style.length > 0 && /\[aria-current\s*=\s*["']?page["']?\]/i.test(sel);
      });
      expect(hasAriaCurrentRule).toBe(true);

      const navTargetUrl = await page.evaluate(() => {
        const nav = document.querySelector('nav');
        if (!nav) return { upgraded: false, currentCount: 0, fallbackHref: null as string | null };
        const upgraded = Boolean(nav.querySelector('button[popovertarget][aria-controls]'));
        const scope = nav.closest('header') || nav;
        const currentLinks = scope.querySelectorAll('a[aria-current="page"]');
        const firstNavLink = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[href]')).find((a) => {
          try {
            const url = new URL(a.getAttribute('href') || '', window.location.href);
            return url.origin === window.location.origin && url.pathname !== window.location.pathname;
          } catch {
            return false;
          }
        });
        return {
          upgraded,
          currentCount: currentLinks.length,
          fallbackHref: firstNavLink ? new URL(firstNavLink.getAttribute('href')!, window.location.href).href : null,
        };
      });

      expect(navTargetUrl.upgraded).toBe(true);

      if (navTargetUrl.currentCount === 0 && navTargetUrl.fallbackHref) {
        const targetPathname = new URL(navTargetUrl.fallbackHref).pathname;
        await page.route(`**${targetPathname}`, async (route) => {
          const response = await route.fetch({ url: page.url() });
          await route.fulfill({ response });
        });
        await page.goto(navTargetUrl.fallbackHref);
      }

      await expect.poll(() =>
        page.evaluate(() => {
          const nav = document.querySelector('nav');
          const scope = nav?.closest('header') || nav;
          return scope ? scope.querySelectorAll('a[aria-current="page"]').length : 0;
        }),
      ).toBe(1);
    });

    test('On wide layouts, each nested submenu is a popover="auto" opened by its trigger\'s popovertarget and positioned relative to the trigger with CSS Anchor Positioning', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 1280, height: 800 });

      const getSubmenuState = () =>
        page.evaluate(() => {
          const nav = document.querySelector('nav');
          if (!nav) return { upgraded: false, submenuCount: 0, allValid: false, mobileAnchorProp: '' };
          const mobileTrigger = nav.querySelector<HTMLButtonElement>(
            'button[popovertarget][aria-controls]:not(ul *, ol *)',
          );
          if (!mobileTrigger || window.getComputedStyle(mobileTrigger).display !== 'none') {
            return { upgraded: false, submenuCount: 0, allValid: false, mobileAnchorProp: '' };
          }
          const mobileAnchorName = window.getComputedStyle(mobileTrigger).getPropertyValue('anchor-name').trim();

          const nestedLists = Array.from(nav.querySelectorAll<HTMLElement>('ul ul, ul ol, ol ul, ol ol'));
          const listButtons = Array.from(nav.querySelectorAll<HTMLButtonElement>('ul button, ol button'));
          if (nestedLists.length === 0 && listButtons.length === 0) {
            return { upgraded: true, submenuCount: 0, allValid: true, mobileAnchorProp: mobileAnchorName };
          }
          if (nestedLists.length !== listButtons.length) {
            return {
              upgraded: true,
              submenuCount: Math.max(nestedLists.length, listButtons.length),
              allValid: false,
              mobileAnchorProp: mobileAnchorName,
            };
          }

          for (const trigger of listButtons) {
            const targetId = trigger.getAttribute('popovertarget');
            const controlsId = trigger.getAttribute('aria-controls');
            if (!targetId || targetId !== controlsId) {
              return {
                upgraded: true,
                submenuCount: listButtons.length,
                allValid: false,
                mobileAnchorProp: mobileAnchorName,
              };
            }
            const submenu = document.getElementById(targetId);
            if (!submenu || submenu.getAttribute('popover') !== 'auto') {
              return {
                upgraded: true,
                submenuCount: listButtons.length,
                allValid: false,
                mobileAnchorProp: mobileAnchorName,
              };
            }
          }
          return {
            upgraded: true,
            submenuCount: listButtons.length,
            allValid: true,
            mobileAnchorProp: mobileAnchorName,
          };
        });

      await expect.poll(async () => (await getSubmenuState()).upgraded).toBe(true);
      const result = await getSubmenuState();
      expect(result.allValid).toBe(true);
      expect(result.submenuCount).toBeGreaterThan(0);

      const styleRules = getRules(targetFiles, CSSStyleRule);
      const mobileAnchor = result.mobileAnchorProp;
      const hasSubmenuAnchor = styleRules.some((r) => {
        if (getPropertyValues(r, 'position-area').length > 0 || getPropertyValues(r, 'inset-area').length > 0) {
          return true;
        }
        return Array.from({ length: r.style.length }, (_, i) => r.style.item(i)).some((prop) =>
          getPropertyValues(r, prop).some(
            (v) => v.includes('anchor(') && (!mobileAnchor || !v.includes(mobileAnchor)),
          ),
        );
      });
      expect(hasSubmenuAnchor).toBe(true);

      // Verify clicking each submenu trigger opens its popover anchored near the trigger
      const count = result.submenuCount;
      for (let idx = 0; idx < count; idx++) {
        await page.evaluate((i) => {
          const btns = document.querySelectorAll<HTMLButtonElement>('nav ul button, nav ol button');
          btns[i]?.click();
        }, idx);

        await expect.poll(() =>
          page.evaluate((i) => {
            const btns = document.querySelectorAll<HTMLButtonElement>('nav ul button, nav ol button');
            const trigger = btns[i];
            const id = trigger?.getAttribute('popovertarget');
            const submenu = id ? document.getElementById(id) : null;
            if (!trigger || !submenu || !submenu.matches(':popover-open')) return false;
            const tRect = trigger.getBoundingClientRect();
            const sRect = submenu.getBoundingClientRect();
            const nearBlock = Math.abs(sRect.top - tRect.bottom) <= 32 || Math.abs(tRect.top - sRect.bottom) <= 32;
            const overlapsInline = sRect.right >= tRect.left - 16 && sRect.left <= tRect.right + 16;
            return nearBlock && overlapsInline;
          }, idx),
        ).toBe(true);

        await page.evaluate((i) => {
          const btns = document.querySelectorAll<HTMLButtonElement>('nav ul button, nav ol button');
          btns[i]?.click();
        }, idx);
      }
    });

    test('A submenu trigger\'s aria-expanded is true while its submenu is open and false while it is closed', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });

      await expect.poll(() =>
        page.evaluate(() =>
          Boolean(document.querySelector('nav button[popovertarget][aria-controls]:not(ul *, ol *)')),
        ),
      ).toBe(true);

      const state = await page.evaluate(() => {
        const nav = document.querySelector('nav');
        if (!nav) return { upgraded: false, hasSubmenu: false };
        const upgraded = Boolean(
          nav.querySelector('button[popovertarget][aria-controls]:not(ul *, ol *)'),
        );
        const hasSubmenu =
          nav.querySelectorAll('ul ul, ul ol, ol ul, ol ol').length > 0 ||
          nav.querySelectorAll('ul button, ol button').length > 0;
        return { upgraded, hasSubmenu };
      });
      expect(state.upgraded).toBe(true);
      expect(state.hasSubmenu).toBe(true);

      const readExpanded = () =>
        page.evaluate(() =>
          document.querySelector<HTMLButtonElement>('nav ul button, nav ol button')?.getAttribute('aria-expanded'),
        );
      const clickSubmenuTrigger = () =>
        page.evaluate(() => {
          document.querySelector<HTMLButtonElement>('nav ul button, nav ol button')?.click();
        });

      // Wide layout (native popover toggle)
      await expect.poll(readExpanded).toBe('false');
      await clickSubmenuTrigger();
      await expect.poll(readExpanded).toBe('true');
      await clickSubmenuTrigger();
      await expect.poll(readExpanded).toBe('false');

      // Narrow layout (inline disclosure click handler)
      await page.setViewportSize({ width: 360, height: 640 });
      await expect.poll(() =>
        page.evaluate(() => {
          const trigger = document.querySelector<HTMLButtonElement>(
            'nav button[popovertarget]:not(ul *, ol *)',
          );
          return trigger ? window.getComputedStyle(trigger).display !== 'none' : false;
        }),
      ).toBe(true);
      await page.evaluate(() => {
        document.querySelector<HTMLButtonElement>('nav button[popovertarget]:not(ul *, ol *)')?.click();
      });
      await expect.poll(readExpanded).toBe('false');
      await clickSubmenuTrigger();
      await expect.poll(readExpanded).toBe('true');
      await clickSubmenuTrigger();
      await expect.poll(readExpanded).toBe('false');
    });

    test('When the viewport width changes while the collapsed navigation menu is open and the layout stays collapsed, the menu stays open', async ({
      page,
    }) => {
      const readMenuState = () =>
        page.evaluate(() => {
          const trigger = document.querySelector<HTMLButtonElement>(
            'nav button[popovertarget]:not(ul *, ol *)',
          );
          if (!trigger) return null;
          const targetId = trigger.getAttribute('popovertarget') || trigger.getAttribute('aria-controls');
          const menu = targetId ? document.getElementById(targetId) : null;
          if (!menu) return null;
          return {
            hasPopover: menu.hasAttribute('popover'),
            popoverAttr: menu.getAttribute('popover'),
            isOpen: menu.matches(':popover-open'),
          };
        });

      // Confirm popover is dynamically removed on wide layouts first so a static
      // popover="auto" that never re-measures cannot pass trivially
      await page.setViewportSize({ width: 1280, height: 800 });
      await expect.poll(async () => (await readMenuState())?.hasPopover).toBe(false);

      await page.setViewportSize({ width: 340, height: 640 });
      await expect.poll(async () => (await readMenuState())?.popoverAttr).toBe('auto');

      await page.evaluate(() => {
        document.querySelector<HTMLButtonElement>('nav button[popovertarget]:not(ul *, ol *)')?.click();
      });
      await expect.poll(async () => (await readMenuState())?.isOpen).toBe(true);

      // Grow viewport slightly so ResizeObserver re-measures while staying collapsed
      await page.setViewportSize({ width: 380, height: 640 });
      await expect.poll(readMenuState).toEqual({ hasPopover: true, popoverAttr: 'auto', isOpen: true });

      // Shrink viewport while still collapsed -> must also stay open
      await page.setViewportSize({ width: 350, height: 640 });
      await expect.poll(readMenuState).toEqual({ hasPopover: true, popoverAttr: 'auto', isOpen: true });
    });
  });
});
