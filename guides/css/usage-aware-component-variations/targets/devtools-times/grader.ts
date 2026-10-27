import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { parse, CSSStyleRule, CSSContainerRule, type CSSRule } from 'cssomnom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function extractStyleRules(rules: CSSRule[]): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    } else if ('cssRules' in rule && (rule as any).cssRules) {
      const subRules = Array.from((rule as any).cssRules) as CSSRule[];
      result.push(...extractStyleRules(subRules));
    }
  }
  return result;
}

function getAllCssRules(files: string[]): CSSRule[] {
  const sheet = getCssStyleSheet(files);
  const rules = Array.from(sheet.cssRules);

  const docs = getHtmlDocuments(files);
  for (const { document } of docs) {
    const styleEls = document.querySelectorAll('style');
    for (const styleEl of styleEls) {
      const text = styleEl.textContent || '';
      if (text.includes(':global(')) {
        const unwrapped = text.replace(/:global\(([\s\S]*?)\)/g, '$1');
        const extraSheet = parse(unwrapped);
        for (const rule of Array.from(extraSheet.cssRules)) {
          if (!rules.some(r => r.cssText === rule.cssText)) {
            rules.push(rule);
          }
        }
      }
    }
  }

  return rules;
}

const isBadgeRule = (r: CSSStyleRule) => /\bbadge\b/i.test(r.selectorText) || r.selectorText.includes('badge');
const isButtonRule = (r: CSSStyleRule) => /\b(button|chip|cta|action)\b/i.test(r.selectorText) || r.selectorText.includes('button') || r.selectorText.includes('chip');

