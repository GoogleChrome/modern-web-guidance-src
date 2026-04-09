---
base_app: daily-grind
---

- Add a "coffee club subscription" section below the seasonal favorites that appropriately and displays the next 3 monthly billing dates given a start date. Overflow options like 'reject' or 'constrain' should be appropriately handled by using the temporal api so the month-end math is accurate, especially for dates like Jan 31st. Ensure correct fallbacks are in place for browsers that don't support APIs used.
- Implement a monthly billing cycle calculator for the new monthly cold brew delivery. Make sure the date math doesn't break or give weird results if someone subscribes on the last day of a month. Use an overflow option that makes sense for the business logic (e.g. 'constrain'). Ensure correct fallbacks are in place for browsers that don't support APIs used.
- Build a simple widget that shows when the next seasonal box ships each month. Write the logic to ensure the renewal date is rock solid and handles leap years properly without relying on the legacy js date object. Ensure correct fallbacks are in place for browsers that don't support APIs used.
