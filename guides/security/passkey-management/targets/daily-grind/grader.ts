import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind } from 'ts-morph';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('Passkey Management Target Grader', () => {
  const appFiles = targetFiles.filter(f => !f.includes('node_modules'));

  test('The application fetches registered credentials from the credential endpoint on load.', () => {
    const project = getJsProject(appFiles);
    const sourceFiles = project.getSourceFiles();

    const hasCredentialFetchOnLoad = sourceFiles.some(sf => {
      const text = sf.getFullText();
      const hasCredentialEndpoint = /\/api\/credentials|\/credentials\b/i.test(text);
      const hasFetchOrApi = /\b(fetch|listFetch|listCredentials|apiFetch|getCredentials|loadManagementPanel)\b/.test(text);
      const hasLoadTrigger = /\b(DOMContentLoaded|loadManagementPanel|refreshCredentials|syncAcceptedCredentialsOnLoad|onload|init)\b/i.test(text);
      return hasCredentialEndpoint && (hasFetchOrApi || hasLoadTrigger);
    });

    expect(hasCredentialFetchOnLoad).toBe(true);
  });

  test('The application automatically invokes signalAllAcceptedCredentials on load via DOMContentLoaded to sync accepted credentials list strings with the password manager.', () => {
    const project = getJsProject(appFiles);
    const sourceFiles = project.getSourceFiles();

    const hasSignalAll = sourceFiles.some(sf => {
      const text = sf.getFullText();
      return /\bsignalAllAcceptedCredentials\b/.test(text);
    });
    const hasDomContentLoaded = sourceFiles.some(sf => {
      const text = sf.getFullText();
      return /\bDOMContentLoaded\b/.test(text) && /\b(signalAllAcceptedCredentials|syncAcceptedCredentials|signalAcceptedCredentials|loadManagementPanel|init|syncAcceptedCredentialsOnLoad)\b/.test(text);
    });

    expect(hasSignalAll && hasDomContentLoaded).toBe(true);
  });

  test('The application updates passkey providers by immediately calling signalAllAcceptedCredentials within the delete trigger handler upon successful deletions.', () => {
    const project = getJsProject(appFiles);
    const sourceFiles = project.getSourceFiles();

    const signalFunctions = new Set<string>(['signalAllAcceptedCredentials']);
    for (let iter = 0; iter < 3; iter++) {
      for (const sf of sourceFiles) {
        for (const fn of sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
          const fnText = fn.getFullText();
          const name = fn.getName();
          if (name && Array.from(signalFunctions).some(sig => new RegExp(`\\b${sig}\\b`).test(fnText))) {
            signalFunctions.add(name);
          }
        }
        for (const varDecl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
          const varText = varDecl.getFullText();
          const name = varDecl.getName();
          if (name && Array.from(signalFunctions).some(sig => new RegExp(`\\b${sig}\\b`).test(varText))) {
            signalFunctions.add(name);
          }
        }
      }
    }

    const hasDeleteSignal = sourceFiles.some(sf => {
      const functions = [
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
        ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionExpression),
      ];

      return functions.some(fn => {
        const text = fn.getFullText();
        const isDeleteRelated = /\b(delete|DELETE|deleteFetch|deleteCredential|handleDelete|performDelete)\b/.test(text);
        if (!isDeleteRelated) return false;
        return Array.from(signalFunctions).some(sigFn => new RegExp(`\\b${sigFn}\\b`).test(text)) || /\b(sync|signal).*credential/i.test(text);
      });
    });

    expect(hasDeleteSignal).toBe(true);
  });

  test('The application invokes signalCurrentUserDetails within the rename click handler upon successful username or display name rename.', () => {
    const project = getJsProject(appFiles);
    const sourceFiles = project.getSourceFiles();

    const hasUserRenameSignal = sourceFiles.some(sf => {
      const text = sf.getFullText();
      const hasSignal = /\bsignalCurrentUserDetails\b/.test(text);
      const hasUserOrRename = /\b(rename|displayName|name|user|performRename|handleUserRename|renameCurrentUser|signalUserDetails|signalRenamedUser)\b/i.test(text);
      return hasSignal && hasUserOrRename;
    });

    expect(hasUserRenameSignal).toBe(true);
  });

  test('Each credential row resolved against the AAGUID registry renders info such as the provider icon, name and a human-readable last-used timestamp.', () => {
    const project = getJsProject(appFiles);
    const sourceFiles = project.getSourceFiles();
    const htmlDocs = getHtmlDocuments(appFiles);

    const hasAaguidResolution = sourceFiles.some(sf => {
      const text = sf.getFullText();
      return /\b(aaguid|aaguids|resolveProvider|providerFor|aaguidRegistry)\b/i.test(text);
    }) || appFiles.some(f => /aaguid/i.test(f));

    const hasLastUsedFormatting = sourceFiles.some(sf => {
      const text = sf.getFullText();
      const hasLastUsed = /\blastUsed(At)?\b/i.test(text);
      const hasFormatting = /\b(toLocale|Intl|Date|formatDate|formatTimestamp|time)\b/i.test(text);
      return hasLastUsed && hasFormatting;
    });

    const hasProviderRendering = sourceFiles.some(sf => {
      const text = sf.getFullText();
      const hasIcon = /\b(providerIcon|icon|icon_light|icon_dark|credential-icon|icon-button)\b/i.test(text);
      const hasName = /\b(credential-name|name|displayName|provider\.name)\b/i.test(text);
      return hasIcon && hasName;
    }) || htmlDocs.some(doc => {
      return doc.document.querySelector('.credential-icon, [class*="icon"], img, template') !== null;
    });

    expect(hasAaguidResolution && hasLastUsedFormatting && hasProviderRendering).toBe(true);
  });

  test('The "Create Passkey" entry-point button is gated on PublicKeyCredential.getClientCapabilities and hidden when passkey is unsupported.', () => {
    const project = getJsProject(appFiles);
    const sourceFiles = project.getSourceFiles();

    const hasGatedCreateButton = sourceFiles.some(sf => {
      const text = sf.getFullText();
      const hasCapabilities = /\bgetClientCapabilities\b/.test(text);
      const hasButtonGating = /\b(hidden|display|passkeySupport|supported|createPasskey|create-passkey|createButton|create-actions|passkey-unsupported)\b/i.test(text);
      return hasCapabilities && hasButtonGating;
    });

    expect(hasGatedCreateButton).toBe(true);
  });
});
