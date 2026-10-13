---
base_app: daily-grind
---
- Add a real-time roasting simulator widget wrapped in `#roasting-widget` (with a 400px placeholder height) right before the footer, featuring a `<canvas id="roast-canvas">` animating roasting coffee beans and a simulated temperature reading `#roast-temp-value` updating on an interval. Conserve system resources and battery life by pausing the background JavaScript execution and canvas animation when the off-screen component's rendering is skipped, and resuming them just-in-time when it scrolls back into view.

