import fs from 'node:fs';
import path from 'node:path';
import { Project, SyntaxKind, Node, type SourceFile, type Node as TsMorphNode } from 'ts-morph';
import { resolveFeatureOrBcdBaseline } from './baseline.ts';
import { GRADER_FILE, TARGETS_DIR } from './guide-validation.ts';
import { rootDir } from './paths.ts';

const MAX_SNIPPET_LENGTH = 120;

/**
 * Rule registry for grader static checks (aligned with The 8 Red Lines in project-evals).
 * `blocking` rules fail CI via `checkAllGraders()`; non-blocking rules are tracked via a legacy
 * allowlist/ratchet or advisory reporting until existing graders are updated.
 */
export const GRADER_RULES = {
  'no-vacuous-boolean-expect': { redLine: 1, blocking: true },
  'no-tautological-expect': { redLine: 1, blocking: true },
  'no-test-skip': { redLine: 1, blocking: true },
  'no-gen2-file-goto': { redLine: 1, blocking: true },
  'no-unguarded-conditional-assertions': { redLine: 1, blocking: true },
  'invalid-skip-unless': { redLine: 1, blocking: true },
  'no-early-return-before-assertion': { redLine: 1, blocking: true },
  'no-unguarded-every': { redLine: 1, blocking: true },
  'no-swallowed-assertion': { redLine: 1, blocking: true },
  'no-absent-or-correct': { redLine: 1, blocking: false },
  'no-fixed-timeout': { redLine: 1, blocking: false },
} as const satisfies Record<string, { redLine: number; blocking: boolean }>;

export type GraderRuleId = keyof typeof GRADER_RULES;

export interface GraderLintViolation {
  filePath: string;
  line: number;
  column: number;
  ruleId: GraderRuleId;
  message: string;
  snippet?: string;
}

export function isGraderFile(filePath: string): boolean {
  return path.posix.basename(filePath.replace(/\\/g, '/')) === GRADER_FILE;
}

export function isGen2Grader(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  if (path.posix.basename(normalized) !== GRADER_FILE) return false;
  const targetDir = path.posix.dirname(normalized);
  return path.posix.basename(path.posix.dirname(targetDir)) === TARGETS_DIR;
}

function constantHelperValue(fn: TsMorphNode, seen: Set<TsMorphNode>): boolean | undefined {
  if (Node.isArrowFunction(fn)) {
    const body = unwrap(fn.getBody());
    if (!Node.isBlock(body)) return vacuousBooleanValue(body, seen);
  }
  if (!Node.isFunctionDeclaration(fn) && !Node.isArrowFunction(fn) && !Node.isFunctionExpression(fn)) return undefined;
  const body = fn.getBody();
  if (!body || !Node.isBlock(body)) return undefined;
  if (fn.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0) return undefined;
  const stmts = body.getStatements();
  if (stmts.length === 0 || !Node.isReturnStatement(stmts[stmts.length - 1])) return undefined;
  const returns = fn.getDescendantsOfKind(SyntaxKind.ReturnStatement).filter(r => enclosingFunction(r) === fn);
  const values = returns.map(r => {
    const expr = r.getExpression();
    return expr ? vacuousBooleanValue(expr, seen) : undefined;
  });
  if (values.length > 0 && values.every(v => v === true)) return true;
  if (values.length > 0 && values.every(v => v === false)) return false;
  return undefined;
}

function vacuousBooleanValue(node: TsMorphNode, seen: Set<TsMorphNode> = new Set()): boolean | undefined {
  const expr = unwrap(node);
  const kind = expr.getKind();
  if (kind === SyntaxKind.TrueKeyword) return true;
  if (kind === SyntaxKind.FalseKeyword) return false;
  if (Node.isPrefixUnaryExpression(expr) && expr.getOperatorToken() === SyntaxKind.ExclamationToken) {
    const inner = vacuousBooleanValue(expr.getOperand(), seen);
    return inner === undefined ? undefined : !inner;
  }
  if (Node.isCallExpression(expr)) {
    const callee = unwrap(expr.getExpression());
    if (!Node.isIdentifier(callee)) return undefined;
    const decl = callee.getSymbol()?.getDeclarations()[0];
    if (!decl || seen.has(decl)) return undefined;
    seen.add(decl);
    if (Node.isFunctionDeclaration(decl)) return constantHelperValue(decl, seen);
    if (Node.isVariableDeclaration(decl)) {
      const init = decl.getInitializer();
      if (init) return constantHelperValue(unwrap(init), seen);
    }
  }
  return undefined;
}

