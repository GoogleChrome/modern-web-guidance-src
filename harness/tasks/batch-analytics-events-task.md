---
base_app: daily-grind
grader: batch-analytics-events
---
Implement Core Web Vitals monitoring on this site using the "web-vitals" JavaScript library. The page should send the Core Web Vitals data to a collection endpoint at "/collect", and it should batch multiple metrics together in the same request whenever possible to minimize server load.
