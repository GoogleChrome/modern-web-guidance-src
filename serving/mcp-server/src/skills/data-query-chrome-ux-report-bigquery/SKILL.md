---
description: Learn how to query the Chrome UX Report dataset on BigQuery to extract insights quickly and cheaply using summary datasets and shortcut functions.
filename: query-chrome-ux-report-bigquery
category: data
---

# Mastering the Chrome UX Report on BigQuery

## Best Practices

The Chrome UX Report (CrUX) dataset on BigQuery contains a wealth of web transparency data. To make this data accessible and actionable for developers, Google has developed summary datasets and shortcut functions. These tools enable developers to query the CrUX data efficiently, extracting valuable insights quickly and cost-effectively.

When working with the CrUX dataset, consider the following best practices:

*   **Utilize Summary Datasets:** Leverage the pre-aggregated summary tables provided by CrUX to speed up common queries and reduce costs. These tables are optimized for frequently accessed metrics.
*   **Employ Shortcut Functions:** Make use of any provided shortcut functions to simplify complex query logic and improve readability. These functions often encapsulate common patterns for data extraction.
*   **Focus on Core Web Vitals:** Prioritize querying Core Web Vitals metrics (LCP, FID, CLS) as they are crucial indicators of user experience and page performance.
*   **Understand Table Schemas:** Familiarize yourself with the schema of the `metrics_summary` table and other relevant tables to accurately select and interpret the data.
*   **Optimize Queries for Cost:** Be mindful of BigQuery costs by selecting only the necessary columns, filtering data effectively, and avoiding full table scans where possible.

## Resources

*   CrUX documentation: [https://goo.gle/3g0Buu4](https://goo.gle/3g0Buu4)
*   Core Web Vitals: [https://goo.gle/2VjBmxF](https://goo.gle/2VjBmxF)
*   `metrics_summary` table: [https://goo.gle/2Nxt5Cj](https://goo.gle/2Nxt5Cj)
*   Example Queries: [https://goo.gle/2CMnmX1](https://goo.gle/2CMnmX1)
*   CrUX Cookbook: [https://goo.gle/2A8645D](https://goo.gle/2A8645D)

## Related Content

*   Related Playlist: Day 1 → [https://goo.gle/WDL20Day1](https://goo.gle/WDL20Day1)
*   Subscribe to the Chrome Developers: [https://goo.gle/ChromeDevs](https://goo.gle/ChromeDevs)

**Speaker:** Rick Viscomi

<a href="../" class="button"><span class="material-icons">arrow_back</span> Back to all episodes</a>