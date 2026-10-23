import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSRule,
  CSSGroupingRule,
  CSSStyleRule,
  CSSSupportsRule,
  CSSContainerRule,
  CSSPropertyRule,
  CSSNestedDeclarations,
  CSSAtRule,
  type CSSStyleSheet,
} from 'cssomnom';
import { SyntaxKind, type Project } from 'ts-morph';

// @ts-ignore - import.meta.url is used at runtime under ESM
const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectAllCssRules(ruleList: Iterable<CSSRule>): CSSRule[] {
  const result: CSSRule[] = [];
  for (const rule of ruleList) {
    result.push(rule);
    if (rule instanceof CSSGroupingRule) {
      result.push(...collectAllCssRules(rule.cssRules));
    } else if (rule instanceof CSSAtRule && Array.isArray(rule.childRules)) {
      result.push(...collectAllCssRules(rule.childRules));
    }
  }
  return result;
}

function getRuleOwnDeclarationCount(rule: CSSRule): number {
  if (rule instanceof CSSStyleRule || rule instanceof CSSNestedDeclarations) {
    return rule.style.length;
  }
  return 0;
}

function hasNestedRegularDeclarations(rule: CSSRule, detectedAtRuleName?: string): boolean {
  if (rule instanceof CSSStyleRule || rule instanceof CSSNestedDeclarations) {
    if (rule.style.length > 0) {
      return true;
    }
  }
  if (rule instanceof CSSGroupingRule) {
    for (const child of rule.cssRules) {
      if (detectedAtRuleName && isMatchingDetectedAtRule(child, detectedAtRuleName)) {
        continue;
      }
      if (hasNestedRegularDeclarations(child, detectedAtRuleName)) {
        return true;
      }
    }
  }
  return false;
}

function isMatchingDetectedAtRule(rule: CSSRule, atRuleName: string): boolean {
  const normalized = atRuleName.toLowerCase().replace(/^@/, '');
  const cssText = rule.cssText.trim().toLowerCase();
  return cssText.startsWith(`@${normalized}`);
}

function extractAtRuleQueries(conditionText: string): string[] {
  const queries: string[] = [];
  const lower = conditionText.toLowerCase();
  let idx = 0;
  while (idx < lower.length) {
    const found = lower.indexOf('at-rule(', idx);
    if (found === -1) break;
    let depth = 1;
    let pos = found + 'at-rule('.length;
    const start = pos;
    while (pos < conditionText.length && depth > 0) {
      if (conditionText[pos] === '(') depth++;
      else if (conditionText[pos] === ')') depth--;
      if (depth > 0) pos++;
    }
    queries.push(conditionText.slice(start, pos).trim());
    idx = pos + 1;
  }
  return queries;
}

function isBareAtRuleIdentifier(arg: string): boolean {
  if (!arg.startsWith('@') || arg.length < 2) return false;
  const name = arg.slice(1);
  for (let i = 0; i < name.length; i++) {
    const ch = name[i];
    const isAlphaNum =
      (ch >= 'a' && ch <= 'z') ||
      (ch >= 'A' && ch <= 'Z') ||
      (ch >= '0' && ch <= '9') ||
      ch === '-';
    if (!isAlphaNum) return false;
  }
  return true;
}

function isTautologicalStyleContainerRule(rule: CSSContainerRule): boolean {
  const cond = rule.conditionText.toLowerCase();
  return cond.includes('style(') && cond.includes(' or ') && cond.includes('not');
}

function hasRegisteredPropertyFallbackPattern(allRules: CSSRule[]): boolean {
  const propRules = allRules.filter((r): r is CSSPropertyRule => r instanceof CSSPropertyRule);
  if (propRules.length === 0) return false;

  const styleRules = allRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

  for (const propRule of propRules) {
    const propName = propRule.name;
    const isWildcardNoInherit =
      propRule.syntax.includes('*') && propRule.inherits === false;
    if (!isWildcardNoInherit) continue;

    // Pattern A: initial-value is set, or Pattern B: :root space-override with var(--prop, fallback) on non-root
    const usedInVarWithFallbackOnNonRoot = styleRules.some((sr) => {
      if (sr.selectorText.trim() === ':root' || sr.selectorText.trim() === 'html') {
        return false;
      }
      for (let i = 0; i < sr.style.length; i++) {
        const prop = sr.style.item(i);
        const val = sr.style.getPropertyValue(prop);
        if (val.includes(`var(${propName},`)) {
          return true;
        }
      }
      return false;
    });

    if (usedInVarWithFallbackOnNonRoot) {
      return true;
    }
  }
  return false;
}

