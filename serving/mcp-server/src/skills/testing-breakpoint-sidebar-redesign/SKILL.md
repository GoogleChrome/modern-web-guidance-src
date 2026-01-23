---
description: Streamline debugging by making common breakpoint actions more accessible and intuitive in Chrome DevTools.
filename: breakpoint-sidebar-redesign
category: testing
---

# Debugging with the Breakpoint Sidebar

Reference docs:
- https://developer.chrome.com/docs/devtools/javascript/breakpoints/

## Best Practices

The redesigned Breakpoint sidebar in Chrome DevTools aims to improve the debugging workflow by providing a better overview of breakpoints, making common actions more intuitive, and highlighting existing features.

### Pause on Exceptions

*   Utilize the "Pause on exceptions" feature to stop code execution when an error is thrown, allowing for easier investigation of the circumstances.
*   Choose to pause on caught exceptions, uncaught exceptions, or both by checking the corresponding checkboxes.
*   **Note:** For Node.js debugging in Chrome 113, pausing on caught exceptions is only possible when also pausing on uncaught exceptions due to LTS compatibility. Updates can be followed at [crbug.com/1382762](https://crbug.com/1382762).

### Managing Breakpoints

*   **Group and Focus:** Breakpoints are grouped by file. Expand relevant groups and collapse others to focus on specific areas of your code during debugging sessions.
*   **Differentiate Files:** If multiple files share the same name, Chrome DevTools will display a portion of the file path to help differentiate them.

### One-Click Actions

The sidebar allows for single-click execution of common breakpoint management tasks:

*   **Jump to Location:** Click on a breakpoint's code snippet to navigate directly to its location in the Code Editor.
*   **Remove Breakpoints:** Hover over a breakpoint or group and click the revealed remove button to delete a single breakpoint or all breakpoints within a file.
*   **Enable/Disable Breakpoints:** Check or uncheck the checkbox next to a breakpoint to toggle its active state. To enable or disable all breakpoints in a file, use the checkbox next to the file name in the breakpoint group.

### Advanced Breakpoint Features

*   **Conditional Breakpoints:** Set breakpoints that only pause execution when a specified condition is true.
*   **Logpoints:** Use logpoints as a more integrated alternative to `console.log`, allowing you to log messages or values directly within DevTools without stopping execution.

#### Editing Breakpoint Conditions and Logs

*   **Edit Button:** Hover over a breakpoint and click the "edit" button to open a dialog for changing the breakpoint type, condition, or logpoint message.
*   **Keyboard Shortcut:** Alternatively, select the breakpoint line in the code editor and use the keyboard shortcut:
    *   Linux: <kbd>Control</kbd>+<kbd>Alt</kbd>+<kbd>b</kbd>
    *   Mac: <kbd>Command</kbd>+<kbd>Alt</kbd>+<kbd>b</kbd>
*   **Hover to View:** Quickly review a breakpoint's condition or logpoint message by hovering over the breakpoint in the sidebar.

## Conclusion

The redesign of the Breakpoint sidebar prioritizes structure, accessibility, and clarity to make debugging with breakpoints more efficient. These improvements are intended to enhance your debugging sessions. For further suggestions, please [file a bug](https://crbug.com/new).