---
name: context-menu
description: Build a context menu component that displays a list of options or actions when users right-click on an element.
web-feature-ids:
  - popover
  - anchor-positioning
  - focusgroup
  - invoker-commands
  - toggleevent-source
guides:
  - menu
---

# Context Menu

A context menu provides quick access to actions related to a specific item or region. In a list of items, they are triggered by a single button. They can also be a secondary interaction, triggered by right-clicking or (in some cases) long-pressing, and allow the primary click or touch action to remain dedicated to tasks like selection, navigation, or drag-and-drop.

- **Right-click + Visible Menu Button (Recommended):** Needed when the menu is the primary way to reach those actions on the current view, and supports touch, keyboard, and discoverability.
- **Visible Menu Button Only:** Use if Right-click behavior is not needed.

A Right-click Only option is only accessible when the item can first be selected, and then the same actions are accessible elsewhere (e.g., in a persistent toolbar).

## Implementation

### 1. Shared foundation

Use the `popover` attribute to create a container for the menu that can be promoted to the top layer. Ensure items use `:focus` or `:focus-visible` styling so they are clearly highlighted when focused via keyboard. Use `aria-labelledby` pointing to the visible button trigger.

A context menu should not be reused across multiple items, and each must have a unique ID.

```html
<!-- The menu container -->
<div popover id="context-menu">
  <div focusgroup="menu nomemory" aria-label="Context Menu">
    <button type="button">Edit</button>
    <button type="button">Share</button>
    <button type="button">Delete</button>
  </div>
</div>
```

Use CSS Anchor Positioning to align the popover to its anchor while also preventing the popover from overflowing.

```css
/* Position the popover relative to its anchor */
[popover] {
  margin: 0;
  inset: auto;
  /* Use position-area to align the menu relative to the anchor */
  position-area: block-end span-inline-end;
  position-try: flip-inline, flip-block, flip-start;
}
```

### 2. Method A: Right-Click Trigger (Cursor-Anchored)

To position the menu exactly at the cursor, use an invisible anchor element placed with JavaScript when the user right-clicks. On some platforms (though notably not iOS Safari) this may also be triggered with a long press, but that is not a universal behavior. Put this element inside the element that triggers the context menu, immediately before the visible button.

```html
<span class="menu-anchor"></span>
```

```css
/* An invisible anchor that follows the cursor */
.menu-anchor {
  position: fixed;
  inline-size: 0;
  block-size: 0;
}
```

Listen for the `contextmenu` event to prevent the browser's default menu, and use `mouseup` (or `pointerup`) to capture the coordinates and open the popover.

{# Popovers can not be shown from within a `contextmenu` event, except in Chrome > 153. See https://github.com/whatwg/html/issues/10905 #}
```js
const card = document.querySelector('.card');
const menuAnchor = card.querySelector('.menu-anchor');
const popover = card.querySelector('#context-menu');

function openContextMenu(e) {
  const x = e.clientX;
  const y = e.clientY;

  // Move the anchor element to the cursor position
  // Use physical rather than logical to match clientX/clientY.
  menuAnchor.style.left = `${x}px`;
  menuAnchor.style.top = `${y}px`;

  // Open the popover and associate it with the anchor source.
  // MANDATORY: Use showPopover({source}) to establish the implicit anchor.
  popover.showPopover({ source: menuAnchor });
  popover.querySelector('button:not([disabled])')?.focus();
}

card.addEventListener('contextmenu', (e) => {
  // Prevent the browser's default context menu
  e.preventDefault();
});

card.addEventListener('mouseup', (e) => {
  // button 2 = right mouse click
  if (!(e.button === 2 || e.ctrlKey)) return;
  openContextMenu(e);
});
```

### 3. Method B: Visible Menu Button (Element-Anchored)

For touch users or general discovery, add a visible button that toggles the same popover. Use the `command` and `commandfor` attributes for a declarative approach. Place the popover element immediately after this `<button>`.

```html
<button type="button" 
  command="toggle-popover" 
  commandfor="context-menu"
  aria-haspopup="menu" aria-expanded="false"
  aria-label="Actions for item 1">
  <!-- Visual trigger (e.g. three dots icon) -->
</button>
```

The `command` attribute sets the popover's implicit anchor position, in the same way as the source in `showPopover({source})`. It can be used as an anchor without setting an `anchor-name` or `position-anchor`. Keep the value of `aria-expanded` in sync with the popover's state.

```js
const trigger = card.querySelector('[commandfor="context-menu"]');
let enterOnOpen = false;

// If invoked by keyboard (Enter/Space), detail is 0.
trigger.addEventListener('click', (e) => {
  if (e.detail === 0) enterOnOpen = true;
});

// ArrowDown on the trigger should also open and enter the menu.
trigger.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!popover.matches(':popover-open')) {
      enterOnOpen = true;
      popover.showPopover({ source: trigger });
    } else {
      popover.querySelector('button:not([disabled])')?.focus();
    }
  }
});

popover.addEventListener('toggle', (event) => {
  trigger.setAttribute('aria-expanded', String(event.newState === 'open'));
  if (event.newState === 'open' && enterOnOpen) {
    popover.querySelector('button:not([disabled])')?.focus();
    enterOnOpen = false;
  }
});
```


### 4. Combining both methods

To differentiate between the source, for instance to adjust the positioning, check `event.source` in the popover's `beforetoggle` event, and set an attribute that can be used for styling.

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

### Fallback for Invoker Commands

{{ BASELINE_STATUS("invoker-commands") }}

If your Baseline target does not support Invoker Commands, use `popovertarget`.

```html
<button type="button" 
  popovertarget="context-menu"
  aria-haspopup="menu" aria-expanded="false"
  aria-label="Actions for item">
  <!-- Visual trigger (e.g. three dots icon) -->
</button>
```

### Fallback for Anchor Positioning and ToggleEvent source

{{ BASELINE_STATUS("anchor-positioning") }}

{{ BASELINE_STATUS("toggleevent-source") }}

If your Baseline target does not support CSS Anchor Positioning, you must manually calculate the `inset` coordinates of the popover in JavaScript. Use the `beforetoggle` event to handle this for both cursor and button triggers. Note that this does not handle overflow.

If your Baseline target does not support the ToggleEvent source property, TODO.

```js
popover.addEventListener('beforetoggle', (event)=>{
  if (event.newState === "open" && !("positionArea" in document.documentElement.style)) {
    const rect = event.source.getBoundingClientRect();
    popover.style.left = `${rect.left}px`;
    popover.style.top = `${rect.bottom}px`;
  }
});
```

{{ FEATURE_FALLBACKS("focusgroup") }}