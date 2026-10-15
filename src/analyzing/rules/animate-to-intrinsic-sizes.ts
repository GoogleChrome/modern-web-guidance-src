import {
  Node,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  resolveLocalExpression,
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

const animateToIntrinsicSizesCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['max-height'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    // 1. If stylesheet already opts into modern intrinsic sizing interpolation, skip
    if (
      ctx.stylesheetHasProperty('interpolate-size') ||
      ctx.stylesheetHasValue('calc-size(')
    ) {
      return null;
    }

    // 2. Skip scrollable containers where max-height acts as a viewport constraint
    const overflow = (styleRule.getPropertyValue('overflow') ?? '').toLowerCase();
    const overflowY = (styleRule.getPropertyValue('overflow-y') ?? '').toLowerCase();
    if (
      overflow === 'auto' ||
      overflow === 'scroll' ||
      overflowY === 'auto' ||
      overflowY === 'scroll'
    ) {
      return null;
    }

    // 3. Inspect transition definitions
    const transition = (styleRule.getPropertyValue('transition') ?? '').toLowerCase();
    const transitionProp = (
      styleRule.getPropertyValue('transition-property') ?? ''
    ).toLowerCase();

    if (transition === 'none' || transitionProp === 'none') {
      return null;
    }

    const maxHeight = (styleRule.getPropertyValue('max-height') ?? '').toLowerCase();
    if (maxHeight === 'none') {
      return null;
    }

    // 4. Check whether max-height is explicitly transitioned, or transitioned via 'all'
    const transitionsMaxHeight =
      transition.includes('max-height') ||
      transitionProp.includes('max-height') ||
      ((transition.includes('all') || transitionProp.includes('all')) &&
        styleRule.hasProperty('max-height'));

    if (!transitionsMaxHeight) {
      return null;
    }

    return {
      message:
        'CSS rule transitions max-height to animate dimensions; use interpolate-size: allow-keywords and animate height or block-size directly.',
    };
  },
};

function readsIntrinsicDimension(node: Node): boolean {
  let found = false;

  function inspect(n: Node): boolean {
    const unwrapped = unwrapExpression(n);
    if (Node.isPropertyAccessExpression(unwrapped)) {
      const name = unwrapped.getName();
      if (name === 'scrollHeight' || name === 'offsetHeight') {
        return true;
      }
      if (name === 'height') {
        let caller = unwrapExpression(unwrapped.getExpression());
        if (Node.isIdentifier(caller)) {
          const resolved = resolveLocalExpression(caller);
          if (resolved) {
            caller = unwrapExpression(resolved);
          }
        }
        if (Node.isCallExpression(caller)) {
          const callExpr = unwrapExpression(caller.getExpression());
          if (
            Node.isPropertyAccessExpression(callExpr) &&
            callExpr.getName() === 'getBoundingClientRect'
          ) {
            return true;
          }
        }
      }
    } else if (Node.isIdentifier(unwrapped)) {
      const resolved = resolveLocalExpression(unwrapped);
      if (resolved && resolved !== unwrapped) {
        if (inspect(resolved)) {
          return true;
        }
      }
    }
    return false;
  }

  if (inspect(node)) {
    return true;
  }

  node.forEachDescendant((child) => {
    if (found) return;
    if (inspect(child)) {
      found = true;
    }
  });

  return found;
}

function isStyleHeightTarget(left: Node): boolean {
  const unwrapped = unwrapExpression(left);
  if (Node.isPropertyAccessExpression(unwrapped)) {
    const prop = unwrapped.getName();
    if (prop === 'height' || prop === 'maxHeight') {
      const obj = unwrapExpression(unwrapped.getExpression());
      if (Node.isPropertyAccessExpression(obj) && obj.getName() === 'style') {
        return true;
      }
    }
  } else if (Node.isElementAccessExpression(unwrapped)) {
    const arg = unwrapped.getArgumentExpression();
    if (arg && Node.isStringLiteral(arg)) {
      const val = arg.getLiteralText();
      if (val === 'height' || val === 'maxHeight') {
        const obj = unwrapExpression(unwrapped.getExpression());
        if (Node.isPropertyAccessExpression(obj) && obj.getName() === 'style') {
          return true;
        }
      }
    }
  }
  return false;
}

function isJqueryHeightSetter(call: CallExpression): boolean {
  const expr = unwrapExpression(call.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return false;
  }
  const name = expr.getName();
  const args = call.getArguments();
  if (name === 'css' && args.length >= 2) {
    const first = unwrapExpression(args[0] as Node);
    if (Node.isStringLiteral(first)) {
      const prop = first.getLiteralText().toLowerCase();
      if (prop === 'height' || prop === 'max-height' || prop === 'maxheight') {
        return readsIntrinsicDimension(args[1] as Node);
      }
    }
  } else if ((name === 'height' || name === 'maxHeight') && args.length >= 1) {
    return readsIntrinsicDimension(args[0] as Node);
  }
  return false;
}

