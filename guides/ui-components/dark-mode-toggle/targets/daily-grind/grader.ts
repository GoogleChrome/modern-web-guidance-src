import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';
import {
  getCascadedStyle,
  CSSStyleRule,
  CSSGroupingRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';
import type { Page } from '@playwright/test';

// @ts-ignore - import.meta.url is supported in ESM runtime
const targetFiles: string[] = getTargetFiles(import.meta.url);

function flattenCssRules(rules: Iterable<CSSRule>): CSSRule[] {
  const result: CSSRule[] = [];
  for (const rule of rules) {
    result.push(rule);
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...flattenCssRules(rule.cssRules));
    }
  }
  return result;
}

function getEffectiveStyleRuleSelector(rule: CSSStyleRule): string {
  const parts: string[] = [];
  let current: CSSRule | null = rule;
  while (current) {
    if (current instanceof CSSStyleRule) {
      parts.unshift(current.selectorText);
    }
    current = current.parentRule;
  }
  return parts.join(' ');
}

async function applyOppositeSchemeInPage(page: Page, targetScheme: 'light' | 'dark'): Promise<void> {
  // Check for explicit select dropdown (3-state select)
  const selectEl = page.locator('select').filter({
    has: page.locator('option[value="light"], option[value="dark"]'),
  });
  if ((await selectEl.count()) > 0) {
    await selectEl.first().selectOption(targetScheme);
    return;
  }

  // Check for explicit radio input (3-state or 2-state radio)
  const radioEl = page.locator(`input[type="radio"][value="${targetScheme}"]`);
  if ((await radioEl.count()) > 0) {
    await radioEl.first().check({ force: true });
    return;
  }

  // Check if there are multiple distinct theme buttons (3-state button group)
  const targetWord = targetScheme === 'dark' ? /\bdark\b/i : /\blight\b/i;
  const allThemeButtons = page.locator('button, [role="button"], [role="radio"], [role="menuitemradio"]').filter({
    hasText: /\b(dark|light|theme|scheme|mode)\b/i,
  });
  const count = await allThemeButtons.count();
  if (count >= 2) {
    const specificBtn = allThemeButtons.filter({ hasText: targetWord });
    if ((await specificBtn.count()) > 0) {
      await specificBtn.first().click();
      return;
    }
  }

  // Otherwise, locate the single two-state toggle button
  const toggleBtn = page.locator(
    'button[id*="theme" i], button[class*="theme" i], button[id*="scheme" i], button[class*="scheme" i], button[id*="dark" i], button[class*="dark" i], button[aria-label*="theme" i], button[aria-label*="scheme" i], button[aria-label*="dark" i], button[aria-label*="light" i], nav button'
  );
  await toggleBtn.first().click();
}

async function applySystemDefaultInPage(page: Page, currentSystemScheme: 'light' | 'dark'): Promise<void> {
  // Check for explicit select dropdown (3-state select)
  const selectEl = page.locator('select').filter({
    has: page.locator('option[value="light"], option[value="dark"]'),
  });
  if ((await selectEl.count()) > 0) {
    const sysOption = selectEl.first().locator('option').filter({ hasText: /\b(system|auto|default|os)\b/i });
    if ((await sysOption.count()) > 0) {
      const val = await sysOption.first().getAttribute('value');
      await selectEl.first().selectOption(val ?? '');
      return;
    }
  }

  // Check for explicit system radio input
  const radioSys = page.locator('input[type="radio"][value="system"], input[type="radio"][value="auto"], input[type="radio"][value="light dark"], input[type="radio"][value=""]');
  if ((await radioSys.count()) > 0) {
    await radioSys.first().check({ force: true });
    return;
  }

  // Check if there is an explicit system button in a 3-state button group
  const sysBtn = page.locator('button, [role="button"], [role="radio"], [role="menuitemradio"]').filter({
    hasText: /\b(system|auto)\b/i,
  });
  if ((await sysBtn.count()) > 0) {
    await sysBtn.first().click();
    return;
  }

  // Otherwise, in a two-state control, toggle to the scheme that matches the current OS prefers-color-scheme
  await applyOppositeSchemeInPage(page, currentSystemScheme);
}

