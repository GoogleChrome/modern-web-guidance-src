import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
} from '../../../../test-fixture.ts';
import { SyntaxKind, Node } from 'ts-morph';

const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('Passkey Management Target Grader', () => {
  // Requirement 1: The application fetches registered credentials from the credential endpoint on load.
  test('The application fetches registered credentials from the credential endpoint on load', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasCredentialEndpoint = sourceFiles.some((sf) => {
      const strings = [
        ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral),
        ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
      ];
      return strings.some((s) => {
        const val = s.getLiteralValue().toLowerCase();
        return (val.includes('credential') || val.includes('credentials')) && !val.includes('authenticatorselection');
      });
    });

    const calls = sourceFiles.flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasLoadFetch = calls.some((call) => {
      const expr = call.getExpression().getText();
      const isLoad = expr === 'useEffect' || expr === 'React.useEffect' ||
        (expr.includes('addEventListener') && call.getArguments().some((a) => a.getText().includes('DOMContentLoaded')));
      if (!isLoad) return false;
      return call.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => {
        const name = id.getText().toLowerCase();
        return name.includes('load') || name.includes('credential') || name.includes('list');
      });
    });

    expect(hasCredentialEndpoint && hasLoadFetch).toBe(true);
  });

  // Requirement 2: The application automatically invokes signalAllAcceptedCredentials on load to sync accepted credentials.
  test('The application automatically invokes signalAllAcceptedCredentials on load to sync accepted credentials', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasSignalAll = sourceFiles.some((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => id.getText() === 'signalAllAcceptedCredentials')
    );
    const calls = sourceFiles.flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const invokesOnLoad = calls.some((call) => {
      const expr = call.getExpression().getText();
      const isLoad = expr === 'useEffect' || expr === 'React.useEffect' ||
        (expr.includes('addEventListener') && call.getArguments().some((a) => a.getText().includes('DOMContentLoaded')));
      if (!isLoad) return false;
      const ids = call.getDescendantsOfKind(SyntaxKind.Identifier).map((id) => id.getText());
      return ids.some((id) =>
        id === 'signalAllAcceptedCredentials' ||
        id === 'syncAcceptedCredentials' ||
        id === 'loadCredentials' ||
        id === 'loadManagementPanel' ||
        id === 'load'
      );
    });

    expect(hasSignalAll && invokesOnLoad).toBe(true);
  });

  // Requirement 3: The application updates passkey providers by immediately calling signalAllAcceptedCredentials within delete trigger handler.
  test('The application updates passkey providers by calling signalAllAcceptedCredentials within the delete trigger handler', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const updatesOnDelete = sourceFiles.some((sf) => {
      const fns = [
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
        ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionExpression),
      ];
      return fns.some((fn) => {
        const parent = fn.getParent();
        const fnName = parent && Node.isVariableDeclaration(parent)
          ? parent.getName()
          : (Node.isFunctionDeclaration(fn) ? (fn.getName() || '') : '');
        const isDeleteHandler = fnName.toLowerCase().includes('delete') ||
          fn.getDescendantsOfKind(SyntaxKind.StringLiteral).some((lit) => lit.getLiteralValue() === 'DELETE') ||
          fn.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => id.getText().toLowerCase().includes('delete'));
        if (!isDeleteHandler) return false;

        const calls = fn.getDescendantsOfKind(SyntaxKind.CallExpression).map((c) => {
          const e = c.getExpression();
          return Node.isPropertyAccessExpression(e) ? e.getName() : e.getText();
        });
        const hasSignal = calls.some((n) =>
          n === 'signalAllAcceptedCredentials' ||
          n === 'syncAcceptedCredentials' ||
          n === 'loadCredentials'
        );
        return hasSignal && sf.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => id.getText() === 'signalAllAcceptedCredentials');
      });
    });

    expect(updatesOnDelete).toBe(true);
  });

  // Requirement 4: The application invokes signalCurrentUserDetails within the user profile rename handler upon successful rename.
  test('The application invokes signalCurrentUserDetails within the user profile rename handler upon successful rename', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const updatesOnRename = sourceFiles.some((sf) => {
      const fns = [
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
        ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionExpression),
      ];
      return fns.some((fn) => {
        const parent = fn.getParent();
        const fnName = parent && Node.isVariableDeclaration(parent)
          ? parent.getName()
          : (Node.isFunctionDeclaration(fn) ? (fn.getName() || '') : '');
        const isUserRename = fnName.toLowerCase().includes('user') ||
          fnName.toLowerCase().includes('profile') ||
          fnName.toLowerCase().includes('rename') ||
          fn.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => {
            const t = id.getText();
            return t === 'displayName' || t === 'username' || t === 'nameDraft' || t === 'editUsername';
          });
        if (!isUserRename) return false;

        const calls = fn.getDescendantsOfKind(SyntaxKind.CallExpression).map((c) => {
          const e = c.getExpression();
          return Node.isPropertyAccessExpression(e) ? e.getName() : e.getText();
        });
        const hasSignalCall = calls.some((n) => n.includes('signalCurrentUserDetails'));
        const hasSignalId = fn.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => id.getText() === 'signalCurrentUserDetails');
        return hasSignalCall || hasSignalId;
      });
    });

    expect(updatesOnRename).toBe(true);
  });

  // Requirement 5A: Passkey provider metadata is resolved against an AAGUID registry.
  test('Passkey provider metadata is resolved against an AAGUID registry', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasAaguidResolution = sourceFiles.some((sf) => {
      const hasAaguid = sf.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => id.getText().toLowerCase().includes('aaguid'));
      const ids = sf.getDescendantsOfKind(SyntaxKind.Identifier).map((id) => id.getText());
      const hasRegistry = ids.some((id) =>
        id === 'aaguids' ||
        id === 'registry' ||
        id === 'aaguidRegistry' ||
        id === 'passkeyProvider' ||
        id === 'resolveAaguid'
      );
      const strings = sf.getDescendantsOfKind(SyntaxKind.StringLiteral).map((s) => s.getLiteralValue());
      const hasRegistryFile = strings.some((s) => s.includes('aaguids'));
      return hasAaguid && (hasRegistry || hasRegistryFile);
    });

    expect(hasAaguidResolution).toBe(true);
  });

  // Requirement 5B: Each credential row renders the passkey provider icon.
  test('Each credential row renders the passkey provider icon', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const rendersProviderIcon = sourceFiles.some((sf) => {
      const filePath = sf.getFilePath().toLowerCase();
      if (!filePath.includes('passkey') && !filePath.includes('credential')) return false;
      const jsxElements = [
        ...sf.getDescendantsOfKind(SyntaxKind.JsxElement),
        ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
      ];
      return jsxElements.some((el) => {
        const tagName = Node.isJsxElement(el)
          ? el.getOpeningElement().getTagNameNode().getText()
          : el.getTagNameNode().getText();
        const isIconTag = tagName === 'img' || tagName.toLowerCase().includes('icon');
        if (!isIconTag) return false;
        const text = el.getText();
        return text.toLowerCase().includes('icon') || text.includes('provider');
      });
    });

    expect(rendersProviderIcon).toBe(true);
  });

  // Requirement 5C: Each credential row renders the credential or provider name.
  test('Each credential row renders the credential or provider name', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const rendersName = sourceFiles.some((sf) => {
      const filePath = sf.getFilePath().toLowerCase();
      if (!filePath.includes('passkey') && !filePath.includes('credential')) return false;
      const jsxExpressions = sf.getDescendantsOfKind(SyntaxKind.JsxExpression);
      return jsxExpressions.some((expr) => {
        const ids = expr.getDescendantsOfKind(SyntaxKind.Identifier).map((id) => id.getText());
        return ids.some((id) => id === 'name' || id === 'displayName' || id === 'nickname');
      });
    });

    expect(rendersName).toBe(true);
  });

  // Requirement 5D: Each credential row renders a formatted human-readable last-used timestamp.
  test('Each credential row renders a formatted human-readable last-used timestamp', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const rendersFormattedLastUsed = sourceFiles.some((sf) => {
      const filePath = sf.getFilePath().toLowerCase();
      if (!filePath.includes('passkey') && !filePath.includes('credential')) return false;
      const hasLastUsed = sf.getDescendantsOfKind(SyntaxKind.Identifier).some((id) =>
        id.getText().toLowerCase().includes('lastused')
      );
      if (!hasLastUsed) return false;
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return calls.some((c) => {
        const expr = c.getExpression();
        const name = Node.isPropertyAccessExpression(expr) ? expr.getName() : expr.getText();
        return name === 'toLocaleDateString' ||
          name === 'toLocaleString' ||
          name === 'formatDate' ||
          name === 'formatHumanReadableDate' ||
          name === 'date';
      });
    });

    expect(rendersFormattedLastUsed).toBe(true);
  });

  // Requirement 6A: Passkey platform authenticator capability is detected via PublicKeyCredential.getClientCapabilities.
  test('Passkey platform authenticator capability is detected via PublicKeyCredential.getClientCapabilities', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const calls = sourceFiles.flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasGetClientCaps = calls.some((call) => {
      const expr = call.getExpression();
      const propName = Node.isPropertyAccessExpression(expr) ? expr.getName() : '';
      return propName === 'getClientCapabilities';
    });

    expect(hasGetClientCaps).toBe(true);
  });

  // Requirement 6B: The "Create Passkey" entry-point button is conditionally gated and hidden when passkeys are unsupported.
  test('The "Create Passkey" entry-point button is conditionally gated and hidden when passkeys are unsupported', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const buttons = sourceFiles.flatMap((sf) =>
      sf.getDescendantsOfKind(SyntaxKind.JsxElement).filter((el) =>
        el.getOpeningElement().getTagNameNode().getText() === 'button'
      )
    );
    const createButton = buttons.find((b) => b.getText().toLowerCase().includes('create'));
    const isGated = Boolean(createButton && createButton.getAncestors().some((a) =>
      a.getKind() === SyntaxKind.BinaryExpression ||
      a.getKind() === SyntaxKind.ConditionalExpression ||
      a.getKind() === SyntaxKind.IfStatement
    ));

    expect(isGated).toBe(true);
  });
});
