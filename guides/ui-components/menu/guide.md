---
name: menu
description: Build a command menu that displays actions and supports nested submenus.
web-feature-ids:
  - container-scroll-state-queries
  - popover
  - subgrid
  - menu
  - sticky-positioning
  - anchor-positioning
guides:
  - resilient-context-menus-and-nested-dropdowns
---

# Build a Command Menu

Use a command menu for actions that change the current interface, such as creating, saving, or changing preferences. Use ordinary navigation links instead when items take the user to another URL or page.

A true menu uses `role="menu"` and `role="menuitem"`. Those roles require arrow-key navigation; do not add them to a simple list of buttons unless you implement that interaction.

## Open and position the menu

Use a `popover="auto"` menu opened from a button. Popovers place the menu in the top layer and provide light-dismiss behavior. Position the popover from its trigger with anchor positioning rather than measuring the trigger in JavaScript.

```html
<button id="fileButton" popovertarget="fileMenu" aria-haspopup="menu">
  File
</button>

<div id="fileMenu" popover="auto" role="menu" aria-labelledby="fileButton">
  <button role="menuitem" type="button">New file</button>
  <button role="menuitem" type="button">Save</button>
</div>
```

```css
#fileButton {
  anchor-name: --file-button;
}

#fileMenu {
  position-anchor: --file-button;
  position-area: block-end span-inline-end;
  inset: auto;
}
```

For edge-aware placement and the popover fallback, see {{ GUIDE_REF("resilient-context-menus-and-nested-dropdowns") }}.

## Align menu item content

When menu rows include a mix of icons, labels, shortcuts, or submenu indicators, define the columns once on the menu and use `subgrid` for each row. This keeps values aligned without duplicating padding or column sizes in every item.

```css
[role="menu"] {
  display: grid;
  grid-template-columns: auto 1fr auto;
}

[role="menuitem"] {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
}
```

## Enhance a sticky menubar

When the trigger belongs in a persistent menubar, use `position: sticky` and a scroll-state query to add a visual stuck state without scroll-event JavaScript. This is an optional visual enhancement; menu opening and keyboard behavior must not depend on it.

```css
.menu-bar-wrapper {
  position: sticky;
  inset-block-start: 0;
  container-type: scroll-state;
  container-name: menu-bar;
}

@container menu-bar scroll-state(stuck: top) {
  .menu-bar { box-shadow: 0 2px 8px rgb(0 0 0 / 18%); }
}
```

## Implement menu keyboard interaction

When the menu opens, move focus to its first enabled item. Within a vertical menu, `ArrowDown` and `ArrowUp` move between enabled items, wrapping at either end. `Home` and `End` move to the first and last items. `Escape` closes the current menu and returns focus to its invoking control.

Keep this interaction scoped to the active menu. Do not intercept the arrow keys on a trigger while the menu is closed.

```js
function moveMenuFocus(menu, direction) {
  const items = [...menu.querySelectorAll('[role="menuitem"]')]
    .filter((item) => !item.disabled);
  const index = items.indexOf(document.activeElement);
  items[(index + direction + items.length) % items.length].focus();
}
```

## Add a submenu

A submenu trigger is itself a `menuitem` with `aria-haspopup="menu"` and `aria-expanded`. Its submenu is another anchored popover. Open it with the trigger's `popovertarget`, then update `aria-expanded` from the submenu's `toggle` event so it stays correct for pointer and keyboard activation.

When a submenu is open, `ArrowRight` moves focus into it. `ArrowLeft` or `Escape` closes it and returns focus to its triggering menu item. For a full resilient nested-menu implementation, including edge placement, see {{ GUIDE_REF("resilient-context-menus-and-nested-dropdowns") }}.

## Browser support and fallback strategies

{{ FEATURE_FALLBACKS("popover") }}

{{ FEATURE_FALLBACKS("anchor-positioning") }}

{{ FEATURE_FALLBACKS("subgrid") }}

{{ FEATURE_FALLBACKS("container-scroll-state-queries") }}
