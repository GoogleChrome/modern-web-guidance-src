---
name: quick-sign-ins
description: Authenticate returning users in place with their saved passkeys or passwords before navigating to a sign-in page or interrupting their workflow.
web-feature-ids:
  - webauthn
  - password-credentials
  - credential-management
  - webauthn-signals
---

# Quick sign-ins with immediate UI mode

Navigating an unauthenticated user to a dedicated sign-in page when they click a "Sign in" link, start checkout, save an item to favorites, or reach an article paywall causes context loss and increases user drop-off. Immediate UI mode (`uiMode: 'immediate'` in `navigator.credentials.get()`) enables contextual quick sign-ins by presenting a unified browser account chooser immediately when local passkeys (`publicKey`) or saved passwords (`password: true`) exist on the device.

Unlike standard modal WebAuthn prompts—which always display browser UI and fall back to cross-device QR codes or external security keys—Immediate UI mode fails fast with a `NotAllowedError` if no eligible credentials are locally available on the device. This lets your application authenticate returning users in place with a single tap while seamlessly transitioning users without local credentials to your standard sign-in page, guest checkout, or inline login form.

## Recommended UX patterns and anti-patterns

Trigger Immediate UI mode at moments of clear user intent **right before** navigating away from the current page:

- **Header sign-in link or button interception**: When a signed-out visitor clicks a "Sign in" link or button in the global header, intercept the navigation (`event.preventDefault()`) and invoke Immediate UI mode. If local credentials exist, the user signs in over the current page and the header updates in place; if `NotAllowedError` is thrown, proceed with navigating to the dedicated sign-in page.
- **Dynamic sign-in before checkout**: When an unauthenticated shopper clicks "Proceed to checkout" in their cart, invoke Immediate UI mode so returning customers with saved credentials sign in with a single tap and land directly on the shipping and payment confirmation screen. If no local credentials exist, transition to the standard sign-in or guest checkout screen.
- **Inline sign-in for micro-actions (Favorite, Like, Bookmark, Save)**: When a signed-out user clicks a micro-action button such as Favorite, Like, Bookmark, or Save on a product card or post, invoke Immediate UI mode in place. Once authenticated, immediately complete the micro-action and update the button state (for example, toggling `aria-pressed="true"`) without losing the user's scroll position. On `NotAllowedError`, open an inline login modal or navigate to the sign-in page with a return URL parameter (such as `/signin?r=/current-path`).
- **In-article soft paywalls**: When a reader clicks "Continue reading with your account" on a paywall banner, invoke Immediate UI mode at their current scroll position and reveal the full article in place upon authentication, or expand an inline sign-in or registration form on fallback.
- **DO NOT use Immediate UI mode on a dedicated sign-in page**: Never attach `uiMode: 'immediate'` to the primary "Sign in" or "Sign in with a passkey" button on your final destination sign-in page. Users reach the dedicated sign-in page specifically when they have no local credentials on the current device, or when they intend to use a cross-device passkey (scanning a QR code with a phone) or an external hardware security key. Because `uiMode: 'immediate'` suppresses cross-device QR code and security key options and immediately throws `NotAllowedError` when no local credentials exist, using it on a dedicated sign-in page traps the user in a dead end where clicking the button does nothing. On a dedicated sign-in page, use Conditional UI (`mediation: 'conditional'` with `autocomplete="username webauthn"`) on form inputs paired with a standard modal `navigator.credentials.get({ publicKey })` button (see {{ GUIDE_REF("passkey-authentication") }}).
- **DO NOT use Immediate UI mode for step-up reauthentication**: Never use `uiMode: 'immediate'` to reauthenticate an already signed-in user before sensitive operations (such as changing a password, updating a shipping address, editing saved payment methods, or adding a new passkey). Reauthentication flows require restricting the prompt to the signed-in user's credentials via a non-empty `allowCredentials` list, which browsers immediately reject with `NotAllowedError` in Immediate UI mode to prevent cross-session user tracking. Omitting `allowCredentials` during reauthentication is also an anti-pattern because the browser displays every credential saved on the device for your site, allowing the user to inadvertently select a different account than the one currently signed in. For step-up reauthentication where the user's identity is already known, use a standard modal WebAuthn request (`navigator.credentials.get({ publicKey })` without `uiMode: 'immediate'`) with `allowCredentials` populated with the signed-in user's registered credentials.

## Privacy and security constraints

Browsers enforce strict privacy and security rules when `uiMode: 'immediate'` is requested:

