import {
  Node,
  SyntaxKind,
  type BinaryExpression,
  type PropertyAccessExpression,
  type SourceFile,
} from 'ts-morph';
import type { AnalyzerMatch, AnalyzerRule, JsMatcherContext, JsRuleMatcher } from '../schema.ts';
import { unwrapExpression } from '../scanners/ast-helpers.ts';

export const DETECT_INITIAL_VISIBILITY_STATE_GUIDE_HASH = 'b881da0b6ea2';

const VENDOR_VISIBILITY_PROPERTIES = new Set([
  'webkitHidden',
  'mozHidden',
  'msHidden',
  'webkitVisibilityState',
  'mozVisibilityState',
  'msVisibilityState',
]);

const INITIAL_VAR_REGEX = /initial|wasHidden|hiddenAtLoad|backgroundLoad|startedHidden/i;

const STANDARD_VISIBILITY_PROPERTIES = new Set(['visibilityState', 'hidden']);

/**
 * Checks whether an expression references document or window.document.
 */
function isDocumentTarget(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  const text = unwrapped.getText();
  return (
    text === 'document' ||
    text === 'window.document' ||
    text === 'globalThis.document' ||
    text === 'this.document' ||
    text === 'doc' ||
    text === 'd'
  );
}

/**
 * Checks whether an expression accesses document.visibilityState or document.hidden.
 */
function expressionAccessesDocumentVisibility(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  if (Node.isPropertyAccessExpression(unwrapped)) {
    if (
      STANDARD_VISIBILITY_PROPERTIES.has(unwrapped.getName()) &&
      isDocumentTarget(unwrapped.getExpression())
    ) {
      return true;
    }
  }

  const descendants = unwrapped.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
  for (const desc of descendants) {
    if (
      STANDARD_VISIBILITY_PROPERTIES.has(desc.getName()) &&
      isDocumentTarget(desc.getExpression())
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether the source file registers a visibilitychange listener.
 */
function hasVisibilityChangeListener(sourceFile: SourceFile): boolean {
  const fullText = sourceFile.getFullText();
  if (!fullText.toLowerCase().includes('visibilitychange')) {
    return false;
  }

  const callExprs = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of callExprs) {
    const expr = unwrapExpression(call.getExpression());
    if (Node.isPropertyAccessExpression(expr)) {
      const methodName = expr.getName();
      if (
        methodName === 'addEventListener' ||
        methodName === 'on' ||
        methodName === 'addListener' ||
        methodName === 'bind'
      ) {
        const args = call.getArguments();
        if (args.length > 0) {
          const firstArg = unwrapExpression(args[0]);
          if (
            (Node.isStringLiteral(firstArg) || Node.isNoSubstitutionTemplateLiteral(firstArg)) &&
            firstArg.getLiteralText().toLowerCase().includes('visibilitychange')
          ) {
            return true;
          }
        }
      }
    }
  }

  const propAccesses = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
  for (const prop of propAccesses) {
    if (prop.getName().toLowerCase() === 'onvisibilitychange') {
      return true;
    }
  }

  return false;
}

/**
 * Checks for document.webkitHidden, document.mozHidden, document.msHidden,
 * or document.webkitVisibilityState.
 */
function matchVendorPropertyAccess(propAccess: PropertyAccessExpression): AnalyzerMatch | null {
  const propName = propAccess.getName();
  if (!VENDOR_VISIBILITY_PROPERTIES.has(propName)) {
    return null;
  }

  const caller = propAccess.getExpression();
  if (!isDocumentTarget(caller)) {
    return null;
  }

  return {
    line: propAccess.getStartLineNumber(),
    message: `Accessing deprecated vendor-prefixed 'document.${propName}'; use standard Page Visibility API and performance.getEntriesByType('visibility-state') to reliably detect initial background state.`,
  };
}

/**
 * Checks for `'webkitHidden' in document` or vendor equivalents.
 */
function matchVendorInExpression(binaryExpr: BinaryExpression): AnalyzerMatch | null {
  if (binaryExpr.getOperatorToken().getKind() !== SyntaxKind.InKeyword) {
    return null;
  }

  const left = unwrapExpression(binaryExpr.getLeft());
  if (!Node.isStringLiteral(left) && !Node.isNoSubstitutionTemplateLiteral(left)) {
    return null;
  }

  const propName = left.getLiteralText();
  if (!VENDOR_VISIBILITY_PROPERTIES.has(propName)) {
    return null;
  }

  const right = binaryExpr.getRight();
  if (!isDocumentTarget(right)) {
    return null;
  }

  return {
    line: binaryExpr.getStartLineNumber(),
    message: `Checking deprecated vendor-prefixed '${propName}' in document; use standard Page Visibility API and performance.getEntriesByType('visibility-state') to reliably detect initial background state.`,
  };
}

export const detectInitialVisibilityStateMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    'webkitHidden',
    'mozHidden',
    'msHidden',
    'webkitVisibilityState',
    'mozVisibilityState',
    'msVisibilityState',
    'visibilitychange',
  ],
  matchFile(sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] {
    const fullText = sourceFile.getFullText();

    // If file references modern VisibilityStateEntry or performance.getEntriesByType('visibility-state'), drop it
    if (
      fullText.includes('VisibilityStateEntry') ||
      fullText.includes('visibility-state')
    ) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];

    // Condition A: Vendor-prefixed properties
    const propAccesses = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
    for (const propAccess of propAccesses) {
      const match = matchVendorPropertyAccess(propAccess);
      if (match) {
        matches.push(match);
      }
    }

    const binaryExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    for (const binExpr of binaryExpressions) {
      const match = matchVendorInExpression(binExpr);
      if (match) {
        matches.push(match);
      }
    }

    // Condition B: Assigns document.visibilityState or document.hidden to an initial/load variable
    // alongside a visibilitychange event listener
    if (hasVisibilityChangeListener(sourceFile)) {
      // 1. Variable declarations: const wasHidden = document.visibilityState === 'hidden'
      const varDecls = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
      for (const varDecl of varDecls) {
        const name = varDecl.getName();
        if (INITIAL_VAR_REGEX.test(name)) {
          const init = varDecl.getInitializer();
          if (init && expressionAccessesDocumentVisibility(init)) {
            matches.push({
              line: varDecl.getStartLineNumber(),
              message: `Assigning initial document visibility state to '${name}' alongside a 'visibilitychange' listener; use VisibilityStateEntry via performance.getEntriesByType('visibility-state') to reliably detect if the page was loaded in the background.`,
            });
          }
        }
      }

      // 2. Binary assignment expressions: this.wasHidden = document.hidden
      for (const binExpr of binaryExpressions) {
        if (binExpr.getOperatorToken().getKind() === SyntaxKind.EqualsToken) {
          const left = binExpr.getLeft();
          let targetName: string | null = null;
          if (Node.isIdentifier(left)) {
            targetName = left.getText();
          } else if (Node.isPropertyAccessExpression(left)) {
            targetName = left.getName();
          }

          if (targetName && INITIAL_VAR_REGEX.test(targetName)) {
            const right = binExpr.getRight();
            if (expressionAccessesDocumentVisibility(right)) {
              matches.push({
                line: binExpr.getStartLineNumber(),
                message: `Assigning initial document visibility state to '${targetName}' alongside a 'visibilitychange' listener; use VisibilityStateEntry via performance.getEntriesByType('visibility-state') to reliably detect if the page was loaded in the background.`,
              });
            }
          }
        }
      }

      // 3. Object literal property assignments: { wasHidden: document.hidden }
      const propAssignments = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment);
      for (const propAssign of propAssignments) {
        const name = propAssign.getName();
        if (INITIAL_VAR_REGEX.test(name)) {
          const init = propAssign.getInitializer();
          if (init && expressionAccessesDocumentVisibility(init)) {
            matches.push({
              line: propAssign.getStartLineNumber(),
              message: `Assigning initial document visibility state to '${name}' alongside a 'visibilitychange' listener; use VisibilityStateEntry via performance.getEntriesByType('visibility-state') to reliably detect if the page was loaded in the background.`,
            });
          }
        }
      }

      // 4. Class property declarations: wasHidden = document.hidden
      const propDecls = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyDeclaration);
      for (const propDecl of propDecls) {
        const name = propDecl.getName();
        if (INITIAL_VAR_REGEX.test(name)) {
          const init = propDecl.getInitializer();
          if (init && expressionAccessesDocumentVisibility(init)) {
            matches.push({
              line: propDecl.getStartLineNumber(),
              message: `Assigning initial document visibility state to '${name}' alongside a 'visibilitychange' listener; use VisibilityStateEntry via performance.getEntriesByType('visibility-state') to reliably detect if the page was loaded in the background.`,
            });
          }
        }
      }
    }

    return matches;
  },
};

