import {
  CSSAtRule,
  CSSConditionRule,
  CSSGroupingRule,
  CSSKeyframeRule,
  CSSKeyframesRule,
  CSSNestedDeclarations,
  CSSStyleRule,
  getDeclaredProperties,
  getPropertyValues,
  getRules,
  parse as parseCss,
  resolveSelector,
  type CSSRule,
} from 'cssomnom';
import type {
  AnalyzerMatch,
  CssDeclaration,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';
import { matchesFastTokens } from './js-scanner.ts';

const CONDITION_PROP_RE = /\(\s*(--[\w-]+|[a-zA-Z-]+)\s*:/g;
const DECL_PROP_RE = /(?:^|[;{])\s*(--[\w-]+|[a-zA-Z][a-zA-Z0-9_-]*)\s*:/g;

interface PreparedCssContext {
  readonly styleRules: readonly CssRuleView[];
  readonly ctx: CssMatcherContext;
}

function collectPropertyNames(text: string, regex: RegExp, target: Set<string>): void {
  for (const match of text.matchAll(regex)) {
    if (match[1]) {
      target.add(match[1].toLowerCase());
    }
  }
}

function getEnclosingAtRule(
  rule: CSSRule,
  headerCache: WeakMap<CSSRule, string | null>,
): string | null {
  for (let curr = rule.parentRule; curr; curr = curr.parentRule) {
    if (curr instanceof CSSStyleRule) continue;
    if (
      curr instanceof CSSGroupingRule ||
      curr instanceof CSSKeyframesRule ||
      curr instanceof CSSAtRule
    ) {
      if (headerCache.has(curr)) {
        return headerCache.get(curr) ?? null;
      }
      const cssText = curr.cssText;
      const brace = cssText.indexOf('{');
      const header = brace !== -1 ? cssText.slice(0, brace).trim() : null;
      headerCache.set(curr, header);
      return header;
    }
  }
  return null;
}

function prepareCssContext(
  filePath: string,
  cssContent: string,
  rawFileText?: string,
): PreparedCssContext | null {
  let sheet;
  try {
    sheet = parseCss(cssContent);
  } catch {
    return null;
  }

  let allProperties: Set<string> | null = null;
  const conditionTexts: string[] = [];
  const atRuleHeaderCache = new WeakMap<CSSRule, string | null>();
  const styleRules: CssRuleView[] = [];

  for (const rule of getRules(sheet)) {
    if (rule instanceof CSSConditionRule && rule.conditionText) {
      conditionTexts.push(rule.conditionText);
    }
    if (
      !(rule instanceof CSSStyleRule) &&
      !(rule instanceof CSSNestedDeclarations) &&
      !(rule instanceof CSSKeyframeRule)
    ) {
      continue;
    }
    const selectorText = resolveSelector(rule);
    if (selectorText === null) continue;

    const { style } = rule;
    let cachedDecls: readonly CssDeclaration[] | null = null;
    let cachedPropSet: Set<string> | null = null;
    let cachedParentAtRule: string | null | undefined;

    styleRules.push({
      selectorText,
      line: rule.location?.line ?? 1,
      column: rule.location?.column ?? 1,
      get parentAtRule() {
        if (cachedParentAtRule === undefined) {
          cachedParentAtRule = getEnclosingAtRule(rule, atRuleHeaderCache);
        }
        return cachedParentAtRule;
      },
      get declarations() {
        return (cachedDecls ??= Array.from(style).flatMap((property) => {
          const values = getPropertyValues(style, property, {
            logical: false,
            shorthands: false,
          });
          return values.length > 0
            ? values.map((value) => ({ property, value }))
            : [{ property, value: style.getPropertyValue(property) }];
        }));
      },
      getPropertyValue: (p: string) => style.getPropertyValue(p) || null,
      hasProperty: (p: string) => {
        const norm = p.startsWith('--') ? p : p.toLowerCase();
        cachedPropSet ??= new Set(style);
        return cachedPropSet.has(norm) || style.getPropertyValue(norm) !== '';
      },
    });
  }

  const ctx: CssMatcherContext = {
    filePath,
    stylesheetText: cssContent,
    rawFileText: rawFileText ?? cssContent,
    styleRules,
    stylesheetHasProperty: (prop: string) => {
      if (!allProperties) {
        allProperties = new Set<string>(
          Array.from(getDeclaredProperties(sheet), (p) => p.toLowerCase()),
        );
        for (const conditionText of conditionTexts) {
          collectPropertyNames(conditionText, CONDITION_PROP_RE, allProperties);
        }
        collectPropertyNames(cssContent, DECL_PROP_RE, allProperties);
      }
      return allProperties.has(prop.toLowerCase());
    },
    stylesheetHasValue: (substr: string) => cssContent.includes(substr),
  };

  return { styleRules, ctx };
}

/**
 * Scans a CSS string using cssomnom against a list of rules with CssRuleMatchers
 * in a single parse pass.
 */
export function scanCssRules<T extends { readonly matcher: CssRuleMatcher }>(
  filePath: string,
  cssContent: string,
  rules: readonly T[],
  rawFileText?: string,
): { rule: T; match: AnalyzerMatch }[] {
  const activeRules = rules.filter((rule) =>
    matchesFastTokens(cssContent, rule.matcher.fastTokens),
  );
  if (activeRules.length === 0) {
    return [];
  }

  const prepared = prepareCssContext(filePath, cssContent, rawFileText);
  if (!prepared) {
    return [];
  }

  const { styleRules, ctx } = prepared;
  const results: { rule: T; match: AnalyzerMatch }[] = [];

  for (const view of styleRules) {
    for (const rule of activeRules) {
      const result = rule.matcher.matchRule(view, ctx);
      if (result) {
        results.push({
          rule,
          match: {
            line: view.line,
            column: view.column,
            message: result.message,
            ...(result.subPattern ? { subPattern: result.subPattern } : {}),
          },
        });
      }
    }
  }

  return results;
}

export function normalizeCssDeclValue(raw: string | null | undefined): string {
  return raw?.replace(/\s*!important\s*$/i, '').trim().toLowerCase() ?? '';
}

export function scanCss(
  filePath: string,
  cssContent: string,
  rules: readonly CssRuleMatcher[],
  rawFileText?: string,
): AnalyzerMatch[] {
  return scanCssRules(
    filePath,
    cssContent,
    rules.map((matcher) => ({ matcher })),
    rawFileText,
  ).map(({ match }) => match);
}
