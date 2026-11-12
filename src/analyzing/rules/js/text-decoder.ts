import { Node, SyntaxKind, type CallExpression, type SourceFile } from 'ts-morph';
import {
  getAssignedTarget,
  getAssignment,
  getMemberAccess,
  getSemanticParent,
  getSingleArgument,
  getStaticNumber,
  getStaticString,
  isCallableNode,
  isGlobalMember,
  isGlobalReference,
  isIdentifierReference,
  resolveLexicalBinding,
  resolveLocalExpression,
  resolvesToBinding,
  unwrapExpression,
  unwrapMethodCall,
} from '../../scanners/ast-helpers.ts';
import { createJsAstMatcher } from '../../scanners/js-scanner.ts';
import type { AnalyzerRule, JsRuleMatcher } from '../../schema.ts';

import { JS_GUIDE_HASH } from './shared.ts';
export { JS_GUIDE_HASH };

const MSG_ESCAPE =
  "decodeURIComponent(escape(...)) is a deprecated UTF-8 decoding workaround; replace with new TextDecoder().decode(bytes) (never pass 'latin1', which is windows-1252).";
const MSG_ESCAPE_TRY =
  "decodeURIComponent(escape(...)) inside try/catch can use new TextDecoder('utf-8', { fatal: true }).decode(bytes) so invalid UTF-8 sequences throw instead of substituting U+FFFD.";
const MSG_LOOP =
  "Manual multi-byte UTF-8 shift decoding loop can be replaced with new TextDecoder().decode(bytes) (never pass 'latin1', which is windows-1252).";
const MSG_FROM_CHAR =
  "String.fromCharCode on a Uint8Array byte buffer can be replaced with new TextDecoder().decode(bytes) (never use TextDecoder for binary btoa() strings or with 'latin1').";

const BYTE_CTORS = ['Uint8Array', 'Int8Array'];
const NON_BYTE_CTORS = [
  'Uint8ClampedArray',
  'Uint16Array',
  'Int16Array',
  'Uint32Array',
  'Int32Array',
  'Float32Array',
  'Float64Array',
];
const BINARY_CODING_GLOBALS = ['btoa', 'atob', 'escape'];
const LOOP_KINDS = new Set([
  SyntaxKind.WhileStatement,
  SyntaxKind.ForStatement,
  SyntaxKind.DoStatement,
]);
const LEAD_RE =
  /&\s*(?:15|0x0?f)\s*\)?\s*<<\s*12|&\s*(?:31|0x1f)\s*\)?\s*<<\s*6|&\s*(?:7|0x0?7)\s*\)?\s*<<\s*18/i;
const CONT_RE = /\(\s*[a-zA-Z_$][\w$]*\s*<<\s*6\s*\)\s*\|\s*[^;{}]*&\s*(?:63|0x3f)\b/i;

function isBinaryCodingCall(node: Node): boolean {
  return Node.isCallExpression(node) && isGlobalMember(node.getExpression(), BINARY_CODING_GLOBALS) !== null;
}

function getPropertyMethodName(node: Node | undefined): string {
  const method = unwrapMethodCall(node);
  return method && Node.isPropertyAccessExpression(method.callee) ? method.methodName : '';
}

function hasFileGuard(sf: SourceFile, text: string): boolean {
  if (!text.includes('TextDecoder')) return false;
  const hasTypeOfGuard = sf
    .getDescendantsOfKind(SyntaxKind.TypeOfExpression)
    .some((expr) => isGlobalReference(expr.getExpression(), 'TextDecoder'));
  if (hasTypeOfGuard) return true;
  return sf.getDescendantsOfKind(SyntaxKind.BinaryExpression).some(
    (bin) =>
      bin.getOperatorToken().getKind() === SyntaxKind.InKeyword &&
      getStaticString(bin.getLeft()) === 'TextDecoder',
  );
}

function resolveRef(node: Node): Node {
  let resolved = resolveLocalExpression(node, 3);
  if (!Node.isIdentifier(resolved)) return resolved;

  const declBinding = resolveLexicalBinding(resolved, resolved.getText());
  const declNode = declBinding && 'node' in declBinding ? declBinding.node : undefined;
  const scope =
    resolved.getFirstAncestor(isCallableNode) ??
    resolved.getFirstAncestor(Node.isBlock) ??
    resolved.getSourceFile();
  const varName = resolved.getText();
  const usePos = node.getStart();

  for (const bin of scope.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    if (bin.getStart() >= usePos) break;
    const assign = getAssignment(bin);
    if (!assign || assign.operator !== SyntaxKind.EqualsToken) continue;
    const lhs = unwrapExpression(assign.left);
    if (
      Node.isIdentifier(lhs) &&
      isIdentifierReference(lhs) &&
      lhs.getText() === varName &&
      (!declNode || resolvesToBinding(lhs, declNode))
    ) {
      resolved = resolveLocalExpression(assign.right, 2);
    }
  }
  return resolved;
}

