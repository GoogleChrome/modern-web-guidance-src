---
description: Measure and improve website performance by leveraging new metrics and updated scoring in Lighthouse 6.0.
filename: lighthouse-performance-6.md
category: webperf
---

# Improving Website Performance with Lighthouse 6.0

Lighthouse 6.0 introduces significant updates to its performance metrics and scoring, providing developers with more accurate insights into user experience and actionable guidance for optimization.

## Key Updates in Lighthouse 6.0

### New Metrics

Lighthouse 6.0 incorporates three new metrics, including two Core Web Vitals:

*   **Largest Contentful Paint (LCP):** Measures perceived loading experience by marking the point when the primary content becomes visible. A score below 2.5 seconds is considered 'Good.'
*   **Cumulative Layout Shift (CLS):** Quantifies visual stability by measuring the amount of unexpected content shift during the page's lifespan. A score below 0.10 is considered 'Good.'
*   **Total Blocking Time (TBT):** Measures load responsiveness by quantifying the total time the main thread was blocked, impacting user interaction. It correlates with the Core Web Vital First Input Delay (FID).

### Performance Score Update

The performance score calculation has been revised to reflect the importance of the new metrics, with updated weights for existing ones:

| Phase          | Metric Name                  | Metric Weight |
| -------------- | ---------------------------- | ------------- |
| Early (15%)    | First Contentful Paint (FCP) | 15%           |
| Mid (40%)      | Speed Index (SI)             | 15%           |
|                | Largest Contentful Paint (LCP) | 25%           |
| Late (15%)     | Time To Interactive (TTI)    | 15%           |
| Main Thread (25%) | Total Blocking Time (TBT)    | 25%           |
| Predictability (5%) | Cumulative Layout Shift (CLS) | 5%            |

Three older metrics – First Meaningful Paint, First CPU Idle, and Max Potential FID – have been removed to streamline and improve the scoring accuracy.

### New Audits

Lighthouse 6.0 also introduces several new audits to help identify specific performance bottlenecks:

*   **Unused JavaScript:** Identifies JavaScript code that is not being executed, helping to reduce page load times.
*   **Accessibility Audits:** An expanded set of audits powered by axe-core to improve website accessibility.
*   **Maskable Icon:** Checks for support of maskable icons for PWAs, ensuring icons display well across different devices.
*   **Charset Declaration:** Verifies that a valid character encoding is declared early in the HTML document to prevent rendering issues.

## Implementing Performance Improvements

### Using the Scoring Calculator

To understand how these changes might affect your site's performance score, Lighthouse provides a [scoring calculator](https://googlechrome.github.io/lighthouse/scorecalc/). This tool allows you to compare scores between Lighthouse versions 5 and 6 and experiment with different metric values.

### Leveraging Lighthouse CI

For continuous performance monitoring, Lighthouse CI tracks Lighthouse results on every commit in your CI pipeline. It supports various CI providers and offers a dashboard for analyzing trends across categories and metrics.

### Understanding Mobile Emulation

Lighthouse defaults to mobile emulation, simulating slow network and CPU conditions, and uses Moto G4 as its reference device for testing. This mobile-first approach helps identify performance issues that are more apparent on mobile devices.

### Source Location Links

The report now provides direct links to the exact line of source code causing an issue, making it easier to debug and fix problems within your codebase.

## Experimental Features and Future Directions

Lighthouse is experimenting with collecting source maps to power advanced features like:

*   Detecting duplicate modules in JavaScript bundles.
*   Identifying excessive polyfills or transforms in code.
*   Providing module-level granularity for the Unused JavaScript audit.
*   Visualizing treemaps of modules that require attention.

These features can be explored using the `--preset experimental` CLI flag.

## Getting Started

1.  **Open Chrome Canary** and use the **Lighthouse** panel.
2.  **Use the Node CLI:** `npm install -g lighthouse && lighthouse https://yoursite.com --view`.
3.  **Implement Lighthouse CI** with your project for continuous monitoring.
4.  **Review the Lighthouse audit documentation** for detailed explanations of each audit.
5.  **Contribute to the Lighthouse project** on GitHub.