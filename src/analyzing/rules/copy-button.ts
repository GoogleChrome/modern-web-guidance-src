import {
  Node,
  type SourceFile,
} from 'ts-morph';
import {
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
  VerifierRubric,
} from '../schema.ts';

export const COPY_BUTTON_GUIDE_HASH = 'd92b7f9038d3';

export const COPY_BUTTON_VERIFIER_RUBRIC: VerifierRubric = {
  keepWhen: [
    'Code calls document.execCommand("copy") to copy text to the system clipboard upon a user button click.',
    'Code instantiates new ClipboardJS(...) or imports "clipboard" to handle copy-to-clipboard interactions.',
  ],
  dropWhen: [
    'Code already checks for navigator.clipboard or navigator.clipboard.writeText before calling execCommand as an unsupported-browser fallback.',
    'Code is a polyfill library implementation itself.',
  ],
};

const CLIPBOARD_GUARD_TOKENS = [
  'navigator.clipboard',
  'clipboard.writeText',
  'clipboard',
] as const;

const CLIPBOARD_PACKAGES = [
  'clipboard',
  'clipboard-js',
] as const;

function isPolyfillOrVendorFile(ctx?: JsMatcherContext): boolean {
  if (!ctx?.filePath) return false;
  const lower = ctx.filePath.toLowerCase().replace(/\\/g, '/');
  return (
    lower.endsWith('/clipboard.js') ||
    lower.endsWith('/clipboard.min.js') ||
    lower.endsWith('clipboard.js') ||
    lower.endsWith('clipboard.min.js')
  );
}

function matchExecCommandCopy(node: Node): string | null {
  if (!Node.isCallExpression(node)) return null;
  const expr = node.getExpression();

  let isExecCommand = false;
  if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'execCommand') {
    isExecCommand = true;
  } else if (Node.isIdentifier(expr) && expr.getText() === 'execCommand') {
    isExecCommand = true;
  }

  if (!isExecCommand) return null;

  const args = node.getArguments();
  if (args.length === 0) return null;

  const firstArg = unwrapExpression(args[0]);
  if (
    Node.isStringLiteral(firstArg) ||
    Node.isNoSubstitutionTemplateLiteral(firstArg)
  ) {
    if (firstArg.getLiteralText().trim().toLowerCase() === 'copy') {
      return 'Legacy document.execCommand("copy") clipboard operation should be modernized with native asynchronous navigator.clipboard.writeText().';
    }
  }

  return null;
}

function matchClipboardJsInstantiation(
  node: Node,
  sourceFile: SourceFile,
): string | null {
  if (!Node.isNewExpression(node)) return null;
  const expr = node.getExpression();
  const text = expr.getText();

  if (text === 'ClipboardJS') {
    return 'Legacy clipboard.js instantiation (new ClipboardJS) can be modernized with native navigator.clipboard.writeText().';
  }

  if (text === 'Clipboard') {
    const hasClipboardImport = sourceFile
      .getImportDeclarations()
      .some((d) => d.getModuleSpecifierValue().toLowerCase() === 'clipboard');
    if (hasClipboardImport) {
      return 'Legacy clipboard.js instantiation (new Clipboard from "clipboard") can be modernized with native navigator.clipboard.writeText().';
    }
  }

  return null;
}

export const copyButtonJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['execCommand', 'ClipboardJS', 'Clipboard'],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    if (isPolyfillOrVendorFile(ctx)) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const message = matchExecCommandCopy(node);
        if (message) {
          if (!isProtectedByFeatureGuard(node, CLIPBOARD_GUARD_TOKENS)) {
            const line = node.getStartLineNumber();
            if (!visitedLines.has(line)) {
              visitedLines.add(line);
              matches.push({ line, message });
            }
          }
        }
        return;
      }

      if (Node.isNewExpression(node)) {
        const message = matchClipboardJsInstantiation(node, sourceFile);
        if (message) {
          if (!isProtectedByFeatureGuard(node, CLIPBOARD_GUARD_TOKENS)) {
            const line = node.getStartLineNumber();
            if (!visitedLines.has(line)) {
              visitedLines.add(line);
              matches.push({ line, message });
            }
          }
        }
      }
    });

    return matches;
  },
};

export const copyButtonPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: CLIPBOARD_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Legacy clipboard package "${pkgName}" (${versionRange}) can be modernized with native navigator.clipboard.writeText().`,
    };
  },
};

export const copyButtonJsRule: AnalyzerRule = {
  id: 'copy-button/exec-command',
  guideId: 'copy-button',
  guideHash: COPY_BUTTON_GUIDE_HASH,
  summary:
    'Legacy document.execCommand("copy") or clipboard.js instantiation should be modernized with native asynchronous navigator.clipboard.writeText().',
  matcher: copyButtonJsMatcher,
  verifierRubric: COPY_BUTTON_VERIFIER_RUBRIC,
};

export const copyButtonPackageRule: AnalyzerRule = {
  id: 'copy-button/package-clipboard',
  guideId: 'copy-button',
  guideHash: COPY_BUTTON_GUIDE_HASH,
  summary:
    'Legacy clipboard library package dependencies in package.json can be replaced with native navigator.clipboard.writeText().',
  matcher: copyButtonPackageMatcher,
  verifierRubric: COPY_BUTTON_VERIFIER_RUBRIC,
};

export const copyButtonRules: readonly AnalyzerRule[] = [
  copyButtonJsRule,
  copyButtonPackageRule,
];