function isTextareaOrVirtualScrollContext(node: Node, filePath: string): boolean {
  const fileLower = filePath.toLowerCase();
  if (
    fileLower.includes('autosize') ||
    fileLower.includes('autogrow') ||
    fileLower.includes('virtual-scroll') ||
    fileLower.includes('virtual-list') ||
    fileLower.includes('simplescrollbars')
  ) {
    return true;
  }

  let current: Node | undefined = node;
  let depth = 0;
  while (current && depth < 8) {
    const text = current.getText().toLowerCase();
    // 1. Textarea auto-grow patterns
    if (
      text.includes('textarea') ||
      text.includes('autosize') ||
      text.includes('autogrow') ||
      text.includes('auto-grow') ||
      text.includes('htmltextareaelement')
    ) {
      if (
        text.includes("'input'") ||
        text.includes('"input"') ||
        text.includes("'keyup'") ||
        text.includes('"keyup"') ||
        text.includes("'keydown'") ||
        text.includes('"keydown"') ||
        text.includes('resize') ||
        text.includes('textarea')
      ) {
        return true;
      }
    }

    // 2. Virtual scroll patterns
    if (
      text.includes('virtual') ||
      text.includes('virtualscroll') ||
      text.includes('virtualizer') ||
      text.includes('visibleitems') ||
      (text.includes('scrolltop') &&
        (text.includes('rowheight') ||
          text.includes('itemheight') ||
          text.includes('startindex')))
    ) {
      return true;
    }

    if (
      Node.isFunctionDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current) ||
      Node.isMethodDeclaration(current)
    ) {
      break;
    }
    current = current.getParent();
    depth++;
  }

  return false;
}

export const animateToIntrinsicSizesJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['scrollHeight', 'offsetHeight', 'getBoundingClientRect'],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      // 1. el.style.height = ... or el.style.maxHeight = ...
      if (
        Node.isBinaryExpression(node) &&
        node.getOperatorToken().getText() === '='
      ) {
        const left = node.getLeft();
        const right = node.getRight();

        if (isStyleHeightTarget(left) && readsIntrinsicDimension(right)) {
          if (
            isProtectedByFeatureGuard(node, [
              'interpolate-size',
              'calc-size',
              'interpolateSize',
              'calcSize',
            ])
          ) {
            return;
          }

          if (isTextareaOrVirtualScrollContext(node, ctx.filePath)) {
            return;
          }

          const { line, column } = sourceFile.getLineAndColumnAtPos(node.getStart());
          matches.push({
            line,
            column,
            message:
              'JavaScript animation manually measures scrollHeight/offsetHeight and sets style.height/maxHeight to animate expand/collapse; modernize with interpolate-size: allow-keywords or calc-size().',
          });
        }
      }

      // 2. jQuery $(el).css('height', el.scrollHeight + 'px') or $(el).height(el.scrollHeight)
      if (Node.isCallExpression(node) && isJqueryHeightSetter(node)) {
        if (
          isProtectedByFeatureGuard(node, [
            'interpolate-size',
            'calc-size',
            'interpolateSize',
            'calcSize',
          ])
        ) {
          return;
        }

        if (isTextareaOrVirtualScrollContext(node, ctx.filePath)) {
          return;
        }

        const { line, column } = sourceFile.getLineAndColumnAtPos(node.getStart());
        matches.push({
          line,
          column,
          message:
            'JavaScript animation manually measures scrollHeight/offsetHeight and sets style.height/maxHeight to animate expand/collapse; modernize with interpolate-size: allow-keywords or calc-size().',
        });
      }
    });

    return matches;
  },
};

export const animateToIntrinsicSizesRule: AnalyzerRule = {
  id: 'animate-to-intrinsic-sizes',
  guideId: 'animate-to-intrinsic-sizes',
  guideHash: '290b14ca7ee4',
  summary:
    'CSS transition on max-height simulates intrinsic size animation; modernize with interpolate-size: allow-keywords or calc-size().',
  matcher: animateToIntrinsicSizesCssMatcher,
  phase2Rubric: {
    keepWhen: [
      'The CSS rule animates or transitions max-height (or transitions all alongside a max-height declaration) to simulate accordion, dropdown, drawer, or modal expansion/collapse.',
      'The element uses max-height as a proxy for natural content height because pure height cannot transition to auto without interpolate-size.',
    ],
    dropWhen: [
      'The container is a scrollable panel with overflow: scroll or overflow: auto where max-height defines a legitimate scrolling boundary.',
      'The stylesheet already specifies interpolate-size: allow-keywords or uses calc-size().',
      'The transition property is none or explicitly excludes height/max-height.',
      'The max-height property is none or an unconstrained reset.',
    ],
  },
};

export const animateToIntrinsicSizesJsRule: AnalyzerRule = {
  id: 'animate-to-intrinsic-sizes/js-scroll-height',
  guideId: 'animate-to-intrinsic-sizes',
  guideHash: '290b14ca7ee4',
  summary:
    'JavaScript animation manually measures scrollHeight or offsetHeight and assigns style.height/maxHeight to animate expansion/collapse; modernize with interpolate-size: allow-keywords.',
  matcher: animateToIntrinsicSizesJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'JavaScript code reads scrollHeight, offsetHeight, or getBoundingClientRect().height and assigns it to style.height or style.maxHeight to animate accordion, dropdown, menu, or panel expand/collapse.',
      'The script animates element dimensions between 0 and its natural scrollHeight/content height without native interpolate-size.',
    ],
    dropWhen: [
      'The element is a <textarea> or text input auto-resizing on input or keyup (which belongs to field-sizing: content rather than intrinsic size transitions).',
      'The height calculation is part of a virtual scroller, windowing container, or infinite list managing viewport offsets and buffer rows.',
      'The code is already protected by a feature guard checking for interpolate-size or calc-size.',
      'The height calculation is setting fixed scroll dimensions or layout metrics rather than animating expansion/collapse.',
    ],
  },
};

export const animateToIntrinsicSizesRules: readonly AnalyzerRule[] = [
  animateToIntrinsicSizesRule,
  animateToIntrinsicSizesJsRule,
];
