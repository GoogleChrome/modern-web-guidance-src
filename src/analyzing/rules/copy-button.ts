import { Node, SyntaxKind, type CallExpression, type NewExpression, type SourceFile } from 'ts-morph';
import type { AnalyzerMatch, AnalyzerRule, JsMatcherContext, JsRuleMatcher } from '../schema.ts';
import { isProtectedByFeatureGuard, unwrapExpression } from '../scanners/ast-helpers.ts';

export const COPY_BUTTON_GUIDE_HASH = 'd92b7f9038d3';

const CLIPBOARD_GUARD_TOKENS = ['clipboard', 'writeText'] as const;

/**
 * Checks whether a call expression is document.execCommand('copy') or execCommand('copy').
 */
function matchExecCommandCopy(callExpr: CallExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  let isExecCommand = false;

  if (Node.isPropertyAccessExpression(expr)) {
    if (expr.getName() === 'execCommand') {
      const caller = unwrapExpression(expr.getExpression());
      const callerText = caller.getText();
      if (
        callerText === 'document' ||
        callerText === 'window.document' ||
        callerText === 'globalThis.document' ||
        callerText === 'this.document' ||
        callerText === 'doc' ||
        callerText === 'd'
      ) {
        isExecCommand = true;
      }
    }
  } else if (Node.isIdentifier(expr) && expr.getText() === 'execCommand') {
    isExecCommand = true;
  }

  if (!isExecCommand) {
    return null;
  }

  const args = callExpr.getArguments();
  if (args.length === 0) {
    return null;
  }

  const firstArg = unwrapExpression(args[0]);
  if (!Node.isStringLiteral(firstArg) && !Node.isNoSubstitutionTemplateLiteral(firstArg)) {
    return null;
  }

  if (firstArg.getLiteralText().toLowerCase() !== 'copy') {
    return null;
  }

  if (isProtectedByFeatureGuard(callExpr, CLIPBOARD_GUARD_TOKENS)) {
    return null;
  }

  return {
    line: callExpr.getStartLineNumber(),
    message:
      "Legacy document.execCommand('copy') used to copy text to clipboard instead of await navigator.clipboard.writeText().",
  };
}

/**
 * Checks whether a new expression instantiates ClipboardJS or Clipboard from 'clipboard'.
 */
function matchClipboardJsConstructor(newExpr: NewExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(newExpr.getExpression());
  const calleeText = expr.getText();

  const isClipboardJs =
    calleeText === 'ClipboardJS' ||
    calleeText === 'window.ClipboardJS' ||
    calleeText === 'Clipboard' ||
    calleeText === 'window.Clipboard';

  if (!isClipboardJs) {
    return null;
  }

  if (isProtectedByFeatureGuard(newExpr, CLIPBOARD_GUARD_TOKENS)) {
    return null;
  }

  // If callee is just Clipboard, verify it's not a native DOM ClipboardEvent or other global
  if (calleeText === 'Clipboard' || calleeText === 'window.Clipboard') {
    // Only flag Clipboard if there is an import from 'clipboard' in the file or if constructor has selector/trigger args
    const sourceFile = newExpr.getSourceFile();
    const importsClipboardPackage = sourceFile.getImportDeclarations().some((decl) => {
      const spec = decl.getModuleSpecifierValue();
      return spec === 'clipboard' || spec.startsWith('clipboard/');
    });
    const hasRequireClipboard = sourceFile.getText().includes("require('clipboard')") ||
      sourceFile.getText().includes('require("clipboard")');

    if (!importsClipboardPackage && !hasRequireClipboard) {
      // If no import/require from 'clipboard', only flag if callee was explicitly ClipboardJS
      return null;
    }
  }

  return {
    line: newExpr.getStartLineNumber(),
    message:
      'Legacy ClipboardJS library instantiated for copy-to-clipboard functionality instead of await navigator.clipboard.writeText().',
  };
}

export const copyButtonMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['execCommand', 'ClipboardJS', 'clipboard'],
  matchFile(sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const callExpr of callExpressions) {
      const match = matchExecCommandCopy(callExpr);
      if (match) {
        matches.push(match);
      }
    }

    const newExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression);
    for (const newExpr of newExpressions) {
      const match = matchClipboardJsConstructor(newExpr);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  },
};

export const copyButtonRule: AnalyzerRule = {
  id: 'copy-button',
  guideId: 'copy-button',
  guideHash: COPY_BUTTON_GUIDE_HASH,
  summary:
    'Flag legacy document.execCommand("copy") or ClipboardJS library usage used to copy text to the clipboard instead of modern navigator.clipboard.writeText().',
  matcher: copyButtonMatcher,
  phase2Rubric: {
    keepWhen: [
      'Imperative document.execCommand("copy") calls using temporary textarea/input elements or text selection to write to the system clipboard instead of navigator.clipboard.writeText().',
      'Third-party ClipboardJS library instantiation (new ClipboardJS(...)) or clipboard package imports to bind copy-to-clipboard buttons.',
    ],
    dropWhen: [
      'ExecCommand calls already protected by navigator.clipboard or navigator.clipboard.writeText feature checks (such as fallback branches in progressive enhancement).',
      'ExecCommand calls with commands other than "copy" (e.g. execCommand("bold"), execCommand("insertText"), or WYSIWYG rich text editor commands).',
      'Test mock suites, browser polyfills, or synthetic event definitions for the Clipboard API.',
    ],
  },
};
