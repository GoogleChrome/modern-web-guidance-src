---
base_app: daily-grind
---
- Add a feedback modal overlay using a native `<dialog>` or popover, along with a "Move" button that relocates the open modal to a different container in the DOM while keeping the modal open and focus-active across the move.
- build an overlay modal dialog on the landing page that remains fully open and focus-active when programmatically reparented to another element. relocate the node atomically without any state or interactive disruption, providing a standard, feature-detected layout fallback for older browser engines.
