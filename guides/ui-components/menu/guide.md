---
name: menu
description: Build an accessible application command menu with nested submenus.
web-feature-ids:
  - popover
  - invoker-commands
  - subgrid
  - anchor-positioning
  - focusgroup
guides:
  - resilient-context-menus-and-nested-dropdowns
---

# Build an application command menu

Use this pattern for actions that change the current interface, such as creating, saving, or changing preferences. Use ordinary links in a `<nav>` when items take users to destinations; that pattern uses `Tab`, not a menu.

Use the menu pattern only for a composite widget with one tab stop and arrow-key navigation. Use a `<div focusgroup="menu nomemory">`, not the HTML `<menu>` element. Do not add `role="menu"` or `role="menuitem"` in the shared markup: native focusgroup infers those roles, and explicit roles block that inference. Add them only in the unsupported-browser fallback below. `nomemory` makes reopening start at the first item. Focusgroup moves focus; script handles preview, activation, and focus restoration.

{# Maintainer note: Nest [focusgroup] inside [popover] rather than on the same element because Chromium clobbers focusgroup keyboard behavior on [popover] elements (https://issues.chromium.org/issues/564673920, https://github.com/whatwg/html/issues/11641). Placing each [popover] as the immediate nextElementSibling of its [commandfor] trigger suppresses the implicit aria-details relation per HTML-AAM (https://www.w3.org/TR/html-aam-1.0/#att-command-popovers) and allows nested submenus to use popover="auto" without light-dismissing their parent menu. #}

## Open and position the menu

Make each trigger a command invoker with `commandfor` and `command="toggle-popover"`. The browser opens and closes the popover on click, Enter, and Space, and keeps the trigger inside its popover's light-dismiss group, so clicking an open trigger closes it. Do not use `popovertarget` or `popovertargetaction`; this pattern uses `commandfor` instead.

Place each popover immediately after its trigger. Browsers add an implicit `aria-details` relationship only when the popover is not the next sibling, so this placement avoids it without extra attributes.

```html
<!-- Command invoker: the browser toggles the popover on click, Enter, and Space -->
<button id="file-trigger" class="trigger" type="button" aria-haspopup="menu" aria-expanded="false"
  commandfor="file-menu" command="toggle-popover">
  File
</button>
<!-- Immediately after its trigger, so browsers add no implicit aria-details -->
<div id="file-menu" popover="auto">
  <!-- Nested, not on the popover: Chromium otherwise drops focusgroup keyboard behavior -->
  <div focusgroup="menu nomemory" aria-labelledby="file-trigger">
    <button type="button">New file</button>
    <button type="button">Save</button>
    <button id="export-trigger" type="button" aria-haspopup="menu" aria-expanded="false"
      commandfor="export-menu" command="toggle-popover">
      Export <span aria-hidden="true">›</span>
    </button>
    <!-- Submenu: popover="auto" directly after its trigger, inside the parent focusgroup -->
    <div id="export-menu" popover="auto">
      <div focusgroup="menu nomemory" aria-labelledby="export-trigger">
        <button type="button">PDF</button>
        <button type="button">Plain Text</button>
      </div>
    </div>
  </div>
</div>
```

Name each menu with `aria-labelledby` pointing at its trigger. Keep decorative submenu indicators in CSS, or add `aria-hidden="true"`. Put `role="menubar"` on the element that contains the top-level triggers, not on a menu popover. Give triggers with `aria-expanded="true"` a visible active style so users can tell which menu is open or previewed.

### Position the menu with CSS Anchor Positioning

Use CSS anchor positioning, not JavaScript coordinates. Both `command="toggle-popover"` and `showPopover({ source: trigger })` set an implicit anchor, so do not add per-menu `anchor-name` or `position-anchor` rules. Menu behavior must not depend on anchor positioning.

```css
/* Top-level menus sit below their trigger. The implicit anchor comes from the invoker or source. */
[popover] {
  position-area: block-end span-inline-end;
  inset: auto;
}

/* A popover nested in another popover is a submenu: beside its parent item, flipping when it would overflow. */
[popover] [popover] {
  position-area: inline-end span-block-end;
  position-try-fallbacks: flip-inline, flip-block;
}
```

## Keyboard and focus

Do not add a second roving-tabindex system inside a focusgroup. Script covers only what the invokers and focusgroup do not:

* **One tab stop for the menubar.** `Tab` enters at the first top-level trigger. `ArrowLeft` and `ArrowRight` move between top-level triggers and wrap at either end.
* **Preview.** Focusing a top-level trigger shows its menu and sets `aria-expanded="true"`. Focus stays on the trigger, and no item is focused. Blurring the trigger closes a preview-only menu.
* **Enter and Space on a preview.** They close the preview and keep focus on the trigger. The native `toggle-popover` action handles this, so the script must not intercept these keys.
* **ArrowDown on a preview.** Converts it to an open menu and focuses the first item.
* **Pointer click on a preview.** Enters the menu and focuses the first item. This is the only activation the script intercepts.
* **Pointer click on an open trigger.** Closes it natively.
* **Within a menu.** `ArrowUp` and `ArrowDown` move between enabled items. `Home` and `End` move to the first and last enabled item, which the script handles.
* **ArrowLeft or ArrowRight in an open top-level menu.** Closes it, opens the adjacent menu, and focuses that menu's first item, wrapping at either end.
* **ArrowRight on a submenu trigger.** Opens the submenu and focuses its first item.
* **ArrowRight on a submenu item without a child submenu.** Closes the hierarchy and previews the next top-level menu while focus stays on its trigger. `ArrowDown` then enters it.
* **ArrowLeft or Escape in a submenu.** Closes only that submenu and restores focus to its trigger. The parent menu stays open.
* **Enter or Space on a command.** Activates it and closes all open menus.
* **Tab.** Leaves the menu system. Do not trap focus or step through every command. Closing must not leave focus inside hidden content.

The `command` event fires before `toggle-popover` opens the menu, so focus cannot move into the menu there. Move focus in the `toggle` event instead. HTML restores focus only for the first `popover="auto"` in a stack, so nested levels must restore focus to their trigger explicitly.

```js
const rootTriggers = [...document.querySelectorAll('[role="menubar"] > [commandfor]')];
const triggers = [...document.querySelectorAll('[commandfor]')];
const menus = [...document.querySelectorAll('[popover]')];
const status = document.querySelector('#status');

const menuFor = trigger => document.getElementById(trigger.getAttribute('commandfor'));
const triggerFor = menu => triggers.find(trigger => menuFor(trigger) === menu);
const isOpen = menu => menu.matches(':popover-open');
// Previewed: shown by focus while focus stays on the trigger. No item inside it has focus.
const isPreviewed = menu => menu.matches(':popover-open:not(:focus-within)');
const rootMenuOf = menu => {
  const parent = menu.parentElement.closest('[popover]');
  return parent ? rootMenuOf(parent) : menu;
};
const menuItems = menu => [...menu.querySelector(':scope > [focusgroup~="menu"]')
  .querySelectorAll(':scope > button')]
  .filter(item => !item.disabled && item.getAttribute('aria-disabled') !== 'true');

// Menus that should focus their first item once the native toggle opens them.
const enterOnOpen = new WeakSet();
// The trigger a pointer pressed, so a pointer click on a preview can enter its menu.
let pointerTrigger = null;

function focusFirst(menu) {
  const first = menuItems(menu)[0];
  if (first && isOpen(menu)) first.focus({ preventScroll: true });
}

// Focus the trigger before hiding the menu, so focus never stays inside hidden content.
function closeAndRestore(menu) {
  triggerFor(menu)?.focus({ preventScroll: true });
  menu.hidePopover();
}

function closeAllMenus() {
  rootTriggers.map(menuFor).filter(isOpen).forEach(menu => menu.hidePopover());
}

function moveToRootTrigger(from, direction, enterMenu = false) {
  const index = rootTriggers.indexOf(from);
  const next = rootTriggers[(index + direction + rootTriggers.length) % rootTriggers.length];
  rootTriggers.forEach(trigger => { trigger.tabIndex = trigger === next ? 0 : -1; });
  closeAllMenus();
  // Focusing the trigger previews its menu; entering it then focuses the first item.
  next.focus({ preventScroll: true });
  if (enterMenu) focusFirst(menuFor(next));
}

// One tab stop for the menubar.
rootTriggers.forEach((trigger, index) => { trigger.tabIndex = index === 0 ? 0 : -1; });

triggers.forEach(trigger => {
  const menu = menuFor(trigger);

  trigger.addEventListener('focus', event => {
    // Focus returning from inside its own menu is not a new intent, so it does not preview.
    if (menu.contains(event.relatedTarget)) return;
    // Pass source so the preview anchors to this trigger. Only open here; an open menu is left alone.
    if (!isOpen(menu)) menu.showPopover({ source: trigger });
  });

  trigger.addEventListener('blur', event => {
    if (isPreviewed(menu) && !menu.contains(event.relatedTarget)) menu.hidePopover();
  });

  // Stop mousedown from moving focus, so a click cannot start a preview mid-click.
  trigger.addEventListener('pointerdown', event => {
    event.preventDefault();
    pointerTrigger = trigger;
  });

  // Tab leaves the menu system rather than moving into the previewed menu that follows the trigger.
  trigger.addEventListener('keydown', event => {
    if (event.key === 'Tab') closeAllMenus();
  });
});

rootTriggers.forEach(trigger => {
  const menu = menuFor(trigger);
  trigger.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      moveToRootTrigger(trigger, event.key === 'ArrowRight' ? 1 : -1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (isOpen(menu)) focusFirst(menu);
      else {
        enterOnOpen.add(menu);
        trigger.click(); // Keyboard opens route through click: one entry point for every open.
      }
    }
  });
});

menus.forEach(menu => {
  // The command event fires before toggle-popover runs. Intercept only a pointer click on a
  // preview, which enters the menu. Every other activation opens or closes natively.
  menu.addEventListener('command', event => {
    if (event.command !== 'toggle-popover') return;
    const fromPointer = pointerTrigger === event.source;
    pointerTrigger = null;
    if (isPreviewed(menu) && fromPointer) {
      event.preventDefault();
      focusFirst(menu);
    } else if (!isOpen(menu)) {
      enterOnOpen.add(menu);
    } else {
      event.source?.focus({ preventScroll: true });
    }
  });

  // Toggle runs after the menu is open, so focus can move into it here.
  menu.addEventListener('toggle', event => {
    triggerFor(menu)?.setAttribute('aria-expanded', String(event.newState === 'open'));
    if (event.newState === 'open' && enterOnOpen.delete(menu)) focusFirst(menu);
  });

  menu.addEventListener('keydown', event => {
    const active = document.activeElement;
    const parentMenu = menu.parentElement.closest('[popover]');
    const submenu = active.matches('[commandfor]') ? menuFor(active) : null;

    if (event.key === 'Tab') {
      // Leave the menu system: close everything and let Tab continue from the trigger.
      closeAllMenus();
    } else if ((event.key === 'Home' || event.key === 'End') && menuItems(menu).includes(active)) {
      event.preventDefault();
      const items = menuItems(menu);
      (event.key === 'Home' ? items[0] : items.at(-1)).focus({ preventScroll: true });
    } else if (event.key === 'ArrowRight' && submenu) {
      event.preventDefault();
      event.stopPropagation();
      if (isOpen(submenu)) focusFirst(submenu);
      else {
        enterOnOpen.add(submenu);
        active.click();
      }
    } else if (event.key === 'ArrowRight' && parentMenu) {
      // From a submenu item without a child submenu, preview the next top-level menu.
      event.preventDefault();
      event.stopPropagation();
      moveToRootTrigger(triggerFor(rootMenuOf(menu)), 1);
    } else if ((event.key === 'ArrowLeft' && parentMenu) || event.key === 'Escape') {
      // Close only this level. Stop propagation, or the parent level closes too.
      event.preventDefault();
      event.stopPropagation();
      closeAndRestore(menu);
    } else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !parentMenu) {
      event.preventDefault();
      event.stopPropagation();
      moveToRootTrigger(triggerFor(menu), event.key === 'ArrowRight' ? 1 : -1, true);
    }
  });

  // Activating a command announces it, then closes every open level.
  menu.addEventListener('click', event => {
    const item = event.target.closest('[focusgroup~="menu"] > button');
    if (!item || item.matches('[commandfor]')) return;
    event.stopPropagation();
    status.textContent = `${item.textContent.trim()} selected`;
    closeAndRestore(rootMenuOf(menu));
  });
});

// Once focus lands outside the menu system, close every open menu.
document.addEventListener('focusin', event => {
  if (!event.target.closest('[popover], [role="menubar"]')) closeAllMenus();
});
```

Set `aria-expanded` only in the `toggle` listener. It covers preview and open states, and the trigger's `aria-expanded` stays `"true"` while its menu is previewed or open.

### Submenus

Use `popover="auto"` for submenus, placed after the submenu trigger inside the parent's `focusgroup`. Nesting lets the browser keep the parent open, close sibling submenus, close child submenus when the root menu closes, and handle outside-click light dismiss. Do not use `popover="manual"` for submenus.

The submenu trigger keeps `aria-haspopup="menu"` and `aria-expanded`, and the `toggle` listener above keeps `aria-expanded` in sync. The keyboard script handles nested `Escape` and `ArrowLeft` as described above.

## Align menu item content

When a row has an icon, label, and shortcut or submenu indicator, define the columns on the focusgroup and use `subgrid` on each row. Hide shortcut text from assistive technology when it only repeats a key that already operates the item.

```css
[focusgroup~="menu"] {
  display: grid;
  grid-template-columns: auto 1fr auto;
  row-gap: .1rem;
}

/* Target buttons only. A closed submenu popover inside the focusgroup must keep display: none. */
[focusgroup~="menu"] > button {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
}
```

Each button spans all three columns and inherits the parent's grid via `subgrid`. To place a submenu indicator or shortcut in the third column, nest it in a `<span>` with `grid-column: 3`:

```html
<div focusgroup="menu no-memory">
  <button type="button">Save</button>
  <button type="button">
    Preferences
    <!-- Decorative: the submenu trigger already announces its popup -->
    <span aria-hidden="true" style="grid-column: 3;">›</span>
  </button>
</div>
```

## Progressive enhancement and fallbacks

{{ FEATURE_FALLBACKS("focusgroup") }}

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
      event.stopImmediatePropagation();
      items[next < 0 ? 0 : next].focus({ preventScroll: true });
    }, true);
  });
}
```

{{ FEATURE_FALLBACKS("popover") }}

{{ FEATURE_FALLBACKS("anchor-positioning") }}

In browsers without CSS Anchor Positioning, guard `inset: auto` (and any `margin: 0` reset on `[popover]`) inside `@supports (position-area: block-end)` so popovers fall back to centered viewport placement instead of stacking at the top-left corner, or position the menu from `getBoundingClientRect()`.

{{ BASELINE_STATUS("anchor-positioning", "api.HTMLElement.showPopover.options_source_parameter.implicit_anchor_reference") }}

If targeting earlier implementations where `showPopover({ source })` does not establish an implicit anchor, link each trigger and menu in JavaScript instead of writing per-menu CSS rules:

```js
if (!('ToggleEvent' in window && 'source' in ToggleEvent.prototype)) {
  triggers.forEach((trigger, index) => {
    const anchorName = `--menu-trigger-${index}`;
    trigger.style.anchorName = anchorName;
    menuFor(trigger).style.positionAnchor = anchorName;
  });
}
```

### Command invokers

Without invokers, `command="toggle-popover"` does nothing, so clicking a trigger will not open its menu. The fallback must perform the toggle in script. Feature-detect the interface rather than an instance: `commandForElement` lives on `HTMLButtonElement.prototype`.

The fallback reproduces the native behavior: a pointer click on a preview enters the menu, and every other click toggles the menu. Enter and Space still work because they generate a click on buttons.

```js
// Invokers are unsupported when the button interface has no commandForElement property.
if (!Object.hasOwn(HTMLButtonElement.prototype, 'commandForElement')) {
  triggers.forEach(trigger => {
    const menu = menuFor(trigger);
    trigger.addEventListener('click', event => {
      // Cancel the default action so a browser with invokers cannot toggle twice.
      event.preventDefault();
      const fromPointer = pointerTrigger === trigger;
      pointerTrigger = null;
      if (isPreviewed(menu) && fromPointer) focusFirst(menu);
      else if (isOpen(menu)) menu.hidePopover();
      else {
        enterOnOpen.add(menu);
        menu.showPopover({ source: trigger });
      }
    });
  });
}
```

{{ BASELINE_STATUS("invoker-commands") }}
