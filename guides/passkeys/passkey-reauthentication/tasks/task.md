---
base_app: daily-grind
---
- implement step-up biometric identity verification in the root `index.html` file. when a signed-in user clicks a "step up biometrics re-verify" button annotated with `data-testid="reauth-button"`, request cryptographic options from the server using a POST request to `/api/reauth/options`.
- ensure the server scopes options strictly to the user's pre-registered credentials, and the client decodes options before prompting the browser prompt biometrics.
- verify the biometric assertion signature using a POST request to `/api/reauth/verify` to securely re-establish the verified account session.

