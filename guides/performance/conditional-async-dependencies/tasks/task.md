---
base_app: daily-grind
---
- Conditionally load and initialize async module dependencies on the Daily Grind homepage so a polyfill for missing web features is imported without complex async orchestration across scripts before dependent module code runs, supporting a "Rewards" navbar button that opens a rewards popover card.
