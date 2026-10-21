import {
  Node,
  SyntaxKind,
  type CallExpression,
  type PropertyAccessExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isGlobalReference,
  isProtectedByFeatureGuard,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  DependencyMatcherContext,
  DependencyRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const ATRULE_SUPPORT_CONDITIONALS_GUIDE_HASH = 'adca6619584a';

const MODERNIZR_PACKAGES = ['modernizr'] as const;

const MODERNIZR_CSS_METHODS = new Set([
  'testProp',
  'testAllProps',
  'prefixed',
  'prefixedCSS',
  'prefixedCSSValue',
  'testStyles',
]);

const MODERNIZR_CSS_PROPERTIES = new Set([
  'flexbox',
  'flexboxlegacy',
  'flexboxtweener',
  'flexwrap',
  'fontface',
  'generatedcontent',
  'backdropfilter',
  'backgroundblendmode',
  'backgroundcliptext',
  'backgroundsize',
  'bgsizecover',
  'borderimage',
  'borderradius',
  'boxshadow',
  'boxsizing',
  'checked',
  'cubicbezierrange',
  'displaytable',
  'ellipsis',
  'filters',
  'hsla',
  'hyphens',
  'lastchild',
  'mediaqueries',
  'multiplebgs',
  'nthchild',
  'objectfit',
  'opacity',
  'overflowscrolling',
  'pointerevents',
  'positionsticky',
  'regions',
  'remunit',
  'rgba',
  'scrollsnappoints',
  'shapes',
  'siblinggeneral',
  'subpixelfont',
  'supports',
  'target',
  'textalignlast',
  'textshadow',
  'transforms',
  'transforms3d',
  'transformstylepreserve3d',
  'transitions',
  'userselect',
  'vhunit',
  'vmaxunit',
  'vminunit',
  'vwunit',
  'willchange',
  'wrapflow',
]);

const MODERNIZR_NON_CSS_APIS = new Set([
  'webgl',
  'webglextensions',
  'canvas',
  'canvastext',
  'localstorage',
  'sessionstorage',
  'touchevent',
  'touchevents',
  'touch',
  'websockets',
  'websocketsbinary',
  'geolocation',
  'indexeddb',
  'history',
  'audio',
  'video',
  'webworkers',
  'serviceworker',
  'svg',
  'inlinesvg',
  'smil',
  'draganddrop',
  'hashchange',
  'postmessage',
  'applicationcache',
  'websqldatabase',
  'webrtc',
  ' notification',
  'notifications',
  'fullscreen',
  'pointerlock',
  ' fetch',
  'promises',
]);

function isModernizrObject(node: Node): boolean {
  return isGlobalReference(node, 'Modernizr');
}

function isModernizrCssPropertyName(propName: string): boolean {
  const lower = propName.toLowerCase();
  if (MODERNIZR_NON_CSS_APIS.has(lower)) {
    return false;
  }
  if (lower.startsWith('css')) {
    return true;
  }
  return MODERNIZR_CSS_PROPERTIES.has(lower);
}

function matchModernizrMethodCall(callExpr: CallExpression): string | null {
  const callee = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(callee)) {
    return null;
  }
  if (!isModernizrObject(callee.getExpression())) {
    return null;
  }
  const methodName = callee.getName();
  if (!MODERNIZR_CSS_METHODS.has(methodName)) {
    return null;
  }
  if (callExpr.getArguments().length === 0) {
    return null;
  }
  return `Modernizr.${methodName}() CSS feature detection in JavaScript can be modernized with native CSS @supports and @supports at-rule(@...).`;
}

function isAssignmentTarget(propAccess: PropertyAccessExpression): boolean {
  const parent = propAccess.getParent();
  if (!parent || !Node.isBinaryExpression(parent)) {
    return false;
  }
  return (
    parent.getOperatorToken().getKind() === SyntaxKind.EqualsToken &&
    unwrapExpression(parent.getLeft()) === propAccess
  );
}

