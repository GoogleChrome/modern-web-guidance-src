import type {
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
} from '../schema.ts';

export const SCROLLSPY_GUIDE_HASH = 'd689593b76c5';

const scrollspyDomMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector:
    '[data-spy="scroll"], [data-bs-spy="scroll"], [data-spy], [data-bs-spy], [class*="scrollspy"], [data-scrollspy]',
  fastTokens: ['data-spy', 'data-bs-spy', 'data-scrollspy', 'scrollspy', 'ScrollSpy', 'data-target', 'data-bs-target'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['data-spy', 'data-bs-spy'],
  matchElement: (element: DomElementView, _ctx: DomMatcherContext) => {
    const dataSpy = element.getAttribute('data-spy')?.toLowerCase().trim();
    const dataBsSpy = element.getAttribute('data-bs-spy')?.toLowerCase().trim();

    if (dataSpy === 'scroll' || dataBsSpy === 'scroll') {
      const attrName = dataBsSpy === 'scroll' ? 'data-bs-spy' : 'data-spy';
      return {
        message:
          `Legacy scrollspy attribute (${attrName}="scroll") tracks active sections imperatively; modernize with CSS scroll-target-group: auto and :target-current.`,
      };
    }

    if (element.hasAttribute('data-scrollspy')) {
      return {
        message:
          'Legacy data-scrollspy attribute tracks active sections imperatively; modernize with CSS scroll-target-group: auto and :target-current.',
      };
    }

    const classAttr = element.getAttribute('class')?.toLowerCase() ?? '';
    const hasScrollSpyClass = classAttr.includes('scrollspy');
    const hasTargetAttr =
      element.hasAttribute('data-target') ||
      element.hasAttribute('data-bs-target');

    if (hasScrollSpyClass && (hasTargetAttr || element.hasAttribute('data-spy') || element.hasAttribute('data-bs-spy'))) {
      return {
        message:
          'Legacy scrollspy class and target attributes track navigation sections imperatively; modernize with CSS scroll-target-group: auto and :target-current.',
      };
    }

    return null;
  },
};

export const scrollspyRule: AnalyzerRule = {
  id: 'scrollspy',
  guideId: 'scrollspy',
  guideHash: SCROLLSPY_GUIDE_HASH,
  summary:
    'Legacy Bootstrap data-spy="scroll" or data-bs-spy="scroll" attributes should be modernized with CSS scroll-target-group: auto and :target-current.',
  matcher: scrollspyDomMatcher,
  verifierRubric: {
    keepWhen: [
      'DOM element specifies legacy Bootstrap data-spy="scroll" or data-bs-spy="scroll" attribute (or scrollspy classes with data-target/data-bs-target) to highlight active navigation links based on scroll position.',
      'JavaScript initializes a scrollspy plugin via $(...).scrollspy(...) or new bootstrap.ScrollSpy(...).',
      'JavaScript scroll event listener measures section positions (offsetTop, getBoundingClientRect().top, scrollY, pageYOffset) to compute the active section and toggle "active" class or aria-current on navigation links.',
      'IntersectionObserver callback tracks section visibility to toggle active or aria-current states on navigation or TOC links.',
    ],
    dropWhen: [
      'The navigation container or stylesheet already implements CSS scroll-target-group: auto and :target-current.',
      'The scroll event listener handles unrelated scroll behaviors such as infinite scroll loading, scroll-to-top floating button visibility, parallax canvas animations, or reading progress bars.',
      'IntersectionObserver is used for lazy loading images, infinite scrolling, or animation entry triggers without managing active navigation link state.',
      'Complex multi-container scroll coordinators or custom interactive graph navigators with non-linear section hierarchies that cannot map to fragment links.',
    ],
  },
};

export default [scrollspyRule] satisfies readonly AnalyzerRule[];
