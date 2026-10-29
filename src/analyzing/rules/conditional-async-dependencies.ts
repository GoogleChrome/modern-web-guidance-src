import {
  Node,
  SyntaxKind,
  type CallExpression,
} from 'ts-morph';
import {
  isGlobalReference,
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

export const CONDITIONAL_ASYNC_DEPENDENCIES_GUIDE_HASH = 'c26cf4b37462';

const SCRIPT_LOADER_PACKAGES = [
  'loadjs',
  'scriptjs',
] as const;

const THIRD_PARTY_SCRIPT_REGEX =
  /google-analytics|googletagmanager|gtag|gtm\.js|analytics\.js|fbevents|connect\.facebook|doubleclick|googlesyndication|adsbygoogle|stripe\.com|js\.stripe|paypal\.com|braintree|adyen|klarna|plaid|razorpay|sentry\.io|datadoghq|newrelic|bugsnag|logrocket|fullstory|hotjar|intercom|segment\.com|mixpanel|amplitude|clarity\.ms|optimizely|hs-scripts|hubspot|zdassets|disqus|platform\.twitter|platform\.linkedin|youtube\.com\/iframe_api|player\.vimeo\.com|maps\.googleapis|recaptcha|hcaptcha|turnstile/i;

const JSONP_SCRIPT_REGEX = /[?&](?:callback|jsonp|cb)=|\bjsonp\b/i;

const NON_JS_SCRIPT_TYPE_REGEX =
  /application\/(?:ld\+json|json|xml)|text\/(?:template|html|plain|x-template|ng-template)|x-shader\/|importmap|speculationrules/i;

const NOMODULE_SCRIPT_REGEX =
  /\.noModule\s*=|\bsetAttribute\s*\(\s*['"]nomodule['"]/i;

const FEATURE_DETECTION_CONDITION_REGEX =
  /\bpolyfill\b|\bin\s+(?:window|document|navigator|HTMLElement|Element|globalThis|self)\b|typeof\s+[A-Za-z0-9_$]+\s*===?\s*['"]undefined['"]|!\s*(?:window|document|navigator|HTMLElement|Element|CSS)\.[A-Za-z0-9_$]+/;

function isDocumentCreateScriptCall(callExpr: CallExpression): boolean {
  const args = callExpr.getArguments();
  if (args.length === 0) {
    return false;
  }
  const firstArg = unwrapExpression(args[0]);
  if (
    (!Node.isStringLiteral(firstArg) && !Node.isNoSubstitutionTemplateLiteral(firstArg)) ||
    firstArg.getLiteralText().toLowerCase() !== 'script'
  ) {
    return false;
  }
  const callee = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== 'createElement') {
    return false;
  }
  return isGlobalReference(callee.getExpression(), 'document');
}

function getEnclosingScopeNode(node: Node): Node {
  let current: Node | undefined = node.getParent();
  while (current) {
    if (
      Node.isBlock(current) ||
      Node.isFunctionDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current) ||
      Node.isMethodDeclaration(current) ||
      Node.isSourceFile(current)
    ) {
      return current;
    }
    current = current.getParent();
  }
  return node.getSourceFile();
}

function isInsideConditionalFeatureCheck(node: Node): boolean {
  let current: Node | undefined = node.getParent();
  while (current && !Node.isSourceFile(current)) {
    if (Node.isIfStatement(current)) {
      if (FEATURE_DETECTION_CONDITION_REGEX.test(current.getExpression().getText())) {
        return true;
      }
    } else if (Node.isConditionalExpression(current)) {
      if (FEATURE_DETECTION_CONDITION_REGEX.test(current.getCondition().getText())) {
        return true;
      }
    } else if (
      Node.isBinaryExpression(current) &&
      (current.getOperatorToken().getKind() === SyntaxKind.BarBarToken ||
        current.getOperatorToken().getKind() === SyntaxKind.AmpersandAmpersandToken)
    ) {
      if (FEATURE_DETECTION_CONDITION_REGEX.test(current.getLeft().getText())) {
        return true;
      }
    }
    current = current.getParent();
  }
  return false;
}

function matchCreateScriptInjection(callExpr: CallExpression): string | null {
  if (!isDocumentCreateScriptCall(callExpr)) {
    return null;
  }

  const scopeNode = getEnclosingScopeNode(callExpr);
  const scopeText = scopeNode.getText();

  if (
    THIRD_PARTY_SCRIPT_REGEX.test(scopeText) ||
    JSONP_SCRIPT_REGEX.test(scopeText) ||
    NON_JS_SCRIPT_TYPE_REGEX.test(scopeText) ||
    NOMODULE_SCRIPT_REGEX.test(scopeText)
  ) {
    return null;
  }

  const hasSrcAssignment =
    /\.src\s*=/.test(scopeText) ||
    /\.setAttribute\s*\(\s*['"]src['"]/.test(scopeText);
  if (!hasSrcAssignment) {
    return null;
  }

  const hasLoadCallback =
    /\.onload\s*=/.test(scopeText) ||
    /\.onreadystatechange\s*=/.test(scopeText) ||
    /\.addEventListener\s*\(\s*['"]load['"]/.test(scopeText);

  if (!hasLoadCallback && !isInsideConditionalFeatureCheck(callExpr)) {
    return null;
  }

  return 'Dynamic <script> injection via document.createElement("script") can be modernized with dynamic import() and top-level await.';
}

function matchScriptLoaderCall(callExpr: CallExpression): string | null {
  const args = callExpr.getArguments();
  if (args.length === 0) {
    return null;
  }

  const callee = unwrapExpression(callExpr.getExpression());

  if (isLibraryReference(callee, 'loadjs', ['loadjs'])) {
    const callText = callExpr.getText();
    if (
      THIRD_PARTY_SCRIPT_REGEX.test(callText) ||
      JSONP_SCRIPT_REGEX.test(callText)
    ) {
      return null;
    }
    return 'loadjs() async dependency loader can be modernized with dynamic import() and top-level await.';
  }

  if (
    isLibraryReference(callee, '$script', ['scriptjs']) ||
    isLibraryReference(callee, 'scriptjs', ['scriptjs'])
  ) {
    const callText = callExpr.getText();
    if (
      THIRD_PARTY_SCRIPT_REGEX.test(callText) ||
      JSONP_SCRIPT_REGEX.test(callText)
    ) {
      return null;
    }
    return '$script() async dependency loader can be modernized with dynamic import() and top-level await.';
  }

  if (isDocumentCreateScriptCall(callExpr)) {
    const callText = callExpr.getText();
    if (
      THIRD_PARTY_SCRIPT_REGEX.test(callText) ||
      JSONP_SCRIPT_REGEX.test(callText)
    ) {
      return null;
    }
    return matchCreateScriptInjection(callExpr);
  }

  return null;
}

export const conditionalAsyncDependenciesPackageMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    SCRIPT_LOADER_PACKAGES,
    (pkgName, versionRange) =>
      `Async script loader dependency "${pkgName}" (${versionRange}) can be modernized with native ES module dynamic import() and top-level await.`,
  );

export const conditionalAsyncDependenciesJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: [
    ['loadjs', '$script', 'scriptjs', '.createElement('],
    ['loadjs', '$script', 'scriptjs', "'script'", '"script"', '`script`'],
    ['loadjs', '$script', 'scriptjs', '.src', "'src'", '"src"'],
  ],
  dedupeLines: true,
  matchCall: (node) => matchScriptLoaderCall(node),
});

export const conditionalAsyncDependenciesPackageRule: AnalyzerRule = {
  id: 'conditional-async-dependencies/package-script-loader',
  guideId: 'conditional-async-dependencies',
  guideHash: CONDITIONAL_ASYNC_DEPENDENCIES_GUIDE_HASH,
  summary:
    'Async script loader dependencies (loadjs, scriptjs) for conditional dependency loading can be modernized with dynamic import() and top-level await.',
  matcher: conditionalAsyncDependenciesPackageMatcher,
  verifierRubric: {
    keepWhen: [
      'A project declares loadjs or scriptjs in package.json dependencies to load conditional polyfills or asynchronous module dependencies.',
    ],
    dropWhen: [
      'Third-party analytics snippet injection (e.g. Google Tag Manager, Google Analytics, Stripe).',
      'Web Worker importScripts calls.',
    ],
  },
};

export const conditionalAsyncDependenciesJsRule: AnalyzerRule = {
  id: 'conditional-async-dependencies/js-script-loader',
  guideId: 'conditional-async-dependencies',
  guideHash: CONDITIONAL_ASYNC_DEPENDENCIES_GUIDE_HASH,
  summary:
    'JavaScript loadjs(), $script(), and conditional document.createElement("script") dependency loaders should be modernized with dynamic import() and top-level await.',
  matcher: conditionalAsyncDependenciesJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript calls loadjs(...) or $script(...) to load conditional polyfills or local/module dependencies.',
      'Helper functions or feature-detection blocks dynamically create <script> elements with .src and .onload / addEventListener("load", ...) to load conditional modules.',
    ],
    dropWhen: [
      'Third-party analytics, tag manager, ad, or payment widget snippet injection (e.g. Google Tag Manager, Google Analytics, Stripe).',
      'Web Worker importScripts calls or inline JSON-LD <script type="application/ld+json"> elements.',
    ],
  },
};

export default [
  conditionalAsyncDependenciesPackageRule,
  conditionalAsyncDependenciesJsRule,
] satisfies readonly AnalyzerRule[];
