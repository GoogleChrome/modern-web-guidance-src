---
description: Measure Core Web Vitals for Single Page Applications by utilizing the Soft Navigations API.
filename: measure-spa-core-web-vitals
category: webperf
---

# Measure Core Web Vitals for SPAs with Soft Navigations API

## Best Practices

The Soft Navigation API is designed to help measure Core Web Vitals for Single Page Applications (SPAs). SPAs often perform client-side navigation without full page reloads, which can make it difficult for traditional performance metrics to be accurately captured. This API provides a way for the browser to understand these "soft" navigations, allowing for better measurement of key metrics like Largest Contentful Paint (LCP), Interaction to Next Paint (INP), and Cumulative Layout Shift (CLS).

### Understanding Soft Navigations

A soft navigation occurs when JavaScript intercepts a navigation and updates the page content without a full page reload. The URL in the address bar is updated, and history state is managed, but the browser still considers it the original page.

### Why the Soft Navigation API is Needed

Traditionally, metrics like LCP are only emitted by the browser upon actual page navigations. For SPAs, this means LCP might not be recorded accurately for content updates triggered by soft navigations. The Soft Navigation API allows the browser to detect these soft navigations and emit relevant performance entries, enabling accurate measurement of Core Web Vitals.

### How the API Works

The API uses a heuristic-based approach to identify soft navigations. This generally involves:
* A user-initiated interaction.
* A subsequent DOM modification and paint.
* A URL update, including a history state change.

This heuristic approach ensures a consistent understanding of what constitutes a soft navigation, regardless of the JavaScript framework used.

### Measuring Core Web Vitals

The API, in conjunction with the new `interaction-contentful-paint` performance entry, helps address the primary use case of measuring Core Web Vitals for SPAs. The API expands existing performance entries like `largest-contentful-paint`, `interaction-contentful-paint`, `event-timing`, and `layout-shift` to include a navigation identifier. This makes it easier to attribute performance entries to the correct navigation, even when URLs change dynamically.

## Fallback Strategies

While the Soft Navigation API is designed to be a browser-native solution, developers can also leverage existing primitives and libraries for performance measurement.

### Feature Detection

If you need to ensure compatibility or provide alternative measurement strategies, consider the following:
* **Event Timing API:** Can be used to measure interactions like `INP` across any timespan.
* **Layout Instability API:** Can be used to measure `CLS`.

### Libraries and Tooling

* **Web-Vitals Library:** An experimental version of the web-vitals library is available to assist with measuring Core Web Vitals using the Soft Navigation API. Refer to the [documentation](https://github.com/GoogleChrome/web-vitals) for details.

## Testing and Feedback

The Soft Navigation API is currently available via origin trials. This is an opportunity for developers to test the API with real users and provide feedback to the Chrome team.
* **Local Testing:** Enable Chrome flags or use command-line options for local testing.
* **Field Testing:** Participate in the origin trial to test in real-world scenarios.

Your feedback is crucial for refining the API before its wider launch. Specific areas for feedback include:
* **Heuristic Accuracy:** Does the heuristic correctly identify soft navigations in your application? Are there cases where it misses navigations or incorrectly identifies them?
* **Core Web Vitals Measurement:** Does the API and the `Interaction to Contentful Paint` primitive effectively address the need to measure Core Web Vitals for your SPA?

## Feedback Channels

* **GitHub Issues:** Raise feedback on the API itself as [issues on GitHub](https://github.com/WICG/soft-navigations/issues).
* **Chromium Bugs:** Report bugs on the Chromium implementation in [Chrome's issue tracker](https://issues.chromium.org/issues/new?template_issue=434300302&component=1456231).
* **General Web Vitals Feedback:** Share general feedback at [web-vitals-feedback@googlegroups.com](mailto:web-vitals-feedback@googlegroups.com).