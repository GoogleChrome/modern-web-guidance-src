import fs from 'node:fs';
import path from 'node:path';
import { Project, SyntaxKind, Node, type SourceFile, type Node as TsMorphNode } from 'ts-morph';
import { resolveFeatureOrBcdBaseline } from './baseline.ts';
import { GRADER_FILE, TARGETS_DIR } from './guide-validation.ts';
import { rootDir } from './paths.ts';

const MAX_SNIPPET_LENGTH = 120;
const WAIT_GUIDANCE = "wait on readiness; for a claim that something doesn't happen, use expectNever(page, predicate, { forMs })";

export type GraderRuleId =
  | 'no-vacuous-boolean-expect'
  | 'no-tautological-expect'
  | 'no-test-skip'
  | 'no-gen2-file-goto'
  | 'no-unguarded-conditional-assertions'
  | 'invalid-skip-unless'
  | 'no-early-return-before-assertion'
  | 'no-unguarded-every'
  | 'no-swallowed-assertion'
  | 'no-fixed-timeout';

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

function isVacuousBoolean(node: TsMorphNode): boolean {
  const kind = node.getKind();
  if (kind === SyntaxKind.TrueKeyword || kind === SyntaxKind.FalseKeyword) {
    return true;
  }
  if (Node.isPrefixUnaryExpression(node) && node.getOperatorToken() === SyntaxKind.ExclamationToken) {
    return isVacuousBoolean(node.getOperand());
  }
  return false;
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

  const hasDirectAssertion = node
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .some(c => isAssertionCall(c) && !isWithinInnerIf(c, node));
  if (hasDirectAssertion) return true;

  return node
    .getDescendantsOfKind(SyntaxKind.IfStatement)
    .some(innerIf => !isWithinInnerIf(innerIf, node) && branchGuaranteed(innerIf));
}

function unwrap(node: TsMorphNode): TsMorphNode {
  let curr = node;
  while (
    Node.isParenthesizedExpression(curr) ||
    Node.isAwaitExpression(curr) ||
    Node.isAsExpression(curr) ||
    Node.isSatisfiesExpression(curr) ||
    Node.isTypeAssertion(curr) ||
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
    if (Node.isCallExpression(call) && /^(?:test|it)(?:\.only)?$/.test(call.getExpression().getText())) return fn;
    fn = enclosingFunction(fn);
  }
  return undefined;
}

function assertionsIn(node: TsMorphNode): TsMorphNode[] {
  return node.getDescendantsOfKind(SyntaxKind.CallExpression).filter(isAssertionCall);
}

