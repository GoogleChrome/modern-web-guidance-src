import { Node, type CallExpression, type SourceFile, type Statement } from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  matchEventListenerCall,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

const DIALOG_POPOVER_METHODS: ReadonlySet<string> = new Set([
  'showModal',
  'showPopover',
  'hidePopover',
  'togglePopover',
  'close',
]);

const FEATURE_GUARD_TOKENS: readonly string[] = [
  'commandForElement',
  'commandfor',
  'popoverTargetElement',
  'popovertarget',
  'CommandEvent',
];

const DIALOG_RECEIVER_HINT_RE = /\b(?:dialog|dlg|popover)\b/i;
const NON_DIALOG_CLOSE_RECEIVER_RE =
  /\b(?:window|self|document|ws|socket|stream|conn|connection|db|file|reader|writer|port|channel|context|audioCtx|peer)\s*$/i;

const INVALID_RECEIVERS = new Set(['this', 'self', 'window', 'document']);

function isPureDomLookupExpr(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  if (!Node.isCallExpression(unwrapped)) return false;
  const callee = unwrapExpression(unwrapped.getExpression());
  if (!Node.isPropertyAccessExpression(callee)) return false;

  const method = callee.getName();
  if (method !== 'getElementById' && method !== 'querySelector' && method !== 'closest') {
    return false;
  }

  const args = unwrapped.getArguments();
  const firstArg = args[0];
  if (args.length !== 1 || !firstArg) return false;
  const arg0 = unwrapExpression(firstArg);
  if (!Node.isStringLiteral(arg0) && !Node.isNoSubstitutionTemplateLiteral(arg0)) {
    return false;
  }

  const receiverText = unwrapExpression(callee.getExpression()).getText().trim();
  return /^[a-zA-Z_$][\w$.]*$/.test(receiverText);
}

function isPureEventControlExpr(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  if (!Node.isCallExpression(unwrapped) || unwrapped.getArguments().length !== 0) {
    return false;
  }
  const callee = unwrapExpression(unwrapped.getExpression());
  if (!Node.isPropertyAccessExpression(callee)) {
    return false;
  }
  const method = callee.getName();
  if (
    method !== 'preventDefault' &&
    method !== 'stopPropagation' &&
    method !== 'stopImmediatePropagation'
  ) {
    return false;
  }
  return Node.isIdentifier(unwrapExpression(callee.getExpression()));
}

