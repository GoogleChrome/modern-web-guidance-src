import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
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
        return (val.includes('credential') || val.includes('passkey')) && !val.includes('authenticatorselection');
      });
    });

    const hasLoadFetch = sourceFiles.some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasLifecycleLoad = calls.some((call) => {
        const expr = call.getExpression().getText();
        return (
          expr === 'useEffect' ||
          expr === 'React.useEffect' ||
          (expr.includes('addEventListener') && call.getArguments().some((a) => a.getText().includes('DOMContentLoaded')))
        );
      });
      const hasFetch = calls.some((call) => /fetch/i.test(call.getExpression().getText()));
      return hasLifecycleLoad || hasFetch;
    });

    expect(hasCredentialEndpoint && hasLoadFetch).toBe(true);
  });

  // Requirement 2: The application automatically invokes signalAllAcceptedCredentials on load to sync accepted credentials.
  test('The application automatically invokes signalAllAcceptedCredentials on load to sync accepted credentials', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasSignalAllOnLoad = sourceFiles.some((sf) => {
      const hasSignalAll = sf
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .some((id) => id.getText() === 'signalAllAcceptedCredentials');
      if (!hasSignalAll) return false;

      const fnDecls = new Set<string>();
      for (const fn of sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
        if (fn.getFullText().includes('signalAllAcceptedCredentials') && fn.getName()) {
          fnDecls.add(fn.getName()!);
        }
      }
      for (const vd of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
        if (vd.getFullText().includes('signalAllAcceptedCredentials')) {
          fnDecls.add(vd.getName());
        }
      }

      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const invokesInLoad = calls.some((call) => {
        const expr = call.getExpression().getText();
        const isLoad =
          expr === 'useEffect' ||
          expr === 'React.useEffect' ||
          (expr.includes('addEventListener') && call.getArguments().some((a) => a.getText().includes('DOMContentLoaded')));
        if (!isLoad) return false;
        const ids = call.getDescendantsOfKind(SyntaxKind.Identifier).map((id) => id.getText());
        return ids.some(
          (id) =>
            id === 'signalAllAcceptedCredentials' ||
            fnDecls.has(id) ||
            /sync|load|fetch|init|credential|passkey/i.test(id)
        );
      });

      const invokesTopLevelHelper = calls.some((call) => {
        const name = call.getExpression().getText();
        return fnDecls.has(name);
      });

      return invokesInLoad || invokesTopLevelHelper;
    });

    expect(hasSignalAllOnLoad).toBe(true);
  });

  // Requirement 3: The application updates passkey providers by immediately calling signalAllAcceptedCredentials within delete trigger handler.
  test('The application updates passkey providers by calling signalAllAcceptedCredentials within the delete trigger handler', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const updatesOnDelete = sourceFiles.some((sf) => {
      const hasSignalInFile = sf
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .some((id) => id.getText() === 'signalAllAcceptedCredentials');
      if (!hasSignalInFile) return false;

      const fnDeclsWithSignal = new Set<string>();
      for (const fn of sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
        if (fn.getFullText().includes('signalAllAcceptedCredentials') && fn.getName()) {
          fnDeclsWithSignal.add(fn.getName()!);
        }
      }
      for (const vd of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
        if (vd.getFullText().includes('signalAllAcceptedCredentials')) {
          fnDeclsWithSignal.add(vd.getName());
        }
      }

      const fns = [
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
        ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionExpression),
      ];
      return fns.some((fn) => {
        const parent = fn.getParent();
        const fnName =
          parent && Node.isVariableDeclaration(parent)
            ? parent.getName()
            : Node.isFunctionDeclaration(fn)
              ? fn.getName() || ''
              : '';
        const isDeleteHandler =
          /delete|remove|revoke/i.test(fnName) ||
          fn.getDescendantsOfKind(SyntaxKind.StringLiteral).some((lit) => /DELETE|delete|remove/i.test(lit.getLiteralValue())) ||
          fn.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => /delete|remove|revoke/i.test(id.getText()));
        if (!isDeleteHandler) return false;

        const ids = fn.getDescendantsOfKind(SyntaxKind.Identifier).map((id) => id.getText());
        return ids.some(
          (n) =>
            n === 'signalAllAcceptedCredentials' ||
            fnDeclsWithSignal.has(n) ||
            /sync|load|refresh|fetch/i.test(n)
        );
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
        const hasSignalId = fn
          .getDescendantsOfKind(SyntaxKind.Identifier)
          .some((id) => id.getText() === 'signalCurrentUserDetails');
        if (!hasSignalId) return false;
        const fullText = fn.getFullText();
        return /user|profile|rename|name|displayName|username/i.test(fullText);
      });
    });

    expect(updatesOnRename).toBe(true);
  });

  // Requirement 5A: Passkey provider metadata is resolved against an AAGUID registry.
  test('Passkey provider metadata is resolved against an AAGUID registry', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasAaguidResolution = sourceFiles.some((sf) => {
      const fullText = sf.getFullText();
      const hasAaguid = /aaguid/i.test(fullText);
      const hasProviderOrRegistry = /aaguids|registry|provider|Google Password Manager|iCloud Keychain|1Password|Bitwarden/i.test(
        fullText
      );
      return hasAaguid && hasProviderOrRegistry;
    });

    expect(hasAaguidResolution).toBe(true);
  });

  // Requirement 5B: Each credential row renders the passkey provider icon.
  test('Each credential row renders the passkey provider icon', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const docs = getHtmlDocuments(targetFiles);

    const rendersInJsxOrJs = sourceFiles.some((sf) => {
      const fullText = sf.getFullText();
      if (!/aaguid|credential|passkey/i.test(fullText)) return false;
      const jsxElements = [
        ...sf.getDescendantsOfKind(SyntaxKind.JsxElement),
        ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
      ];
      const hasJsxIcon = jsxElements.some((el) => {
        const tagName = Node.isJsxElement(el)
          ? el.getOpeningElement().getTagNameNode().getText()
          : el.getTagNameNode().getText();
        const isIconTag = tagName === 'img' || tagName === 'svg' || tagName.toLowerCase().includes('icon');
        return isIconTag && /icon|provider|logo|aaguid/i.test(el.getText());
      });
      const hasDomOrTemplateIcon = /<img\b|createElement\(\s*['"]img['"]|\.icon/i.test(fullText);
      return hasJsxIcon || hasDomOrTemplateIcon;
    });

    const rendersInHtml = docs.some((d) => {
      return d.document.querySelectorAll('img[src*="icon"], img[alt*="icon" i], [class*="provider-icon"]').length > 0;
    });

    expect(rendersInJsxOrJs || rendersInHtml).toBe(true);
  });

  // Requirement 5C: Each credential row renders the credential or provider name.
  test('Each credential row renders the credential or provider name', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const rendersName = sourceFiles.some((sf) => {
      const fullText = sf.getFullText();
      if (!/aaguid|credential|passkey/i.test(fullText)) return false;
      return /\.(name|displayName|nickname|providerName)\b/i.test(fullText);
    });

    expect(rendersName).toBe(true);
  });

  // Requirement 5D: Each credential row renders a formatted human-readable last-used timestamp.
  test('Each credential row renders a formatted human-readable last-used timestamp', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const rendersFormattedLastUsed = sourceFiles.some((sf) => {
      const fullText = sf.getFullText();
      if (!/last_?used|lastUsed/i.test(fullText)) return false;
      return /toLocaleDateString|toLocaleString|DateTimeFormat|formatDate|formatHumanReadableDate|new Date\(/i.test(
        fullText
      );
    });

    expect(rendersFormattedLastUsed).toBe(true);
  });

  // Requirement 6A: Passkey platform authenticator capability is detected via PublicKeyCredential.getClientCapabilities.
  test('Passkey platform authenticator capability is detected via PublicKeyCredential.getClientCapabilities', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const calls = sourceFiles.flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasGetClientCaps = calls.some((call) => {
      const expr = call.getExpression().getText();
      return /getClientCapabilities|isUserVerifyingPlatformAuthenticatorAvailable/i.test(expr);
    });

    expect(hasGetClientCaps).toBe(true);
  });

  // Requirement 6B: The "Create Passkey" entry-point button is conditionally gated and hidden when passkeys are unsupported.
  test('The "Create Passkey" entry-point button is conditionally gated and hidden when passkeys are unsupported', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const docs = getHtmlDocuments(targetFiles);

    const isGatedInJs = sourceFiles.some((sf) => {
      const buttons = [
        ...sf.getDescendantsOfKind(SyntaxKind.JsxElement),
        ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
      ].filter((el) => {
        const tag = Node.isJsxElement(el)
          ? el.getOpeningElement().getTagNameNode().getText()
          : el.getTagNameNode().getText();
        return tag === 'button' || /create|add|register/i.test(el.getText());
      });
      const hasGatedJsx = buttons.some(
        (b) =>
          /create|add|register|passkey/i.test(b.getText()) &&
          b.getAncestors().some(
            (a) =>
              a.getKind() === SyntaxKind.BinaryExpression ||
              a.getKind() === SyntaxKind.ConditionalExpression ||
              a.getKind() === SyntaxKind.IfStatement
          )
      );
      const fullText = sf.getFullText();
      const hasImperativeGate =
        /getClientCapabilities|isUserVerifyingPlatformAuthenticatorAvailable|PublicKeyCredential/.test(fullText) &&
        (/\.hidden\b|\.style\.display|classList\.(add|remove|toggle)|setCanCreate|setSupported|setIsSupported|supported|canCreate/i.test(
          fullText
        ));
      return hasGatedJsx || hasImperativeGate;
    });

    const isGatedInHtml = docs.some((d) => {
      return d.document.querySelectorAll('button[hidden], [id*="create-passkey" i], [class*="create-passkey" i]').length > 0;
    });

    expect(isGatedInJs || isGatedInHtml).toBe(true);
  });
});
