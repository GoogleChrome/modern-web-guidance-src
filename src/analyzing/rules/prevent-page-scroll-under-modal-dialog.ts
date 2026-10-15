import {
  Node,
  SyntaxKind,
  type BinaryExpression,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import type { AnalyzerMatch, AnalyzerRule, JsMatcherContext, JsRuleMatcher } from '../schema.ts';
import { unwrapExpression } from '../scanners/ast-helpers.ts';

export const PREVENT_PAGE_SCROLL_UNDER_MODAL_DIALOG_GUIDE_HASH = '7d10dd62dcbc';

const MODAL_OVERLAY_CONTEXT_REGEX =
  /(modal|dialog|overlay|popup|drawer|sheet|lightbox|backdrop)/i;

const FULLSCREEN_ONLY_REGEX =
  /fullscreen/i;

/**
 * Checks whether an expression references document.body or document.documentElement or root body.
 */
function isDocumentRootElement(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  const text = unwrapped.getText();

  if (
    text === 'document.body' ||
    text === 'window.document.body' ||
    text === 'document.documentElement' ||
    text === 'window.document.documentElement' ||
    text === 'body' ||
    text === 'doc.body' ||
    text === 'd.body'
  ) {
    return true;
  }

  if (Node.isPropertyAccessExpression(unwrapped)) {
    const name = unwrapped.getName();
    if (name === 'body' || name === 'documentElement') {
      const callerText = unwrapExpression(unwrapped.getExpression()).getText();
      return (
        callerText === 'document' ||
        callerText === 'window.document' ||
        callerText === 'globalThis.document'
      );
    }
  }

  return false;
}

/**
 * Determines whether the given AST node is inside a modal, dialog, popup, or overlay context.
 */
function isInModalOrOverlayContext(node: Node, filePath: string): boolean {
  // 1. Check file path
  if (MODAL_OVERLAY_CONTEXT_REGEX.test(filePath)) {
    return true;
  }

  // 2. Check enclosing function, class, or method scopes
  let current: Node | undefined = node.getParent();
  let hasFullscreenSignal = false;
  let hasModalSignal = false;

  while (current && !Node.isSourceFile(current)) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isMethodDeclaration(current) ||
      Node.isClassDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current)
    ) {
      let name = '';
      if ('getName' in current && typeof current.getName === 'function') {
        name = current.getName() ?? '';
      }

      if (MODAL_OVERLAY_CONTEXT_REGEX.test(name)) {
        hasModalSignal = true;
      }
      if (FULLSCREEN_ONLY_REGEX.test(name)) {
        hasFullscreenSignal = true;
      }

      // Check statements or properties within this scope for modal/dialog identifiers
      const scopeText = current.getText();
      if (MODAL_OVERLAY_CONTEXT_REGEX.test(scopeText)) {
        hasModalSignal = true;
      }
    }

    current = current.getParent();
  }

  if (hasFullscreenSignal && !hasModalSignal && !MODAL_OVERLAY_CONTEXT_REGEX.test(filePath)) {
    return false;
  }

  return hasModalSignal;
}

/**
 * Checks whether a binary expression is an assignment setting overflow = 'hidden' on body/documentElement.
 */
function matchOverflowAssignment(
  binaryExpr: BinaryExpression,
  filePath: string,
): AnalyzerMatch | null {
  if (binaryExpr.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
    return null;
  }

  const left = unwrapExpression(binaryExpr.getLeft());
  if (!Node.isPropertyAccessExpression(left)) {
    return null;
  }

  const propName = left.getName();
  if (propName !== 'overflow' && propName !== 'overflowY' && propName !== 'overflowX') {
    return null;
  }

  const styleAccess = unwrapExpression(left.getExpression());
  if (!Node.isPropertyAccessExpression(styleAccess) || styleAccess.getName() !== 'style') {
    return null;
  }

  const targetElement = unwrapExpression(styleAccess.getExpression());
  if (!isDocumentRootElement(targetElement)) {
    return null;
  }

  const right = unwrapExpression(binaryExpr.getRight());
  if (!Node.isStringLiteral(right) && !Node.isNoSubstitutionTemplateLiteral(right)) {
    return null;
  }

  const val = right.getLiteralText().trim().toLowerCase();
  if (val !== 'hidden') {
    return null;
  }

  if (!isInModalOrOverlayContext(binaryExpr, filePath)) {
    return null;
  }

  return {
    line: binaryExpr.getStartLineNumber(),
    message:
      `Imperative body scroll lock (${targetElement.getText()}.style.${propName} = 'hidden') used for modal/overlay instead of native <dialog> (showModal()) and CSS overscroll-behavior: contain.`,
  };
}

