import {
  Node,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const DYNAMIC_SIBLING_STYLING_GUIDE_HASH = '4d2db5d1aa4c';

const SIBLING_VAR_NAMES = new Set([
  '--sibling-index',
  '--sibling-count',
  '--item-index',
  '--item-count',
  '--index',
  '--i',
]);

const NTH_CHILD_SELECTOR_REGEX = /^(.*?):nth-(?:child|of-type)\(\s*(\d+)\s*\)(.*)$/i;
const SCALAR_VALUE_REGEX =
  /^\s*(-?\d+(?:\.\d+)?)\s*(deg|rad|turn|grad|px|rem|em|%)?\s*$/i;

function isSiblingIndexVarOnlyRule(rule: CssRuleView): {
  baseSelector: string;
  varName: string;
  index: number;
  numValue: number;
  unit: string;
} | null {
  if (rule.declarations.length !== 1) {
    return null;
  }
  const decl = rule.declarations[0];
  const prop = decl.property.toLowerCase().trim();
  if (!prop.startsWith('--') && prop !== 'z-index') {
    return null;
  }
  const valMatch = SCALAR_VALUE_REGEX.exec(decl.value);
  if (!valMatch) {
    return null;
  }
  const numValue = Number.parseFloat(valMatch[1]);
  const unit = (valMatch[2] ?? '').toLowerCase();
  if (!Number.isFinite(numValue)) {
    return null;
  }
  if (prop === 'z-index' && (unit !== '' || !Number.isInteger(numValue))) {
    return null;
  }
  const m = NTH_CHILD_SELECTOR_REGEX.exec(rule.selectorText.trim());
  if (!m) {
    return null;
  }
  const index = Number.parseInt(m[2], 10);
  if (!Number.isFinite(index) || index < 1) {
    return null;
  }
  const baseSelector = `${m[1].trim()}::${m[3].trim()}`;
  return { baseSelector, varName: prop, index, numValue, unit };
}

const computedCssStarts = new WeakMap<CssMatcherContext, Set<CssRuleView>>();

function getCssSequenceStartRules(ctx: CssMatcherContext): Set<CssRuleView> {
  const cached = computedCssStarts.get(ctx);
  if (cached) {
    return cached;
  }
  const result = new Set<CssRuleView>();
  if (
    ctx.stylesheetHasValue('sibling-index(') ||
    ctx.stylesheetHasValue('sibling-count(')
  ) {
    computedCssStarts.set(ctx, result);
    return result;
  }

  const byKey = new Map<
    string,
    Array<{
      index: number;
      numValue: number;
      unit: string;
      varName: string;
      rule: CssRuleView;
    }>
  >();
  for (const r of ctx.styleRules ?? []) {
    if (
      r.parentAtRule &&
      r.parentAtRule.toLowerCase().includes('@supports') &&
      r.parentAtRule.toLowerCase().includes('sibling-')
    ) {
      continue;
    }
    const parsed = isSiblingIndexVarOnlyRule(r);
    if (!parsed) {
      continue;
    }
    const key = `${r.parentAtRule ?? ''}||${parsed.baseSelector}||${parsed.varName}`;
    const list = byKey.get(key) ?? [];
    list.push({
      index: parsed.index,
      numValue: parsed.numValue,
      unit: parsed.unit,
      varName: parsed.varName,
      rule: r,
    });
    byKey.set(key, list);
  }

  for (const list of byKey.values()) {
    const minLen = list[0]?.varName === 'z-index' ? 4 : 3;
    if (list.length < minLen) {
      continue;
    }
    const sorted = [...list].sort((a, b) => a.index - b.index);
    const step = sorted[1].numValue - sorted[0].numValue;
    if (step === 0) {
      continue;
    }
    let validProgression = true;
    for (let i = 1; i < sorted.length; i++) {
      if (
        sorted[i].index !== sorted[i - 1].index + 1 ||
        sorted[i].unit !== sorted[0].unit ||
        Math.abs(sorted[i].numValue - sorted[i - 1].numValue - step) > 1e-6
      ) {
        validProgression = false;
        break;
      }
    }
    if (validProgression) {
      result.add(sorted[0].rule);
    }
  }

  computedCssStarts.set(ctx, result);
  return result;
}

const dynamicSiblingStylingCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: [':nth-child(1)', ':nth-child(2)', ':nth-of-type(1)', ':nth-of-type(2)'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    const startRules = getCssSequenceStartRules(ctx);
    if (!startRules.has(styleRule)) {
      return null;
    }
    return {
      message:
        'Repetitive :nth-child(N) CSS rules assign sequential --index/--i custom properties; replace with CSS sibling-index() and sibling-count().',
    };
  },
};

