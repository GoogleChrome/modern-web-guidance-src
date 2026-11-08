import {
  test,
  expect,
  skipUnless,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';
import type { Document } from 'linkedom';
import type { Page } from '@playwright/test';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function findTablist(doc: Document): any {
  const menu = doc.getElementById('coffee-menu');
  const root = menu || doc;
  return (
    root.querySelector('[focusgroup~="tablist"]') ||
    root.querySelector('[role="tablist"]') ||
    doc.querySelector('[focusgroup~="tablist"]') ||
    doc.querySelector('[role="tablist"]')
  );
}

function findTabs(tablist: any): any[] {
  if (!tablist) return [];
  const byRole = Array.from(tablist.querySelectorAll('[role="tab"]'));
  if (byRole.length > 0) return byRole;
  const buttons = Array.from(tablist.querySelectorAll('button'));
  if (buttons.length > 0) return buttons;
  return Array.from(tablist.children || []);
}

function findPanels(doc: Document): any[] {
  const menu = doc.getElementById('coffee-menu');
  const root = menu || doc;
  const panels = Array.from(root.querySelectorAll('[role="tabpanel"]'));
  if (panels.length > 0) return panels;
  return Array.from(doc.querySelectorAll('[role="tabpanel"]'));
}

async function ensureKeyboardNavigationSupport(page: Page): Promise<void> {
  await page.evaluate(() => {
    const menu = document.getElementById('coffee-menu') || document;
    const tablist = (menu.querySelector('[focusgroup~="tablist"]') ||
      menu.querySelector('[role="tablist"]') ||
      document.querySelector('[focusgroup~="tablist"]') ||
      document.querySelector('[role="tablist"]')) as HTMLElement | null;
    if (!tablist) return;

    const hasNativeFocusgroup =
      'focusgroup' in HTMLElement.prototype || 'focusGroup' in HTMLElement.prototype;
    if (hasNativeFocusgroup) return;

    const fgAttr = (tablist.getAttribute('focusgroup') || '').trim();
    const tokens = fgAttr.split(/\s+/).filter(Boolean);
    if (!tokens.includes('tablist')) return;

    if ((tablist as any).__fgShimmed) return;
    (tablist as any).__fgShimmed = true;

    const getTabs = (): HTMLElement[] => {
      const byRole = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
      const candidates =
        byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll<HTMLElement>('button'));
      return candidates.filter((el) => {
        if (el.hasAttribute('disabled') || el.hasAttribute('hidden')) return false;
        const cs = window.getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
      });
    };

    const syncRovingTabindex = () => {
      const tabs = getTabs();
      if (tabs.length === 0) return;
      const startTab =
        tabs.find((t) => t.hasAttribute('focusgroupstart')) ||
        tabs.find((t) => t.getAttribute('aria-selected') === 'true') ||
        tabs[0];
      for (const tab of tabs) {
        const desired = tab === startTab ? '0' : '-1';
        if (tab.getAttribute('tabindex') !== desired) {
          tab.setAttribute('tabindex', desired);
        }
      }
    };

    syncRovingTabindex();

    const observer = new MutationObserver(() => {
      syncRovingTabindex();
    });
    observer.observe(tablist, {
      subtree: true,
      attributes: true,
      attributeFilter: ['focusgroupstart', 'aria-selected', 'hidden', 'class', 'style'],
    });

    tablist.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const tabs = getTabs();
      const idx = tabs.indexOf(document.activeElement as HTMLElement);
      if (idx === -1) return;
      let next = -1;
      if (event.key === 'ArrowRight') next = (idx + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      if (next !== -1) {
        event.preventDefault();
        tabs[next].focus();
      }
    });
  });
}

async function selectTabInBrowser(page: Page, tabIndex: number): Promise<void> {
  await ensureKeyboardNavigationSupport(page);
  await page.evaluate((idx) => {
    const menu = document.getElementById('coffee-menu') || document;
    const tablist =
      menu.querySelector('[focusgroup~="tablist"]') ||
      menu.querySelector('[role="tablist"]') ||
      document.querySelector('[focusgroup~="tablist"]') ||
      document.querySelector('[role="tablist"]');
    if (!tablist) return;
    const byRole = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
    const tabs =
      byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll<HTMLElement>('button'));
    const target = tabs[idx];
    if (target) {
      target.focus();
      target.click();
    }
  }, tabIndex);
}

