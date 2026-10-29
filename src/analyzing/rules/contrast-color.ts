import {
  Node,
  SyntaxKind,
  type SourceFile,
} from 'ts-morph';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const CONTRAST_COLOR_GUIDE_HASH = '119018e98472';

function isNestedFunction(node: Node): boolean {
  return (
    Node.isFunctionDeclaration(node) ||
    Node.isFunctionExpression(node) ||
    Node.isArrowFunction(node) ||
    Node.isMethodDeclaration(node)
  );
}

/**
 * Checks whether a function's own body computes a luminance or YIQ contrast score.
 */
function isLuminanceOrYiqCalculation(node: Node): boolean {
  let hasYiqR = false;
  let hasYiqG = false;
  let hasWcagR = false;
  let hasWcagG = false;

  node.forEachDescendant((child, traversal) => {
    if (isNestedFunction(child)) {
      traversal.skip();
      return;
    }

    if (Node.isNumericLiteral(child)) {
      const parent = child.getParent();
      if (
        !parent ||
        !Node.isBinaryExpression(parent) ||
        parent.getOperatorToken().getKind() !== SyntaxKind.AsteriskToken
      ) {
        return;
      }
      const val = child.getLiteralValue();
      if (Math.abs(val - 0.299) < 0.001 || Math.abs(val - 299) < 0.001) hasYiqR = true;
      if (Math.abs(val - 0.587) < 0.001 || Math.abs(val - 587) < 0.001) hasYiqG = true;
      if (Math.abs(val - 0.2126) < 0.001) hasWcagR = true;
      if (Math.abs(val - 0.7152) < 0.001) hasWcagG = true;
    }
  });

  return (hasYiqR && hasYiqG) || (hasWcagR && hasWcagG);
}

/**
 * Checks whether a function's own body selects between black (#000/black) and white (#fff/white) colors.
 */
function scopePicksBlackOrWhiteColor(scope: Node): boolean {
  let hasBlack = false;
  let hasWhite = false;

  scope.forEachDescendant((child, traversal) => {
    if (isNestedFunction(child)) {
      traversal.skip();
      return;
    }

    if (Node.isStringLiteral(child)) {
      const text = child.getLiteralText().toLowerCase().trim();
      if (text === '#000' || text === '#000000' || text === 'black') hasBlack = true;
      if (text === '#fff' || text === '#ffffff' || text === 'white') hasWhite = true;
    }
  });

  return hasBlack && hasWhite;
}

export const contrastColorJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['0.299', '299', '0.2126', 'getContrast', 'contrastColor', 'luminance'] as const,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];

    // Skip test files
    if (
      ctx.filePath.includes('.test.') ||
      ctx.filePath.includes('.spec.') ||
      ctx.filePath.includes('/test/') ||
      ctx.filePath.includes('/tests/')
    ) {
      return matches;
    }

    const lowerPath = ctx.filePath.toLowerCase();
    if (
      lowerPath.includes('canvas') ||
      lowerPath.includes('webgl') ||
      lowerPath.includes('shader') ||
      lowerPath.includes('image-process')
    ) {
      return matches;
    }

    const functions = [
      ...sourceFile.getFunctions(),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
    ];

    for (const fn of functions) {
      const fnText = fn.getText();
      if (
        fnText.includes('getImageData') ||
        fnText.includes('getContext') ||
        fnText.includes('HTMLCanvasElement')
      ) {
        continue;
      }

      if (!isLuminanceOrYiqCalculation(fn)) {
        continue;
      }

      if (!scopePicksBlackOrWhiteColor(fn)) {
        continue;
      }

      matches.push({
        line: fn.getStartLineNumber(),
        column: fn.getStartLinePos(),
        message:
          'Manual luminance or YIQ contrast calculation to select black/white text color; native CSS contrast-color() computes the optimal contrasting text color automatically from background colors.',
      });
    }

    return matches;
  },
};

export const contrastColorCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['oklch', 'sign('] as const,
  matchRule(styleRule: CssRuleView, _ctx: CssMatcherContext): { message: string } | null {
    const colorVal = styleRule.getPropertyValue('color');
    if (!colorVal) {
      return null;
    }

    // Check for CSS Relative Color Syntax threshold hack:
    // e.g. oklch(from var(--bg) max(0, sign(var(--threshold) - l)) ...)
    if (
      colorVal.includes('oklch(from') &&
      colorVal.includes('sign(')
    ) {
      return {
        message:
          'CSS Relative Color Syntax luminance threshold hack used for contrast; native CSS contrast-color() provides automatic high-contrast text color selection.',
      };
    }

    return null;
  },
};

export const contrastColorJsRule: AnalyzerRule = {
  id: 'contrast-color/js',
  guideId: 'contrast-color',
  guideHash: CONTRAST_COLOR_GUIDE_HASH,
  summary:
    'Use native CSS contrast-color() instead of manual JavaScript luminance/YIQ contrast calculations to determine readable text colors.',
  matcher: contrastColorJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript luminance or YIQ contrast helper function calculating black vs white text color based on background color',
    ],
    dropWhen: [
      'Accessibility audit testing suite validating WCAG contrast ratios without rendering UI colors',
      'Canvas or WebGL pixel data processing pipeline',
    ],
  },
};

export const contrastColorCssRule: AnalyzerRule = {
  id: 'contrast-color/css',
  guideId: 'contrast-color',
  guideHash: CONTRAST_COLOR_GUIDE_HASH,
  summary:
    'Use native CSS contrast-color() instead of complex Relative Color Syntax luminance threshold hacks with sign() and max().',
  matcher: contrastColorCssMatcher,
  verifierRubric: {
    keepWhen: [
      'CSS Relative Color Syntax luminance threshold hack with sign() used to flip foreground color based on background',
    ],
    dropWhen: [
      'Static color declaration without dynamic luminance calculation',
      'CSS already using native contrast-color()',
    ],
  },
};

export const contrastColorRule: AnalyzerRule = contrastColorJsRule;

export default [
  contrastColorJsRule,
  contrastColorCssRule,
] satisfies readonly AnalyzerRule[];
