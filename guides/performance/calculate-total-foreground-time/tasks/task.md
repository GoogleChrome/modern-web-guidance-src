---
base_app: daily-grind
---
- add a script at the bottom of the body with a function named getTotalForegroundTime(). we want to measure true user engagement, so calculate the total time the page was actually visible by pulling the 'visibility-state' entries from the performance timeline. if the browser doesn't support it and returns an empty array, just return performance.now() as a fallback.
- wire up the "order now" button in the hero section to console log the foreground time when clicked.
- apply the same logging behavior to all the "view details" buttons in the seasonal favorites grid.