function isVacuousBoolean(node: TsMorphNode): boolean {
  return vacuousBooleanValue(node) !== undefined;
}

function isAssertionCall(node: TsMorphNode): boolean {
  if (!Node.isCallExpression(node)) return false;
  const expr = node.getExpression().getText();
  if (expr === 'expectNever') return true;
  const isExp = expr === 'expect' || expr.startsWith('expect.');
  const isAss = expr === 'assert' || expr.startsWith('assert.');
  if (!isExp && !isAss) return false;

  // Exclude vacuous expect(true) / expect(false) from counting as a real assertion
  const firstArg = node.getArguments()[0];
  if (firstArg && isVacuousBoolean(firstArg)) {
    return false;
  }
  return true;
}

function isWithinInnerIf(node: TsMorphNode, boundary: TsMorphNode): boolean {
  let curr = node.getParent();
  while (curr && curr !== boundary) {
    if (Node.isIfStatement(curr)) return true;
    curr = curr.getParent();
  }
  return false;
}

function branchGuaranteed(node?: TsMorphNode): boolean {
  if (!node) return false;
  if (Node.isThrowStatement(node) || isAssertionCall(node)) return true;
  if (Node.isIfStatement(node)) {
    return branchGuaranteed(node.getThenStatement()) && branchGuaranteed(node.getElseStatement());
  }

  const hasDirectThrow = node
    .getDescendantsOfKind(SyntaxKind.ThrowStatement)
    .some(t => !isWithinInnerIf(t, node));
  if (hasDirectThrow) return true;

  // Note: hasDirectAssertion treats any assertion outside an inner if as guaranteed to execute,
  // but does not trace early return exits (e.g. `if (!el) return; expect(el)`). A future CFG pass can model exits.
  const hasDirectAssertion = node
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .some(c => isAssertionCall(c) && !isWithinInnerIf(c, node));
  if (hasDirectAssertion) return true;

  return node
    .getDescendantsOfKind(SyntaxKind.IfStatement)
    .some(innerIf => !isWithinInnerIf(innerIf, node) && branchGuaranteed(innerIf));
}

