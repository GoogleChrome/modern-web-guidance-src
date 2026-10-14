import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { parseHTML } from 'linkedom';
import {
  parse,
  CSSStyleRule,
  CSSContainerRule,
  type CSSRule,
  type CSSGroupingRule,
  type CSSStyleSheet,
} from 'cssomnom';

// @ts-ignore TS1470: import.meta is allowed in ES modules / test runner environment
const targetFiles: string[] = getTargetFiles(import.meta.url);

function flattenRules(rules: Iterable<CSSRule>): CSSRule[] {
  const result: CSSRule[] = [];
  for (const rule of rules) {
    result.push(rule);
    if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
      result.push(...flattenRules((rule as CSSGroupingRule).cssRules));
    }
  }
  return result;
}

function getShadowCssRules(files: string[]): CSSRule[] {
  const rules: CSSRule[] = [];

  const project = getJsProject(files);
  for (const sf of project.getSourceFiles()) {
    const text = sf.getFullText();
    const styleMatches = text.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    if (styleMatches) {
      for (const m of styleMatches) {
        const css = m.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, '');
        const sheet: CSSStyleSheet = parse(css);
        rules.push(...flattenRules(sheet.cssRules));
      }
    }
  }

  const docs = getHtmlDocuments(files);
  for (const { document } of docs) {
    document.querySelectorAll('template').forEach((tmpl: any) => {
      const templateHtml = tmpl.innerHTML || tmpl.content?.innerHTML || tmpl.textContent || '';
      const matches = templateHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
      if (matches) {
        for (const m of matches) {
          const css = m.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, '');
          const sheet: CSSStyleSheet = parse(css);
          rules.push(...flattenRules(sheet.cssRules));
        }
      }
    });
  }

  return rules;
}

function getOuterCssRules(files: string[]): CSSRule[] {
  const sheet = getCssStyleSheet(files);
  return flattenRules(sheet.cssRules);
}

