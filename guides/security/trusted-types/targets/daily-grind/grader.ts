import { pathToFileURL } from 'node:url';
import * as path from 'node:path';
import { SyntaxKind } from 'ts-morph';
import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';

const currentFileUrl =
  typeof __filename !== 'undefined'
    ? pathToFileURL(__filename).href
    : pathToFileURL(path.resolve(process.cwd(), 'grader.ts')).href;

const targetFiles: string[] = getTargetFiles(currentFileUrl);

test.describe('trusted-types Target Grader', () => {
  // --- STATIC ASSERTIONS (FAST) ---

  test('The application configures a Content Security Policy that enforces require-trusted-types-for script', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasCsp = docs.some(({ document }) => {
      const metas = Array.from(document.querySelectorAll('meta')) as any[];
      return metas.some((meta) => {
        const httpEquiv = meta.getAttribute('http-equiv');
        const content = meta.getAttribute('content') || '';
        return (
          typeof httpEquiv === 'string' &&
          httpEquiv.toLowerCase() === 'content-security-policy' &&
          /require-trusted-types-for\s+'script'/i.test(content)
        );
      });
    });

    expect(hasCsp).toBe(true);
  });

  test('The application defines a Trusted Types policy using trustedTypes.createPolicy() with a createHTML rule', () => {
    const project = getJsProject(targetFiles);
    const callExpressions = project.getSourceFiles().flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );

    const hasPolicyWithCreateHtml = callExpressions.some((call) => {
      const exprText = call.getExpression().getText();
      if (!/\bcreatePolicy$/.test(exprText)) return false;
      const args = call.getArguments();
      if (args.length < 2) return false;
      const policyArg = args[1];
      if (policyArg.getKind() === SyntaxKind.ObjectLiteralExpression) {
        const obj = policyArg.asKind(SyntaxKind.ObjectLiteralExpression);
        return Boolean(
          obj?.getProperties().some((prop) => {
            const propName =
              prop.asKind(SyntaxKind.PropertyAssignment)?.getName() ||
              prop.asKind(SyntaxKind.MethodDeclaration)?.getName() ||
              prop.asKind(SyntaxKind.ShorthandPropertyAssignment)?.getName();
            return propName === 'createHTML';
          })
        );
      }
      return policyArg.getText().includes('createHTML');
    });

    expect(hasPolicyWithCreateHtml).toBe(true);
  });

  test('The application provides a tinyfill fallback defining window.trustedTypes.createPolicy when not natively supported', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasTinyfill = sourceFiles.some((sf) => {
      const ifStatements = sf.getDescendantsOfKind(SyntaxKind.IfStatement);
      const hasIfFallback = ifStatements.some((stmt) => {
        const condText = stmt.getExpression().getText();
        const thenText = stmt.getThenStatement().getText();
        return (
          condText.includes('trustedTypes') &&
          thenText.includes('createPolicy')
        );
      });
      if (hasIfFallback) return true;

      const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      return binaryExprs.some((expr) => {
        const text = expr.getText();
        return text.includes('trustedTypes') && text.includes('createPolicy');
      });
    });

    expect(hasTinyfill).toBe(true);
  });

  test('Assigning a raw string directly to Element.innerHTML is blocked by Trusted Types enforcement with a TypeError or sanitized by a default policy', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);

    const hasCspEnforcement = docs.some(({ document }) => {
      const metas = Array.from(document.querySelectorAll('meta')) as any[];
      return metas.some((m) => {
        const httpEquiv = m.getAttribute('http-equiv');
        const content = m.getAttribute('content') || '';
        return (
          typeof httpEquiv === 'string' &&
          httpEquiv.toLowerCase() === 'content-security-policy' &&
          /require-trusted-types-for\s+'script'/i.test(content)
        );
      });
    });

    const hasDefaultPolicy = project.getSourceFiles().some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return calls.some((c) => {
        if (!c.getExpression().getText().endsWith('createPolicy')) return false;
        const args = c.getArguments();
        return args.length > 0 && /['"]default['"]/.test(args[0].getText());
      });
    });

    const isEnforcedOrSanitized = hasCspEnforcement || hasDefaultPolicy;
    expect(isEnforcedOrSanitized).toBe(true);
  });

  test('Untrusted HTML written to Element.innerHTML is converted through the Trusted Types policy createHTML method', () => {
    const project = getJsProject(targetFiles);
    const binaryExpressions = project.getSourceFiles().flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.BinaryExpression)
    );

    const hasInnerHtmlPolicyAssignment = binaryExpressions.some((expr) => {
      const leftText = expr.getLeft().getText();
      const rightText = expr.getRight().getText();
      const isInnerHtmlSink = leftText.endsWith('.innerHTML') || leftText === 'innerHTML';
      const usesCreateHtml = rightText.includes('.createHTML(');
      return isInnerHtmlSink && usesCreateHtml;
    });

    expect(hasInnerHtmlPolicyAssignment).toBe(true);
  });

  test('The Trusted Types policy createHTML rule sanitizes or escapes untrusted HTML', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasSanitizationOrEscaping = sourceFiles.some((sf) => {
      const text = sf.getFullText();
      if (!text.includes('createHTML')) return false;

      const hasDomPurify = /DOMPurify\s*\.\s*sanitize/i.test(text);
      const hasEscaping = /&lt;|\.replaceAll\(|replace\([^)]*&/i.test(text);
      const hasScriptOrHandlerNeutralization =
        (/\bscript\b/i.test(text) || /\bon[a-z]/i.test(text)) &&
        (/\bremove\b/i.test(text) || /\bremoveAttribute\b/i.test(text) || /\breplace\b/i.test(text));

      return hasDomPurify || hasEscaping || hasScriptOrHandlerNeutralization;
    });

    expect(hasSanitizationOrEscaping).toBe(true);
  });
});
