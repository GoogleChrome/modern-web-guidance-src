---
base_app: negative/deprioritize-background-fetches
grader: deprioritize-background-fetches
---
Create an extremely minimal web page with a single button that triggers two concurrent fetch requests: one request to '/api/data' for mission-critical data that must be loaded as quickly as possible, and another to '/api/analytics' that POSTs a `{click: 1}` payload.