function matchPureDialogPopoverCallNode(
  node: Node,
  knownDialogVars: ReadonlySet<string>,
): { callNode: CallExpression; methodName: string } | null {
  const unwrapped = unwrapExpression(node);
  if (!Node.isCallExpression(unwrapped)) return null;

  // Must be called with 0 arguments (reject `.close('confirm')`, `.togglePopover(true)`).
  if (unwrapped.getArguments().length !== 0) {
    return null;
  }

  const callee = unwrapExpression(unwrapped.getExpression());
  if (!Node.isPropertyAccessExpression(callee)) {
    return null;
  }

  const methodName = callee.getName();
  if (!DIALOG_POPOVER_METHODS.has(methodName)) {
    return null;
  }

  const receiverExpr = unwrapExpression(callee.getExpression());
  const receiverText = receiverExpr.getText().trim();

  if (INVALID_RECEIVERS.has(receiverText)) {
    return null;
  }

  // Reject receivers accessed off event objects (`event.data.dialog.close()`) unless `.closest(...)`
  if (/^(?:e|evt|event)\s*\./.test(receiverText) && !/\.closest\s*\(/.test(receiverText)) {
    return null;
  }

  // Reject custom JS class instances constructed with `new ...()` (e.g. `new AudioProcessingModal()`)
  if (Node.isIdentifier(receiverExpr)) {
    const resolvedReceiver = resolveLocalExpression(receiverExpr);
    if (Node.isNewExpression(resolvedReceiver)) {
      return null;
    }
  }

  if (methodName === 'close') {
    if (NON_DIALOG_CLOSE_RECEIVER_RE.test(receiverText)) {
      return null;
    }
    if (Node.isIdentifier(receiverExpr) && knownDialogVars.has(receiverExpr.getText())) {
      return { callNode: unwrapped, methodName };
    }
    if (
      DIALOG_RECEIVER_HINT_RE.test(receiverText) ||
      (isPureDomLookupExpr(receiverExpr) && DIALOG_RECEIVER_HINT_RE.test(receiverText))
    ) {
      return { callNode: unwrapped, methodName };
    }
    return null;
  }

  return { callNode: unwrapped, methodName };
}

function extractPureDialogPopoverCallFromStatements(
  statements: readonly Statement[],
): { callNode: CallExpression; methodName: string } | null {
  const knownDialogVars = new Set<string>();
  let matchedCall: { callNode: CallExpression; methodName: string } | null = null;

  for (const stmt of statements) {
    if (Node.isEmptyStatement(stmt)) {
      continue;
    }

    if (Node.isVariableStatement(stmt)) {
      for (const decl of stmt.getDeclarationList().getDeclarations()) {
        const init = decl.getInitializer();
        if (!Node.isIdentifier(decl.getNameNode()) || !init || !isPureDomLookupExpr(init)) {
          return null;
        }
        const varName = decl.getName();
        const initText = init.getText();
        if (DIALOG_RECEIVER_HINT_RE.test(varName) || DIALOG_RECEIVER_HINT_RE.test(initText)) {
          knownDialogVars.add(varName);
        }
      }
      continue;
    }

    if (Node.isExpressionStatement(stmt)) {
      const expr = stmt.getExpression();
      if (isPureEventControlExpr(expr)) {
        continue;
      }
      const callMatch = matchPureDialogPopoverCallNode(expr, knownDialogVars);
      if (callMatch !== null && matchedCall === null) {
        matchedCall = callMatch;
        continue;
      }
      return null;
    }

    if (Node.isReturnStatement(stmt)) {
      const expr = stmt.getExpression();
      if (!expr) {
        continue;
      }
      const callMatch = matchPureDialogPopoverCallNode(expr, knownDialogVars);
      if (callMatch !== null && matchedCall === null) {
        matchedCall = callMatch;
        continue;
      }
      return null;
    }

    return null;
  }

  return matchedCall;
}

function extractPureDialogPopoverCallFromHandler(
  handlerNode: Node,
): { callNode: CallExpression; methodName: string } | null {
  if (
    !Node.isArrowFunction(handlerNode) &&
    !Node.isFunctionExpression(handlerNode) &&
    !Node.isFunctionDeclaration(handlerNode)
  ) {
    return null;
  }

  const body = handlerNode.getBody();
  if (!body) {
    return null;
  }
  if (Node.isBlock(body)) {
    return extractPureDialogPopoverCallFromStatements(body.getStatements());
  }

  return matchPureDialogPopoverCallNode(body, new Set());
}

const NON_BUTTON_LISTENER_TARGET_RE =
  /\b(?:window|document|document\.body|body|overlay|backdrop|mask|scrim)\b/i;

export const declarativeDialogPopoverControlClickListenerMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    ['click', 'onclick'],
    ['showModal', 'showPopover', 'hidePopover', 'togglePopover', 'close'],
  ],
  matchFile(sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];
    const seenPositions = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      let handlerNode: Node | null = null;
      let listenerAnchorNode: Node = node;
      let targetNode: Node | undefined;

      if (Node.isCallExpression(node)) {
        const matched = matchEventListenerCall(node, ['click']);
        if (matched) {
          handlerNode = matched.handlerNode;
          listenerAnchorNode = node;
          targetNode = matched.targetNode;
        } else {
          // Also support `.click(handler)` with 1 argument
          const expr = unwrapExpression(node.getExpression());
          const args = node.getArguments();
          const firstArg = args[0];
          if (
            Node.isPropertyAccessExpression(expr) &&
            expr.getName() === 'click' &&
            args.length === 1 &&
            firstArg !== undefined
          ) {
            handlerNode = unwrapExpression(firstArg);
            listenerAnchorNode = node;
            targetNode = expr.getExpression();
          }
        }
      } else if (Node.isBinaryExpression(node)) {
        const left = unwrapExpression(node.getLeft());
        if (
          node.getOperatorToken().getText() === '=' &&
          Node.isPropertyAccessExpression(left) &&
          left.getName().toLowerCase() === 'onclick'
        ) {
          handlerNode = unwrapExpression(node.getRight());
          listenerAnchorNode = node;
          targetNode = left.getExpression();
        }
      }

      if (!handlerNode) {
        return;
      }

      // Check target node: reject window, document, body, overlay, backdrop, or scrim
      if (targetNode) {
        const targetText = targetNode.getText().trim();
        if (NON_BUTTON_LISTENER_TARGET_RE.test(targetText)) {
          return;
        }
      }

      if (isProtectedByFeatureGuard(listenerAnchorNode, FEATURE_GUARD_TOKENS)) {
        return;
      }

      const pureCall = extractPureDialogPopoverCallFromHandler(handlerNode);
      if (!pureCall) {
        return;
      }

      // Reject if target is the same dialog element being closed (backdrop listener, not button)
      if (targetNode && pureCall.methodName === 'close') {
        const callee = unwrapExpression(pureCall.callNode.getExpression());
        if (Node.isPropertyAccessExpression(callee)) {
          const closeReceiverText = unwrapExpression(callee.getExpression()).getText().trim();
          if (closeReceiverText === targetNode.getText().trim()) {
            return;
          }
        }
      }

      const callPos = pureCall.callNode.getStart();
      if (seenPositions.has(callPos)) {
        return;
      }
      seenPositions.add(callPos);

      const { line, column } = sourceFile.getLineAndColumnAtPos(callPos);
      matches.push({
        line,
        column,
        message: `Click listener only calls \`.${pureCall.methodName}()\` to control a dialog or popover; replace imperative JS listener with declarative HTML \`commandfor\`/\`command\` or \`popovertarget\` attributes.`,
      });
    });

    return matches;
  },
};