function getShadowPartAttributes(files: string[]): string[] {
  const parts: string[] = [];

  const docs = getHtmlDocuments(files);
  for (const { document } of docs) {
    document.querySelectorAll('template').forEach((tmpl: any) => {
      const templateHtml = tmpl.innerHTML || tmpl.content?.innerHTML || tmpl.textContent || '';
      if (templateHtml) {
        const { document: tmplDoc } = parseHTML(templateHtml);
        tmplDoc.querySelectorAll('[part]').forEach((el: any) => {
          const val = el.getAttribute('part');
          if (val) parts.push(val);
        });
      }
    });
  }

  const project = getJsProject(files);
  for (const sf of project.getSourceFiles()) {
    const text = sf.getFullText();
    const partMatches = text.match(/part\s*=\s*["']([^"']+)["']/g);
    if (partMatches) {
      for (const m of partMatches) {
        const cleaned = m.replace(/^part\s*=\s*["']/i, '').replace(/["']$/i, '');
        parts.push(cleaned);
      }
    }
  }

  return parts;
}

test.describe('Styling Web Components Target Grader', () => {

  // --- STATIC ASSERTIONS (FAST) ---

  test("The component's shadow stylesheet sets the host's display with a :host rule", () => {
    const shadowRules = getShadowCssRules(targetFiles);
    const hostRule = shadowRules.find(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule && /(^|,)\s*:host\b/.test(r.selectorText)
    );
    const displayVal = hostRule?.style.getPropertyValue('display')?.trim();
    expect(Boolean(displayVal)).toBe(true);
  });

  test("The component's shadow stylesheet does not use :host-context()", () => {
    const shadowRules = getShadowCssRules(targetFiles);
    const hasShadowSheet = shadowRules.length > 0;
    const usesHostContext = shadowRules.some(
      r => r instanceof CSSStyleRule && r.selectorText.includes(':host-context')
    );
    expect(hasShadowSheet && !usesHostContext).toBe(true);
  });

  test("Public theming custom properties are not declared on :host", () => {
    const shadowRules = getShadowCssRules(targetFiles);
    const hostRules = shadowRules.filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule && /(^|,)\s*:host\b/.test(r.selectorText)
    );
    expect(
      hostRules.length > 0 &&
      !hostRules.some(r =>
        Array.from(r.style).some(prop => prop.startsWith('--') && !prop.startsWith('--_'))
      )
    ).toBe(true);
  });

  test("Public theming custom properties are read with a var() fallback in the shadow stylesheet", () => {
    const shadowRules = getShadowCssRules(targetFiles);
    const readsPublicWithFallback = shadowRules.some(r => {
      if (r instanceof CSSStyleRule) {
        return /var\(\s*--(?![_])[a-zA-Z0-9_-]+,\s*[^)]+\)/.test(r.style.cssText);
      }
      return false;
    });
    expect(readsPublicWithFallback).toBe(true);
  });

  test("The shadow tree exposes designated internal elements via the part attribute", () => {
    const parts = getShadowPartAttributes(targetFiles);
    expect(parts.length > 0).toBe(true);
  });

  test("The outer stylesheet styles exposed parts across the shadow boundary using ::part()", () => {
    const outerRules = getOuterCssRules(targetFiles);
    const hasPartSelector = outerRules.some(
      r => r instanceof CSSStyleRule && /::part\([^)]+\)/.test(r.selectorText)
    );
    expect(hasPartSelector).toBe(true);
  });

  test("The element given container-type has a display property other than inline or contents", () => {
    const shadowRules = getShadowCssRules(targetFiles);
    const containerRule = shadowRules.find(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule &&
        (/\b(inline-size|size)\b/.test(r.style.getPropertyValue('container-type')) ||
         /\b(inline-size|size)\b/.test(r.style.getPropertyValue('container')))
    );
    const displayVal = containerRule?.style.getPropertyValue('display')?.trim().toLowerCase();
    expect(
      Boolean(displayVal) && displayVal !== 'inline' && displayVal !== 'contents'
    ).toBe(true);
  });

  test("The component's shadow stylesheet includes a @container rule", () => {
    const shadowRules = getShadowCssRules(targetFiles);
    const hasContainerRule = shadowRules.some(r => r instanceof CSSContainerRule);
    expect(hasContainerRule).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {

    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
      await page.waitForFunction(
        () => Array.from(document.querySelectorAll('*')).some(el => el.tagName.includes('-') && el.shadowRoot !== null),
        { timeout: 5000 }
      ).catch(() => {});
    });

    test('Setting the public theming property on a Light DOM ancestor changes the internal element computed style', async ({ page }) => {
      const computedBg = await page.evaluate(() => {
        const customCard = Array.from(document.querySelectorAll('*')).find(
          el => el.tagName.includes('-') && el.shadowRoot !== null
        ) as HTMLElement | undefined;
        if (!customCard || !customCard.shadowRoot) return null;

        const internalEl = customCard.shadowRoot.querySelector(
          '.card, [part*="card"], [part*="surface"], article, div'
        ) as HTMLElement | null;
        if (!internalEl) return null;

        for (const sheet of Array.from(document.styleSheets)) {
          try {
            for (const rule of Array.from(sheet.cssRules)) {
              if (rule instanceof CSSStyleRule && customCard.matches(rule.selectorText)) {
                rule.style.removeProperty('--card-bg');
              }
            }
          } catch {}
        }

        const ancestor = customCard.parentElement || document.body;
        ancestor.style.setProperty('--card-bg', 'rgb(111, 222, 133)');
        return window.getComputedStyle(internalEl).backgroundColor;
      });

      expect(computedBg).toBe('rgb(111, 222, 133)');
    });

    test('The outer stylesheet ::part() rule changes the computed style of the exposed internal element', async ({ page }) => {
      const partMatchesOuterStyle = await page.evaluate(() => {
        const customCard = Array.from(document.querySelectorAll('*')).find(
          el => el.tagName.includes('-') && el.shadowRoot !== null
        );
        if (!customCard || !customCard.shadowRoot) return false;

        const partElements = customCard.shadowRoot.querySelectorAll('[part]');
        if (partElements.length === 0) return false;

        return Array.from(partElements).some(el => {
          const style = window.getComputedStyle(el);
          return style.backgroundColor === 'rgb(78, 52, 46)' || style.color === 'rgb(78, 52, 46)';
        });
      });

      expect(partMatchesOuterStyle).toBe(true);
    });

    test('The @container rule changes the internal element computed style when inline size crosses the breakpoint', async ({ page }) => {
      const styleChangedOnBreakpoint = await page.evaluate(async () => {
        const customCard = Array.from(document.querySelectorAll('*')).find(
          el => el.tagName.includes('-') && el.shadowRoot !== null
        ) as HTMLElement | undefined;
        if (!customCard || !customCard.shadowRoot) return false;

        const internalCard = customCard.shadowRoot.querySelector(
          '.card, [part*="card"], [part*="surface"], article, div'
        ) as HTMLElement | null;
        if (!internalCard) return false;

        customCard.style.width = '280px';
        customCard.style.maxWidth = '280px';
        await new Promise(r => requestAnimationFrame(r));
        const narrowStyle = window.getComputedStyle(internalCard);
        const narrowPadding = narrowStyle.padding;
        const narrowGridCols = narrowStyle.gridTemplateColumns;
        const narrowFlexDir = narrowStyle.flexDirection;

        customCard.style.width = '600px';
        customCard.style.maxWidth = '600px';
        await new Promise(r => requestAnimationFrame(r));
        const wideStyle = window.getComputedStyle(internalCard);
        const widePadding = wideStyle.padding;
        const wideGridCols = wideStyle.gridTemplateColumns;
        const wideFlexDir = wideStyle.flexDirection;

        return (
          narrowPadding !== widePadding ||
          narrowGridCols !== wideGridCols ||
          narrowFlexDir !== wideFlexDir
        );
      });

      expect(styleChangedOnBreakpoint).toBe(true);
    });
  });
});
