import type {
  AnalyzerRule,
  DomElementView,
  DomRuleMatcher,
} from '../schema.ts';

export const PRERENDERING_CUSTOM_ELEMENTS_GUIDE_HASH = '829dba278359';

const VALID_SHADOWROOT_MODES = new Set(['open', 'closed']);

export const prerenderingCustomElementsMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'template[shadowroot]',
  fastTokens: ['shadowroot'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['shadowrootmode', 'shadowRootMode', 'shadowroot', 'shadowRoot'],
  matchElement: (element: DomElementView) => {
    if (element.tagName !== 'template') {
      return null;
    }

    if (
      element.hasAttribute('shadowrootmode') ||
      element.hasAttribute('shadowRootMode') ||
      element.hasDynamicAttribute?.('shadowrootmode') ||
      element.hasDynamicAttribute?.('shadowRootMode')
    ) {
      return null;
    }

    const mode = (element.getAttribute('shadowroot') ?? '')
      .trim()
      .toLowerCase();
    if (!VALID_SHADOWROOT_MODES.has(mode)) {
      return null;
    }

    return {
      message: `Deprecated Declarative Shadow DOM attribute shadowroot="${mode}" on <template>; use standard shadowrootmode="${mode}" instead.`,
    };
  },
};

export const prerenderingCustomElementsRule: AnalyzerRule = {
  id: 'prerendering-custom-elements',
  guideId: 'prerendering-custom-elements',
  guideHash: PRERENDERING_CUSTOM_ELEMENTS_GUIDE_HASH,
  summary:
    'Replace deprecated Declarative Shadow DOM <template shadowroot="open|closed"> attribute with standard shadowrootmode="open|closed".',
  matcher: prerenderingCustomElementsMatcher,
  verifierRubric: {
    keepWhen: [
      'A <template> element uses the deprecated shadowroot="open" or shadowroot="closed" attribute without shadowrootmode.',
    ],
    dropWhen: [
      'The <template> element already specifies shadowrootmode="open" or shadowrootmode="closed".',
      'Standard <template> elements used for client-side cloning without a shadowroot attribute.',
    ],
  },
};

export default [
  prerenderingCustomElementsRule,
] satisfies readonly AnalyzerRule[];
