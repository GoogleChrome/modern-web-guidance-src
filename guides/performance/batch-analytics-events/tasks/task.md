---
base_app: daily-grind
---
- Implement Core Web Vitals monitoring on this site using the `web-vitals` JavaScript library. The page should send the Core Web Vitals data to a collection endpoint at `/collect`. It should debounce and batch multiple metrics together in a single beacon using a time window, limit the batch queue size to prevent quota overflow, and wrap the call in a try/catch block to handle errors.
