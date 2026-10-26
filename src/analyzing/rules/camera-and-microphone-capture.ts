import {
  Node,
  SyntaxKind,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  resolveLocalExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
  VerifierRubric,
} from '../schema.ts';

export const CAMERA_AND_MICROPHONE_CAPTURE_GUIDE_HASH = '91af2c8c4f87';

export const CAMERA_AND_MICROPHONE_CAPTURE_VERIFIER_RUBRIC: VerifierRubric = {
  keepWhen: [
    'Code calls navigator.getUserMedia or navigator.webkitGetUserMedia (or mozGetUserMedia / msGetUserMedia) with callbacks to request audio/video stream.',
  ],
  dropWhen: [
    'Code is a shim that already defines navigator.mediaDevices.getUserMedia = ... using the legacy API as fallback.',
    'Code is guarded by feature detection for navigator.mediaDevices or navigator.mediaDevices.getUserMedia.',
  ],
};

const LEGACY_GET_USER_MEDIA_NAMES = new Set([
  'getUserMedia',
  'webkitGetUserMedia',
  'mozGetUserMedia',
  'msGetUserMedia',
]);

const MEDIA_DEVICES_GUARD_TOKENS = [
  'mediaDevices',
  'mediaDevices.getUserMedia',
  'navigator.mediaDevices',
] as const;

function isInsideMediaDevicesShim(node: Node, sourceFile: SourceFile): boolean {
  let current: Node | undefined = node;
  while (current) {
    if (
      Node.isBinaryExpression(current) &&
      current.getOperatorToken().getKind() === SyntaxKind.EqualsToken
    ) {
      const leftText = current.getLeft().getText();
      if (leftText.includes('mediaDevices.getUserMedia')) {
        return true;
      }
    }
    current = current.getParent();
  }

  const fullText = sourceFile.getFullText();
  if (
    /navigator\.mediaDevices\.getUserMedia\s*=/i.test(fullText) ||
    /mediaDevices\.getUserMedia\s*=/i.test(fullText)
  ) {
    return true;
  }

  return false;
}

function matchGetUserMediaCall(node: Node): string | null {
  if (!Node.isCallExpression(node)) return null;
  const expr = node.getExpression();

  // 1. Direct property access call: navigator.getUserMedia(...), navigator.webkitGetUserMedia(...)
  if (Node.isPropertyAccessExpression(expr)) {
    const name = expr.getName();
    if (LEGACY_GET_USER_MEDIA_NAMES.has(name)) {
      const callerText = expr.getExpression().getText();
      if (callerText.includes('navigator') && !callerText.includes('mediaDevices')) {
        return `Legacy callback-based ${callerText}.${name}(...) media capture API should be modernized with promise-based navigator.mediaDevices.getUserMedia(...).`;
      }
    }

    // Call via .call or .apply: navigator.getUserMedia.call(navigator, ...) or getUserMedia.call(navigator, ...)
    if (name === 'call' || name === 'apply') {
      const callee = expr.getExpression();
      let calleeMethodName = '';
      let isNavigatorCaller = false;

      if (Node.isPropertyAccessExpression(callee)) {
        calleeMethodName = callee.getName();
        isNavigatorCaller = callee.getExpression().getText().includes('navigator');
      } else if (Node.isIdentifier(callee)) {
        calleeMethodName = callee.getText();
        const resolved = resolveLocalExpression(callee);
        isNavigatorCaller = resolved.getText().includes('navigator');
      }

      if (
        (LEGACY_GET_USER_MEDIA_NAMES.has(calleeMethodName) && isNavigatorCaller) ||
        (calleeMethodName === 'getUserMedia' && isNavigatorCaller)
      ) {
        return `Legacy callback-based ${callee.getText()}.${name}(...) media capture API should be modernized with promise-based navigator.mediaDevices.getUserMedia(...).`;
      }
    }
  }

  // 2. Direct identifier call: legacyGUM(...) or getUserMedia(...) resolved locally
  if (Node.isIdentifier(expr)) {
    const resolved = resolveLocalExpression(expr);
    const resolvedText = resolved.getText();
    if (
      (resolvedText.includes('navigator.getUserMedia') ||
        resolvedText.includes('navigator.webkitGetUserMedia') ||
        resolvedText.includes('navigator.mozGetUserMedia') ||
        resolvedText.includes('navigator.msGetUserMedia')) &&
      !resolvedText.includes('mediaDevices')
    ) {
      return `Legacy callback-based ${expr.getText()}(...) media capture API should be modernized with promise-based navigator.mediaDevices.getUserMedia(...).`;
    }
  }

  return null;
}

export const cameraAndMicrophoneCaptureJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['getUserMedia', 'webkitGetUserMedia', 'mozGetUserMedia', 'msGetUserMedia'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;

      const message = matchGetUserMediaCall(node);
      if (!message) return;

      if (isInsideMediaDevicesShim(node, sourceFile)) {
        return;
      }

      if (isProtectedByFeatureGuard(node, MEDIA_DEVICES_GUARD_TOKENS)) {
        return;
      }

      const line = node.getStartLineNumber();
      if (!visitedLines.has(line)) {
        visitedLines.add(line);
        matches.push({ line, message });
      }
    });

    return matches;
  },
};

export const cameraAndMicrophoneCaptureJsRule: AnalyzerRule = {
  id: 'camera-and-microphone-capture/legacy-get-user-media',
  guideId: 'camera-and-microphone-capture',
  guideHash: CAMERA_AND_MICROPHONE_CAPTURE_GUIDE_HASH,
  summary:
    'Legacy callback-based navigator.getUserMedia(...) or vendor-prefixed navigator.webkitGetUserMedia(...) should be modernized with promise-based navigator.mediaDevices.getUserMedia(...).',
  matcher: cameraAndMicrophoneCaptureJsMatcher,
  verifierRubric: CAMERA_AND_MICROPHONE_CAPTURE_VERIFIER_RUBRIC,
};

export const cameraAndMicrophoneCaptureRules: readonly AnalyzerRule[] = [
  cameraAndMicrophoneCaptureJsRule,
];
