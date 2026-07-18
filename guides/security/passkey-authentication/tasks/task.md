---
base_app: daily-grind
---
- implement passkey authentication in `index.html`. ensure the sign-in username input field is annotated with `data-testid="username-field"`. when a user focuses on this field, the browser should seamlessly offer their registered passkeys as autofill suggestions. if they click the explicit "sign in with passkey" button annotated with `data-testid="auth-button"`, prompt them for biometrics directly instead. send the authenticated credential to `/api/login/verify` and update the status element annotated with `data-testid="auth-status"` upon success.

