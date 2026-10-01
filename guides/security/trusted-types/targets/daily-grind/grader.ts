import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind, Node } from 'ts-morph';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('trusted-types Target Grader', () => {
  // --- STATIC ASSERTIONS (FAST) ---

  test('Application includes a <meta> tag for Content Security Policy enforcing require-trusted-types-for script and trusted-types my-no-pretzel-policy', () => {
    const docs = getHtmlDocuments(targetFiles);
    const cspMeta = docs
      .flatMap((d) => Array.from(d.document.querySelectorAll('meta')))
      .find(
        (meta: any) =>
          meta.getAttribute('http-equiv')?.toLowerCase() ===
          'content-security-policy',
      );
    const content = (cspMeta as any)?.getAttribute('content') || '';
    const hasRequireScript = /require-trusted-types-for\s+['"]script['"]/i.test(content);
    const hasPretzelPolicy = /trusted-types\s+[^;]*\bmy-no-pretzel-policy\b/i.test(content);

    expect(hasRequireScript && hasPretzelPolicy).toBe(true);
  });

  test('Application defines a Trusted Types policy named my-no-pretzel-policy using window.trustedTypes.createPolicy', () => {
    const project = getJsProject(targetFiles);
    const callExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const definesPolicy = callExpressions.some((call) => {
      const expr = call.getExpression();
      const exprText = expr.getText();
      const isCreatePolicy =
        (Node.isPropertyAccessExpression(expr) && expr.getName() === 'createPolicy') ||
        exprText.endsWith('.createPolicy');
      const firstArg = call.getArguments()[0];
      const policyName =
        firstArg && Node.isStringLiteral(firstArg)
          ? firstArg.getLiteralText()
          : firstArg?.getText().replace(/['"`]/g, '');

      return isCreatePolicy && policyName === 'my-no-pretzel-policy';
    });

    expect(definesPolicy).toBe(true);
  });

  test('Application provides a tinyfill that mocks window.trustedTypes.createPolicy if not natively supported', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasTinyfill = sourceFiles.some((sf) => {
      if (sf.getFilePath().includes('.spec.') || sf.getFilePath().includes('.test.')) {
        return false;
      }

      const ifStatements = sf.getDescendantsOfKind(SyntaxKind.IfStatement);
      const hasIfTinyfill = ifStatements.some((ifStmt) => {
        const cond = ifStmt.getExpression().getText();
        if (!/trustedTypes/i.test(cond)) return false;
        const thenBlock = ifStmt.getThenStatement().getText();
        return thenBlock.includes('createPolicy');
      });
      if (hasIfTinyfill) return true;

      const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      const hasBinaryTinyfill = binaryExprs.some((binExpr) => {
        const left = binExpr.getLeft().getText();
        const right = binExpr.getRight().getText();
        return /trustedTypes/i.test(left) && right.includes('createPolicy');
      });
      if (hasBinaryTinyfill) return true;

      const condExprs = sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression);
      return condExprs.some((condExpr) => {
        const cond = condExpr.getCondition().getText();
        return (
          /trustedTypes/i.test(cond) &&
          (condExpr.getWhenTrue().getText().includes('createPolicy') ||
            condExpr.getWhenFalse().getText().includes('createPolicy'))
        );
      });
    });

    expect(hasTinyfill).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Clicking #btn-unsafe with HTML content in #input-field displays a TypeError in #error-log', async ({ page }) => {
      await page.locator('#input-field').fill('<b>pretzel</b>');
      await page.locator('#btn-unsafe').click();
      await expect(page.locator('#error-log')).toContainText('TypeError');
    });

    test('Clicking #btn-safe with HTML content in #input-field successfully renders content into #output', async ({ page }) => {
      await page.locator('#input-field').fill('<b>fresh brew</b>');
      await page.locator('#btn-safe').click();
      await expect(page.locator('#output b')).toHaveText('fresh brew');
    });

    test('#error-log element is hidden after a successful update using #btn-safe', async ({ page }) => {
      await page.locator('#input-field').fill('<b>pretzel</b>');
      await page.locator('#btn-unsafe').click();
      await page.locator('#btn-safe').click();
      await expect(page.locator('#error-log')).toHaveCSS('display', 'none');
    });

    test('Content rendered in #output after clicking #btn-safe has all instances of pretzel replaced with popcorn', async ({ page }) => {
      await page.locator('#input-field').fill('<b>pretzel and pretzel</b>');
      await page.locator('#btn-safe').click();
      await expect(page.locator('#output')).toHaveText('popcorn and popcorn');
    });
  });
});
