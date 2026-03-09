---
base_app: cards-app
grader: full-session-analytics
---
Implement Core Web Vitals monitoring on this site using the "web-vitals" JavaScript library. The page should send the Core Web Vitals data to a collection endpoint at "/collect", and it should wait to send the data until the user closes the tab or navigates away, to make sure the metric values are finalized before collecting.
