import { Node, SyntaxKind, type CallExpression, type VariableDeclaration } from 'ts-morph';
import {
  getAssignment,
  getMemberAccess,
  getSemanticParent,
  getStaticNumber,
  getStaticString,
  isCallableNode,
  isGlobalReference,
  isIdentifierReference,
  resolveCallableNode,
  resolveLocalExpression,
  resolvesToBinding,
  unwrapExpression,
  unwrapMethodCall,
  type UnwrappedMethodCall,
} from '../../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../../scanners/js-scanner.ts';
import type { AnalyzerRule, JsRuleMatcher } from '../../schema.ts';

import { JS_GUIDE_HASH } from './shared.ts';
export { JS_GUIDE_HASH };

type QuerySource = 'search' | 'query' | 'href';

function msgFor(source: QuerySource): string {
  const detail =
    source === 'search'
      ? 'location.search can use new URLSearchParams(location.search)'
      : 'location.href or a url parameter can use new URL(url, location.href).searchParams';
  return `Hand-rolled query parsing on ${detail}; check + decoding, missing "=", and repeated keys in the guide.`;
}

function getRegexSource(node: Node | undefined): string | null {
  if (!node) return null;
  const unwrapped = unwrapExpression(node);
  return Node.isRegularExpressionLiteral(unwrapped) ? unwrapped.getLiteralValue().source : null;
}

function unwrapStrictMethod(node: Node | undefined, methodName?: string): UnwrappedMethodCall | null {
  const method = unwrapMethodCall(node, methodName ? { methodName } : undefined);
  if (!method || !Node.isPropertyAccessExpression(method.callee)) return null;
  return method;
}

function findParamFunction(id: Node) {
  return id.getFirstAncestor(
    (ancestor) => isCallableNode(ancestor) && Boolean(ancestor.getParameter(id.getText())),
  );
}

function getSearchScope(node: Node): Node {
  return node.getFirstAncestor(isCallableNode) ?? node.getFirstAncestor(Node.isBlock) ?? node.getSourceFile();
}

function resolveStaticText(node: Node | undefined): string {
  const str = getStaticString(node);
  if (str !== null) return str;
  if (!node) return '';
  const unwrapped = unwrapExpression(node);
  if (Node.isBinaryExpression(unwrapped) && unwrapped.getOperatorToken().getKind() === SyntaxKind.PlusToken) {
    return resolveStaticText(unwrapped.getLeft()) + resolveStaticText(unwrapped.getRight());
  }
  if (Node.isTemplateExpression(unwrapped)) {
    return (
      unwrapped.getHead().getLiteralText() +
      unwrapped
        .getTemplateSpans()
        .map((span) => resolveStaticText(span.getExpression()) + span.getLiteral().getLiteralText())
        .join('')
    );
  }
  return '';
}

function isLocationHost(node: Node | undefined): boolean {
  if (!node) return false;
  return (
    isGlobalReference(node, 'window') ||
    isGlobalReference(node, 'document') ||
    isGlobalReference(node, 'location')
  );
}

function classifyLocationProperty(node: Node): QuerySource | null {
  const unwrapped = unwrapExpression(node);
  if (
    !Node.isPropertyAccessExpression(unwrapped) ||
    (unwrapped.getName() !== 'search' && unwrapped.getName() !== 'href')
  ) {
    return null;
  }
  const prop: QuerySource = unwrapped.getName() === 'search' ? 'search' : 'href';
  const base = resolveLocalExpression(unwrapped.getExpression(), 2);

  let host: Node | undefined;
  if (isGlobalReference(base, 'location')) {
    host = base;
  } else if (Node.isPropertyAccessExpression(base) && base.getName() === 'location') {
    host = resolveLocalExpression(base.getExpression(), 1);
  }

  let resolvedHost = host;
  if (host && Node.isIdentifier(host)) {
    const fn = findParamFunction(host);
    if (fn && isCallableNode(fn)) {
      const parent = getSemanticParent(fn).parent;
      if (Node.isCallExpression(parent)) {
        const paramIdx = fn.getParameters().findIndex((param) => param.getName() === host.getText());
        resolvedHost = parent.getArguments()[paramIdx];
      }
    }
  }

  return isLocationHost(resolvedHost) ? prop : null;
}

