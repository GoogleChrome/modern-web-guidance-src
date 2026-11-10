import type {
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
} from '../schema.ts';

export const PROGRESS_GUIDE_HASH = '25f9fce7854b';

const CIRCULAR_OR_SPINNER_CLASS_REGEX =
  /\b(?:progress-ring|circular-progress|circle-progress|radial-progress|spinner|spinner-border|spinner-grow|loading-spinner)\b/i;

export const progressDomMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: '[role="progressbar"]',
  fastTokens: ['progressbar'] as const,
  matchElement(
    element: DomElementView,
    ctx: DomMatcherContext,
  ): { message: string } | null {
    const tag = element.tagName.toLowerCase();
    if (tag === 'progress' || tag === 'svg' || tag === 'circle') {
      return null;
    }

    // Must be a determinate progress bar with aria-valuenow (indeterminate bars without aria-valuenow belong to spinner)
    if (!element.hasAttribute('aria-valuenow')) {
      return null;
    }

    const classAttr =
      element.getAttribute('class') ?? element.getAttribute('className') ?? '';
    const idAttr = element.getAttribute('id') ?? '';
    const combined = `${classAttr} ${idAttr}`;

    // Carve out circular progress rings (progress-ring) and spinners (spinner)
    if (CIRCULAR_OR_SPINNER_CLASS_REGEX.test(combined)) {
      return null;
    }

    // Also skip if the element wraps an SVG progress ring in the immediate markup
    const lines = ctx.documentText.split('\n');
    const startIdx = Math.max(0, element.line - 1);
    const windowText = lines.slice(startIdx, startIdx + 8).join('\n');
    if (/<svg\b|<circle\b|stroke-dashoffset/i.test(windowText)) {
      return null;
    }

    return {
      message:
        'Custom determinate <div role="progressbar" aria-valuenow="..."> can be replaced with a semantic HTML <progress value="..." max="..."> element styled with CSS accent-color or progress pseudo-elements.',
    };
  },
};

export const progressRule: AnalyzerRule = {
  id: 'progress',
  guideId: 'progress',
  guideHash: PROGRESS_GUIDE_HASH,
  summary:
    'Custom determinate <div role="progressbar" aria-valuenow="..."> elements can be replaced with native HTML <progress> styled with CSS accent-color or progress pseudo-elements.',
  matcher: progressDomMatcher,
  verifierRubric: {
    keepWhen: [
      'HTML or component markup defines a non-semantic container (such as <div> or <span>) with role="progressbar" and aria-valuenow to render a linear determinate progress bar.',
    ],
    dropWhen: [
      'The element is already a native <progress> element.',
      'The element is a circular SVG progress ring using <svg>/<circle> and stroke-dasharray/stroke-dashoffset (covered by progress-ring).',
      'The element is an indeterminate loading spinner without aria-valuenow (covered by spinner).',
      'The progress bar is a multi-segment stacked bar chart with multiple distinct colored series inside a single track.',
    ],
  },
};

export default [
  progressRule,
] satisfies readonly AnalyzerRule[];
