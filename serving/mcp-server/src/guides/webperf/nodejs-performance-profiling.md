---
description: Profile Node.js application performance using the Chrome DevTools Performance panel to identify and resolve bottlenecks.
filename: nodejs-performance-profiling
category: webperf
---

# Profile Node.js Performance

## Best Practices

Use the **Performance** panel in Chrome DevTools to profile the performance of Node.js applications. This panel helps identify performance bottlenecks by recording and analyzing CPU activity over time.

### Opening DevTools for Node.js

1.  **Start your Node.js application with the `--inspect` flag:**
    ```posix-terminal
    node --inspect your-app.js
    ```
2.  **Connect DevTools:**
    *   Open Chrome and navigate to `chrome://inspect`.
    *   Under the **Devices** section, click **Open dedicated DevTools for Node**.
    *   Alternatively, if you already have DevTools open, click the Node.js button in the DevTools action bar.

### Profiling the CPU

1.  **Open the Performance panel** within DevTools.
2.  Click the **Record** button (a circle icon) to start profiling.
3.  Perform the actions or run the code you want to profile.
4.  Click the **Record** button again to stop profiling.

### Analyzing Profiling Results

After stopping the recording, DevTools presents the data in several tabs:

*   **Timeline overview**: Provides a high-level view of CPU and network activity over time, ideal for spotting major performance dips.
*   **Bottom-Up**: Aggregates time spent on individual functions or activities within a selected portion of the recording. This helps identify which specific tasks are consuming the most time.
*   **Call Tree**: Shows the hierarchy of function calls, illustrating how much work is done by each function and its descendants. This is useful for understanding the call stacks leading to performance issues.
*   **Event Log**: Lists all recorded activities in chronological order, providing a detailed sequence of events.

### Using `console.profile()`

For more targeted profiling, you can programmatically profile JavaScript code using `console.profile()` and `console.profileEnd()`.

1.  Wrap the code you want to profile:
    ```js
    console.profile('My Profile Label');
    // Code to be profiled
    // ...
    console.profileEnd();
    ```
2.  Run this code either directly in the DevTools **Console** or within your Node.js application started with `--inspect`. The profiling results will appear automatically in the **Performance** panel.

**DO** use `console.profile()` for profiling specific sections of your JavaScript code.
**DO NOT** leave profiling code in production builds, as it can introduce overhead.
**DO** ensure your Node.js application is started with the `--inspect` flag to enable DevTools connection.
**DO** familiarize yourself with each tab in the Performance panel to effectively diagnose performance issues.