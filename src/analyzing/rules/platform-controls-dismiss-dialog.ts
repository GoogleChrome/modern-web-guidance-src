import {
  Node,
  SyntaxKind,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  matchEventListenerCall,
  resolveCallableNode,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const PLATFORM_CONTROLS_DISMISS_DIALOG_GUIDE_HASH = 'a94956ffae24';

const CLOSEDBY_FEATURE_TOKENS = [
  'closedby',
  'closedBy',
  'CloseWatcher',
  'closewatcher',
] as const;

const MODAL_IDENTIFIER_REGEX =
  /\b(?:dialog|dlg|modal|drawer|overlay|sheet|lightbox)\b/i;

const NON_MODAL_RECEIVER_REGEX =
  /\b(?:window|self|document|ws|socket|stream|conn|connection|db|file|reader|writer|port|channel|context|audioCtx|peer|find|search|bar|input|field|editor|textarea|select|menu|dropdown|tooltip|toast|notification|popup)\b/i;

const EXPLICIT_MODAL_DISMISS_METHOD_REGEX =
  /(?:^|_|\b)(?:closeModal|closeDialog|hideModal|dismissModal|closeDrawer|hideDrawer|closeOverlay|hideOverlay|closeLightbox|hideLightbox)\b/i;

const GENERIC_DISMISS_METHOD_REGEX =
  /\b(?:close|hide|dismiss|hidePopover)\b/i;

const DISMISS_CLASS_REGEX =
  /\b(?:active|open|show|in|visible|is-active|is-open|modal-open|dialog-open)\b/i;

/**
 * Checks whether a node or statement calls a modal/dialog closer method or removes an open class.
 */
function isModalDismissCallOrMutation(node: Node): boolean {
  if (Node.isCallExpression(node)) {
    const expr = unwrapExpression(node.getExpression());
    if (Node.isPropertyAccessExpression(expr)) {
      const methodName = expr.getName();
      const receiver = unwrapExpression(expr.getExpression());
      const receiverText = receiver.getText().trim();

      if (NON_MODAL_RECEIVER_REGEX.test(receiverText)) {
        return false;
      }

      // Explicit modal dismissal method like modal.closeModal(), modal.closeDialog()
      if (EXPLICIT_MODAL_DISMISS_METHOD_REGEX.test(methodName)) {
        return true;
      }

      // Native dialog.close(), popover.hidePopover(), or generic dismiss with modal receiver
      if (GENERIC_DISMISS_METHOD_REGEX.test(methodName)) {
        if (MODAL_IDENTIFIER_REGEX.test(receiverText)) {
          return true;
        }
        if (receiverText === 'this') {
          const enclosingClass = node.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
          if (!enclosingClass || MODAL_IDENTIFIER_REGEX.test(enclosingClass.getName() ?? '')) {
            return true;
          }
        }
      }

      // jQuery $(modal).removeClass('active' | 'open' | ...) on a modal
      if (methodName === 'removeClass' && MODAL_IDENTIFIER_REGEX.test(receiverText)) {
        for (const arg of node.getArguments()) {
          const unwrappedArg = unwrapExpression(arg);
          if (
            Node.isStringLiteral(unwrappedArg) &&
            DISMISS_CLASS_REGEX.test(unwrappedArg.getLiteralText())
          ) {
            return true;
          }
        }
      }

      // classList.remove('active' | 'open' | ...) on a modal
      if (methodName === 'remove') {
        if (Node.isPropertyAccessExpression(receiver) && receiver.getName() === 'classList') {
          const targetReceiver = unwrapExpression(receiver.getExpression()).getText();
          if (
            MODAL_IDENTIFIER_REGEX.test(targetReceiver) &&
            !NON_MODAL_RECEIVER_REGEX.test(targetReceiver)
          ) {
            const args = node.getArguments();
            for (const arg of args) {
              const unwrappedArg = unwrapExpression(arg);
              if (
                Node.isStringLiteral(unwrappedArg) &&
                DISMISS_CLASS_REGEX.test(unwrappedArg.getLiteralText())
              ) {
                return true;
              }
            }
          }
        }
      }
    } else if (Node.isIdentifier(expr)) {
      const fnName = expr.getText();
      if (EXPLICIT_MODAL_DISMISS_METHOD_REGEX.test(fnName)) {
        return true;
      }
    }
  }

  // Check style.display = 'none' or style.visibility = 'hidden'
  if (Node.isBinaryExpression(node) && node.getOperatorToken().getKind() === SyntaxKind.EqualsToken) {
    const left = unwrapExpression(node.getLeft());
    if (Node.isPropertyAccessExpression(left)) {
      const propName = left.getName();
      const leftReceiver = unwrapExpression(left.getExpression());
      if (Node.isPropertyAccessExpression(leftReceiver) && leftReceiver.getName() === 'style') {
        const modalObj = unwrapExpression(leftReceiver.getExpression()).getText();
        if (MODAL_IDENTIFIER_REGEX.test(modalObj) && !NON_MODAL_RECEIVER_REGEX.test(modalObj)) {
          const right = unwrapExpression(node.getRight());
          if (Node.isStringLiteral(right)) {
            const val = right.getLiteralText().toLowerCase();
            if (
              (propName === 'display' && val === 'none') ||
              (propName === 'visibility' && val === 'hidden')
            ) {
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}

/**
 * Checks if a callable body contains modal dismissal operations.
 */
function callableContainsModalDismiss(handler: Node): boolean {
  let found = false;
  handler.forEachDescendant((child) => {
    if (found) return;
    if (isModalDismissCallOrMutation(child)) {
      found = true;
    }
  });
  return found;
}

function checkBinaryEscape(child: Node): boolean {
  if (Node.isBinaryExpression(child)) {
    const op = child.getOperatorToken().getKind();
    if (
      op === SyntaxKind.EqualsEqualsToken ||
      op === SyntaxKind.EqualsEqualsEqualsToken
    ) {
      const left = unwrapExpression(child.getLeft());
      const right = unwrapExpression(child.getRight());
      const leftText = left.getText();
      const rightText = right.getText();

      if (
        (leftText.endsWith('.key') || leftText.endsWith('.code')) &&
        (rightText === "'Escape'" || rightText === '"Escape"' || rightText === "'Esc'" || rightText === '"Esc"')
      ) {
        return true;
      }

      if (
        (rightText.endsWith('.key') || rightText.endsWith('.code')) &&
        (leftText === "'Escape'" || leftText === '"Escape"' || leftText === "'Esc'" || leftText === '"Esc"')
      ) {
        return true;
      }

      if (
        (leftText.endsWith('.keyCode') || leftText.endsWith('.which')) &&
        rightText === '27'
      ) {
        return true;
      }

      if (
        (rightText.endsWith('.keyCode') || rightText.endsWith('.which')) &&
        leftText === '27'
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks whether an expression checks for the Escape key (e.key === 'Escape' or e.keyCode === 27).
 */
function isEscapeKeyCondition(expr: Node): boolean {
  if (checkBinaryEscape(expr)) {
    return true;
  }

  let isEscape = false;

  expr.forEachDescendant((child) => {
    if (isEscape) return;

    if (checkBinaryEscape(child)) {
      isEscape = true;
      return;
    }

    if (Node.isCaseClause(child)) {
      const caseExpr = unwrapExpression(child.getExpression());
      const caseText = caseExpr.getText();
      if (
        caseText === '27' ||
        caseText === "'Escape'" ||
        caseText === '"Escape"' ||
        caseText === "'Esc'" ||
        caseText === '"Esc"'
      ) {
        isEscape = true;
        return;
      }
    }
  });

  return isEscape;
}

/**
 * Checks whether a keydown/keyup handler checks for Escape and performs modal dismissal.
 */
function handlerDismissesOnEscape(handler: Node): boolean {
  let found = false;

  handler.forEachDescendant((child) => {
    if (found) return;

    if (Node.isIfStatement(child)) {
      const cond = child.getExpression();
      if (isEscapeKeyCondition(cond)) {
        const thenStmt = child.getThenStatement();
        if (/\bstop(?:Immediate)?Propagation\s*\(/.test(thenStmt.getText())) {
          return;
        }
        if (
          callableContainsModalDismiss(thenStmt) ||
          callableContainsModalDismiss(handler)
        ) {
          found = true;
          return;
        }
      }
    }

    if (Node.isCaseClause(child)) {
      const caseExpr = unwrapExpression(child.getExpression());
      const caseText = caseExpr.getText();
      if (
        caseText === '27' ||
        caseText === "'Escape'" ||
        caseText === '"Escape"' ||
        caseText === "'Esc'" ||
        caseText === '"Esc"'
      ) {
        if (callableContainsModalDismiss(child) || callableContainsModalDismiss(handler)) {
          found = true;
          return;
        }
      }
    }
  });

  return found;
}

/**
 * Checks whether a popstate handler dismisses an open modal/dialog.
 */
function handlerDismissesOnPopstate(handler: Node): boolean {
  return callableContainsModalDismiss(handler);
}

export const platformControlsDismissDialogJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    ['keydown', 'keyup', 'keypress', 'popstate'],
    ['Escape', 'Esc', '27', 'popstate'],
    [
      'dialog',
      'Dialog',
      'dlg',
      'Dlg',
      'modal',
      'Modal',
      'drawer',
      'Drawer',
      'overlay',
      'Overlay',
      'sheet',
      'Sheet',
      'lightbox',
      'Lightbox',
      'hidePopover',
      'this.close(',
      'this.hide(',
      'this.dismiss(',
    ],
  ] as const,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];

    if (
      (!ctx.fileContent.includes('keydown') &&
        !ctx.fileContent.includes('keyup') &&
        !ctx.fileContent.includes('keypress') &&
        !ctx.fileContent.includes('popstate')) ||
      (!ctx.fileContent.includes('Escape') &&
        !ctx.fileContent.includes('Esc') &&
        !ctx.fileContent.includes('27') &&
        !ctx.fileContent.includes('popstate'))
    ) {
      return matches;
    }

    // Skip test files
    if (
      ctx.filePath.includes('.test.') ||
      ctx.filePath.includes('.spec.') ||
      ctx.filePath.includes('/test/') ||
      ctx.filePath.includes('/tests/')
    ) {
      return matches;
    }

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of callExpressions) {
      const matchedListener = matchEventListenerCall(call, [
        'keydown',
        'keyup',
        'keypress',
        'popstate',
      ]);

      if (!matchedListener) {
        continue;
      }

      if (isProtectedByFeatureGuard(call, CLOSEDBY_FEATURE_TOKENS)) {
        continue;
      }

      const { eventName, handlerNode } = matchedListener;

      // Require inline callback function (ArrowFunction or FunctionExpression) so multi-responsibility
      // focus-trap / controller functions passed by identifier reference are not flagged out of context.
      const callArgs = call.getArguments();
      const rawCallbackArg = unwrapExpression(callArgs[callArgs.length - 1] ?? callArgs[1] ?? call);
      if (
        eventName !== 'popstate' &&
        !Node.isArrowFunction(rawCallbackArg) &&
        !Node.isFunctionExpression(rawCallbackArg) &&
        !Node.isArrowFunction(handlerNode) &&
        !Node.isFunctionExpression(handlerNode)
      ) {
        continue;
      }

      if (eventName === 'popstate') {
        if (handlerDismissesOnPopstate(handlerNode)) {
          matches.push({
            line: call.getStartLineNumber(),
            column: call.getStartLinePos(),
            message:
              'Manual popstate listener handles back-button navigation to dismiss a modal dialog; native <dialog closedby="any"> or CloseWatcher handles platform dismiss requests automatically.',
          });
        }
      } else {
        // keydown, keyup, keypress
        if (handlerDismissesOnEscape(handlerNode)) {
          matches.push({
            line: call.getStartLineNumber(),
            column: call.getStartLinePos(),
            message:
              'Manual Escape key listener dismisses dialog or modal; native <dialog closedby="any"> or CloseWatcher replaces manual keydown dismiss handling.',
          });
        }
      }
    }

    // Also match window.onpopstate = ... or document.onkeydown = ...
    const binaryExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    for (const bin of binaryExpressions) {
      if (bin.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
        continue;
      }

      const left = unwrapExpression(bin.getLeft());
      if (!Node.isPropertyAccessExpression(left)) {
        continue;
      }

      const propName = left.getName();
      if (propName !== 'onpopstate' && propName !== 'onkeydown' && propName !== 'onkeyup') {
        continue;
      }

      if (isProtectedByFeatureGuard(bin, CLOSEDBY_FEATURE_TOKENS)) {
        continue;
      }

      const handlerNode = resolveCallableNode(bin.getRight());

      if (propName === 'onpopstate' && handlerDismissesOnPopstate(handlerNode)) {
        matches.push({
          line: bin.getStartLineNumber(),
          column: bin.getStartLinePos(),
          message:
            'Manual onpopstate handler dismisses a modal dialog; native <dialog closedby="any"> or CloseWatcher handles platform dismiss requests automatically.',
        });
      } else if (
        (propName === 'onkeydown' || propName === 'onkeyup') &&
        handlerDismissesOnEscape(handlerNode)
      ) {
        matches.push({
          line: bin.getStartLineNumber(),
          column: bin.getStartLinePos(),
          message:
            'Manual onkeydown handler checks Escape to dismiss dialog or modal; native <dialog closedby="any"> or CloseWatcher replaces manual keydown dismiss handling.',
        });
      }
    }

    return matches;
  },
};

export const platformControlsDismissDialogRule: AnalyzerRule = {
  id: 'platform-controls-dismiss-dialog',
  guideId: 'platform-controls-dismiss-dialog',
  guideHash: PLATFORM_CONTROLS_DISMISS_DIALOG_GUIDE_HASH,
  summary:
    'Dismiss modal dialogs via standard platform controls (<dialog closedby="any"> or CloseWatcher) instead of manual Escape key or popstate event listeners.',
  matcher: platformControlsDismissDialogJsMatcher,
  verifierRubric: {
    keepWhen: [
      'Manual keydown or keyup listener checks for the Escape key to close a dialog, modal, drawer, overlay, or popover.',
      'Manual popstate listener handles back-button navigation to dismiss an open dialog, drawer, or modal.',
    ],
    dropWhen: [
      'Dialog already uses closedby attribute or CloseWatcher.',
      'Escape listener handles a find/search input bar, autocomplete, or global application shortcut unrelated to dialog dismissal.',
      'Keydown listener also handles other keys such as Tab focus trapping, ArrowLeft/ArrowRight gallery navigation, or Enter submission.',
      'Escape listener calls stopPropagation() to contain Escape within a nested component or prevent closing.',
    ],
  },
};

export default [
  platformControlsDismissDialogRule,
] satisfies readonly AnalyzerRule[];
