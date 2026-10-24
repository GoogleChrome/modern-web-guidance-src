import { Node, type SourceFile } from 'ts-morph';
import { isProtectedByFeatureGuard } from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const ANCHOR_POSITIONING_TAB_UNDERLINE_GUIDE_HASH = '53899a3a65ac';

const FAST_TOKENS: readonly string[] = [
  'offsetLeft',
  'offsetWidth',
  'getBoundingClientRect',
  'clientWidth',
] as const;

const FEATURE_TOKENS: readonly string[] = [
  'position-anchor',
  'anchor-name',
  'anchor(',
] as const;

const TAB_INDICATOR_IDENTIFIER_REGEX =
  /(?:indicator|underline|glider|tab[-_]?line|active[-_]?bar|tab[-_]?bar|tab[-_]?slider)/i;

const TAB_CONTEXT_REGEX =
  /(?:tab|nav[-_]?item|menu[-_]?item|active[-_]?tab|tab[-_]?list|segmented)/i;

const NON_TAB_CONTEXT_REGEX =
  /(?:carousel|map|leaflet|google\.maps|chart|slider|range)/i;

function isTabGeometryMeasurement(node: Node): boolean {
  if (Node.isPropertyAccessExpression(node)) {
    const propertyName = node.getName();
    if (
      propertyName === 'offsetLeft' ||
      propertyName === 'offsetWidth' ||
      propertyName === 'clientWidth'
    ) {
      const targetText = node.getExpression().getText();
      return (
        TAB_CONTEXT_REGEX.test(targetText) ||
        /item|button|element|target|current/i.test(targetText)
      );
    }
  }

  if (Node.isCallExpression(node)) {
    const callee = node.getExpression();
    if (
      Node.isPropertyAccessExpression(callee) &&
      callee.getName() === 'getBoundingClientRect'
    ) {
      const targetText = callee.getExpression().getText();
      return (
        TAB_CONTEXT_REGEX.test(targetText) ||
        /item|button|element|target|current/i.test(targetText)
      );
    }
  }

  return false;
}

export const anchorPositioningTabUnderlineMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: FAST_TOKENS,
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    const lowerPath = ctx.filePath.toLowerCase();
    if (
      lowerPath.includes('/test/') ||
      lowerPath.includes('/tests/') ||
      lowerPath.includes('/test/data/') ||
      lowerPath.includes('/fixtures/') ||
      lowerPath.includes('/fixture/') ||
      lowerPath.includes('__tests__')
    ) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    const matchedLines = new Set<number>();

    sourceFile.forEachDescendant((node: Node) => {
      if (!isTabGeometryMeasurement(node)) {
        return;
      }

      if (isProtectedByFeatureGuard(node, FEATURE_TOKENS)) {
        return;
      }

      let scopeNode: Node | undefined = node.getParent();
      while (
        scopeNode &&
        !Node.isFunctionDeclaration(scopeNode) &&
        !Node.isFunctionExpression(scopeNode) &&
        !Node.isArrowFunction(scopeNode) &&
        !Node.isMethodDeclaration(scopeNode) &&
        !Node.isSourceFile(scopeNode)
      ) {
        scopeNode = scopeNode.getParent();
      }

      if (!scopeNode || Node.isSourceFile(scopeNode)) {
        return;
      }

      const scopeText = scopeNode.getText();

      if (
        !TAB_CONTEXT_REGEX.test(scopeText) ||
        !TAB_INDICATOR_IDENTIFIER_REGEX.test(scopeText)
      ) {
        return;
      }

      if (NON_TAB_CONTEXT_REGEX.test(scopeText) && !/tab/i.test(scopeText)) {
        return;
      }

      const setsIndicatorStyle =
        scopeText.includes('.style.') ||
        scopeText.includes('.setProperty(') ||
        scopeText.includes('setIndicatorStyle') ||
        scopeText.includes('translateX(');

      if (!setsIndicatorStyle) {
        return;
      }

      const lineNumber = node.getStartLineNumber();
      if (matchedLines.has(lineNumber)) {
        return;
      }
      matchedLines.add(lineNumber);

      matches.push({
        line: lineNumber,
        message:
          'Imperative tab indicator positioning via offsetLeft/getBoundingClientRect inline styles; modernize with CSS Anchor Positioning (anchor-name on active tab and position-anchor on indicator).',
      });
    });

    return matches;
  },
};

export const anchorPositioningTabUnderlineRule: AnalyzerRule = {
  id: 'anchor-positioning-tab-underline',
  guideId: 'anchor-positioning-tab-underline',
  guideHash: ANCHOR_POSITIONING_TAB_UNDERLINE_GUIDE_HASH,
  summary:
    'Imperative JavaScript measurement (offsetLeft, offsetWidth, getBoundingClientRect) calculating active tab indicator positions and setting inline styles; replace with CSS Anchor Positioning.',
  matcher: anchorPositioningTabUnderlineMatcher,
  phase2Rubric: {
    keepWhen: [
      'A tab bar, navigation menu, or segmented control calculates the position or size of an active indicator (underline, glider, slider, or active bar) using offsetLeft, offsetWidth, or getBoundingClientRect().',
      'The script imperatively updates the indicator position via style.left, style.width, style.transform (translateX), or style.setProperty(--indicator-...).',
      'The imperative calculation can be replaced with CSS Anchor Positioning (e.g. anchor-name on active tab and position-anchor / anchor() on container pseudo-element).',
    ],
    dropWhen: [
      'The geometry measurement is used for tooltips, popovers, dropdown menus, or modals rather than tab indicator/underline navigation.',
      'The measurement is part of drag-and-drop, canvas drawing, chart rendering, or infinite list virtualization.',
      'The code is already guarded by a CSS anchor positioning support check (e.g. CSS.supports("position-anchor", "--tab")).',
    ],
  },
};

export const anchorPositioningTabUnderlineRules: readonly AnalyzerRule[] = [
  anchorPositioningTabUnderlineRule,
];
