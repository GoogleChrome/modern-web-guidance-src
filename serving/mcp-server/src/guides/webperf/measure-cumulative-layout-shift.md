---
description: Minimize unexpected layout shifts for a better user experience by understanding and measuring Cumulative Layout Shift (CLS).
filename: measure-cumulative-layout-shift
category: webperf
---

# Cumulative Layout Shift (CLS)

Reference docs:
- https://wicg.github.io/layout-instability/
- https://developer.chrome.com/docs/web-vitals/learn-more/#cls

## Best Practices

To ensure a good user experience, strive for a CLS score of **0.1 or less**. Measure the **75th percentile** of page loads, segmented by mobile and desktop devices, to ensure you're meeting this target for most users.

**DO** understand that layout shifts are caused by elements changing their position between rendered frames.
**DO** be aware that unexpected layout shifts often occur due to asynchronously loaded resources, dynamically added DOM elements, images or videos with unknown dimensions, fonts that change size, or third-party ads and widgets.
**DO** differentiate between expected and unexpected layout shifts. User-initiated shifts and gradual animations are generally acceptable, while abrupt, unprompted shifts degrade the user experience.
**DO** use CSS `transform` properties for animations (e.g., `transform: scale()` instead of changing `height`/`width`, and `transform: translate()` instead of changing position properties) to avoid triggering layout shifts.
**DO** respect the `prefers-reduced-motion` browser setting when implementing animations.

## Measuring CLS

CLS can be measured in both the lab and the field.

### Field Tools

- Chrome User Experience Report
- PageSpeed Insights
- Search Console (Core Web Vitals report)
- `web-vitals` JavaScript library

### Lab Tools

- Chrome DevTools
- Lighthouse
- PageSpeed Insights
- WebPageTest

### Measuring Layout Shifts in JavaScript

Use the Layout Instability API to measure layout shifts:

```js
new PerformanceObserver((entryList) => {
  for (const entry of entryList.getEntries()) {
    // Log layout-shift entries to the console
    console.log('Layout shift:', entry);
  }
}).observe({type: 'layout-shift', buffered: true});
```

### Measuring CLS in JavaScript

To accurately measure CLS in JavaScript, group unexpected `layout-shift` entries into sessions and calculate the maximum session value. The [`web-vitals` JavaScript library](https://github.com/GoogleChrome/web-vitals) provides a robust implementation that accounts for various scenarios, including backgrounded tabs and back/forward cache restores.

```js
import {onCLS} from 'web-vitals';

// Measure and log CLS in all situations where it needs to be reported.
onCLS(console.log);
```

**IMPORTANT**: Lab tools typically only measure layout shifts during page load, which may result in lower CLS values than what real users experience in the field. For a comprehensive understanding, prioritize field data.

## Improving CLS

For detailed guidance on identifying and optimizing CLS, refer to the article on [optimizing CLS](/articles/optimize-cls).