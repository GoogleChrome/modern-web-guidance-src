import {
  Node,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const CONTENT_BASED_STYLING_GUIDE_HASH = 'c85aa3bb7bf7';

const CONTENT_MODIFIER_CLASS_REGEX =
  /^(?:[a-z0-9_-]+--)?(?:has-[a-z0-9_-]+|with-[a-z0-9_-]+|no-[a-z0-9_-]+|without-[a-z0-9_-]+|(?:[a-z0-9_-]+-)?empty)$/i;

const FORM_EVENT_NAMES = new Set([
  'focus',
  'blur',
  'focusin',
  'focusout',
  'change',
  'input',
]);

function isEnclosedInFormEventHandler(node: Node): boolean {
  let current: Node | undefined = node.getParent();
  while (current && !Node.isSourceFile(current)) {
    if (Node.isCallExpression(current)) {
      const expr = unwrapExpression(current.getExpression());
      if (Node.isPropertyAccessExpression(expr)) {
        const method = expr.getName();
        if (FORM_EVENT_NAMES.has(method)) {
          return true;
        }
        if (method === 'addEventListener' || method === 'on' || method === 'bind') {
          const args = current.getArguments();
          if (args.length > 0) {
            const first = unwrapExpression(args[0]);
            if (
              Node.isStringLiteral(first) &&
              FORM_EVENT_NAMES.has(first.getLiteralText().toLowerCase().trim())
            ) {
              return true;
            }
          }
        }
      }
    }
    current = current.getParent();
  }
  return false;
}

function refersToParentNavigation(node: Node, depth = 0): boolean {
  if (depth > 4) {
    return false;
  }
  const unwrapped = unwrapExpression(node);
  if (Node.isPropertyAccessExpression(unwrapped)) {
    const name = unwrapped.getName();
    if (name === 'parentElement' || name === 'parentNode') {
      return true;
    }
  }
  if (Node.isCallExpression(unwrapped)) {
    const expr = unwrapExpression(unwrapped.getExpression());
    if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'closest') {
      return true;
    }
  }
  if (Node.isIdentifier(unwrapped)) {
    const resolved = resolveLocalExpression(unwrapped);
    if (resolved !== unwrapped) {
      return refersToParentNavigation(resolved, depth + 1);
    }
  }
  return false;
}

function extractChildInspectionContainer(
  condNode: Node,
  depth = 0,
): string | undefined {
  if (depth > 4) {
    return undefined;
  }
  const unwrapped = unwrapExpression(condNode);

  if (Node.isPrefixUnaryExpression(unwrapped)) {
    return extractChildInspectionContainer(unwrapped.getOperand(), depth + 1);
  }

  if (Node.isCallExpression(unwrapped)) {
    const callee = unwrapExpression(unwrapped.getExpression());
    if (Node.isIdentifier(callee) && callee.getText() === 'Boolean') {
      const args = unwrapped.getArguments();
      return args.length > 0
        ? extractChildInspectionContainer(args[0], depth + 1)
        : undefined;
    }
    if (
      Node.isPropertyAccessExpression(callee) &&
      (callee.getName() === 'querySelector' || callee.getName() === 'querySelectorAll')
    ) {
      const args = unwrapped.getArguments();
      if (args.length === 1 && Node.isStringLiteral(unwrapExpression(args[0]))) {
        return unwrapExpression(callee.getExpression()).getText();
      }
    }
  }

  if (Node.isBinaryExpression(unwrapped)) {
    const left = unwrapExpression(unwrapped.getLeft());
    const right = unwrapExpression(unwrapped.getRight());
    return (
      extractChildInspectionContainer(left, depth + 1) ??
      extractChildInspectionContainer(right, depth + 1)
    );
  }

  if (Node.isPropertyAccessExpression(unwrapped)) {
    const propName = unwrapped.getName();
    if (propName === 'childElementCount') {
      return unwrapExpression(unwrapped.getExpression()).getText();
    }
    if (propName === 'length') {
      const inner = unwrapExpression(unwrapped.getExpression());
      if (Node.isPropertyAccessExpression(inner) && inner.getName() === 'children') {
        return unwrapExpression(inner.getExpression()).getText();
      }
      if (Node.isCallExpression(inner)) {
        const innerCallee = unwrapExpression(inner.getExpression());
        if (
          Node.isPropertyAccessExpression(innerCallee) &&
          innerCallee.getName() === 'querySelectorAll'
        ) {
          return unwrapExpression(innerCallee.getExpression()).getText();
        }
      }
    }
  }

  if (Node.isIdentifier(unwrapped)) {
    const resolved = resolveLocalExpression(unwrapped);
    if (resolved !== unwrapped) {
      return extractChildInspectionContainer(resolved, depth + 1);
    }
  }

  return undefined;
}

function getSingleClassListCallInStatement(stmt: Node): CallExpression | undefined {
  if (Node.isExpressionStatement(stmt)) {
    const expr = unwrapExpression(stmt.getExpression());
    return Node.isCallExpression(expr) ? expr : undefined;
  }
  if (Node.isBlock(stmt)) {
    const stmts = stmt.getStatements();
    if (stmts.length !== 1) {
      return undefined;
    }
    return getSingleClassListCallInStatement(stmts[0]);
  }
  return undefined;
}