function failsLoudly(node: TsMorphNode): boolean {
  return node.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0 || assertionsIn(node).length > 0;
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

function isNonNullOrFalsyAssertion(call: TsMorphNode, idName: string): boolean {
  if (!Node.isCallExpression(call) || !isAssertionCall(call)) return false;
  const callee = call.getExpression().getText();
  if (callee.startsWith('expect.soft')) return false;
  const arg = call.getArguments()[0];
  if (!arg || !arg.getDescendantsOfKind(SyntaxKind.Identifier).some(i => i.getText() === idName) && arg.getText() !== idName) return false;
  if (callee !== 'expect') return true;
  const m = readMatcher(call);
  if (!m) return false;
  if (m.matcher === 'toBeTruthy' || m.matcher === 'toBeDefined') return !m.negated;
  if (m.matcher === 'toBeFalsy' || m.matcher === 'toBeNull' || m.matcher === 'toBeUndefined') return m.negated;
  if (['toBe', 'toEqual', 'toStrictEqual'].includes(m.matcher)) {
    return m.negated ? ['0', 'false', 'null', 'undefined'].includes(m.arg ?? '') : !['0', 'false', 'null', 'undefined'].includes(m.arg ?? '');
  }
  return !m.negated || !['toBeGreaterThan', 'toBeGreaterThanOrEqual', 'toHaveLength', 'toHaveCount'].includes(m.matcher);
}

function isPositiveListAssertion(call: TsMorphNode, listKey: string): boolean {
  if (!Node.isCallExpression(call) || !isAssertionCall(call)) return false;
  const callee = call.getExpression().getText();
  if (callee !== 'expect' && callee !== 'assert' && callee !== 'assert.ok') return false;
  const arg = call.getArguments()[0];
  if (!arg) return false;
  const argKey = unwrap(arg).getText().replace(/\s+/g, '');
  if (!argKey.includes(listKey)) return false;
  if (callee !== 'expect') return argKey.includes(`${listKey}.length`) || argKey.includes('.some(');
  const m = readMatcher(call);
  if (!m) return false;
  const numArg = m.arg !== undefined ? Number(m.arg) : NaN;
  if (m.matcher === 'toBeGreaterThan') return !m.negated && !Number.isNaN(numArg) && numArg >= 0;
  if (m.matcher === 'toBeGreaterThanOrEqual') return !m.negated && !Number.isNaN(numArg) && numArg >= 1;
  if (m.matcher === 'toHaveLength' || m.matcher === 'toHaveCount') return !m.negated && numArg > 0;
  if (['toBe', 'toEqual', 'toStrictEqual'].includes(m.matcher) && !m.negated) {
    if (argKey === `${listKey}.length` || argKey === `${listKey}.size`) return m.arg !== '0';
    if (m.arg === 'true') {
      return argKey.includes('.some(') || new RegExp(`${listKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(?:length|size)\\s*(?:>|>=)`).test(argKey);
    }
  }
  return false;
}

function checkGen2ExtraRules(
  sourceFile: SourceFile,
  addViolation: (node: TsMorphNode, ruleId: GraderRuleId, message: string) => void
): void {
  // no-early-return-before-assertion: `if (...) return;` ahead of assertions without prior narrowing assertion
  for (const ifStmt of sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement)) {
    const testFn = enclosingTest(ifStmt);
    if (!testFn || enclosingFunction(ifStmt) !== testFn || isWithinInnerIf(ifStmt, testFn)) continue;
    const thenStmt = ifStmt.getThenStatement();
    const returns = Node.isReturnStatement(thenStmt) || (Node.isBlock(thenStmt) && thenStmt.getStatements().some(s => Node.isReturnStatement(s)));
    if (!returns || failsLoudly(thenStmt)) continue;
    if (!assertionsIn(testFn).some(a => a.getStart() > ifStmt.getEnd())) continue;
    const condIds = ifStmt
      .getExpression()
      .getDescendantsOfKind(SyntaxKind.Identifier)
      .filter(id => {
        const p = id.getParent();
        return !(Node.isPropertyAccessExpression(p) && p.getNameNode() === id) && !(Node.isCallExpression(p) && p.getExpression() === id);
      })
      .map(id => id.getText());
    const narrowed =
      condIds.length > 0 &&
      condIds.every(id =>
        assertionsIn(testFn).some(
          a => enclosingFunction(a) === testFn && !isWithinInnerIf(a, testFn) && a.getEnd() <= ifStmt.getStart() && isNonNullOrFalsyAssertion(a, id)
        )
      );
    if (narrowed) continue;
    addViolation(
      ifStmt,
      'no-early-return-before-assertion',
      'Early return skips the assertions that follow when the thing under test is missing, so the test passes vacuously. Assert presence instead.'
    );
  }

  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression();
    const exprText = callee.getText();

    // no-unguarded-every: expect(list.every(...)).toBe(true) / .toBeTruthy() without non-empty guard
    if (exprText === 'expect' || exprText === 'expect.soft' || exprText === 'assert' || exprText === 'assert.ok') {
      const m = exprText.startsWith('expect') ? readMatcher(call) : { negated: false, matcher: 'toBe', arg: 'true' };
      const truthyAssert =
        m && ((m.matcher === 'toBeTruthy' && !m.negated) || (['toBe', 'toEqual', 'toStrictEqual'].includes(m.matcher) && m.arg === String(!m.negated)));
      const arg = call.getArguments()[0];
      if (truthyAssert && arg) {
        let target = unwrap(arg);
        if (Node.isIdentifier(target)) {
          const decl = target.getSymbol()?.getDeclarations()[0];
          if (Node.isVariableDeclaration(decl) && decl.getInitializer()) target = unwrap(decl.getInitializer()!);
        }
        const targetCallee = Node.isCallExpression(target) ? target.getExpression() : undefined;
        if (Node.isPropertyAccessExpression(targetCallee) && targetCallee.getName() === 'every') {
          const list = unwrap(targetCallee.getExpression());
          const listKey = list.getText().replace(/\s+/g, '');
          const isNonEmptyLiteral = Node.isArrayLiteralExpression(list) && list.getElements().length > 0 && !list.getElements().some(e => Node.isSpreadElement(e));
          const scope = enclosingTest(call) ?? enclosingFunction(call);
          const hasInlineGuard = target.getAncestors().some(
            a => Node.isBinaryExpression(a) && a.getOperatorToken().getKind() === SyntaxKind.AmpersandAmpersandToken && a.getLeft().getText().replace(/\s+/g, '').includes(listKey)
          );
          const guarded =
            isNonEmptyLiteral ||
            hasInlineGuard ||
            (scope !== undefined &&
              (assertionsIn(scope).some(a => a !== call && a.getEnd() <= call.getStart() && isPositiveListAssertion(a, listKey)) ||
                scope
                  .getDescendantsOfKind(SyntaxKind.IfStatement)
                  .some(s => s.getEnd() <= call.getStart() && s.getExpression().getText().replace(/\s+/g, '').includes(listKey) && failsLoudly(s.getThenStatement()))));
          if (!guarded) {
            addViolation(
              call,
              'no-unguarded-every',
              `\`.every()\` over \`${list.getText().slice(0, 60)}\` passes when the list is empty. Assert it is non-empty first (expect(list.length).toBeGreaterThan(0)), or for a negative invariant use \`.some(bad)\` with \`.toBe(false)\`.`
            );
          }
        }
      }
    }

    // no-swallowed-assertion: expect(...).catch(() => {})
    if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'catch') {
      const receiver = callee.getExpression();
      const handler = call.getArguments()[0];
      if ((isAssertionCall(receiver) || assertionsIn(receiver).length > 0) && handler && !failsLoudly(handler)) {
        addViolation(call, 'no-swallowed-assertion', 'A `.catch()` handler swallows a failed assertion, so the test cannot fail.');
      }
    }

    // no-fixed-timeout: page.waitForTimeout(n)
    if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'waitForTimeout') {
      addViolation(call, 'no-fixed-timeout', `Fixed waitForTimeout() makes the verdict timing-dependent: ${WAIT_GUIDANCE}.`);
    }
  }

  // no-swallowed-assertion: try { expect(...) } catch {}
  for (const tryStmt of sourceFile.getDescendantsOfKind(SyntaxKind.TryStatement)) {
    const catchClause = tryStmt.getCatchClause();
    if (!catchClause || assertionsIn(tryStmt.getTryBlock()).length === 0) continue;
    const catchBlock = catchClause.getBlock();
    if (!failsLoudly(catchBlock)) {
      addViolation(tryStmt, 'no-swallowed-assertion', 'This catch block swallows a failed assertion from its try block, so the test cannot fail.');
    }
  }

  // no-fixed-timeout: new Promise(r => setTimeout(r, n)) outside Promise.race/any
  for (const newExpr of sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression)) {
    if (newExpr.getExpression().getText() !== 'Promise') continue;
    const executor = newExpr.getArguments()[0];
    if (!executor || !(Node.isArrowFunction(executor) || Node.isFunctionExpression(executor))) continue;
    const resolveName = executor.getParameters()[0]?.getName();
    const isSleep =
      resolveName !== undefined &&
      executor
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .filter(c => c.getExpression().getText() === 'setTimeout')
        .some(t => {
          const cb = t.getArguments()[0];
          return cb !== undefined && (cb.getText() === resolveName || (Node.isArrowFunction(cb) && cb.getBody().getText().replace(/[{};\s]/g, '') === `${resolveName}()`));
        });
    if (isSleep && !newExpr.getAncestors().some(a => Node.isCallExpression(a) && /^Promise\.(race|any)$/.test(a.getExpression().getText()))) {
      addViolation(newExpr, 'no-fixed-timeout', `A fixed setTimeout() sleep makes the verdict timing-dependent: ${WAIT_GUIDANCE}.`);
    }
  }
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
        if (isVacuousBoolean(firstArg)) {
          addViolation(
            call,
            'no-vacuous-boolean-expect',
            `Vacuous boolean assertion: expect(${firstArg.getText()}) produces a static result. Assert the real condition directly.`
          );
        }

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

  if (isGen2) checkGen2ExtraRules(sourceFile, addViolation);

  return violations;
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

export function checkAllGraders(options?: { repoRoot?: string; project?: Project }): Map<string, GraderLintViolation[]> {
  const baseDir = options?.repoRoot ?? rootDir;
  const graderFiles = findGraderFiles(baseDir);
  const resultMap = new Map<string, GraderLintViolation[]>();

  for (const file of graderFiles) {
    const violations = checkGraderFile(file, options?.project);
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
