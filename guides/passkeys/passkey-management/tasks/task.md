---
base_app: daily-grind
---
- implement a passkey management interface in the root `index.html` file. fetch the user's registered credentials from `/api/credentials` on page load and render them in a dedicated security section.
- display a clear "No passkeys registered" empty-state row if the server credentials response payload is empty.
- for each registered credentials item, display a card/row annotated with `data-testid="passkey-row"` showing provider name, registered date, last used time, a rename button annotated with `data-testid="rename-button"`, and a delete button annotated with `data-testid="delete-button"`.
- if the credential's `aaguid` is zeroed `00000000-0000-0000-0000-000000000000`, bypass the authenticator icon lookup and render a fallback generic icon safely.
- keep the user's password manager in lockstep with your database. synchronize the complete valid credentials list with the manager automatically on page load. immediately update the synced vault credentials list after a passkey is successfully deleted. rename sensitive credential metadata after successfully renaming a passkey.