function toQuerySource(src: QuerySource | null): QuerySource | null {
  if (src === 'search') return 'search';
  return src ? 'query' : null;
}

function classifyQuerySource(node: Node, depth = 0, trimmedHrefPrefix = false): QuerySource | null {
  if (depth > 5) return null;
  const unwrapped = unwrapExpression(node);

  const locationSrc = classifyLocationProperty(unwrapped);
  if (locationSrc) return locationSrc;

  if (Node.isConditionalExpression(unwrapped)) {
    const startsWithCall = unwrapStrictMethod(unwrapped.getCondition(), 'startsWith');
    const hasQuestionGuard = getStaticString(startsWithCall?.args[0]) === '?';
    const whenTrueSrc = classifyQuerySource(unwrapped.getWhenTrue(), depth + 1, hasQuestionGuard);
    const whenFalseSrc = classifyQuerySource(unwrapped.getWhenFalse(), depth + 1);
    if (getStaticString(unwrapped.getWhenFalse()) === '' || whenTrueSrc === whenFalseSrc) {
      return whenTrueSrc;
    }
    if (
      hasQuestionGuard &&
      startsWithCall &&
      whenTrueSrc === 'query' &&
      whenFalseSrc === 'href' &&
      classifyQuerySource(startsWithCall.receiver, depth + 1) === 'href'
    ) {
      return whenTrueSrc;
    }
    return null;
  }

  if (Node.isBinaryExpression(unwrapped)) {
    const op = unwrapped.getOperatorToken().getKind();
    if (op !== SyntaxKind.BarBarToken && op !== SyntaxKind.QuestionQuestionToken) return null;
    if (getStaticString(unwrapped.getRight()) === '') {
      return classifyQuerySource(unwrapped.getLeft(), depth + 1);
    }
    const left = unwrapExpression(unwrapped.getLeft());
    return Node.isIdentifier(left) && findParamFunction(left) && classifyQuerySource(unwrapped.getRight(), depth + 1)
      ? 'href'
      : null;
  }

  if (Node.isIdentifier(unwrapped)) {
    const localInit = resolveLocalExpression(unwrapped, 1);
    if (localInit !== unwrapped) return classifyQuerySource(localInit, depth + 1);

    const fn = findParamFunction(unwrapped);
    if (!fn || !isCallableNode(fn)) return null;
    const paramName = unwrapped.getText();
    const paramDecl = fn.getParameter(paramName);
    const paramInit = paramDecl?.getInitializer();
    if (paramInit && classifyQuerySource(paramInit, depth + 1)) {
      return 'href';
    }

    const body = fn.getBody();
    if (Node.isBlock(body)) {
      const assignsLocationHref = body.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((bin) => {
        const assign = getAssignment(bin);
        if (
          !assign ||
          (assign.operator !== SyntaxKind.EqualsToken &&
            assign.operator !== SyntaxKind.BarBarEqualsToken &&
            assign.operator !== SyntaxKind.QuestionQuestionEqualsToken)
        ) {
          return false;
        }
        const lhs = unwrapExpression(assign.left);
        if (!Node.isIdentifier(lhs) || lhs.getText() !== paramName) return false;
        if (paramDecl && !resolvesToBinding(lhs, paramDecl)) return false;
        return classifyLocationProperty(assign.right) === 'href';
      });
      if (assignsLocationHref) return 'href';
    }
    return null;
  }

  if (Node.isElementAccessExpression(unwrapped)) {
    const splitCall = unwrapStrictMethod(resolveLocalExpression(unwrapped.getExpression(), 1), 'split');
    if (
      splitCall &&
      getStaticNumber(unwrapped.getArgumentExpression()) === 1 &&
      getStaticString(splitCall.args[0]) === '?'
    ) {
      return toQuerySource(classifyQuerySource(splitCall.receiver, depth + 1));
    }
    return null;
  }

  const method = unwrapStrictMethod(unwrapped);
  if (!method) return null;
  const baseSrc = classifyQuerySource(method.receiver, depth + 1);
  if (!baseSrc) return null;

  if (method.methodName === 'slice' || method.methodName === 'substring' || method.methodName === 'substr') {
    const arg0 = method.args[0] ? unwrapExpression(method.args[0]) : undefined;
    if ((baseSrc !== 'href' || trimmedHrefPrefix) && getStaticNumber(arg0) === 1) {
      return toQuerySource(baseSrc);
    }
    if (
      arg0 &&
      Node.isBinaryExpression(arg0) &&
      arg0.getOperatorToken().getKind() === SyntaxKind.PlusToken &&
      getStaticNumber(arg0.getRight()) === 1
    ) {
      const indexOfCall = unwrapStrictMethod(resolveLocalExpression(arg0.getLeft(), 1), 'indexOf');
      if (indexOfCall && getStaticString(indexOfCall.args[0]) === '?' && classifyQuerySource(indexOfCall.receiver, depth + 1)) {
        return toQuerySource(baseSrc);
      }
    }
    return null;
  }

  if (method.methodName === 'replace' && baseSrc !== 'href' && getStaticString(method.args[1]) === '') {
    const patternStr = getStaticString(method.args[0]);
    const regexStr = getRegexSource(method.args[0]);
    if (patternStr === '?' || regexStr === '^\\?' || regexStr === '\\?') {
      return baseSrc;
    }
  }
  return null;
}

