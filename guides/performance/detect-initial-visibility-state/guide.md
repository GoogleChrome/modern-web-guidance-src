---
name: detect-initial-visibility-state
description: Reliably determine whether a page was initially loaded in the background, even in cases where the script is loaded asynchronously after the user foregrounded the page.
web-feature-ids:
    - page-visibility-state
sources:
    - https://developer.mozilla.org/en-US/docs/Web/API/VisibilityStateEntry
---

Scripts that are loaded asynchronously or deferred often run after the user has already foregrounded the tab. If you only check `document.visibilityState` when the script executes, it will report `'visible'`, incorrectly suggesting the page was loaded in the foreground. This skews performance metrics and analytics.

The Performance Timeline API solves this by recording a `visibility-state` entry with a `startTime` of `0` that captures the true initial state of the document, allowing you to accurately look back in time.

### Implementation

MANDATORY: You must query the performance timeline for `'visibility-state'` entries. The first entry in the returned array represents the initial visibility state of the page.

```javascript
/**
 * Reliably retrieves the initial visibility state of the page.
 * @returns {string} The initial visibility state (e.g., 'hidden' or 'visible').
 */
function getInitialVisibilityState() {
  // DO check the performance timeline for the true initial state.
  // This array will always contain an initial entry with a startTime of 0 
  // in browsers that support VisibilityStateEntry.
  const entries = performance.getEntriesByType('visibility-state');
  
  if (entries.length > 0) {
    // Return the name property, which holds the initial state
    return entries[0].name;
  }

  // Fallback for browsers that don't support the API.
  return document.visibilityState;
}

// Example usage for analytics or performance instrumentation:
const initialState = getInitialVisibilityState();
if (initialState === 'hidden') {
  // Treat performance metrics differently, as background pages
  // often face resource throttling or rendering delays.
}
```

### Fallback strategies

{{ BASELINE_STATUS("page-visibility-state") }}

Because this feature is not yet fully Baseline, you MUST implement a fallback strategy. When `performance.getEntriesByType('visibility-state')` returns an empty array, gracefully degrade by returning the current `document.visibilityState`. While this fallback might incorrectly report `'visible'` for pages that started hidden and were subsequently foregrounded before the script ran, it guarantees you still receive a valid state string without breaking the application.
