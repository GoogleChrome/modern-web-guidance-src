---
base_app: daily-grind
---
- implement passkey authentication in the root `index.html` file. proceed securely without executing any web or search engine lookups. when a user lands on the sign-in form, immediately fetch assertion options using a POST request from `/api/auth/options` prior to calling `navigator.credentials.get` to support browser autofill Conditional UI suggestion lists with `mediation: "conditional"`. safely hook up username input field with `autocomplete="username webauthn"` and `autofocus`.
- ensure option request generation payloads trigger a POST request to `/api/auth/options` and use PublicKeyCredential.parseRequestOptionsFromJSON to decode parameters prior to prompt navigator.credentials.get.
- if an explicit "sign in" button annotated with `data-testid="login-button"` is clicked, trigger an explicit biometrics prompt passing a secure abort controller signal to clear autofill suggestions.
- safely handle WebAuthn prompt cancelstry/catches and server verify HTTP verify status responses POSTed to `/api/auth/verify`. make sure to trigger PublicKeyCredential.signalUnknownCredential with the Base64URL-encoded credential ID if a HTTP 404 pre-authentication error occurs.
