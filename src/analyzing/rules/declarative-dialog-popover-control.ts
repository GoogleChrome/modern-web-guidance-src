import { Node, type CallExpression, type SourceFile, type Statement } from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  matchEventListenerCall,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
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

const DIALOG_RECEIVER_HINT_RE = /\b(?:dialog|modal|popover|drawer|sheet|lightbox|dlg)\b/i;
const NON_DIALOG_CLOSE_RECEIVER_RE =
  /\b(?:window|self|document|ws|socket|stream|conn|connection|db|file|reader|writer|port|channel|context|audioCtx|peer)\s*$/i;

const EVENT_PURE_CALL_RE =
  /^(?:e|evt|event)\s*\.\s*(?:preventDefault|stopPropagation|stopImmediatePropagation)\s*\(\s*\)$/;

const LOCAL_LOOKUP_DECL_RE =
  /^(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:document\s*\.\s*(?:getElementById|querySelector)|[a-zA-Z_$][\w$]*\s*\.\s*closest)\s*\(\s*(['"`])([^'"`]*)\2\s*\)$/;

const PURE_METHOD_CALL_RE =
  /^(.+?)\s*(?:\?\.|\.)\s*(showModal|showPopover|hidePopover|togglePopover|close)\s*\(\s*([^)]*)\)$/;

const INLINE_CLICK_ATTRS = ['onclick', '@click', 'v-on:click', 'on:click', '(click)'] as const;

/**
 * Extract the inline click handler expression from an HTML or JSX button/input element.
 */
function extractInlineClickHandler(
  element: DomElementView,
  documentText: string,
): string | null {
  for (const attrName of INLINE_CLICK_ATTRS) {
    const val = element.getAttribute(attrName);
    if (val !== null && val.trim().length > 0) {
      return val.trim();
    }
  }

  // Fallback for framework attributes (`@click`, `(click)`) or JSX `onClick={...}`
  // where linkedom or static attribute extraction omits the expression body.
  const lines = documentText.split('\n');
  const startIdx = Math.max(0, element.line - 1);
  const snippet = lines.slice(startIdx, Math.min(lines.length, startIdx + 12)).join('\n');

  const quotedAttrMatch = snippet.match(
    /(?:onclick|onClick|@click|v-on:click|on:click|\(click\))\s*=\s*(?:"([^"]*)"|'([^']*)')/,
  );
  if (quotedAttrMatch) {
    const val = quotedAttrMatch[1] ?? quotedAttrMatch[2] ?? '';
    return val.trim() || null;
  }

  const jsxBraceMatch = snippet.match(/\bonClick\s*=\s*\{([\s\S]*?)\}/);
  if (jsxBraceMatch?.[1]) {
    return jsxBraceMatch[1].trim();
  }

  return null;
}

function unwrapInlineFunctionBody(rawHandler: string): string {
  let code = rawHandler.trim();
  const arrowMatch = code.match(
    /^(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$][\w$]*)\s*=>\s*([\s\S]+)$/,
  );
  if (arrowMatch?.[1]) {
    code = arrowMatch[1].trim();
  } else {
    const fnMatch = code.match(/^function\s*\([^)]*\)\s*\{([\s\S]*)\}$/);
    if (fnMatch?.[1]) {
      code = fnMatch[1].trim();
    }
  }

  if (code.startsWith('{') && code.endsWith('}')) {
    code = code.slice(1, -1).trim();
  }
  return code;
}

/**
 * Check whether an inline click attribute string is a pure 0-argument invocation
 * of `.showModal()`, `.close()`, `.showPopover()`, `.hidePopover()`, or `.togglePopover()`
 * (plus optional `event.preventDefault()` / `event.stopPropagation()` and local lookup).
 */
