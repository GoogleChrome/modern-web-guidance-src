---
base_app: daily-grind
---
- implement a passkey management interface inside `index.html` inside the container annotated with `data-testid="credential-list"`. fetch the user's registered credentials from `/api/credentials` on load and render them as individual rows annotated with `data-testid="passkey-row"`. each row should display the credential name, a rename button annotated with `data-testid="rename-button-${id}"` (which PUTs to `/api/credential/${id}`), and a delete button annotated with `data-testid="delete-button-${id}"` (which DELETEs `/api/credential/${id}`). display the status in the element annotated with `data-testid="management-status"`.

