---
name: dialog
description: Build a modal or non-modal dialog component that is accessible, manages focus appropriately, and can be dismissed the way users expect on each platform.
web-feature-ids:
  - dialog
  - dialog-closedby
  - invoker-commands
  - popover
guides:
  - declarative-dialog-popover-control
  - prevent-page-scroll-under-modal-dialog
  - animate-to-from-top-layer
  - drag
  - persistent-top-layer-ui
---

# Dialog

## Overview

Use the native `<dialog>` element for modal and non-modal dialogs. It provides the accessibility semantics, focus handling, top-layer rendering and `Esc` handling that custom overlays have to rebuild by hand.

## Choose the overlay type

Pick the first rule that matches. If unsure, use Rule 1.

### Rule 1: The overlay interrupts the user and blocks the page (default)

Use for confirmations, forms, sign-in, destructive actions, and any "modal", "dialog", "lightbox" or "popup" request that does not say otherwise.

Use `<dialog>` opened as a modal, declaratively with `command="show-modal"` (see {{ GUIDE_REF("declarative-dialog-popover-control") }}) or from script with `showModal()`.

```html
<button type="button" command="show-modal" commandfor="confirm">Delete</button>

<!-- MANDATORY: no role="dialog" or aria-modal; the native modal already provides them -->
<dialog id="confirm" aria-labelledby="confirm-title">
  <h2 id="confirm-title">Delete this item?</h2>
  <form method="dialog">
    <button value="cancel" autofocus>Cancel</button>
    <button value="delete">Delete</button>
  </form>
</dialog>
```

The browser provides: inert page, focus containment, top layer, `::backdrop`, `Esc` and back-gesture dismissal, and focus return to the invoker.

- **DON'T** add `role="dialog"`, `aria-modal`, a focus trap, `inert` toggling or an `Esc` handler.
- **DON'T** open it with `show()` or the `open` attribute.
- **DO** stop the page scrolling behind it as described in {{ GUIDE_REF("prevent-page-scroll-under-modal-dialog") }}.

Not for menus or tooltips: see Rule 3.

### Rule 2: The user keeps working in the page while the panel is open

Use for find bars, inspectors, palettes and compose panes that are still dialogs semantically.

Use `<dialog popover>` for a top-layer panel with popover dismissal (`auto` light-dismisses, `manual` does not). Use `dialog.show()` only when the panel must not be in the top layer.

```html
<button type="button" popovertarget="find">Find</button>
<dialog id="find" popover="manual" aria-labelledby="find-title">
  <h2 id="find-title">Find</h2>
  <input type="search" aria-label="Search">
  <button type="button" popovertarget="find" popovertargetaction="hide">Close</button>
</dialog>
```

The page stays interactive and is not made inert.

- **DO** include a visible close button.
- **DON'T** use `showModal()`, which blocks the page.

Not for blocking confirmations: see Rule 1.

### Rule 3: The overlay is not a dialog

Use for menus, dropdowns, tooltips, hovercards and toasts.

Use a semantic element with the `popover` attribute, not `<dialog>`.

```html
<button type="button" popovertarget="menu">Actions</button>
<ul id="menu" popover>
  <li><a href="/rename">Rename</a></li>
</ul>
```

## Choose how it can be dismissed

The default depends on how the dialog is opened. If `closedby` is absent or invalid, `showModal()` behaves as `closerequest` and any other way of opening behaves as `none`.

- **Esc and back gesture only (modal default):** set nothing, or `closedby="closerequest"`.
- **Also click outside to close:** use `closedby="any"`.
- **Only the developer closes it (for example a form with unsaved changes):** use `closedby="none"` and add a confirmation path. See Closing below.

## Guidelines

### Accessible name and initial focus

- **DO** name every dialog with `aria-labelledby` pointing at its heading, or `aria-label` when there is no visible title.
- **DO** put `autofocus` on the primary control or first field.
- **DO** put `autofocus` on the safe action (such as Cancel or Keep) in a destructive confirmation.
- **DON'T** write code to return focus on close. The browser returns it to the invoker.

