---
base_app: daily-grind
---
- implement automatic post-login passkey promotion in `index.html`. when a user successfully signs in with a password (represented by clicking the sign-in button annotated with `data-testid="signin-button"`), silently register a passkey for an existing user immediately after a successful password sign-in in the background — without showing any dialog, prompt, or error UI — by fetching options from `POST /api/register/options` and verifying the result at `POST /api/register/verify`. follow modern WebAuthn standards for automatic passkey creation, feature-detecting conditional creation capabilities and supplying conditional mediation to ensure seamless background registration.