const EQUALS_PAIR_METHODS = new Set(['split', 'indexOf', 'lastIndexOf']);
const BRACKET_INSPECT_METHODS = new Set(['split', 'includes', 'indexOf', 'lastIndexOf', 'endsWith']);

function hasEqualsConsumer(call: CallExpression): boolean {
  const scope = getSearchScope(call);
  return scope.getDescendantsOfKind(SyntaxKind.CallExpression).some((desc) => {
    const method = unwrapStrictMethod(desc);
    if (!method) return false;
    const arg0 = method.args[0];
    if (EQUALS_PAIR_METHODS.has(method.methodName)) {
      return getStaticString(arg0) === '=';
    }
    if (method.methodName === 'search') {
      return getStaticString(arg0) === '=' || Boolean(getRegexSource(arg0)?.includes('='));
    }
    return false;
  });
}

function isHybridArrayMap(scope: Node): boolean {
  const emptyArrayVars: { name: string; decl?: VariableDeclaration }[] = [];

  for (const decl of scope.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const init = decl.getInitializer();
    const unwrappedInit = init ? unwrapExpression(init) : undefined;
    if (
      unwrappedInit &&
      Node.isArrayLiteralExpression(unwrappedInit) &&
      unwrappedInit.getElements().length === 0
    ) {
      const nameNode = decl.getNameNode();
      if (Node.isIdentifier(nameNode)) {
        emptyArrayVars.push({ name: nameNode.getText(), decl });
      }
    }
  }

  for (const bin of scope.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    const assign = getAssignment(bin);
    if (!assign || assign.operator !== SyntaxKind.EqualsToken) continue;
    const lhs = unwrapExpression(assign.left);
    const rhs = unwrapExpression(assign.right);
    if (
      Node.isIdentifier(lhs) &&
      Node.isArrayLiteralExpression(rhs) &&
      rhs.getElements().length === 0
    ) {
      emptyArrayVars.push({ name: lhs.getText() });
    }
  }

  if (emptyArrayVars.length === 0) return false;

  return scope.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((bin) => {
    const assign = getAssignment(bin);
    if (!assign || assign.operator !== SyntaxKind.EqualsToken) return false;
    const lhs = unwrapExpression(assign.left);
    if (!Node.isElementAccessExpression(lhs)) return false;
    const receiver = unwrapExpression(lhs.getExpression());
    if (!Node.isIdentifier(receiver) || !isIdentifierReference(receiver)) return false;
    const recvName = receiver.getText();
    return emptyArrayVars.some(
      (entry) =>
        entry.name === recvName && (!entry.decl || resolvesToBinding(receiver, entry.decl)),
    );
  });
}

