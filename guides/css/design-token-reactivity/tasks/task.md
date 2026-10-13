---
base_app: daily-grind
---
- Add a layout density toggle button with id `toggle-spacious` to the seasonal favorites section. Wrap the seasonal favorites list in an ancestor div with id `target-container`, and give the first card (Maple Oat Latte) the id `target-item`. Clicking `#toggle-spacious` should switch a higher-order density design token on `#target-container` (e.g., between `compact` and `spacious`) so descendant cards like `#target-item` update their padding in CSS without JavaScript mutating classes or inline styles on the cards.
- make our menu section more responsive to user density preferences by styling the cards differently based on a layout container's state, and ensure the controls are hidden if the browser doesn't support this layout toggling.
