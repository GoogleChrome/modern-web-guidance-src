---
name: create-toast-notifications

description: Create non-intrusive toast and overlay notifications using the popover="manual" state for persistent, stackable messaging. This approach ensures notifications do not close other active UI elements or dismiss when clicking elsewhere on the page.

web-feature-ids:
* popover
  sources:
* https://developer.chrome.com/blog/introducing-popover-api
* https://web.dev/learn/css/popover-and-dialog
---

# Creating Toast Notifications

Toast notifications are transient status messages. Unlike menus, they should not close when a user interacts with other parts of the page. The popover="manual" state is ideal because it lacks "light-dismiss" behavior and allows multiple notifications to coexist.

### Implementation Guidelines

* **MANDATORY:** Use popover="manual" so the notification stays visible until explicitly closed or timed out by a script.
* **DO** use a container to manage the stacking of multiple toasts. Since popovers in the Top Layer ignore parent z-index, you must position them individually or within a common layout group.
* **DO** provide an explicit "Close" button within the toast using popovertargetaction="hide".
* **DO** use JavaScript for auto-dismissal timers (e.g., calling hidePopover() after 3000ms).
* **DO** utilize transition-behavior: allow-discrete to animate the entry and exit from the Top Layer.

### Fallback Strategies

#### popover

* **Guidance:** Use the [Popover Polyfill](https://github.com/oddbird/popover-polyfill). For legacy browsers, fall back to a fixed-position div with a high z-index.
