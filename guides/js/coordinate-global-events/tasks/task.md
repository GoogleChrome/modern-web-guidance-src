---
base_app: daily-grind
---
- Add a 'Global Tasting Coordinator' section under seasonal favorites with a date input `#dateInput`, a time input `#timeInput`, and a host timezone select `#hostTzSelect` (with options `America/New_York`, `Europe/London`, `Asia/Tokyo`, and `UTC`). When a user changes these inputs, calculate the equivalent local times for New York, London, Tokyo, and UTC and display a card for each inside `#grid` showing the formatted local time (e.g. '3:00 AM'). If the chosen host time falls in a Daylight Saving Time gap or overlap, detect the conflict and show a warning in `#hostWarning` explaining how the time was resolved.
- add a timezone-safe meeting planner under our main seasonal favorites container so that our international partners can coordinate wholesale coffee bean orders and tasting sessions. it needs to handle clocks shifting for dst properly without scheduling mistakes.
