---
base_app: daily-grind
---
- Add a button to the Daily Grind homepage that loads a batch of out-of-order coffee order events collected from distributed backend services with nanosecond UTC timestamps, sorts the timestamped events chronologically without losing sub-millisecond precision, and measures the intervals between consecutive events.