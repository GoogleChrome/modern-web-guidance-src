---
name: menu
description: Build a menu component that displays a list of options or actions, with support for nested submenus.
web-feature-ids:
  - popover
  - invoker-commands
  - anchor-positioning
  - focusgroup
guides:
  - viewport-aware-dropdowns
---

<!-- Baseline best practices to be referenced by any guide that involves a popup menu (dropdown menus, context menus, overflow menus, etc)

Include:
- fixed-size icon slot (no subgrid)
- proper keyboard nav
- safe triangles for submenus
- converting to drawer on small screens?
-->

# Build a dropdown menu

This guide covers any popup menu: dropdown, context, overflow, and the menu bars that open them. The worked example is an application command menu, where items change the interface (create, save, preferences).

### Commands, links, and what makes a menu

Two independent choices. Everything else here applies to both.

* **Element, per item.** A command is a `<button type="button">`; a destination is an `<a href>` that still opens in a new tab, copies as a URL, and works without script. A dropdown may mix them freely: two links and six commands, or one command and six links, changes nothing below.
* **Interaction model, per dropdown.** Arrow keys, `Home`/`End`, and `Esc` make it a menu: add the focusgroup, let it infer `menuitem` on every item whether button or link, and make it look like one (a continuous bar or a trigger with a dropdown indicator; see "Menubar or separate menu buttons" below). A short list of links users `Tab` through is navigation: no focusgroup, no `role="menu"`, `role="menuitem"`, or `aria-haspopup="menu"`; keep the popover, `Esc`, and focus restoration, and see the navbar guide.

Content never decides the roles. A "Products" dropdown of links can be a menu; an "Account" dropdown of commands cannot be navigation.

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

Name each menu with `aria-labelledby` pointing at its trigger. Keep decorative submenu indicators in CSS, or add `aria-hidden="true"`. Give triggers with `aria-expanded="true"` a visible active style so users can tell which menu is open or previewed.

### Menubar or separate menu buttons

Pick one form for the top-level triggers. Role, keyboard model, and styling must match: visually separate buttons signal one `Tab` stop each.

* **Menubar.** `role="menubar"` on the container (never on a popover), styled as one continuous bar with no gaps between triggers. One `Tab` stop; `ArrowLeft`/`ArrowRight` move between triggers; hover switches open menus. Use for an application command bar.
* **Separate menu buttons.** Each trigger is its own `Tab` stop and looks like a standalone button. No `role="menubar"`, no arrow keys between triggers, no preview on focus, no hover switching. Wrap in `<nav>` if they navigate, otherwise no role. Use for toolbars and page headers.

The rest of this guide describes the menubar form. For separate buttons, keep everything inside each menu and drop the menubar-level behavior.

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
  position-try-fallbacks: flip-inline, flip-block, --below;
}

/* Last resort for narrow viewports: directly below the trigger, indented, so the submenu never
   covers its trigger. */
