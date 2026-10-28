import type {
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
} from '../schema.ts';

export const SECURE_EXTERNAL_SUBRESOURCES_GUIDE_HASH = 'dfe6b556317c';

const MAX_HTML_LINE_LENGTH = 1200;
const matchedContexts = new WeakSet<DomMatcherContext>();

const KNOWN_PUBLIC_CDN_HOST_REGEX =
  /^https:\/\/(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|code\.jquery\.com|maxcdn\.bootstrapcdn\.com|stackpath\.bootstrapcdn\.com|ajax\.googleapis\.com)\//i;

const EXACT_VERSION_SEGMENT_REGEX =
  /(?:\/|@|-)v?\d+\.\d+\.\d+(?:-[0-9a-zA-Z.-]+)?(?:\/|\.|-)/;

const FLOATING_OR_COMBINED_CDN_URL_REGEX =
  /\/combine\/|@(?:latest|next|main|master)\b|[?#]|[{}<>]|<%|\$\{/i;

const SRI_DIGEST_PREFIX_REGEX = /\bsha(?:256|384|512)-[A-Za-z0-9+/=]+/;

export function isVersionedPublicCdnSubresourceUrl(
  rawUrl: string,
  tagName: 'script' | 'link',
): boolean {
  const url = rawUrl.trim();
  if (!KNOWN_PUBLIC_CDN_HOST_REGEX.test(url)) {
    return false;
  }
  if (FLOATING_OR_COMBINED_CDN_URL_REGEX.test(url)) {
    return false;
  }
  if (!EXACT_VERSION_SEGMENT_REGEX.test(url)) {
    return false;
  }
  if (tagName === 'script') {
    return /\.(?:js|mjs)$/i.test(url);
  }
  return /\.css$/i.test(url);
}

export const secureExternalSubresourcesMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'script[src], link[rel="stylesheet"][href]',
  fastTokens: [
    'https://cdnjs.cloudflare.com/',
    'https://cdn.jsdelivr.net/',
    'https://unpkg.com/',
    'https://code.jquery.com/',
    'https://maxcdn.bootstrapcdn.com/',
    'https://stackpath.bootstrapcdn.com/',
    'https://ajax.googleapis.com/',
    'integrity=',
  ],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['integrity', 'crossorigin', 'crossOrigin', 'src', 'href'],
  matchElement: (element: DomElementView, ctx: DomMatcherContext) => {
    if (matchedContexts.has(ctx)) {
      return null;
    }

    const tag = element.tagName;
    if (tag !== 'script' && tag !== 'link') {
      return null;
    }

    if (
      element.hasAttribute('importance') ||
      element.hasDynamicAttribute?.('importance') ||
      element.hasDynamicAttribute?.('integrity') ||
      element.hasDynamicAttribute?.('crossorigin') ||
      element.hasDynamicAttribute?.('crossOrigin')
    ) {
      return null;
    }

    if (tag === 'link') {
      const rel = (element.getAttribute('rel') ?? '').trim().toLowerCase();
      if (rel !== 'stylesheet') {
        return null;
      }
    }

    const urlAttr = tag === 'script' ? 'src' : 'href';
    if (element.hasDynamicAttribute?.(urlAttr)) {
      return null;
    }

    const rawUrl = (element.getAttribute(urlAttr) ?? '').trim();
    const lineText = ctx.documentText.split('\n')[element.line - 1] ?? '';
    if (lineText.length > MAX_HTML_LINE_LENGTH) {
      return null;
    }

    const hasIntegrity = element.hasAttribute('integrity');
    const hasCrossOrigin =
      element.hasAttribute('crossorigin') || element.hasAttribute('crossOrigin');

    if (hasIntegrity) {
      if (hasCrossOrigin) {
        return null;
      }
      const integrityVal = (element.getAttribute('integrity') ?? '').trim();
      if (
        !SRI_DIGEST_PREFIX_REGEX.test(integrityVal) ||
        !/^https:\/\//i.test(rawUrl)
      ) {
        return null;
      }
      matchedContexts.add(ctx);
      return {
        message: `External cross-origin <${tag}> resource (${rawUrl}) sets integrity without crossorigin; add crossorigin="anonymous" (and referrerpolicy="no-referrer") so the browser can CORS-verify the Subresource Integrity digest.`,
      };
    }

    if (!isVersionedPublicCdnSubresourceUrl(rawUrl, tag)) {
      return null;
    }

    matchedContexts.add(ctx);

    return {
      message: `External third-party CDN <${tag}> resource (${rawUrl}) lacks Subresource Integrity; add integrity="sha384-...", crossorigin="anonymous", and referrerpolicy="no-referrer".`,
    };
  },
};

export const secureExternalSubresourcesRule: AnalyzerRule = {
  id: 'secure-external-subresources',
  guideId: 'secure-external-subresources',
  guideHash: SECURE_EXTERNAL_SUBRESOURCES_GUIDE_HASH,
  summary:
    'Add Subresource Integrity (integrity="sha384-..."), crossorigin="anonymous", and referrerpolicy="no-referrer" to versioned third-party CDN <script> and <link rel="stylesheet"> elements.',
  matcher: secureExternalSubresourcesMatcher,
  verifierRubric: {
    keepWhen: [
      'An HTML or JSX <script src="https://..."> or <link rel="stylesheet" href="https://..."> loads an immutable, version-pinned asset from a public third-party CDN (cdnjs.cloudflare.com, cdn.jsdelivr.net, unpkg.com, code.jquery.com, maxcdn.bootstrapcdn.com, stackpath.bootstrapcdn.com, ajax.googleapis.com) without an integrity attribute.',
      'An external cross-origin <script src="https://..."> or <link rel="stylesheet" href="https://..."> specifies integrity="sha..." but omits the required crossorigin="anonymous" attribute.',
    ],
    dropWhen: [
      'The <script> or <link> element already includes both an integrity="sha256-... | sha384-... | sha512-..." attribute and a crossorigin attribute.',
      'The URL points to a mutable/unversioned endpoint (such as analytics tags, live widgets, or Google Fonts CSS) or a first-party same-origin asset.',
    ],
  },
};

export default [
  secureExternalSubresourcesRule,
] satisfies readonly AnalyzerRule[];
