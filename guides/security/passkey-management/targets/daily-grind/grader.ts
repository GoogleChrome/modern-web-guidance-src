import * as path from 'path';
import { pathToFileURL } from 'url';
import { SyntaxKind } from 'ts-morph';
import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';

const currentFileUrl = typeof __filename !== 'undefined'
  ? pathToFileURL(__filename).href
  : pathToFileURL(path.resolve(process.cwd(), 'grader.ts')).href;

const targetFiles: string[] = getTargetFiles(currentFileUrl);

test.describe('Passkey Management Target Grader', () => {

  test('The application fetches registered credentials from the credential endpoint on load', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasCredentialEndpointCall = sourceFiles.some(sf => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return calls.some(call => {
        const callText = call.getText();
        const args = call.getArguments().map(a => a.getText());
        return (/fetch|api/i.test(call.getExpression().getText()) || callText.includes('fetch(')) &&
          (args.some(a => /credential/i.test(a)) || callText.includes('/api/credentials'));
      });
    });

    const hasLoadTrigger = sourceFiles.some(sf => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasListener = calls.some(call => {
        const text = call.getText();
        return text.includes('addEventListener') && (/DOMContentLoaded/i.test(text) || /\bload\b/i.test(text));
      });
      const hasTopLevelInvocation = sf.getStatements().some(stmt => {
        const text = stmt.getText();
        return /loadManagementPanel|load.*credential|init/i.test(text);
      });
      return hasListener || hasTopLevelInvocation;
    });

    expect(hasCredentialEndpointCall && hasLoadTrigger).toBe(true);
  });

  test('The application automatically invokes signalAllAcceptedCredentials on load to sync credentials with the password manager', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasSignalAllAccepted = sourceFiles.some(sf => {
      return sf.getDescendantsOfKind(SyntaxKind.Identifier).some(id => id.getText() === 'signalAllAcceptedCredentials');
    });

    const hasLoadSync = sourceFiles.some(sf => {
      const text = sf.getFullText();
      return (/DOMContentLoaded|load|mount|init/i.test(text)) &&
        /signalAllAcceptedCredentials|sync.*AcceptedCredentials|sync.*Credentials/i.test(text);
    });

    expect(hasSignalAllAccepted && hasLoadSync).toBe(true);
  });

  test('The application updates passkey providers by immediately calling signalAllAcceptedCredentials within the delete trigger handler upon successful deletions', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasDeleteWithSignal = sourceFiles.some(sf => {
      const callableNodes = [
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
        ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionExpression),
        ...sf.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
      ];
      return callableNodes.some(node => {
        const text = node.getText();
        const isDeleteHandler = /delete/i.test(text) && (text.includes('DELETE') || text.includes('deleteFetch') || /api.*credential/i.test(text));
        const callsSignal = text.includes('signalAllAcceptedCredentials') || /sync.*AcceptedCredentials|sync.*Credentials/i.test(text);
        return isDeleteHandler && callsSignal;
      });
    });

    expect(hasDeleteWithSignal).toBe(true);
  });

  test('The application invokes signalCurrentUserDetails within the user profile rename handler upon successful username or display name rename', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasUserRenameWithSignal = sourceFiles.some(sf => {
      const callableNodes = [
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
        ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionExpression),
        ...sf.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
      ];
      return callableNodes.some(node => {
        const text = node.getText();
        const isUserRenameHandler = (/displayName/i.test(text) || /username/i.test(text) || /profile/i.test(text) || /updateUser/i.test(text) || text.includes('/api/user')) &&
          (/rename/i.test(text) || /update/i.test(text) || /submit/i.test(text) || /save/i.test(text));
        const callsSignal = text.includes('signalCurrentUserDetails') || /syncCurrentUserDetails/i.test(text);
        return isUserRenameHandler && callsSignal;
      });
    });

    expect(hasUserRenameWithSignal).toBe(true);
  });

  test('Each credential row resolved against the AAGUID registry renders info such as the provider icon, name and a human-readable last-used timestamp', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const fullProjectText = sourceFiles.map(sf => sf.getFullText()).join('\n');
    const hasAaguidLookup = /aaguid/i.test(fullProjectText) && (/registry|resolve|aaguids/i.test(fullProjectText));
    const hasLastUsedFormatting = /lastUsed/i.test(fullProjectText) && (/toLocaleDateString|DateTimeFormat|formatDate|formatTimestamp|new Date/i.test(fullProjectText));
    const hasProviderIcon = /providerIcon|icon_light|icon_dark|provider-icon/i.test(fullProjectText);
    const hasNameRendering = /name/i.test(fullProjectText);

    expect(hasAaguidLookup && hasLastUsedFormatting && hasProviderIcon && hasNameRendering).toBe(true);
  });

  test('The "Create Passkey" entry-point button is gated on PublicKeyCredential.getClientCapabilities and hidden when passkey is unsupported', () => {
    const project = getJsProject(targetFiles);
    const docs = getHtmlDocuments(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasClientCapabilitiesCheck = sourceFiles.some(sf => {
      const hasMethod = sf.getDescendantsOfKind(SyntaxKind.Identifier).some(id => id.getText() === 'getClientCapabilities');
      const text = sf.getFullText();
      const gatesButton = /hidden|display/i.test(text) && /create.*passkey|createButton|btn.*create/i.test(text);
      return hasMethod && gatesButton;
    });

    const hasCreateButtonInHtml = docs.some(d => {
      const allButtons = Array.from(d.document.querySelectorAll('button, [role="button"], a'));
      return allButtons.some((el: any) =>
        /create.*passkey/i.test(el.textContent || '') ||
        /create-passkey/i.test(el.id || '') ||
        /create-passkey/i.test(el.getAttribute('data-testid') || '')
      );
    });

    expect(hasClientCapabilitiesCheck && hasCreateButtonInHtml).toBe(true);
  });

});
