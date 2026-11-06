import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  SyntaxKind,
  type CallExpression,
  type ObjectLiteralExpression,
  type PropertyAssignment,
  type ShorthandPropertyAssignment,
  type SourceFile,
} from 'ts-morph';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function stripQuotes(text: string): string {
  return text.trim().replace(/^['"`]|['"`]$/g, '');
}

function getPropertyInitializerText(
  obj: ObjectLiteralExpression,
  propName: string
): string | undefined {
  const prop = obj.getProperty(propName);
  if (!prop) return undefined;
  if (prop.isKind(SyntaxKind.PropertyAssignment)) {
    return (prop as PropertyAssignment).getInitializer()?.getText().trim();
  }
  if (prop.isKind(SyntaxKind.ShorthandPropertyAssignment)) {
    return (prop as ShorthandPropertyAssignment).getName();
  }
  return prop.getText().trim();
}

function findImmediateCredentialCalls(sourceFiles: SourceFile[]): {
  call: CallExpression;
  optionsObj?: ObjectLiteralExpression;
}[] {
  const results: { call: CallExpression; optionsObj?: ObjectLiteralExpression }[] = [];

  for (const sf of sourceFiles) {
    // Avoid matching files inside node_modules if patch included node_modules
    if (sf.getFilePath().includes('/node_modules/')) continue;

    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const exprText = call.getExpression().getText();
      if (!/\bcredentials\s*\??\.\s*get\b/.test(exprText)) continue;

      const arg = call.getArguments()[0];
      if (!arg) continue;

      if (arg.isKind(SyntaxKind.ObjectLiteralExpression)) {
        const uiModeVal = getPropertyInitializerText(arg, 'uiMode');
        if (uiModeVal && stripQuotes(uiModeVal) === 'immediate') {
          results.push({ call, optionsObj: arg });
        }
      } else if (arg.isKind(SyntaxKind.Identifier)) {
        const varName = arg.getText();
        const varDecls = sf
          .getDescendantsOfKind(SyntaxKind.VariableDeclaration)
          .filter((vd) => vd.getName() === varName);
        for (const vd of varDecls) {
          const init = vd.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
          if (init) {
            const uiModeVal = getPropertyInitializerText(init, 'uiMode');
            if (uiModeVal && stripQuotes(uiModeVal) === 'immediate') {
              results.push({ call, optionsObj: init });
              break;
            }
          }
        }
      }
    }
  }

  return results;
}

function getClientSourceFiles(): SourceFile[] {
  const project = getJsProject(targetFiles);
  return project
    .getSourceFiles()
    .filter((sf) => !sf.getFilePath().includes('/node_modules/'));
}

test.describe('quick-sign-ins Target Grader', () => {
  test('Imports or loads the webauthn-polyfills library', () => {
    const sourceFiles = getClientSourceFiles();
    const docs = getHtmlDocuments(targetFiles);

    const hasStaticImport = sourceFiles.some((sf) =>
      sf
        .getImportDeclarations()
        .some((imp) => imp.getModuleSpecifierValue().includes('webauthn-polyfills'))
    );

    const hasDynamicImportOrRequire = sourceFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const argText = call.getArguments()[0]?.getText() ?? '';
        return stripQuotes(argText).includes('webauthn-polyfills');
      })
    );

    const hasHtmlScriptLoad = docs.some((d) =>
      Array.from(d.document.querySelectorAll('script')).some((s: any) => {
        const src = s.getAttribute('src') || '';
        const text = s.textContent || '';
        return src.includes('webauthn-polyfills') || text.includes('webauthn-polyfills');
      })
    );

    expect(hasStaticImport || hasDynamicImportOrRequire || hasHtmlScriptLoad).toBe(true);
  });

  test('Feature-detects immediate UI support via PublicKeyCredential.getClientCapabilities() and checks capabilities.immediateGet', () => {
    const sourceFiles = getClientSourceFiles();

    const callsGetClientCapabilities = sourceFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const exprText = call.getExpression().getText();
        return /\bgetClientCapabilities\b/.test(exprText);
      })
    );

    const checksImmediateGet = sourceFiles.some((sf) => {
      const hasPropAccess = sf
        .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
        .some((pa) => pa.getName() === 'immediateGet');
      const hasElementAccess = sf
        .getDescendantsOfKind(SyntaxKind.ElementAccessExpression)
        .some((ea) => stripQuotes(ea.getArgumentExpression()?.getText() ?? '') === 'immediateGet');
      const hasDestructuring = sf
        .getDescendantsOfKind(SyntaxKind.BindingElement)
        .some((be) => (be.getPropertyNameNode()?.getText() ?? be.getName()) === 'immediateGet');
      return hasPropAccess || hasElementAccess || hasDestructuring;
    });

    expect(callsGetClientCapabilities && checksImmediateGet).toBe(true);
  });

  test('Invokes navigator.credentials.get inside a user-initiated click handler with uiMode: "immediate", password: true, and publicKey decoded via parseRequestOptionsFromJSON', () => {
    const sourceFiles = getClientSourceFiles();
    const immediateCalls = findImmediateCredentialCalls(sourceFiles);

    const hasValidImmediateCall = immediateCalls.some(({ optionsObj }) => {
      if (!optionsObj) return false;
      const passwordVal = getPropertyInitializerText(optionsObj, 'password');
      const hasPublicKey = Boolean(optionsObj.getProperty('publicKey'));
      return passwordVal === 'true' && hasPublicKey;
    });

    const usesParseRequestOptionsFromJSON = sourceFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
        /\bparseRequestOptionsFromJSON\b/.test(call.getExpression().getText())
      )
    );

    const registersClickListener = sourceFiles.some((sf) => {
      const hasAddEventListenerClick = sf
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .some((call) => {
          const exprText = call.getExpression().getText();
          const firstArg = stripQuotes(call.getArguments()[0]?.getText() ?? '');
          return /\baddEventListener\b/.test(exprText) && firstArg === 'click';
        });
      const hasOnClickAssignment = sf
        .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
        .some((pa) => pa.getName() === 'onclick');
      return hasAddEventListenerClick || hasOnClickAssignment;
    });

    const allImmediateCallsInsideFunctions =
      immediateCalls.length > 0 &&
      immediateCalls.every(({ call }) =>
        Boolean(
          call.getFirstAncestor(
            (node) =>
              node.isKind(SyntaxKind.FunctionDeclaration) ||
              node.isKind(SyntaxKind.FunctionExpression) ||
              node.isKind(SyntaxKind.ArrowFunction) ||
              node.isKind(SyntaxKind.MethodDeclaration)
          )
        )
      );

    expect(
      hasValidImmediateCall &&
        usesParseRequestOptionsFromJSON &&
        registersClickListener &&
        allImmediateCallsInsideFunctions
    ).toBe(true);
  });

  test('Does not pass an AbortSignal (signal) or a non-empty allowCredentials list to navigator.credentials.get when uiMode is "immediate"', () => {
    const sourceFiles = getClientSourceFiles();
    const immediateCalls = findImmediateCredentialCalls(sourceFiles);

    const isCompliant =
      immediateCalls.length > 0 &&
      immediateCalls.every(({ optionsObj }) => {
        if (!optionsObj) return false;
        const signalVal = getPropertyInitializerText(optionsObj, 'signal');
        if (signalVal && signalVal !== 'undefined') {
          return false;
        }
        const pkProp = optionsObj.getProperty('publicKey');
        if (pkProp && pkProp.isKind(SyntaxKind.PropertyAssignment)) {
          const pkInit = pkProp.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
          if (pkInit) {
            const allowCreds = pkInit.getProperty('allowCredentials');
            if (allowCreds && allowCreds.isKind(SyntaxKind.PropertyAssignment)) {
              const arrInit = allowCreds.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);
              if (!arrInit || arrInit.getElements().length > 0) {
                return false;
              }
            }
          }
        }
        return true;
      });

    expect(isCompliant).toBe(true);
  });

  test('Handles both "public-key" (via .toJSON()) and "password" (via id and password) credential types returned by navigator.credentials.get', () => {
    const sourceFiles = getClientSourceFiles();

    const checksPublicKeyType = sourceFiles.some((sf) =>
      sf
        .getDescendantsOfKind(SyntaxKind.StringLiteral)
        .some((str) => str.getLiteralValue() === 'public-key')
    );

    const checksPasswordType = sourceFiles.some((sf) =>
      sf
        .getDescendantsOfKind(SyntaxKind.StringLiteral)
        .some((str) => str.getLiteralValue() === 'password')
    );

    const callsToJSON = sourceFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const expr = call.getExpression();
        return expr.isKind(SyntaxKind.PropertyAccessExpression) && expr.getName() === 'toJSON';
      })
    );

    const accessesPasswordCredentialFields = sourceFiles.some((sf) => {
      const propNames = new Set(
        sf
          .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
          .map((pa) => pa.getName())
      );
      return propNames.has('id') && propNames.has('password');
    });

    expect(
      checksPublicKeyType &&
        checksPasswordType &&
        callsToJSON &&
        accessesPasswordCredentialFields
    ).toBe(true);
  });

  test('Invokes PublicKeyCredential.signalUnknownCredential with rpId and credentialId when verification returns HTTP 404', () => {
    const sourceFiles = getClientSourceFiles();

    const checks404Status = sourceFiles.some((sf) =>
      sf
        .getDescendantsOfKind(SyntaxKind.NumericLiteral)
        .some((num) => num.getLiteralValue() === 404)
    );

    const callsSignalUnknownCredentialWithArgs = sourceFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        if (!/\bsignalUnknownCredential\b/.test(call.getExpression().getText())) {
          return false;
        }
        const arg = call.getArguments()[0];
        if (!arg || !arg.isKind(SyntaxKind.ObjectLiteralExpression)) return false;
        return Boolean(arg.getProperty('rpId')) && Boolean(arg.getProperty('credentialId'));
      })
    );

    expect(checks404Status && callsSignalUnknownCredentialWithArgs).toBe(true);
  });

  test('Catches NotAllowedError (or unsupported immediateGet) and transitions to a fallback sign-in experience', () => {
    const sourceFiles = getClientSourceFiles();
    const docs = getHtmlDocuments(targetFiles);

    const hasTryCatchHandlingNotAllowedError = sourceFiles.some((sf) => {
      const hasCatch = sf.getDescendantsOfKind(SyntaxKind.CatchClause).length > 0;
      const referencesNotAllowedError = sf
        .getDescendantsOfKind(SyntaxKind.StringLiteral)
        .some((str) => str.getLiteralValue() === 'NotAllowedError');
      return hasCatch && referencesNotAllowedError;
    });

    const hasDialogOrModalFallback =
      docs.some((d) => Boolean(d.document.querySelector('dialog, form input[type="password"]'))) ||
      sourceFiles.some((sf) =>
        sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
          /\bshowModal\b/.test(call.getExpression().getText())
        )
      );

    const hasSignInNavigationFallback = sourceFiles.some((sf) => {
      const hasSignInRoute = sf
        .getDescendantsOfKind(SyntaxKind.StringLiteral)
        .some((str) => str.getLiteralValue().includes('/signin'));
      const hasTemplateSignInRoute = sf
        .getDescendantsOfKind(SyntaxKind.TemplateExpression)
        .some((tmpl) => tmpl.getText().includes('/signin'));
      return hasSignInRoute || hasTemplateSignInRoute;
    });

    expect(
      hasTryCatchHandlingNotAllowedError &&
        (hasDialogOrModalFallback || hasSignInNavigationFallback)
    ).toBe(true);
  });
});