export function checkGraderAst(filePath: string, sourceFile: SourceFile): GraderLintViolation[] {
  const violations: GraderLintViolation[] = [];
  const isGen2 = isGen2Grader(filePath);

  const addViolation = (node: TsMorphNode, ruleId: GraderRuleId, message: string) => {
    const { line, column } = sourceFile.getLineAndColumnAtPos(node.getStart());
    const snippet = node.getText().slice(0, MAX_SNIPPET_LENGTH);
    violations.push({
      filePath,
      line,
      column,
      ruleId,
      message,
      snippet,
    });
  };

  const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

  for (const call of calls) {
    const callee = call.getExpression();
    const exprText = callee.getText();

    // Rule 1: no-vacuous-boolean-expect & Rule 2: no-tautological-expect
    if (exprText === 'expect' || exprText === 'expect.soft') {
      const firstArg = call.getArguments()[0];
      if (firstArg) {
        // Rule 1: Vacuous expect(true) / expect(false)
        if (isVacuousBoolean(firstArg)) {
          addViolation(
            call,
            'no-vacuous-boolean-expect',
            `Vacuous boolean assertion: expect(${firstArg.getText()}) produces a static result. Assert the real condition directly.`
          );
        }

        // Rule 2: Tautological boolean expressions inside expect()
        const binaries = Node.isBinaryExpression(firstArg)
          ? [firstArg, ...firstArg.getDescendantsOfKind(SyntaxKind.BinaryExpression)]
          : firstArg.getDescendantsOfKind(SyntaxKind.BinaryExpression);
        for (const bin of binaries) {
          if (bin.getOperatorToken().getKind() === SyntaxKind.BarBarToken) {
            if (bin.getRight().getKind() === SyntaxKind.TrueKeyword || bin.getLeft().getKind() === SyntaxKind.TrueKeyword) {
              addViolation(
                bin,
                'no-tautological-expect',
                `Tautological boolean expression: "${bin.getText()}" inside expect() always evaluates to truthy.`
              );
            }
          }
        }

        const conditionals = Node.isConditionalExpression(firstArg)
          ? [firstArg, ...firstArg.getDescendantsOfKind(SyntaxKind.ConditionalExpression)]
          : firstArg.getDescendantsOfKind(SyntaxKind.ConditionalExpression);
        for (const cond of conditionals) {
          const whenTrue = cond.getWhenTrue();
          const whenFalse = cond.getWhenFalse();
          if (whenTrue.getKind() === SyntaxKind.TrueKeyword && whenFalse.getKind() === SyntaxKind.TrueKeyword) {
            addViolation(
              cond,
              'no-tautological-expect',
              `Tautological conditional expression: "${cond.getText()}" inside expect() always returns true.`
            );
          } else if (whenFalse.getKind() === SyntaxKind.TrueKeyword && whenTrue.getKind() !== SyntaxKind.FalseKeyword) {
            addViolation(
              cond,
              'no-tautological-expect',
              `Tautological fallback conditional: "${cond.getText()}" falls back to true on failure inside expect().`
            );
          }
        }
      }
    }

    // Rule 3: no-test-skip
    if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'skip') {
      const callerText = callee.getExpression().getText();
      if (callerText === 'test' || callerText === 'it' || callerText === 'test.describe') {
        addViolation(
          call,
          'no-test-skip',
          `${callerText}.skip() is disallowed in graders. Graders must run and assert pass or fail; skipping masks defects.`
        );
      }
    }

    // Rule 4: no-gen2-file-goto
    if (isGen2 && Node.isPropertyAccessExpression(callee) && callee.getName() === 'goto') {
      const firstArg = call.getArguments()[0];
      if (firstArg?.getText().includes('file://')) {
        addViolation(
          call,
          'no-gen2-file-goto',
          'Gen 2 target graders must not navigate via file:// in page.goto(). Use page.goto(TARGET_URL) from test-fixture.ts.'
        );
      }
    }

    // Rule 6: invalid-skip-unless
    if (exprText === 'skipUnless') {
      const firstArg = call.getArguments()[0];
      const prop = Node.isObjectLiteralExpression(firstArg) ? firstArg.getProperty('unsupported') : undefined;
      const init = Node.isPropertyAssignment(prop) ? prop.getInitializer() : undefined;
      if (
        !Node.isObjectLiteralExpression(firstArg) ||
        firstArg.getProperties().length !== 1 ||
        !Node.isStringLiteral(init)
      ) {
        addViolation(
          call,
          'invalid-skip-unless',
          'skipUnless() must be called with `{ unsupported: "<feature-or-bcd-key>" }`.'
        );
      } else {
        const tokens = init
          .getLiteralValue()
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);
        const invalidTokens = tokens.filter(t => resolveFeatureOrBcdBaseline(t) === undefined);
        if (tokens.length === 0 || invalidTokens.length > 0) {
          addViolation(
            call,
            'invalid-skip-unless',
            `Invalid feature or BCD key(s) in skipUnless: ${invalidTokens.length > 0 ? invalidTokens.map(t => `"${t}"`).join(', ') : '(empty)'}. Use a valid web-features ID or BCD key.`
          );
        }
      }
    }

    // Rule 5: no-unguarded-conditional-assertions
    if (exprText === 'test' || exprText === 'it') {
      const fn = call.getArguments().find(a => Node.isFunctionExpression(a) || Node.isArrowFunction(a));
      if (!fn || branchGuaranteed(fn)) continue;

      const allAssertions = fn.getDescendantsOfKind(SyntaxKind.CallExpression).filter(isAssertionCall);
      if (allAssertions.length === 0) continue;

      for (const ifStmt of fn.getDescendantsOfKind(SyntaxKind.IfStatement)) {
        if (isWithinInnerIf(ifStmt, fn)) continue;

        const hasBranchAssertions = allAssertions.some(a =>
          ifStmt.containsRange(a.getPos(), a.getEnd())
        );
        if (hasBranchAssertions) {
          addViolation(
            ifStmt,
            'no-unguarded-conditional-assertions',
            'Unguarded conditional assertion: assertions in if-branch have no assertions in else-branch and no unconditional assertions in the test.'
          );
        }
      }
    }
  }

  if (isGen2) checkGen2Vacuity(sourceFile, addViolation);

  return violations;
}