function isDisqualified(call: CallExpression): boolean {
  const scope = getSearchScope(call);

  const redefinesUrlSearchParams =
    scope.getDescendantsOfKind(SyntaxKind.FunctionDeclaration).some((fn) => fn.getName() === 'URLSearchParams') ||
    scope.getDescendantsOfKind(SyntaxKind.ClassDeclaration).some((cls) => cls.getName() === 'URLSearchParams') ||
    scope.getDescendantsOfKind(SyntaxKind.VariableDeclaration).some((v) => v.getName() === 'URLSearchParams') ||
    scope.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((bin) => {
      const assign = getAssignment(bin);
      if (!assign) return false;
      const lhs = unwrapExpression(assign.left);
      if (Node.isIdentifier(lhs) && lhs.getText() === 'URLSearchParams') return true;
      return getMemberAccess(lhs)?.name === 'URLSearchParams';
    });
  if (redefinesUrlSearchParams) return true;

  const hasTryDecode = scope.getDescendantsOfKind(SyntaxKind.TryStatement).some((tryStmt) =>
    tryStmt
      .getTryBlock()
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .some(
        (c) =>
          isGlobalReference(c.getExpression(), 'decodeURI') ||
          isGlobalReference(c.getExpression(), 'decodeURIComponent'),
      ),
  );
  if (hasTryDecode) return true;

  const checksBracketKeys = scope.getDescendantsOfKind(SyntaxKind.CallExpression).some((desc) => {
    const method = unwrapStrictMethod(desc);
    if (!method || !BRACKET_INSPECT_METHODS.has(method.methodName)) return false;
    const argStr = getStaticString(method.args[0]);
    return Boolean(argStr && (argStr.includes('[') || argStr.includes(']')));
  });
  if (checksBracketKeys) return true;

  return isHybridArrayMap(scope);
}

function matchQueryCall(call: CallExpression): string | null {
  const method = unwrapStrictMethod(call);
  if (!method) return null;
  const { methodName, receiver, args } = method;
  const arg0 = args[0] ? unwrapExpression(args[0]) : undefined;
  const arg1 = args[1] ? unwrapExpression(args[1]) : undefined;

  if (methodName === 'split') {
    const argStr = getStaticString(arg0);
    const argRegex = getRegexSource(arg0);
    if (!arg0 || argStr?.includes(';') || argRegex?.includes(';')) return null;

    const isKeyPrefixSplit =
      argStr !== null ? /^[a-zA-Z0-9_.\-[\]]+=$/.test(argStr) : resolveStaticText(arg0).endsWith('=');
    const isAmpSplit = argStr === '&' || Boolean(argRegex?.includes('&'));
    const src =
      isAmpSplit || argStr === '=' || isKeyPrefixSplit ? classifyQuerySource(receiver) : null;
    if (!src || (!isKeyPrefixSplit && src === 'href')) return null;

    if (
      isKeyPrefixSplit &&
      !getSearchScope(call)
        .getDescendantsOfKind(SyntaxKind.ElementAccessExpression)
        .some((el) => getStaticNumber(el.getArgumentExpression()) === 1)
    ) {
      return null;
    }
    if (isAmpSplit && !hasEqualsConsumer(call)) return null;
    return msgFor(src);
  }

  if (methodName !== 'match' && methodName !== 'replace' && methodName !== 'exec') return null;
  const targetNode = methodName === 'exec' ? arg0 : receiver;
  const regexArg = methodName === 'exec' ? receiver : arg0;

  if (methodName === 'replace') {
    const callback = arg1 ? resolveCallableNode(arg1, 1) : undefined;
    if (!callback || !isCallableNode(callback)) return null;
    const body = callback.getBody();
    const isStatement = Node.isExpressionStatement(getSemanticParent(call).parent);
    const hasReturnStmt =
      Node.isBlock(body) && body.getDescendantsOfKind(SyntaxKind.ReturnStatement).length > 0;
    if (!isStatement && (!Node.isBlock(body) || hasReturnStmt)) {
      return null;
    }
  }

  const resolvedRegex = regexArg ? resolveLocalExpression(regexArg, 2) : undefined;
  let pattern = getRegexSource(resolvedRegex) ?? '';
  if (
    !pattern &&
    resolvedRegex &&
    (Node.isNewExpression(resolvedRegex) || Node.isCallExpression(resolvedRegex)) &&
    isGlobalReference(resolvedRegex.getExpression(), 'RegExp')
  ) {
    pattern = resolveStaticText(resolvedRegex.getArguments()[0]);
  }

  if (!targetNode || !pattern || (methodName === 'replace' && !pattern.includes('='))) return null;
  const src = classifyQuerySource(targetNode);
  if (!src || pattern.includes(';')) return null;

  const withoutNegatedHash = pattern.replace(/\[\^[^\]]*#[^\]]*\]/g, '');
  const outsideCharClasses = pattern.replace(/\[(?:\\.|[^\]])*\]/g, '');
  if (
    withoutNegatedHash.includes('#') &&
    (!/^[^#]*=/.test(withoutNegatedHash) || /\[[^\]]*#|#(?![)|$])/.test(withoutNegatedHash))
  ) {
    return null;
  }
  if (
    src === 'href' &&
    (pattern.includes('\\/') || outsideCharClasses.includes('/') || !/\[[^\]]*\?[^\]]*\]|\\\?/.test(pattern))
  ) {
    return null;
  }

  const corePattern = outsideCharClasses.replace(/\(\?(?:<[=!]|[=!:])/g, '');
  const hasCaptureGroupAfterEquals =
    methodName === 'replace' ||
    corePattern
      .split('=')
      .slice(1)
      .some((part) => /^[^)]*\(/.test(part));
  return corePattern.includes('=') && hasCaptureGroupAfterEquals ? msgFor(src) : null;
}

export const jsUrlSearchParamsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: [['location'], ['.search', '.href'], ['.split(', '.match(', '.exec(', '.replace(']],
  featureGuardTokens: ['URLSearchParams'],
  dedupeLines: true,
  matchCall(call) {
    const msg = matchQueryCall(call);
    return msg && !isDisqualified(call) ? msg : null;
  },
});