function parsePureInlineDialogPopoverMethod(rawHandler: string): string | null {
  const body = unwrapInlineFunctionBody(rawHandler);
  if (!body) return null;

  if (/&&|\|\||\?[^.]/.test(body)) {
    return null;
  }

  const statements = body
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (statements.length === 0) return null;

  const dialogVars = new Set<string>();
  let matchedMethod: string | null = null;

  for (const stmt of statements) {
    if (EVENT_PURE_CALL_RE.test(stmt)) {
      continue;
    }

    const lookupMatch = stmt.match(LOCAL_LOOKUP_DECL_RE);
    if (lookupMatch) {
      const varName = lookupMatch[1];
      const selectorText = lookupMatch[3] ?? '';
      if (
        varName &&
        (DIALOG_RECEIVER_HINT_RE.test(varName) || DIALOG_RECEIVER_HINT_RE.test(selectorText))
      ) {
        dialogVars.add(varName);
      }
      continue;
    }

    const normalizedStmt = stmt.replace(/^return\s+/, '').trim();
    const callMatch = normalizedStmt.match(PURE_METHOD_CALL_RE);
    if (!callMatch) {
      return null;
    }

    const receiver = (callMatch[1] ?? '').trim();
    const methodName = callMatch[2] ?? '';
    const argsText = (callMatch[3] ?? '').trim();

    if (argsText.length > 0) {
      return null;
    }

    if (methodName === 'close') {
      if (NON_DIALOG_CLOSE_RECEIVER_RE.test(receiver)) {
        return null;
      }
      const isKnownDialogVar = dialogVars.has(receiver);
      const hasDialogHint =
        isKnownDialogVar ||
        DIALOG_RECEIVER_HINT_RE.test(receiver) ||
        /(?:getElementById|querySelector|closest)\s*\(/i.test(receiver);
      if (!hasDialogHint) {
        return null;
      }
    }

    if (matchedMethod !== null) {
      return null;
    }
    matchedMethod = methodName;
  }

  return matchedMethod;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check whether `documentText` contains an actual `<dialog id="<targetId>">`
 * or `<... id="<targetId>" popover>` element.
 */
function documentHasDialogOrPopoverWithId(documentText: string, rawTargetId: string): boolean {
  const targetId = rawTargetId.trim().replace(/^#/, '').trim();
  if (!targetId || /\s/.test(targetId)) {
    return false;
  }

  const escapedId = escapeRegExp(targetId);
  const dialogTagRe = new RegExp(
    `<dialog\\b[^>]*\\bid\\s*=\\s*(?:"${escapedId}"|'${escapedId}'|${escapedId}(?=[\\s>/]))[^>]*>`,
    'i',
  );
  if (dialogTagRe.test(documentText)) {
    return true;
  }

  const anyTagWithIdRe = new RegExp(
    `<([a-zA-Z][\\w-]*)\\b([^>]*\\bid\\s*=\\s*(?:"${escapedId}"|'${escapedId}'|${escapedId}(?=[\\s>/]))[^>]*)>`,
    'gi',
  );
  let match: RegExpExecArray | null = anyTagWithIdRe.exec(documentText);
  while (match !== null) {
    const attrsChunk = match[2] ?? '';
    if (/(?:^|\s)popover(?:\s*=|\s|$|\/)/i.test(attrsChunk)) {
      return true;
    }
    match = anyTagWithIdRe.exec(documentText);
  }

  return false;
}

export const declarativeDialogPopoverControlMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'button, input[type="button"]',
  fastTokens: [
    'showModal',
    'close(',
    'showPopover',
    'hidePopover',
    'togglePopover',
    'aria-controls',
    'data-dialog-target',
    'data-modal-target',
  ],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['commandfor', 'command', 'popovertarget'],
  matchElement(element: DomElementView, ctx: DomMatcherContext): { message: string } | null {
    if (
      element.hasAttribute('commandfor') ||
      element.hasAttribute('command') ||
      element.hasAttribute('popovertarget')
    ) {
      return null;
    }

    const inlineHandler = extractInlineClickHandler(element, ctx.documentText);
    if (inlineHandler !== null) {
      const matchedMethod = parsePureInlineDialogPopoverMethod(inlineHandler);
      if (matchedMethod !== null) {
        return {
          message: `<${element.tagName}> uses an inline click handler calling \`.${matchedMethod}()\`; use declarative HTML \`commandfor\`/\`command\` or \`popovertarget\` attributes instead.`,
        };
      }
    }

    const targetAttr =
      element.getAttribute('aria-controls') ??
      element.getAttribute('data-dialog-target') ??
      element.getAttribute('data-modal-target');
    if (targetAttr && documentHasDialogOrPopoverWithId(ctx.documentText, targetAttr)) {
      return {
        message: `<${element.tagName}> controls dialog/popover "${targetAttr}" via legacy target attributes; use declarative HTML \`commandfor\`/\`command\` or \`popovertarget\` attributes instead.`,
      };
    }

    return null;
  },
};

export const declarativeDialogPopoverControlRule: AnalyzerRule = {
  id: 'declarative-dialog-popover-control',
  guideId: 'declarative-dialog-popover-control',
  guideHash: 'ba26218df261',
  summary:
    'Detect buttons with pure inline showModal/close/togglePopover handlers or verified aria-controls/data-dialog-target attributes that can use commandfor/popovertarget.',
  matcher: declarativeDialogPopoverControlMatcher,
  phase2Rubric: {
    keepWhen: [
      'A `<button>` or `<input type="button">` opens, closes, or toggles a native `<dialog>` or `[popover]` element via a pure 0-argument `.showModal()`, `.close()`, `.showPopover()`, `.hidePopover()`, or `.togglePopover()` inline click handler.',
      'A `<button>` references an actual `<dialog id="...">` or `<... id="..." popover>` in the same document via `aria-controls`, `data-dialog-target`, or `data-modal-target` without `commandfor` or `popovertarget`.',
    ],
    dropWhen: [
      'The button uses Bootstrap, jQuery, or framework component attributes (`data-bs-toggle="modal"`, `data-toggle="modal"`, `$().modal("show")`) which require a full component migration rather than a 1:1 attribute swap.',
      'The handler passes a `returnValue` argument to `.close(arg)` (which declarative `command="close"` cannot pass without `request-close`).',
      'The click handler performs extra side effects (network requests, state mutations, classList changes, custom positioning) beyond opening/closing the dialog or popover.',
      'The element already declares `commandfor`, `command`, or `popovertarget`.',
    ],
  },
};

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

  if (methodName === 'close') {
    const receiverExpr = unwrapExpression(callee.getExpression());
    const receiverText = receiverExpr.getText().trim();
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

export const declarativeDialogPopoverControlClickListenerMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['showModal', 'showPopover', 'hidePopover', 'togglePopover', 'close('],
  matchFile(sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];
    const seenPositions = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      let handlerNode: Node | null = null;
      let listenerAnchorNode: Node = node;

      if (Node.isCallExpression(node)) {
        const matched = matchEventListenerCall(node, ['click']);
        if (matched) {
          handlerNode = matched.handlerNode;
          listenerAnchorNode = node;
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
        }
      }

      if (!handlerNode) {
        return;
      }

      if (isProtectedByFeatureGuard(listenerAnchorNode, FEATURE_GUARD_TOKENS)) {
        return;
      }

      const pureCall = extractPureDialogPopoverCallFromHandler(handlerNode);
      if (!pureCall) {
        return;
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
  guideHash: 'ba26218df261',
  summary:
    'Detect pure JS click event listeners that only call showModal(), close(), showPopover(), hidePopover(), or togglePopover().',
  matcher: declarativeDialogPopoverControlClickListenerMatcher,
  phase2Rubric: {
    keepWhen: [
      'A click event listener is attached to a button solely to call 0-argument `.showModal()`, `.close()`, `.showPopover()`, `.hidePopover()`, or `.togglePopover()` on a static `<dialog>` or `[popover]` element without other side effects.',
    ],
    dropWhen: [
      'The click listener performs additional logic (validation, network requests, analytics, classList or state updates) beyond opening/closing the dialog or popover.',
      'The listener passes a `returnValue` argument to `.close(arg)`.',
      'The listener calls a third-party library method like Bootstrap or jQuery `.modal("show")` or `.popover("toggle")`.',
    ],
  },
};

export const declarativeDialogPopoverControlBootstrapRule: AnalyzerRule =
  declarativeDialogPopoverControlRule;

export const declarativeDialogPopoverControlDomRule: AnalyzerRule =
  declarativeDialogPopoverControlRule;

export const declarativeDialogPopoverControlJsRule: AnalyzerRule =
  declarativeDialogPopoverControlClickListenerRule;

export const declarativeDialogPopoverControlRules: readonly AnalyzerRule[] = [
  declarativeDialogPopoverControlRule,
  declarativeDialogPopoverControlClickListenerRule,
];