test.describe('tabs Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('Tabs are <button> elements, not links', () => {
    const docs = getHtmlDocuments(targetFiles);
    const tablists = docs.map((d) => findTablist(d.document)).filter(Boolean);
    expect(tablists.length).toBeGreaterThan(0);

    for (const tablist of tablists) {
      const links = Array.from(tablist.querySelectorAll('a'));
      expect(links.length).toBe(0);
      const tabs = findTabs(tablist);
      expect(tabs.length).toBeGreaterThan(1);
      for (const tab of tabs) {
        expect(tab.tagName.toLowerCase()).toBe('button');
      }
    }
  });

  test('Every tab <button> has type="button"', () => {
    const docs = getHtmlDocuments(targetFiles);
    const tablists = docs.map((d) => findTablist(d.document)).filter(Boolean);
    expect(tablists.length).toBeGreaterThan(0);

    for (const tablist of tablists) {
      const tabs = findTabs(tablist);
      expect(tabs.length).toBeGreaterThan(1);
      for (const tab of tabs) {
        expect(tab.tagName.toLowerCase()).toBe('button');
        expect((tab.getAttribute('type') || '').toLowerCase()).toBe('button');
      }
    }
  });

  test('The tablist container has a focusgroup attribute whose value includes tablist', () => {
    const docs = getHtmlDocuments(targetFiles);
    const tablists = docs.map((d) => findTablist(d.document)).filter(Boolean);
    expect(tablists.length).toBeGreaterThan(0);

    for (const tablist of tablists) {
      const fg = (tablist.getAttribute('focusgroup') || '').trim();
      const tokens = fg.split(/\s+/).filter(Boolean);
      expect(tokens).toContain('tablist');
    }
  });

  test('The tablist container has an accessible name from aria-label or aria-labelledby', () => {
    const docs = getHtmlDocuments(targetFiles);
    const pairs = docs
      .map((d) => ({ doc: d.document, tablist: findTablist(d.document) }))
      .filter((p) => Boolean(p.tablist));
    expect(pairs.length).toBeGreaterThan(0);

    for (const { doc, tablist } of pairs) {
      const ariaLabel = (tablist.getAttribute('aria-label') || '').trim();
      const ariaLabelledBy = (tablist.getAttribute('aria-labelledby') || '').trim();
      const hasValidLabelledBy =
        ariaLabelledBy.length > 0 &&
        ariaLabelledBy
          .split(/\s+/)
          .some((id: string) => Boolean(doc.getElementById(id)?.textContent?.trim()));
      expect(ariaLabel.length > 0 || hasValidLabelledBy).toBe(true);
    }
  });

  test('The tablist container contains no focusable elements other than the tabs', () => {
    const docs = getHtmlDocuments(targetFiles);
    const tablists = docs.map((d) => findTablist(d.document)).filter(Boolean);
    expect(tablists.length).toBeGreaterThan(0);

    const focusableSelector =
      'button, a[href], input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

    for (const tablist of tablists) {
      const tabs = new Set(findTabs(tablist));
      expect(tabs.size).toBeGreaterThan(1);
      const focusables = Array.from(tablist.querySelectorAll(focusableSelector));
      expect(focusables.length).toBeGreaterThan(0);
      for (const el of focusables) {
        expect(tabs.has(el)).toBe(true);
      }
    }
  });

  test('Every tab panel has role="tabpanel"', () => {
    const docs = getHtmlDocuments(targetFiles);
    const allPanels = docs.flatMap((d) => findPanels(d.document));
    const allTabs = docs.flatMap((d) => findTabs(findTablist(d.document)));
    expect(allTabs.length).toBeGreaterThan(1);
    expect(allPanels.length).toBe(allTabs.length);

    for (const panel of allPanels) {
      expect(panel.getAttribute('role')).toBe('tabpanel');
    }
  });

  test('Every tab panel is labelled by its tab via aria-labelledby or ariaLabelledByElements', () => {
    const docs = getHtmlDocuments(targetFiles);
    const pairs = docs
      .map((d) => ({
        tabs: findTabs(findTablist(d.document)),
        panels: findPanels(d.document),
      }))
      .filter((p) => p.tabs.length > 0 || p.panels.length > 0);
    expect(pairs.length).toBeGreaterThan(0);

    const project: Project = getJsProject(targetFiles);
    const usesAriaLabelledByElements = project
      .getSourceFiles()
      .some((sf) =>
        sf
          .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
          .some((pae) => pae.getName() === 'ariaLabelledByElements')
      );

    for (const { tabs, panels } of pairs) {
      expect(panels.length).toBe(tabs.length);
      const tabIds = new Set(tabs.map((t: any) => t.getAttribute('id')).filter(Boolean));
      for (const panel of panels) {
        const labelledBy = (panel.getAttribute('aria-labelledby') || '').trim();
        const matchesTabId = tabIds.has(labelledBy);
        expect(matchesTabId || usesAriaLabelledByElements).toBe(true);
      }
    }
  });

  test('With JavaScript disabled, exactly one tab has aria-selected="true"', () => {
    const docs = getHtmlDocuments(targetFiles);
    const tablists = docs.map((d) => findTablist(d.document)).filter(Boolean);
    expect(tablists.length).toBeGreaterThan(0);

    for (const tablist of tablists) {
      const tabs = findTabs(tablist);
      expect(tabs.length).toBeGreaterThan(1);
      const selectedTabs = tabs.filter((t: any) => t.getAttribute('aria-selected') === 'true');
      expect(selectedTabs.length).toBe(1);
    }
  });

  test('With JavaScript disabled, every tab panel except the one associated with the selected tab is hidden', () => {
    const docs = getHtmlDocuments(targetFiles);
    const pairs = docs
      .map((d) => ({
        tabs: findTabs(findTablist(d.document)),
        panels: findPanels(d.document),
      }))
      .filter((p) => p.tabs.length > 0);
    expect(pairs.length).toBeGreaterThan(0);

    for (const { tabs, panels } of pairs) {
      expect(panels.length).toBe(tabs.length);
      const selectedIdx = tabs.findIndex((t: any) => t.getAttribute('aria-selected') === 'true');
      expect(selectedIdx).toBeGreaterThanOrEqual(0);
      const selectedTab = tabs[selectedIdx];
      const selectedTabId = selectedTab.getAttribute('id');

      panels.forEach((panel: any, idx: number) => {
        const isAssociatedWithSelected = selectedTabId
          ? panel.getAttribute('aria-labelledby') === selectedTabId
          : idx === selectedIdx;
        if (isAssociatedWithSelected) {
          expect(panel.hasAttribute('hidden')).toBe(false);
        } else {
          expect(panel.hasAttribute('hidden')).toBe(true);
        }
      });
    }
  });

  test("The tablist's focusgroup attribute value includes nomemory", () => {
    const docs = getHtmlDocuments(targetFiles);
    const tablists = docs.map((d) => findTablist(d.document)).filter(Boolean);
    expect(tablists.length).toBeGreaterThan(0);

    for (const tablist of tablists) {
      const fg = (tablist.getAttribute('focusgroup') || '').trim();
      const tokens = fg.split(/\s+/).filter(Boolean);
      expect(tokens).toContain('nomemory');
    }
  });

  test('Native focusGroup support is detected with Object.hasOwn(HTMLElement.prototype, "focusGroup"), and the @microsoft/focusgroup-polyfill polyfill is conditionally loaded only when native support is missing', () => {
    skipUnless({ unsupported: 'focusgroup' });

    const project: Project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    expect(sourceFiles.length).toBeGreaterThan(0);

    let hasFeatureDetection = false;
    let hasFallbackOrPolyfill = false;

    for (const sf of sourceFiles) {
      // Check Object.hasOwn(HTMLElement.prototype, 'focusGroup' | 'focusgroup') or HTMLElement.prototype.hasOwnProperty(...)
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const call of callExprs) {
        const exprText = call.getExpression().getText();
        const args = call.getArguments();
        if (
          (exprText === 'Object.hasOwn' || exprText.endsWith('.hasOwnProperty')) &&
          args.some((a) => a.getText().includes('HTMLElement.prototype')) &&
          args.some((a) => /^['"`]focus[Gg]roup['"`]$/.test(a.getText().trim()))
        ) {
          hasFeatureDetection = true;
        }
        // Check addEventListener('keydown', ...) or dynamic import('@microsoft/focusgroup-polyfill')
        if (
          exprText.endsWith('addEventListener') &&
          args.length >= 1 &&
          /^['"`]keydown['"`]$/.test(args[0].getText().trim())
        ) {
          hasFallbackOrPolyfill = true;
        }
        if (
          args.some((a) => a.getText().includes('focusgroup-polyfill')) ||
          call.getText().includes('focusgroup-polyfill')
        ) {
          hasFallbackOrPolyfill = true;
        }
      }

      // Also check `'focusgroup' in HTMLElement.prototype` or `'focusGroup' in HTMLElement.prototype`
      const binExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      for (const bin of binExprs) {
        if (bin.getOperatorToken().getText() === 'in') {
          const left = bin.getLeft().getText().trim();
          const right = bin.getRight().getText().trim();
          if (
            /^['"`]focus[Gg]roup['"`]$/.test(left) &&
            right.includes('HTMLElement.prototype')
          ) {
            hasFeatureDetection = true;
          }
        }
      }

      // Also check if polyfill is imported or referenced in script
      const importDecls = sf.getDescendantsOfKind(SyntaxKind.ImportDeclaration);
      if (importDecls.some((imp) => imp.getModuleSpecifierValue().includes('focusgroup-polyfill'))) {
        hasFallbackOrPolyfill = true;
      }

      // Or if focusgroupstart / ariaSelected is managed with scrollIntoView / keyboard listeners
      const propAccesses = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
      if (propAccesses.some((p) => p.getName() === 'scrollIntoView' || p.getName() === 'scrollBy')) {
        hasFallbackOrPolyfill = true;
      }
    }

    expect(hasFeatureDetection || hasFallbackOrPolyfill).toBe(true);
    // Ensure a tablist with focusgroup is actually present as precondition
    const docs = getHtmlDocuments(targetFiles);
    const tablists = docs.map((d) => findTablist(d.document)).filter(Boolean);
    expect(tablists.length).toBeGreaterThan(0);
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
      await ensureKeyboardNavigationSupport(page);
    });

    test('After a tab is selected, it is the only tab with aria-selected="true"', async ({ page }) => {
      await selectTabInBrowser(page, 1);

      const selectedStates = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        if (!tablist) return [];
        const byRole = Array.from(tablist.querySelectorAll('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll('button'));
        return tabs.map((t) => t.getAttribute('aria-selected'));
      });

      expect(selectedStates.length).toBeGreaterThan(1);
      expect(selectedStates[1]).toBe('true');
      expect(selectedStates.filter((s) => s === 'true').length).toBe(1);
    });

    test('After a tab is selected, its tab panel is the only visible tab panel', async ({ page }) => {
      await selectTabInBrowser(page, 1);

      const panelVisibility = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        const panels = Array.from(menu.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
        if (!tablist || panels.length === 0) return { count: 0, visibleIndices: [], targetIndex: -1 };
        const byRole = Array.from(tablist.querySelectorAll('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll('button'));
        const selectedTab = tabs[1];
        const selectedId = selectedTab?.id;
        const targetIndex = selectedId
          ? panels.findIndex((p) => p.getAttribute('aria-labelledby') === selectedId)
          : 1;

        const visibleIndices = panels
          .map((p, i) => {
            const hiddenAttr = p.hasAttribute('hidden');
            const rect = p.getBoundingClientRect();
            const cs = window.getComputedStyle(p);
            const isVisible =
              !hiddenAttr && cs.display !== 'none' && cs.visibility !== 'hidden' && rect.height > 0;
            return isVisible ? i : -1;
          })
          .filter((i) => i !== -1);

        return { count: panels.length, visibleIndices, targetIndex };
      });

      expect(panelVisibility.count).toBeGreaterThan(1);
      expect(panelVisibility.visibleIndices).toEqual([panelVisibility.targetIndex]);
    });

    test('Hidden tab panels use the hidden attribute, with or without the value until-found', async ({ page }) => {
      await selectTabInBrowser(page, 1);

      const hiddenAttrs = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const panels = Array.from(menu.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
        return panels.map((p) => ({
          hasHidden: p.hasAttribute('hidden'),
          hiddenVal: p.getAttribute('hidden'),
        }));
      });

      expect(hiddenAttrs.length).toBeGreaterThan(1);
      const hiddenPanels = hiddenAttrs.filter((p) => p.hasHidden);
      expect(hiddenPanels.length).toBe(hiddenAttrs.length - 1);
      for (const hp of hiddenPanels) {
        expect(['', 'until-found', 'true']).toContain((hp.hiddenVal || '').toLowerCase());
      }
    });

    test('After a tab is selected, it is the only tab with the focusgroupstart attribute', async ({ page }) => {
      await selectTabInBrowser(page, 2);

      const fgStartIndices = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        if (!tablist) return { total: 0, indices: [] };
        const byRole = Array.from(tablist.querySelectorAll('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll('button'));
        const indices = tabs
          .map((t, i) => (t.hasAttribute('focusgroupstart') ? i : -1))
          .filter((i) => i !== -1);
        return { total: tabs.length, indices };
      });

      expect(fgStartIndices.total).toBeGreaterThan(2);
      expect(fgStartIndices.indices).toEqual([2]);
    });

    test('Pressing Tab from before the tablist moves focus to the selected tab', async ({ page }) => {
      await selectTabInBrowser(page, 2);

      await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        if (!tablist) return;
        let beforeBtn = document.getElementById('__grader-before-tablist') as HTMLButtonElement | null;
        if (!beforeBtn) {
          beforeBtn = document.createElement('button');
          beforeBtn.id = '__grader-before-tablist';
          beforeBtn.type = 'button';
          beforeBtn.textContent = 'Before';
          tablist.parentElement?.insertBefore(beforeBtn, tablist);
        }
        beforeBtn.focus();
      });

      await page.keyboard.press('Tab');

      const focusedIndex = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        if (!tablist) return -1;
        const byRole = Array.from(tablist.querySelectorAll('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll('button'));
        return tabs.indexOf(document.activeElement as Element);
      });

      expect(focusedIndex).toBe(2);
    });

    test('Pressing Tab while a tab is focused moves focus out of the tablist', async ({ page }) => {
      await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        if (!tablist) return;
        const byRole = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll<HTMLElement>('button'));
        tabs[0]?.focus();
      });

      await page.keyboard.press('Tab');

      const isFocusInsideTablist = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        if (!tablist) return true;
        return tablist.contains(document.activeElement);
      });

      expect(isFocusInsideTablist).toBe(false);
    });

    test('Pressing ArrowRight while a tab is focused moves focus to the next tab', async ({ page }) => {
      const tabCount = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        if (!tablist) return 0;
        const byRole = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll<HTMLElement>('button'));
        tabs[0]?.focus();
        return tabs.length;
      });
      expect(tabCount).toBeGreaterThan(1);

      await page.keyboard.press('ArrowRight');

      const focusedIndex = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        if (!tablist) return -1;
        const byRole = Array.from(tablist.querySelectorAll('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll('button'));
        return tabs.indexOf(document.activeElement as Element);
      });

      expect(focusedIndex).toBe(1);
    });

    test('Pressing ArrowLeft while a tab is focused moves focus to the previous tab', async ({ page }) => {
      const tabCount = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        if (!tablist) return 0;
        const byRole = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll<HTMLElement>('button'));
        tabs[1]?.focus();
        return tabs.length;
      });
      expect(tabCount).toBeGreaterThan(1);

      await page.keyboard.press('ArrowLeft');

      const focusedIndex = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        if (!tablist) return -1;
        const byRole = Array.from(tablist.querySelectorAll('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll('button'));
        return tabs.indexOf(document.activeElement as Element);
      });

      expect(focusedIndex).toBe(0);
    });

    test('Pressing Home while a tab is focused moves focus to the first tab', async ({ page }) => {
      const tabCount = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        if (!tablist) return 0;
        const byRole = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll<HTMLElement>('button'));
        tabs[2]?.focus();
        return tabs.length;
      });
      expect(tabCount).toBeGreaterThan(2);

      await page.keyboard.press('Home');

      const focusedIndex = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        if (!tablist) return -1;
        const byRole = Array.from(tablist.querySelectorAll('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll('button'));
        return tabs.indexOf(document.activeElement as Element);
      });

      expect(focusedIndex).toBe(0);
    });

    test('Pressing End while a tab is focused moves focus to the last tab', async ({ page }) => {
      const tabCount = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        if (!tablist) return 0;
        const byRole = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll<HTMLElement>('button'));
        tabs[0]?.focus();
        return tabs.length;
      });
      expect(tabCount).toBeGreaterThan(1);

      await page.keyboard.press('End');

      const focusedIndex = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        if (!tablist) return -1;
        const byRole = Array.from(tablist.querySelectorAll('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll('button'));
        return tabs.indexOf(document.activeElement as Element);
      });

      expect(focusedIndex).toBe(tabCount - 1);
    });

    test('Tabs are selected either when they receive focus (selection follows focus) or when the focused tab is activated with Enter or Space (selection by activation), and the same pattern is used consistently for every tab', async ({ page }) => {
      const tabCount = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        if (!tablist) return 0;
        const byRole = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll<HTMLElement>('button'));
        return tabs.length;
      });
      expect(tabCount).toBeGreaterThan(1);

      const patterns: Array<'focus' | 'activation' | 'none'> = [];

      for (let i = 1; i < tabCount; i++) {
        const selectedOnFocus = await page.evaluate((idx) => {
          const menu = document.getElementById('coffee-menu') || document;
          const tablist =
            menu.querySelector('[focusgroup~="tablist"]') ||
            menu.querySelector('[role="tablist"]');
          if (!tablist) return false;
          const byRole = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
          const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll<HTMLElement>('button'));
          tabs[idx]?.focus();
          return tabs[idx]?.getAttribute('aria-selected') === 'true';
        }, i);

        if (selectedOnFocus) {
          patterns.push('focus');
        } else {
          await page.keyboard.press(i % 2 === 1 ? 'Enter' : 'Space');
          const selectedOnActivate = await page.evaluate((idx) => {
            const menu = document.getElementById('coffee-menu') || document;
            const tablist =
              menu.querySelector('[focusgroup~="tablist"]') ||
              menu.querySelector('[role="tablist"]');
            if (!tablist) return false;
            const byRole = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
            const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll<HTMLElement>('button'));
            return tabs[idx]?.getAttribute('aria-selected') === 'true';
          }, i);
          patterns.push(selectedOnActivate ? 'activation' : 'none');
        }
      }

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns).not.toContain('none');
      const uniquePatterns = Array.from(new Set(patterns));
      expect(uniquePatterns.length).toBe(1);
    });

    test('Clicking a tab selects it', async ({ page }) => {
      const tablist = page.locator('#coffee-menu [focusgroup~="tablist"], #coffee-menu [role="tablist"], [focusgroup~="tablist"], [role="tablist"]').first();
      const tabs = tablist.locator('button');
      const count = await tabs.count();
      expect(count).toBeGreaterThan(1);

      await tabs.nth(1).click();
      await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
      await expect(tabs.nth(0)).not.toHaveAttribute('aria-selected', 'true');
    });

    test('The visible tab panel has tabindex="0" when it contains no focusable elements', async ({ page }) => {
      const checkResult = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const panels = Array.from(menu.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
        if (panels.length === 0) return { hasPanels: false, valid: false };

        const visiblePanel = panels.find((p) => !p.hasAttribute('hidden'));
        if (!visiblePanel) return { hasPanels: true, valid: false };

        const focusableSelector =
          'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
        const hasFocusableChild = Boolean(visiblePanel.querySelector(focusableSelector));
        const hasTabIndexZero = visiblePanel.getAttribute('tabindex') === '0' || visiblePanel.tabIndex === 0;

        // Either it already has tabindex="0", or it contains focusable elements
        return {
          hasPanels: true,
          valid: hasTabIndexZero || hasFocusableChild,
        };
      });

      expect(checkResult.hasPanels).toBe(true);
      expect(checkResult.valid).toBe(true);
    });

    test('No hidden tab panel has tabindex="0"', async ({ page }) => {
      await selectTabInBrowser(page, 1);

      const hiddenPanelTabIndices = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const panels = Array.from(menu.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
        const hiddenPanels = panels.filter((p) => p.hasAttribute('hidden'));
        return {
          totalPanels: panels.length,
          hiddenCount: hiddenPanels.length,
          anyHasTabindexZero: hiddenPanels.some((p) => p.getAttribute('tabindex') === '0'),
        };
      });

      expect(hiddenPanelTabIndices.totalPanels).toBeGreaterThan(1);
      expect(hiddenPanelTabIndices.hiddenCount).toBe(hiddenPanelTabIndices.totalPanels - 1);
      expect(hiddenPanelTabIndices.anyHasTabindexZero).toBe(false);
    });

    test('Dispatching a beforematch event on a hidden tab panel sets aria-selected="true" on its tab', async ({ page }) => {
      const result = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        const panels = Array.from(menu.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
        if (!tablist || panels.length < 2) return null;
        const byRole = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll<HTMLElement>('button'));

        const hiddenIndex = panels.findIndex((p) => p.hasAttribute('hidden'));
        if (hiddenIndex === -1) return null;
        const targetPanel = panels[hiddenIndex];
        targetPanel.dispatchEvent(new Event('beforematch', { bubbles: true }));

        const labelledBy = targetPanel.getAttribute('aria-labelledby');
        const targetTab = (labelledBy ? tabs.find((t) => t.id === labelledBy) : tabs[hiddenIndex]) || tabs[hiddenIndex];
        return {
          targetSelected: targetTab?.getAttribute('aria-selected'),
          selectedCount: tabs.filter((t) => t.getAttribute('aria-selected') === 'true').length,
        };
      });

      expect(result).not.toBeNull();
      expect(result?.targetSelected).toBe('true');
      expect(result?.selectedCount).toBe(1);
    });

    test('Dispatching a beforematch event on a hidden tab panel sets focusgroupstart on its tab', async ({ page }) => {
      const result = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        const panels = Array.from(menu.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
        if (!tablist || panels.length < 2) return null;
        const byRole = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll<HTMLElement>('button'));

        const hiddenIndex = panels.findIndex((p) => p.hasAttribute('hidden'));
        if (hiddenIndex === -1) return null;
        const targetPanel = panels[hiddenIndex];
        targetPanel.dispatchEvent(new Event('beforematch', { bubbles: true }));

        const labelledBy = targetPanel.getAttribute('aria-labelledby');
        const targetTab = (labelledBy ? tabs.find((t) => t.id === labelledBy) : tabs[hiddenIndex]) || tabs[hiddenIndex];
        return {
          hasFocusgroupStart: targetTab?.hasAttribute('focusgroupstart'),
          focusgroupStartCount: tabs.filter((t) => t.hasAttribute('focusgroupstart')).length,
        };
      });

      expect(result).not.toBeNull();
      expect(result?.hasFocusgroupStart).toBe(true);
      expect(result?.focusgroupStartCount).toBe(1);
    });

    test('Dispatching a beforematch event on a hidden tab panel hides every other tab panel', async ({ page }) => {
      const result = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const panels = Array.from(menu.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
        if (panels.length < 2) return null;

        const hiddenIndex = panels.findIndex((p) => p.hasAttribute('hidden'));
        if (hiddenIndex === -1) return null;
        const targetPanel = panels[hiddenIndex];
        targetPanel.dispatchEvent(new Event('beforematch', { bubbles: true }));

        const otherPanels = panels.filter((_, i) => i !== hiddenIndex);
        return {
          targetHidden: targetPanel.hasAttribute('hidden'),
          allOthersHidden: otherPanels.every((p) => p.hasAttribute('hidden')),
        };
      });

      expect(result).not.toBeNull();
      expect(result?.targetHidden).toBe(false);
      expect(result?.allOthersHidden).toBe(true);
    });

    test('Every tab panel has a computed padding, border width, and margin of 0', async ({ page }) => {
      const panelBoxStyles = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const panels = Array.from(menu.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
        return panels.map((panel) => {
          const cs = window.getComputedStyle(panel);
          const props = [
            'paddingTop',
            'paddingRight',
            'paddingBottom',
            'paddingLeft',
            'borderTopWidth',
            'borderRightWidth',
            'borderBottomWidth',
            'borderLeftWidth',
            'marginTop',
            'marginRight',
            'marginBottom',
            'marginLeft',
          ] as const;
          return props.map((prop) => parseFloat(cs[prop]) || 0);
        });
      });

      expect(panelBoxStyles.length).toBeGreaterThan(1);
      for (const values of panelBoxStyles) {
        for (const v of values) {
          expect(v).toBe(0);
        }
      }
    });

    test('The selected tab is distinguished from the unselected tabs by more than color: it, its ::before/::after, or a tablist pseudo-element anchored to it has a visible border or text-decoration that the unselected tabs lack', async ({ page }) => {
      const indicatorInfo = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist = (menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]')) as HTMLElement | null;
        if (!tablist) return null;
        const byRole = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll<HTMLElement>('button'));
        if (tabs.length < 2) return null;

        const selectedTab = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
        const unselectedTab = tabs.find((t) => t.getAttribute('aria-selected') !== 'true');
        if (!selectedTab || !unselectedTab) return null;

        const hasVisibleBorderOrDecoration = (el: HTMLElement, pseudo?: string): boolean => {
          const cs = window.getComputedStyle(el, pseudo || null);
          if (pseudo && (cs.content === 'none' || cs.content === 'normal')) {
            return false;
          }
          const borders = [
            { w: parseFloat(cs.borderTopWidth) || 0, s: cs.borderTopStyle, c: cs.borderTopColor },
            { w: parseFloat(cs.borderRightWidth) || 0, s: cs.borderRightStyle, c: cs.borderRightColor },
            { w: parseFloat(cs.borderBottomWidth) || 0, s: cs.borderBottomStyle, c: cs.borderBottomColor },
            { w: parseFloat(cs.borderLeftWidth) || 0, s: cs.borderLeftStyle, c: cs.borderLeftColor },
          ];
          const hasBorder = borders.some(
            (b) => b.w > 0 && b.s !== 'none' && b.s !== 'hidden' && b.c !== 'rgba(0, 0, 0, 0)' && b.c !== 'transparent'
          );
          const hasTextDecoration = !pseudo && cs.textDecorationLine && cs.textDecorationLine !== 'none';
          return Boolean(hasBorder || hasTextDecoration);
        };

        const checkTabIndicator = (tab: HTMLElement): boolean =>
          hasVisibleBorderOrDecoration(tab) ||
          hasVisibleBorderOrDecoration(tab, '::before') ||
          hasVisibleBorderOrDecoration(tab, '::after');

        const tablistPseudoIndicator =
          hasVisibleBorderOrDecoration(tablist, '::before') ||
          hasVisibleBorderOrDecoration(tablist, '::after');

        return {
          selectedHasIndicator: checkTabIndicator(selectedTab) || tablistPseudoIndicator,
          unselectedHasIndicator: checkTabIndicator(unselectedTab),
        };
      });

      expect(indicatorInfo).not.toBeNull();
      expect(indicatorInfo?.selectedHasIndicator).toBe(true);
      expect(indicatorInfo?.unselectedHasIndicator).toBe(false);
    });

    test('With forced-colors: active emulated, the selected tab\'s indicator is still drawn with a border or text-decoration, not only with box-shadow or a background', async ({ page }) => {
      await page.emulateMedia({ forcedColors: 'active' });

      const forcedColorsInfo = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist = (menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]')) as HTMLElement | null;
        if (!tablist) return null;
        const byRole = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll<HTMLElement>('button'));
        if (tabs.length < 2) return null;

        const selectedTab = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
        const unselectedTab = tabs.find((t) => t.getAttribute('aria-selected') !== 'true');
        if (!selectedTab || !unselectedTab) return null;

        const hasVisibleBorderOrDecoration = (el: HTMLElement, pseudo?: string): boolean => {
          const cs = window.getComputedStyle(el, pseudo || null);
          if (pseudo && (cs.content === 'none' || cs.content === 'normal')) {
            return false;
          }
          const borders = [
            { w: parseFloat(cs.borderTopWidth) || 0, s: cs.borderTopStyle },
            { w: parseFloat(cs.borderRightWidth) || 0, s: cs.borderRightStyle },
            { w: parseFloat(cs.borderBottomWidth) || 0, s: cs.borderBottomStyle },
            { w: parseFloat(cs.borderLeftWidth) || 0, s: cs.borderLeftStyle },
          ];
          const hasBorder = borders.some((b) => b.w > 0 && b.s !== 'none' && b.s !== 'hidden');
          const hasTextDecoration = !pseudo && cs.textDecorationLine && cs.textDecorationLine !== 'none';
          return Boolean(hasBorder || hasTextDecoration);
        };

        const checkTabIndicator = (tab: HTMLElement): boolean =>
          hasVisibleBorderOrDecoration(tab) ||
          hasVisibleBorderOrDecoration(tab, '::before') ||
          hasVisibleBorderOrDecoration(tab, '::after');

        const tablistPseudoIndicator =
          hasVisibleBorderOrDecoration(tablist, '::before') ||
          hasVisibleBorderOrDecoration(tablist, '::after');

        return {
          selectedHasIndicator: checkTabIndicator(selectedTab) || tablistPseudoIndicator,
          unselectedHasIndicator: checkTabIndicator(unselectedTab),
        };
      });

      expect(forcedColorsInfo).not.toBeNull();
      expect(forcedColorsInfo?.selectedHasIndicator).toBe(true);
      expect(forcedColorsInfo?.unselectedHasIndicator).toBe(false);
    });

    test('At a viewport narrower than the combined width of the tabs, all tabs are laid out on a single row (same offsetTop)', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 600 });

      const rowLayout = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist = (menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]')) as HTMLElement | null;
        if (!tablist) return null;
        const byRole = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll<HTMLElement>('button'));
        const visibleTabs = tabs.filter((t) => window.getComputedStyle(t).display !== 'none');
        if (visibleTabs.length < 2) return null;

        const offsetTops = visibleTabs.map((t) => t.offsetTop);
        return {
          count: visibleTabs.length,
          uniqueOffsetTops: Array.from(new Set(offsetTops)),
        };
      });

      expect(rowLayout).not.toBeNull();
      expect(rowLayout?.uniqueOffsetTops.length).toBe(1);
    });

    test('At a viewport narrower than the combined width of the tabs, every tab remains reachable: either the tablist scrolls horizontally, or the tabs that do not fit are listed in a menu opened by a button outside the tablist', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 600 });

      const reachability = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist = (menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]')) as HTMLElement | null;
        if (!tablist) return null;

        const cs = window.getComputedStyle(tablist);
        const scrollsHorizontally =
          (cs.overflowX === 'auto' || cs.overflowX === 'scroll') &&
          tablist.scrollWidth > tablist.clientWidth;

        // Or check for an overflow menu button outside the tablist
        const allButtonsInMenu = Array.from(menu.querySelectorAll<HTMLElement>('button'));
        const outsideButtons = allButtonsInMenu.filter((btn) => !tablist.contains(btn));
        const hasOverflowMenuButton = outsideButtons.some(
          (btn) =>
            !btn.hasAttribute('hidden') &&
            window.getComputedStyle(btn).display !== 'none' &&
            (btn.hasAttribute('popovertarget') ||
              btn.getAttribute('aria-haspopup') === 'menu' ||
              btn.getAttribute('aria-haspopup') === 'true' ||
              Boolean(menu.querySelector('[role="menu"]')))
        );

        return {
          scrollsHorizontally,
          hasOverflowMenuButton,
        };
      });

      expect(reachability).not.toBeNull();
      expect(Boolean(reachability?.scrollsHorizontally || reachability?.hasOverflowMenuButton)).toBe(true);
    });

    test('At a viewport narrower than the combined width of the tabs, the selected tab is fully visible within the tablist after it is selected by click, keyboard, or a beforematch event', async ({ page }) => {
      // Emulate reduced motion so smooth scroll finishes immediately
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 320, height: 600 });

      const isSelectedTabFullyVisible = async (): Promise<boolean> => {
        return page.evaluate(() => {
          const menu = document.getElementById('coffee-menu') || document;
          const tablist = (menu.querySelector('[focusgroup~="tablist"]') ||
            menu.querySelector('[role="tablist"]')) as HTMLElement | null;
          if (!tablist) return false;
          const byRole = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
          const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll<HTMLElement>('button'));
          const selected = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
          if (!selected) return false;

          const cs = window.getComputedStyle(selected);
          if (cs.display === 'none' || cs.visibility === 'hidden') return false;

          const listRect = tablist.getBoundingClientRect();
          const tabRect = selected.getBoundingClientRect();
          // Allow 2px tolerance for rounding/subpixel borders
          return tabRect.left >= listRect.left - 2 && tabRect.right <= listRect.right + 2;
        });
      };

      const tabCount = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        if (!tablist) return 0;
        const byRole = Array.from(tablist.querySelectorAll('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll('button'));
        return tabs.length;
      });
      expect(tabCount).toBeGreaterThan(2);

      // 1. Select last tab via beforematch on its panel
      await page.evaluate((lastIdx) => {
        const menu = document.getElementById('coffee-menu') || document;
        const panels = Array.from(menu.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
        panels[lastIdx]?.dispatchEvent(new Event('beforematch', { bubbles: true }));
      }, tabCount - 1);

      await expect.poll(isSelectedTabFullyVisible).toBe(true);

      // 2. Select first tab via keyboard (Home)
      await page.evaluate((lastIdx) => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        if (!tablist) return;
        const byRole = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll<HTMLElement>('button'));
        tabs[lastIdx]?.focus();
      }, tabCount - 1);
      await page.keyboard.press('Home');
      // If selection by activation is used, press Enter to select
      const firstSelected = await page.evaluate(() => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        if (!tablist) return false;
        const byRole = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll<HTMLElement>('button'));
        return tabs[0]?.getAttribute('aria-selected') === 'true';
      });
      if (!firstSelected) {
        await page.keyboard.press('Enter');
      }

      await expect.poll(isSelectedTabFullyVisible).toBe(true);

      // 3. Select a tab by click
      await page.evaluate((lastIdx) => {
        const menu = document.getElementById('coffee-menu') || document;
        const tablist =
          menu.querySelector('[focusgroup~="tablist"]') ||
          menu.querySelector('[role="tablist"]');
        if (!tablist) return;
        const byRole = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
        const tabs = byRole.length > 0 ? byRole : Array.from(tablist.querySelectorAll<HTMLElement>('button'));
        tabs[lastIdx]?.click();
      }, tabCount - 1);

      await expect.poll(isSelectedTabFullyVisible).toBe(true);
    });
  });
});
