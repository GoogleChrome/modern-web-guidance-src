---
description: Optimize web performance by comparing local Core Web Vitals with real-user data and configuring local environments.
filename: core-web-vitals-optimization
category: webperf
---

# Optimize Core Web Vitals Performance

## Best Practices

This guide focuses on leveraging the Chrome DevTools Performance panel to monitor and improve Core Web Vitals (CWV) by comparing local performance with real-user data and configuring the local development environment.

### Real-time Local Core Web Vitals Performance

*   **Monitor without recording:** The Performance panel now displays CWV metrics (Largest Contentful Paint, Cumulative Layout Shift, Interaction to Next Paint) in real-time without requiring an active recording.
*   **Background data collection:** Metrics are gathered in the background, allowing you to check performance even when not actively debugging.
*   **Visual cues:** Metrics are color-coded according to thresholds for good and poor performance, making it easy to identify issues quickly.

### Real-User Experience Data (Field Data)

*   **Compare local vs. field:** Integrate real-user data from the public CrUX API to understand how your local experience compares to actual user experiences.
*   **Informed decision-making:** Use this comparison to prioritize optimization efforts on issues that actually affect users.
*   **Eligibility:** Be aware that individual URLs and origins must meet certain criteria to be included in the CrUX dataset.
*   **Data aggregation:** DevTools attempts to show the most relevant data, defaulting to the same URL and device type, or aggregating across device types if necessary.
*   **Proportional insights:** Hover over metrics to see the proportion of real-user experiences within each rating, providing granular insights.

### Recommendations to Configure Your Local Environment

*   **Emulate common device types:** When field data is available, the **Recording settings** section suggests emulating the most common device type used by real users to better match their experience.
*   **Utilize device mode:** Enable device mode to emulate mobile viewports, which can significantly impact layout and performance.
*   **Network throttling:** Apply network throttling (e.g., Slow 4G) based on real-user round-trip times to simulate realistic loading conditions and expose potential performance bottlenecks.
*   **CPU throttling:** Throttle your CPU (e.g., by 20x) to better emulate slower mobile devices and ensure scripts run slowly enough to surface issues like long tasks impacting Interaction to Next Paint.
*   **Remote debugging:** Consider remotely debugging physical mobile devices as an alternative to emulation for more accurate testing.

### Information to Help You Reproduce Issues

*   **LCP Element identification:** The **LCP Element** shows a link to the Largest Contentful Paint element, allowing you to highlight it on the page or view it in the Elements panel for context.
*   **Interaction log:** A real-time log of eligible interactions (pointer or keyboard events) provides details like interaction type, target element, and latency, aiding in reproduction.
*   **Interactive targets:** Interaction targets are interactive, allowing you to hover to highlight or click to view them in the Elements panel.
*   **Performance profile recording options:**
    *   Use **Record and reload** for debugging loading performance issues (e.g., LCP, load-time CLS).
    *   Use the **Record** button to profile pages during manual interaction for debugging interaction-related issues or post-load layout shifts.

## Fallback Strategies and Further Information

*   **Web Vitals Extension:** Information will be shared regarding the impact of these new features on the Web Vitals extension.
*   **Feedback:** Provide feedback on the new features through the [public issue tracker](https://crbug.com/329541444).
*   **Further Reading:**
    *   [Monitor live Core Web Vitals metrics in the Performance panel](https://www.youtube.com/watch?v=uSrmN_Dy0Wk)
    *   [Core Web Vitals thresholds](https://web.dev/articles/vitals#core-web-vitals)
    *   [CrUX API documentation](/docs/crux/api)
    *   [CrUX methodology and eligibility](https://web.dev/articles/crux/methodology#eligibility)
    *   [Differences between lab and field data](https://web.dev/articles/lab-and-field-data-differences)
    *   [DevTools device mode documentation](/docs/devtools/device-mode)
    *   [CrUX round trip time metric](https://web.dev/articles/crux/methodology/metrics#round-trip-time-metric)
    *   [Optimizing long tasks](https://web.dev/articles/optimize-long-tasks)
    *   [DevTools remote debugging](/docs/devtools/remote-debugging)
    *   [LCP content types on Almanac](https://almanac.httparchive.org/en/2022/performance#lcp-content-types)
    *   [Interaction to Next Paint (INP) definition](https://web.dev/articles/inp#whats_in_an_interaction)
    *   [Profiling in DevTools Performance panel](/docs/devtools/performance/reference#record)
    *   [Optimizing Cumulative Layout Shift (CLS)](https://web.dev/articles/optimize-cls)
    *   [Plans for the Web Vitals extension](/blog/web-vitals-extension)