export const jsUrlSearchParamsRule: AnalyzerRule = {
  id: 'js/url-search-params',
  guideId: 'js',
  guideHash: JS_GUIDE_HASH,
  summary: 'Replace hand-rolled query-string parsing on location.search or location.href with URLSearchParams.',
  matcher: jsUrlSearchParamsMatcher,
  verifierRubric: {
    keepWhen: [
      'The code manually extracts query parameter values from location.search, location.href, or a url parameter defaulting to location via .split("&") paired with "=" pair splitting or slicing, .split("="), .split("key=")[1], or value-extracting regex calls (.exec, .match, callback .replace).',
      'Standard & and = query semantics apply so new URLSearchParams(location.search), new URL(url, location.href).searchParams, or Object.fromEntries(new URLSearchParams(location.search)) (for plain single-value object maps where last value wins) preserves caller behavior.',
    ],
    dropWhen: [
      'The code only strips, forwards, or checks emptiness of location.search, performs boolean presence checks (.includes, .indexOf, .search, regex.test, valueless flag .match), or extracts origin, pathname, or hash from location.href without parsing parameter values (e.g. location.href.split("?")[0] or url + location.search).',
      'The input is a full URL string passed directly into new URLSearchParams(str) rather than new URL(str, location.href).searchParams, or parses location.hash (#a=1), hash routes (#/path?a=1), conditional fallbacks to location.hash (location.search || location.hash), or multiple leading question marks (??a=1).',
      'The input consists of unkeyed search payloads (?en, ?DNR:...), unkeyed .split("&") token membership checks without "=" pair parsing, or uses a custom delimiter such as semicolon (";").',
      'The code is inside an explicit URLSearchParams feature guard (such as typeof URLSearchParams or "URLSearchParams" in window) or a legacy browser-version / user-agent conditional fallback branch (such as isIE or navigator.userAgent / MSIE checks), defines or loads a URLSearchParams polyfill, or wraps decodeURIComponent in try/catch to reject malformed percent-encoding.',
      'Callers rely on semantics where URLSearchParams differs: preserving unencoded literal "+" characters (email subaddresses, timezone offsets, Base64 strings) rather than decoding "+" to space, distinguishing valueless flags (?flag -> undefined) from empty values (?flag= -> ""), single-key lookups requiring last-value-wins on repeated keys (unlike plain object map loops which use Object.fromEntries), or bracket/hybrid array-and-map structures (?tag[]=a, ?user[name]=alice, getUrlVars arrays).',
    ],
  },
};

export default [jsUrlSearchParamsRule] satisfies readonly AnalyzerRule[];