function hasByteType(id: Node): boolean {
  if (!Node.isIdentifier(id)) return false;
  const name = id.getText();
  for (let cur: Node | undefined = id.getParent(); cur; cur = cur.getParent()) {
    const decl = Node.isParametered(cur)
      ? cur.getParameter(name)
      : Node.isBlock(cur) || Node.isSourceFile(cur)
        ? cur.getVariableDeclaration(name)
        : undefined;
    if (!decl) continue;
    const typeRef = decl.getTypeNode()?.asKind(SyntaxKind.TypeReference);
    const typeName = typeRef?.getTypeName();
    if (!typeName) return false;
    const targetName = Node.isQualifiedName(typeName) ? typeName.getRight() : typeName;
    return isGlobalMember(targetName, BYTE_CTORS) !== null;
  }
  return false;
}

function isUint8Buffer(node: Node | undefined, inCatchTry: boolean, depth = 0): boolean {
  if (!node || depth > 3) return false;
  const resolved = resolveRef(node);

  if (Node.isNewExpression(resolved)) {
    if (!isGlobalMember(resolved.getExpression(), BYTE_CTORS)) return false;
    const rawArg = resolved.getArguments()[0];
    const arg0 = rawArg ? unwrapExpression(rawArg) : undefined;
    const argMember = getMemberAccess(arg0);
    if (argMember?.name === 'buffer') {
      const src = resolveRef(argMember.expression);
      if (Node.isNewExpression(src) && isGlobalMember(src.getExpression(), NON_BYTE_CTORS)) {
        return false;
      }
    }
    if (inCatchTry && arg0) {
      const numVal = getStaticNumber(arg0);
      if (numVal !== null && numVal <= 1) return false;
      if (Node.isArrayLiteralExpression(arg0) && arg0.getElements().length <= 1) return false;
    }
    return true;
  }

  const method = unwrapMethodCall(resolved);
  if (!method || !Node.isPropertyAccessExpression(method.callee)) {
    return hasByteType(resolved);
  }
  if (method.methodName === 'subarray' || method.methodName === 'slice') {
    return isUint8Buffer(method.receiver, inCatchTry, depth + 1);
  }
  if (method.methodName === 'from' && isGlobalReference(method.receiver, 'Array')) {
    return isUint8Buffer(method.args[0], inCatchTry, depth + 1);
  }
  return false;
}

function hasBinaryConsumer(call: CallExpression, callParent: Node | undefined): boolean {
  const target = callParent?.asKind(SyntaxKind.ArrayLiteralExpression) ?? call;
  const targetParent = target === call ? callParent : getSemanticParent(target).parent;

  if (
    call.getFirstAncestor(isBinaryCodingCall) ||
    getPropertyMethodName(callParent) === 'push' ||
    (target !== call && getPropertyMethodName(targetParent) === 'join')
  ) {
    return true;
  }

  const fn = call.getFirstAncestor(isCallableNode);
  let assignedId = targetParent
    ? getAssignedTarget(targetParent)?.asKind(SyntaxKind.Identifier)
    : undefined;
  if (assignedId) {
    const varDecl = targetParent?.asKind(SyntaxKind.VariableDeclaration);
    const propAssign = targetParent?.asKind(SyntaxKind.PropertyAssignment);
    const assignExpr = getAssignment(targetParent);
    const initNode = varDecl?.getInitializer() ?? propAssign?.getInitializer() ?? assignExpr?.right;
    if (!initNode || unwrapExpression(initNode) !== target) {
      assignedId = undefined;
    }
  }

  let flowsToReturn = Boolean(
    callParent &&
      (Node.isReturnStatement(callParent) ||
        (fn && Node.isArrowFunction(fn) && unwrapExpression(fn.getBody()) === call)),
  );

  if (assignedId) {
    const varName = assignedId.getText();
    const fallbackBinding = resolveLexicalBinding(assignedId, varName);
    const bindingDecl =
      assignedId.getParentIfKind(SyntaxKind.VariableDeclaration) ??
      (fallbackBinding && 'node' in fallbackBinding ? fallbackBinding.node : undefined);
    const searchScope = fn ?? call.getSourceFile();

    for (const id of searchScope.getDescendantsOfKind(SyntaxKind.Identifier)) {
      if (id === assignedId || id.getText() !== varName || !isIdentifierReference(id)) continue;
      if (bindingDecl && !resolvesToBinding(id, bindingDecl)) continue;
      const idParent = getSemanticParent(id).parent;
      const methodName = getPropertyMethodName(idParent);
      if (id.getFirstAncestor(isBinaryCodingCall) || methodName === 'push' || methodName === 'join') {
        return true;
      }
      if (idParent && Node.isReturnStatement(idParent)) {
        flowsToReturn = true;
      }
    }
  }

  if (!flowsToReturn || !fn) return false;
  let helperIdNode: Node | undefined;
  if (Node.isNameable(fn) || Node.isPropertyNamed(fn)) {
    helperIdNode = fn.getNameNode();
  } else {
    const fnParent = fn.getParent();
    helperIdNode = (fnParent ? getAssignedTarget(fnParent) : null) ?? undefined;
  }
  const helperId = helperIdNode?.asKind(SyntaxKind.Identifier);
  if (!helperId) return false;

  const helperName = helperId.getText();
  const helperScope =
    fn.getFirstAncestor((a) => Node.isClassDeclaration(a) || Node.isClassExpression(a)) ??
    call.getSourceFile();
  const isClassMethod = Node.isMethodDeclaration(fn);

  return helperScope.getDescendantsOfKind(SyntaxKind.CallExpression).some((binaryCall) => {
    if (!isBinaryCodingCall(binaryCall)) return false;
    return binaryCall.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => {
      if (id === helperId || id.getText() !== helperName) return false;
      if (isClassMethod) {
        const access = id.getParentIfKind(SyntaxKind.PropertyAccessExpression);
        return Boolean(access && access.getNameNode() === id && Node.isThisExpression(access.getExpression()));
      }
      return isIdentifierReference(id);
    });
  });
}

