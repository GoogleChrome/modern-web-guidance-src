import fs from 'node:fs';
import path from 'node:path';
import { Project, SyntaxKind, Node, type SourceFile, type Node as TsMorphNode } from 'ts-morph';
import { GRADER_FILE, TARGETS_DIR } from './guide-validation.ts';
import { rootDir } from './paths.ts';

const MAX_SNIPPET_LENGTH = 120;

export type GraderRuleId =
  | 'no-vacuous-boolean-expect'
  | 'no-tautological-expect'
  | 'no-test-skip'
  | 'no-gen2-file-goto'
  | 'no-unguarded-conditional-assertions';

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

  return violations;
}

const defaultInMemoryProject = new Project({
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
  project: Project = new Project({ skipAddingFilesFromTsConfig: true })
): GraderLintViolation[] {
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
  const p = options?.project ?? new Project({ skipAddingFilesFromTsConfig: true });
  const resultMap = new Map<string, GraderLintViolation[]>();

  for (const file of graderFiles) {
    const violations = checkGraderFile(file, p);
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
