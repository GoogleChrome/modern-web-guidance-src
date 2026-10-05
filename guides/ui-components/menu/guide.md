---
name: menu
description: Build an accessible application command menu with nested submenus.
web-feature-ids:
  - container-scroll-state-queries
  - popover
  - subgrid
  - menu
  - sticky-positioning
  - anchor-positioning
  - focusgroup
guides:
  - resilient-context-menus-and-nested-dropdowns
---

# Build an application command menu

Use a command menu for actions that change the current interface, such as creating, saving, or changing preferences. Use ordinary links inside a `<nav>` landmark when items primarily take users to destinations. That navigation pattern normally uses `Tab` and `Shift` + `Tab`; it is not automatically an ARIA menu.

**IMPORTANT: Choose the pattern deliberately.** `role="menu"` and `role="menubar"` describe composite application widgets with managed focus and arrow-key navigation. They are not required for every navigation bar. Use the menu pattern only when that interaction model is appropriate for the component, including application navigation that intentionally behaves like a desktop menubar.

Use the `focusgroup="menu nomemory"` attribute on the menu container. A menu focusgroup supplies the `menu` and `menuitem` roles to its container and managed items, together with directional and boundary arrow-key navigation. Selection and activation remain the author's responsibility, and the `nomemory` token ensures reopening a menu always starts at its first item.

## Setup a sticky menu bar with scroll-state queries

When nesting a menu trigger or bar within a header, you often want the header to stick to the top of the viewport and adapt its styling when stuck. Combining `position: sticky` with **Container Scroll-State Queries** lets you apply dynamic visual treatment (like a box-shadow or background color change) seamlessly without using a scroll event listener in JavaScript.

```css
/* Configure the header container to track its scroll/stuck state */
.bar-wrap {
  position: sticky;
  inset-block-start: 0;
  z-index: 1;
  container-type: scroll-state;
  container-name: bar;
}

/* Default styling for the menu bar */
.bar {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--surface);
  border-block-end: 1px solid var(--line);
  transition: box-shadow 0.2s ease;
}

/* Apply a shadow only when the container is stuck at the top */
@container bar scroll-state(stuck: top) {
  .bar {
    box-shadow: 0 0.2rem 0.8rem rgba(0, 0, 0, 0.15);
  }
}
```

## Open and position the menu

Use a button as the menu trigger. The Popover API places the menu in the top layer and supplies light-dismiss behavior. Trigger the popover imperatively with `showPopover()` and `hidePopover()` rather than using `popovertarget` or `popovertargetaction`. Declarative popover targeting makes the browser treat the control as the popover source and adds implicit accessibility relationships, including `aria-expanded` and `aria-details`, that are not required for this menu pattern. This guide also moves focus into the menu when it opens, so imperative control lets the implementation coordinate the expanded-state update and focus transition without the announcement race that can occur when declarative targeting and immediate focus movement are combined.