function isSimpleIndexInjectionLoop(node: Node): Node | undefined {
  let indexParamName: string | undefined;
  let bodyNode: Node | undefined;

  if (Node.isCallExpression(node)) {
    const expr = unwrapExpression(node.getExpression());
    if (!Node.isPropertyAccessExpression(expr) || expr.getName() !== 'forEach') {
      return undefined;
    }
    const args = node.getArguments();
    if (args.length === 0) {
      return undefined;
    }
    const cb = unwrapExpression(args[0]);
    if (!Node.isArrowFunction(cb) && !Node.isFunctionExpression(cb)) {
      return undefined;
    }
    const params = cb.getParameters();
    if (params.length < 2) {
      return undefined;
    }
    const secondName = params[1].getNameNode();
    if (!Node.isIdentifier(secondName)) {
      return undefined;
    }
    indexParamName = secondName.getText();
    bodyNode = cb.getBody();
  } else if (Node.isForStatement(node)) {
    const init = node.getInitializer();
    if (!init || !Node.isVariableDeclarationList(init)) {
      return undefined;
    }
    const decls = init.getDeclarations();
    if (decls.length === 0) {
      return undefined;
    }
    const nameNode = decls[0].getNameNode();
    if (!Node.isIdentifier(nameNode)) {
      return undefined;
    }
    indexParamName = nameNode.getText();
    bodyNode = node.getStatement();
  }

  if (!indexParamName || !bodyNode) {
    return undefined;
  }

  // Skip loops that perform unrelated DOM creation, event binding, or layout measurements
  const bodyText = bodyNode.getText();
  if (
    /\b(?:createElement|appendChild|insertBefore|innerHTML|addEventListener|getBoundingClientRect|offsetWidth|offsetHeight)\b/.test(
      bodyText,
    )
  ) {
    return undefined;
  }

  const idxRegex = new RegExp(`\\b${indexParamName}\\b|\\.length\\b|\\.childElementCount\\b`);
  let matchedSetProperty: Node | undefined;
  let hasNonSiblingCustomProp = false;

  bodyNode.forEachDescendant((desc) => {
    if (!Node.isCallExpression(desc)) {
      return;
    }
    const expr = unwrapExpression(desc.getExpression());
    const args = desc.getArguments();
    if (
      Node.isPropertyAccessExpression(expr) &&
      expr.getName() === 'setProperty' &&
      args.length >= 2
    ) {
      const styleObj = unwrapExpression(expr.getExpression());
      const propArg = unwrapExpression(args[0]);
      if (
        Node.isPropertyAccessExpression(styleObj) &&
        styleObj.getName() === 'style' &&
        Node.isStringLiteral(propArg)
      ) {
        const propName = propArg.getLiteralText().toLowerCase().trim();
        if (SIBLING_VAR_NAMES.has(propName) && idxRegex.test(args[1].getText())) {
          if (!matchedSetProperty) {
            matchedSetProperty = desc;
          }
        } else if (propName.startsWith('--')) {
          hasNonSiblingCustomProp = true;
        }
      }
    }
  });

  if (hasNonSiblingCustomProp) {
    return undefined;
  }

  return matchedSetProperty;
}

const dynamicSiblingStylingJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    ['setProperty'],
    ['--sibling-index', '--sibling-count', '--item-index', '--item-count', '--index', '--i'],
  ],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    if (!/--(?:sibling-index|sibling-count|item-index|item-count|index|i)\b/i.test(ctx.fileContent)) {
      return matches;
    }
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      const setPropNode = isSimpleIndexInjectionLoop(node);
      if (!setPropNode) {
        return;
      }
      if (isProtectedByFeatureGuard(setPropNode, ['sibling-index', 'sibling-count'])) {
        return;
      }
      const line = setPropNode.getStartLineNumber();
      if (!visitedLines.has(line)) {
        visitedLines.add(line);
        matches.push({
          line,
          message:
            'JavaScript loop injects --sibling-index/--sibling-count/--index custom properties into inline styles; use CSS sibling-index() and sibling-count() instead.',
        });
      }
    });

    return matches;
  },
};

export const dynamicSiblingStylingJsRule: AnalyzerRule = {
  id: 'dynamic-sibling-styling',
  guideId: 'dynamic-sibling-styling',
  guideHash: DYNAMIC_SIBLING_STYLING_GUIDE_HASH,
  summary:
    'Replace JavaScript loops that inject --sibling-index, --sibling-count, or --index custom properties on sibling elements with CSS sibling-index() and sibling-count().',
  matcher: dynamicSiblingStylingJsMatcher,
  verifierRubric: {
    keepWhen: [
      'A JavaScript loop iterates over sibling DOM elements solely to inject 0-based or 1-based index/count custom properties (such as --sibling-index, --sibling-count, --index, or --i) via style.setProperty.',
      'The inline custom properties can be replaced with native CSS sibling-index() and sibling-count() functions.',
    ],
    dropWhen: [
      'The loop is guarded by !CSS.supports("...sibling-index()...") as a progressive-enhancement fallback.',
      'The loop computes data-driven values, DOM geometry measurements, or binds event listeners rather than injecting positional sibling indices.',
    ],
  },
};

export const dynamicSiblingStylingCssRule: AnalyzerRule = {
  id: 'dynamic-sibling-styling/css',
  guideId: 'dynamic-sibling-styling',
  guideHash: DYNAMIC_SIBLING_STYLING_GUIDE_HASH,
  summary:
    'Replace repetitive :nth-child(N) CSS rules that assign sequential --index or --i custom properties with CSS sibling-index() and sibling-count().',
  matcher: dynamicSiblingStylingCssMatcher,
  verifierRubric: {
    keepWhen: [
      'A stylesheet defines 3 or more sequential :nth-child(1), :nth-child(2), :nth-child(3) rules on the same base selector that only set an incrementing custom property (--i, --index, --sibling-index).',
      'The repetitive :nth-child blocks can be replaced by CSS sibling-index() and sibling-count().',
    ],
    dropWhen: [
      'The :nth-child rules assign non-sequential or data-specific tokens (such as distinct brand colors) rather than positional indices.',
      'The stylesheet already uses sibling-index() or wraps the rules in an @supports fallback.',
    ],
  },
};

export default [
  dynamicSiblingStylingJsRule,
  dynamicSiblingStylingCssRule,
] satisfies readonly AnalyzerRule[];
