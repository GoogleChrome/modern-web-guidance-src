import { Node, type SourceFile } from 'ts-morph';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const PROGRESS_RING_GUIDE_HASH = 'd83085aceb0f';

const FAST_TOKENS: readonly string[] = [
  'strokeDashoffset',
  'strokeDasharray',
  'stroke-dashoffset',
  'stroke-dasharray',
  'circumference',
  'Math.PI',
] as const;

function isProgressRingCalculation(scopeText: string): boolean {
  const hasStrokeDash =
    scopeText.includes('strokeDashoffset') ||
    scopeText.includes('strokeDasharray') ||
    scopeText.includes('stroke-dashoffset') ||
    scopeText.includes('stroke-dasharray');

  if (!hasStrokeDash) {
    return false;
  }

  const hasCircumferenceFormula =
    scopeText.includes('Math.PI') ||
    scopeText.includes('circumference') ||
    scopeText.includes('/ 100') ||
    scopeText.includes('* 0.01');

  return hasCircumferenceFormula;
}

export const progressRingJsMatcher: JsRuleMatcher = {
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
      let isCandidate = false;

      if (
        Node.isFunctionDeclaration(node) ||
        Node.isFunctionExpression(node) ||
        Node.isArrowFunction(node) ||
        Node.isMethodDeclaration(node)
      ) {
        const text = node.getText();
        if (isProgressRingCalculation(text)) {
          isCandidate = true;
        }
      }

      if (Node.isJsxOpeningElement(node) || Node.isJsxSelfClosingElement(node)) {
        const tagName = node.getTagNameNode().getText();
        if (tagName === 'circle') {
          const attributesText = node.getText();
          if (
            (attributesText.includes('strokeDashoffset') ||
              attributesText.includes('stroke-dashoffset')) &&
            (attributesText.includes('strokeDasharray') ||
              attributesText.includes('stroke-dasharray') ||
              attributesText.includes('circumference') ||
              attributesText.includes('offset'))
          ) {
            isCandidate = true;
          }
        }
      }

      if (!isCandidate) {
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
          'SVG circle stroke-dashoffset formula used for circular progress indicator; modernize using native <progress> with conic-gradient() and mask-image or pathLength="100".',
      });
    });

    return matches;
  },
};

export const progressRingDomMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'circle',
  fastTokens: ['stroke-dashoffset', 'stroke-dasharray'],
  matchElement: (element: DomElementView, ctx: DomMatcherContext) => {
    const lowerPath = ctx.filePath.toLowerCase();
    if (
      lowerPath.includes('/test/') ||
      lowerPath.includes('/tests/') ||
      lowerPath.includes('/test/data/') ||
      lowerPath.includes('/fixtures/') ||
      lowerPath.includes('/fixture/') ||
      lowerPath.includes('__tests__')
    ) {
      return null;
    }

    if (element.getAttribute('pathLength') === '100') {
      return null;
    }

    const hasDashoffset =
      element.hasAttribute('stroke-dashoffset') ||
      element.hasAttribute('stroke-dasharray');

    if (!hasDashoffset) {
      return null;
    }

    const elementClass = element.getAttribute('class') ?? '';
    const elementId = element.getAttribute('id') ?? '';
    const ariaLabel = element.getAttribute('aria-label') ?? '';
    const role = element.getAttribute('role') ?? '';

    // Check circle element attributes for progress context
    const elementAttrs = `${elementClass} ${elementId} ${ariaLabel} ${role}`.toLowerCase();
    let isProgress =
      elementAttrs.includes('progress') ||
      elementAttrs.includes('gauge') ||
      elementAttrs.includes('meter') ||
      (elementAttrs.includes('ring') && !elementAttrs.includes('spring'));

    if (!isProgress) {
      // Check enclosing <svg> tag attributes (up to 20 lines before circle)
      const lines = ctx.documentText.split('\n');
      for (let i = element.line - 1; i >= 0 && i >= element.line - 20; i--) {
        const line = lines[i] ?? '';
        if (/<svg\b/i.test(line)) {
          const svgTag = line.slice(line.lastIndexOf('<svg'));
          const lowerSvg = svgTag.toLowerCase();
          if (
            lowerSvg.includes('progress') ||
            lowerSvg.includes('gauge') ||
            lowerSvg.includes('meter') ||
            lowerSvg.includes('ring')
          ) {
            isProgress = true;
          }
          break;
        }
      }
    }

    if (!isProgress) {
      return null;
    }

    return {
      message:
        'SVG circle stroke-dashoffset used for circular progress indicator; modernize using native <progress> with conic-gradient() or SVG pathLength="100".',
    };
  },
};

export const progressRingRule: AnalyzerRule = {
  id: 'progress-ring',
  guideId: 'progress-ring',
  guideHash: PROGRESS_RING_GUIDE_HASH,
  summary:
    'Imperative SVG circle strokeDashoffset calculation for circular progress indicators; replace with native <progress> and CSS conic-gradient() or SVG pathLength="100".',
  matcher: progressRingJsMatcher,
  verifierRubric: {
    keepWhen: [
      'The component implements a circular progress bar, progress ring, or completion meter using an SVG <circle> and dynamically computed strokeDashoffset or strokeDasharray.',
      'The script calculates circle circumference using 2 * Math.PI * radius and offsets the stroke based on progress percentage.',
      'The circular progress indicator can be modernized using the semantic <progress> element styled with conic-gradient() and mask-image, or SVG pathLength="100".',
    ],
    dropWhen: [
      'The component already uses the native <progress> element.',
      'The SVG circle uses pathLength="100" to avoid imperative circumference math.',
      'The SVG drawing is a decorative illustration, chart pie slice, or clock face rather than a progress/completion indicator.',
    ],
  },
};

export const progressRingDomRule: AnalyzerRule = {
  id: 'progress-ring/dom',
  guideId: 'progress-ring',
  guideHash: PROGRESS_RING_GUIDE_HASH,
  summary:
    'Static SVG circular progress indicator using stroke-dashoffset; modernize using native <progress> with conic-gradient() or SVG pathLength="100".',
  matcher: progressRingDomMatcher,
  verifierRubric: {
    keepWhen: [
      'The SVG circle element visually represents a circular progress bar or gauge using stroke-dashoffset.',
      'The element lacks pathLength="100" and can be refactored to native <progress> with CSS conic-gradient().',
    ],
    dropWhen: [
      'The element defines pathLength="100".',
      'The circle is part of an SVG icon, avatar, or decorative border without progress semantics.',
    ],
  },
};

export default [
  progressRingRule,
  progressRingDomRule,
] satisfies readonly AnalyzerRule[];
