import type {
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
} from '../schema.ts';

export const OPTIMIZE_IMAGE_PRIORITY_GUIDE_HASH = '7ae520e19777';

const HERO_LCP_TOKEN_REGEX =
  /(?:^|[\s_-])(?:hero|lcp)(?:$|[\s_-])/i;

function isHrefReferencedInCssBackground(
  documentText: string,
  href: string,
): boolean {
  if (!href) {
    return false;
  }
  const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const bgUrlRegex = new RegExp(
    `background(?:-image|Image)?\\s*[:=][^;{}]*url\\(\\s*['"]?${escapedHref}['"]?\\s*\\)`,
    'i',
  );
  return bgUrlRegex.test(documentText);
}

export const optimizeImagePriorityMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'link[rel="preload"][as="image"], img',
  fastTokens: ['preload', 'loading', 'importance', 'hero', 'lcp'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['fetchpriority', 'fetchPriority'],
  matchElement: (element: DomElementView, ctx: DomMatcherContext) => {
    if (
      element.hasDynamicAttribute?.('fetchpriority') ||
      element.hasDynamicAttribute?.('fetchPriority')
    ) {
      return null;
    }

    if (element.tagName === 'link') {
      const rel = (element.getAttribute('rel') ?? '').trim().toLowerCase();
      const asAttr = (element.getAttribute('as') ?? '').trim().toLowerCase();
      if (rel !== 'preload' || asAttr !== 'image') {
        return null;
      }
      if (
        element.hasAttribute('fetchpriority') ||
        element.hasAttribute('fetchPriority') ||
        element.hasAttribute('imagesrcset') ||
        element.hasAttribute('imageSrcSet')
      ) {
        return null;
      }
      if (!/<img\b/i.test(ctx.documentText)) {
        return null;
      }
      const href = (element.getAttribute('href') ?? '').trim();
      if (isHrefReferencedInCssBackground(ctx.documentText, href)) {
        return null;
      }
      return {
        message:
          'Redundant <link rel="preload" as="image"> without fetchpriority or imagesrcset; set fetchpriority="high" directly on the LCP <img> element.',
      };
    }

    if (element.tagName === 'img') {
      if (
        element.hasAttribute('fetchpriority') ||
        element.hasAttribute('fetchPriority')
      ) {
        return null;
      }

      if (element.hasAttribute('importance')) {
        return {
          message:
            'Deprecated importance attribute on <img> should be replaced with standard fetchpriority="high" or fetchpriority="low".',
        };
      }

      const loading = (element.getAttribute('loading') ?? '').trim().toLowerCase();
      if (loading !== 'eager') {
        return null;
      }

      const classAttr = element.getAttribute('class') ?? element.getAttribute('classname') ?? '';
      const idAttr = element.getAttribute('id') ?? '';
      if (HERO_LCP_TOKEN_REGEX.test(classAttr) || HERO_LCP_TOKEN_REGEX.test(idAttr)) {
        return {
          message:
            'Hero/LCP <img loading="eager"> lacks fetchpriority="high" to elevate Largest Contentful Paint loading priority.',
        };
      }
    }

    return null;
  },
};

export const optimizeImagePriorityRule: AnalyzerRule = {
  id: 'optimize-image-priority',
  guideId: 'optimize-image-priority',
  guideHash: OPTIMIZE_IMAGE_PRIORITY_GUIDE_HASH,
  summary:
    'LCP and hero images using <link rel="preload" as="image"> without fetchpriority/imagesrcset or <img loading="eager"> without fetchpriority="high" should use fetchpriority="high".',
  matcher: optimizeImagePriorityMatcher,
  verifierRubric: {
    keepWhen: [
      'An HTML or JSX template uses <link rel="preload" as="image"> without fetchpriority or imagesrcset to boost a statically discoverable hero image.',
      'A hero or LCP candidate <img loading="eager"> with an explicit hero/LCP class or id lacks fetchpriority="high", or uses the deprecated importance attribute.',
    ],
    dropWhen: [
      'The <img> already specifies fetchpriority="high" or fetchpriority="low", or uses loading="lazy" for below-the-fold images.',
      'fetchpriority is used on <script> or responsive <link rel="preload" as="image" imagesrcset="..."> tags.',
    ],
  },
};

export const optimizeImagePriorityRules: readonly AnalyzerRule[] = [
  optimizeImagePriorityRule,
];
