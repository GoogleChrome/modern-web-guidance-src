import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
} from '../../../../test-fixture.ts';
import { SyntaxKind } from 'ts-morph';

const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('passkey-management Target Grader', () => {

  // --- REQUIREMENT 1: Registered credentials fetching on load ---
  test('The application fetches registered credentials from the credential endpoint on load.', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const fetchesCredentials = sourceFiles.some((sf) => {
      const text = sf.getFullText();
      const hasCredEndpoint = /api\/credentials?|\bcredentials?\b/i.test(text);
      const hasFetchCall = sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const expr = call.getExpression().getText();
        return expr === 'fetch' || expr.endsWith('.fetch') || /fetch/i.test(expr);
      });
      return hasCredEndpoint && hasFetchCall;
    });

    expect(fetchesCredentials).toBe(true);
  });

  // --- REQUIREMENT 2: signalAllAcceptedCredentials invocation on page load ---
  test('The application automatically invokes signalAllAcceptedCredentials on load (for example, via DOMContentLoaded or component mount) to sync accepted credentials list strings with the password manager.', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const syncsOnLoad = sourceFiles.some((sf) => {
      const text = sf.getFullText();
      const callsSignalAll = text.includes('signalAllAcceptedCredentials');
      const handlesLoadEvent = text.includes('DOMContentLoaded') || text.includes('readyState') || text.includes('useEffect') || /loadManagement|syncAcceptedCredentials/i.test(text);
      const passesCredentialIds = text.includes('allAcceptedCredentialIds') || /credentialIds|currentCredentials/i.test(text);
      return callsSignalAll && handlesLoadEvent && passesCredentialIds;
    });

    expect(syncsOnLoad).toBe(true);
  });

  // --- REQUIREMENT 3: signalAllAcceptedCredentials invocation in delete handler ---
  test('The application updates passkey providers by immediately calling signalAllAcceptedCredentials within the delete trigger handler upon successful deletions.', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const syncsOnDelete = sourceFiles.some((sf) => {
      const functions = [
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
        ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionExpression),
        ...sf.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
      ];

      return functions.some((fn) => {
        const fnText = fn.getFullText();
        const parentVarText = fn.getParent()?.getKind() === SyntaxKind.VariableDeclaration
          ? fn.getParent()?.getText() || ''
          : '';
        const fnName = 'getName' in fn && typeof (fn as any).getName === 'function'
          ? (fn as any).getName() || ''
          : '';

        const isDeleteHandler =
          /delete/i.test(fnName) ||
          /delete/i.test(parentVarText) ||
          /method:\s*['"`]DELETE['"`]|deleteFetch|\.delete\(/i.test(fnText);

        if (!isDeleteHandler) return false;

        return /signalAllAcceptedCredentials|syncAcceptedCredentials/i.test(fnText);
      });
    });

    expect(syncsOnDelete).toBe(true);
  });

  // --- REQUIREMENT 4: signalCurrentUserDetails invocation in rename handler ---
  test('The application invokes signalCurrentUserDetails within the user profile rename handler upon successful username or display name rename.', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const signalsUserDetails = sourceFiles.some((sf) => {
      const text = sf.getFullText();
      const callsSignalUserDetails = text.includes('signalCurrentUserDetails');
      const hasNameProps = /displayName|name/i.test(text);
      const hasUserContext = /user|profile|account|rename/i.test(text);
      return callsSignalUserDetails && hasNameProps && hasUserContext;
    });

    expect(signalsUserDetails).toBe(true);
  });

  // --- REQUIREMENT 5: AAGUID registry resolution and credential row rendering ---
  test('Each credential row resolved against the AAGUID registry renders info such as the provider icon, name and a human-readable last-used timestamp.', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasAaguidResolution = sourceFiles.some((sf) => {
      const text = sf.getFullText();
      const hasAaguidRef = /aaguid/i.test(text);
      const hasFallbackOrLookup =
        /00000000-0000-0000-0000-000000000000|ZERO_AAGUID|aaguids|aaguidRegistry|AAGUID_REGISTRY/i.test(text);
      return hasAaguidRef && hasFallbackOrLookup;
    }) || targetFiles.some((f) => /aaguid.*\.json$/i.test(f));

    const rendersCredentialInfo = sourceFiles.some((sf) => {
      const text = sf.getFullText();
      const hasLastUsed = /lastUsedAt|lastUsed|last-used/i.test(text);
      const hasDateFormatting = /DateTimeFormat|toLocale|Date|formatDate|formatTimestamp|formatHumanReadableDate/i.test(text);
      const hasIconOrName = /providerIcon|iconLight|icon_light|icon_dark|provider-icon|displayName|passkey-name|name/i.test(text);
      return hasLastUsed && hasDateFormatting && hasIconOrName;
    });

    expect(hasAaguidResolution && rendersCredentialInfo).toBe(true);
  });

  // --- REQUIREMENT 6: Create Passkey button capability gating ---
  test('The "Create Passkey" entry-point button is gated on PublicKeyCredential.getClientCapabilities and hidden when passkey is unsupported.', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const gatesCreatePasskey = sourceFiles.some((sf) => {
      const text = sf.getFullText();
      const hasGetClientCapabilities = text.includes('getClientCapabilities');
      const checksPlatformAuth = /passkeyPlatformAuthenticator|userVerifyingPlatformAuthenticator/i.test(text);
      const gatesButton = /create.*passkey|canCreatePasskey|isPasskeySupported|createButton|unsupported|hidden|display/i.test(text);
      return hasGetClientCapabilities && (checksPlatformAuth || gatesButton);
    });

    expect(gatesCreatePasskey).toBe(true);
  });
});

