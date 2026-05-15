---
base_app: daily-grind
---
- implement automatic silent passkey enrollment in `index.html`. when a user successfully signs in with a password (represented by clicking the sign-in button annotated with `data-testid="signin-button"`), register a new passkey for them in the background — without showing any dialog, prompt, or error UI — by fetching options from `POST /api/register/options` and verifying the result at `POST /api/register/verify`. The page must indicate the status of this enrollment using an element with `data-testid="status"`.
