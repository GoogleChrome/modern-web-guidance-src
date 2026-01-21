---
description: Learn how to inspect, search, and edit DOM nodes in Chrome DevTools to understand and modify web page structure.
filename: dom-manipulation-with-devtools
category: ui
---

# Viewing and Editing the DOM with Chrome DevTools

This guide covers essential techniques for interacting with the Document Object Model (DOM) using Chrome DevTools, enabling developers to inspect, search, and modify web page structure and content effectively.

## Viewing DOM Nodes

The **Elements** panel in Chrome DevTools is your primary tool for DOM-related activities.

### Inspecting a Node

To quickly inspect a specific DOM node:
1. Right-click the element on the web page you wish to inspect.
2. Select **Inspect** from the context menu.
   DevTools will open, highlighting the corresponding node in the DOM Tree.

You can also use the **Select an element** tool (<img src="../images/icons/select-element.svg" role="img" alt="" aria-hidden="true" class="inline-icon">) in the **Elements** panel to click on an element in the page and have it highlighted in the DOM Tree.

### Navigating the DOM Tree with a Keyboard

Once a node is selected, you can navigate the DOM Tree using keyboard shortcuts:
- **Up/Down Arrow Keys**: Move to the parent or sibling nodes.
- **Left/Right Arrow Keys**: Collapse or expand the selected node.

### Scrolling to View Nodes

If a node isn't visible in the viewport, you can use **Scroll into view** to bring it into focus.
1. Right-click the node in the DOM Tree.
2. Select **Scroll into view**.

### Showing Rulers

To measure element dimensions:
1. Open the **Command menu** (<kbd>Control</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> or <kbd>Command</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> on macOS).
2. Type `Show rulers on hover` and press <kbd>Enter</kbd>.
Alternatively, enable rulers in **Settings** > **Preferences** > **Elements** > **Show rulers on hover**.

### Searching for Nodes

You can search the DOM Tree by text, CSS selector, or XPath:
1. Focus the **Elements** panel.
2. Press <kbd>Control</kbd>+<kbd>F</kbd> or <kbd>Command</kbd>+<kbd>F</kbd> (macOS) to open the search bar at the bottom of the DOM Tree.
3. Type your search query. DevTools highlights matching nodes and navigates to the first result.

To disable searching as you type, uncheck **Search as you type** in **Settings** > **Preferences** > **Global**.

## Editing the DOM

Chrome DevTools allows you to edit the DOM on the fly to see how changes affect the page.

### Editing Content

Double-click the text content of a node in the DOM Tree to edit it directly. Press <kbd>Enter</kbd> to confirm changes.

### Editing Attributes

Double-click an attribute's name or value to edit it. You can also add new attributes by typing them after a space within the opening tag.

### Editing Node Type

To change a node's type (e.g., from `<li>` to `<button>`):
1. Double-click the node type (e.g., `li`).
2. Type the new node type (e.g., `button`) and press <kbd>Enter</kbd>.

### Editing as HTML

For more complex edits with syntax highlighting and autocomplete:
1. Right-click the node in the DOM Tree.
2. Select **Edit as HTML**.
3. Edit the HTML content. Use <kbd>Enter</kbd> for new lines and standard keyboard shortcuts for applying changes (e.g., <kbd>Control</kbd> + <kbd>Enter</kbd> or <kbd>Command</kbd> + <kbd>Enter</kbd> on macOS).

### Duplicating a Node

To duplicate an element:
1. Right-click the node in the DOM Tree.
2. Select **Duplicate element**.
   Keyboard shortcuts: <kbd>Shift</kbd> + <kbd>Alt</kbd> + <kbd>Down</kbd> (Windows/Linux) or <kbd>Shift</kbd> + <kbd>Option</kbd> + <kbd>Down</kbd> (macOS).

### Capturing Node Screenshots

You can capture a screenshot of any individual node:
1. Right-click the node in the DOM Tree.
2. Select **Capture node screenshot**. The screenshot is saved to your downloads.

### Reordering DOM Nodes

Drag and drop nodes within the DOM Tree to change their order.

### Forcing Node State

You can force nodes into states like `:hover`, `:active`, or `:focus`:
1. Right-click the node.
2. Select **Force State** and choose the desired state.

### Hiding a Node

To hide a node:
1. Select the node in the DOM Tree.
2. Press the <kbd>H</kbd> key, or right-click and select **Hide element**.
   Pressing <kbd>H</kbd> again or using the corresponding option will show the node.

### Deleting a Node

To delete a node:
1. Select the node in the DOM Tree.
2. Press the <kbd>Delete</kbd> key, or right-click and select **Delete element**.
   You can undo deletion with <kbd>Control</kbd>+<kbd>Z</kbd> or <kbd>Command</kbd>+<kbd>Z</kbd> (macOS).

## Accessing Nodes in the Console

DevTools provides convenient ways to get JavaScript references to DOM nodes.

### Referencing the Currently Selected Node with `$0`

The `== $0` label next to a node in the **Elements** panel indicates that you can reference it in the Console using the `$0` variable. `$0` updates to reflect the currently inspected node.

### Storing as a Global Variable

To persistently reference a node:
1. Right-click the node in the DOM Tree.
2. Select **Store as global variable**.
3. In the Console, you can access this node using the variable name assigned (e.g., `temp1`).

### Copying the JavaScript Path

To get a JavaScript expression to select a node (useful for automated testing):
1. Right-click the node in the DOM Tree.
2. Select **Copy** > **Copy JS Path**.
3. Paste the copied expression into the Console to evaluate it.

## Breaking on DOM Changes

You can pause JavaScript execution when the DOM is modified:
- Read about [DOM change breakpoints](/docs/devtools/javascript/breakpoints#dom) for detailed instructions.

## Next Steps

Explore the full capabilities of the **Elements** panel by experimenting with the context menu options for nodes. Refer to [Elements panel keyboard shortcuts](/docs/devtools/shortcuts#elements) and the broader [DevTools documentation](/docs/devtools) for further learning. Engage with the [DevTools community](/docs/devtools/overview#community) for support.

## Appendix

### HTML versus the DOM

HTML is the markup language used to structure web content, while the DOM is a programming interface that represents the page's structure as a tree of objects. The DOM is dynamic and can be modified by JavaScript, potentially differing from the initial HTML source.

### Missing Options

If you don't see expected options in a context menu (e.g., "Scroll into view"), try right-clicking in an area adjacent to the node text in the DOM Tree, rather than directly on the text itself.