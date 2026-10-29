import type {
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
} from '../schema.ts';

export const OPTIMIZE_IMAGE_PRIORITY_GUIDE_HASH = '7ae520e19777';

const HERO_LCP_TOKEN_REGEX =
  /(?:^|[\s_-])(?:hero|lcp)(?:$|[\s_-])/i;

function isHrefReferencedInImgSrc(
  documentText: string,
  href: string,
): boolean {
  if (!href) {
    return false;
  }
  const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const imgSrcRegex = new RegExp(
    `<img\\b[^>]*\\bsrc\\s*=\\s*['"]${escapedHref}['"]`,
    'i',
  );
  return imgSrcRegex.test(documentText);
}

export const optimizeImagePriorityMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'link[rel="preload"][as="image"], img',
  fastTokens: ['preload', 'loading', 'importance', 'fetchpriority', 'fetchPriority', 'hero', 'lcp'],
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
      if (
        rel !== 'preload' ||
        asAttr !== 'image' ||
        element.hasAttribute('fetchpriority') ||
        element.hasAttribute('fetchPriority') ||
        element.hasAttribute('imagesrcset') ||
        element.hasAttribute('imageSrcSet')
      ) {
        return null;
      }
      const href = (element.getAttribute('href') ?? '').trim();
      if (
        !isHrefReferencedInImgSrc(ctx.documentText, href) ||
        (!element.hasAttribute('importance') && !/(?:hero|lcp)/i.test(href))
      ) {
        return null;
      }
      return {
        message:
          'Redundant <link rel="preload" as="image"> without fetchpriority or imagesrcset; set fetchpriority="high" directly on the LCP <img> element.',
      };
    }

    if (element.tagName !== 'img') {
      return null;
    }

    const fetchPriority = (
      element.getAttribute('fetchpriority') ??
      element.getAttribute('fetchPriority') ??
      ''
    )
      .trim()
      .toLowerCase();
    const loading = (element.getAttribute('loading') ?? '').trim().toLowerCase();

    if (fetchPriority === 'high' && loading === 'lazy') {
      return {
        message:
          'Conflicting fetchpriority="high" and loading="lazy" on <img>; use fetchpriority="high" without loading="lazy" for LCP images, or remove fetchpriority="high" for offscreen images.',
      };
    }

    if (element.hasAttribute('importance')) {
      return {
        message:
          'Deprecated importance attribute on <img> should be replaced with standard fetchpriority="high" or fetchpriority="low".',
      };
    }

    if (loading === 'auto') {
      return {
        message:
          'Deprecated loading="auto" attribute on <img> should be replaced with explicit fetchpriority="high" for LCP images or loading="lazy" for offscreen images.',
      };
    }

    if (fetchPriority) {
      return null;
    }

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

    return null;
  },
};

export const optimizeImagePriorityRule: AnalyzerRule = {
  id: 'optimize-image-priority',
  guideId: 'optimize-image-priority',
  guideHash: OPTIMIZE_IMAGE_PRIORITY_GUIDE_HASH,
  summary:
    'LCP and hero <img> elements should use fetchpriority="high" and avoid deprecated importance, loading="auto", or conflicting fetchpriority="high" with loading="lazy".',
  matcher: optimizeImagePriorityMatcher,
  verifierRubric: {
    keepWhen: [
      'An HTML or JSX template uses <link rel="preload" as="image"> without fetchpriority or imagesrcset to boost a statically discoverable hero/LCP <img> in the same document.',
      'An <img> element uses the deprecated importance attribute or deprecated loading="auto" value instead of standard fetchpriority and loading attributes.',
      'An <img> element combines conflicting fetchpriority="high" and loading="lazy" attributes.',
      'A hero or LCP candidate <img loading="eager"> with an explicit hero/LCP class or id lacks fetchpriority="high".',
    ],
    dropWhen: [
      'The <img> already specifies valid fetchpriority="high" or fetchpriority="low" without conflicting loading="lazy", or uses loading="lazy" for below-the-fold images.',
      'fetchpriority is used on <script> or responsive <link rel="preload" as="image" imagesrcset="..."> tags.',
    ],
  },
};

export default [
  optimizeImagePriorityRule,
] satisfies readonly AnalyzerRule[];
