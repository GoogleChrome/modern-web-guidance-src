---
name: context-menu
description: Build a context menu component that displays a list of options or actions when users right-click or long-press on an element.
web-feature-ids:
  - popover
  - anchor-positioning
  - focusgroup
  - invoker-commands
---

## Context Menu

A context menu provides quick access to actions related to a specific element or region. As a secondary interaction triggered by right-clicking or long-pressing, they allow the primary click or touch action to remain dedicated to tasks like selection, navigation, or drag-and-drop.

## Implementation

### 1. Define the Menu Structure

Use the `popover` attribute to create a container that can be promoted to the top layer. Refer to the separate menu button variant in {{ GUIDE_REF("menu") }} for the full menu structure and keyboard navigation requirements.

```html
<!-- The menu container -->
<div popover id="context-menu">
  <div focusgroup="menu nomemory">
    <button type="button">Edit</button>
    <button type="button">Share</button>
    <button type="button">Delete</button>
  </div>
</div>
```

### 2. Positioning at the Cursor

To position the menu exactly at the cursor, use an invisible anchor element placed with JavaScript when the user right-clicks or long presses. Then, use anchor positioning to align the popover to that anchor while also preventing the popover from overflowing.

```css
/* An invisible anchor that follows the cursor */
.menu-anchor {
  position: absolute;
  inline-size: 0;
  block-size: 0;
}

/* Position the popover relative to its anchor */
#context-menu {
  margin: 0;
  /* Use position-area to align the menu relative to the anchor */
  position-area: block-end span-inline-end;
  position-try: flip-inline, flip-block, flip-start;
}
```

### 3. Triggering the Menu

Listen for the `contextmenu` event to prevent the browser's default menu, and use `mouseup` (or `pointerup`) to capture the coordinates and open the popover.

{# Popovers can not be shown from within a `contextmenu` event, except in Chrome > 153. See https://github.com/whatwg/html/issues/10905 }
```js
const card = document.querySelector('.card');
const menuAnchor = card.querySelector('.menu-anchor');
const popover = card.querySelector('#context-menu');

card.addEventListener('contextmenu', (e) => {
  // Prevent the browser's default context menu
  e.preventDefault();
});

card.addEventListener('mouseup', (e) => {
  // button 2 = right mouse click
  if (!(e.button === 2 || e.ctrlKey)) return;

  // Calculate relative coordinates
  const rect = card.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Move the anchor element to the cursor position
  // Use physical rather than logical to match `getBoundingClientRect()`.
  menuAnchor.style.left = `${x}px`;
  menuAnchor.style.top = `${y}px`;

  // Open the popover and associate it with the anchor source
  // MANDATORY: Use showPopover({source}) to establish the implicit anchor
  popover.showPopover({ source: menuAnchor });
});
```

### 4. Optional: Discovery Button

Actions in a context menu MUST be accessible in another way for users who cannot trigger a context menu. For touch users or general discovery, add a visible button that toggles the same popover. Use the `command` and `commandfor` attributes for a declarative approach.

```html
<button type="button" 
  command="toggle-popover" 
  commandfor="context-menu" 
  aria-label="Open context menu">
  <!-- Visual trigger (e.g. three dots icon) -->
</button>
```

The `command` attribute sets the popover's implicit anchor position, in the same way as the source in `showPopover({source})`. It can be used as an anchor without setting an `anchor-name` or `position-anchor`. To differentiate between the source, for instance to adjust the positioning, check `event.source` in the popover's `beforetoggle` event, and set an attribute that can be used for styling.

```js
popover.addEventListener('beforetoggle', (event)=>{
  if (event.newState === "open") {
    popover.setAttribute("source", event.source?.tagName ?? "");
  }
});
```

```css
[popover][source="button" i]{
  position-area: block-end span-inline-start;
}
```

## Fallbacks

{{ FEATURE_FALLBACKS("popover") }}

{{ FEATURE_FALLBACKS("anchor-positioning") }}

{{ FEATURE_FALLBACKS("focusgroup") }}

{{ FEATURE_FALLBACKS("invoker-commands") }}

### Fallback for Anchor Positioning

If your Baseline target does not support CSS Anchor Positioning, you must manually calculate the `inset` coordinates of the popover in JavaScript. Note that this does not handle overflow.

```js
// Manual fallback if anchor positioning is unsupported
if (!("positionArea" in document.documentElement.style)) {
  // Position relative to the viewport or container
  popover.style.left = `${e.clientX}px`;
  popover.style.top = `${e.clientY}px`;
}
```

{{ BASELINE_STATUS("anchor-positioning") }}