/**
 * Checks whether a call expression is target.style.setProperty('overflow', 'hidden') on body/documentElement.
 */
function matchSetPropertyCall(
  callExpr: CallExpression,
  filePath: string,
): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr) || expr.getName() !== 'setProperty') {
    return null;
  }

  const styleAccess = unwrapExpression(expr.getExpression());
  if (!Node.isPropertyAccessExpression(styleAccess) || styleAccess.getName() !== 'style') {
    return null;
  }

  const targetElement = unwrapExpression(styleAccess.getExpression());
  if (!isDocumentRootElement(targetElement)) {
    return null;
  }

  const args = callExpr.getArguments();
  if (args.length < 2) {
    return null;
  }

  const propArg = unwrapExpression(args[0]);
  const valArg = unwrapExpression(args[1]);

  if (!Node.isStringLiteral(propArg) && !Node.isNoSubstitutionTemplateLiteral(propArg)) {
    return null;
  }
  if (!Node.isStringLiteral(valArg) && !Node.isNoSubstitutionTemplateLiteral(valArg)) {
    return null;
  }

  const propName = propArg.getLiteralText().toLowerCase();
  if (propName !== 'overflow' && propName !== 'overflow-y' && propName !== 'overflow-x') {
    return null;
  }

  if (valArg.getLiteralText().trim().toLowerCase() !== 'hidden') {
    return null;
  }

  if (!isInModalOrOverlayContext(callExpr, filePath)) {
    return null;
  }

  return {
    line: callExpr.getStartLineNumber(),
    message:
      `Imperative body scroll lock (${targetElement.getText()}.style.setProperty('${propName}', 'hidden')) used for modal/overlay instead of native <dialog> (showModal()) and CSS overscroll-behavior: contain.`,
  };
}

export const preventPageScrollUnderModalDialogMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['overflow'],
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];

    const binaryExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    for (const binExpr of binaryExpressions) {
      const match = matchOverflowAssignment(binExpr, ctx.filePath);
      if (match) {
        matches.push(match);
      }
    }

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const callExpr of callExpressions) {
      const match = matchSetPropertyCall(callExpr, ctx.filePath);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  },
};

export const preventPageScrollUnderModalDialogRule: AnalyzerRule = {
  id: 'prevent-page-scroll-under-modal-dialog',
  guideId: 'prevent-page-scroll-under-modal-dialog',
  guideHash: PREVENT_PAGE_SCROLL_UNDER_MODAL_DIALOG_GUIDE_HASH,
  summary:
    'Flag imperative body scroll locks (such as document.body.style.overflow = "hidden") inside modal, dialog, or overlay handlers instead of using native <dialog> with CSS overscroll-behavior: contain.',
  matcher: preventPageScrollUnderModalDialogMatcher,
  phase2Rubric: {
    keepWhen: [
      'Imperatively locking background page scroll via document.body.style.overflow = "hidden" or document.documentElement.style.overflow = "hidden" inside modal, dialog, popup, or overlay open/close handlers.',
      'Scroll-locking helpers (e.g. disableBodyScroll, lockScroll) that mutate body or documentElement overflow when presenting modal dialogs or overlays.',
    ],
    dropWhen: [
      'Full-screen editor or canvas views (e.g. fullscreen toggle modes for code editors, video players, or games) that do not present a modal dialog or overlay layer.',
      'Native <dialog> elements utilizing CSS overscroll-behavior: contain or body:has(dialog[open]) to contain scroll without imperative JS.',
      'CSS stylesheet declarations or internal container style assignments setting overflow: hidden on sub-elements rather than the root body or documentElement.',
    ],
  },
};
