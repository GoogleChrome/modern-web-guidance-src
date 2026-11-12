import { Node, SyntaxKind, type NewExpression } from 'ts-morph';
import {
  getAssignment,
  getMemberAccess,
  getSemanticParent,
  getStaticString,
  isCallableNode,
  isGlobalMember,
  isGlobalReference,
  isIdentifierReference,
  resolveLocalExpression,
  resolvesToBinding,
  unwrapExpression,
  unwrapMethodCall,
} from '../../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../../scanners/js-scanner.ts';
import type { AnalyzerRule, JsRuleMatcher } from '../../schema.ts';

import { JS_GUIDE_HASH } from './shared.ts';
export { JS_GUIDE_HASH };

const STANDARD_ERROR_CTORS = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'URIError',
  'ReferenceError',
  'EvalError',
]);
const LOG_RECEIVERS = new Set(['console', 'logger', 'log']);
const LOG_METHODS = new Set(['log', 'warn', 'error', 'info', 'debug', 'trace']);
const MSG_SHAPE_A =
  'Pass { cause: err } as the second argument to new Error(message, { cause: err }) instead of assigning .cause manually after construction.';
const MSG_SHAPE_B =
  'Pass { cause: err } as the second argument to new Error(message, { cause: err }) to preserve the original error object and stack; keep the outer .message intact if callers or tests assert on it.';

interface MsgInfo {
  readonly hasErr: boolean;
  readonly hasStack: boolean;
  readonly hasText: boolean;
}

function combineMsgInfo(a: MsgInfo, b: MsgInfo, alternate = false): MsgInfo {
  return {
    hasErr: a.hasErr || b.hasErr,
    hasStack: a.hasStack || b.hasStack,
    hasText: alternate ? (a.hasErr && a.hasText) || (b.hasErr && b.hasText) : a.hasText || b.hasText,
  };
}

function getPropertyNameText(prop: Node): string | null {
  if (!Node.isPropertyAssignment(prop) && !Node.isShorthandPropertyAssignment(prop)) return null;
  const rawName = prop.getNameNode();
  return getStaticString(rawName) ?? rawName.getText();
}

function scanAssignCall(
  node: Node | undefined,
  matchesTarget: (arg: Node) => boolean,
  mutations: { hasCause: boolean; hasCustom: boolean },
): void {
  const method = unwrapMethodCall(node, { methodName: 'assign' });
  if (!method || !isGlobalReference(method.receiver, 'Object')) return;
  const [firstArg, ...sourceArgs] = method.args.map(unwrapExpression);
  if (!firstArg || !matchesTarget(firstArg)) return;

  for (const src of sourceArgs) {
    if (!Node.isObjectLiteralExpression(src)) continue;
    for (const prop of src.getProperties()) {
      const propName = Node.isSpreadAssignment(prop) ? null : getPropertyNameText(prop);
      if (propName === 'cause') {
        mutations.hasCause = true;
      } else {
        mutations.hasCustom = true;
      }
    }
  }
}

function analyzeMutations(newExpr: NewExpression): { hasCause: boolean; hasCustom: boolean } {
  const mutations = { hasCause: false, hasCustom: false };
  const parent = getSemanticParent(newExpr).parent;
  scanAssignCall(parent, (arg) => arg === newExpr, mutations);

  let lhsNode: Node | undefined;
  let varDeclNode: Node | undefined;
  if (Node.isVariableDeclaration(parent)) {
    lhsNode = parent.getNameNode();
    varDeclNode = parent;
  } else {
    const assign = getAssignment(parent);
    if (assign?.operator === SyntaxKind.EqualsToken) {
      lhsNode = unwrapExpression(assign.left);
    }
  }

  const varName = lhsNode && Node.isIdentifier(lhsNode) ? lhsNode.getText() : null;
  if (!varName) return mutations;

  const isTargetId = (node: Node): boolean => {
    const unwrapped = unwrapExpression(node);
    if (!Node.isIdentifier(unwrapped) || unwrapped.getText() !== varName) return false;
    if (!isIdentifierReference(unwrapped)) return false;
    return !varDeclNode || resolvesToBinding(unwrapped, varDeclNode);
  };

  const scope =
    (varDeclNode
      ? newExpr.getFirstAncestorByKind(SyntaxKind.Block)
      : newExpr.getFirstAncestorByKind(SyntaxKind.CatchClause)?.getBlock() ??
        newExpr.getFirstAncestor(isCallableNode)) ?? newExpr.getSourceFile();

  for (const bin of scope.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    const assign = getAssignment(bin);
    if (!assign || assign.operator !== SyntaxKind.EqualsToken) continue;
    const lhs = unwrapExpression(assign.left);
    if (Node.isPropertyAccessExpression(lhs) && isTargetId(lhs.getExpression())) {
      if (lhs.getName() === 'cause') {
        mutations.hasCause = true;
      } else {
        mutations.hasCustom = true;
      }
    }
  }

  for (const call of scope.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    scanAssignCall(call, isTargetId, mutations);
  }
  return mutations;
}

