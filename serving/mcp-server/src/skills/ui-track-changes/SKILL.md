---
description: Track changes made to HTML, CSS, and JavaScript within DevTools for debugging and development.
filename: track-changes
category: ui
---

# Track Changes in DevTools

Reference docs:
- [Local overrides](/blog/new-in-devtools-65#overrides)
- [Edit and save files with Workspaces](/docs/devtools/workspaces)
- [Sources panel](/docs/devtools/javascript/sources#edit)
- [Elements panel > Styles pane](/docs/devtools/css#declarations)

## Overview

The **Changes** panel in DevTools allows you to track modifications made to your HTML, CSS, and JavaScript directly within the browser's developer tools. This is incredibly useful for debugging, experimenting with styles, and quickly reviewing code alterations.

The **Changes** panel tracks edits made to:

- **HTML**: When using [Local overrides](/blog/new-in-devtools-65#overrides) in the **Sources** panel.
- **CSS**: In the [**Elements** > **Styles**](/docs/devtools/css#declarations) pane or the **Sources** panel.
- **JavaScript**: In the **Sources** panel.

**Important Note:** The **Changes** panel only reflects modifications made within DevTools. Reloading DevTools or the web page will cause these changes to disappear unless you've configured [Local overrides](/blog/new-in-devtools-65#overrides) for persistence or set up [Workspaces](/docs/devtools/workspaces) to save changes to your local files.

## Opening the Changes Panel

There are two primary ways to access the **Changes** panel:

1.  **Using the Command Menu:**
    *   Open DevTools.
    *   Press <kbd>Command</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> (Mac) or <kbd>Control</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> (Windows, Linux, ChromeOS) to open the Command Menu.
    *   Type `changes`, select **Show Changes**, and press <kbd>Enter</kbd>.

2.  **Via the Customize and Control Menu:**
    *   Click the <img src="image/N7wEDmtW9lnrSxPRupMa.svg" alt="" width="24" height="24"> **Customize and control DevTools** icon (three vertical dots) in the top-right corner of DevTools.
    *   Navigate to **More tools** > **Changes**.

By default, the **Changes** panel appears in the **Drawer** at the bottom of your DevTools window.

## Viewing and Understanding Your Changes

Once the **Changes** panel is open, you can see a clear breakdown of your modifications:

1.  Ensure DevTools is open and you have made changes to your sources (HTML, CSS, or JavaScript as described in the "Overview").
2.  Open the **Changes** panel.
3.  In the right-hand pane of the **Changes** panel, select the file you've modified.
4.  A `diff` view will be displayed, highlighting additions (green) and deletions (red) within the code. The panel automatically "pretty-prints" the diff, making it easy to read even for long lines.

## Copying CSS Changes

If you've made CSS edits in the [**Elements** > **Styles**](/docs/devtools/css#declarations) pane, you can easily copy all those changes:

1.  Open the **Changes** panel.
2.  Select the modified CSS file in the right-hand pane.
3.  Click the <img src="image/copy-ec072678afe73.svg" alt="Copy." width="20" height="20"> **Copy** button located at the bottom of the panel.

## Reverting Changes to a File

If you need to discard modifications made to a specific file:

1.  In the left-hand side of the **Changes** panel, select the file you wish to revert.
2.  Click the <img src="image/undo-20a57d3c05e16.svg" alt="Undo" width="20" height="20"> **Revert all changes to current file** button on the action bar at the bottom of the panel.