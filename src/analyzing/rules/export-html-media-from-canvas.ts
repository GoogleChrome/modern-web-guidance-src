import {
  Node,
  type CallExpression,
  type NewExpression,
} from 'ts-morph';
import {
  isLibraryReference,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createDependencyMatcher } from '../scanners/dependency-scanner.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  DependencyRuleMatcher,
  JsRuleMatcher,
} from '../schema.ts';

export const EXPORT_HTML_MEDIA_FROM_CANVAS_GUIDE_HASH = '3c108b82f2d1';

const CANVAS_MEDIA_PACKAGES = [
  'ccapture.js',
  'gifshot',
  'whammy',
] as const;

const CANVAS_MEDIA_GUARD_TOKENS = [
  'captureStream',
  'MediaRecorder',
  'drawElementImage',
] as const;

function matchCanvasMediaRecorderNode(
  node: CallExpression | NewExpression,
): string | null {
  const callee = unwrapExpression(node.getExpression());

  if (isLibraryReference(callee, 'CCapture', ['ccapture.js'])) {
    return 'CCapture canvas frame recorder can be modernized with native canvas.captureStream() and MediaRecorder.';
  }

  if (!Node.isPropertyAccessExpression(callee)) {
    return null;
  }

  const propName = callee.getName();
  const receiver = callee.getExpression();

  if (
    Node.isCallExpression(node) &&
    propName === 'createGIF' &&
    isLibraryReference(receiver, 'gifshot', ['gifshot'])
  ) {
    return 'gifshot.createGIF() client-side media encoder can be modernized with native canvas.captureStream() and MediaRecorder.';
  }

  if (
    (propName === 'Video' || propName === 'fromImageArray') &&
    isLibraryReference(receiver, 'Whammy', ['whammy'])
  ) {
    return `Whammy.${propName}() canvas frame encoder can be modernized with native canvas.captureStream() and MediaRecorder.`;
  }

  return null;
}

export const exportHtmlMediaFromCanvasPackageMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    CANVAS_MEDIA_PACKAGES,
    (pkgName, versionRange) =>
      `Legacy client-side canvas recording package "${pkgName}" (${versionRange}) can be modernized with HTMLCanvasElement.captureStream() and MediaRecorder.`,
  );

export const exportHtmlMediaFromCanvasJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['CCapture', 'gifshot', 'Whammy'],
  featureGuardTokens: CANVAS_MEDIA_GUARD_TOKENS,
  matchCall: (node) => matchCanvasMediaRecorderNode(node),
  matchNew: (node) => matchCanvasMediaRecorderNode(node),
});

export const exportHtmlMediaFromCanvasPackageRule: AnalyzerRule = {
  id: 'export-html-media-from-canvas/package-canvas-recorder',
  guideId: 'export-html-media-from-canvas',
  guideHash: EXPORT_HTML_MEDIA_FROM_CANVAS_GUIDE_HASH,
  summary:
    'Legacy client-side canvas video/GIF encoder packages (ccapture.js, gifshot, whammy) should be modernized with HTMLCanvasElement.captureStream() and MediaRecorder.',
  matcher: exportHtmlMediaFromCanvasPackageMatcher,
  verifierRubric: {
    keepWhen: [
      'A project declares ccapture.js, gifshot, or whammy in package.json dependencies to record or export video/frames from a canvas.',
    ],
    dropWhen: [
      'The code already uses HTMLCanvasElement.captureStream() and MediaRecorder.',
      'The code runs in a server-side FFmpeg rendering pipeline or uses toDataURL / toBlob for single static screenshot capture.',
    ],
  },
};

export const exportHtmlMediaFromCanvasJsRule: AnalyzerRule = {
  id: 'export-html-media-from-canvas/js-canvas-recorder',
  guideId: 'export-html-media-from-canvas',
  guideHash: EXPORT_HTML_MEDIA_FROM_CANVAS_GUIDE_HASH,
  summary:
    'JavaScript canvas recording calls (new CCapture, gifshot.createGIF, new Whammy.Video) should be modernized with canvas.captureStream() and MediaRecorder.',
  matcher: exportHtmlMediaFromCanvasJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript instantiates new CCapture(...), calls gifshot.createGIF(...), or invokes new Whammy.Video(...) to encode canvas frames in the browser.',
      'Manual frame-by-frame canvas extraction loops dump toDataURL frames into client-side encoders.',
    ],
    dropWhen: [
      'The recording call is guarded by a captureStream or MediaRecorder feature check.',
      'The code uses canvas.toDataURL() or canvas.toBlob() for a single static screenshot or runs in a server-side FFmpeg pipeline.',
    ],
  },
};

export const exportHtmlMediaFromCanvasRules: readonly AnalyzerRule[] = [
  exportHtmlMediaFromCanvasPackageRule,
  exportHtmlMediaFromCanvasJsRule,
];
