---
base_app: daily-grind
---

- Add a "coffee club subscription" section below the seasonal favorites that appropriately and displays the next 3 monthly billing dates given a start date. Overflow options like 'reject' or 'constrain' should be appropriately handled by using the temporal api so the month-end math is accurate, especially for dates like Jan 31st. Ensure correct fallbacks are in place for browsers that don't support APIs used.