test.describe('Usage-Aware Component Variations Grader', () => {

  test('Parent container defines semantic context flags using CSS custom properties', () => {
    const rules = getAllCssRules(targetFiles);
    const allStyleRules = extractStyleRules(rules);
    const hasSurfaceProperty = allStyleRules.some(r => {
      const surfaceVal = r.style.getPropertyValue('--surface') || '';
      return surfaceVal.includes('featured');
    });
    expect(hasSurfaceProperty).toBe(true);
  });

  test('Parent container elements in template markup provide the semantic context flag', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasContextMarkup = docs.some(({ document }) => {
      return Boolean(
        document.querySelector(
          '.featured, .surface-featured, [data-surface="featured"], [class*="featured"], [class*="surface-featured"]'
        )
      );
    });
    expect(hasContextMarkup).toBe(true);
  });

  test('Component uses @container style() queries to query the semantic context property', () => {
    const rules = getAllCssRules(targetFiles);
    const containerRules = rules.filter((r): r is CSSContainerRule => r instanceof CSSContainerRule);
    const hasStyleQuery = containerRules.some(r => {
      const cond = r.conditionText.toLowerCase();
      return cond.includes('style(') && cond.includes('--surface') && cond.includes('featured');
    });
    expect(hasStyleQuery).toBe(true);
  });

  test('Promotional badge is revealed within the featured container style query', () => {
    const rules = getAllCssRules(targetFiles);
    const containerRules = rules.filter((r): r is CSSContainerRule => r instanceof CSSContainerRule);
    const styleQueryRules = containerRules.filter(r => r.conditionText.includes('style('));
    const nestedRules = styleQueryRules.flatMap(r => Array.from(r.cssRules) as CSSRule[]);
    const badgeRule = nestedRules.find((r): r is CSSStyleRule => r instanceof CSSStyleRule && isBadgeRule(r));
    const badgeDisplay = badgeRule?.style.getPropertyValue('display') || '';
    const isBadgeRevealed = ['block', 'inline-block', 'inline-flex', 'flex'].includes(badgeDisplay.trim());
    expect(isBadgeRevealed).toBe(true);
  });

  test('Button uses a prominent filled style within the featured container style query', () => {
    const rules = getAllCssRules(targetFiles);
    const containerRules = rules.filter((r): r is CSSContainerRule => r instanceof CSSContainerRule);
    const styleQueryRules = containerRules.filter(r => r.conditionText.includes('style('));
    const nestedRules = styleQueryRules.flatMap(r => Array.from(r.cssRules) as CSSRule[]);
    const buttonRule = nestedRules.find((r): r is CSSStyleRule => r instanceof CSSStyleRule && isButtonRule(r));
    const bg = buttonRule?.style.getPropertyValue('background') || buttonRule?.style.getPropertyValue('background-color') || '';
    const isFilled = bg.length > 0 && bg !== 'transparent' && bg !== 'none';
    expect(isFilled).toBe(true);
  });

  test('Promotional badge is hidden by default when surface context is unset', () => {
    const rules = getAllCssRules(targetFiles);
    const defaultBadgeRule = rules.find((r): r is CSSStyleRule => {
      return r instanceof CSSStyleRule && isBadgeRule(r) && !r.selectorText.includes(':where');
    });
    const defaultBadgeDisplay = defaultBadgeRule?.style.getPropertyValue('display');
    expect(defaultBadgeDisplay).toBe('none');
  });

  test('Button uses an outlined style with transparent background and border by default when surface context is unset', () => {
    const rules = getAllCssRules(targetFiles);
    const defaultButtonRule = rules.find((r): r is CSSStyleRule => {
      return r instanceof CSSStyleRule && isButtonRule(r) && !r.selectorText.includes(':where');
    });
    const defaultBg = defaultButtonRule?.style.getPropertyValue('background-color') || defaultButtonRule?.style.getPropertyValue('background') || '';
    const hasBorder = defaultButtonRule ? (
      defaultButtonRule.style.getPropertyValue('border') !== '' ||
      defaultButtonRule.style.getPropertyValue('border-width') !== '' ||
      defaultButtonRule.style.getPropertyValue('border-color') !== '' ||
      defaultButtonRule.style.getPropertyValue('border-style') !== ''
    ) : false;
    const isOutlined = defaultButtonRule !== undefined && (defaultBg === 'transparent' || defaultBg === 'none' || defaultBg === '') && hasBorder;
    expect(isOutlined).toBe(true);
  });

  test('Semantic component variation relies on style queries and does not use container size queries', () => {
    const rules = getAllCssRules(targetFiles);
    const containerRules = rules.filter((r): r is CSSContainerRule => r instanceof CSSContainerRule);
    const hasStyleQuery = containerRules.some(r => r.conditionText.includes('style('));
    const hasSizeQueryForSemantic = containerRules.some(r => {
      const isSize = /\b(min-width|max-width|inline-size|width)\b/i.test(r.conditionText);
      if (!isSize) return false;
      const childRules = Array.from(r.cssRules);
      return childRules.some(sub => sub instanceof CSSStyleRule && (isBadgeRule(sub) || isButtonRule(sub)));
    });
    expect(hasStyleQuery && !hasSizeQueryForSemantic).toBe(true);
  });

  test('Component layout uses CSS logical properties for consistent layout', () => {
    const rules = getAllCssRules(targetFiles);
    const allStyleRules = extractStyleRules(rules);
    const logicalPropRegex = /^(inline-size|block-size|min-inline-size|min-block-size|max-inline-size|max-block-size|inset-block|inset-inline|inset-block-start|inset-block-end|inset-inline-start|inset-inline-end|padding-inline|padding-block|margin-inline|margin-block)/;
    let logicalPropCount = 0;
    for (const r of allStyleRules) {
      for (let i = 0; i < r.style.length; i++) {
        if (logicalPropRegex.test(r.style[i])) {
          logicalPropCount++;
        }
      }
    }
    expect(logicalPropCount).toBeGreaterThanOrEqual(2);
  });

  test('Progressive-enhancement fallback using :where() is provided for browsers without style query support', () => {
    const rules = getAllCssRules(targetFiles);
    const allStyleRules = extractStyleRules(rules);
    const whereFallbackRules = allStyleRules.filter(r => r.selectorText.includes(':where('));
    expect(whereFallbackRules.length).toBeGreaterThan(0);
  });

  test('Progressive-enhancement fallback updates promotional component presentation', () => {
    const rules = getAllCssRules(targetFiles);
    const allStyleRules = extractStyleRules(rules);
    const whereFallbackRules = allStyleRules.filter(r => r.selectorText.includes(':where('));
    const fallbackUpdatesComponent = whereFallbackRules.some(r => isBadgeRule(r) || isButtonRule(r));
    expect(fallbackUpdatesComponent).toBe(true);
  });

});
