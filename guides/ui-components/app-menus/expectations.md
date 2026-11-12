# Application menu bar expectations

- The top-level triggers are direct children of a container with `role="menubar"` and an accessible name, and no `[popover]` element has `role="menubar"`.
- Exactly one top-level trigger in the menubar is in the `Tab` order (`tabindex="0"`) and every other top-level trigger has `tabindex="-1"`.
- Each top-level trigger is a `<button type="button">` with `aria-haspopup="menu"`, `commandfor`, and `command="toggle-popover"`, immediately followed by its `popover="auto"` menu, which contains an element with `focusgroup="menu nomemory"` labeled by the trigger via `aria-labelledby`.
- Focusing a top-level trigger previews its menu and sets `aria-expanded="true"` without moving focus into the menu, and blurring a trigger that is only previewing closes that menu and sets `aria-expanded="false"`.
- Focus returning to a trigger because the window regained focus does not preview or reopen its menu.
- Pressing `Enter` or `Space` on a previewed top-level trigger closes that preview and sets `aria-expanded="false"` without moving focus from the trigger.
- Pressing `ArrowDown` on a previewed top-level trigger converts it to open and moves focus to the first enabled item in the same turn.
- On a top-level trigger, `Home` and `End` open its menu if needed and move focus to the first or last enabled item.
- From a focused top-level trigger, `ArrowRight` and `ArrowLeft` move focus to the next and previous top-level trigger (wrapping at either end), move `tabindex="0"` to it, and preview its menu with focus staying on the trigger.
- From inside an open top-level menu, `ArrowRight` and `ArrowLeft` close the current menu and preview the next or previous top-level menu (wrapping at either end) with focus on its trigger and no item focused.
- Pressing `ArrowRight` on a submenu item without a child submenu closes the open hierarchy and previews the next top-level menu with focus on its trigger.
- While a top-level menu is open, moving the pointer over a different top-level trigger closes the open menu and previews the hovered one with focus on that trigger and no `:focus-visible` match; with no menu open, hovering a trigger does nothing.
- Pressing `Tab` from a top-level trigger or from inside an open menu closes all open menus and leaves the menubar instead of stepping through every trigger or command.