function matchCall(call: CallExpression): string | null {
  const calleeExpr = unwrapExpression(call.getExpression());
  const parent = getSemanticParent(call).parent;
  const decodeUriArg = isGlobalReference(calleeExpr, 'decodeURIComponent')
    ? getSingleArgument(call)
    : null;

  let bytesArg: Node | undefined;
  if (!decodeUriArg && Node.isPropertyAccessExpression(calleeExpr)) {
    const outerName = calleeExpr.getName();
    const args = call.getArguments();
    if (outerName === 'fromCharCode' && isGlobalReference(calleeExpr.getExpression(), 'String')) {
      if (args.length === 1 && Node.isSpreadElement(args[0])) {
        bytesArg = args[0].getExpression();
      }
    } else if (outerName === 'apply') {
      const inner = getMemberAccess(calleeExpr.getExpression());
      if (inner?.name === 'fromCharCode' && isGlobalReference(inner.expression, 'String')) {
        bytesArg = args[1];
      }
    }
  }

  if (!decodeUriArg && !bytesArg) return null;

  const enclosingFn = call.getFirstAncestor(isCallableNode);
  const inCatchTry = Boolean(
    call.getFirstAncestor(
      (ancestor) =>
        Node.isTryStatement(ancestor) &&
        Boolean(ancestor.getCatchClause()) &&
        ancestor.getFirstAncestor(isCallableNode) === enclosingFn,
    ),
  );
  if (
    inCatchTry &&
    parent &&
    (Node.isExpressionStatement(parent) ||
      Node.isVoidExpression(parent) ||
      (Node.isPrefixUnaryExpression(parent) && parent.getOperatorToken() === SyntaxKind.ExclamationToken))
  ) {
    return null;
  }

  if (decodeUriArg) {
    const unwrappedArg = unwrapExpression(decodeUriArg);
    if (
      Node.isCallExpression(unwrappedArg) &&
      isGlobalReference(unwrappedArg.getExpression(), 'escape') &&
      getSingleArgument(unwrappedArg)
    ) {
      return inCatchTry ? MSG_ESCAPE_TRY : MSG_ESCAPE;
    }
    return null;
  }

  if (!bytesArg || !isUint8Buffer(bytesArg, inCatchTry) || hasBinaryConsumer(call, parent)) {
    return null;
  }
  const insidePlusEquals = call.getFirstAncestor(
    (ancestor) =>
      Node.isBinaryExpression(ancestor) &&
      ancestor.getOperatorToken().getKind() === SyntaxKind.PlusEqualsToken,
  );
  return insidePlusEquals ? null : MSG_FROM_CHAR;
}

function isUtf8LoopBody(bodyText: string): boolean {
  return (
    bodyText.includes('<<') &&
    !/>>>?\s*(?:12|18)\b/.test(bodyText) &&
    !/\b[a-zA-Z_$][\w$]*\[[^\]]+\]\s*=\s*[a-zA-Z_$][\w$.]*\[/.test(bodyText) &&
    /&\s*(?:63|0x3f)\b/i.test(bodyText) &&
    (LEAD_RE.test(bodyText) || (/&\s*(?:31|15|7|0x1f|0x0?f|0x0?7)\b/i.test(bodyText) && CONT_RE.test(bodyText)))
  );
}

