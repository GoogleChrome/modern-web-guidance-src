---
base_app: daily-grind
---
- implement passkey registration in the root `index.html` file. On page load, feature detect platform authenticator support, and hide the registration button annotated with `data-testid="register-button"` by setting `style.display = 'none'` if platform biometrics are unsupported. When the user clicks the visible button, fetch options using a POST request from `/api/register/options` passing a JSON body with `{ promotion: true }`, prompt the browser to create a passkey using native `navigator.credentials.create()`, and verify it via a POST request against `/api/register/verify` with try/catch segregation that invokes `PublicKeyCredential.signalUnknownCredential()` if and only if the server verification endpoint fails.
