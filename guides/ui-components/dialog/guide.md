---
name: dialog
description: Build a modal or non-modal dialog component that is accessible, manages focus appropriately, and can be dismissed the way users expect on each platform.
draft: stub
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

## Notes for guide authors

This is meant to be the first stop for any "dialog" or "modal dialog" request. Developers typically ask for a dialog with the expected behaviors included; they rarely ask for light dismiss or `Esc` handling as separate features. Today there is no core dialog guide, so those requests land on satellite guides (`declarative-dialog-popover-control`, `light-dismiss-a-dialog`) that each cover one slice and, in the case of the two dismiss guides, contradict each other on fallbacks (#1671).

Cover, in roughly this order:

- **Choosing the right overlay (modal vs. non-modal vs. popover)**:
  - **Modal dialog (`<dialog>` opened with `showModal()` or `command="show-modal"`)**: Blocks interaction with the rest of the page (`inert` background, focus trap, top layer, `::backdrop`, platform close requests). The default and most common choice for confirmations, forms, and critical interruptions. Never use `show()` or the `open` attribute for a modal.
  - **Non-modal dialog (`<dialog popover>` vs. `dialog.show()`)**: When the user needs to keep interacting with the page while a semantic `role="dialog"` panel stays open (such as a find-in-page bar, floating inspector or palette, or persistent compose pane). Explain that `dialog.show()` does *not* place the dialog in the top layer, whereas `<dialog popover="auto">` (or `popover="manual"`) combines `<dialog>` semantics with top-layer rendering without making the page `inert`.
  - **Plain `[popover]`**: When the overlay is not a dialog at all (menus, tooltips, hovercards, toasts), use a semantic element with `popover` instead of `<dialog>`.
- **Accessible name and initial focus**: `aria-labelledby` pointing at the heading, and `autofocus` on the primary control or first field when a specific element should receive initial focus.
- **Closing**: `<form method="dialog">` (and `command="close"`) for buttons, `closedby="any"` for light dismiss, `closedby="closerequest"` (the modal default) for `Esc` and mobile back gesture, and `closedby="none"` for dialogs that must not be dismissed implicitly. Treat all of `closedby` as a progressive enhancement; include a backdrop-click fallback only if it tracks `pointerdown` as well as `click`, so a text-selection drag that ends over the backdrop does not close the dialog (the root cause of #1671).
- **Hooking into close**: `cancel` (user-initiated close request) vs. `close` (any close), `returnValue`, and the caveat that `cancel.preventDefault()` is not honored on a repeated `Esc` without intervening user activation (close watcher anti-abuse). Point to `closedby="none"` plus an explicit confirmation step for dirty forms instead.
- **Backdrop and styling**: `::backdrop` styling, scroll containment (referencing `prevent-page-scroll-under-modal-dialog`), and entry/exit animations (referencing `animate-to-from-top-layer`).

Keep it one guide with clear headings so RAG chunks match "modal dialog," "non-modal dialog," "accessible modal dialog," "modal dialog form," "modal dialog backdrop," and similar prompts.

## Relationship to other guides

- `light-dismiss-a-dialog` and `platform-controls-dismiss-dialog` should fold into the "Closing" section here and be retired. Their one disagreement (whether a JS fallback for `closedby="any"` is mandatory) is settled by this guide: progressive enhancement, optional fallback, `pointerdown`-aware if present. Resolve #1671 by retiring them rather than patching both.
- `declarative-dialog-popover-control` stays as the guide for the `command`/`commandfor` invoker pattern; this guide shows the one-line declarative open/close and refers to it for the rest.
- `prevent-page-scroll-under-modal-dialog` stays separate; this guide references it in the overview since it applies to every modal.
- `animate-to-from-top-layer` stays separate and owns `@starting-style`, `transition-behavior: allow-discrete`, `overlay`, and the `data-closing` exit fallback; this guide references it rather than duplicating the animation fallback logic.
- `drag` stays separate for movable floating dialogs and palettes; its `GUIDE_REF` to `platform-controls-dismiss-dialog` should be updated to point here when `platform-controls-dismiss-dialog` is retired.
- `persistent-top-layer-ui` stays separate for preserving open `<dialog>` and `[popover]` state across DOM reparenting with `moveBefore()`; this guide can cross-reference it.
- `accessibility` currently absorbs "accessible modal dialog" queries; once this guide exists, it should own that intent, and the accessibility guide can point here.
