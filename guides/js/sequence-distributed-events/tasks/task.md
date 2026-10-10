---
base_app: daily-grind
---
Add a button that loads a sample trace of coffee order events as returned by our order-tracking backend. Each event has an ISO 8601 timestamp recorded by the server with nanosecond precision (for example, "2026-04-01T12:00:00.000123456Z"), and the events arrive out of order. Sort the events chronologically without losing the sub-millisecond ordering, log them in order, and log the time between consecutive events in a human-readable format.