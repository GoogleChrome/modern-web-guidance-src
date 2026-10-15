import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

function parsePaddingPercentage(val: string | null): number | null {
  if (!val) {
    return null;
  }
  const clean = val.trim().toLowerCase();
  const match = /^([0-9]+(?:\.[0-9]+)?)\s*%$/.exec(clean);
  if (!match || !match[1]) {
    return null;
  }
  return parseFloat(match[1]);
}

function isZeroHeight(val: string | null): boolean {
  if (!val) {
    return false;
  }
  const clean = val.trim().toLowerCase();
  return clean === '0' || clean === '0px' || clean === '0%';
}

function isRelativePosition(val: string | null): boolean {
  if (!val) {
    return false;
  }
  return val.trim().toLowerCase() === 'relative';
}

const cssLayoutCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['56.25', '75%'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    // 1. If stylesheet already defines aspect-ratio, skip
    if (ctx.stylesheetHasProperty('aspect-ratio')) {
      return null;
    }

    // 2. Skip if inside @supports block checking aspect-ratio
    if (styleRule.parentAtRule) {
      const atRuleLower = styleRule.parentAtRule.toLowerCase();
      if (atRuleLower.includes('aspect-ratio')) {
        return null;
      }
    }

    const padBottom = parsePaddingPercentage(styleRule.getPropertyValue('padding-bottom'));
    const padTop = parsePaddingPercentage(styleRule.getPropertyValue('padding-top'));

    const is16by9 = (p: number | null) => p !== null && Math.abs(p - 56.25) < 0.1;
    const is4by3 = (p: number | null) => p !== null && Math.abs(p - 75) < 0.1;

    const matches16by9 = is16by9(padBottom) || is16by9(padTop);

    const heightVal = styleRule.getPropertyValue('height');
    const posVal = styleRule.getPropertyValue('position');
    const hasAspectMarker = isZeroHeight(heightVal) || isRelativePosition(posVal);

    const matches4by3 = (is4by3(padBottom) || is4by3(padTop)) && hasAspectMarker;

    if (!matches16by9 && !matches4by3) {
      return null;
    }

    const ratio = matches16by9 ? '16 / 9' : '4 / 3';
    return {
      message: `CSS rule uses padding percentage hack to enforce ${ratio} aspect ratio; modernize with native aspect-ratio: ${ratio}.`,
    };
  },
};

export const cssLayoutRule: AnalyzerRule = {
  id: 'css-layout',
  guideId: 'css-layout',
  guideHash: 'b2ddd28dc261',
  summary:
    'Percentage padding hacks (e.g. padding-bottom: 56.25% or 75%) enforce intrinsic aspect ratios; replace with native aspect-ratio.',
  matcher: cssLayoutCssMatcher,
  phase2Rubric: {
    keepWhen: [
      'The CSS rule uses a percentage padding-bottom or padding-top hack (such as 56.25% for 16:9 or 75% for 4:3) on a container to maintain an intrinsic aspect ratio for responsive media (iframes, video, cards).',
      'The aspect ratio container workaround is used without declaring the standard CSS aspect-ratio property.',
    ],
    dropWhen: [
      'The stylesheet already defines standard aspect-ratio property declarations.',
      'The rule uses genuine content padding for text or fluid layout spacing where children are not absolutely positioned.',
      'The rule is inside a fallback block guarded by @supports (aspect-ratio: 16 / 9).',
    ],
  },
};

export const cssLayoutRules: readonly AnalyzerRule[] = [cssLayoutRule];
