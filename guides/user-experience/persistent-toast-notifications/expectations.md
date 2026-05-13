1. Toasts must appear on top of all other page content, including modal dialogs or open menus.
2. Clicking on the DOM content outside of the popover must not dismiss the toast notification.
3. Multiple toasts must be able to be open at the same time without closing one another.
4. The toast must correctly remove itself from the Top Layer once dismissed.
5. The toast element MUST set `role="status"` and `aria-live="polite"` (or `role="alert"`) to ensure autonomous screen reader announcement.
6. The toast auto-dismissal timer MUST pause when the user hovers over the toast (`pointerenter`) or moves focus inside it (`focusin`), and MUST resume upon leaving.
