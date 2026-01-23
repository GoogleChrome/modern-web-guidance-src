---
description: Allows developers to quickly view and edit resources directly from the Elements panel in Chrome DevTools.
filename: elements-panel-resource-editing
category: ui
---

# Quickly Edit/View Resources from the Elements Panel

This guide explains how to efficiently edit and view resources that appear in the Elements Panel DOM tree within Chrome DevTools.

## Use Case

When inspecting a webpage in Chrome DevTools, you might encounter elements like `<script>` tags or `<link rel="stylesheet">` tags in the Elements panel. These represent external resources. Instead of navigating to the Sources panel separately, you can directly interact with these resources from the Elements panel.

## How to Edit/View Resources

1.  **Locate the Resource:** In the Elements panel, find the DOM element that references a resource (e.g., a `<script>` or `<link>` tag).

2.  **Right-Click and Open:** Right-click on the identified element.

3.  **Select "Open":** From the context menu, choose the "Open" option.

    This action will open the associated resource file directly in the Sources panel.

4.  **View and Edit:** Once opened in the Sources panel, you can view the full source code of the file. You can also make edits directly to the code. Changes you make in the Sources panel are reflected in the live webpage (though you might need to refresh the page or the panel to see all updates).

## Example

Consider the following HTML snippet in the Elements Panel:

```html
<script src="app.js"></script>
<link rel="stylesheet" href="styles.css">
```

By right-clicking on the `<script src="app.js"></script>` element and selecting "Open", the `app.js` file will be displayed and editable in the Sources panel. The same applies to the `styles.css` file.

## Benefits

*   **Efficiency:** Saves time by reducing the need to navigate between different panels in DevTools.
*   **Convenience:** Allows for quick checks and edits of linked resources directly in the context of the DOM element.
*   **Streamlined Debugging:** Simplifies the process of inspecting and modifying the source files that contribute to the rendered page.