function matchModernizrCssPropertyAccess(
  propAccess: PropertyAccessExpression,
): string | null {
  const parent = propAccess.getParent();
  if (
    parent &&
    Node.isCallExpression(parent) &&
    unwrapExpression(parent.getExpression()) === propAccess
  ) {
    return null;
  }
  if (isAssignmentTarget(propAccess)) {
    return null;
  }
  if (!isModernizrObject(propAccess.getExpression())) {
    return null;
  }
  const propName = propAccess.getName();
  if (!isModernizrCssPropertyName(propName)) {
    return null;
  }
  return `Modernizr.${propName} CSS feature check in JavaScript can be modernized with native CSS @supports and @supports at-rule(@...).`;
}

export const atruleSupportConditionalsPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: MODERNIZR_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Legacy feature-detection package "${pkgName}" (${versionRange}) can be modernized with native CSS @supports and @supports at-rule(@...).`,
    };
  },
};

export const atruleSupportConditionalsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['Modernizr'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (
        isProtectedByFeatureGuard(node, [
          'CSS.supports',
          'supports',
          'CSSFunctionRule',
        ])
      ) {
        return;
      }

      if (Node.isCallExpression(node)) {
        const msg = matchModernizrMethodCall(node);
        const line = node.getStartLineNumber();
        if (msg && !visitedLines.has(line)) {
          visitedLines.add(line);
          matches.push({ line, message: msg });
        }
        return;
      }

      if (Node.isPropertyAccessExpression(node)) {
        const msg = matchModernizrCssPropertyAccess(node);
        const line = node.getStartLineNumber();
        if (msg && !visitedLines.has(line)) {
          visitedLines.add(line);
          matches.push({ line, message: msg });
        }
      }
    });

    return matches;
  },
};

export const atruleSupportConditionalsPackageRule: AnalyzerRule = {
  id: 'atrule-support-conditionals/package-modernizr',
  guideId: 'atrule-support-conditionals',
  guideHash: ATRULE_SUPPORT_CONDITIONALS_GUIDE_HASH,
  summary:
    'Legacy Modernizr dependency in package.json used for CSS feature conditionals should be modernized with native CSS @supports and @supports at-rule(@...).',
  matcher: atruleSupportConditionalsPackageMatcher,
  phase2Rubric: {
    keepWhen: [
      'A project declares modernizr in package.json dependencies to detect CSS property, value, or at-rule support via JS classes on <html>.',
    ],
    dropWhen: [
      'Modernizr is used exclusively to detect non-CSS browser APIs such as WebGL, Canvas, IndexedDB, LocalStorage, Geolocation, or WebSockets.',
      'The codebase already uses native CSS @supports and @supports at-rule(@...) or CSS.supports() for CSS conditionals.',
    ],
  },
};

export const atruleSupportConditionalsJsRule: AnalyzerRule = {
  id: 'atrule-support-conditionals/js-modernizr',
  guideId: 'atrule-support-conditionals',
  guideHash: ATRULE_SUPPORT_CONDITIONALS_GUIDE_HASH,
  summary:
    'JavaScript Modernizr CSS feature checks (Modernizr.testProp, Modernizr.testAllProps, Modernizr.prefixed, Modernizr.css*, Modernizr.flexbox, Modernizr.cssgrid) should be modernized with native CSS @supports and @supports at-rule(@...).',
  matcher: atruleSupportConditionalsJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'JavaScript calls Modernizr.testProp(), Modernizr.testAllProps(), or Modernizr.prefixed() to test CSS support or apply conditional styles.',
      'JavaScript reads Modernizr.css* (such as Modernizr.cssanimations, Modernizr.csstransforms, Modernizr.cssgrid) or Modernizr.flexbox to branch on CSS feature support.',
    ],
    dropWhen: [
      'JavaScript checks non-CSS HTML5 APIs on Modernizr such as Modernizr.webgl, Modernizr.canvas, Modernizr.localstorage, Modernizr.TouchEvent, or Modernizr.websockets.',
      'The check is guarded by native CSS.supports() or tests CSSOM rule constructors (e.g. globalThis.CSSFunctionRule) as a progressive enhancement fallback.',
    ],
  },
};

export const atruleSupportConditionalsRules: readonly AnalyzerRule[] = [
  atruleSupportConditionalsPackageRule,
  atruleSupportConditionalsJsRule,
];
