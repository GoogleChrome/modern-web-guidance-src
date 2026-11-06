import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project, type CallExpression } from 'ts-morph';
import type { Document } from 'linkedom';

// @ts-ignore - import.meta.url is used by ESM test runner
const targetFiles: string[] = getTargetFiles(import.meta.url);

function stripQuotes(text: string): string {
  return text.trim().replace(/^['"`]|['"`]$/g, '');
}

function getAllCallExpressions(project: Project): CallExpression[] {
  return project.getSourceFiles().flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
}

function hasNativeSanitizerCall(project: Project): boolean {
  const calls = getAllCallExpressions(project);
  return calls.some((call) => {
    const expr = call.getExpression();
    if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
      const prop = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression).getName();
      return prop === 'setHTML' || prop === 'parseHTML';
    }
    return false;
  });
}

function hasFallbackSanitizerCall(project: Project): boolean {
  const calls = getAllCallExpressions(project);
  return calls.some((call) => {
    const expr = call.getExpression();
    if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
      const prop = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression).getName();
      return prop === 'sanitize';
    }
    return false;
  });
}

function getStringLiterals(project: Project): Set<string> {
  const strings = new Set<string>();
  for (const sf of project.getSourceFiles()) {
    for (const lit of sf.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
      strings.add(lit.getLiteralValue());
    }
    for (const tpl of sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
      strings.add(tpl.getLiteralValue());
    }
  }
  return strings;
}

test.describe('sanitize-untrusted-html Target Grader', () => {
  test('After untrusted HTML containing a <script> element is rendered, the output container contains no <script> elements', () => {
    const project: Project = getJsProject(targetFiles);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const strings = getStringLiterals(project);

    const hasInputAndContainer = docs.some(
      (d) =>
        Boolean(d.document.querySelector('form, textarea, input')) &&
        Boolean(d.document.querySelector('ul, ol, div, section, article'))
    );
    const usesSanitizer = hasNativeSanitizerCall(project);
    const allowsScript = strings.has('script');

    expect(hasInputAndContainer && usesSanitizer && !allowsScript).toBe(true);
  });

  test('After untrusted HTML containing inline event handlers is rendered, no element in the output container has an on* attribute (such as onclick or onerror)', () => {
    const project: Project = getJsProject(targetFiles);
    const strings = getStringLiterals(project);

    const usesSanitizer = hasNativeSanitizerCall(project);
    const hasEventAttributeAllowed = Array.from(strings).some((s) => /^on[a-z]+$/i.test(s));

    const propAssignments = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment));
    const configuresAttributes = propAssignments.some((prop) => {
      const name = stripQuotes(prop.getName());
      return name === 'attributes' || name === 'ALLOWED_ATTR';
    });

    expect(usesSanitizer && configuresAttributes && !hasEventAttributeAllowed).toBe(true);
  });

  test('Rendering untrusted HTML does not execute any script from the input (no dialogs open and no console messages are logged by the injected markup)', () => {
    const project: Project = getJsProject(targetFiles);
    const calls = getAllCallExpressions(project);

    const usesSafeSanitization = hasNativeSanitizerCall(project) && hasFallbackSanitizerCall(project);

    const usesUnsafeMethods = calls.some((call) => {
      const expr = call.getExpression();
      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const prop = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression).getName();
        return (
          prop === 'setHTMLUnsafe' ||
          prop === 'parseHTMLUnsafe' ||
          prop === 'insertAdjacentHTML' ||
          prop === 'write' ||
          prop === 'writeln'
        );
      }
      if (expr.getKind() === SyntaxKind.Identifier) {
        return expr.getText() === 'eval';
      }
      return false;
    });

    expect(usesSafeSanitization && !usesUnsafeMethods).toBe(true);
  });

  test('Safe formatting markup in the input (such as a <p> containing a <b> element) is rendered as elements in the output container, not as escaped text', () => {
    const project: Project = getJsProject(targetFiles);
    const strings = getStringLiterals(project);

    const usesSanitizer = hasNativeSanitizerCall(project);
    const allowsSafeFormattingTags =
      strings.has('p') &&
      strings.has('b') &&
      (strings.has('i') || strings.has('strong') || strings.has('em'));

    const domInsertionCalls = getAllCallExpressions(project).some((call) => {
      const expr = call.getExpression();
      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const prop = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression).getName();
        return (
          prop === 'setHTML' ||
          prop === 'replaceChildren' ||
          prop === 'append' ||
          prop === 'prepend' ||
          prop === 'appendChild'
        );
      }
      return false;
    });

    expect(usesSanitizer && allowsSafeFormattingTags && domInsertionCalls).toBe(true);
  });

  test('When Element.prototype.setHTML is removed before the page\'s scripts run, the output container still contains no <script> elements and no on* attributes after rendering untrusted HTML', () => {
    const project: Project = getJsProject(targetFiles);
    const strings = getStringLiterals(project);

    const binaryExpressions = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.BinaryExpression));
    const hasFeatureDetection = binaryExpressions.some((expr) => {
      const op = expr.getOperatorToken().getText();
      if (op !== 'in') return false;
      const left = stripQuotes(expr.getLeft().getText());
      const right = expr.getRight().getText();
      return (
        (left === 'setHTML' && right.includes('Element')) ||
        (left === 'parseHTML' && right.includes('Document'))
      );
    });

    const usesFallbackLibrary = Array.from(strings).some((s) => /dompurify/i.test(s));
    const callsFallbackSanitize = hasFallbackSanitizerCall(project);

    expect(hasFeatureDetection && usesFallbackLibrary && callsFallbackSanitize).toBe(true);
  });
});