type AddViolation = (node: TsMorphNode, ruleId: GraderRuleId, message: string) => void;

const TEST_CALLEES = new Set(['test', 'it', 'test.only', 'it.only']);
const WAIT_GUIDANCE = "wait on readiness; for a claim that something doesn't happen, use expectNever(page, predicate, { forMs })";

function unwrap(node: TsMorphNode): TsMorphNode {
  let curr = node;
  while (
    Node.isParenthesizedExpression(curr) ||
    Node.isAwaitExpression(curr) ||
    Node.isAsExpression(curr) ||
    Node.isNonNullExpression(curr)
  ) {
    curr = curr.getExpression();
  }
  return curr;
}

function enclosingFunction(node: TsMorphNode): TsMorphNode | undefined {
  return node.getFirstAncestor(a => Node.isFunctionLikeDeclaration(a));
}

function enclosingTest(node: TsMorphNode): TsMorphNode | undefined {
  let fn = enclosingFunction(node);
  while (fn) {
    const call = fn.getParent();
    if (Node.isCallExpression(call) && TEST_CALLEES.has(call.getExpression().getText())) return fn;
    fn = enclosingFunction(fn);
  }
  return undefined;
}

function assertionsIn(node: TsMorphNode): TsMorphNode[] {
  return node.getDescendantsOfKind(SyntaxKind.CallExpression).filter(isAssertionCall);
}

function isWaitCall(node: TsMorphNode): boolean {
  if (!Node.isCallExpression(node)) return false;
  const callee = node.getExpression();
  return Node.isPropertyAccessExpression(callee) && callee.getName().startsWith('waitFor');
}

function waitsIn(node: TsMorphNode): TsMorphNode[] {
  return node.getDescendantsOfKind(SyntaxKind.CallExpression).filter(isWaitCall);
}

function failsLoudly(node: TsMorphNode): boolean {
  return node.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0 || assertionsIn(node).length > 0;
}

function rootIdentifier(node: TsMorphNode): string | undefined {
  let curr = unwrap(node);
  for (;;) {
    if (Node.isIdentifier(curr)) return curr.getText();
    if (Node.isCallExpression(curr)) {
      const callee = curr.getExpression();
      const firstArg = curr.getArguments()[0];
      if (Node.isPropertyAccessExpression(callee) && ['Object', 'Array'].includes(callee.getExpression().getText()) && firstArg) {
        curr = unwrap(firstArg);
      } else {
        curr = unwrap(callee);
      }
    } else if (Node.isPropertyAccessExpression(curr) || Node.isElementAccessExpression(curr)) {
      curr = unwrap(curr.getExpression());
    } else if (Node.isArrayLiteralExpression(curr)) {
      const spread = curr.getElements().find(e => Node.isSpreadElement(e));
      if (!spread || !Node.isSpreadElement(spread)) return undefined;
      curr = unwrap(spread.getExpression());
    } else {
      return undefined;
    }
  }
}

