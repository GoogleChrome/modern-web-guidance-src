---
base_app: daily-grind
---

- Add a new feature that schedules a live virtual coffee tasting event for '2026-03-08T02:30' in the 'America/New_York' timezone. Use the new Temporal API with disambiguation set to 'reject' to detect if this time falls in a daylight savings gap, and log a warning if it does. If there's a DST conflict for the tasting event, use the compatible mode to find a valid time, and then convert it to 'Asia/Tokyo' and print it to the site.
