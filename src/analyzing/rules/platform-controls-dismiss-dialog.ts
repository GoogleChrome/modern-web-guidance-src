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
  /\b(?:dialog|dlg|modal|drawer|overlay|popup|sheet|lightbox)\b/i;

const NON_MODAL_RECEIVER_REGEX =
  /\b(?:window|self|document|ws|socket|stream|conn|connection|db|file|reader|writer|port|channel|context|audioCtx|peer)\b/i;

const EXPLICIT_MODAL_DISMISS_METHOD_REGEX =
  /\b(?:closeModal|closeDialog|hideModal|dismissModal|closeDrawer|hideDrawer)\b/i;

const GENERIC_DISMISS_METHOD_REGEX =
  /\b(?:close|hide|dismiss|hidePopover)\b/i;

const DISMISS_CLASS_REGEX =
  /\b(?:active|open|show|is-active|is-open|modal-open|dialog-open)\b/i;

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
        if (
          MODAL_IDENTIFIER_REGEX.test(receiverText) ||
          receiverText === 'this' ||
          receiverText.endsWith('.target') ||
          receiverText.endsWith('.current')
        ) {
          return true;
        }
      }

      // classList.remove('active' | 'open' | ...) on a modal
      if (methodName === 'remove') {
        if (Node.isPropertyAccessExpression(receiver) && receiver.getName() === 'classList') {
          const targetReceiver = unwrapExpression(receiver.getExpression()).getText();
          if (MODAL_IDENTIFIER_REGEX.test(targetReceiver)) {
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
        if (MODAL_IDENTIFIER_REGEX.test(modalObj)) {
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
        leftText.endsWith('.key') &&
        (rightText === "'Escape'" || rightText === '"Escape"' || rightText === "'Esc'" || rightText === '"Esc"')
      ) {
        return true;
      }

      if (
        rightText.endsWith('.key') &&
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
        if (
          callableContainsModalDismiss(child.getThenStatement()) ||
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
  fastTokens: ['Escape', 'keyCode', 'which', 'popstate'] as const,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];

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
      if (propName !== 'onpopstate' && propName !== 'onkeydown') {
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
      } else if (propName === 'onkeydown' && handlerDismissesOnEscape(handlerNode)) {
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
      'Manual keydown listener checks Escape key to close dialog, modal, drawer, or popover',
      'Manual popstate listener handles back-button navigation to dismiss open dialog, drawer, or modal',
    ],
    dropWhen: [
      'Dialog already uses closedby attribute or CloseWatcher',
      'Escape listener handles global application shortcut unrelated to dialog dismissal (e.g. video player fullscreen, cancel drawing, blur search input)',
      'Escape listener specifically intercepts Escape to prevent closing (e.g. prompt to save unsaved changes)',
    ],
  },
};

export default [
  platformControlsDismissDialogRule,
] satisfies readonly AnalyzerRule[];
