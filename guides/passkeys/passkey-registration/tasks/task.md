---
base_app: daily-grind
---
- implement passkey registration in `index.html`. when the user clicks the "create passkey" button annotated with `data-testid="register-button"`, fetch creation options from `/api/register/options` (passing a JSON body with `{ promotion: true }`) and register the passkey. then verify the registration by POSTing to `/api/register/verify`.