@position-try --below {
  position-area: block-end span-inline-end;
  margin-inline-start: 1rem;
  /* Fit the area: the submenu's minimum width must not stop this fallback from fitting. */
  min-inline-size: 0;
  max-inline-size: calc(100% - 1rem);
}
```

Keep `--below` last so it applies only when neither side fits. It opens directly under the trigger, so on a narrow screen it covers the sibling items beneath the trigger; that is the accepted trade-off for staying next to the trigger. Also let the submenu shrink to the area (`min-inline-size: 0`, `max-inline-size` minus the indent). A fallback that does not fit is skipped, and if none fit the browser keeps the base placement, so a submenu that is a few pixels too wide silently covers its trigger.

For how the flip fallbacks work on a plain popover, see {{ GUIDE_REF("viewport-aware-dropdowns") }}. That guide positions a button group, not a menu; for menus, the submenu placement and `--below` fallback above take precedence.

### Animate open and close

Optional. Under 150 ms, `opacity` and a small `translate` only, same for submenus, inside `@media (prefers-reduced-motion: no-preference)`. Focus moves on `toggle`, so the transition never delays keyboard users.

```css
@media (prefers-reduced-motion: no-preference) {
  /* Closing: this rule is in effect once :popover-open is removed. */
  [popover] {
    opacity: 0;
    translate: 0 -.25rem;
    transition: opacity .15s, translate .15s, display .15s allow-discrete, overlay .15s allow-discrete;
  }
  /* Opening: faster. */
  [popover]:popover-open {
    opacity: 1;
    translate: 0 0;
    transition-duration: .1s;
    @starting-style { opacity: 0; translate: 0 -.25rem; }
  }
  /* Switching between open menubar menus is instant, as in native menubars. */
  [role="menubar"]:has(> [popover]:popover-open) > [popover] {
    transition: none;
  }
}
```

`@starting-style` is not a repeat of `[popover]`: a closed popover is `display: none`, and transitions do not run from an unrendered state, so it supplies the before-values for the open. Without it the open snaps and only the close animates. `display` and `overlay` with `allow-discrete` keep the popover rendered and in the top layer until the close transition ends.

## Keyboard and focus

Do not add a second roving-tabindex system inside a focusgroup. Script covers only what the invokers and focusgroup do not:

* **One tab stop for the menubar.** `Tab` enters at the first top-level trigger. `ArrowLeft` and `ArrowRight` move between top-level triggers and wrap at either end. `Home` and `End` on a trigger enter its menu at the first or last item.
  * **Note: which trigger `Tab` returns to.** The APG allows either the first trigger or the last one used. The guide specifies the first, but the demo moves the tab stop with `ArrowLeft` and `ArrowRight`, so after keyboard navigation `Shift`+`Tab` returns to the last trigger reached. Pointer use does not move it, so the same sequence can land on a different trigger. Either behavior is acceptable; pick one and keep it consistent.
* **Preview.** Focusing a top-level trigger shows its menu and sets `aria-expanded="true"`. Focus stays on the trigger, and no item is focused. Blurring the trigger closes a preview-only menu.
* **Enter and Space on a preview.** They close the preview and keep focus on the trigger. The native `toggle-popover` action handles this, so the script must not intercept these keys.
* **ArrowDown on a preview.** Converts it to an open menu and focuses the first item.
* **Pointer click on an open or previewed trigger.** Closes it natively; it does not enter the menu.
  * **Known difference on submenu triggers.** A pointer click on a submenu trigger also toggles natively, so it can close a submenu that hover already previewed, or open one that has not appeared yet. Native menus only open it and never close it. This is harmless, so the guide accepts it.
* **Pointer click on a closed trigger.** Opens it natively. Focus stays on the trigger; no item is focused. Only keyboard opens enter the menu.
* **Pointer over an item.** Focuses it without a ring, so hover and focus are one item.
* **Pointer over another top-level trigger while a menu is open.** Closes it and previews the hovered one, focusing its trigger without a ring. Nothing open: hover does nothing.
* **Pointer over a submenu trigger.** Previews its submenu after a short delay (pointer focus runs the same preview-on-focus). A sibling item closes it.
* **Within a menu.** `ArrowUp` and `ArrowDown` move between enabled items. `Home` and `End` move to the first and last enabled item, which the script handles.
* **ArrowLeft or ArrowRight in an open top-level menu.** Closes it and previews the adjacent menu with focus on its trigger, wrapping at either end. `ArrowDown` then enters it. Left and Right never land inside a menu.
* **ArrowRight on a submenu trigger.** Opens the submenu and focuses its first item.
* **ArrowRight on a submenu item without a child submenu.** Closes the hierarchy and previews the next top-level menu while focus stays on its trigger. `ArrowDown` then enters it.
* **ArrowLeft or Escape in a submenu.** Closes only that submenu and restores focus to its trigger. The parent menu stays open.
* **Enter or Space on a command.** Activates it and closes all open menus.
* **Tab.** Leaves the menu system. Do not trap focus or step through every command. Closing must not leave focus inside hidden content.

The `command` event fires before `toggle-popover` opens the menu, so focus cannot move into the menu there. Move focus in the `toggle` event instead. HTML restores focus only for the first `popover="auto"` in a stack, so nested levels must restore focus to their trigger explicitly.

## Implementing the interaction

Implement the behaviors above for your own markup. Arrow, `Home`/`End`, wrap-around and `Tab`-to-exit handling is ordinary `keydown` code. A few parts are easy to get wrong, grouped below by input type.

### Keyboard and focus handling

1. **One open path.** Opening by keyboard calls `trigger.click()`, so the invoker's `toggle-popover` is the only way a menu opens. Mark the menu so the `toggle` handler enters it, keyboard opens only. On a pointer open, `toggle` focuses the trigger without a ring instead, because `pointerdown` prevented focus and arrow keys must still work.
2. **Preview on focus.** Focusing a trigger calls `showPopover({ source: trigger })` so the menu anchors to it. Ignore focus returning from inside the trigger's own menu, or from another window (flag on window `blur`, cleared a tick after window `focus`, or app-switching reopens the last menu). Hide a previewed menu on `blur` unless focus moved into it.
3. **Move focus in `toggle`, not `command`.** `command` fires before the menu opens.
4. **Restore focus to the trigger yourself.** Focus the trigger before `hidePopover()`. After a pointer activation, restore focus without a ring (`focus({ focusVisible: false })`), or the trigger shows the keyboard focus outline after a mouse click; keyboard activations keep the ring. A click with `event.detail === 0` came from the keyboard.
5. **Close one level at a time.** Call `stopPropagation()` on `Escape` and `ArrowLeft` in a submenu, or the parent's listener closes it too.

### Pointer handling

1. **Pointer click toggles.** Call `preventDefault()` on `pointerdown` so the click doesn't move focus and start a preview mid-click. Remember which trigger was pressed. Clicking a closed or previewed trigger opens or closes it natively and never enters the menu; only keyboard opens enter it. Do not intercept the click.
2. **Hover follows focus.** Style `:hover` and `:focus-visible` separately. On `pointermove` over an item, call `focus({ focusVisible: false })`; browsers that ignore the option paint no ring for pointer focus anyway.
3. **Hover switches open menus.** On `pointerenter` of a top-level trigger while another top-level menu is open: hide it, focus the hovered trigger without a ring, and preview on focus (see above) previews it. Nothing open: do nothing.
4. **Safe triangle.** A fixed CSS bridge is too narrow: it only works when the pointer starts near the parent's edge. Track the pointer instead:
   * On every `pointermove` while a submenu is open, test whether the pointer is inside the triangle of its previous position and the submenu's two near-edge corners.
   * If it is, the pointer is heading to the submenu: do not focus the sibling item underneath, because that closes the submenu.
   * Start a timer (about 300 ms) that focuses the item if no further move arrives, so a stalled pointer does not leave the wrong item active. Clear it on every move.
   * Record the previous position in a `document` listener, so it still holds the old value when the menu handlers run.
   * Use the submenu's left edge when the pointer is left of it and the right edge when it flipped. A `--below` submenu has no side edge, so skip the triangle.

```js
// Pointer over an item moves focus to it, unless the pointer is heading to an open submenu.
let lastPointer = null;
document.addEventListener('pointermove', event => {
  lastPointer = { x: event.clientX, y: event.clientY }; // Runs after the menu handlers.
});

