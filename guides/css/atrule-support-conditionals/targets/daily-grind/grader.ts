import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSRule,
  CSSStyleRule,
  CSSSupportsRule,
  CSSPropertyRule,
  type CSSRuleList,
} from 'cssomnom';
import { SyntaxKind } from 'ts-morph';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllCssRules(rules: CSSRuleList | CSSRule[]): CSSRule[] {
  const all: CSSRule[] = [];
  for (const rule of Array.from(rules)) {
    all.push(rule);
    if ('cssRules' in rule && (rule as { cssRules?: CSSRuleList }).cssRules) {
      all.push(...getAllCssRules((rule as { cssRules: CSSRuleList }).cssRules));
    }
  }
  return all;
}

test.describe('atrule-support-conditionals Target Grader', () => {

  test('Stylesheets conditionally apply CSS based on at-rule support using the Baseline Widely Available detection hierarchy', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);
    const propertyRules = allRules.filter((r): r is CSSPropertyRule => r instanceof CSSPropertyRule);
    const supportsRules = allRules.filter((r): r is CSSSupportsRule => r instanceof CSSSupportsRule);

    // Baseline Widely Available hierarchy:
    // Widely supported at-rules (like @property) that shipped before @supports at-rule()
    // must NOT be detected via @supports at-rule(@property).
    const hasSupportsAtRuleProperty = supportsRules.some(r =>
      /at-rule\s*\(\s*@property\b/i.test(r.conditionText)
    );

    // Fallback 1: Registered @property custom property fallback
    const hasPropertyFallback = propertyRules.length > 0 && !hasSupportsAtRuleProperty;

    // Fallback 2: JS detection toggling a root class
    const jsProject = getJsProject(targetFiles);
    const sourceFiles = jsProject.getSourceFiles();
    const hasJsDetection = sourceFiles.some(sf => {
      const text = sf.getText();
      return (text.includes('CSSPropertyRule') || text.includes('replaceSync') || text.includes('CSSFunctionRule')) &&
        (text.includes('classList') || text.includes('className'));
    });

    // Fallback 3: @supports at-rule(@media) to detect @supports at-rule() itself, or narrower at-rules (@function, etc.)
    const hasSupportedAtRuleQuery = supportsRules.some(r => {
      const match = r.conditionText.match(/at-rule\s*\(\s*@([a-zA-Z0-9_-]+)\s*\)/i);
      if (!match) return false;
      const atName = match[1].toLowerCase();
      return atName === 'media' || atName === 'function';
    });

    // Fallback 4: Tautological container style query
    const hasTautologicalContainerQuery = allRules.some(r =>
      'conditionText' in r && typeof (r as { conditionText?: string }).conditionText === 'string' &&
      /style\([^)]+\)\s+or\s+\(not\s*\(style\([^)]+\)\)\)/i.test((r as { conditionText: string }).conditionText)
    );

    const hasValidDetection = (hasPropertyFallback || hasJsDetection || hasSupportedAtRuleQuery || hasTautologicalContainerQuery) && !hasSupportsAtRuleProperty;
    expect(hasValidDetection).toBe(true);
  });

  test('Registered @property fallback uses non-inheriting configuration and valid element scoping', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);
    const propertyRules = allRules.filter((r): r is CSSPropertyRule => r instanceof CSSPropertyRule);
    const styleRules = allRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    let hasValidFallbackConfig = false;

    for (const propRule of propertyRules) {
      // Must be non-inheriting for custom property detection patterns
      if (propRule.inherits !== false) continue;

      const propName = propRule.name;
      const varPattern = new RegExp(`var\\(\\s*${propName}\\b`);

      // Pattern A: Initial value fallback (e.g. initial-value: ...; consumed via var())
      if (propRule.initialValue !== null && propRule.initialValue.trim().length > 0) {
        const hasConsumingRule = styleRules.some(sr => varPattern.test(sr.style.cssText));
        if (hasConsumingRule) {
          hasValidFallbackConfig = true;
          break;
        }
      }

      // Pattern B: :root space-override pattern (set to whitespace on :root, consumed on a non-root element)
      const rootDeclaresProperty = styleRules.some(sr => {
        const isRootSelector = /^(?::root|html)\b/i.test(sr.selectorText.trim());
        if (!isRootSelector) return false;
        const val = sr.style.getPropertyValue(propName);
        return val !== null && val !== undefined;
      });

      const nonRootConsumesVar = styleRules.some(sr => {
        const isRootSelector = /^(?::root|html)\b/i.test(sr.selectorText.trim());
        if (isRootSelector) return false;
        return varPattern.test(sr.style.cssText);
      });

      if (rootDeclaresProperty && nonRootConsumesVar) {
        hasValidFallbackConfig = true;
        break;
      }
    }

    // Alternative: JS root class detection or supported at-rule query
    if (!hasValidFallbackConfig) {
      const jsProject = getJsProject(targetFiles);
      const hasJsDetection = jsProject.getSourceFiles().some(sf => {
        const text = sf.getText();
        return (text.includes('CSSPropertyRule') || text.includes('replaceSync')) &&
          (text.includes('classList') || text.includes('className'));
      });
      if (hasJsDetection) {
        hasValidFallbackConfig = true;
      }
    }

    expect(hasValidFallbackConfig).toBe(true);
  });

  test('At-rule support queries use bare identifiers and avoid invalid or mismatched checks', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);
    const propertyRules = allRules.filter((r): r is CSSPropertyRule => r instanceof CSSPropertyRule);
    const supportsRules = allRules.filter((r): r is CSSSupportsRule => r instanceof CSSSupportsRule);

    const hasDetection = propertyRules.length > 0 || supportsRules.length > 0;

    // Check 1: Bare @<name> identifier inside any @supports at-rule(...) query (no preludes/descriptors/bodies)
    let hasInvalidAtRuleSyntax = false;
    for (const sr of supportsRules) {
      const matches = Array.from(sr.conditionText.matchAll(/at-rule\s*\(([^)]*)\)/gi));
      for (const m of matches) {
        const inner = m[1].trim();
        if (!/^@[a-zA-Z0-9_-]+$/.test(inner)) {
          hasInvalidAtRuleSyntax = true;
        }
      }
    }

    // Check 2: Must not use invalid check @supports (container-type: style)
    const hasInvalidContainerTypeStyle = supportsRules.some(r =>
      /container-type\s*:\s*style/i.test(r.conditionText)
    );

    // Check 3: Must not use mismatched JS check CSS.registerProperty to detect @property support
    const jsProject = getJsProject(targetFiles);
    const propertyAccesses = jsProject.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    );
    const usesRegisterProperty = propertyAccesses.some(pa =>
      pa.getText() === 'CSS.registerProperty' || pa.getName() === 'registerProperty'
    );

    const passesBareIdentifierAndValidityChecks = hasDetection &&
      !hasInvalidAtRuleSyntax &&
      !hasInvalidContainerTypeStyle &&
      !usesRegisterProperty;

    expect(passesBareIdentifierAndValidityChecks).toBe(true);
  });

  test('At-rule support conditional gates dependent regular CSS declarations in stylesheets rather than self-wrapping or setting inline styles', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);
    const propertyRules = allRules.filter((r): r is CSSPropertyRule => r instanceof CSSPropertyRule);
    const supportsRules = allRules.filter((r): r is CSSSupportsRule => r instanceof CSSSupportsRule);
    const styleRules = allRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    // Check 1: Gating dependent regular CSS declarations in stylesheets
    let hasGatedRegularCssDeclarations = false;

    // Via registered property fallback: regular CSS properties (not custom properties) consuming var(--prop)
    for (const propRule of propertyRules) {
      const varPattern = new RegExp(`var\\(\\s*${propRule.name}\\b`);
      for (const sr of styleRules) {
        for (let i = 0; i < sr.style.length; i++) {
          const prop = sr.style.item(i);
          if (prop.startsWith('--')) continue; // Ignore custom property declarations
          const val = sr.style.getPropertyValue(prop);
          if (varPattern.test(val)) {
            hasGatedRegularCssDeclarations = true;
            break;
          }
        }
        if (hasGatedRegularCssDeclarations) break;
      }
      if (hasGatedRegularCssDeclarations) break;
    }

    // Via @supports rule: contains regular CSS style rules
    if (!hasGatedRegularCssDeclarations) {
      const hasSupportsWithStyleRules = supportsRules.some(sr =>
        Array.from(sr.cssRules).some(cr => cr instanceof CSSStyleRule && cr.style.length > 0)
      );
      if (hasSupportsWithStyleRules) {
        hasGatedRegularCssDeclarations = true;
      }
    }

    // Via JS root class: regular CSS rules targeting the class
    if (!hasGatedRegularCssDeclarations) {
      const jsProject = getJsProject(targetFiles);
      const hasJsDetection = jsProject.getSourceFiles().some(sf => {
        const text = sf.getText();
        return (text.includes('CSSPropertyRule') || text.includes('replaceSync')) &&
          (text.includes('classList') || text.includes('className'));
      });
      if (hasJsDetection && styleRules.length > 0) {
        hasGatedRegularCssDeclarations = true;
      }
    }

    // Check 2: Does NOT wrap only the detected at-rule itself
    const wrapsOnlySelf = supportsRules.some(sr => {
      const match = sr.conditionText.match(/at-rule\s*\(\s*@([a-zA-Z0-9_-]+)\s*\)/i);
      if (!match) return false;
      const atName = match[1].toLowerCase();
      const childRules = Array.from(sr.cssRules);
      if (childRules.length === 0) return true;
      return childRules.every(cr => {
        const ruleName = cr.constructor.name.toLowerCase();
        return ruleName.includes(atName);
      });
    });

    // Check 3: Does NOT apply visual inline styles directly from JavaScript
    const jsProject = getJsProject(targetFiles);
    const calls = jsProject.getSourceFiles().flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const assignments = jsProject.getSourceFiles().flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.BinaryExpression));
    const hasSetAttributeStyle = calls.some(call => {
      const expr = call.getExpression().getText();
      const args = call.getArguments();
      return expr.endsWith('setAttribute') && args[0]?.getText().replace(/['"`]/g, '') === 'style';
    });
    const hasStylePropAssignment = assignments.some(assign => {
      const left = assign.getLeft().getText();
      return left.includes('.style.') || left.endsWith('.style');
    });
    const appliesVisualInlineStylesFromJs = hasSetAttributeStyle || hasStylePropAssignment;

    const gatesRegularStylesProperly = hasGatedRegularCssDeclarations &&
      !wrapsOnlySelf &&
      !appliesVisualInlineStylesFromJs;

    expect(gatesRegularStylesProperly).toBe(true);
  });

});
