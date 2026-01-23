---
description: Prevent keyboard focus from being trapped in a specific region of a webpage to ensure all interactive elements are accessible.
filename: prevent-keyboard-focus-traps
category: a11y
---

# Prevent Keyboard Focus Traps

Reference docs:
- https://web.dev/learn/accessibility/test-manual
- https://github.com/gdkraus/accessible-modal-dialog
- https://web.dev/articles/using-tabindex#modals_and_keyboard_traps

## Best Practices

Ensure that users navigating with a keyboard can move focus to and from all interactive elements on a page. Avoid trapping focus within specific components like modals or widgets.

When creating components that temporarily require exclusive user interaction (e.g., modal dialogs), provide a clear and accessible method for users to escape the focus trap using the keyboard.

```html
<!-- Example of a modal with an escape mechanism -->
<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <h2 id="modal-title">Modal Title</h2>
  <p>Content requiring focus.</p>
  <button id="close-modal-button">Close</button>
</div>
```

```javascript
// Example JavaScript to manage focus within a modal
const modal = document.querySelector('.modal');
const closeButton = document.getElementById('close-modal-button');
const focusableElements = modal.querySelectorAll('button, input, textarea, select, a[href]');
const firstFocusable = focusableElements[0];
const lastFocusable = focusableElements[focusableElements.length - 1];

modal.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeModal();
  } else if (event.key === 'Tab') {
    if (event.shiftKey) { // Shift + Tab
      if (document.activeElement === firstFocusable) {
        lastFocusable.focus();
        event.preventDefault();
      }
    } else { // Tab
      if (document.activeElement === lastFocusable) {
        firstFocusable.focus();
        event.preventDefault();
      }
    }
  }
});

closeButton.addEventListener('click', closeModal);

function closeModal() {
  // Logic to hide modal and return focus to the element that opened it
}
```

**DO** allow users to navigate to and from all page elements using only the keyboard.
**DO** provide clear visual focus indicators for all interactive elements.
**DO** test keyboard navigation thoroughly, especially with complex components like autocomplete widgets and dialogs.
**DO** consider providing a keyboard-accessible way to exit any temporary focus traps.

## Fallback strategies

If a user cannot use a mouse, keyboard navigation is their primary way to interact with a page. A broken tab order or a focus trap can render the page unusable for these users.

### Manual Testing

- **DO** use <kbd>TAB</kbd> to move focus forward through interactive elements.
- **DO** use <kbd>SHIFT</kbd>+<kbd>TAB</kbd> to move focus backward through interactive elements.
- **DO** verify that you can reach every interactive element on the page and that focus is not stuck in any region.

### Auditing Tools

- **DO** use browser developer tools and accessibility auditing extensions (like Lighthouse) to identify potential focus trap issues.

## Resources

- [Source code for Lighthouse focus traps audit](https://github.com/GoogleChrome/lighthouse/blob/master/core/audits/accessibility/manual/focus-traps.js)
- [Creating Accessible Modals](https://github.com/gdkraus/accessible-modal-dialog)