function headingToward(submenu, event) {
  if (!lastPointer) return false;
  const rect = submenu.getBoundingClientRect();
  const x = event.clientX < rect.left ? rect.left : event.clientX > rect.right ? rect.right : null;
  if (x === null) return false; // Below the parent: no side edge.
  const sign = (a, b, c) => (a.x - c.x) * (b.y - c.y) - (b.x - c.x) * (a.y - c.y);
  const point = { x: event.clientX, y: event.clientY };
  const [a, b, c] = [lastPointer, { x, y: rect.top }, { x, y: rect.bottom }];
  const signs = [sign(point, a, b), sign(point, b, c), sign(point, c, a)];
  return !(signs.some(s => s < 0) && signs.some(s => s > 0));
}

let triangleTimer;
menu.addEventListener('pointermove', event => {
  clearTimeout(triangleTimer);
  const item = event.target.closest('button');
  if (!item || item === document.activeElement) return;
  const focusItem = () => item.focus({ focusVisible: false });
  // The open submenu whose parent is this menu, if the pointer is not on its own trigger.
  const submenu = openChildSubmenu(menu);
  if (submenu && triggerFor.get(submenu) !== item && headingToward(submenu, event)) {
    triangleTimer = setTimeout(focusItem, 300);
  } else {
    focusItem();
  }
});
```

Also:

* **Outside focus.** Close every open menu when focus lands outside the menu system (a `document` `focusin` listener).
* **Command activation.** Announce it, then hide the root menu and restore focus to its trigger, without a ring if the activation came from a pointer.
* **`aria-expanded`.** Set it only in the `toggle` listener. It covers preview and open states, and the trigger's `aria-expanded` stays `"true"` while its menu is previewed or open.
* **Helpers.** The snippet assumes `triggerFor` (a `Map` from menu to trigger) and `openChildSubmenu(menu)` (the open submenu whose parent menu is `menu`, if any); define them for your markup. The fallbacks below also use `triggers` (all `[commandfor]` buttons), `menuFor(trigger)`, `isOpen(menu)`, `closeAndRestore(menu, { fromPointer })` (focus the trigger, without a ring when `fromPointer`, then `menu.hidePopover()`), `enterOnOpen` (a `WeakSet` of menus to enter once open) and `pointerTrigger` (the trigger last pressed by a pointer).

### Submenus

* Use `popover="auto"` for submenus, placed after the submenu trigger inside the parent's `focusgroup`. Never `popover="manual"`.
* Nesting lets the browser keep the parent open, close sibling submenus, close child submenus when the root menu closes, and handle outside-click light dismiss.
* The submenu trigger keeps `aria-haspopup="menu"` and `aria-expanded`; the `toggle` listener keeps `aria-expanded` in sync.
* The keyboard script handles nested `Escape` and `ArrowLeft` as described above.
* A submenu trigger never also runs a command: one control cannot both activate and open, and `Enter` cannot mean both. Put the default action as the first submenu item, or add a separate command item beside the trigger. If a combined control is forced, document it as an accessibility tradeoff.

### Separators and checkable items

* Separate item groups with `<hr>` inside the focusgroup: a native `separator`, not focusable, skipped by focusgroup and the fallback. Never a styled `<div>`.
* A boolean option is a `<button type="button">` with `aria-checked` and an explicit `role="menuitemcheckbox"`. Focusgroup does not infer these roles, so this is the one place shared markup sets an item role.
* One of a set is a `<button type="button">` with `role="menuitemradio"` and `aria-checked`, inside a `role="group"` with an `aria-label`, in the same focusgroup.
* Script toggles `aria-checked`.
* `Enter` on a checkbox toggles and closes the menu; `Space` toggles and stays open (APG). Radios close on either key.
* Render the check mark from `[aria-checked="true"]::before`, not a separate icon element (see the CSS below).

### Not covered here

* **Activation feedback.** Native menus flash the chosen item before closing. If wanted, show a ~100 ms visual confirm before `hidePopover()`; do not delay focus restoration or the announcement.
* **Typeahead.** Focusgroup has none. If needed, on printable `keydown` match the current level's enabled item labels and focus the next match after the current item, wrapping. Do not intercept `Space`.

## Verify before finishing

An instruction cannot guarantee behavior, so test the result. Open the page and check each of these with the real keyboard and mouse; fix and re-test any that fail:

* **Keyboard.** `Tab` lands on the first trigger once; `ArrowDown` enters; `Escape` closes one level and returns focus to its trigger; `Tab` closes every menu.
* **Pointer open.** Clicking a trigger opens its menu with focus on the trigger and no ring; clicking again closes it.
* **Pointer command.** Clicking a command closes every menu and shows no focus ring on the trigger.
* **Submenu.** Moving diagonally from the middle of a submenu trigger to a submenu item keeps it open; moving to an unrelated sibling closes it.
* **Narrow screen.** At 375 px no submenu covers its own trigger.
* **Check marks.** Checked items show a check mark.
* **No leftovers.** No console errors, and no `popovertarget`, `popovertargetaction` or `aria-details` on triggers.

## Align menu item content

When a row has an icon, label, and shortcut or submenu indicator, reserve a fixed-size leading slot for the icon or check mark and push the trailing content to the inline end. Icons are a known size, so a fixed slot keeps labels aligned whether or not an item has an icon. Do not use `subgrid` for rows: any extra inline child (a badge, for example) becomes its own grid item and breaks the layout. Hide shortcut text from assistive technology when it only repeats a key that already operates the item.

```css
[focusgroup~="menu"] {
  --menu-icon-size: 1.25rem;
}

