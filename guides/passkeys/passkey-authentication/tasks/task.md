---
base_app: daily-grind
---
- implement passkey authentication in the root `index.html` file. when a user lands on the sign-in page, immediately fetch sign-in options from `/api/auth/options` using a POST request to prime the browser's passkey autofill suggestion list. safely configure the username input field with the required autocomplete and focus attributes.
- ensure options fetched from `/api/auth/options` are decoded properly before prompting the user's biometric passkey prompt.
- if an explicit sign-in button annotated with `data-testid="login-button"` is clicked, cancel the ongoing background passkey autofill request and trigger an explicit biometric prompt.
- handle try/catch scopes securely and send the assertion response to `/api/auth/verify`. if the server does not recognize the credential, notify the user's password manager with the Base64URL-encoded credential ID.