function inspectMsgArg(node: Node, errName: string): MsgInfo {
  const resolved = resolveLocalExpression(node, 3);
  if (Node.isIdentifier(resolved)) {
    return {
      hasErr: resolved.getText() === errName,
      hasStack: false,
      hasText: false,
    };
  }

  if (Node.isPropertyAccessExpression(resolved)) {
    const inner = inspectMsgArg(resolved.getExpression(), errName);
    if (inner.hasErr) {
      return {
        ...inner,
        hasStack: inner.hasStack || resolved.getName() === 'stack',
      };
    }
  }

  if (Node.isBinaryExpression(resolved)) {
    const op = resolved.getOperatorToken().getKind();
    if (op === SyntaxKind.PlusToken || op === SyntaxKind.BarBarToken || op === SyntaxKind.QuestionQuestionToken) {
      return combineMsgInfo(
        inspectMsgArg(resolved.getLeft(), errName),
        inspectMsgArg(resolved.getRight(), errName),
        op !== SyntaxKind.PlusToken,
      );
    }
  }

  const template = Node.isTaggedTemplateExpression(resolved) ? resolved.getTemplate() : resolved;
  if (Node.isTemplateExpression(template)) {
    const spans = template.getTemplateSpans();
    const hasStaticText =
      Boolean(template.getHead().getLiteralText()) ||
      spans.some((span) => Boolean(span.getLiteral().getLiteralText()));
    return spans.reduce<MsgInfo>(
      (acc, span) => combineMsgInfo(acc, inspectMsgArg(span.getExpression(), errName)),
      { hasErr: false, hasStack: false, hasText: hasStaticText },
    );
  }

  if (Node.isConditionalExpression(resolved)) {
    return combineMsgInfo(
      inspectMsgArg(resolved.getWhenTrue(), errName),
      inspectMsgArg(resolved.getWhenFalse(), errName),
      true,
    );
  }

  if (Node.isCallExpression(resolved)) {
    const callee = unwrapExpression(resolved.getExpression());
    const arg0 = resolved.getArguments()[0];
    if (Node.isPropertyAccessExpression(callee)) {
      if (arg0 && callee.getName() === 'stringify' && isGlobalReference(callee.getExpression(), 'JSON')) {
        return inspectMsgArg(arg0, errName);
      }
      return inspectMsgArg(callee.getExpression(), errName);
    }
    if (arg0 && Node.isIdentifier(callee) && (callee.getText() === 'String' || callee.getText() === 'encodeURIComponent')) {
      return inspectMsgArg(arg0, errName);
    }
  }

  return {
    hasErr: false,
    hasStack: false,
    hasText: getStaticString(resolved) !== '',
  };
}

function findEnclosingCatch(newExpr: NewExpression): { readonly errName: string; readonly scope: Node } | null {
  for (let cur: Node | undefined = newExpr.getParent(); cur; cur = cur.getParent()) {
    if (Node.isCatchClause(cur)) {
      const id = cur.getVariableDeclaration()?.getNameNode();
      return id && Node.isIdentifier(id) ? { errName: id.getText(), scope: cur.getBlock() } : null;
    }
    if (isCallableNode(cur)) {
      const call = cur.getParent();
      const method = unwrapMethodCall(call, { methodName: 'catch' });
      const paramNode = method && method.args[0] === cur ? cur.getParameters()[0]?.getNameNode() : undefined;
      return paramNode && Node.isIdentifier(paramNode)
        ? { errName: paramNode.getText(), scope: cur }
        : null;
    }
  }
  return null;
}

