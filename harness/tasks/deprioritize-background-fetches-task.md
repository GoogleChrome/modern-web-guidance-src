---
base_app: daily-grind
grader: deprioritize-background-fetches
---
Add the 'My Account' page to this site. It should have a single button that triggers two concurrent fetch requests: one request to '/api/data' for mission-critical data that must be loaded as quickly as possible, and another to '/api/analytics' that POSTs a `{click: 1}` payload.