function hasJsAtRuleSupportDetection(project: Project, allRules: CSSRule[]): boolean {
  const sourceFiles = project.getSourceFiles();
  if (sourceFiles.length === 0) return false;

  let checksCssRuleOrReplaceSync = false;
  let togglesRootClass = false;

  for (const sf of sourceFiles) {
    const identifiers = sf.getDescendantsOfKind(SyntaxKind.Identifier).map((id) => id.getText());
    if (
      identifiers.some(
        (name) =>
          (name.startsWith('CSS') && name.endsWith('Rule')) ||
          name === 'replaceSync' ||
          name === 'CSSStyleSheet'
      )
    ) {
      checksCssRuleOrReplaceSync = true;
    }
    if (identifiers.some((name) => name === 'classList' || name === 'className')) {
      togglesRootClass = true;
    }
  }

  return checksCssRuleOrReplaceSync && togglesRootClass && allRules.length > 0;
}

test.describe('atrule-support-conditionals Target Grader', () => {
  test('Stylesheets conditionally apply CSS rules or declarations based on at-rule support using @supports, tautological style @container query, @property fallback, or JS root class check', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(stylesheet.cssRules);
    const project: Project = getJsProject(targetFiles);

    const supportsRules = allRules.filter((r): r is CSSSupportsRule => r instanceof CSSSupportsRule);
    const containerRules = allRules.filter(
      (r): r is CSSContainerRule => r instanceof CSSContainerRule && isTautologicalStyleContainerRule(r)
    );

    const hasConditionalDetection =
      supportsRules.length > 0 ||
      containerRules.length > 0 ||
      hasRegisteredPropertyFallbackPattern(allRules) ||
      hasJsAtRuleSupportDetection(project, allRules);

    expect(hasConditionalDetection).toBe(true);
  });

  test('Any @supports at-rule(...) query passes only a bare @<name> identifier and avoids invalid checks (@supports (container-type: style) or CSS.registerProperty)', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(stylesheet.cssRules);
    const project: Project = getJsProject(targetFiles);

    const supportsRules = allRules.filter((r): r is CSSSupportsRule => r instanceof CSSSupportsRule);
    const containerRules = allRules.filter(
      (r): r is CSSContainerRule => r instanceof CSSContainerRule && isTautologicalStyleContainerRule(r)
    );

    const hasAnyDetection =
      supportsRules.length > 0 ||
      containerRules.length > 0 ||
      hasRegisteredPropertyFallbackPattern(allRules) ||
      hasJsAtRuleSupportDetection(project, allRules);

    const atRuleArgs = supportsRules.flatMap((r) => extractAtRuleQueries(r.conditionText));
    const allAtRuleArgsAreBare = atRuleArgs.every((arg) => isBareAtRuleIdentifier(arg));

    const hasInvalidContainerTypeStyle = supportsRules.some((r) => {
      const norm = r.conditionText.toLowerCase().replace(/\s+/g, '');
      return norm.includes('container-type:style');
    });

    const hasInvalidRegisterPropertyCheck = project
      .getSourceFiles()
      .some((sf) =>
        sf
          .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
          .some((pa) => pa.getText() === 'CSS.registerProperty')
      );

    expect(
      hasAnyDetection &&
        allAtRuleArgsAreBare &&
        !hasInvalidContainerTypeStyle &&
        !hasInvalidRegisterPropertyCheck
    ).toBe(true);
  });

  test('At-rule support conditionals gate dependent regular CSS declarations or rules in stylesheets rather than only wrapping the detected at-rule itself or setting inline styles from JS', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(stylesheet.cssRules);
    const project: Project = getJsProject(targetFiles);

    const supportsRules = allRules.filter((r): r is CSSSupportsRule => r instanceof CSSSupportsRule);
    const containerRules = allRules.filter(
      (r): r is CSSContainerRule => r instanceof CSSContainerRule && isTautologicalStyleContainerRule(r)
    );

    const supportsRulesGateRegularCss =
      supportsRules.length > 0 &&
      supportsRules.every((sr) => {
        const atRuleArgs = extractAtRuleQueries(sr.conditionText);
        const detectedName = atRuleArgs[0];
        return (
          getRuleOwnDeclarationCount(sr) > 0 || hasNestedRegularDeclarations(sr, detectedName)
        );
      });

    const containerRulesGateRegularCss =
      containerRules.length > 0 &&
      containerRules.every((cr) => hasNestedRegularDeclarations(cr));

    const hasValidGatedCss =
      supportsRulesGateRegularCss ||
      containerRulesGateRegularCss ||
      hasRegisteredPropertyFallbackPattern(allRules) ||
      hasJsAtRuleSupportDetection(project, allRules);

    const setsDirectInlineStyleInJs = project
      .getSourceFiles()
      .some((sf) =>
        sf
          .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
          .some((pa) => pa.getName() === 'style' && pa.getParent()?.getKind() === SyntaxKind.PropertyAccessExpression)
      );

    expect(hasValidGatedCss && !setsDirectInlineStyleInJs).toBe(true);
  });
});
