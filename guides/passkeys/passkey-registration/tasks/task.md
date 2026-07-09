---
base_app: daily-grind
---
- Implement passkey registration in `index.html` following security best practices. When the user clicks the "create passkey" button annotated with `data-testid="register-button"`, fetch passkey creation options from `/api/register/options` (passing a JSON body with `{ promotion: true }`), handle passkey creation, and verify the registration by POSTing to `/api/register/verify`.
