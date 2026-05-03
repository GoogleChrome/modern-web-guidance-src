---
base_app: daily-grind
---
- implement step-up biometric identity verification in `index.html`. When a signed-in user clicks the re-verify button annotated with `data-testid="reauth-button"`, fetch options from `/api/reauth/options` via POST, decode them with `PublicKeyCredential.parseRequestOptionsFromJSON()`, and prompt the browser via the native `navigator.credentials.get()` WebAuthn API directly (do NOT wrap with third-party libraries). The server-supplied options scope `allowCredentials` strictly to the active user's pre-registered passkeys and set `userVerification: "required"` — pass them through verbatim. POST the resulting assertion to `/api/reauth/verify` to securely re-establish the verified session.

