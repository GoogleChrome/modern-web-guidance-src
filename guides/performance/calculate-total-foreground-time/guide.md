---
name: calculate-total-foreground-time
description: Calculate the total time a user actually spent viewing a page, excluding periods when the tab was in the background.
web-feature-ids:
    - page-visibility-state
sources:
    - https://developer.mozilla.org/en-US/docs/Web/API/VisibilityStateEntry
---

This guide details how to accurately calculate the total time a user spends actively viewing a page. Traditional metrics like time-on-page often incorrectly include time spent with the tab in the background. By using the `VisibilityStateEntry` API, you can measure only the "foreground time," providing a better metric of user engagement.

### Implementing foreground time calculation

The `PerformanceTimeline` API exposes visibility state changes as performance entries. Rather than reacting to `visibilitychange` events and manually accumulating time throughout a session, you can query the entire visibility history at any time.

MANDATORY: You must query the `visibility-state` performance entries to calculate the true foreground time.

```javascript
/**
 * Calculates total time the page was in the visible state.
 * 
 * @returns {number} Total foreground time in milliseconds.
 */
function getTotalForegroundTime() {
  // MANDATORY: Query the visibility-state entries from the performance timeline.
  const entries = performance.getEntriesByType('visibility-state');

  // Fallback: If the browser does not support VisibilityStateEntry, 
  // the API will gracefully return an empty array.
  if (entries.length === 0) {
    // Return total time since navigation start as a fallback.
    return performance.now();
  }

  let totalForegroundTime = 0;

  for (let i = 0; i < entries.length; i++) {
    // Only calculate duration for periods where the state was 'visible'
    if (entries[i].name === 'visible') {
      const start = entries[i].startTime;
      
      // The end time is the start time of the next state change, 
      // or the current time if this is the final entry.
      const end = i + 1 < entries.length
          ? entries[i + 1].startTime
          : performance.now();
          
      totalForegroundTime += (end - start);
    }
  }

  return totalForegroundTime;
}
```

### Fallback strategies

{{ BASELINE_STATUS("page-visibility-state") }}

The `VisibilityStateEntry` API has limited availability and is currently unsupported in several major browsers. 

Because `performance.getEntriesByType('visibility-state')` will return an empty array in browsers that do not support it, feature detection is straightforward and built directly into the execution flow. You must always check if the returned array is empty before attempting to calculate foreground time.

If it is empty, the recommended fallback strategy is to gracefully degrade to standard time-on-page analytics by returning `performance.now()`. This represents the total time elapsed since the page was loaded, ensuring a valid duration is still recorded without throwing runtime errors.

```javascript
const entries = performance.getEntriesByType('visibility-state');

// Empty array means unsupported
if (entries.length === 0) {
  return performance.now(); // Fallback
}
```
