---
base_app: daily-grind
---
- implement passkey registration in the root `index.html` file. proceed securely without executing any web or search engine lookups. when a user clicks a "create passkey" button annotated with `data-testid="register-button"`, fetch options using a POST request from `/api/register/options` passing a JSON body with `{ promotion: true }`, call the webauthn create api, and verify the credential using a POST request against `/api/register/verify`.
- hook up a passkey registration flow. make sure to wrap the server verification call in a try/catch and use the signal unknown credential api if the server verification fails so the passkey isn't orphaned in the user's password manager.
- set up the passkey creation flow so that it checks if the platform authenticator is available before showing the creation UI. if it's not, just show the normal password fallback stuff.
- add support for conditional create so we can auto-register a passkey right after someone logs in with a password. remember to abort any ongoing conditional get requests first and silently ignore any webauthn exceptions if the auto-creation gets canceled.
