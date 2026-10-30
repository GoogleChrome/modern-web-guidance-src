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

export const LIGHT_DISMISS_A_DIALOG_GUIDE_HASH = '81b6cf86f574';

const CLOSEDBY_FEATURE_TOKENS = ['closedBy', 'closedby'] as const;

function isDialogTargetText(text: string, targetNode?: Node): boolean {
  return (
    text === 'this' ||
    /\b(?:dialog|dlg|modal)\b/i.test(text) ||
    (targetNode !== undefined && text === targetNode.getText().trim())
  );
}

function handlerCallsCloseOnDialog(handlerNode: Node, targetNode?: Node): boolean {
  let callsClose = false;
  handlerNode.forEachDescendant((child) => {
    if (callsClose || !Node.isCallExpression(child)) return;
    const expr = unwrapExpression(child.getExpression());
    if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'close') {
      const receiverText = unwrapExpression(expr.getExpression()).getText().trim();
      if (
        isDialogTargetText(receiverText, targetNode) ||
        receiverText.endsWith('.target') ||
        receiverText.endsWith('.current')
      ) {
        callsClose = true;
      }
    } else if (Node.isIdentifier(expr) && expr.getText() === 'close') {
      callsClose = true;
    }
  });
  return callsClose;
}

function isEventTargetExpression(expr: Node): boolean {
  const unwrapped = unwrapExpression(expr);
  return Node.isPropertyAccessExpression(unwrapped) && unwrapped.getName() === 'target';
}

function isDialogOrTargetComparison(node: Node, targetNode?: Node): boolean {
  let found = false;
  node.forEachDescendant((child) => {
    if (found) return;

    if (Node.isCallExpression(child)) {
      const expr = unwrapExpression(child.getExpression());
      const firstArgNode = child.getArguments()[0];
      if (!Node.isPropertyAccessExpression(expr) || !firstArgNode) {
        return;
      }
      const methodName = expr.getName();
      const firstArg = unwrapExpression(firstArgNode);

      // matches('dialog') is valid backdrop check
      if (
        methodName === 'matches' &&
        Node.isStringLiteral(firstArg) &&
        firstArg.getLiteralText().toLowerCase() === 'dialog'
      ) {
        found = true;
        return;
      }

      // !dialog.contains(event.target) or !modal.contains(event.target) outside click check
      if (
        methodName === 'contains' &&
        isEventTargetExpression(firstArg) &&
        isDialogTargetText(unwrapExpression(expr.getExpression()).getText().trim(), targetNode)
      ) {
        found = true;
        return;
      }

      // !e.target.closest('dialog') outside click check
      if (
        methodName === 'closest' &&
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
        }
      }
      return;
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
      const otherText = (leftIsTarget ? right : left).getText();
      if (
        isDialogTargetText(otherText, targetNode) ||
        otherText.endsWith('.currentTarget')
      ) {
        found = true;
        return;
      }
    }

    const strNode = Node.isStringLiteral(left) ? left : Node.isStringLiteral(right) ? right : null;
    if (strNode && strNode.getLiteralText().toUpperCase() === 'DIALOG') {
      const otherExpr = strNode === left ? right : left;
      if (
        Node.isPropertyAccessExpression(otherExpr) &&
        /^(?:tagname|nodename|localname)$/i.test(otherExpr.getName())
      ) {
        found = true;
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
        expr.getName() === 'getBoundingClientRect' &&
        isDialogTargetText(unwrapExpression(expr.getExpression()).getText(), targetNode)
      ) {
        hasGetBoundingClientRect = true;
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

function matchClickRegistration(
  node: Node,
): { readonly handlerNode: Node; readonly targetNode?: Node } | null {
  if (Node.isCallExpression(node)) {
    return matchEventListenerCall(node, ['click']);
  }
  if (
    Node.isBinaryExpression(node) &&
    node.getOperatorToken().getKind() === SyntaxKind.EqualsToken
  ) {
    const left = unwrapExpression(node.getLeft());
    if (Node.isPropertyAccessExpression(left) && left.getName() === 'onclick') {
      return {
        handlerNode: resolveCallableNode(node.getRight()),
        targetNode: left.getExpression(),
      };
    }
  }
  return null;
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
      (ctx.fileContent.includes('closedBy') || ctx.fileContent.includes('closedby')) &&
      /('closedBy'|"closedBy"|'closedby'|"closedby")\s+in\b/i.test(ctx.fileContent)
    ) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      const candidate = matchClickRegistration(node);
      if (
        !candidate ||
        isProtectedByFeatureGuard(node, CLOSEDBY_FEATURE_TOKENS) ||
        !handlerCallsCloseOnDialog(candidate.handlerNode, candidate.targetNode) ||
        (!isDialogOrTargetComparison(candidate.handlerNode, candidate.targetNode) &&
          !hasBoundingRectCoordinateCheck(candidate.handlerNode, candidate.targetNode))
      ) {
        return;
      }

      matches.push({
        line: node.getStartLineNumber(),
        message:
          'Manual backdrop click listener dismisses dialog; modernize with declarative <dialog closedby="any">.',
      });
    });

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
