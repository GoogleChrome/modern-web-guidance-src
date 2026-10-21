import {
  Node,
  type CallExpression,
  type NewExpression,
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
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

const DIMENSION_READ_REGEX =
  /(?:contentRect(?:\.width|\.inlineSize)?|borderBoxSize|contentBoxSize|offsetWidth|clientWidth|getBoundingClientRect)\b/;

const ELEMENT_DIMENSION_READ_REGEX =
  /(?:(?<!window\.)(?<!document\.)(?<!documentElement\.)(?:offsetWidth|clientWidth)|getBoundingClientRect\(\)(?:\.width)?)\b/;

const STYLING_MUTATION_REGEX =
  /(?:classList\.(?:add|remove|toggle)|\b(?:addClass|removeClass|toggleClass)\b|\bclassName\s*=|style\.(?:setProperty|[a-zA-Z]+)|\bset[A-Z][a-zA-Z]*(?:Width|Size|Narrow|Small|Compact|Layout|Breakpoint))\b/;

const NON_CONTAINER_EXCLUSIONS_REGEX =
  /(?:canvas|webgl|\bgl\b|getContext|chart|echarts|highcharts|monaco|editor\.layout|\.layout\b|relayout|virtual|virtualizer|scrollbar|style\.(?:width|height|minWidth|minHeight|maxWidth|maxHeight))\b/i;

function isResizeObserverInstantiation(
  node: Node,
): node is NewExpression | CallExpression {
  if (!Node.isNewExpression(node) && !Node.isCallExpression(node)) {
    return false;
  }
  const expr = unwrapExpression(node.getExpression());
  if (Node.isIdentifier(expr)) {
    return expr.getText() === 'ResizeObserver';
  }
  if (Node.isPropertyAccessExpression(expr)) {
    return expr.getName() === 'ResizeObserver';
  }
  return false;
}

function isWindowResizeListener(node: Node): node is CallExpression {
  if (!Node.isCallExpression(node)) {
    return false;
  }
  const callExpr = unwrapExpression(node.getExpression());
  if (!Node.isPropertyAccessExpression(callExpr)) {
    return false;
  }
  const method = callExpr.getName();
  if (method === 'resize') {
    return true;
  }
  if (method === 'addEventListener' || method === 'on' || method === 'bind') {
    const args = node.getArguments();
    if (args.length > 0) {
      const firstArg = unwrapExpression(args[0] as Node);
      if (Node.isStringLiteral(firstArg)) {
        return firstArg.getLiteralText().toLowerCase() === 'resize';
      }
    }
  }
  return false;
}

const sizeAwareStylingJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    'ResizeObserver',
    'offsetWidth',
    'clientWidth',
    'getBoundingClientRect',
  ],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      // 1. ResizeObserver pattern
      if (isResizeObserverInstantiation(node)) {
        if (isProtectedByFeatureGuard(node, ['container', 'container-type', '@container'])) {
          return;
        }

        const args = node.getArguments();
        if (args.length === 0) {
          return;
        }

        const rawCallback = unwrapExpression(args[0] as Node);
        const callback = resolveLocalExpression(rawCallback);
        const callbackText = callback.getText();

        if (!DIMENSION_READ_REGEX.test(callbackText)) {
          return;
        }
        if (!STYLING_MUTATION_REGEX.test(callbackText)) {
          return;
        }
        if (NON_CONTAINER_EXCLUSIONS_REGEX.test(callbackText)) {
          return;
        }

        const line = node.getStartLineNumber();
        if (!visitedLines.has(line)) {
          visitedLines.add(line);
          matches.push({
            line,
            message:
              'ResizeObserver callback toggles styling or responsive classes based on element width; modernize using CSS container queries (@container / container-type: inline-size).',
          });
        }
        return;
      }

      // 2. Window resize event listener pattern measuring container dimensions
      if (isWindowResizeListener(node)) {
        if (isProtectedByFeatureGuard(node, ['container', 'container-type', '@container'])) {
          return;
        }

        const args = node.getArguments();
        if (args.length === 0) {
          return;
        }

        const callbackIndex = args.length > 1 ? 1 : 0;
        const rawCallback = unwrapExpression(args[callbackIndex] as Node);
        const callback = resolveLocalExpression(rawCallback);
        const callbackText = callback.getText();

        if (!ELEMENT_DIMENSION_READ_REGEX.test(callbackText)) {
          return;
        }
        if (!STYLING_MUTATION_REGEX.test(callbackText)) {
          return;
        }
        if (NON_CONTAINER_EXCLUSIONS_REGEX.test(callbackText)) {
          return;
        }

        const line = node.getStartLineNumber();
        if (!visitedLines.has(line)) {
          visitedLines.add(line);
          matches.push({
            line,
            message:
              'Window resize listener queries container element dimensions to toggle classes; modernize using CSS container queries (@container / container-type: inline-size).',
          });
        }
      }
    });

    return matches;
  },
};

export const sizeAwareStylingRule: AnalyzerRule = {
  id: 'size-aware-styling',
  guideId: 'size-aware-styling',
  guideHash: '89180c46bf23',
  summary:
    'ResizeObserver callbacks and window resize handlers that measure element dimensions to toggle classes or styles should be replaced with CSS container queries (@container).',
  matcher: sizeAwareStylingJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'A ResizeObserver callback reads element dimensions (contentRect.width, borderBoxSize, offsetWidth, clientWidth) to toggle CSS classes (classList.add/remove/toggle, className =) or inline styles for responsive container breakpoints.',
      'A window resize event listener measures a container element offsetWidth, clientWidth, or getBoundingClientRect() to toggle responsive layout classes (addClass, removeClass, classList).',
      'The responsive layout adaptation can be implemented declaratively using CSS container queries (@container and container-type: inline-size).',
    ],
    dropWhen: [
      'The ResizeObserver or resize handler resizes an HTML <canvas>, WebGL rendering context, SVG surface, or redraws continuous graphics.',
      'The ResizeObserver or resize handler updates a virtualized scrolling viewport, infinite list, or windowed layout calculations.',
      'The ResizeObserver or resize handler re-layouts third-party chart components (ECharts, Highcharts) or code editors (Monaco, CodeMirror).',
      'The code is guarded by a feature detection query checking CSS container query support.',
    ],
  },
};

export const sizeAwareStylingRules: readonly AnalyzerRule[] = [sizeAwareStylingRule];
