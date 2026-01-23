---
description: Developers can now be notified when their site uses a deprecated API or encounters a browser intervention, allowing for proactive issue resolution and improved site health.
filename: reporting-observer-best-practices
category: ui
---

# ReportingObserver Best Practices

Reference docs:
- https://w3c.github.io/reporting/
- https://developer.mozilla.org/en-US/docs/Web/API/ReportingObserver

## Overview

The `ReportingObserver` API provides a programmatic way to receive reports about browser interventions and deprecated API usage. This is crucial because such warnings are often only visible in DevTools and may not be encountered during local development, especially since interventions can depend on real-world conditions like device and network constraints.

## Core Functionality

`ReportingObserver` works similarly to other observer APIs. You provide a callback function that is executed when reports are generated. The callback receives a list of `report` objects, each containing details about the issue.

```js
const observer = new ReportingObserver((reports, observer) => {
  for (const report of reports) {
    console.log(report.type, report.url, report.body);
  }
}, {buffered: true});

observer.observe();
```

## Key Use Cases and Best Practices

### 1. Monitoring Deprecated APIs and Browser Interventions in Production

**Problem:** You need to know when your users encounter issues like deprecated API usage or browser interventions that you might miss during development.

**Solution:** Use `ReportingObserver` to collect these reports and send them to a backend or analytics provider.

**Best Practices:**

*   **Configure report types:** By default, `ReportingObserver` listens for both `'deprecation'` and `'intervention'` reports. You can filter these using the `types` option in the constructor if you only need specific reports:
    ```js
    const observer = new ReportingObserver((reports, observer) => {
      // ... handle reports
    }, {types: ['deprecation']});
    ```
*   **Buffer reports:** Use `{buffered: true}` to ensure you capture reports that occurred before the observer was initialized, which is particularly useful if the observer is added later in the page load (e.g., by a lazy-loaded library).
    ```js
    const observer = new ReportingObserver((reports, observer) => {
      // ... handle reports
    }, {types: ['intervention'], buffered: true});
    ```
*   **Send reports to a backend:** The callback is the ideal place to process and forward reports. Consider sending `report.body` to your analytics or logging service.
    ```js
    const observer = new ReportingObserver((reports, observer) => {
      for (const report of reports) {
        sendReportToAnalytics(JSON.stringify(report.body));
      }
    }, {types: ['intervention'], buffered: true});
    ```

### 2. Proactive Issue Resolution and Future Removal Notifications

**Problem:** You want to be alerted about upcoming API removals or critical interventions before they cause significant problems for your users.

**Solution:** Leverage the `anticipatedRemoval` property in deprecation reports and the detailed messages in intervention reports.

**Best Practices:**

*   **Check `report.type`:** Differentiate between deprecation and intervention reports to apply appropriate logic.
*   **Utilize `report.body.anticipatedRemoval`:** For deprecation reports, this field provides a date when the API is expected to be removed, allowing you to plan your code updates.
    ```js
    const observer = new ReportingObserver((reports, observer) => {
      for (const report of reports) {
        if (report.type === 'deprecation') {
          sendToBackend(`Using a deprecated API in ${report.body.sourceFile} which will be
                         removed on ${report.body.anticipatedRemoval}. Info: ${report.body.message}`);
        } else if (report.type === 'intervention') {
          // Handle interventions
        }
      }
    });
    observer.observe();
    ```
*   **Log detailed intervention information:** Intervention reports often contain specific details about why the intervention occurred, which can be invaluable for debugging.

### 3. Stopping Observation

**Problem:** You no longer need to monitor for reports or want to clean up resources.

**Solution:** Use the `disconnect()` method.

**Best Practices:**

*   **Call `disconnect()` when appropriate:** This method stops the observer from receiving any further reports. It's good practice to call this when the component or page using the observer is unmounted or no longer active.
    ```js
    observer.disconnect();
    ```

## Future Considerations

The `ReportingObserver` API is intended to evolve into a unified API for catching various JavaScript issues, including:

*   Browser interventions
*   Deprecations
*   Feature Policy violations
*   JS exceptions and errors (currently handled by `window.onerror`)
*   Unhandled JS promise rejections (currently handled by `window.onunhandledrejection`)

Keep an eye on future specifications for expanded capabilities.

---

**Key Takeaway:** `ReportingObserver` is a powerful tool for understanding the real-world health of your web application by providing visibility into issues that often go unnoticed during development.