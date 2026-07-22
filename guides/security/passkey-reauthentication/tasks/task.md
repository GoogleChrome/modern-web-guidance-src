---
base_app: daily-grind
---
- before allowing a sensitive account change, require the signed-in user to re-confirm their identity in a phishing-resistant way that cannot be satisfied by a stored password. wire up the button annotated with `data-testid="reauth-button"` in `index.html` so that clicking it fetches a server challenge from `POST /api/reauth/options` scoped to the current user's pre-registered credentials, completes the verification ceremony in the browser, and submits the result to `POST /api/reauth/verify`.

