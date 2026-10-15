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
  /(?:contentRect(?:\.width|\.inlineSize)?|borderBoxSize|contentBoxSize|offsetWidth|clientWidth)\b/;

const STYLING_MUTATION_REGEX =
  /(?:classList\.(?:add|remove|toggle)|\bclassName\s*=|style\.(?:setProperty|[a-zA-Z]+)|\bset[A-Z][a-zA-Z]*(?:Width|Size|Narrow|Small|Compact|Layout|Breakpoint))\b/;

const NON_CONTAINER_EXCLUSIONS_REGEX =
  /(?:canvas|webgl|\bgl\b|getContext|chart|echarts|highcharts|monaco|editor\.layout|virtual|virtualizer|scrollbar)\b/i;

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

const sizeAwareStylingJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['ResizeObserver'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (!isResizeObserverInstantiation(node)) {
        return;
      }

      if (isProtectedByFeatureGuard(node, ['container', 'container-type', '@container'])) {
        return;
      }

      // Check callback argument
      const args = node.getArguments();
      if (args.length === 0) {
        return;
      }

      const rawCallback = unwrapExpression(args[0] as Node);
      const callback = resolveLocalExpression(rawCallback);
      const callbackText = callback.getText();

      // 1. Must read element width/dimension from ResizeObserver entry
      if (!DIMENSION_READ_REGEX.test(callbackText)) {
        return;
      }

      // 2. Must toggle classes or styling for responsive container adaptations
      if (!STYLING_MUTATION_REGEX.test(callbackText)) {
        return;
      }

      // 3. Skip canvas, WebGL, charts, Monaco editor, or virtual scroll viewports
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
    });

    return matches;
  },
};

export const sizeAwareStylingRule: AnalyzerRule = {
  id: 'size-aware-styling',
  guideId: 'size-aware-styling',
  guideHash: '89180c46bf23',
  summary:
    'ResizeObserver callbacks that measure element dimensions to toggle classes or styles should be replaced with CSS container queries (@container).',
  matcher: sizeAwareStylingJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'A ResizeObserver callback reads element dimensions (contentRect.width, borderBoxSize, offsetWidth, clientWidth) to toggle CSS classes (classList.add/remove/toggle, className =) or inline styles for responsive container breakpoints.',
      'The responsive layout adaptation can be implemented declaratively using CSS container queries (@container and container-type: inline-size).',
    ],
    dropWhen: [
      'The ResizeObserver resizes an HTML <canvas>, WebGL rendering context, SVG surface, or redraws continuous graphics.',
      'The ResizeObserver updates a virtualized scrolling viewport, infinite list, or windowed layout calculations.',
      'The ResizeObserver re-layouts third-party chart components (ECharts, Highcharts) or code editors (Monaco, CodeMirror).',
      'The code is guarded by a feature detection query checking CSS container query support.',
    ],
  },
};

export const sizeAwareStylingRules: readonly AnalyzerRule[] = [sizeAwareStylingRule];