/* Target items only. A closed submenu popover inside the focusgroup must keep display: none. */
[focusgroup~="menu"] > button,
[focusgroup~="menu"] > [role="group"] > button {
  display: flex;
  align-items: center;
  gap: .5rem;
}

/* The leading slot holds the icon or check mark. */
[focusgroup~="menu"] button::before {
  content: "";
  flex: none;
  inline-size: var(--menu-icon-size);
}

/* Check mark for checked items. This selector must be at least as specific as the base
   ::before rule above, or the empty content wins and the check mark never shows. */
[focusgroup~="menu"] button[aria-checked="true"]::before {
  content: "✓";
}

/* Shortcut or submenu indicator at the inline end. */
[focusgroup~="menu"] .hint {
  margin-inline-start: auto;
}
```

Put a trailing indicator or shortcut in a `<span class="hint" aria-hidden="true">` inside the button; the submenu trigger already announces its popup.

## Progressive enhancement and fallbacks

### Fallbacks & browser support for focusgroup

{{ BASELINE_STATUS("focusgroup") }}

{# Maintainer note: Use a small capture-phase fallback instead of @microsoft/focusgroup-polyfill, which skips elements inside closed [popover] ancestors, retains references to detached DOM nodes, and misses preventDefault() on arrow keys in older Safari viewports. #}

Keep `focusgroup="menu nomemory"` in the markup. If `'focusGroup' in HTMLElement.prototype` is false, install Up, Down, Home, and End, set `role="menu"` on each menu container, and `role="menuitem"` on buttons with no role; leave checkable items, `<hr>`, and `role="group"` alone. Never install it when native focusgroup is present. Left, Right, preview, open, and close are author script either way.

```js
if (!('focusGroup' in HTMLElement.prototype)) {
  document.querySelectorAll('[focusgroup~="menu"]').forEach(group => {
    group.setAttribute('role', 'menu');
    group.querySelectorAll('button:not([role])').forEach(item => {
      item.setAttribute('role', 'menuitem');
    });
    group.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      // Own items only: a nested submenu has its own focusgroup, a role="group" wrapper does not.
      const items = [...group.querySelectorAll('button')]
        .filter(item => item.closest('[focusgroup]') === group)
        .filter(item => !item.disabled && item.getAttribute('aria-disabled') !== 'true');
      const current = items.indexOf(document.activeElement);
      if (current < 0) return;
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 :
        (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
      event.preventDefault();
      event.stopImmediatePropagation();
      items[next].focus({ preventScroll: true });
    }, true);
  });
}
```

{{ FEATURE_FALLBACKS("popover") }}

### Fallbacks & browser support for Anchor positioning

{{ BASELINE_STATUS("anchor-positioning") }}

Without CSS Anchor Positioning, a popover falls back to the UA's centered viewport placement. Never ship that for a menu: it detaches the menu from its trigger, and a centered submenu covers its parent. Gate the anchored rules behind `@supports (position-area: block-end)` and position the menu from script when it fails:

* Use a positioning library such as `@floating-ui/dom` (`computePosition` with `offset`, `flip`, and `shift` middleware; `placement: 'bottom-start'` for top-level menus, `'right-start'` for submenus). Hand-rolled placement that handles flipping and viewport edges correctly is hard.
* Run it in the `toggle` handler when the menu opens, and apply the result as `left` and `top` on the menu. Use `position: fixed` with `inset: auto` and `margin: 0` so the coordinates are viewport-relative.
* Keep these overrides inside `@supports not (position-area: block-end)`, so browsers with anchor positioning are unaffected.

{{ BASELINE_STATUS("anchor-positioning", "api.HTMLElement.showPopover.options_source_parameter.implicit_anchor_reference") }}

If targeting earlier implementations where `showPopover({ source })` does not establish an implicit anchor (no `source` on `ToggleEvent.prototype`), give each trigger a unique `anchor-name` and each menu a matching `position-anchor` from script, instead of writing per-menu CSS rules.

For browsers without anchor positioning at all, see {{ GUIDE_REF("viewport-aware-dropdowns") }} for the polyfill route.

### Fallbacks & browser support for Invoker commands

{{ BASELINE_STATUS("invoker-commands") }}

Without invokers, `command="toggle-popover"` does nothing, so script must toggle the menu.

* Feature-detect the interface, not an instance: `'commandForElement' in HTMLButtonElement.prototype`.
* On each trigger `click`, call `preventDefault()` so a browser with invokers cannot toggle twice.
* If the menu is open, close it with `closeAndRestore(menu)`. Otherwise call `menu.showPopover({ source: trigger })`.
* Mark the menu in `enterOnOpen` unless the click came from the pressed trigger (`pointerTrigger`), so only keyboard opens enter the menu.
* `Enter` and `Space` still work because they generate a click on buttons.