function referencesIdentifier(node: TsMorphNode, name: string): boolean {
  if (Node.isIdentifier(node)) return node.getText() === name;
  return node.getDescendantsOfKind(SyntaxKind.Identifier).some(id => id.getText() === name);
}

function countOrLengthSubject(node: TsMorphNode): TsMorphNode | undefined {
  const expr = unwrap(node);
  if (Node.isPropertyAccessExpression(expr) && ['length', 'size'].includes(expr.getName())) {
    return expr.getExpression();
  }
  if (Node.isCallExpression(expr) && expr.getArguments().length === 0) {
    const callee = expr.getExpression();
    if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'count') {
      return callee.getExpression();
    }
  }
  return undefined;
}

function emptinessSubject(node: TsMorphNode): TsMorphNode | undefined {
  const expr = unwrap(node);
  if (Node.isPrefixUnaryExpression(expr) && expr.getOperatorToken() === SyntaxKind.ExclamationToken) {
    return countOrLengthSubject(expr.getOperand());
  }
  if (!Node.isBinaryExpression(expr)) return undefined;
  const op = expr.getOperatorToken().getKind();
  const subject = countOrLengthSubject(expr.getLeft());
  const right = expr.getRight().getText();
  if (!subject) return undefined;
  const isEmpty =
    ([SyntaxKind.EqualsEqualsEqualsToken, SyntaxKind.EqualsEqualsToken, SyntaxKind.LessThanEqualsToken].includes(op) && right === '0') ||
    (op === SyntaxKind.LessThanToken && right === '1');
  return isEmpty ? subject : undefined;
}

function isAbsenceCheck(node: TsMorphNode): boolean {
  const expr = unwrap(node);
  if (emptinessSubject(expr)) return true;
  if (Node.isPrefixUnaryExpression(expr) && expr.getOperatorToken() === SyntaxKind.ExclamationToken) {
    return !Node.isBinaryExpression(unwrap(expr.getOperand()));
  }
  if (Node.isBinaryExpression(expr)) {
    const op = expr.getOperatorToken().getKind();
    if (op === SyntaxKind.BarBarToken) return isAbsenceCheck(expr.getLeft()) || isAbsenceCheck(expr.getRight());
    if ([SyntaxKind.EqualsEqualsEqualsToken, SyntaxKind.EqualsEqualsToken].includes(op)) {
      return ['null', 'undefined', "'undefined'", '"undefined"'].includes(expr.getRight().getText());
    }
  }
  return false;
}

function readMatcher(expectCall: TsMorphNode): { negated: boolean; matcher: string; arg?: string } | undefined {
  let negated = false;
  let curr = expectCall.getParent();
  while (Node.isPropertyAccessExpression(curr)) {
    const name = curr.getName();
    if (name === 'not') {
      negated = !negated;
      curr = curr.getParent();
      continue;
    }
    const call = curr.getParent();
    if (!Node.isCallExpression(call)) return undefined;
    return { negated, matcher: name, arg: call.getArguments()[0]?.getText() };
  }
  return undefined;
}

function assertedTruthiness(assertCall: TsMorphNode): boolean | undefined {
  if (!Node.isCallExpression(assertCall)) return undefined;
  const callee = assertCall.getExpression().getText();
  if (callee === 'assert' || callee === 'assert.ok') return true;
  if (callee !== 'expect' && callee !== 'expect.soft') return undefined;
  const m = readMatcher(assertCall);
  if (!m) return undefined;
  let polarity: boolean | undefined;
  if (m.matcher === 'toBeTruthy') polarity = true;
  else if (m.matcher === 'toBeFalsy') polarity = false;
  else if (['toBe', 'toEqual', 'toStrictEqual'].includes(m.matcher) && (m.arg === 'true' || m.arg === 'false')) {
    polarity = m.arg === 'true';
  }
  return polarity === undefined ? undefined : polarity !== m.negated;
}

