import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSRule,
  CSSStyleRule,
  CSSContainerRule,
  type CSSStyleSheet,
} from 'cssomnom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllRules(stylesheet: CSSStyleSheet): CSSRule[] {
  const allRules: CSSRule[] = [];
  function collect(ruleList: Iterable<CSSRule>) {
    for (const r of ruleList) {
      allRules.push(r);
      if ('cssRules' in r && r.cssRules) {
        collect(Array.from(r.cssRules as Iterable<CSSRule>));
      }
    }
  }
  collect(Array.from(stylesheet.cssRules));
  return allRules;
}

const isBadgeRule = (r: CSSStyleRule) =>
  /\bbadge\b/i.test(r.selectorText) || r.selectorText.includes('badge');
const isButtonRule = (r: CSSStyleRule) =>
  /\b(button|chip|cta|action)\b/i.test(r.selectorText) ||
  r.selectorText.includes('button') ||
  r.selectorText.includes('chip');

test.describe('usage-aware-component-variations Target Grader', () => {

  test('The parent containers define semantic context flags using CSS custom properties', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllRules(stylesheet);
    const docs = getHtmlDocuments(targetFiles);

    expect(rules.length + docs.length).toBeGreaterThan(0);

    const queriedCustomProps = new Set<string>();
    for (const r of rules) {
      if (r instanceof CSSContainerRule) {
        for (const m of r.conditionText.matchAll(/style\(\s*(--[\w-]+)\s*:/gi)) {
          queriedCustomProps.add(m[1].toLowerCase());
        }
      }
    }

    const hasCustomPropertyRule = rules.some((r) => {
      if (r instanceof CSSStyleRule && queriedCustomProps.size > 0) {
        for (const prop of queriedCustomProps) {
          const val = r.style.getPropertyValue(prop)?.trim();
          if (val && val.length > 0) return true;
          const escapedProp = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (new RegExp(`${escapedProp}\\s*:\\s*[^;]+`, 'i').test(r.style.cssText)) {
            return true;
          }
        }
      }
      return false;
    });

    const hasInlineContextFlag = docs.some((d) =>
      Array.from(queriedCustomProps).some((prop) =>
        Boolean(d.document.querySelector(`[style*="${prop}"]`))
      )
    );

    expect(hasCustomPropertyRule || hasInlineContextFlag).toBe(true);
  });

  test('The component uses @container style() queries to adapt its internal visual logic based on inherited properties', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllRules(stylesheet);

    const styleContainerRules = rules.filter(
      (r): r is CSSContainerRule =>
        r instanceof CSSContainerRule && /style\s*\(/i.test(r.conditionText)
    );

    expect(styleContainerRules.length).toBeGreaterThan(0);

    const queriesSemanticProperty = styleContainerRules.some((r) =>
      /style\(\s*--[\w-]+\s*:/i.test(r.conditionText)
    );
    expect(queriesSemanticProperty).toBe(true);

    const hasNestedVisualRules = styleContainerRules.some((r) =>
      Array.from(r.cssRules).some(
        (nested) => nested instanceof CSSStyleRule && nested.style.length > 0
      )
    );
    expect(hasNestedVisualRules).toBe(true);
  });

  test('When the surface is featured, the component reveals promotional elements and uses a more prominent filled button style', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllRules(stylesheet);

    const featuredContextRules: CSSStyleRule[] = [];
    for (const r of rules) {
      if (
        r instanceof CSSContainerRule &&
        /style\s*\([^)]*featured[^)]*\)/i.test(r.conditionText)
      ) {
        for (const nested of r.cssRules) {
          if (nested instanceof CSSStyleRule) {
            featuredContextRules.push(nested);
          }
        }
      }
      if (
        r instanceof CSSStyleRule &&
        /:where\([^)]*featured[^)]*\)/i.test(r.selectorText)
      ) {
        featuredContextRules.push(r);
      }
    }

    expect(featuredContextRules.length).toBeGreaterThan(0);

    const revealsPromotionalElement = featuredContextRules.some((r) => {
      if (!isBadgeRule(r)) return false;
      const display = r.style.getPropertyValue('display')?.trim().toLowerCase();
      return Boolean(display && display !== 'none');
    });
    expect(revealsPromotionalElement).toBe(true);

    const hasFilledButtonStyle = featuredContextRules.some((r) => {
      if (!isButtonRule(r)) return false;
      const bg = (
        r.style.getPropertyValue('background') ||
        r.style.getPropertyValue('background-color')
      )
        ?.trim()
        .toLowerCase();
      return Boolean(
        bg && bg !== 'transparent' && bg !== 'none' && bg !== 'initial'
      );
    });
    expect(hasFilledButtonStyle).toBe(true);
  });

  test('When the surface is unset (default), the component hides promotional elements and uses a more subtle outlined button style', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllRules(stylesheet);

    const defaultStyleRules: CSSStyleRule[] = [];
    for (const r of rules) {
      if (r instanceof CSSStyleRule) {
        if (
          !/:where\([^)]*(?:^|[^a-zA-Z0-9_-])featured(?![a-zA-Z0-9_-])[^)]*\)/i.test(
            r.selectorText
          ) &&
          !/\.featured(?![a-zA-Z0-9_-])/i.test(r.selectorText)
        ) {
          let inContainer = false;
          let parent: CSSRule | null = r.parentRule;
          while (parent) {
            if (parent instanceof CSSContainerRule) {
              inContainer = true;
              break;
            }
            parent = parent.parentRule;
          }
          if (!inContainer) {
            defaultStyleRules.push(r);
          }
        }
      }
    }

    expect(defaultStyleRules.length).toBeGreaterThan(0);

    const hidesPromotionalElement = defaultStyleRules.some((r) => {
      if (!isBadgeRule(r)) return false;
      const display = r.style.getPropertyValue('display')?.trim().toLowerCase();
      return display === 'none';
    });
    expect(hidesPromotionalElement).toBe(true);

    const hasOutlinedButtonStyle = defaultStyleRules.some((r) => {
      if (!isButtonRule(r)) return false;
      const bg = r.style.getPropertyValue('background')?.trim().toLowerCase();
      const bgColor = r.style
        .getPropertyValue('background-color')
        ?.trim()
        .toLowerCase();
      const hasTransparentBg =
        (!bg && !bgColor) ||
        bg === 'transparent' ||
        bg === 'none' ||
        bgColor === 'transparent' ||
        bg?.includes('transparent') ||
        bgColor?.includes('transparent');
      const border = (
        r.style.getPropertyValue('border') ||
        r.style.getPropertyValue('border-width') ||
        r.style.getPropertyValue('border-color') ||
        r.style.getPropertyValue('border-style')
      )
        ?.trim()
        .toLowerCase();
      const hasBorder = Boolean(
        border && border !== 'none' && border !== '0' && border !== '0px'
      );
      return hasTransparentBg && hasBorder;
    });
    expect(hasOutlinedButtonStyle).toBe(true);
  });

  test('The component does NOT rely on size queries (min-width or max-width) for this semantic variation', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllRules(stylesheet);

    const semanticContainerRules = rules.filter(
      (r): r is CSSContainerRule =>
        r instanceof CSSContainerRule && /style\s*\(/i.test(r.conditionText)
    );
    expect(semanticContainerRules.length).toBeGreaterThan(0);

    const reliesOnSizeQuery = semanticContainerRules.some((r) =>
      /\b(min-width|max-width|inline-size|width)\b/i.test(r.conditionText)
    );
    expect(reliesOnSizeQuery).toBe(false);
  });

  test('A progressive-enhancement fallback using selectors with :where() is provided so browsers without style query support still get the contextual styling', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllRules(stylesheet);

    const hasWhereFallback = rules.some(
      (r) =>
        r instanceof CSSStyleRule &&
        /:where\([^)]*(?:featured|surface)[^)]*\)/i.test(r.selectorText)
    );

    expect(hasWhereFallback).toBe(true);

    const invalidDescendantFallback = rules.some((r): boolean => {
      if (!(r instanceof CSSStyleRule)) return false;
      const sel = r.selectorText;
      return (
        /(?:^|,\s*)(?:\.featured|\[class\*="featured"\])\s+[a-z0-9-_.]+/i.test(
          sel
        ) && !sel.includes(':where(')
      );
    });
    expect(invalidDescendantFallback).toBe(false);
  });
});
