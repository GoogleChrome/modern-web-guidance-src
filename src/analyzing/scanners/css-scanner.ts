import { parse as parseCss } from 'cssomnom';
import { unsafeCast } from '../../unsafe-cast.ts';
import type {
  AnalyzerMatch,
  CssDeclaration,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';
import { matchesFastTokens } from './js-scanner.ts';

interface RawStyleDeclaration {
  readonly length: number;
  [index: number]: string;
  getPropertyValue(prop: string): string;
}

interface RawCssRule {
  readonly constructor: { readonly name: string };
  readonly selectorText?: string;
  readonly keyText?: string;
  readonly name?: string;
  readonly style?: RawStyleDeclaration;
  readonly conditionText?: string;
  readonly cssRules?: { readonly length: number; [index: number]: RawCssRule };
}

/**
 * Traverses all style rules in a stylesheet (including nested rules in @media and @supports)
 * and yields each CSSStyleRule with its enclosing at-rule context.
 */
function* walkCssRules(
  ruleList: { readonly length: number; [index: number]: RawCssRule },
  parentAtRule: string | null = null,
): Generator<{ rule: RawCssRule; parentAtRule: string | null }> {
  for (let i = 0; i < ruleList.length; i++) {
    const r = ruleList[i];
    if (!r) {
      continue;
    }

    const selector = r.selectorText ?? r.keyText;
    if (selector && r.style) {
      yield { rule: r, parentAtRule };
    }

    if (r.cssRules && r.cssRules.length > 0) {
      let currentAtRule = parentAtRule;
      const ruleType = r.constructor.name;
      if (ruleType === 'CSSMediaRule' && r.conditionText) {
        currentAtRule = `@media ${r.conditionText}`;
      } else if (ruleType === 'CSSSupportsRule' && r.conditionText) {
        currentAtRule = `@supports ${r.conditionText}`;
      } else if (ruleType === 'CSSStartingStyleRule') {
        currentAtRule = '@starting-style';
      } else if (ruleType === 'CSSKeyframesRule') {
        currentAtRule = `@keyframes ${r.name ?? ''}`.trim();
      }
      yield* walkCssRules(r.cssRules, currentAtRule);
    }
  }
}

/**
 * Indexes all declared properties and @supports properties across the stylesheet.
 */
function indexAllProperties(
  ruleList: { readonly length: number; [index: number]: RawCssRule },
  properties: Set<string>,
): void {
  for (let i = 0; i < ruleList.length; i++) {
    const r = ruleList[i];
    if (!r) {
      continue;
    }
    if (r.style) {
      for (let j = 0; j < r.style.length; j++) {
        const prop = r.style[j];
        if (prop) {
          properties.add(prop.toLowerCase());
        }
      }
    }
    if (r.conditionText) {
      const matches = r.conditionText.matchAll(/\(\s*([a-zA-Z-]+)\s*:/g);
      for (const m of matches) {
        if (m[1]) {
          properties.add(m[1].toLowerCase());
        }
      }
    }
    if (r.cssRules) {
      indexAllProperties(r.cssRules, properties);
    }
  }
}

/**
 * Converts raw style declaration into structured CssDeclaration list.
 */
function extractDeclarations(style: RawStyleDeclaration): CssDeclaration[] {
  const declarations: CssDeclaration[] = [];
  for (let i = 0; i < style.length; i++) {
    const prop = style[i];
    if (prop) {
      const value = style.getPropertyValue(prop);
      declarations.push({ property: prop, value });
    }
  }
  return declarations;
}

/**
 * Computes source line and column of a CSS rule selector.
 */
function locateRulePosition(
  cssContent: string,
  selectorText: string,
  currentOffset: number,
): { line: number; column: number; nextOffset: number } {
  const normSel = selectorText.trim();
  let matchOffset = cssContent.indexOf(normSel, currentOffset);
  if (matchOffset === -1) {
    matchOffset = cssContent.indexOf(normSel);
  }

  if (matchOffset === -1) {
    return { line: 1, column: 1, nextOffset: currentOffset };
  }

  const preSlice = cssContent.slice(0, matchOffset);
  const lines = preSlice.split('\n');
  const line = lines.length;
  const lastLine = lines[lines.length - 1];
  const column = lastLine !== undefined ? lastLine.length + 1 : 1;
  const nextOffset = matchOffset + normSel.length;

  return { line, column, nextOffset };
}

/**
 * Builds a CssRuleView from a parsed CSSStyleRule.
 */
function createCssRuleView(
  rule: RawCssRule,
  parentAtRule: string | null,
  cssContent: string,
  currentOffset: number,
): { view: CssRuleView; nextOffset: number } {
  const selectorText = rule.selectorText ?? rule.keyText ?? '';
  const style = rule.style ?? { length: 0, getPropertyValue: () => '' };
  const declarations = extractDeclarations(style);
  const { line, column, nextOffset } = locateRulePosition(
    cssContent,
    selectorText,
    currentOffset,
  );

  const declMap = new Map(
    declarations.map((d) => [d.property.toLowerCase(), d.value]),
  );

  const view: CssRuleView = {
    selectorText,
    declarations,
    line,
    column,
    parentAtRule,
    getPropertyValue: (prop: string) =>
      declMap.get(prop.toLowerCase()) ?? null,
    hasProperty: (prop: string) => declMap.has(prop.toLowerCase()),
  };

  return { view, nextOffset };
}

/**
 * Scans a CSS string using cssomnom against a list of CssRuleMatchers.
 */
export function scanCss(
  filePath: string,
  cssContent: string,
  rules: readonly CssRuleMatcher[],
): AnalyzerMatch[] {
  const activeRules = rules.filter((rule) =>
    matchesFastTokens(cssContent, rule.fastTokens),
  );
  if (activeRules.length === 0) {
    return [];
  }

  let sheet: {
    cssRules: { readonly length: number; [index: number]: RawCssRule };
  };
  try {
    sheet = unsafeCast<{
      cssRules: { readonly length: number; [index: number]: RawCssRule };
    }>(
      parseCss(cssContent),
      'cssomnom parse returns a StyleSheet whose cssRules property matches CSSRuleList',
    );
  } catch {
    return [];
  }

  const allProperties = new Set<string>();
  indexAllProperties(sheet.cssRules, allProperties);

  const ctx: CssMatcherContext = {
    filePath,
    stylesheetText: cssContent,
    stylesheetHasProperty: (prop: string) =>
      allProperties.has(prop.toLowerCase()),
    stylesheetHasValue: (substr: string) => cssContent.includes(substr),
  };

  const matches: AnalyzerMatch[] = [];
  let currentOffset = 0;

  for (const { rule, parentAtRule } of walkCssRules(sheet.cssRules)) {
    if ((!rule.selectorText && !rule.keyText) || !rule.style) {
      continue;
    }

    const { view, nextOffset } = createCssRuleView(
      rule,
      parentAtRule,
      cssContent,
      currentOffset,
    );
    currentOffset = nextOffset;

    for (const r of activeRules) {
      const result = r.matchRule(view, ctx);
      if (result) {
        matches.push({
          line: view.line,
          column: view.column,
          message: result.message,
        });
      }
    }
  }

  return matches;
}