function resolveConstInitializer(node: TsMorphNode): TsMorphNode {
  const expr = unwrap(node);
  if (!Node.isIdentifier(expr)) return expr;
  const decl = expr.getSymbol()?.getDeclarations()[0];
  if (!Node.isVariableDeclaration(decl)) return expr;
  const init = decl.getInitializer();
  return init ? unwrap(init) : expr;
}

function isNonEmptyArrayLiteral(node: TsMorphNode): boolean {
  const expr = resolveConstInitializer(node);
  return Node.isArrayLiteralExpression(expr) && expr.getElements().length > 0 && !expr.getElements().some(e => Node.isSpreadElement(e));
}

function everyList(assertCall: TsMorphNode): TsMorphNode | undefined {
  if (!Node.isCallExpression(assertCall) || assertedTruthiness(assertCall) !== true) return undefined;
  const firstArg = assertCall.getArguments()[0];
  if (!firstArg) return undefined;
  const value = resolveConstInitializer(firstArg);
  const callee = Node.isCallExpression(value) ? value.getExpression() : undefined;
  return Node.isPropertyAccessExpression(callee) && callee.getName() === 'every' ? callee.getExpression() : undefined;
}

function checkGen2Vacuity(sourceFile: SourceFile, addViolation: AddViolation): void {
  for (const ifStmt of sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement)) {
    const testFn = enclosingTest(ifStmt);
    if (!testFn || enclosingFunction(ifStmt) !== testFn || !isAbsenceCheck(ifStmt.getExpression())) continue;
    const thenStmt = ifStmt.getThenStatement();
    const returns = Node.isReturnStatement(thenStmt) || (Node.isBlock(thenStmt) && thenStmt.getStatements().some(s => Node.isReturnStatement(s)));
    if (!returns || failsLoudly(thenStmt)) continue;
    const assertsAfter = assertionsIn(testFn).some(a => a.getStart() > ifStmt.getEnd());
    if (!assertsAfter) continue;
    addViolation(
      ifStmt,
      'no-early-return-before-assertion',
      'Early return skips the assertions that follow when the thing under test is missing, so the test passes vacuously. Assert presence instead (expect(x).toBeTruthy() / toBeGreaterThan(0)).'
    );
  }

  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const list = everyList(call);
    if (list) {
      const root = rootIdentifier(list);
      const scope = enclosingTest(call) ?? enclosingFunction(call);
      const guarded =
        isNonEmptyArrayLiteral(list) ||
        (root !== undefined &&
          scope !== undefined &&
          (assertionsIn(scope).some(a => a !== call && !everyList(a) && a.getEnd() <= call.getStart() && referencesIdentifier(a, root)) ||
            scope
              .getDescendantsOfKind(SyntaxKind.IfStatement)
              .some(s => s.getEnd() <= call.getStart() && referencesIdentifier(s.getExpression(), root) && failsLoudly(s.getThenStatement()))));
      if (!guarded) {
        addViolation(
          call,
          'no-unguarded-every',
          `\`.every()\` over \`${list.getText().slice(0, 60)}\` passes when the list is empty. Assert it is non-empty first (expect(list.length).toBeGreaterThan(0)).`
        );
      }
    }

    const callee = call.getExpression();
    if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'catch') {
      const receiver = callee.getExpression();
      const handler = call.getArguments()[0];
      const receiverAsserts = isAssertionCall(receiver) || assertionsIn(receiver).length > 0;
      const receiverWaits = isWaitCall(receiver) || waitsIn(receiver).length > 0;
      const assignedToVar = Node.isVariableDeclaration(
        call.getParentWhile(p => Node.isAwaitExpression(p) || Node.isParenthesizedExpression(p))?.getParent() ?? call.getParent()
      );
      if ((receiverAsserts || (receiverWaits && !assignedToVar)) && handler && !failsLoudly(handler)) {
        addViolation(
          call,
          'no-swallowed-assertion',
          `A \`.catch()\` handler swallows a failed assertion or wait, so the test cannot fail: ${WAIT_GUIDANCE}.`
        );
      }
    }

    if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'waitForTimeout') {
      addViolation(call, 'no-fixed-timeout', `Fixed waitForTimeout() makes the verdict timing-dependent: ${WAIT_GUIDANCE}.`);
    }
  }

  for (const tryStmt of sourceFile.getDescendantsOfKind(SyntaxKind.TryStatement)) {
    const catchClause = tryStmt.getCatchClause();
    const tryBlock = tryStmt.getTryBlock();
    if (!catchClause || (assertionsIn(tryBlock).length === 0 && waitsIn(tryBlock).length === 0)) continue;
    const catchBlock = catchClause.getBlock();
    if (failsLoudly(catchBlock)) continue;
    const recorded = new Set<string>();
    for (const bin of catchBlock.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
      if (bin.getOperatorToken().getKind() === SyntaxKind.EqualsToken) {
        const name = rootIdentifier(bin.getLeft());
        if (name) recorded.add(name);
      }
    }
    for (const c of catchBlock.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const e = c.getExpression();
      if (Node.isPropertyAccessExpression(e) && ['push', 'add', 'set'].includes(e.getName())) {
        const name = rootIdentifier(e.getExpression());
        if (name) recorded.add(name);
      }
    }
    const scope = enclosingFunction(tryStmt) ?? sourceFile;
    const assertedLater = assertionsIn(scope).some(a => a.getStart() > tryStmt.getEnd() && [...recorded].some(r => referencesIdentifier(a, r)));
    if (assertedLater) continue;
    addViolation(
      tryStmt,
      'no-swallowed-assertion',
      `This catch block swallows a failed assertion or wait from its try block, so the test cannot fail. Rethrow, or remove the try/catch: ${WAIT_GUIDANCE}.`
    );
  }

  for (const newExpr of sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression)) {
    if (newExpr.getExpression().getText() !== 'Promise') continue;
    const executor = newExpr.getArguments()[0];
    if (!executor || !(Node.isArrowFunction(executor) || Node.isFunctionExpression(executor))) continue;
    const resolveName = executor.getParameters()[0]?.getName();
    const timers = executor.getDescendantsOfKind(SyntaxKind.CallExpression).filter(c => c.getExpression().getText() === 'setTimeout');
    const isSleep = resolveName !== undefined && timers.some(t => {
      const cb = t.getArguments()[0];
      return cb !== undefined && (cb.getText() === resolveName || (Node.isArrowFunction(cb) && cb.getBody().getText().replace(/[{};\s]/g, '') === `${resolveName}()`));
    });
    if (!isSleep) continue;
    const raced = newExpr.getAncestors().some(a => Node.isCallExpression(a) && /^Promise\.(race|any)$/.test(a.getExpression().getText()));
    if (raced) continue;
    addViolation(newExpr, 'no-fixed-timeout', `A fixed setTimeout() sleep makes the verdict timing-dependent: ${WAIT_GUIDANCE}.`);
  }

  for (const bin of sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    if (bin.getOperatorToken().getKind() !== SyntaxKind.BarBarToken) continue;
    const parent = bin.getParent();
    if (Node.isBinaryExpression(parent) && parent.getOperatorToken().getKind() === SyntaxKind.BarBarToken) continue;
    const disjuncts: TsMorphNode[] = [];
    const flatten = (n: TsMorphNode) => {
      const e = unwrap(n);
      if (Node.isBinaryExpression(e) && e.getOperatorToken().getKind() === SyntaxKind.BarBarToken) {
        flatten(e.getLeft());
        flatten(e.getRight());
      } else {
        disjuncts.push(e);
      }
    };
    flatten(bin);
    const emptyIdx = disjuncts.findIndex(d => emptinessSubject(d));
    if (emptyIdx === -1 || disjuncts.length < 2) continue;
    if (!flowsIntoTruthyAssertion(bin)) continue;
    addViolation(
      bin,
      'no-absent-or-correct',
      `\`${disjuncts[emptyIdx].getText()} || ...\` passes when the list is empty ("absent, or correct"). Assert presence, then correctness.`
    );
  }
}

