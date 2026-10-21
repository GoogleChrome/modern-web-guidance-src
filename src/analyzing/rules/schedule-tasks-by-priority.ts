import { Node, SyntaxKind, type CallExpression, type SourceFile } from 'ts-morph';
import type { AnalyzerMatch, AnalyzerRule, JsMatcherContext, JsRuleMatcher } from '../schema.ts';
import {
  isProtectedByFeatureGuard,
  isUnshadowedGlobal,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';

export const SCHEDULE_TASKS_BY_PRIORITY_GUIDE_HASH = '69f3bb531093';

const SCHEDULER_POST_TASK_GUARD_TOKENS = ['scheduler', 'postTask'] as const;

/**
 * Checks whether an AST node is inside a class method or declaration.
 */
function isInsideClassMethod(node: Node): boolean {
  let curr: Node | undefined = node.getParent();
  while (curr && !Node.isSourceFile(curr)) {
    if (Node.isClassDeclaration(curr) || Node.isClassExpression(curr)) {
      return true;
    }
    curr = curr.getParent();
  }
  return false;
}

/**
 * Checks whether a call expression is requestIdleCallback(...) or window.requestIdleCallback(...).
 */
function matchRequestIdleCallback(callExpr: CallExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  let isIdleCallback = false;

  if (Node.isIdentifier(expr)) {
    if (expr.getText() === 'requestIdleCallback' && isUnshadowedGlobal(expr, 'requestIdleCallback')) {
      isIdleCallback = true;
    }
  } else if (Node.isPropertyAccessExpression(expr)) {
    if (expr.getName() === 'requestIdleCallback') {
      const caller = unwrapExpression(expr.getExpression());
      const callerText = caller.getText();
      if (
        callerText === 'window' ||
        callerText === 'globalThis' ||
        callerText === 'self'
      ) {
        isIdleCallback = true;
      } else if (callerText === 'this' && !isInsideClassMethod(callExpr)) {
        isIdleCallback = true;
      }
    }
  }

  if (!isIdleCallback) {
    return null;
  }

  if (isProtectedByFeatureGuard(callExpr, SCHEDULER_POST_TASK_GUARD_TOKENS)) {
    return null;
  }

  return {
    line: callExpr.getStartLineNumber(),
    message:
      "Legacy requestIdleCallback used to schedule low-priority background work instead of scheduler.postTask(callback, { priority: 'background' }).",
  };
}

export const scheduleTasksByPriorityMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['requestIdleCallback'],
  matchFile(sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const callExpr of callExpressions) {
      const match = matchRequestIdleCallback(callExpr);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  },
};

export const scheduleTasksByPriorityRule: AnalyzerRule = {
  id: 'schedule-tasks-by-priority',
  guideId: 'schedule-tasks-by-priority',
  guideHash: SCHEDULE_TASKS_BY_PRIORITY_GUIDE_HASH,
  summary:
    'Flag requestIdleCallback calls used to schedule low-priority background work instead of modern prioritized task scheduling via scheduler.postTask(callback, { priority: "background" }).',
  matcher: scheduleTasksByPriorityMatcher,
  phase2Rubric: {
    keepWhen: [
      'Scheduling low-priority background work or idle tasks using requestIdleCallback(...) or window.requestIdleCallback(...) instead of scheduler.postTask(..., { priority: "background" }).',
      'Utility wrappers or deferred queues (e.g. callWhenIdle, runOnIdle) delegating task execution to requestIdleCallback without scheduler priority controls.',
    ],
    dropWhen: [
      'Calls protected by feature detection for scheduler.postTask (e.g. if ("scheduler" in window && "postTask" in window.scheduler) { scheduler.postTask(...) } else { requestIdleCallback(...) }).',
      'Polyfill definitions or shims implementing requestIdleCallback itself using setTimeout.',
      'High-priority animation loops or immediate input handling using requestAnimationFrame instead of idle scheduling.',
    ],
  },
};

/**
 * Whole module retired per O8b audit (rIC has deadline/timeout semantics, not 1:1 with postTask).
 */
export const scheduleTasksByPriorityRules: readonly AnalyzerRule[] = [];
