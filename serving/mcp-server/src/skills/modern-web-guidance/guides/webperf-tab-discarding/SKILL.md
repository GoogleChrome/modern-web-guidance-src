---
description: Automatically discard unused Chrome tabs to reduce memory footprint and improve browser performance.
filename: tab-discarding
category: webperf
---

# Tab Discarding

Reference docs:
- `chrome://flags/#enable-tab-discarding`
- `chrome://discards`

## Best Practices

Chrome's tab discarding feature automatically unloads background tabs that are not actively being used when the system is low on memory. This frees up RAM and can improve overall browser responsiveness.

### Enabling Tab Discarding

1.  Navigate to `chrome://flags/#enable-tab-discarding` in your Chrome browser.
2.  Select "Enabled" from the dropdown menu.
3.  Click the "Relaunch" button to restart Chrome.

### Managing Discarded Tabs

The `chrome://discards` page provides insights into your open tabs, ranking them by how "interesting" they are to Chrome. You can manually discard tabs from this page by clicking the "Discard" button next to a specific tab, or trigger a discard for the last tab in the list.

### Understanding Discard Order

Chrome discards tabs based on a priority list, aiming to keep the most relevant tabs active:

1.  Internal pages (e.g., new tab, bookmarks)
2.  Tabs selected a long time ago
3.  Tabs selected recently
4.  Apps running in a window
5.  Pinned tabs
6.  The currently selected tab

### Browser Behavior

-   Discarded tabs do not disappear; they remain visible in the tab strip with a `[Discarded]` prefix.
-   Navigating back to a discarded tab will reload it. Form content, scroll position, and other states are saved and restored.
-   The mechanism is similar to tab discarding on ChromeOS, where the renderer process is shut down and reloaded upon activation.

## Future Improvements

The **Tab Serializer** is a planned feature that aims to significantly enhance tab discarding by serializing the entire state of a tab (DOM, WebGL, Canvas, CSS, V8 JavaScript VM state) into a binary blob. This blob can then be deserialized to restore the tab to its exact previous state without needing to reload from the network, even after aggressive memory management. This is particularly useful for preserving user interactions.

## Inspiration: The Great Suspender

Extensions like "The Great Suspender" offer similar functionality by suspending tabs after a period of inactivity, reducing memory and GPU usage. While helpful, native tab discarding is generally more efficient as it integrates deeper into the browser's memory management.

**DO** experiment with tab discarding, especially if you are a frequent "tab hoarder," to see its impact on your system's performance.
**DO** provide feedback on `crbug.com` for any bugs encountered or suggestions for improvement.