export const declarativeDialogPopoverControlClickListenerRule: AnalyzerRule = {
  id: 'declarative-dialog-popover-control/click-listener',
  guideId: 'declarative-dialog-popover-control',
  guideHash: '87f6a7ad8849',
  summary:
    'Detect pure JS click event listeners that only call showModal(), close(), showPopover(), hidePopover(), or togglePopover().',
  matcher: declarativeDialogPopoverControlClickListenerMatcher,
  verifierRubric: {
    keepWhen: [
      'A click event listener is attached to a button solely to call 0-argument `.showModal()`, `.close()`, `.showPopover()`, `.hidePopover()`, or `.togglePopover()` on a static `<dialog>` or `[popover]` element without other side effects.',
    ],
    dropWhen: [
      'The click listener performs additional logic (validation, network requests, analytics, classList or state updates) beyond opening/closing the dialog or popover.',
      'The click listener is attached to the dialog root, backdrop, overlay, or a non-button menu item rather than a `<button>` element, or uses `stopImmediatePropagation()` to suppress parent event delegation on a custom element.',
      'The listener passes a `returnValue` argument to `.close(arg)`.',
      'The listener calls a third-party library method like Bootstrap or jQuery `.modal("show")` or `.popover("toggle")`.',
    ],
  },
};

export const declarativeDialogPopoverControlJsRule: AnalyzerRule =
  declarativeDialogPopoverControlClickListenerRule;

export default [
  declarativeDialogPopoverControlClickListenerRule,
] satisfies readonly AnalyzerRule[];