### Opening

- **DO** open declaratively with `command="show-modal"` and `commandfor` on a `<button>`. See {{ GUIDE_REF("declarative-dialog-popover-control") }}.
- **DO** use `dialog.showModal()` when opening from script.

### Closing

- **DO** close with `<form method="dialog">` buttons or `command="close"`.
- **DO** choose `closedby` deliberately: `any` (light dismiss and `Esc`), `closerequest` (`Esc` only, the modal default) or `none` (developer-controlled close only).
- **DO** use `command="request-close"` or `requestClose()` for Cancel buttons that must honor unsaved-changes logic. They fire `cancel` first and ignore `closedby`.
- **DO** treat `closedby` as progressive enhancement. `Esc` and the mobile back gesture already close modals without it.

### Hooking into close

- **DO** read `dialog.returnValue` in a `close` listener to learn which button was used, then reset it with `dialog.returnValue = ''`. `Esc` and other close requests set no value, and browsers differ on whether they clear the previous one, so without the reset a stale value can leak. Treat `''` as "dismissed without choosing".
- **DO** use `cancel` to intercept `Esc` and `request-close`, but do not rely on `preventDefault()` for repeated `Esc` presses without user activation.
- **DO** use `closedby="none"` with an explicit confirmation step for dirty forms.
- **DO** tell the user why the dialog stayed open when `cancel` is prevented: show a visible message and reference it with `aria-describedby` from the control that receives focus (such as Discard), so a screen reader reads it when focus moves. Without it, focus moving to a new button announces only that button's name.

### Non-modal dialogs

- **DO** use `<dialog popover>` (`auto` or `manual`) for a top-layer panel, and `dialog.show()` when you do not want the top layer.
- **DO** include a visible close button in every non-modal dialog.

### Backdrop and styling

- **DO** style `::backdrop` and use `dialog:modal` to target modal-only styles.
- **DO** leave animation to {{ GUIDE_REF("animate-to-from-top-layer") }}, dragging to {{ GUIDE_REF("drag") }}, and reparenting to {{ GUIDE_REF("persistent-top-layer-ui") }}.
- **DON'T** set `display` on `dialog` unconditionally. It overrides the closed state. Scope it with `dialog[open]`.

### Accessibility

- **DON'T** add `role="dialog"`, `aria-modal`, a manual focus trap or `inert` toggling to a native modal.
- **DO** use a native `<button>` with an accessible name for close controls.
- **DO** use one consistent heading level for dialog titles.

## Fallback strategies

### `closedby` (`dialog-closedby`)

{{ BASELINE_STATUS("dialog-closedby") }}

Without `closedby`, a modal still closes with `Esc` and the back gesture; only click-outside is lost, so this is graceful degradation. If your Baseline target requires light dismiss, add this where `closedby` is missing:

```js
if (!('closedBy' in HTMLDialogElement.prototype)) {
  // Test the pointer position, not event.target: the <dialog> is also the target for its own
  // padding and the gaps between its children, so a target check would close on those clicks
  const outside = (e, dialog) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
    let pressedOutside = false;
    dialog.addEventListener('pointerdown', (e) => { pressedOutside = outside(e, dialog); });
    // Require the press and the release outside, so a text-selection drag that ends on the backdrop does not dismiss
    dialog.addEventListener('pointerup', (e) => { if (pressedOutside && outside(e, dialog)) dialog.close(); });
  }
}
```

### Invoker Commands (`command` / `commandfor`)

{{ BASELINE_STATUS("invoker-commands") }}

If your Baseline target does not include Invoker Commands, keep the same markup and conditionally load the polyfill (the same experience, as progressive enhancement). Detect on the interface and never load it unconditionally:

```js
// MANDATORY: feature detect on HTMLButtonElement.prototype and load only when native support is missing
if (!('commandForElement' in HTMLButtonElement.prototype)) {
  import('invokers-polyfill'); // npm install invokers-polyfill
}
```

Only Rules 2 and 3 use Popover.

{{ FEATURE_FALLBACKS("popover") }}
