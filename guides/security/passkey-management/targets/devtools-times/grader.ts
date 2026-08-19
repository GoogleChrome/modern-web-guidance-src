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
  test('Application fetches registered credentials from credential endpoint on load', () => {
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
  test('Application automatically invokes signalAllAcceptedCredentials on load via DOMContentLoaded to sync credentials', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const syncsOnLoad = sourceFiles.some((sf) => {
      const text = sf.getFullText();
      const callsSignalAll = text.includes('signalAllAcceptedCredentials');
      const handlesLoadEvent = text.includes('DOMContentLoaded') || text.includes('readyState') || text.includes('useEffect');
      const passesCredentialIds = text.includes('allAcceptedCredentialIds') || /credentialIds|currentCredentials/i.test(text);
      return callsSignalAll && handlesLoadEvent && passesCredentialIds;
    });

    expect(syncsOnLoad).toBe(true);
  });

  // --- REQUIREMENT 3: signalAllAcceptedCredentials invocation in delete handler ---
  test('Application updates passkey providers by calling signalAllAcceptedCredentials within delete trigger handler', () => {
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
  test('Application invokes signalCurrentUserDetails within rename click handler upon user rename', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const signalsUserDetails = sourceFiles.some((sf) => {
      const text = sf.getFullText();
      const callsSignalUserDetails = text.includes('signalCurrentUserDetails');
      const hasNameProps = /displayName|name/i.test(text);
      const hasUserContext = /user|profile|account/i.test(text);
      return callsSignalUserDetails && hasNameProps && hasUserContext;
    });

    expect(signalsUserDetails).toBe(true);
  });

  // --- REQUIREMENT 5A: AAGUID registry resolution and fallback ---
  test('Passkey provider info is resolved against AAGUID registry with zeroed AAGUID fallback', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasAaguidResolution = sourceFiles.some((sf) => {
      const text = sf.getFullText();
      const hasAaguidRef = /aaguid/i.test(text);
      const hasFallbackOrLookup =
        /00000000-0000-0000-0000-000000000000|ZERO_AAGUID|aaguids|aaguidRegistry|AAGUID_REGISTRY/i.test(text);
      return hasAaguidRef && hasFallbackOrLookup;
    }) || targetFiles.some((f) => /aaguid.*\.json$/i.test(f));

    expect(hasAaguidResolution).toBe(true);
  });

  // --- REQUIREMENT 5B: Credential row info and last-used timestamp rendering ---
  test('Each credential row renders provider icon, name, and human-readable last-used timestamp', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const rendersCredentialInfo = sourceFiles.some((sf) => {
      const text = sf.getFullText();
      const hasLastUsed = /lastUsedAt|lastUsed|last-used/i.test(text);
      const hasDateFormatting = /DateTimeFormat|toLocaleDateString|formatDate|formatTimestamp|formatHumanReadableDate/i.test(text);
      const hasIconOrName = /providerIcon|iconLight|provider-icon|displayName|passkey-name/i.test(text);
      return hasLastUsed && hasDateFormatting && hasIconOrName;
    });

    expect(rendersCredentialInfo).toBe(true);
  });

  // --- REQUIREMENT 6: Create Passkey button capability gating ---
  test('Create Passkey entry-point button is gated on PublicKeyCredential.getClientCapabilities and hidden when unsupported', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const gatesCreatePasskey = sourceFiles.some((sf) => {
      const text = sf.getFullText();
      const hasGetClientCapabilities = text.includes('getClientCapabilities');
      const checksPlatformAuth = /passkeyPlatformAuthenticator|userVerifyingPlatformAuthenticator/i.test(text);
      const gatesButton = /create.*passkey|canCreatePasskey|isPasskeySupported|createButton|unsupported/i.test(text);
      return hasGetClientCapabilities && (checksPlatformAuth || gatesButton);
    });

    expect(gatesCreatePasskey).toBe(true);
  });

  // --- REQUIREMENT 7: WebAuthn Polyfills import for browser capability fallback ---
  test('WebAuthn polyfills are imported to support client capabilities and signal APIs', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const importsPolyfill = sourceFiles.some((sf) => {
      const text = sf.getFullText();
      return text.includes('webauthn-polyfills');
    });

    expect(importsPolyfill).toBe(true);
  });
});