interface Utf8CandidateFlags {
  readonly checkCall: boolean;
  readonly checkLoop: boolean;
}

const utf8CandidateCache = new WeakMap<SourceFile, Utf8CandidateFlags>();

function getUtf8DecodeCandidate(sf: SourceFile, text: string): Utf8CandidateFlags {
  const cached = utf8CandidateCache.get(sf);
  if (cached) return cached;

  const flags: Utf8CandidateFlags = {
    checkCall:
      (text.includes('decodeURIComponent') && text.includes('escape')) ||
      (text.includes('fromCharCode') && (text.includes('Uint8Array') || text.includes('Int8Array'))),
    checkLoop: text.includes('<<') && /&\s*(?:63|0x3f)\b/i.test(text),
  };
  utf8CandidateCache.set(sf, flags);
  return flags;
}

export const jsTextDecoderMatcher: JsRuleMatcher = createJsAstMatcher({
  fastTokens: [['decodeURIComponent', 'fromCharCode', '<< 6', '<<6', '<< 12', '<<12']],
  featureGuardTokens: ['TextDecoder'],
  dedupeLines: true,
  kinds: [
    SyntaxKind.CallExpression,
    SyntaxKind.WhileStatement,
    SyntaxKind.ForStatement,
    SyntaxKind.DoStatement,
  ],
  shouldSkipFile(sf, ctx) {
    const { checkCall, checkLoop } = getUtf8DecodeCandidate(sf, ctx.fileContent);
    return (!checkCall && !checkLoop) || hasFileGuard(sf, ctx.fileContent);
  },
  matchNode(node, sf, ctx) {
    const { checkCall, checkLoop } = getUtf8DecodeCandidate(sf, ctx.fileContent);
    if (Node.isCallExpression(node)) {
      return checkCall ? matchCall(node) : null;
    }
    if (!checkLoop || !LOOP_KINDS.has(node.getKind())) return null;
    if (!isUtf8LoopBody(node.getText())) return null;

    const fnScopeText = (node.getFirstAncestor(isCallableNode) ?? node).getText();
    if (!/(?:fromCharCode|fromCodePoint|\+=)/.test(fnScopeText)) return null;

    const hasInnerUtf8Loop = node
      .getDescendants()
      .some((desc) => desc !== node && LOOP_KINDS.has(desc.getKind()) && isUtf8LoopBody(desc.getText()));
    return hasInnerUtf8Loop ? null : MSG_LOOP;
  },
});

export const jsTextDecoderRule: AnalyzerRule = {
  id: 'js/text-decoder',
  guideId: 'js',
  guideHash: JS_GUIDE_HASH,
  summary: 'Replace legacy decodeURIComponent(escape(...)), manual UTF-8 byte loops, and String.fromCharCode byte buffer decoding with TextDecoder.',
  matcher: jsTextDecoderMatcher,
  verifierRubric: {
    keepWhen: [
      'decodeURIComponent(escape(str)), decodeURIComponent(escape(atob(b64))), manual multi-byte UTF-8 bit-shift loops (<< 12 / << 6 with & 0x3F), or String.fromCharCode.apply(null, uint8Bytes) / String.fromCharCode(...uint8Bytes) decodes UTF-8 bytes into a standard JavaScript string.',
      'When value-returning / result-using try/catch wraps decodeURIComponent(escape(...)) (not a discarded/void validity-check statement) and catches malformed UTF-8 errors, replacement uses new TextDecoder("utf-8", { fatal: true }).',
    ],
    dropWhen: [
      'String.fromCharCode builds a binary Latin1 string fed to btoa(...) / Base64 encoding, cryptographic binary hashing, or non-UTF-8 raw 8-bit binary protocols (where TextDecoder replaces bytes >= 0x80 with U+FFFD and causes btoa() to throw InvalidCharacterError).',
      'The code requires lossless 1:1 Latin1/binary byte-to-code-unit (0x00–0xFF) mapping rather than UTF-8 text decoding (never substitute new TextDecoder("latin1"), which aliases windows-1252 and remaps 0x80–0x9F such as U+20AC).',
      'String.fromCharCode receives Uint16Array/Int32Array/Float32Array views, Unicode code points > 0xFF, TextEncoder.encode() output, or is a try/catch capability probe on an empty/single-byte array.',
      'The loop encodes code points to UTF-8 bytes, decodes UTF-16LE/BE code units without UTF-8 byte continuation masks, translates through a custom non-Unicode lookup table, updates interleaved parser cursor state up to a NUL terminator that cannot be .subarray()-sliced, or the matched function/branch already guards typeof TextDecoder.',
    ],
  },
};

export default [jsTextDecoderRule] satisfies readonly AnalyzerRule[];
