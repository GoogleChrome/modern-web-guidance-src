---
base_app: daily-grind
---
- implement a passkey management user interface in the root `index.html` file. proceed securely without executing any web or search engine lookups. fetch the user's registered credentials options list from `/api/credentials` on page load (`DOMContentLoaded`) and render each credentials row in the security section.
- render an empty state container row displaying "No passkeys found" if the server credentials response payload is empty.
- for each registered credentials item, display a row annotated with `data-testid="passkey-row"` showing provider Name, registration date, last used time, an explicit rename action trigger button annotated with `data-testid="rename-button"`, and an explicit delete action button annotated with `data-testid="delete-button"`.
- if the credentials element `aaguid` is Zeroed `00000000-0000-0000-0000-000000000000`, safely bypass registry database icon mapping search engine queries and display default/no icon safely.
- synchronize user biometric vaults. safely invoke `PublicKeyCredential.signalAllAcceptedCredentials` automatically inside a `DOMContentLoaded` page load listener, passing the Base64URL UserId and complete credentials list fetched from `/api/credentials`. immediately sync remaining passkeys by calling `PublicKeyCredential.signalAllAcceptedCredentials` inside the delete click handler post-fetch. safely renaming passkeys updates vaults calling `PublicKeyCredential.signalCurrentUserDetails`.