export const detectInitialVisibilityStateRule: AnalyzerRule = {
  id: 'detect-initial-visibility-state',
  guideId: 'detect-initial-visibility-state',
  guideHash: DETECT_INITIAL_VISIBILITY_STATE_GUIDE_HASH,
  summary:
    'Flag checking vendor-prefixed Page Visibility properties or capturing initial background state via document.visibilityState/hidden variables alongside visibilitychange listeners without VisibilityStateEntry.',
  matcher: detectInitialVisibilityStateMatcher,
  phase2Rubric: {
    keepWhen: [
      'Assigning document.visibilityState or document.hidden to an initial/load-time variable (e.g. wasHidden, initialVisibility, hiddenAtLoad) combined with a visibilitychange event listener to detect initial background tab state.',
      'Legacy vendor-prefixed Page Visibility properties (document.webkitHidden, mozHidden, msHidden, webkitVisibilityState) used to detect visibility.',
    ],
    dropWhen: [
      'Ordinary runtime visibilitychange listeners that pause/resume media, mute audio, or stop animations based on current document.hidden without attempting to detect initial load-time background state.',
      'Code already querying the modern Performance Timeline via performance.getEntriesByType("visibility-state") or checking "VisibilityStateEntry" in window.',
      'Custom non-DOM objects with visibilityState or hidden properties unrelated to the document Page Visibility API.',
    ],
  },
};

export const detectInitialVisibilityStateRules: readonly AnalyzerRule[] = [
  detectInitialVisibilityStateRule,
];
