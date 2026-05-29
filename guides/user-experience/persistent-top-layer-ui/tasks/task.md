---
base_app: daily-grind
---
- we need a highly persistent feedback dialog modal. when a user opens the feedback dialog and is typing, they should be able to click a button that programmatically relocates the dialog element in the DOM from the main container to the footer landmark, without the open modal closing, disappearing, or losing any of its state. since some browsers do not natively support state-preserving DOM relocations, make sure to implement a robust, custom-restored fallback.
- build an overlay modal dialog on the landing page that remains fully open and focus-active when programmatically reparented to another element. relocate the node atomically without any state or interactive disruption, providing a standard, feature-detected layout fallback for older browser engines.