function flowsIntoTruthyAssertion(value: TsMorphNode): boolean {
  const climb = (start: TsMorphNode): boolean => {
    let node = start;
    let polarity = true;
    for (;;) {
      const parent = node.getParent();
      if (!parent) return false;
      if (Node.isParenthesizedExpression(parent) || Node.isAwaitExpression(parent)) {
        node = parent;
      } else if (Node.isPrefixUnaryExpression(parent) && parent.getOperatorToken() === SyntaxKind.ExclamationToken) {
        polarity = !polarity;
        node = parent;
      } else if (Node.isBinaryExpression(parent) && parent.getOperatorToken().getKind() === SyntaxKind.AmpersandAmpersandToken) {
        node = parent;
      } else if (Node.isCallExpression(parent) && parent.getArguments()[0] === node) {
        const asserted = assertedTruthiness(parent);
        return asserted !== undefined && asserted === polarity;
      } else if (Node.isVariableDeclaration(parent) && parent.getInitializer() === node && polarity) {
        const nameNode = parent.getNameNode();
        if (!Node.isIdentifier(nameNode)) return false;
        return nameNode.findReferencesAsNodes().some(ref => ref !== nameNode && climb(ref));
      } else {
        return false;
      }
    }
  };
  return climb(value);
}

const NO_LIB_COMPILER_OPTIONS = { noLib: true, noResolve: true };

