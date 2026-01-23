---
description: Implement accessible and seamless modal windows and popovers using native browser features like &lt;dialog&gt; and the popover attribute.
filename: layered-ui-patterns
category: ui
---

# Layered UI Patterns: Modals and Popovers

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog
- https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/popover
- https://developer.mozilla.org/en-US/docs/Web/CSS/::backdrop
- https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style
- https://developer.chrome.com/blog/what-is-the-top-layer/

## Best Practices

### Modal Dialogs with `<dialog>`

Use the native `<dialog>` element for modal UI patterns. The `showModal()` method automatically handles focus management, ARIA attributes, and dimming the background content, promoting the dialog to the top layer.

- **DO** use `dialog.showModal()` to display a modal dialog. This ensures proper accessibility and user experience by managing focus, ARIA, and the inert state of background content.
- **DO** use the `::backdrop` pseudo-element to style the dimmed background behind the modal.
- **DO** provide a clear way to close the dialog, either via an explicit close button using `dialog.close()` or by using a `<form method="dialog">`.
- **DO** consider using `autofocus` on an element within the dialog if you want focus to be directed there immediately upon opening.
- **DO** leverage `@starting-style` and `transition-behavior: allow-discrete` for smooth entrance and exit animations of the dialog.

### Popovers

Use the `popover` attribute for elements that appear over other content but do not necessarily require the entire background to be inert, such as tooltips or simple information displays.

- **DO** use the `popover` attribute on any element you wish to make a popover.
- **DO** use `popovertarget` on a control element (like a button) to declaratively show or hide a popover.
- **DO** understand that `popover="auto"` elements are "light-dismissed" by default, meaning they close when the user clicks outside of them.
- **DO** use the `:popover-open` pseudo-class to style the popover when it is visible.
- **DO** leverage CSS Anchor Positioning to tether popovers to specific elements for precise placement.

### Transitions and Animations

- **DO** use `@starting-style` in conjunction with `transition-behavior: allow-discrete` to animate the `display`, `overlay`, `opacity`, and `translate` properties for smooth transitions of dialogs and popovers.
- **DO** define custom properties with `@property` to enable smooth animations on gradients or colors used in the `::backdrop`.

## Fallback strategies

If the user's Baseline target (or Widely available, if unavailable) does not support any of the required features, the following fallback strategies MUST be used.

### `<dialog>` element

- **DO** use `'showModal' in HTMLDialogElement.prototype` for JavaScript feature detection.
- **DO** conditionally load a polyfill if the browser fails the feature detection check. Consider libraries like `@oddbird/dialog-polyfill`.

### `popover` attribute

- **DO** use `'popover' in HTMLDivElement.prototype` (or the appropriate element type) for JavaScript feature detection.
- **DO** conditionally load a polyfill if the browser fails the feature detection check. Consider libraries like `@oddbird/popover-polyfill`.

### `::backdrop` pseudo-element

- **DO** use `@supports selector(::backdrop)` for CSS feature detection.
- **DO** conditionally implement alternative styling or behavior if the browser does not support `::backdrop`.

### `@starting-style` and `transition-behavior`

- **DO** use `@supports (transition-behavior: allow-discrete)` for CSS feature detection.
- **DO** conditionally apply transitions or animations if the browser does not support these features, potentially falling back to simpler, non-animated implementations.