function isLogCallArg(newExpr: NewExpression): boolean {
  const enclosing = newExpr.getFirstAncestor(
    (ancestor) => Node.isCallExpression(ancestor) || isCallableNode(ancestor) || Node.isCatchClause(ancestor),
  );
  if (!Node.isCallExpression(enclosing)) return false;
  const callee = getMemberAccess(enclosing.getExpression());
  if (!callee || !LOG_METHODS.has(callee.name)) return false;

  const receiver = unwrapExpression(callee.expression);
  const receiverName = Node.isIdentifier(receiver)
    ? receiver.getText()
    : getMemberAccess(receiver)?.name ?? null;
  return Boolean(receiverName && LOG_RECEIVERS.has(receiverName));
}

export const jsErrorCauseMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: [['catch', '.cause'], ['Error']],
  dedupeLines: true,
  matchNew(node) {
    const errorName = isGlobalMember(node.getExpression(), STANDARD_ERROR_CTORS);
    if (!errorName) return null;

    const [msgArg, secondArg] = node.getArguments();
    if (
      !msgArg ||
      secondArg ||
      Node.isSpreadElement(msgArg) ||
      Node.isObjectLiteralExpression(unwrapExpression(msgArg))
    ) {
      return null;
    }

    const { hasCause, hasCustom } = analyzeMutations(node);
    if (hasCause) return MSG_SHAPE_A;
    if (hasCustom) return null;

    const catchCtx = findEnclosingCatch(node);
    if (!catchCtx || isLogCallArg(node)) return null;

    for (let cur: Node | undefined = node.getParent(); cur && cur !== catchCtx.scope; cur = cur.getParent()) {
      if (Node.isConditionalExpression(cur)) {
        const altBranch =
          node.getStart() >= cur.getWhenFalse().getStart() ? cur.getWhenTrue() : cur.getWhenFalse();
        if (unwrapExpression(altBranch).getText() === catchCtx.errName) return null;
      }
      if (Node.isBinaryExpression(cur)) {
        const op = cur.getOperatorToken().getKind();
        if (
          (op === SyntaxKind.BarBarToken || op === SyntaxKind.QuestionQuestionToken) &&
          node.getStart() >= cur.getRight().getStart() &&
          unwrapExpression(cur.getLeft()).getText() === catchCtx.errName
        ) {
          return null;
        }
      }
    }

    const { hasErr, hasStack, hasText } = inspectMsgArg(msgArg, catchCtx.errName);
    return hasErr && !hasStack && hasText ? MSG_SHAPE_B : null;
  },
});

export const jsErrorCauseRule: AnalyzerRule = {
  id: 'js/error-cause',
  guideId: 'js',
  guideHash: JS_GUIDE_HASH,
  summary: 'Pass `{ cause: err }` as the second argument to `new Error(...)` instead of attaching `.cause` manually or concatenating the cause only into the message string.',
  matcher: jsErrorCauseMatcher,
  verifierRubric: {
    keepWhen: [
      'A built-in Error constructor (Error, TypeError, RangeError, SyntaxError, URIError, ReferenceError, or EvalError) wraps a caught error by assigning .cause after construction (e.cause = err or Object.assign(new Error(...), { cause: err })) or by combining an outer message with err, err.toString(), or err.message without passing { cause: err }.',
      'When err.message, err.toString(), or ${err} is concatenated into the outer error message (new Error(\'Failed: \' + err.message) or new Error(`Failed: ${err}`)), keep the outer .message intact and pass { cause: err } as the second argument unless callers clearly do not assert on the combined .message.',
    ],
    dropWhen: [
      'The catch block sits at an RPC, IPC, HTTP response, worker, or security trust boundary that intentionally strips internal error objects or stack traces before exposing an error across the boundary.',
      'Visible project configuration in the snippet explicitly targets pre-ES2022 runtimes (engines.node < 16.9.0 or tsconfig.json lib/target older than ES2022); do not drop code merely because it uses var, ES5 syntax, or sits in a library/shim/vendor file.',
      'The constructor is a custom Error subclass or shadowed wrapper (HttpError, AppError, imported Error) taking positional arguments or not forwarding options to super(message, options), or a second argument is already supplied.',
      'The catch block attaches custom properties (e.code, e.status, e.originalError) that callers inspect instead of .cause, without setting e.cause.',
      'Downstream callers or tests assert strict deep equality or exact own property keys on the thrown Error instance where adding an own cause property fails assertions.',
    ],
  },
};

export default [jsErrorCauseRule] satisfies readonly AnalyzerRule[];
