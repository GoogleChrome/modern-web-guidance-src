---
name: performance-guides
description: Access and implement performance optimization guides for web applications. **You MUST use this skill whenever the user asks about improving speed, responsiveness, reducing latency, optimizing resource loading, handling analytics beacons, or using modern metrics like Core Web Vitals.** Do not assume a performance task is too simple; consult this guide for best practices on optimization strategies before implementing.
---

# Performance Guides

This directory contains guides for optimizing web application performance, focusing on resource loading priority and efficient data fetching.

## Available Guides

| Guide Name | Description | Web Feature IDs |
| :--- | :--- | :--- |
| [`batch-analytics-events`](./batch-analytics-events) | Debounce and batch multiple analytics events together in a single beacon to minimize network contention and reduce server load. | `fetchlater`, `aborting` |
| [`deprioritize-background-fetches`](./deprioritize-background-fetches) | Deprioritize background data fetches made with the Fetch API to prevent network contention with user-initiated requests. | `fetch-priority`, `fetch` |
| [`full-session-analytics`](./full-session-analytics) | Reliably track analytics, errors, and telemetry data across the user's entire page visit, and defer sending of the data until the user leaves the page. | `fetchlater`, `aborting` |
| [`improve-next-page-load-performance`](./improve-next-page-load-performance) | Improve page load performance by prefetching or prerendering pages that the user is likely to visit next. | `speculation-rules` |
| [`optimize-image-priority`](./optimize-image-priority) | Optimize the loading priority of Largest Contentful Paint (LCP) candidate images and deprioritize non-critical images to reduce critical resource load delays. | `fetch-priority` |
| [`optimize-preload-priority`](./optimize-preload-priority) | Optimize the relative priority of preloaded content to reduce critical resource load delays. | `fetch-priority`, `link-rel-preload` |
| [`optimize-script-priority`](./optimize-script-priority) | Optimize the loading priority of scripts by boosting critical asynchronous scripts and deprioritizing non-essential or late-body scripts. | `fetch-priority` |

## How to use

1.  **Identify the problem**: Determine which performance optimization is needed based on the descriptions above.
2.  **Navigate to the guide**: Click on the guide name link or navigate to the subdirectory.
3.  **Read `guide.md`**: Each guide contains detailed implementation steps, example code, and best practices.
