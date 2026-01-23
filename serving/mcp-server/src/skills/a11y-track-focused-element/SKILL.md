---
description: Track the currently focused element on a web page to improve keyboard navigation accessibility.
filename: track-focused-element
category: a11y
---

# Track element focus

Author: Kayce Basques
Date: 2018-12-14

## Best Practices

When testing the keyboard navigation accessibility of a page, the focus ring can sometimes disappear if the element that has focus is hidden. To track the focused element in DevTools:

1.  Open the **Console**.
2.  Click **Create Live Expression**.
    ![Create Live Expression](image/create-live-expression-7643eb0385155.png)

    ![Creating a Live Expression.](image/creating-live-expression-718a18e25e5d3.png)

    For more information, see [Watch JavaScript values in real-time with Live Expressions](/docs/devtools/console/live-expressions).

3.  Type `document.activeElement`.
4.  Click outside of the **Live Expression** UI to save.

The value displayed below `document.activeElement` is the result of the expression. Since this expression always represents the focused element, you now have a method to consistently track which element has focus.

### Interacting with the focused element

*   Hover over the result to highlight the focused element in the viewport.
*   Right-click the result and select **Reveal in Elements panel** to display the element in the **DOM Tree** on the **Elements** panel.
*   Right-click the result and select **Store as global variable** to create a variable reference to the node that can be used in the **Console**.