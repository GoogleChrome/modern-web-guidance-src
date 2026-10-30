import {
  parse as parseCss,
  walkRules,
  walkStyleRules,
} from 'cssomnom';
import type {
  AnalyzerMatch,
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

function prepareCssContext(
  filePath: string,
  cssContent: string,
): PreparedCssContext | null {
  let sheet;
  try {
    sheet = parseCss(cssContent);
  } catch {
    return null;
  }

  const allProperties = new Set<string>();
  for (const entry of walkRules(sheet)) {
    if (entry.style) {
      for (const decl of entry.style._declarations) {
        allProperties.add(decl.name.toLowerCase());
      }
    }
    if (
      entry.rule &&
      'conditionText' in entry.rule &&
      typeof entry.rule.conditionText === 'string'
    ) {
      collectPropertyNames(entry.rule.conditionText, CONDITION_PROP_RE, allProperties);
    }
  }

  collectPropertyNames(cssContent, DECL_PROP_RE, allProperties);

  const styleRules: CssRuleView[] = Array.from(walkStyleRules(sheet));
  const ctx: CssMatcherContext = {
    filePath,
    stylesheetText: cssContent,
    styleRules,
    stylesheetHasProperty: (prop: string) => allProperties.has(prop.toLowerCase()),
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
): { rule: T; match: AnalyzerMatch }[] {
  const activeRules = rules.filter((rule) =>
    matchesFastTokens(cssContent, rule.matcher.fastTokens),
  );
  if (activeRules.length === 0) {
    return [];
  }

  const prepared = prepareCssContext(filePath, cssContent);
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
): AnalyzerMatch[] {
  return scanCssRules(
    filePath,
    cssContent,
    rules.map((matcher) => ({ matcher })),
  ).map(({ match }) => match);
}