{# Maintainer note: Nesting the focusgroup container inside the popover div works around Chromium Bug #564673920, where declaring focusgroup directly on a [popover] element clobbers focusgroup keyboard semantics. #}
Always nest the `focusgroup` container inside the `[popover]` element instead of declaring `focusgroup` directly on the popover container.

```html
<!-- Trigger button -->
<button id="file-trigger" type="button" aria-haspopup="menu" aria-expanded="false">
  File
</button>

<!-- Popover container -->
<div id="file-menu" popover="auto">
  <!-- WORKAROUND: Nest focusgroup inside popover to preserve semantics -->
  <div focusgroup="menu nomemory" aria-labelledby="file-trigger">
    <button type="button">New file</button>
    <button type="button">Save</button>
    <button id="preferences-trigger" type="button" aria-haspopup="menu" aria-expanded="false">
      Preferences <span aria-hidden="true">›</span>
    </button>
  </div>
</div>
```

A `focusgroup="menu nomemory"` supplies the `menu` and `menuitem` roles, together with the menu pattern's focus keyboard behavior:

- **Roles & semantics**: Do not add an explicit `role="menu"` on the container in HTML without `role="menuitem"` on the children, as an explicit container role skips `focusgroup`'s automatic child role inference. A `role="menubar"` (or `focusgroup="menubar"`) identifies the persistent command bar that owns the triggers.
- **Accessible naming**: Name the menu from its trigger with `aria-labelledby`; assistive technologies can then announce it as the "File" menu when focus enters its first item. Do not add a separate contextual name such as "File commands" when the trigger already provides the appropriate context.
- **Labels & indicators**: A native button's visible text supplies its accessible name, so do not add a redundant `aria-label` to a button that already has a visible label. Keep decorative submenu indicators `aria-hidden="true"`. Use `aria-label` only for genuinely icon-only controls.
- **Author responsibilities**: The `nomemory` token disables focusgroup's last-focused-item memory so opening starts at the first item. Focusgroup manages focus, not command activation or selection; JavaScript must handle activation, synchronize `aria-expanded` with each popover's open state, and restore focus when closing.

### Position the menu with CSS Anchor Positioning

Use CSS anchor positioning to tether the popover menu to its trigger button automatically. This avoids complex absolute coordinate calculation in JavaScript.

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

Keep the opening, closing, and keyboard traversal independent of CSS anchor positioning, ensuring the interaction contract functions robustly even in unsupported browsers.

## Implement menu keyboard interaction

Do not implement a second roving-tabindex system when using `focusgroup="menu nomemory"`. Native focusgroup supplies the menu roles and the menu pattern's focus behavior, including its directional and boundary keys, unless another attribute or element such as `popover` clobbers those semantics. JavaScript remains responsible for the parts focusgroup does not cover:

- Treating the menubar and its invoked menus as a composite widget with a single sequential-tab stop. `Tab` enters the menubar at its first top-level trigger; `ArrowLeft` and `ArrowRight` then move between top-level triggers without tabbing through each one. Ordinary links outside the application menu continue to use normal `Tab` navigation.
- Opening the menu with pointer activation, `Enter`, `Space`, or `ArrowDown`, setting `aria-expanded="true"`, and moving focus immediately to the first enabled item. Activating an already open top-level menu trigger closes that menu and restores focus to the trigger. `nomemory` ensures the focusgroup does not restore the previously focused item.
- Using `ArrowUp` and `ArrowDown` to move between commands, with `Home` and `End` moving to the first and last enabled command.
- Setting `aria-expanded="false"` when closing each popover and restoring focus to its invoking trigger.
- Activating or selecting a command with `Enter` or `Space`.
- Closing with `Escape`, or with `Tab` when leaving the menu system, and restoring focus where appropriate. `Tab` must not be trapped inside the menu or used to visit every command.

Prevent the trigger's `click` handler from immediately re-opening a menu that light-dismiss closed on `pointerdown`:

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

A submenu trigger is a focusgroup-managed menu item with `aria-haspopup="menu"` and an author-managed `aria-expanded` state. Its `popover="manual"` is opened and closed imperatively so the trigger is not treated as a declarative popover source. Its submenu is another `popover="manual"` containing its own nested `focusgroup="menu nomemory"`. Manual popovers prevent light-dismiss from closing the parent menu when focus moves into the submenu. `ArrowRight` opens the submenu and moves focus to its first item. `ArrowLeft` closes it and returns focus to the parent trigger. `Escape` closes the current level and restores focus.

Pointer activation must provide the same result as keyboard activation. Activating an already open submenu trigger closes that submenu and restores focus to its trigger. Keep the submenu open while focus moves into it, and ensure that clicking outside closes all open levels without leaving focus in hidden content.

### Position the submenu with CSS Anchor Positioning

Use CSS anchor positioning to lay out the nested submenu beside its trigger automatically. This eliminates the need for absolute coordinate math in JavaScript.

```css
/* Define anchor name on the submenu trigger */
#preferences-trigger {
  anchor-name: --preferences-trigger;
}

/* Position the submenu popover relative to its trigger button */
#preferences-menu {
  position-anchor: --preferences-trigger;
  position-area: inline-end span-block-end; /* Aligns to the side of the parent menu item */
  position-try-fallbacks: flip-inline, flip-block;
  inset: auto;
}

/* On narrow viewports, position the submenu underneath its parent item to prevent clipping/overlapping */
@media (max-width: 40rem) {
  #preferences-menu {
    position-area: block-end span-inline-end;
  }
}
```

## Align menu item content

When rows include icons, labels, shortcuts, or submenu indicators, define the columns once on the focusgroup and use `subgrid` for each row. Keep shortcut text supplementary: it must not be the only way to understand or operate an item, and it should be hidden from assistive technology when it duplicates the interaction instructions.

```css
[focusgroup~="menu"] {
  display: grid;
  grid-template-columns: auto 1fr auto;
}

[focusgroup~="menu"] > * {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
}
```

## Test with VoiceOver and NVDA

Automated checks cannot verify the whole interaction contract. Test each demo with a keyboard and at least one screen reader:

1. Tab to the trigger and confirm its name, button role, and synchronised `aria-expanded` state.
2. Open the menu with the mouse, Enter, Space, and ArrowDown; confirm focus moves to the first item.
3. Use Up, Down, Home, and End and confirm the focusgroup/polyfill moves focus and the focused item is announced once.
4. Open the submenu with Right Arrow or its button; return with Left Arrow and Escape.
5. Confirm Tab leaves the menu, and closing never leaves focus on hidden content.
6. In VoiceOver, test both Control + Option navigation and keyboard interaction. In NVDA, test browse mode and focus mode; pressing Enter on the menu trigger should enter the interactive menu. Each item should be announced once with its name and menu-item role, not once as a button and again as a separate text node.

These checks complement WCAG 2.2 criteria for keyboard operability, focus order, focus visibility, and accessible names. WCAG requires keyboard operability and understandable focus management; it does not require arrow keys for every navigation component.

## Progressive enhancement and fallbacks

The demos retain `focusgroup="menu nomemory"` in the markup and use a small local fallback for browsers without native support. They open and close popovers imperatively, synchronise `aria-expanded` themselves, and move DOM focus immediately to the first enabled item. Moving focus into the first item is an intentional choice for this command-menu pattern, not a universal requirement for menus whose popover is adjacent to the trigger. Imperative control avoids the declarative popover source relationship and the associated trigger-announcement race; test the result with VoiceOver and NVDA.

```js
document.querySelectorAll('[focusgroup~="menu"]').forEach(group => {
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
```

This custom fallback is deliberately scoped to this menu pattern. It avoids the Microsoft polyfill's detached-ancestor lifecycle leak while native `focusgroup` support is emerging. If native support is available, it remains the preferred implementation; otherwise the fallback provides the tested menu navigation contract.

{{ FEATURE_FALLBACKS("popover") }}

{{ FEATURE_FALLBACKS("anchor-positioning") }}

{{ FEATURE_FALLBACKS("subgrid") }}

{{ FEATURE_FALLBACKS("container-scroll-state-queries") }}
