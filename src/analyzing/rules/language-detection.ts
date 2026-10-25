import {
  Node,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isGlobalReference,
  isProtectedByFeatureGuard,
  resolveLocalExpression,
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

export const LANGUAGE_DETECTION_GUIDE_HASH = '44a2e2bcc40d';

const LANGUAGE_DETECT_PACKAGES = [
  'franc',
  'franc-min',
  'franc-all',
  'languagedetect',
  'tinyld',
] as const;

const LANGUAGE_DETECTOR_GUARD_TOKENS = [
  'LanguageDetector',
  'createDetector',
  'canDetect',
] as const;

const SERVER_ONLY_PACKAGES = [
  'express',
  'fastify',
  'koa',
  '@nestjs/core',
  '@hapi/hapi',
] as const;

const CLIENT_FRAMEWORK_PACKAGES = [
  'react',
  'react-dom',
  'vue',
  'svelte',
  'lit',
  'next',
  'nuxt',
  '@angular/core',
  'preact',
  'solid-js',
] as const;

function isClientSideDependency(
  pkgName: string,
  packageJson: Readonly<Record<string, unknown>>,
): boolean {
  const deps = packageJson.dependencies;
  if (typeof deps !== 'object' || deps === null) {
    return false;
  }
  const depsRecord = deps as Readonly<Record<string, unknown>>;
  if (!(pkgName in depsRecord)) {
    return false;
  }

  // Exclude CLI packages declaring "bin" without browser or client UI dependencies
  const hasClientFramework = CLIENT_FRAMEWORK_PACKAGES.some(
    (clientPkg) => clientPkg in depsRecord,
  );
  if (packageJson.bin !== undefined && !packageJson.browser && !hasClientFramework) {
    return false;
  }

  // Exclude server-only packages without any client framework or browser field
  const hasServerFramework = SERVER_ONLY_PACKAGES.some(
    (serverPkg) => serverPkg in depsRecord,
  );
  if (hasServerFramework && !packageJson.browser && !hasClientFramework) {
    return false;
  }

  return true;
}

function isLibraryReference(
  node: Node,
  identName: string,
  packages: readonly string[],
): boolean {
  if (isGlobalReference(node, identName)) {
    return true;
  }
  const unwrapped = unwrapExpression(node);
  if (!Node.isIdentifier(unwrapped) || unwrapped.getText() !== identName) {
    return false;
  }
  const sourceFile = unwrapped.getSourceFile();
  for (const imp of sourceFile.getImportDeclarations()) {
    const spec = imp.getModuleSpecifierValue();
    if (!packages.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`))) {
      continue;
    }
    if (
      imp.getDefaultImport()?.getText() === identName ||
      imp.getNamespaceImport()?.getText() === identName
    ) {
      return true;
    }
    for (const named of imp.getNamedImports()) {
      const local = named.getAliasNode()?.getText() ?? named.getName();
      if (local === identName) {
        return true;
      }
    }
  }
  const resolved = resolveLocalExpression(unwrapped, 2);
  if (Node.isCallExpression(resolved)) {
    const callee = unwrapExpression(resolved.getExpression());
    const firstArg = resolved.getArguments()[0];
    if (
      Node.isIdentifier(callee) &&
      callee.getText() === 'require' &&
      firstArg &&
      Node.isStringLiteral(firstArg)
    ) {
      const spec = firstArg.getLiteralText();
      return packages.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`));
    }
  }
  return false;
}

function isLanguageDetectInstance(node: Node): boolean {
  const resolved = resolveLocalExpression(node, 2);
  if (Node.isNewExpression(resolved) || Node.isCallExpression(resolved)) {
    const callee = unwrapExpression(resolved.getExpression());
    if (isLibraryReference(callee, 'LanguageDetect', ['languagedetect'])) {
      return true;
    }
  }
  return false;
}