- **Transient user activation is required**: You MUST call `navigator.credentials.get({ uiMode: 'immediate' })` inside a user-initiated event handler (such as a `click` listener on a `<button>` or `<a>` element) to prevent silent credential probing. Never invoke it automatically on page load (`DOMContentLoaded`). Calling the API does not consume the transient activation.
- **Do not pass a non-empty `allowCredentials` list**: Do **NOT** populate `publicKey.allowCredentials` when `uiMode: 'immediate'` is specified. Browsers immediately reject any Immediate UI mode request with a non-empty `allowCredentials` list by throwing `NotAllowedError` so relying parties cannot probe for specific credential IDs to infer prior visits or track users across sessions.
- **Do not pass an `AbortSignal` (`signal`)**: Do **NOT** set the `signal` property on `navigator.credentials.get()` when `uiMode: 'immediate'` is specified, as browsers disallow programmatic dismissal of the immediate login dialog. If your page also runs a background Conditional UI (`mediation: 'conditional'`) request, call `abort()` on that Conditional UI `AbortController` before invoking Immediate UI mode, and omit `signal` from the immediate request itself.
- **Incognito and private browsing sessions**: Requests made in Incognito or private browsing windows always reject with `NotAllowedError` so private sessions remain indistinguishable from sessions without local credentials.

## Server-side setup

### Options generation endpoint

Expose an endpoint that generates discoverable WebAuthn request options for unauthenticated visitors:

1. **Generate a session-bound challenge**: Create a cryptographically random challenge buffer, store it in the server session, and encode it as Base64URL.
2. **Persist user verification preference**: Set `userVerification: 'preferred'` and store `expectedUserVerification: 'preferred'` in the session.
3. **Omit `allowCredentials`**: Do not include a non-empty `allowCredentials` list in the options for Immediate UI mode, as browsers reject non-empty allowlists with `NotAllowedError`.

```javascript
// Server-side options generation example (/api/login/options)
router.post('/api/login/options', (req, res) => {
  const options = {
    challenge: serverGeneratedBase64UrlChallenge, // High-entropy random challenge stored in session
    rpId: 'example.com',
    userVerification: 'preferred',
  };

  req.session.challenge = options.challenge;
  req.session.expectedUserVerification = 'preferred';
  return res.json(options);
});
```

### Dual credential verification endpoints

Because `navigator.credentials.get({ password: true, publicKey, uiMode: 'immediate' })` can resolve with either a passkey (`PublicKeyCredential`) or a saved password (`PasswordCredential`), provide verification handlers for both credential types:

1. **WebAuthn assertion verification (`/api/login/verify`)**: Verify the assertion against the session challenge and stored public key. If the credential ID is not found in the database, return HTTP status `404` so the client can notify the password manager via `PublicKeyCredential.signalUnknownCredential()`.
2. **Password verification (`/api/login/password`)**: Verify the `username` (`cred.id`) and `password` (`cred.password`) against the user database and establish an authenticated session.

## Client-side implementation

### Feature detection and unified credential request

1. **Load `webauthn-polyfills`**: Import `'webauthn-polyfills'` so `PublicKeyCredential.getClientCapabilities()`, `PublicKeyCredential.parseRequestOptionsFromJSON()`, and `PublicKeyCredential.prototype.toJSON()` are available across browsers supporting WebAuthn.
2. **Feature-detect `capabilities.immediateGet`**: Call `await PublicKeyCredential.getClientCapabilities()` and verify `capabilities.immediateGet === true`. **MANDATORY**: If `capabilities.immediateGet` is falsy, do **NOT** call `navigator.credentials.get({ uiMode: 'immediate' })`—browsers that do not recognize `uiMode: 'immediate'` will ignore the unknown dictionary key and open a blocking modal passkey and QR code dialog. Instead, immediately run your fallback sign-in flow.
3. **Request both passkeys and passwords**: Decode the server options using `PublicKeyCredential.parseRequestOptionsFromJSON()` and call `navigator.credentials.get()` with `password: true`, `publicKey`, and `uiMode: 'immediate'` (without passing `signal`).
4. **Branch verification by `cred.type`**:
    - If `cred.type === 'public-key'`, serialize the assertion with `cred.toJSON()` and POST it to your WebAuthn verification endpoint. When the server responds with HTTP `404`, call `PublicKeyCredential.signalUnknownCredential({ rpId: publicKey.rpId, credentialId: encoded.id })`.
    - If `cred.type === 'password'`, POST `{ username: cred.id, password: cred.password }` to your password verification endpoint.
5. **Handle `NotAllowedError` with a seamless fallback**: Catch `NotAllowedError` and trigger your fallback sign-in UI (such as opening a fallback sign-in dialog or navigating to `/signin` with a return URL).

