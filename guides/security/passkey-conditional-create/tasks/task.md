---
base_app: daily-grind
---
- Implement a password sign-in form and automatic post-login passkey promotion in `index.html`. Render a sign-in form with a submit button annotated with `data-testid="signin-button"`. Immediately after a successful password sign-in, automatically register a passkey for the existing user in the background by fetching creation options from `POST /api/register/options` and verifying the result at `POST /api/register/verify`.
