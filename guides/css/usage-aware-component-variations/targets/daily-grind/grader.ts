import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSStyleRule,
  CSSContainerRule,
  CSSGroupingRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';
import type { Document } from 'linkedom';

// @ts-ignore - package.json omits "type": "module" locally, though Playwright runs ESM
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...getAllStyleRules(rule.cssRules));
    }
  }
  return result;
}

function getAllContainerRules(rules: Iterable<CSSRule>): CSSContainerRule[] {
  const result: CSSContainerRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSContainerRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...getAllContainerRules(rule.cssRules));
    }
  }
  return result;
}

function hasCustomProperty(rule: CSSStyleRule): boolean {
  for (let i = 0; i < rule.style.length; i++) {
    const prop = rule.style.item(i);
    if (prop && prop.startsWith('--')) {
      return true;
    }
  }
  return false;
}

test.describe('usage-aware-component-variations Target Grader', () => {
  test('Parent containers define semantic context flags using CSS custom properties', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const topLevelStyleRules = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule
    );

    // Exclude :root (which only holds global design tokens in the base app)
    const contextRules = topLevelStyleRules.filter(
      (r) => r.selectorText.trim() !== ':root' && hasCustomProperty(r)
    );

    expect(contextRules.length).toBeGreaterThan(0);
  });

  test('Component uses @container style() queries to adapt its internal visual logic based on inherited properties', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const containerRules = getAllContainerRules(stylesheet.cssRules);

    const styleQueryRules = containerRules.filter((r) => {
      const query = r.conditionText || r.containerQuery || '';
      const nestedStyles = getAllStyleRules(r.cssRules);
      return /\bstyle\s*\(\s*--/.test(query) && nestedStyles.length > 0;
    });

    expect(styleQueryRules.length).toBeGreaterThan(0);
  });

  test('When the context is active (e.g., featured/seasonal), the component reveals promotional elements and applies prominent styling', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const containerRules = getAllContainerRules(stylesheet.cssRules);

    const revealsPromotionalInStyleQuery = containerRules.some((r) => {
      const query = r.conditionText || r.containerQuery || '';
      if (!/\bstyle\s*\(\s*--/.test(query)) return false;

      const nestedStyles = getAllStyleRules(r.cssRules);
      const revealsElement = nestedStyles.some((sr) => {
        const display = sr.style.getPropertyValue('display').trim();
        return Boolean(display && display !== 'none');
      });
      const stylesComponent = nestedStyles.some((sr) => {
        const bg =
          sr.style.getPropertyValue('background') ||
          sr.style.getPropertyValue('background-color');
        const border =
          sr.style.getPropertyValue('border') ||
          sr.style.getPropertyValue('border-color') ||
          sr.style.getPropertyValue('border-top');
        return Boolean(bg || border);
      });

      return revealsElement && stylesComponent;
    });

    expect(revealsPromotionalInStyleQuery).toBe(true);
  });

  test('When the surface is unset (default), the component hides promotional elements and uses a default card/button style', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs: Array<{ file: string; document: Document }> =
      getHtmlDocuments(targetFiles);

    // Top-level style rules (outside @container) define the unset/default state
    const topLevelStyleRules = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule
    );

    const hidesPromotionalByDefault = topLevelStyleRules.some(
      (r) => r.style.getPropertyValue('display').trim() === 'none'
    );

    const hasPromotionalMarkupInCard = docs.some((d) =>
      Boolean(
        d.document.querySelector(
          '.card [class*="badge"], .card span, .card small, .card strong'
        )
      )
    );

    expect(hidesPromotionalByDefault && hasPromotionalMarkupInCard).toBe(true);
  });

  test('The component does NOT rely on size queries (min-width or max-width) for this semantic variation', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const containerRules = getAllContainerRules(stylesheet.cssRules);
    const allStyleRules = getAllStyleRules(stylesheet.cssRules);

    const hasStyleContainerRules = containerRules.some((r) =>
      /\bstyle\s*\(\s*--/.test(r.conditionText || r.containerQuery || '')
    );

    const usesSizeContainerQueries = containerRules.some((r) =>
      /\b(min-width|max-width|inline-size|block-size|width|height)\b/i.test(
        r.conditionText || r.containerQuery || ''
      )
    );

    const setsContainerType = allStyleRules.some((r) => {
      const ct = r.style.getPropertyValue('container-type').trim();
      return Boolean(ct && ct !== 'normal');
    });

    expect(
      hasStyleContainerRules && !usesSizeContainerQueries && !setsContainerType
    ).toBe(true);
  });

  test('A progressive-enhancement fallback or baseline usable styling is provided for browsers without style query support', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const topLevelStyleRules = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule
    );
    const containerRules = getAllContainerRules(stylesheet.cssRules);

    const hasStyleContainerRules = containerRules.some((r) =>
      /\bstyle\s*\(\s*--/.test(r.conditionText || r.containerQuery || '')
    );

    // Check for explicit :where() selector fallback OR baseline default component rules that work alongside @container style()
    const hasWhereFallback = topLevelStyleRules.some((r) =>
      r.selectorText.includes(':where(')
    );
    const hasBaselineFallbackWithStyleQuery =
      hasStyleContainerRules &&
      topLevelStyleRules.some(
        (r) =>
          /\b(card|btn)\b/.test(r.selectorText) &&
          r.style.getPropertyValue('background') !== ''
      );

    expect(hasWhereFallback || hasBaselineFallbackWithStyleQuery).toBe(true);
  });
});
