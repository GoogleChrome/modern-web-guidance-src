---
name: persistent-toast-notifications
description: Create non-intrusive toast and overlay notifications for persistent, stackable messaging and state communication.
web-feature-ids:
  - popover
  - anchor-positioning
  - sibling-count
  - transition-behavior
sources:
  - https://developer.chrome.com/blog/introducing-popover-api
  - https://web.dev/learn/css/popover-and-dialog
  - https://developer.mozilla.org/docs/Web/CSS/Guides/Anchor_positioning
---

# Creating Persistent Toast Notifications

Toast notifications are transient status messages that provide non-blocking feedback to the user. Unlike menus or modals, they should not interrupt the user's workflow and must not close when a user interacts with other parts of the page. Using the `popover="manual"` state is ideal because it lacks light-dismiss behavior and allows multiple notifications to coexist and stack seamlessly in the top layer.

## Implementation Guidelines

To implement accessible, robust toast notifications:

- **MANDATORY:** Use `popover="manual"` so the notification remains visible until explicitly closed by the user or an automated timer.
- **Live Region Semantics:** Mark the toast container with `role="status"` and `aria-live="polite"` (or `role="alert"` for critical interruptions) to ensure screen readers announce the update autonomously. Coordinate announcements so they are not added to inert DOM subtrees.
- **Timer Pause Mechanism:** If an auto-dismissal timer is used, provide mechanisms to pause the timer when a user hovers over the toast (`pointerenter`) or moves keyboard focus inside it (`focusin`), and resume on leaving. This ensures users with reading or motor difficulties have adequate time to consume the notification.
- **Explicit Close Action:** Always provide an explicit close button inside the toast using `popovertargetaction="hide"`.
- **Stacking and Margins:** Utilize `sibling-index()` to dynamically calculate positioning and apply distinct margins between stacked popovers.
- **Smooth Transitions:** Use `transition-behavior: allow-discrete` to animate entry and exit states cleanly from the top layer.

## Code Example

```html
<!-- MANDATORY: Expose live-region semantics for assistive technologies -->
<div id="toast-notification" popover="manual" role="status" aria-live="polite" class="toast">
  <span>Action completed successfully.</span>
  <!-- Provide an explicit dismissal control -->
  <button popovertarget="toast-notification" popovertargetaction="hide" aria-label="Close notification">
    &times;
  </button>
</div>

<style>
  .toast {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    /* Dynamically space stacked toast items */
    margin-bottom: calc(sibling-index() * 4rem);
    padding: 1rem;
    border: 1px solid #334155;
    border-radius: 8px;
    background-color: #1e293b;
    color: #f8fafc;
    transition: opacity 0.3s, transform 0.3s, display 0.3s, overlay 0.3s;
    transition-behavior: allow-discrete;
    opacity: 0;
    transform: translateY(1rem);
  }

  .toast:popover-open {
    opacity: 1;
    transform: translateY(0);
  }

  @starting-style {
    .toast:popover-open {
      opacity: 0;
      transform: translateY(1rem);
    }
  }
</style>

<script type="module">
  const toast = document.getElementById('toast-notification');
  let timerId;
  let remainingTime = 4000; // Example-only duration
  let startTime;

  function startTimer() {
    startTime = Date.now();
    timerId = setTimeout(() => {
      if (toast.matches(':popover-open')) {
        toast.hidePopover();
      }
    }, remainingTime);
  }

  function pauseTimer() {
    clearTimeout(timerId);
    remainingTime -= (Date.now() - startTime);
  }

  // Show popover and initialize timer
  toast.showPopover();
  startTimer();

  // MANDATORY: Pause auto-dismissal on user interaction
  toast.addEventListener('pointerenter', pauseTimer);
  toast.addEventListener('focusin', pauseTimer);
  toast.addEventListener('pointerleave', startTimer);
  toast.addEventListener('focusout', startTimer);
</script>
```

## Fallback Strategies

{{ FEATURE_FALLBACKS("popover") }}

For browsers that do not support the Popover API, implement a JavaScript fallback that appends a standard fixed-position element with a high `z-index` to the document body. Ensure the fallback element retains `role="status"` and `aria-live="polite"` semantics for screen readers, and manually manage entry/exit animation classes along with the same interaction-aware auto-dismissal timer logic.

If `sibling-index()` or anchor positioning features are unsupported, use adjacent sibling selectors (`.toast + .toast`) or manual CSS margin calculations to ensure stacked notifications remain clearly separated and legible.