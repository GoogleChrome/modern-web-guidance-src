import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind } from 'ts-morph';

const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('trusted-types Target Grader', () => {

  // --- STATIC ASSERTIONS ---

  test('The application includes a <meta> tag for Content Security Policy that enforces require-trusted-types-for and trusted-types', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasCspMeta = docs.some(({ document }) => {
      const metaTags = Array.from(document.querySelectorAll('meta'));
      return metaTags.some((meta: any) => {
        const httpEquiv = meta.getAttribute('http-equiv')?.toLowerCase();
        const content = meta.getAttribute('content') || '';
        const hasRequire = /\brequire-trusted-types-for\s+['"]?script['"]?/i.test(content);
        const hasPolicy = /\btrusted-types\b[^;]*\bmy-no-pretzel-policy\b/i.test(content);
        return httpEquiv === 'content-security-policy' && hasRequire && hasPolicy;
      });
    });

    expect(hasCspMeta).toBe(true);
  });

  test('The application defines a Trusted Types policy named my-no-pretzel-policy using window.trustedTypes.createPolicy', () => {
    const project = getJsProject(targetFiles);
    const hasPolicy = project.getSourceFiles().some(sf => {
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExprs.some(call => {
        const exprText = call.getExpression().getText();
        const isCreatePolicy = exprText === 'window.trustedTypes.createPolicy' ||
          exprText === 'trustedTypes.createPolicy' ||
          exprText.endsWith('.createPolicy');
        const args = call.getArguments();
        const firstArg = args[0]?.getText().replace(/['"`]/g, '');
        return isCreatePolicy && firstArg === 'my-no-pretzel-policy';
      });
    });

    expect(hasPolicy).toBe(true);
  });

  test('The application provides a "tinyfill" that mocks window.trustedTypes.createPolicy if the API is not natively supported', () => {
    const project = getJsProject(targetFiles);
    const hasTinyfill = project.getSourceFiles().some(sf => {
      const ifStatements = sf.getDescendantsOfKind(SyntaxKind.IfStatement);
      return ifStatements.some(ifStmt => {
        const condText = ifStmt.getExpression().getText();
        const checksSupport = condText.includes('trustedTypes');
        const thenText = ifStmt.getThenStatement().getText();
        const mocksCreatePolicy = thenText.includes('createPolicy');
        return checksSupport && mocksCreatePolicy;
      });
    });

    expect(hasTinyfill).toBe(true);
  });

  test('Clicking the #btn-unsafe button with HTML content in #input-field results in a TypeError message displayed within the #error-log element', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);

    const hasMarkup = docs.some(({ document }) =>
      Boolean(document.querySelector('#btn-unsafe')) &&
      Boolean(document.querySelector('#input-field')) &&
      Boolean(document.querySelector('#error-log'))
    );

    const hasUnsafeHandler = project.getSourceFiles().some(sf => {
      const strings = sf.getDescendantsOfKind(SyntaxKind.StringLiteral).map(s => s.getLiteralValue());
      const targetsUnsafe = strings.some(s => s === 'btn-unsafe' || s === '#btn-unsafe');
      const targetsErrorLog = strings.some(s => s === 'error-log' || s === '#error-log') ||
        sf.getDescendantsOfKind(SyntaxKind.Identifier).some(id => id.getText().toLowerCase().includes('errorlog'));
      const hasTryCatchOrTypeError = sf.getDescendantsOfKind(SyntaxKind.TryStatement).length > 0 ||
        sf.getDescendantsOfKind(SyntaxKind.Identifier).some(id => id.getText() === 'TypeError');
      return targetsUnsafe && targetsErrorLog && hasTryCatchOrTypeError;
    });

    expect(hasMarkup && hasUnsafeHandler).toBe(true);
  });

  test('Clicking the #btn-safe button with HTML content in #input-field successfully renders the content into the #output element', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);

    const hasMarkup = docs.some(({ document }) =>
      Boolean(document.querySelector('#btn-safe')) &&
      Boolean(document.querySelector('#output'))
    );

    const hasSafeHandler = project.getSourceFiles().some(sf => {
      const strings = sf.getDescendantsOfKind(SyntaxKind.StringLiteral).map(s => s.getLiteralValue());
      const targetsSafe = strings.some(s => s === 'btn-safe' || s === '#btn-safe');
      const targetsOutput = strings.some(s => s === 'output' || s === '#output') ||
        sf.getDescendantsOfKind(SyntaxKind.Identifier).some(id => id.getText().toLowerCase().includes('output'));
      const callsCreateHtml = sf.getDescendantsOfKind(SyntaxKind.CallExpression).some(call =>
        call.getExpression().getText().endsWith('createHTML')
      );
      return targetsSafe && targetsOutput && callsCreateHtml;
    });

    expect(hasMarkup && hasSafeHandler).toBe(true);
  });

  test('The #error-log element is hidden (display: none) after a successful update using the #btn-safe button', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);

    const hasErrorLogEl = docs.some(({ document }) => Boolean(document.querySelector('#error-log')));
    const hidesErrorLogInJs = project.getSourceFiles().some(sf => {
      const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      return binaryExprs.some(expr => {
        const leftText = expr.getLeft().getText();
        const rightText = expr.getRight().getText().replace(/['"`]/g, '');
        const isDisplayAssignment = leftText.endsWith('.style.display') && rightText === 'none';
        const isHiddenAssignment = leftText.endsWith('.hidden') && rightText === 'true';
        return isDisplayAssignment || isHiddenAssignment;
      });
    });

    expect(hasErrorLogEl && hidesErrorLogInJs).toBe(true);
  });

  test('The content rendered in #output after clicking #btn-safe has all instances of "pretzel" replaced with "popcorn"', () => {
    const project = getJsProject(targetFiles);
    const hasPretzelReplacement = project.getSourceFiles().some(sf => {
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExprs.some(call => {
        const exprText = call.getExpression().getText();
        const isReplace = exprText.endsWith('.replace') || exprText.endsWith('.replaceAll');
        if (!isReplace) return false;
        const args = call.getArguments();
        if (args.length < 2) return false;
        const searchArg = args[0].getText();
        const replaceArg = args[1].getText().replace(/['"`]/g, '');
        return searchArg.includes('pretzel') && replaceArg === 'popcorn';
      });
    });

    expect(hasPretzelReplacement).toBe(true);
  });

});
