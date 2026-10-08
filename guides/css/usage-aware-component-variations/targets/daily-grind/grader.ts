import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { CSSStyleRule, CSSContainerRule, type CSSRule } from 'cssomnom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('usage-aware-component-variations Target Grader', () => {
  // --- STATIC ASSERTIONS (FAST) ---

  test('Parent container defines semantic context flags using CSS custom property (--surface)', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const hasSurfaceCustomProperty = rules.some((rule): rule is CSSStyleRule => {
      if (!(rule instanceof CSSStyleRule)) return false;
      return rule.style.getPropertyValue('--surface').trim().length > 0;
    });
    expect(hasSurfaceCustomProperty).toBe(true);
  });

  test('HTML markup establishes semantic context on parent container elements', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasFeaturedContainer = docs.some(d =>
      Boolean(d.document.querySelector('.featured, [data-surface="featured"], [data-surface]'))
    );
    expect(hasFeaturedContainer).toBe(true);
  });

  test('Component markup includes promotional badge elements', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasBadgeElement = docs.some(d =>
      Boolean(d.document.querySelector('.card .badge, .badge, [class*="badge"]'))
    );
    expect(hasBadgeElement).toBe(true);
  });

  test('Component visual logic adapts using container style query (@container style()) referencing semantic property', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const hasContainerStyleQuery = rules.some((r): r is CSSContainerRule =>
      r instanceof CSSContainerRule &&
      /style\s*\(/i.test(r.conditionText) &&
      r.conditionText.includes('--surface')
    );
    expect(hasContainerStyleQuery).toBe(true);
  });

  test('Container style query reveals promotional badge elements in featured context', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const containerRules = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSContainerRule => r instanceof CSSContainerRule && /style\s*\(/i.test(r.conditionText)
    );
    const revealsBadgeInStyleQuery = containerRules.some(cRule => {
      const nested = Array.from(cRule.cssRules);
      return nested.some((r): r is CSSStyleRule => {
        if (!(r instanceof CSSStyleRule)) return false;
        if (!/\bbadge\b/i.test(r.selectorText)) return false;
        const display = r.style.getPropertyValue('display').trim();
        return (
          display === 'block' ||
          display === 'inline-block' ||
          display === 'flex' ||
          (display.length > 0 && display !== 'none')
        );
      });
    });
    expect(revealsBadgeInStyleQuery).toBe(true);
  });

  test('Container style query applies prominent filled button style in featured context', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const containerRules = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSContainerRule => r instanceof CSSContainerRule && /style\s*\(/i.test(r.conditionText)
    );
    const hasFilledButtonInStyleQuery = containerRules.some(cRule => {
      const nested = Array.from(cRule.cssRules);
      return nested.some((r): r is CSSStyleRule => {
        if (!(r instanceof CSSStyleRule)) return false;
        if (!/\b(btn|button)\b/i.test(r.selectorText)) return false;
        const bg = r.style.getPropertyValue('background').trim() || r.style.getPropertyValue('background-color').trim();
        return bg.length > 0 && bg !== 'transparent' && bg !== 'none';
      });
    });
    expect(hasFilledButtonInStyleQuery).toBe(true);
  });

  test('Component hides promotional badge elements by default when surface context is unset', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const hasHiddenBadgeByDefault = rules.some((r): r is CSSStyleRule => {
      if (!(r instanceof CSSStyleRule)) return false;
      if (!/\bbadge\b/i.test(r.selectorText)) return false;
      if (r.selectorText.includes(':where')) return false;
      return r.style.getPropertyValue('display').trim() === 'none';
    });
    expect(hasHiddenBadgeByDefault).toBe(true);
  });

  test('Component uses subtle outlined button style by default when surface context is unset', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const hasOutlinedButtonByDefault = rules.some((r): r is CSSStyleRule => {
      if (!(r instanceof CSSStyleRule)) return false;
      if (!/\b(btn|button)\b/i.test(r.selectorText)) return false;
      if (r.selectorText.includes(':where')) return false;
      const bg = r.style.getPropertyValue('background').trim();
      const bgColor = r.style.getPropertyValue('background-color').trim();
      const border =
        r.style.getPropertyValue('border').trim() ||
        r.style.getPropertyValue('border-width').trim() ||
        r.style.getPropertyValue('border-color').trim() ||
        r.style.getPropertyValue('border-style').trim();
      const isBgTransparent = bg === 'transparent' || bg === 'none' || bgColor === 'transparent';
      return isBgTransparent && border.length > 0;
    });
    expect(hasOutlinedButtonByDefault).toBe(true);
  });

  test('Component does not rely on container size queries for semantic surface variations', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const styleContainerRules = rules.filter(
      (r): r is CSSContainerRule => r instanceof CSSContainerRule && /style\s*\(/i.test(r.conditionText)
    );
    const avoidsSizeQueriesForSemanticVariation =
      styleContainerRules.length > 0 &&
      styleContainerRules.every(r => !/\b(min-width|max-width|inline-size|width|height)\s*:/i.test(r.conditionText));
    expect(avoidsSizeQueriesForSemanticVariation).toBe(true);
  });

  test('Implementation uses CSS logical properties for consistent layout and spacing', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const logicalPropPattern =
      /\b(inline-size|min-inline-size|max-inline-size|block-size|min-block-size|max-block-size|inset-block|inset-block-start|inset-block-end|inset-inline|inset-inline-start|inset-inline-end|margin-block|margin-block-start|margin-block-end|margin-inline|margin-inline-start|margin-inline-end|padding-block|padding-block-start|padding-block-end|padding-inline|padding-inline-start|padding-inline-end)\b/;

    function countLogicalProps(ruleList: CSSRule[]): number {
      let count = 0;
      for (const rule of ruleList) {
        if (rule instanceof CSSStyleRule) {
          for (let i = 0; i < rule.style.length; i++) {
            if (logicalPropPattern.test(rule.style[i])) {
              count++;
            }
          }
        }
        if ('cssRules' in rule && rule.cssRules) {
          count += countLogicalProps(Array.from(rule.cssRules as unknown as CSSRule[]));
        }
      }
      return count;
    }

    const logicalPropertyCount = countLogicalProps(rules);
    expect(logicalPropertyCount).toBeGreaterThanOrEqual(3);
  });

  test('Progressive-enhancement fallback using :where() reveals promotional badge elements', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const hasWhereBadgeFallback = rules.some((r): r is CSSStyleRule => {
      if (!(r instanceof CSSStyleRule)) return false;
      if (!r.selectorText.includes(':where(')) return false;
      if (!/\bbadge\b/i.test(r.selectorText)) return false;
      const display = r.style.getPropertyValue('display').trim();
      return display === 'block' || display === 'inline-block' || (display.length > 0 && display !== 'none');
    });
    expect(hasWhereBadgeFallback).toBe(true);
  });

  test('Progressive-enhancement fallback using :where() applies prominent filled button style', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const hasWhereButtonFallback = rules.some((r): r is CSSStyleRule => {
      if (!(r instanceof CSSStyleRule)) return false;
      if (!r.selectorText.includes(':where(')) return false;
      if (!/\b(btn|button)\b/i.test(r.selectorText)) return false;
      const bg = r.style.getPropertyValue('background').trim() || r.style.getPropertyValue('background-color').trim();
      return bg.length > 0 && bg !== 'transparent' && bg !== 'none';
    });
    expect(hasWhereButtonFallback).toBe(true);
  });
});