test.describe('dark-mode-toggle Target Grader', () => {
  // --- STATIC ASSERTIONS (FAST) ---

  test('Document <head> includes <meta name="color-scheme" content="light dark">', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasMetaInHead = docs.some(({ document }) => {
      const meta = document.querySelector('head meta[name="color-scheme"]');
      if (!meta) return false;
      const content = (meta.getAttribute('content') || '').trim().split(/\s+/);
      return content.length === 2 && content.includes('light') && content.includes('dark');
    });
    expect(hasMetaInHead).toBe(true);
  });

  test('Root element (:root or html) declares color-scheme: light dark as its base value', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = flattenCssRules(stylesheet.cssRules);
    const hasBaseColorScheme = allRules.some((r) => {
      if (!(r instanceof CSSStyleRule)) return false;
      const sel = getEffectiveStyleRuleSelector(r).trim();
      if (sel !== ':root' && sel !== 'html') return false;
      const val = r.style.getPropertyValue('color-scheme').trim().split(/\s+/);
      return val.length === 2 && val.includes('light') && val.includes('dark');
    });
    expect(hasBaseColorScheme).toBe(true);
  });

  test('Root element (:root or html) uses CSS :has() selectors matching meta[name="color-scheme"] with content="dark" and content="light" to set root color-scheme without JS classes', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const topRules = Array.from(stylesheet.cssRules);

    const resolvedProperly = docs.some(({ document }) => {
      const rootEl = document.documentElement;
      const metaEl = document.querySelector('head meta[name="color-scheme"]');
      if (!rootEl || !metaEl) return false;

      const origContent = metaEl.getAttribute('content') || 'light dark';

      metaEl.setAttribute('content', 'light dark');
      const baseStyle = getCascadedStyle(rootEl, topRules).getPropertyValue('color-scheme').trim();

      metaEl.setAttribute('content', 'dark');
      const darkStyle = getCascadedStyle(rootEl, topRules).getPropertyValue('color-scheme').trim();

      metaEl.setAttribute('content', 'light');
      const lightStyle = getCascadedStyle(rootEl, topRules).getPropertyValue('color-scheme').trim();

      metaEl.setAttribute('content', origContent);

      const baseParts = baseStyle.split(/\s+/);
      return (
        baseParts.length === 2 &&
        baseParts.includes('light') &&
        baseParts.includes('dark') &&
        darkStyle === 'dark' &&
        lightStyle === 'light'
      );
    });

    expect(resolvedProperly).toBe(true);
  });

  test('Synchronous inline <script> in <head> placed after <meta name="color-scheme"> reads localStorage and applies stored scheme override to the meta content', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasValidFoucScript = docs.some(({ document }) => {
      const head = document.querySelector('head');
      if (!head) return false;
      const children = Array.from(head.children) as any[];
      const metaIdx = children.findIndex(
        (el) =>
          el.tagName?.toLowerCase() === 'meta' &&
          el.getAttribute('name') === 'color-scheme'
      );
      if (metaIdx === -1) return false;

      const scriptsAfterMeta = children.slice(metaIdx + 1).filter((el) => {
        if (el.tagName?.toLowerCase() !== 'script') return false;
        if (el.hasAttribute('src')) return false;
        if (el.hasAttribute('defer') || el.hasAttribute('async')) return false;
        const typeAttr = (el.getAttribute('type') || '').trim().toLowerCase();
        if (typeAttr === 'module') return false;
        return true;
      });

      const project: Project = getJsProject(targetFiles);
      return scriptsAfterMeta.some((scriptEl) => {
        const text = scriptEl.textContent || '';
        const sf = project.createSourceFile('__fouc_check__.ts', text, { overwrite: true });
        const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
        const propAccesses = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);

        const readsLocalStorage =
          callExprs.some((ce) => {
            const exprText = ce.getExpression().getText();
            return exprText.includes('localStorage') && exprText.includes('getItem');
          }) ||
          propAccesses.some((pa) => pa.getExpression().getText().includes('localStorage'));

        const accessesMeta =
          callExprs.some((ce) => {
            const exprText = ce.getExpression().getText();
            const argsText = ce.getArguments().map((a) => a.getText()).join(' ');
            return (
              (exprText.includes('querySelector') && argsText.includes('color-scheme')) ||
              (exprText.includes('getElementsByName') && argsText.includes('color-scheme'))
            );
          });

        const updatesContent =
          propAccesses.some((pa) => pa.getName() === 'content') ||
          callExprs.some(
            (ce) =>
              ce.getExpression().getText().endsWith('setAttribute') &&
              ce.getArguments()[0]?.getText().includes('content')
          );

        return readsLocalStorage && accessesMeta && updatesContent;
      });
    });

    expect(hasValidFoucScript).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {
    test('Inline <script> in <head> applies stored localStorage scheme override to <meta name="color-scheme"> before render', async ({
      page,
      TARGET_URL,
    }) => {
      await page.addInitScript(() => {
        try {
          localStorage.setItem('color-scheme', 'dark');
        } catch {}
      });
      await page.goto(TARGET_URL);

      const state = await page.evaluate(() => {
        const meta = document.querySelector('head meta[name="color-scheme"]') as HTMLMetaElement | null;
        const rootScheme = window.getComputedStyle(document.documentElement).colorScheme;
        return {
          metaContent: meta?.content ?? null,
          rootScheme,
        };
      });

      expect(state).toEqual({ metaContent: 'dark', rootScheme: 'dark' });
    });

    test('Activating the color scheme control overrides the scheme, sets meta content, updates root computed color-scheme, and persists in localStorage', async ({
      page,
      TARGET_URL,
    }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(TARGET_URL);

      await applyOppositeSchemeInPage(page, 'dark');

      const state = await page.evaluate(() => {
        const meta = document.querySelector('head meta[name="color-scheme"]') as HTMLMetaElement | null;
        const rootScheme = window.getComputedStyle(document.documentElement).colorScheme;
        const storedValues: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) {
            const v = localStorage.getItem(k);
            if (v) storedValues.push(v);
          }
        }
        return {
          metaContent: meta?.content ?? null,
          rootScheme,
          hasStoredDark: storedValues.includes('dark'),
        };
      });

      expect(state).toEqual({
        metaContent: 'dark',
        rootScheme: 'dark',
        hasStoredDark: true,
      });
    });

    test('Returning the color scheme control to the system default restores <meta name="color-scheme"> content to "light dark" and removes the stored override from localStorage', async ({
      page,
      TARGET_URL,
    }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(TARGET_URL);

      // First override to dark
      await applyOppositeSchemeInPage(page, 'dark');
      // Now return to system default (light)
      await applySystemDefaultInPage(page, 'light');

      const state = await page.evaluate(() => {
        const meta = document.querySelector('head meta[name="color-scheme"]') as HTMLMetaElement | null;
        const storedValues: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) {
            const v = localStorage.getItem(k);
            if (v !== null) storedValues.push(v);
          }
        }
        const metaParts = (meta?.content ?? '').trim().split(/\s+/);
        const isMetaLightDark =
          metaParts.length === 2 && metaParts.includes('light') && metaParts.includes('dark');
        const hasAnySchemeStored = storedValues.some(
          (v) => v === 'light' || v === 'dark' || v === 'light dark' || v === 'dark light'
        );
        return {
          isMetaLightDark,
          hasAnySchemeStored,
        };
      });

      expect(state).toEqual({
        isMetaLightDark: true,
        hasAnySchemeStored: false,
      });
    });

    test('When a scheme override is stored in localStorage and OS prefers-color-scheme changes to match and then changes back, the override remains in localStorage and root stays pinned', async ({
      page,
      TARGET_URL,
    }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(TARGET_URL);

      // Override to dark while OS is light
      await applyOppositeSchemeInPage(page, 'dark');

      // OS changes to dark (matching the stored 'dark' override)
      await page.emulateMedia({ colorScheme: 'dark' });
      // OS changes back to light
      await page.emulateMedia({ colorScheme: 'light' });

      const state = await page.evaluate(() => {
        const meta = document.querySelector('head meta[name="color-scheme"]') as HTMLMetaElement | null;
        const rootScheme = window.getComputedStyle(document.documentElement).colorScheme;
        const storedValues: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) {
            const v = localStorage.getItem(k);
            if (v) storedValues.push(v);
          }
        }
        return {
          metaContent: meta?.content ?? null,
          rootScheme,
          hasStoredDark: storedValues.includes('dark'),
        };
      });

      expect(state).toEqual({
        metaContent: 'dark',
        rootScheme: 'dark',
        hasStoredDark: true,
      });
    });

    test('When localStorage is updated or removed from another tab (firing a storage event on window), the page updates <meta name="color-scheme"> content to stay in sync', async ({
      page,
      TARGET_URL,
    }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(TARGET_URL);

      const syncResults = await page.evaluate(() => {
        const meta = document.querySelector('head meta[name="color-scheme"]') as HTMLMetaElement | null;
        if (!meta) return null;

        // Simulate another tab setting 'dark'
        localStorage.setItem('color-scheme', 'dark');
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'color-scheme',
            oldValue: null,
            newValue: 'dark',
            storageArea: localStorage,
          })
        );
        const afterDark = meta.content;

        // Simulate another tab setting 'light'
        localStorage.setItem('color-scheme', 'light');
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'color-scheme',
            oldValue: 'dark',
            newValue: 'light',
            storageArea: localStorage,
          })
        );
        const afterLight = meta.content;

        // Simulate another tab removing the key
        localStorage.removeItem('color-scheme');
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'color-scheme',
            oldValue: 'light',
            newValue: null,
            storageArea: localStorage,
          })
        );
        const removedParts = meta.content.trim().split(/\s+/);
        const afterRemoveIsLightDark =
          removedParts.length === 2 && removedParts.includes('light') && removedParts.includes('dark');

        return {
          afterDark,
          afterLight,
          afterRemoveIsLightDark,
        };
      });

      expect(syncResults).toEqual({
        afterDark: 'dark',
        afterLight: 'light',
        afterRemoveIsLightDark: true,
      });
    });
  });
});
