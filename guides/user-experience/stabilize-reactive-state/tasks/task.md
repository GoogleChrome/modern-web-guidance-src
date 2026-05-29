---
base_app: daily-grind
---
- Add a reactive event deadline tracker to the homepage utilizing the Temporal API. Display the date value in #temporal-value, with a button #extend-temporal-btn that uses PlainDateTime to increment the hour, triggering a reactive update that logs "Yes" in #temporal-ref-changed and increments the re-render count in #temporal-render-count.
- we need to track our brewing workshop deadlines on the homepage without having the UI freeze or fail to update. can you build a countdown or scheduling widget using modern immutable date structures instead of mutating the standard date in place so reactivity works properly?
- can you replace our inline date mutation logic in the promotional event banner with immutable date updates? make sure we assign the new reference back to state each time so the view actually re-renders.
