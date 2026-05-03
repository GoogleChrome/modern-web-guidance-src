---
base_app: daily-grind
---
- implement step-up biometric identity verification in `index.html`. when a signed-in user clicks the re-verify button annotated with `data-testid="reauth-button"`, request cryptographic options from the server via a POST request to `/api/reauth/options`, prompt the browser for biometrics natively, and verify the assertion response by POSTing to `/api/reauth/verify`.

