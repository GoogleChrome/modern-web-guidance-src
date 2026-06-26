---
base_app: daily-grind
---
- Add a persistent feedback overlay modal using a native <dialog> or popover. Clicking a move button should programmatically relocate the open dialog in the DOM using the native state-preserving moveBefore API, ensuring the modal remains open and focus-active on reparenting, with a fallback that manually re-opens and restores the modal state in unsupported browsers.
- build an overlay modal dialog on the landing page that remains fully open and focus-active when programmatically reparented to another element. relocate the node atomically without any state or interactive disruption, providing a standard, feature-detected layout fallback for older browser engines.
