---
name: modal-dialog
description: Build a modal dialog that blocks interaction with the rest of the page, is accessible, and can be dismissed the way users expect on each platform
draft: stub
web-feature-ids:
  - dialog
  - dialog-closedby
  - invoker-commands
---

# Modal Dialog

## Notes for guide authors

This is meant to be the first stop for any "modal dialog" request. Developers ask for a modal dialog and expect the complete package; they rarely ask for light dismiss or `Esc` handling as separate features. Today there is no core dialog guide, so those requests land on satellite guides (`declarative-dialog-popover-control`, `light-dismiss-a-dialog`) that each cover one slice and, in the case of the two dismiss guides, contradict each other on fallbacks (#1671).

Cover, in roughly this order:

- `<dialog>` opened with `showModal()` (or declaratively via `command="show-modal"`), never `show()` or `open` for modals. Explain *why*: top layer, inert background, focus management, `::backdrop`.
- Accessible name (`aria-labelledby` pointing at the heading) and initial focus (`autofocus` on the primary control or first field).
- Closing: `<form method="dialog">` for buttons, `closedby="any"` for light dismiss, `closedby="closerequest"` (the default) for `Esc` and mobile back gesture, `closedby="none"` for dialogs that must not be dismissed implicitly. Treat all of `closedby` as a progressive enhancement; include a backdrop-click fallback only if it tracks `pointerdown` as well as `click`, so a text-selection drag that ends over the backdrop does not close the dialog (the root cause of #1671).
- Hooking into close: `cancel` (user-initiated close request) vs. `close` (any close), `returnValue`, and the caveat that `cancel.preventDefault()` is not honored on a repeated `Esc` without intervening user activation (close watcher anti-abuse). Point to `closedby="none"` plus an explicit confirmation step for dirty forms instead.
- `::backdrop` styling and `@starting-style` / `transition-behavior: allow-discrete` for enter and exit animation.
- Dialog vs. popover: when a non-modal `popover` is the better fit.

Keep it one guide with clear headings so RAG chunks match "accessible modal dialog," "modal dialog form," "modal dialog backdrop," and similar prompts.

## Relationship to other guides

- `light-dismiss-a-dialog` and `platform-controls-dismiss-dialog` should fold into the "Closing" section here and be retired. Their one disagreement (whether a JS fallback for `closedby="any"` is mandatory) is settled by this guide: progressive enhancement, optional fallback, `pointerdown`-aware if present. Resolve #1671 by retiring them rather than patching both.
- `declarative-dialog-popover-control` stays as the guide for the `command`/`commandfor` invoker pattern; this guide shows the one-line declarative open and refers to it for the rest.
- `prevent-page-scroll-under-modal-dialog` stays separate; this guide references it in the overview since it applies to every modal.
- `accessibility` currently absorbs "accessible modal dialog" queries; once this guide exists, it should own that intent, and the accessibility guide can point here.
