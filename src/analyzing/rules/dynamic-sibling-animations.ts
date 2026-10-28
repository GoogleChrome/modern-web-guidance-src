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

export const DYNAMIC_SIBLING_ANIMATIONS_GUIDE_HASH = '26f6d4e848cc';

const NTH_CHILD_SELECTOR_REGEX = /^(.*?):nth-(?:child|of-type)\(\s*(\d+)\s*\)(.*)$/i;

const DELAY_PROPERTIES = new Set([
  'animation-delay',
  '-webkit-animation-delay',
  '-moz-animation-delay',
  '-o-animation-delay',
  'transition-delay',
  '-webkit-transition-delay',
  '-moz-transition-delay',
  '-o-transition-delay',
]);

const DELAY_VALUE_REGEX = /^\s*(-?\d*\.?\d+)\s*(ms|s)\s*$/i;

function parseDelayMs(raw: string): number | null {
  const m = DELAY_VALUE_REGEX.exec(raw);
  if (!m) {
    return null;
  }
  const num = Number.parseFloat(m[1]);
  if (!Number.isFinite(num)) {
    return null;
  }
  return m[2].toLowerCase() === 's' ? num * 1000 : num;
}

function parseNthChildBaseSelector(selectorText: string): {
  baseSelector: string;
  index: number;
} | null {
  const m = NTH_CHILD_SELECTOR_REGEX.exec(selectorText.trim());
  if (!m) {
    return null;
  }
  const index = Number.parseInt(m[2], 10);
  if (!Number.isFinite(index) || index < 1) {
    return null;
  }
  const baseSelector = `${m[1].trim()}::${m[3].trim()}`;
  return { baseSelector, index };
}

function isStaggerDelayOnlyRule(rule: CssRuleView): {
  baseSelector: string;
  index: number;
  delayMs: number;
} | null {
  if (rule.declarations.length === 0) {
    return null;
  }
  let delayMs: number | null = null;
  // Carve out rules that set custom properties (--i, --index) or any non-delay properties
  for (const decl of rule.declarations) {
    const prop = decl.property.toLowerCase().trim();
    if (!DELAY_PROPERTIES.has(prop)) {
      return null;
    }
    if (decl.value.toLowerCase().includes('sibling-index(')) {
      return null;
    }
    const parsedMs = parseDelayMs(decl.value);
    if (parsedMs === null) {
      return null;
    }
    delayMs = parsedMs;
  }
  if (delayMs === null) {
    return null;
  }

  const parsedSel = parseNthChildBaseSelector(rule.selectorText);
  if (!parsedSel) {
    return null;
  }
  return { ...parsedSel, delayMs };
}

const computedMatchedRulesByContext = new WeakMap<
  CssMatcherContext,
  Set<CssRuleView>
>();

function getSequenceStartRules(ctx: CssMatcherContext): Set<CssRuleView> {
  const cached = computedMatchedRulesByContext.get(ctx);
  if (cached) {
    return cached;
  }
  const result = new Set<CssRuleView>();
  if (ctx.stylesheetHasValue('sibling-index(')) {
    computedMatchedRulesByContext.set(ctx, result);
    return result;
  }

  const taintedKeys = new Set<string>();
  const byKey = new Map<
    string,
    Array<{ index: number; delayMs: number; rule: CssRuleView }>
  >();

  for (const r of ctx.styleRules ?? []) {
    if (
      r.parentAtRule &&
      r.parentAtRule.toLowerCase().includes('@supports') &&
      r.parentAtRule.toLowerCase().includes('sibling-index')
    ) {
      continue;
    }
    const sel = parseNthChildBaseSelector(r.selectorText);
    if (!sel) {
      continue;
    }
    const key = `${r.parentAtRule ?? ''}||${sel.baseSelector}`;
    const parsed = isStaggerDelayOnlyRule(r);
    if (!parsed) {
      taintedKeys.add(key);
      continue;
    }
    const list = byKey.get(key) ?? [];
    list.push({ index: parsed.index, delayMs: parsed.delayMs, rule: r });
    byKey.set(key, list);
  }

  for (const [key, list] of byKey.entries()) {
    if (taintedKeys.has(key) || list.length < 3) {
      continue;
    }
    const sorted = [...list].sort((a, b) => a.index - b.index);
    // Reject if duplicate indices or non-monotonic delays (e.g. 2D 3x3 cube grid wave)
    let hasDuplicateOrFlat = false;
    let isIncreasing = true;
    let isDecreasing = true;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].index !== sorted[i - 1].index + 1) {
        hasDuplicateOrFlat = true;
        break;
      }
      if (sorted[i].delayMs <= sorted[i - 1].delayMs) {
        isIncreasing = false;
      }
      if (sorted[i].delayMs >= sorted[i - 1].delayMs) {
        isDecreasing = false;
      }
    }
    if (!hasDuplicateOrFlat && (isIncreasing || isDecreasing)) {
      result.add(sorted[0].rule);
    }
  }

  computedMatchedRulesByContext.set(ctx, result);
  return result;
}

const dynamicSiblingAnimationsCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: [':nth-child(1)', ':nth-child(2)', ':nth-of-type(1)', ':nth-of-type(2)'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    const startRules = getSequenceStartRules(ctx);
    if (!startRules.has(styleRule)) {
      return null;
    }
    return {
      message:
        'Repetitive :nth-child(N) CSS rules set staggered animation-delay/transition-delay values; replace with a single rule using calc(sibling-index() * <step>).',
    };
  },
};

function isJsLoopSettingDelayFromIndex(node: Node): Node | undefined {
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

  const idxRegex = new RegExp(`\\b${indexParamName}\\b`);
  let matchedDelayNode: Node | undefined;

  bodyNode.forEachDescendant((desc) => {
    if (matchedDelayNode) {
      return;
    }
    if (Node.isBinaryExpression(desc) && desc.getOperatorToken().getText() === '=') {
      const left = unwrapExpression(desc.getLeft());
      if (
        Node.isPropertyAccessExpression(left) &&
        (left.getName() === 'animationDelay' || left.getName() === 'transitionDelay')
      ) {
        const styleObj = unwrapExpression(left.getExpression());
        if (
          Node.isPropertyAccessExpression(styleObj) &&
          styleObj.getName() === 'style' &&
          idxRegex.test(desc.getRight().getText())
        ) {
          matchedDelayNode = desc;
        }
      }
    } else if (Node.isCallExpression(desc)) {
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
          Node.isStringLiteral(propArg) &&
          DELAY_PROPERTIES.has(propArg.getLiteralText().toLowerCase()) &&
          idxRegex.test(args[1].getText())
        ) {
          matchedDelayNode = desc;
        }
      }
    }
  });

  return matchedDelayNode;
}

const dynamicSiblingAnimationsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['.style.animationDelay', '.style.transitionDelay', '.style.setProperty'],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    if (
      !ctx.fileContent.includes('animationDelay') &&
      !ctx.fileContent.includes('transitionDelay') &&
      !ctx.fileContent.includes('animation-delay') &&
      !ctx.fileContent.includes('transition-delay')
    ) {
      return matches;
    }
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      const delayNode = isJsLoopSettingDelayFromIndex(node);
      if (!delayNode) {
        return;
      }
      if (isProtectedByFeatureGuard(delayNode, ['sibling-index', 'sibling-count'])) {
        return;
      }
      const line = delayNode.getStartLineNumber();
      if (!visitedLines.has(line)) {
        visitedLines.add(line);
        matches.push({
          line,
          message:
            'JavaScript loop computes staggered inline animationDelay/transitionDelay per sibling index; use CSS animation-delay: calc(sibling-index() * <step>) instead.',
        });
      }
    });

    return matches;
  },
};

export const dynamicSiblingAnimationsCssRule: AnalyzerRule = {
  id: 'dynamic-sibling-animations',
  guideId: 'dynamic-sibling-animations',
  guideHash: DYNAMIC_SIBLING_ANIMATIONS_GUIDE_HASH,
  summary:
    'Replace repetitive :nth-child(N) CSS rules that only set staggered animation-delay or transition-delay values with CSS sibling-index().',
  matcher: dynamicSiblingAnimationsCssMatcher,
  verifierRubric: {
    keepWhen: [
      'A stylesheet defines 3 or more sequential :nth-child(1), :nth-child(2), :nth-child(3) rules on the same selector that only set staggered animation-delay or transition-delay values.',
      'The repetitive :nth-child delay rules can be collapsed into a single rule using calc(sibling-index() * <step>).',
    ],
    dropWhen: [
      'The :nth-child rules set distinct per-child colors, positions, transforms, or custom properties (--i, --index) in addition to animation-delay.',
      'The stylesheet already uses sibling-index() or wraps the rules in an @supports fallback.',
    ],
  },
};

export const dynamicSiblingAnimationsJsRule: AnalyzerRule = {
  id: 'dynamic-sibling-animations/js',
  guideId: 'dynamic-sibling-animations',
  guideHash: DYNAMIC_SIBLING_ANIMATIONS_GUIDE_HASH,
  summary:
    'Replace JavaScript loops that assign staggered inline animationDelay or transitionDelay from the element index with CSS sibling-index().',
  matcher: dynamicSiblingAnimationsJsMatcher,
  verifierRubric: {
    keepWhen: [
      'A JavaScript loop over sibling elements sets inline style.animationDelay or style.transitionDelay as a function of the loop index.',
      'The staggered delay calculation can be moved into CSS using calc(sibling-index() * <step>).',
    ],
    dropWhen: [
      'The delay depends on runtime data, text length, random numbers, or measured DOM geometry rather than sibling index.',
      'The loop is guarded by !CSS.supports("...sibling-index()...") as a fallback for older browsers.',
    ],
  },
};

export default [
  dynamicSiblingAnimationsCssRule,
  dynamicSiblingAnimationsJsRule,
] satisfies readonly AnalyzerRule[];