function containersMatch(actual: string, expected: string): boolean {
  if (actual === expected) {
    return true;
  }
  if (actual.startsWith('this.') && expected.startsWith('this.')) {
    return true;
  }
  return false;
}

function isMatchingContentClassListCall(
  call: CallExpression,
  expectedContainerText?: string,
): boolean {
  const expr = unwrapExpression(call.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return false;
  }
  const method = expr.getName();
  if (method !== 'add' && method !== 'remove' && method !== 'toggle') {
    return false;
  }
  const classListObj = unwrapExpression(expr.getExpression());
  if (!Node.isPropertyAccessExpression(classListObj) || classListObj.getName() !== 'classList') {
    return false;
  }
  const container = unwrapExpression(classListObj.getExpression());
  // Carve out parent navigation owned by child-state-based-styling/js-parent-class
  if (refersToParentNavigation(container)) {
    return false;
  }
  if (
    expectedContainerText &&
    !containersMatch(container.getText(), expectedContainerText)
  ) {
    return false;
  }
  const args = call.getArguments();
  if (args.length === 0) {
    return false;
  }
  const firstArg = unwrapExpression(args[0]);
  if (!Node.isStringLiteral(firstArg)) {
    return false;
  }
  return CONTENT_MODIFIER_CLASS_REGEX.test(firstArg.getLiteralText().trim());
}

const contentBasedStylingJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    'childElementCount',
    '.children.length',
    "('has-",
    '("has-',
    "( 'has-",
    '( "has-',
    "('with-",
    '("with-',
    "( 'with-",
    '( "with-',
    "('no-",
    '("no-',
    "('without-",
    '("without-',
    "('is-empty",
    '("is-empty',
    "('empty'",
    '("empty"',
    "-empty'",
    '-empty"',
    '--has-',
    '--with-',
    '--no-',
  ],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    if (
      !ctx.fileContent.includes('classList') ||
      (!ctx.fileContent.includes('querySelector') &&
        !ctx.fileContent.includes('children') &&
        !ctx.fileContent.includes('childElementCount'))
    ) {
      return matches;
    }
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      let matchedNode: Node | undefined;

      if (Node.isIfStatement(node)) {
        const thenCall = getSingleClassListCallInStatement(node.getThenStatement());
        if (!thenCall || !isMatchingContentClassListCall(thenCall)) {
          return;
        }
        const containerText = extractChildInspectionContainer(node.getExpression());
        if (!containerText || !isMatchingContentClassListCall(thenCall, containerText)) {
          return;
        }
        const elseStmt = node.getElseStatement();
        if (elseStmt) {
          const elseCall = getSingleClassListCallInStatement(elseStmt);
          if (!elseCall || !isMatchingContentClassListCall(elseCall, containerText)) {
            return;
          }
        }
        matchedNode = thenCall;
      } else if (Node.isCallExpression(node)) {
        const args = node.getArguments();
        if (args.length === 2 && isMatchingContentClassListCall(node)) {
          const expr = unwrapExpression(node.getExpression());
          if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'toggle') {
            const classListObj = unwrapExpression(expr.getExpression());
            if (Node.isPropertyAccessExpression(classListObj)) {
              const receiverText = unwrapExpression(classListObj.getExpression()).getText();
              const condContainer = extractChildInspectionContainer(args[1]);
              if (condContainer && containersMatch(receiverText, condContainer)) {
                matchedNode = node;
              }
            }
          }
        }
      }

      if (!matchedNode) {
        return;
      }
      if (isEnclosedInFormEventHandler(matchedNode)) {
        return;
      }
      if (isProtectedByFeatureGuard(matchedNode, [':has', 'has(', 'selector('])) {
        return;
      }

      const line = matchedNode.getStartLineNumber();
      if (!visitedLines.has(line)) {
        visitedLines.add(line);
        matches.push({
          line,
          message:
            'JavaScript checks child element presence (querySelector / children.length) to toggle a content modifier class; use CSS :has() or :empty on the container instead.',
        });
      }
    });

    return matches;
  },
};

export const contentBasedStylingRule: AnalyzerRule = {
  id: 'content-based-styling',
  guideId: 'content-based-styling',
  guideHash: CONTENT_BASED_STYLING_GUIDE_HASH,
  summary:
    'Replace JavaScript DOM queries that toggle container modifier classes based on child element presence (such as .has-image or .is-empty) with declarative CSS :has() and :empty selectors.',
  matcher: contentBasedStylingJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript inspects a container element for child element presence (via querySelector, children.length, or childElementCount) solely to add or toggle a content modifier class (such as has-image, has-icon, or is-empty) on that container.',
      'The container layout variation can be expressed declaratively in CSS using :has() or :empty without main-thread DOM queries.',
    ],
    dropWhen: [
      'The script is guarded by !CSS.supports("selector(:has(*))") as an explicit fallback for older browsers.',
      'The class toggle is driven by interactive form input events (focus, blur, change, input) or manages application behavior rather than static child content presence.',
    ],
  },
};

export default [
  contentBasedStylingRule,
] satisfies readonly AnalyzerRule[];
