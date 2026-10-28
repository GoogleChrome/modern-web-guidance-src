import type {
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
} from '../schema.ts';

export const SWITCH_GUIDE_HASH = '0b0a9d49545e';

export const switchMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'input[type="checkbox"][role="switch"]',
  fastTokens: ['switch'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['switch'],
  matchElement: (element: DomElementView, _ctx: DomMatcherContext) => {
    if (element.tagName !== 'input') {
      return null;
    }

    const typeAttr = (element.getAttribute('type') ?? '').trim().toLowerCase();
    const roleAttr = (element.getAttribute('role') ?? '').trim().toLowerCase();
    if (typeAttr !== 'checkbox' || roleAttr !== 'switch') {
      return null;
    }

    if (
      element.hasAttribute('switch') ||
      element.hasDynamicAttribute?.('switch')
    ) {
      return null;
    }

    return {
      message:
        '<input type="checkbox" role="switch"> lacks the native HTML switch attribute (<input type="checkbox" switch>).',
    };
  },
};

export const switchRule: AnalyzerRule = {
  id: 'switch',
  guideId: 'switch',
  guideHash: SWITCH_GUIDE_HASH,
  summary:
    '<input type="checkbox" role="switch"> elements should use the native HTML switch attribute (<input type="checkbox" switch>).',
  matcher: switchMatcher,
  verifierRubric: {
    keepWhen: [
      'An HTML or JSX <input type="checkbox" role="switch"> element implements a binary toggle switch without the native switch attribute.',
    ],
    dropWhen: [
      'The <input type="checkbox"> already has the native switch attribute.',
      'Standard checkbox controls without role="switch" or three-state toggle buttons.',
    ],
  },
};

export default [switchRule] satisfies readonly AnalyzerRule[];