function matchLanguageDetectionCall(callExpr: CallExpression): string | null {
  if (callExpr.getArguments().length === 0) {
    return null;
  }

  const callee = unwrapExpression(callExpr.getExpression());

  if (Node.isIdentifier(callee)) {
    const name = callee.getText();
    if (
      (name === 'franc' || name === 'francAll') &&
      isLibraryReference(callee, name, ['franc', 'franc-min', 'franc-all'])
    ) {
      return `Call to ${name}() client-side language detection library can be modernized with the built-in browser LanguageDetector API (LanguageDetector.create() and detector.detect()).`;
    }
    return null;
  }

  if (Node.isPropertyAccessExpression(callee)) {
    const methodName = callee.getName();
    const receiver = callee.getExpression();
    if (methodName === 'detect' && isLanguageDetectInstance(receiver)) {
      return 'Call to new LanguageDetect().detect() can be modernized with the built-in browser LanguageDetector API (LanguageDetector.create() and detector.detect()).';
    }
    if (
      (methodName === 'detect' || methodName === 'detectAll') &&
      isLibraryReference(receiver, 'tinyld', ['tinyld'])
    ) {
      return `Call to tinyld.${methodName}() can be modernized with the built-in browser LanguageDetector API (LanguageDetector.create() and detector.detect()).`;
    }
  }

  return null;
}

export const languageDetectionPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: LANGUAGE_DETECT_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    ctx: DependencyMatcherContext,
  ) => {
    if (!isClientSideDependency(pkgName, ctx.packageJson)) {
      return null;
    }
    return {
      message: `Client-side language detection package "${pkgName}" (${versionRange}) bundles static n-gram models; modernize with the built-in browser LanguageDetector API.`,
    };
  },
};

export const languageDetectionJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['franc', 'francAll', 'LanguageDetect', 'tinyld'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isProtectedByFeatureGuard(node, LANGUAGE_DETECTOR_GUARD_TOKENS)) {
        return;
      }

      const msg = matchLanguageDetectionCall(node);
      if (msg) {
        matches.push({
          line: node.getStartLineNumber(),
          message: msg,
        });
      }
    });

    return matches;
  },
};

export const languageDetectionPackageRule: AnalyzerRule = {
  id: 'language-detection/package-lang-detect',
  guideId: 'language-detection',
  guideHash: LANGUAGE_DETECTION_GUIDE_HASH,
  summary:
    'Client-side language detection packages (franc, franc-min, franc-all, languagedetect, tinyld) in dependencies can be modernized with the built-in browser LanguageDetector API.',
  matcher: languageDetectionPackageMatcher,
  verifierRubric: {
    keepWhen: [
      'A client-side web application declares franc, franc-min, franc-all, languagedetect, or tinyld in package.json dependencies to classify text language in the browser.',
    ],
    dropWhen: [
      'The package is used in a server-only Node.js backend, CLI tool (with bin field), or build-time devDependencies script where the browser LanguageDetector API is unavailable.',
      'The library is used purely as a fallback when "LanguageDetector" in self is false or LanguageDetector.availability() returns "unavailable".',
    ],
  },
};

export const languageDetectionJsRule: AnalyzerRule = {
  id: 'language-detection/js-lang-detect',
  guideId: 'language-detection',
  guideHash: LANGUAGE_DETECTION_GUIDE_HASH,
  summary:
    'JavaScript calls to franc(), francAll(), or new LanguageDetect().detect() can be modernized with the built-in browser LanguageDetector API.',
  matcher: languageDetectionJsMatcher,
  verifierRubric: {
    keepWhen: [
      'Client-side JavaScript invokes franc(), francAll(), or new LanguageDetect().detect() to identify the natural language of user-provided or page text without a "LanguageDetector" in self guard.',
    ],
    dropWhen: [
      'The call is inside a fallback branch guarded by "LanguageDetector" in self or LanguageDetector.availability().',
      'The code runs in a Node.js server route, CLI script, or Web Worker where the browser LanguageDetector API is not exposed.',
      'The code inspects browser UI locale preferences via navigator.language or navigator.languages rather than detecting text content language.',
    ],
  },
};

export const languageDetectionRules: readonly AnalyzerRule[] = [
  languageDetectionPackageRule,
  languageDetectionJsRule,
];
