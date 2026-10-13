---
base_app: daily-grind
---
- Add a persistent top-layer feedback modal overlay (opened by an "Open Feedback" button) and a "Move Modal" button inside it that reparents the open modal in the DOM from `#main-container` to `footer` while keeping the top-layer UI open and preserving focus.
- build an overlay modal dialog on the landing page that remains fully open and focus-active when programmatically reparented to another element. relocate the node atomically without any state or interactive disruption, providing a standard, feature-detected layout fallback for older browser engines.
