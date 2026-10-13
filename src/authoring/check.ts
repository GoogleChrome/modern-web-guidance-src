import fs from 'node:fs';
import path from 'node:path';
import { Project, SyntaxKind, Node, type SourceFile, type Node as TsMorphNode } from 'ts-morph';
import { rootDir } from '../core/paths.ts';

export interface GraderLintViolation {
  filePath: string;
  line: number;
  column: number;
  ruleId: string;
  message: string;
  snippet?: string;
}

export function isGen2Grader(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return /\/targets\/[^/]+\/grader\.ts$/.test(normalized);
}

export function isGraderFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return /(?:^|\/)grader\.ts$/.test(normalized);
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
  const args = node.getArguments();
  if (args.length > 0 && isVacuousBoolean(args[0])) {
    return false;
  }
  return true;
}

function branchGuaranteed(node?: TsMorphNode): boolean {
  if (!node) return false;
  if (node.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0) return true;
  return node.getDescendantsOfKind(SyntaxKind.CallExpression).some(isAssertionCall);
}

export function checkGraderAst(filePath: string, sourceFile: SourceFile): GraderLintViolation[] {
  const violations: GraderLintViolation[] = [];
  const isGen2 = isGen2Grader(filePath);

  const addViolation = (node: TsMorphNode, ruleId: string, message: string) => {
    const { line, column } = sourceFile.getLineAndColumnAtPos(node.getStart());
    const snippet = node.getText().slice(0, 120);
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
    const exprText = call.getExpression().getText();

    // Rule 1: no-vacuous-boolean-expect & Rule 2: no-tautological-expect
    if (exprText === 'expect' || exprText === 'expect.soft') {
      const args = call.getArguments();
      if (args.length > 0) {
        const firstArg = args[0];

        // Rule 1: Vacuous expect(true) / expect(false)
        if (isVacuousBoolean(firstArg)) {
          addViolation(
            call,
            'no-vacuous-boolean-expect',
            `Vacuous boolean assertion: expect(${firstArg.getText()}) produces a static result. Assert the real condition directly.`
          );
        }

        // Rule 2: Tautological boolean expressions inside expect()
        const binaries = [firstArg, ...firstArg.getDescendantsOfKind(SyntaxKind.BinaryExpression)];
        for (const bin of binaries) {
          if (Node.isBinaryExpression(bin) && bin.getOperatorToken().getKind() === SyntaxKind.BarBarToken) {
            if (bin.getRight().getKind() === SyntaxKind.TrueKeyword || bin.getLeft().getKind() === SyntaxKind.TrueKeyword) {
              addViolation(
                bin,
                'no-tautological-expect',
                `Tautological boolean expression: "${bin.getText()}" inside expect() always evaluates to truthy.`
              );
            }
          }
        }

        const conditionals = [firstArg, ...firstArg.getDescendantsOfKind(SyntaxKind.ConditionalExpression)];
        for (const cond of conditionals) {
          if (Node.isConditionalExpression(cond)) {
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
    }

    // Rule 3: no-test-skip
    const callee = call.getExpression();
    if (Node.isPropertyAccessExpression(callee)) {
      if (callee.getName() === 'skip') {
        const callerText = callee.getExpression().getText();
        if (callerText === 'test' || callerText === 'it' || callerText === 'test.describe') {
          addViolation(
            call,
            'no-test-skip',
            `${callerText}.skip() is disallowed in graders. Graders must run and assert pass or fail; skipping masks defects.`
          );
        }
      }
    }

    // Rule 4: no-gen2-file-goto
    if (isGen2 && Node.isPropertyAccessExpression(callee)) {
      if (callee.getName() === 'goto') {
        const args = call.getArguments();
        if (args.length > 0) {
          const argText = args[0].getText();
          if (argText.includes('file://')) {
            addViolation(
              call,
              'no-gen2-file-goto',
              'Gen 2 target graders must not navigate via file:// in page.goto(). Route over localhost or test server.'
            );
          }
        }
      }
    }

    // Rule 5: no-unguarded-conditional-assertions
    if (exprText === 'test' || exprText === 'it') {
      const args = call.getArguments();
      const fn = args.find(a => Node.isFunctionExpression(a) || Node.isArrowFunction(a));
      if (!fn) continue;

      const ifStatements = fn.getDescendantsOfKind(SyntaxKind.IfStatement);
      for (const ifStmt of ifStatements) {
        const thenBlock = ifStmt.getThenStatement();
        const thenAssertions = thenBlock.getDescendantsOfKind(SyntaxKind.CallExpression).filter(isAssertionCall);
        if (thenAssertions.length === 0) continue;

        const elseStmt = ifStmt.getElseStatement();
        const elseGuaranteed = branchGuaranteed(elseStmt);

        if (!elseGuaranteed) {
          const allAssertions = fn.getDescendantsOfKind(SyntaxKind.CallExpression).filter(isAssertionCall);
          const assertionsOutsideThisIf = allAssertions.filter(a => !a.getAncestors().some(anc => anc === ifStmt));

          if (assertionsOutsideThisIf.length === 0) {
            addViolation(
              ifStmt,
              'no-unguarded-conditional-assertions',
              'Unguarded conditional assertion: assertions in if-branch have no assertions in else-branch and no assertions outside the if statement.'
            );
          }
        }
      }
    }
  }

  return violations;
}

export function checkGraderSource(filePath: string, sourceText: string, project?: Project): GraderLintViolation[] {
  const p = project ?? new Project({ skipAddingFilesFromTsConfig: true, useInMemoryFileSystem: true });
  const sf = p.createSourceFile(`virtual_${path.basename(filePath)}_${Date.now()}_${Math.random().toString(36).slice(2)}.ts`, sourceText);
  try {
    return checkGraderAst(filePath, sf);
  } finally {
    p.removeSourceFile(sf);
  }
}

export function checkGraderFile(filePath: string, project?: Project): GraderLintViolation[] {
  if (project) {
    let sf = project.getSourceFile(filePath);
    if (!sf) {
      sf = project.addSourceFileAtPath(filePath);
    }
    return checkGraderAst(filePath, sf);
  }

  const p = new Project({ skipAddingFilesFromTsConfig: true });
  const sf = p.addSourceFileAtPath(filePath);
  return checkGraderAst(filePath, sf);
}

export function findGraderFiles(repoRootDir: string = rootDir): string[] {
  const guidesDir = path.join(repoRootDir, 'guides');
  if (!fs.existsSync(guidesDir)) return [];

  const results: string[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name === 'grader.ts') {
        results.push(fullPath);
      }
    }
  }

  walk(guidesDir);
  return results;
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
