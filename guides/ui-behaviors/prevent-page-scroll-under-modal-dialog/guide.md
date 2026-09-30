---
name: prevent-page-scroll-under-modal-dialog
description: Prevent the underlying page from scrolling while a modal dialog is open.
web-feature-ids:
  - overscroll-behavior
  - dialog
  - backdrop
  - modal
---

# Prevent the Page Underneath a Modal Dialog from Scrolling

When a `<dialog>` element is opened as a modal using `showModal()`, the browser promotes it to the top layer and marks the rest of the document inert. While that blocks pointer clicks and keyboard focus on the underlying page, it does not prevent scrolling:

1. Scrolling while the pointer or touch gesture is over the `::backdrop` scrolls the page underneath.
2. Scrolling inside the `<dialog>` chains to the underlying page once the dialog reaches its scroll boundary—or immediately if the dialog's content does not overflow.

Per the CSS Overscroll Behavior specification, `overscroll-behavior` applies to **all scroll container elements**, including non-scrollable scroll containers (elements with `overflow: hidden`, or `overflow: auto` whose content does not currently overflow). By combining `overscroll-behavior: contain` on the `<dialog>` with `overflow: hidden` and `overscroll-behavior: contain` on `dialog::backdrop`, you can prevent the underlying page from scrolling using pure CSS.

## Implementation

### 1. Contain scroll chaining on the `<dialog>`

The user-agent stylesheet sets `overflow: auto` on `<dialog>`, making it a scroll container by default. Apply `overscroll-behavior: contain` (or `none`) to `dialog`. 

### 2. Turn `::backdrop` into a scroll container and contain its scroll

By default, `dialog::backdrop` has `overflow: visible`, which means it is **not** a scroll container and ignores `overscroll-behavior`. You must set `overflow: hidden` on `dialog::backdrop` to make it a non-scrollable scroll container, and pair it with `overscroll-behavior: contain` so scroll gestures performed over the backdrop are trapped and do not reach the document underneath.

## Example Code

```css
dialog:modal {
  overscroll-behavior: contain;
}

dialog::backdrop {
  overflow: hidden;
  overscroll-behavior: contain;
}
```

## Best Practices & Constraints

- **MANDATORY**: Set `overscroll-behavior: contain` on the `<dialog>` element itself (using the `dialog:modal` selector) and the `dialog::backdrop`. Without this declaration, scroll gestures over the backdrop or inside the dialog will still chain to the page.
- **MANDATORY**: Set `overflow: hidden` (or `overflow: auto`) on `dialog::backdrop` so that it becomes a scroll container. Without this declaration `::backdrop` defaults to `overflow: visible` and `overscroll-behavior` will have no effect.
- **DO NOT** use `overflow: clip` on `dialog::backdrop` or `dialog`. `overflow: clip` does not establish a scroll container, so `overscroll-behavior` will not apply.
- **DO NOT** apply `overflow: hidden` or `position: fixed` to `<html>` or `<body>` to lock background scrolling when a dialog opens. Mutating root overflow removes the page scrollbar (causing horizontal layout shift), can reset or jump the page scroll position, and can break `position: sticky` elements on the underlying page.

## Fallback Strategies

While the `overscroll-behavior` CSS property is supported across all major browsers for scroll containers that have overflowing content, respecting `overscroll-behavior` on **non-scrollable** scroll containers is a newer specification that cannot be feature detected.

**DO NOT** attempt to feature-detect non-scrollable container support with `@supports (overscroll-behavior: contain)` or `CSS.supports('overscroll-behavior', 'contain')`. All modern browsers support the `overscroll-behavior: contain` property syntax and return `true`, even if they only enforce it when content overflows.

Instead, treat scroll containment on non-scrollable scroll containers as a **progressive enhancement**:

- In browsers that support `overscroll-behavior` on non-scrollable scroll containers, background page scrolling is completely prevented both over `dialog::backdrop` and inside the `<dialog>` (whether or not its content overflows).
- In browsers that do not yet support `overscroll-behavior` on non-scrollable scroll containers, `overscroll-behavior: contain` on `dialog` still prevents scroll chaining whenever the dialog's own content overflows and is scrollable. Meanwhile, `showModal()` still traps keyboard focus and marks the background document `inert`.
- Relying on progressive enhancement avoids the layout shifts, disappearing scrollbars, and iOS viewport scroll jumps caused by legacy `html { overflow: hidden }` workarounds.

This approach is recommended over legacy workarounds that apply `overflow: hidden` or `position: fixed` to `<html>` or `<body>`, because it does not remove the root scrollbar, cause horizontal layout shifts, jump the page scroll position, or break `position: sticky` elements on the underlying page.