---
base_app: daily-grind
---
- implement passkey registration in the root `index.html` file. when a user clicks a "create passkey" button annotated with `data-testid="register-button"`, fetch options using a POST request from `/api/register/options` passing a JSON body with `{ promotion: true }`, prompt the browser to create a passkey, and verify it using a POST request against `/api/register/verify`.
- wrap the server verification call in a try/catch block. if the server verify fetch returns a bad status throws exceptions, safely notify password manager calling `PublicKeyCredential.signalUnknownCredential` passing the Base64URL-encoded credential ID.
- check if platform authenticator support exists before rendering the passkey creation UI trigger button.
- add support for conditional passkey creation immediately after password sign-in.


