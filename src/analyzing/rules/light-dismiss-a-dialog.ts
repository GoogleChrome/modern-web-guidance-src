import {
  Node,
  SyntaxKind,
  type SourceFile,
  type StringLiteral,
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

export const LIGHT_DISMISS_A_DIALOG_GUIDE_HASH = '81b6cf86f574';

const CLOSEDBY_FEATURE_TOKENS = ['closedBy', 'closedby', 'closedBy' as string] as const;

function handlerCallsCloseOnDialog(handlerNode: Node, targetNode?: Node): boolean {
  let callsClose = false;
  handlerNode.forEachDescendant((child) => {
    if (callsClose) return;
    if (Node.isCallExpression(child)) {
      const expr = unwrapExpression(child.getExpression());
      if (Node.isPropertyAccessExpression(expr)) {
        if (expr.getName() === 'close') {
          const receiver = unwrapExpression(expr.getExpression());
          const receiverText = receiver.getText().trim();
          // Receiver must be a dialog reference, e.target, this, or targetNode
          if (
            receiverText === 'this' ||
            receiverText.endsWith('.target') ||
            /\b(?:dialog|dlg|modal)\b/i.test(receiverText) ||
            receiverText.endsWith('.current') ||
            (targetNode && receiverText === targetNode.getText().trim())
          ) {
            callsClose = true;
          }
        }
      } else if (Node.isIdentifier(expr) && expr.getText() === 'close') {
        callsClose = true;
      }
    }
  });
  return callsClose;
}

function isEventTargetExpression(expr: Node): boolean {
  const unwrapped = unwrapExpression(expr);
  if (Node.isPropertyAccessExpression(unwrapped)) {
    return unwrapped.getName() === 'target';
  }
  return false;
}

function isDialogOrTargetComparison(node: Node, targetNode?: Node): boolean {
  let found = false;
  node.forEachDescendant((child) => {
    if (found) return;

    if (Node.isCallExpression(child)) {
      const expr = unwrapExpression(child.getExpression());
      if (Node.isPropertyAccessExpression(expr)) {
        const methodName = expr.getName();
        // matches('dialog') is valid backdrop check
        if (methodName === 'matches') {
          const args = child.getArguments();
          if (args.length > 0) {
            const firstArg = unwrapExpression(args[0]);
            if (
              Node.isStringLiteral(firstArg) &&
              firstArg.getLiteralText().toLowerCase() === 'dialog'
            ) {
              found = true;
              return;
            }
          }
        }

        // !dialog.contains(event.target) or !modal.contains(event.target) outside click check
        if (methodName === 'contains') {
          const callerText = unwrapExpression(expr.getExpression()).getText().trim();
          const args = child.getArguments();
          if (args.length > 0) {
            const firstArg = unwrapExpression(args[0]);
            if (isEventTargetExpression(firstArg)) {
              if (
                callerText === 'this' ||
                /\b(?:dialog|dlg|modal)\b/i.test(callerText) ||
                (targetNode && callerText === targetNode.getText().trim())
              ) {
                found = true;
                return;
              }
            }
          }
        }

        // !e.target.closest('dialog') outside click check
        if (methodName === 'closest') {
          const args = child.getArguments();
          if (args.length > 0) {
            const firstArg = unwrapExpression(args[0]);
            if (
              Node.isStringLiteral(firstArg) &&
              firstArg.getLiteralText().toLowerCase() === 'dialog'
            ) {
              const parent = child.getParent();
              if (
                (parent &&
                  Node.isPrefixUnaryExpression(parent) &&
                  parent.getOperatorToken() === SyntaxKind.ExclamationToken) ||
                (parent &&
                  Node.isBinaryExpression(parent) &&
                  (parent.getRight().getText() === 'null' ||
                    parent.getLeft().getText() === 'null'))
              ) {
                found = true;
                return;
              }
            }
          }
        }
      }
    }

    if (!Node.isBinaryExpression(child)) {
      return;
    }

    const op = child.getOperatorToken().getKind();
    if (
      op !== SyntaxKind.EqualsEqualsToken &&
      op !== SyntaxKind.EqualsEqualsEqualsToken &&
      op !== SyntaxKind.ExclamationEqualsToken &&
      op !== SyntaxKind.ExclamationEqualsEqualsToken
    ) {
      return;
    }

    const left = unwrapExpression(child.getLeft());
    const right = unwrapExpression(child.getRight());

    const leftIsTarget = isEventTargetExpression(left);
    const rightIsTarget = isEventTargetExpression(right);

    if (leftIsTarget || rightIsTarget) {
      const other = leftIsTarget ? right : left;
      const otherText = other.getText();

      if (
        otherText === 'this' ||
        otherText.endsWith('.currentTarget') ||
        /\b(?:dialog|dlg|modal)\b/i.test(otherText) ||
        (targetNode && otherText === targetNode.getText())
      ) {
        found = true;
        return;
      }
    }

    if (Node.isStringLiteral(left) || Node.isStringLiteral(right)) {
      const strNode = Node.isStringLiteral(left)
        ? (left as StringLiteral)
        : (right as StringLiteral);
      const otherExpr = Node.isStringLiteral(left) ? right : left;
      if (strNode.getLiteralText().toUpperCase() === 'DIALOG') {
        if (Node.isPropertyAccessExpression(otherExpr)) {
          const propName = otherExpr.getName().toLowerCase();
          if (
            propName === 'tagname' ||
            propName === 'nodename' ||
            propName === 'localname'
          ) {
            found = true;
            return;
          }
        }
      }
    }
  });

  return found;
}

function hasBoundingRectCoordinateCheck(handlerNode: Node, targetNode?: Node): boolean {
  let hasGetBoundingClientRect = false;
  let hasClientCoords = false;

  handlerNode.forEachDescendant((child) => {
    if (Node.isCallExpression(child)) {
      const expr = unwrapExpression(child.getExpression());
      if (
        Node.isPropertyAccessExpression(expr) &&
        expr.getName() === 'getBoundingClientRect'
      ) {
        const callerText = unwrapExpression(expr.getExpression()).getText();
        if (
          /\b(?:dialog|dlg|modal)\b/i.test(callerText) ||
          callerText === 'this' ||
          (targetNode && callerText === targetNode.getText())
        ) {
          hasGetBoundingClientRect = true;
        }
      }
    }

    if (Node.isIdentifier(child) || Node.isPropertyAccessExpression(child)) {
      const text = Node.isIdentifier(child) ? child.getText() : child.getName();
      if (
        text === 'clientX' ||
        text === 'clientY' ||
        text === 'pageX' ||
        text === 'pageY'
      ) {
        hasClientCoords = true;
      }
    }
  });

  return hasGetBoundingClientRect && hasClientCoords;
}

interface ClickCandidate {
  readonly rootNode: Node;
  readonly handlerNode: Node;
  readonly targetNode?: Node;
}

function findClickListeners(sourceFile: SourceFile): ClickCandidate[] {
  const candidates: ClickCandidate[] = [];

  sourceFile.forEachDescendant((node) => {
    // 1. addEventListener('click', handler) or $.on('click', handler)
    if (Node.isCallExpression(node)) {
      const matched = matchEventListenerCall(node, ['click']);
      if (matched) {
        candidates.push({
          rootNode: node,
          handlerNode: matched.handlerNode,
          targetNode: matched.targetNode,
        });
        return;
      }
    }

    // 2. element.onclick = handler
    if (
      Node.isBinaryExpression(node) &&
      node.getOperatorToken().getKind() === SyntaxKind.EqualsToken
    ) {
      const left = unwrapExpression(node.getLeft());
      if (Node.isPropertyAccessExpression(left) && left.getName() === 'onclick') {
        const handlerNode = resolveCallableNode(node.getRight());
        candidates.push({
          rootNode: node,
          handlerNode,
          targetNode: left.getExpression(),
        });
      }
    }
  });

  return candidates;
}

export const lightDismissADialogJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    ['click', 'onclick'],
    ['close'],
    ['target', 'getBoundingClientRect'],
  ],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    // If guarded by closedBy in file or feature check, skip
    if (
      ctx.fileContent.includes('closedBy') ||
      ctx.fileContent.includes('closedby')
    ) {
      const hasGuardedPattern =
        /('closedBy'|"closedBy"|'closedby'|"closedby")\s+in\b/i.test(ctx.fileContent);
      if (hasGuardedPattern) {
        // Only skip if the whole listener block or file is guarded
        return [];
      }
    }

    const matches: AnalyzerMatch[] = [];
    const candidates = findClickListeners(sourceFile);

    for (const { rootNode, handlerNode, targetNode } of candidates) {
      if (isProtectedByFeatureGuard(rootNode, CLOSEDBY_FEATURE_TOKENS)) {
        continue;
      }

      if (!handlerCallsCloseOnDialog(handlerNode, targetNode)) {
        continue;
      }

      const hasTargetCheck = isDialogOrTargetComparison(handlerNode, targetNode);
      const hasCoordCheck = hasBoundingRectCoordinateCheck(handlerNode, targetNode);

      if (!hasTargetCheck && !hasCoordCheck) {
        continue;
      }

      matches.push({
        line: rootNode.getStartLineNumber(),
        message:
          'Manual backdrop click listener dismisses dialog; modernize with declarative <dialog closedby="any">.',
      });
    }

    return matches;
  },
};

export const lightDismissADialogRule: AnalyzerRule = {
  id: 'light-dismiss-a-dialog',
  guideId: 'light-dismiss-a-dialog',
  guideHash: LIGHT_DISMISS_A_DIALOG_GUIDE_HASH,
  summary:
    'Manual backdrop click listeners dismissing <dialog> should be modernized with declarative <dialog closedby="any">.',
  matcher: lightDismissADialogJsMatcher,
  verifierRubric: {
    keepWhen: [
      'A click event listener attached to a <dialog> or modal checks event.target === dialog, event.target === event.currentTarget, or bounding box coordinates to dismiss the dialog via .close().',
      'A script implements manual light-dismiss for an HTML <dialog> element when clicking outside the content area on the backdrop.',
    ],
    dropWhen: [
      'The listener is guarded by "closedBy" in HTMLDialogElement.prototype for progressive enhancement.',
      'The click handler is attached to a dedicated close button (.btn-close, [data-dismiss]) rather than the dialog backdrop.',
      'The dialog is opened as a non-modal dialog with .show() rather than .showModal().',
      'The listener handles custom menu or popover light dismiss covered by popover attribute.',
    ],
  },
};

export default [
  lightDismissADialogRule,
] satisfies readonly AnalyzerRule[];
