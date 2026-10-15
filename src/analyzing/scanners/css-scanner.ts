import {
  getDeclaredProperties,
  parse as parseCss,
  walkStyleRules,
} from 'cssomnom';
import type {
  AnalyzerMatch,
  CssMatcherContext,
  CssRuleMatcher,
} from '../schema.ts';
import { matchesFastTokens } from './js-scanner.ts';

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

  let sheet;
  try {
    sheet = parseCss(cssContent);
  } catch {
    return [];
  }

  const allProperties = getDeclaredProperties(sheet);

  const ctx: CssMatcherContext = {
    filePath,
    stylesheetText: cssContent,
    stylesheetHasProperty: (prop: string) =>
      allProperties.has(prop.toLowerCase()),
    stylesheetHasValue: (substr: string) => cssContent.includes(substr),
  };

  const matches: AnalyzerMatch[] = [];

  for (const view of walkStyleRules(sheet)) {
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
