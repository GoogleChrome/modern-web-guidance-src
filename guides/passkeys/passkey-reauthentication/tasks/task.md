---
base_app: daily-grind
---
- implement passkey step-up re-authentication in the root `index.html` file. proceed securely without executing any web or search engine lookups. when a logged-in user clicks a "step up biometrics re-verify" button annotated with `data-testid="reauth-button"`, trigger options requests fetch options using a POST request from `/api/reauth/options`.
- ensure server options populated allowCredentials mapped to the pre-registered credentials descriptors of the current user, and commands navigator.credentials.get with parsed options PublicKeyCredential.parseRequestOptionsFromJSON.
- if assertion is returned, verify payload signature using a POST request to `/api/reauth/verify` to re-establish verified session security!