const defaultInMemoryProject = new Project({
  compilerOptions: NO_LIB_COMPILER_OPTIONS,
  skipAddingFilesFromTsConfig: true,
  useInMemoryFileSystem: true,
});

export function checkGraderSource(
  filePath: string,
  sourceText: string,
  project: Project = defaultInMemoryProject
): GraderLintViolation[] {
  const sf = project.createSourceFile(filePath, sourceText, { overwrite: true });
  try {
    return checkGraderAst(filePath, sf);
  } finally {
    project.removeSourceFile(sf);
  }
}

export function checkGraderFile(
  filePath: string,
  project?: Project
): GraderLintViolation[] {
  if (!project) {
    return checkGraderSource(filePath, fs.readFileSync(filePath, 'utf8'));
  }
  const sf = project.getSourceFile(filePath) ?? project.addSourceFileAtPath(filePath);
  return checkGraderAst(filePath, sf);
}

export function findGraderFiles(repoRootDir: string = rootDir): string[] {
  const targetGuidesDir = path.join(repoRootDir, 'guides');
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(targetGuidesDir, { withFileTypes: true, recursive: true });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }

  return entries
    .filter(entry => entry.isFile() && entry.name === GRADER_FILE)
    .map(entry => path.join(entry.parentPath, entry.name))
    .sort();
}

/** Lints every grader. By default returns only `blocking` rules; `includeReportOnly` adds the rest. */
export function checkAllGraders(options?: {
  repoRoot?: string;
  project?: Project;
  includeReportOnly?: boolean;
}): Map<string, GraderLintViolation[]> {
  const baseDir = options?.repoRoot ?? rootDir;
  const graderFiles = findGraderFiles(baseDir);
  const resultMap = new Map<string, GraderLintViolation[]>();

  for (const file of graderFiles) {
    const violations = checkGraderFile(file, options?.project).filter(
      v => options?.includeReportOnly || GRADER_RULES[v.ruleId].blocking
    );
    if (violations.length > 0) {
      const relPath = path.relative(baseDir, file);
      resultMap.set(relPath, violations);
    }
  }

  return resultMap;
}

export function formatViolations(violationsMap: Map<string, GraderLintViolation[]>): string {
  const lines: string[] = [];
  for (const [file, violations] of violationsMap.entries()) {
    lines.push(`\n${file} (${violations.length} violation${violations.length === 1 ? '' : 's'}):`);
    for (const v of violations) {
      lines.push(`  L${v.line}:${v.column} [${v.ruleId}] ${v.message}`);
      if (v.snippet) {
        lines.push(`    ${v.snippet}`);
      }
    }
  }
  return lines.join('\n');
}
