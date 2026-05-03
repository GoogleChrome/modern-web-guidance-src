---
base_app: daily-grind
---
- implement passkey registration in the root `index.html` file. when a user clicks a "create passkey" button annotated with `data-testid="register-button"`, fetch options using a POST request from `/api/register/options` passing a JSON body with `{ promotion: true }`, prompt the browser to create a passkey, and verify it using a POST request against `/api/register/verify`.
- wrap the server verification call in a try/catch block. if the server verification returns an error or invalid status, notify the browser's credential store that the created credential was not recognized so it can update the user's credentials list accordingly.
- check if the user's device supports local device-bound authenticators (like biometrics or PIN) before rendering the passkey creation UI trigger button.