```javascript
import 'webauthn-polyfills';

let isAuthenticating = false;

async function isImmediateUiSupported() {
  if (!window.PublicKeyCredential || !PublicKeyCredential.getClientCapabilities) {
    return false;
  }
  try {
    const capabilities = await PublicKeyCredential.getClientCapabilities();
    return Boolean(capabilities?.immediateGet);
  } catch {
    return false;
  }
}

async function authenticateWithImmediateUi() {
  // MANDATORY: Check immediateGet support so unsupported browsers do not open a modal QR dialog
  const supported = await isImmediateUiSupported();
  if (!supported) {
    const err = new DOMException('Immediate UI mode is not supported', 'NotAllowedError');
    throw err;
  }

  const optionsResponse = await fetch('/api/login/options', { method: 'POST' });
  if (!optionsResponse.ok) {
    throw new Error('Failed to fetch authentication options');
  }
  const optionsJSON = await optionsResponse.json();
  const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(optionsJSON);

  // MANDATORY: Request both password and publicKey with uiMode: 'immediate' and NO signal parameter
  const cred = await navigator.credentials.get({
    password: true,
    publicKey,
    uiMode: 'immediate',
  });

  if (!cred) {
    throw new DOMException('No credential returned', 'NotAllowedError');
  }

  if (cred.type === 'public-key') {
    const encoded = cred.toJSON();
    const verifyResponse = await fetch('/api/login/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encoded),
    });

    if (verifyResponse.status === 404) {
      if (PublicKeyCredential.signalUnknownCredential) {
        await PublicKeyCredential.signalUnknownCredential({
          rpId: publicKey.rpId || window.location.hostname,
          credentialId: encoded.id, // Base64URL-encoded credential ID string
        });
      }
      throw new Error('Passkey credential is no longer recognized by the server');
    }

    if (!verifyResponse.ok) {
      throw new Error('Passkey verification failed');
    }
    return await verifyResponse.json();
  }

  if (cred.type === 'password') {
    const verifyResponse = await fetch('/api/login/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cred.id,
        password: cred.password,
      }),
    });

    if (!verifyResponse.ok) {
      throw new Error('Password verification failed');
    }
    return await verifyResponse.json();
  }

  throw new Error(`Unsupported credential type: ${cred.type}`);
}

// Example: Intercepting an inline micro-action (Favorite button) or Header Sign-in click
const favoriteButton = document.getElementById('favorite-btn');

favoriteButton.addEventListener('click', async (event) => {
  event.preventDefault();
  if (isAuthenticating) return;

  // If already signed in, toggle the micro-action state immediately
  if (document.body.dataset.signedIn === 'true') {
    const nextPressed = favoriteButton.getAttribute('aria-pressed') !== 'true';
    favoriteButton.setAttribute('aria-pressed', String(nextPressed));
    return;
  }

  isAuthenticating = true;
  try {
    const user = await authenticateWithImmediateUi();
    // Update signed-in state in place and complete the user's intended action
    document.body.dataset.signedIn = 'true';
    favoriteButton.setAttribute('aria-pressed', 'true');
    updateHeaderUserState(user);
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      // No local credentials available, user dismissed dialog, or browser unsupported:
      // transition smoothly to fallback sign-in UI or redirect with return URL
      showFallbackSignInUi({ returnAction: 'favorite' });
      return;
    }
    console.error('Authentication error:', err);
  } finally {
    isAuthenticating = false;
  }
});
```

## Fallback strategies

### Immediate UI mode and client capabilities fallback

{{ BASELINE_STATUS("webauthn", "api.PublicKeyCredential.getClientCapabilities_static") }}

Always install `'webauthn-polyfills'` and import it in your client module so `PublicKeyCredential.getClientCapabilities()` is available whenever `PublicKeyCredential` is supported:

```javascript
import 'webauthn-polyfills';
```

- **Progressive enhancement experience**: `uiMode: 'immediate'` is a progressive enhancement supported in Chromium-based browsers. Always check `capabilities.immediateGet` via `PublicKeyCredential.getClientCapabilities()` before calling `navigator.credentials.get({ uiMode: 'immediate' })`. When `capabilities.immediateGet` is falsy, or when `navigator.credentials.get()` rejects with `NotAllowedError`, fall back to your application's standard sign-in experience (such as opening an inline sign-in modal or navigating to the dedicated sign-in page with a return URL parameter).

### Password credentials fallback

{{ BASELINE_STATUS("password-credentials") }}

Passing `password: true` alongside `publicKey` in `navigator.credentials.get()` allows supporting browsers to include saved passwords from the browser's password manager in the unified immediate account chooser.

- **Fallback experience**: Browsers that do not support `PasswordCredential` ignore the `password: true` option or fall back via the `capabilities.immediateGet` feature check to the standard sign-in form, where `<input autocomplete="username webauthn">` and `<input type="password" autocomplete="current-password">` provide native password autofill.

### Easy JSON serialization fallback

{{ BASELINE_STATUS("webauthn", "api.PublicKeyCredential.parseRequestOptionsFromJSON_static") }}

Always install `'webauthn-polyfills'` and import it in the client bundle so `PublicKeyCredential.parseRequestOptionsFromJSON()` and `PublicKeyCredential.prototype.toJSON()` work consistently across browsers supporting `PublicKeyCredential`:

```javascript
import 'webauthn-polyfills';
```

### Signal API synchronization fallback

{{ BASELINE_STATUS("webauthn-signals") }}

{{ BASELINE_STATUS("credential-management") }}

The WebAuthn Signal API (`webauthn-signals`) is a progressive enhancement that removes stale passkeys from the user's password manager when the server responds with HTTP `404`.

- **Fallback experience**: Gate calls behind `if (PublicKeyCredential.signalUnknownCredential)`. When unsupported, skip the signal call gracefully and display a clear message guiding the user to sign in with an alternative method.
