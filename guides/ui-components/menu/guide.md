---
name: menu
description: Build an accessible application command menu with nested submenus.
web-feature-ids:
  - popover
  - subgrid
  - anchor-positioning
  - focusgroup
guides:
  - resilient-context-menus-and-nested-dropdowns
---

# Build an application command menu

Use this pattern for actions that change the current interface, such as creating, saving, or changing preferences. Use ordinary links in a `<nav>` when items take users to destinations; that pattern uses `Tab`, not a menu.

Use the menu pattern only for a composite widget with one tab stop and arrow-key navigation. Use a `<div focusgroup="menu no-memory">`, not the HTML `<menu>` element. Do not add `role="menu"` or `role="menuitem"` in the shared markup: native focusgroup infers those roles, and explicit roles block that inference. Add them only in the unsupported-browser fallback below. `no-memory` makes reopening start at the first item. Focusgroup moves focus; JavaScript still activates commands, syncs `aria-expanded`, and restores focus on close.

## Open and position the menu

Use a `type="button"` trigger. Open and close with `showPopover()` and `hidePopover()`. Do not use `popovertarget` or `popovertargetaction`: declarative targeting makes the button the popover source and adds implicit `aria-expanded` and `aria-details` that this pattern sets itself.

Nest the focusgroup inside the popover. Putting `focusgroup` on the `[popover]` element makes Chromium drop its keyboard behavior.

```html
<button id="file-trigger" type="button" aria-haspopup="menu" aria-expanded="false">
  File
</button>
<div id="file-menu" popover="auto">
  <!-- Nested, not on the popover: Chromium otherwise drops focusgroup keyboard behavior. -->
  <div focusgroup="menu no-memory" aria-labelledby="file-trigger">
    <button type="button">New file</button>
    <button type="button">Save</button>
    <button id="preferences-trigger" type="button" aria-haspopup="menu" aria-expanded="false">
      Preferences <span aria-hidden="true">›</span>
    </button>
  </div>
</div>
```

Name each menu with `aria-labelledby` pointing at its trigger. Keep decorative submenu indicators `aria-hidden="true"`. Put `role="menubar"` on the element that contains the top-level triggers, not on a menu popover.

### Position the menu with CSS Anchor Positioning

Position with CSS anchor positioning, not JavaScript coordinates. Opening, closing, and keyboard behavior must not depend on anchor positioning.

```css
/* Define the anchor name on the trigger button */
#file-trigger {
  anchor-name: --file-trigger;
}

/* Position the popover menu relative to its anchor trigger */
#file-menu {
  position-anchor: --file-trigger;
  position-area: block-end span-inline-end; /* Places menu below the button, aligned to its starting edge */
  inset: auto; /* Clear standard popover insets to let anchor positioning control layout */
}
```

## Keyboard

Do not add a second roving-tabindex system where native focusgroup is supported. JavaScript covers only what focusgroup does not:

- One tab stop for the menubar. `Tab` enters at the first top-level trigger. `ArrowLeft` and `ArrowRight` move between top-level triggers. From an open top-level menu, those keys close it, open the adjacent menu, and focus its first item, wrapping at either end.
- Focusing a trigger previews its menu: show it, set `aria-expanded="true"`, and leave focus on the trigger. No item is focused. Blurring the trigger closes a preview-only menu. `Enter` or `Space` converts a preview to an open menu and focuses the first item. `ArrowDown` also enters and focuses the first item. Pointer click on a previewed trigger opens it and focuses the first item. Pointer click on an open trigger closes it. From an open top-level menu, Left/Right close it, open the adjacent menu (including its submenu if one exists without moving focus into it), and move focus to that menu's trigger. A trigger's `aria-expanded` stays true for both preview and open states.
- `ArrowUp` and `ArrowDown` move between enabled items. `Home` and `End` move to the first and last enabled item.
- `Enter` or `Space` on a focused command activates it, then closes the open menus.
- `Escape` closes the current level and restores focus to the trigger that opened it. `Tab` leaves the menu system; do not trap it or use it to visit every command. Closing must not leave focus inside hidden content. Set `aria-expanded="false"` when closing each popover.

A preview closes when the trigger loses focus. An open menu stays open until the user activates a command, presses Escape, or Tab away. Track which menus are only previewed (vs. open) in a WeakSet or similar; use that to know whether blur should close a menu and whether Enter/Space should focus the first item or dismiss without focus-moving:

```js
const previewedMenus = new WeakSet(); // Track menus shown by focus, not by explicit open

trigger.addEventListener('focus', () => {
  if (!menu.matches(':popover-open')) {
    menu.showPopover();
    previewedMenus.add(menu); // Preview state
  }
  trigger.setAttribute('aria-expanded', 'true');
});

trigger.addEventListener('blur', () => {
  if (previewedMenus.has(menu)) {
    menu.hidePopover(); // Close preview on blur
    previewedMenus.delete(menu);
    trigger.setAttribute('aria-expanded', 'false');
  }
});

trigger.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (previewedMenus.has(menu)) {
      previewedMenus.delete(menu); // Convert preview to open
    } else if (menu.matches(':popover-open')) {
      menu.hidePopover(); // Close already-open menu
      trigger.setAttribute('aria-expanded', 'false');
      return;
    } else {
      menu.showPopover(); // Open from closed
    }
    if (menu.matches(':popover-open')) {
      trigger.setAttribute('aria-hidden', 'true'); // One frame only
      trigger.setAttribute('aria-expanded', 'true');
      focusFirst(menu);
      requestAnimationFrame(() => trigger.removeAttribute('aria-hidden'));
    }
  }
});
```

Light-dismiss fires `pointerdown` before `click`. Ignore that following click, or the trigger reopens the menu it just closed:

```js
let suppressNextClick = false;
trigger.addEventListener('pointerdown', event => {
  if (!menu.matches(':popover-open')) return;
  event.preventDefault();
  suppressNextClick = true;
  closeMenu(menu, true);
});

trigger.addEventListener('click', event => {
  event.preventDefault();
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  if (menu.matches(':popover-open')) closeMenu(menu, true);
  else openMenu(menu, trigger);
});
```

## Add a submenu

A submenu trigger is a menu item with `aria-haspopup="menu"` and author-managed `aria-expanded`. Use `popover="manual"`, opened imperatively, with its own nested `focusgroup="menu no-memory"`. `manual` stops the parent menu light-dismissing when focus enters the submenu.

Focusing the submenu trigger previews it without moving focus. `ArrowRight` enters it and focuses the first item. `ArrowLeft` closes it and returns focus to the parent item. `ArrowRight` on an item with no child submenu closes the hierarchy, moves to the next top-level trigger, and previews that menu without leaving the trigger. `ArrowDown` then enters it. Pointer activation matches the keyboard: an already open submenu trigger closes and restores focus to itself. Clicking outside closes every open level.

Stop `Escape` and `ArrowLeft` from bubbling, or the parent level closes too:

```js
submenu.addEventListener('keydown', event => {
  if (event.key !== 'Escape' && event.key !== 'ArrowLeft') return;
  event.preventDefault();
  event.stopPropagation(); // Close only this level; both keys already restore focus in closeMenu
  closeMenu(submenu, true);
});
```

Place the submenu beside its trigger. `position-try-fallbacks` flips it when that side does not fit; do not add a viewport breakpoint for that.

```css
#preferences-trigger {
  anchor-name: --preferences-trigger;
}
#preferences-menu {
  position-anchor: --preferences-trigger;
  position-area: inline-end span-block-end; /* Beside the parent item, not below the whole menu */
  position-try-fallbacks: flip-inline, flip-block;
  inset: auto;
}
```

## Align menu item content

When a row has an icon, label, and shortcut or submenu indicator, define the columns on the focusgroup and use `subgrid` on each row. Hide shortcut text from assistive technology when it only repeats a key that already operates the item.

```css
[focusgroup~="menu"] {
  display: grid;
  grid-template-columns: auto 1fr auto;
  row-gap: .1rem;
}

[focusgroup~="menu"] > button {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
}
```

Each button spans all three columns and inherits the parent's grid via `subgrid`. Content inside the button naturally aligns to its column. To place a submenu indicator or keyboard shortcut in the third column without wrapping, nest it in a `<span>` with `grid-column: 3`:

```html
<div focusgroup="menu no-memory">
  <button type="button">Save</button>
  <button type="button">
    Preferences
    <span aria-hidden="true" style="grid-column: 3;">›</span>
  </button>
</div>
```

## Progressive enhancement and fallbacks

Keep `focusgroup="menu no-memory"` in the markup. If `'focusgroup' in HTMLElement.prototype` is false, install Up, Down, Home, and End navigation and set `role="menu"` on each menu container and `role="menuitem"` on its command buttons. Do not install that fallback when native focusgroup is present. Left, Right, preview, open, and close are author script either way.

```js
if (!('focusgroup' in HTMLElement.prototype)) {
  document.querySelectorAll('[focusgroup~="menu"]').forEach(group => {
    group.setAttribute('role', 'menu');
    group.querySelectorAll(':scope > button').forEach(item => {
      item.setAttribute('role', 'menuitem');
    });
    group.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const items = [...group.querySelectorAll(':scope > button')]
        .filter(item => !item.disabled && item.getAttribute('aria-disabled') !== 'true');
      if (!items.length) return;
      const current = items.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 :
        (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
      event.preventDefault();
      items[next < 0 ? 0 : next].focus({ preventScroll: true });
    }, true);
  });
}
```

{{ FEATURE_FALLBACKS("popover") }}

{{ FEATURE_FALLBACKS("anchor-positioning") }}

{{ FEATURE_FALLBACKS("focusgroup") }}
