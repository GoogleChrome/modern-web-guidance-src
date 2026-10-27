import {
  Node,
  SyntaxKind,
  type NewExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isGlobalReference,
  isProtectedByFeatureGuard,
  resolveCallableNode,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createDependencyMatcher } from '../scanners/dependency-scanner.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  DependencyRuleMatcher,
  JsRuleMatcher,
} from '../schema.ts';

export const LAZY_LOAD_VIDEO_AND_AUDIO_GUIDE_HASH = 'c50b0797091a';

const LAZY_MEDIA_PACKAGES = [
  'vanilla-lazyload',
  'lozad',
] as const;

const LAZY_MEDIA_GUARD_TOKENS = [
  'HTMLMediaElement',
] as const;

const DATA_SRC_SWAPPING_REGEX =
  /dataset\.(?:src|poster)|getAttribute\s*\(\s*['"]data-(?:src|poster)['"]\s*\)/;

const MEDIA_ELEMENT_CONTEXT_REGEX =
  /\b(?:video|audio|source|poster|media)\b|\.load\s*\(\s*\)/i;

const IMAGE_ONLY_CALLBACK_REGEX =
  /\b(?:img|image|iframe)\b/i;

function isGuardedByLazyMediaSupport(node: Node): boolean {
  if (isProtectedByFeatureGuard(node, LAZY_MEDIA_GUARD_TOKENS)) {
    return true;
  }
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isIfStatement(current)) {
      const cond = unwrapExpression(current.getExpression());
      if (
        Node.isPrefixUnaryExpression(cond) &&
        cond.getOperatorToken() === SyntaxKind.ExclamationToken
      ) {
        const resolved = resolveLocalExpression(cond.getOperand(), 2);
        const resolvedText = resolved.getText();
        if (
          resolvedText.includes('HTMLMediaElement') &&
          resolvedText.includes('loading')
        ) {
          return true;
        }
      }
    }
    current = current.getParent();
  }
  return false;
}

function matchMediaLazyObserver(
  newExpr: NewExpression,
  sourceFile: SourceFile,
): string | null {
  const callee = unwrapExpression(newExpr.getExpression());
  if (!isGlobalReference(callee, 'IntersectionObserver')) {
    return null;
  }

  const args = newExpr.getArguments();
  if (args.length === 0 || !args[0]) {
    return null;
  }

  const callbackNode = resolveCallableNode(args[0], 2);
  const callbackText = callbackNode.getText();

  if (!DATA_SRC_SWAPPING_REGEX.test(callbackText)) {
    return null;
  }

  if (
    !callbackText.includes('.src') &&
    !callbackText.includes('.poster') &&
    !callbackText.includes("setAttribute('src'") &&
    !callbackText.includes('setAttribute("src"')
  ) {
    return null;
  }

  const fileText = sourceFile.getFullText();
  const hasCallbackMediaContext = MEDIA_ELEMENT_CONTEXT_REGEX.test(callbackText);
  if (!hasCallbackMediaContext) {
    if (IMAGE_ONLY_CALLBACK_REGEX.test(callbackText)) {
      return null;
    }
    if (!/\b(?:video|audio)\b/i.test(fileText) || !callbackText.includes('.load()')) {
      return null;
    }
  }

  if (!/\b(?:video|audio|source)\b/i.test(fileText) && !callbackText.includes('.load()')) {
    return null;
  }

  return 'IntersectionObserver swapping data-src / data-poster onto <video> or <audio> elements can be modernized with native loading="lazy" on <video> and <audio>.';
}

export const lazyLoadVideoAndAudioPackageMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    LAZY_MEDIA_PACKAGES,
    (pkgName, versionRange) =>
      `Legacy lazy-loading library "${pkgName}" (${versionRange}) can be modernized with native loading="lazy" on <video> and <audio> elements.`,
  );

export const lazyLoadVideoAndAudioJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['IntersectionObserver'],
  isGuarded: (node) => isGuardedByLazyMediaSupport(node),
  matchNew: (node, sourceFile) => matchMediaLazyObserver(node, sourceFile),
});

const lazyLoadVideoAndAudioPackageRule: AnalyzerRule = {
  id: 'lazy-load-video-and-audio/package-lazyload',
  guideId: 'lazy-load-video-and-audio',
  guideHash: LAZY_LOAD_VIDEO_AND_AUDIO_GUIDE_HASH,
  summary:
    'Legacy lazy-loading packages (vanilla-lazyload, lozad) used for media elements should be modernized with HTMLMediaElement loading="lazy".',
  matcher: lazyLoadVideoAndAudioPackageMatcher,
  verifierRubric: {
    keepWhen: [
      'A project declares vanilla-lazyload or lozad in package.json dependencies to lazy-load <video> or <audio> media elements.',
    ],
    dropWhen: [
      'The code only lazy-loads <img> or <iframe> elements rather than <video> or <audio>.',
      'The code manages HLS/DASH streaming video player buffer controllers (e.g. hls.js, dashjs).',
    ],
  },
};

export const lazyLoadVideoAndAudioJsRule: AnalyzerRule = {
  id: 'lazy-load-video-and-audio/js-media-observer',
  guideId: 'lazy-load-video-and-audio',
  guideHash: LAZY_LOAD_VIDEO_AND_AUDIO_GUIDE_HASH,
  summary:
    'IntersectionObserver callbacks swapping data-src onto <video>, <audio>, or <source> and calling load() should be modernized with <video loading="lazy"> and <audio loading="lazy" controls>.',
  matcher: lazyLoadVideoAndAudioJsMatcher,
  verifierRubric: {
    keepWhen: [
      'An IntersectionObserver callback swaps dataset.src / data-src or data-poster onto <video>, <audio>, or <source> elements and calls media.load() without an HTMLMediaElement.prototype.loading feature guard.',
    ],
    dropWhen: [
      'The IntersectionObserver is inside a fallback branch guarded by !Object.hasOwn(HTMLMediaElement.prototype, "loading") or !("loading" in HTMLMediaElement.prototype).',
      'The observer only lazy-loads <img> or <iframe> elements or controls HLS/DASH adaptive streaming buffers.',
    ],
  },
};

export const lazyLoadVideoAndAudioDeferredRules: readonly AnalyzerRule[] = [
  // ~98% of vanilla-lazyload / lozad package.json occurrences are for <img> rather than <video>/<audio>
  lazyLoadVideoAndAudioPackageRule,
];

export const lazyLoadVideoAndAudioRules: readonly AnalyzerRule[] = [
  lazyLoadVideoAndAudioJsRule,
];
