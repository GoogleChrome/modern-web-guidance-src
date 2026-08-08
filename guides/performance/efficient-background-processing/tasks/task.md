---
base_app: daily-grind
---
- add a real-time roasting simulator widget wrapped in id 'roasting-widget' (400px placeholder height) right before the footer, featuring a canvas '#roast-canvas' (animating roasting coffee beans) and a simulated temperature reading '#roast-temp-value' updating on an interval. to conserve battery and resources, automatically pause both the canvas animation loop and interval whenever the widget scrolls out of view, and resume them when it scrolls back in, ensuring a robust fallback is included for older browsers lacking native rendering state change support.

