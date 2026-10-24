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

/**
 * Checks whether an expression computes a luminance or YIQ contrast score.
 */
function isLuminanceOrYiqCalculation(node: Node): boolean {
  let hasYiq = false;
  let hasWcag = false;

  node.forEachDescendant((child) => {
    if (hasYiq || hasWcag) return;

    if (Node.isNumericLiteral(child)) {
      const val = child.getLiteralValue();
      if (Math.abs(val - 0.299) < 0.001 || Math.abs(val - 299) < 0.001) {
        hasYiq = true;
      }
      if (Math.abs(val - 0.2126) < 0.001) {
        hasWcag = true;
      }
    }
  });

  return hasYiq || hasWcag;
}

/**
 * Checks whether an enclosing scope returns or sets black/white or #000/#fff text colors.
 */
function scopePicksBlackOrWhiteColor(scope: Node): boolean {
  let hasColorChoice = false;

  scope.forEachDescendant((child) => {
    if (hasColorChoice) return;

    if (Node.isStringLiteral(child)) {
      const text = child.getLiteralText().toLowerCase().trim();
      if (
        text === '#000' ||
        text === '#000000' ||
        text === '#fff' ||
        text === '#ffffff' ||
        text === 'black' ||
        text === 'white'
      ) {
        hasColorChoice = true;
      }
    }
  });

  return hasColorChoice;
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

    const functions = [
      ...sourceFile.getFunctions(),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
    ];

    for (const fn of functions) {
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
  phase2Rubric: {
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
  phase2Rubric: {
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

export const contrastColorRules: readonly AnalyzerRule[] = [
  contrastColorJsRule,
  contrastColorCssRule,
];
