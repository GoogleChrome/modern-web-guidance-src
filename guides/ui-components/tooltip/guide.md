---
name: tooltip
description: Build a tooltip that shows short supplemental text when a user hovers, focuses, or long-presses a control, without requiring a click, and pick the right pattern when the request is really a hovercard, toggletip, tour step, or slider value label.
web-feature-ids:
  - popover
  - popover-hint
  - interest-invokers
  - anchor-positioning
guides:
  - position-aware-tooltips
  - viewport-aware-dropdowns
  - animate-to-from-top-layer
  - hovercard
  - slider-tooltip
  - persistent-app-tours
  - declarative-dialog-popover-control
  - persistent-toast-notifications
---

# Build a tooltip

A tooltip is a short piece of plain text that appears next to a control when the user hovers, focuses, or long-presses it, and disappears when they move on. It explains an icon-only button, defines a term, or adds a hint to a form field, without changing the user's context. It never contains interactive content.

This guide is the entry point for any "tooltip" request. It sets the primitive and the rules every tooltip shares, then routes to the guide that covers the rest of the use case.

## Is it a tooltip?

Many requests that say "tooltip" are a different component. Pick the row that matches before writing code:

| You need | Build |
|---|---|
| Plain text shown on hover or focus of a control | A tooltip (this guide) |
| A structured, interactive preview of where a link goes (profile card, article summary) | {{ GUIDE_REF("hovercard") }} |
| Help text that opens and stays open on click or tap (a "?" button next to a field, sometimes called a toggletip) | A click-toggled popover: {{ GUIDE_REF("declarative-dialog-popover-control") }} for the trigger wiring and {{ GUIDE_REF("viewport-aware-dropdowns") }} for positioning |
| Step-by-step onboarding callouts that stay open while the user interacts with the page | {{ GUIDE_REF("persistent-app-tours") }} |
| A value label that follows a range slider's thumb | {{ GUIDE_REF("slider-tooltip") }} |
| A transient status message that is not tied to a specific element | {{ GUIDE_REF("persistent-toast-notifications") }} |

## Core rules for every tooltip

- **DO NOT** use the `title` attribute. It is unreliable on touch devices, not reachable by keyboard in any browser, and cannot be styled.
- **The trigger must be a focusable control** (`<button>` or `<a href>`). To add a tooltip to a bare icon or text, wrap it in a `<button type="button">`. Without a focusable trigger keyboard and screen reader users cannot reach the tooltip.
- **Give the trigger a visible affordance** (a dashed underline, an info icon, `cursor: help`) so users know more information is available.
- **The tooltip is supplemental, not the accessible name.** An icon-only button still needs its own accessible name (visible text or `aria-label`); the tooltip describes it and must add to the name rather than repeat it, or screen readers announce the same text twice. Never put information in a tooltip that users must have to complete a task.
- **To explain a disabled control, keep it focusable.** A `disabled` button cannot be hovered, focused, or used as an `interestfor` trigger. Use `aria-disabled="true"` plus styling instead, and ignore activation in script.
- **Use `popover="hint"` for the tooltip and `interestfor` on the trigger.** The browser then opens on hover, focus, and long-press with a delay, closes on `Escape` and when interest is lost, keeps the tooltip hoverable (WCAG 1.4.13), closes other hint popovers, and leaves open `auto` popovers such as menus alone.
- **DO NOT add `role="tooltip"`, `aria-describedby`, or `aria-details` yourself.** The browser wires them implicitly (see Accessibility below).
- **Position with CSS Anchor Positioning.** The trigger is the tooltip's implicit anchor, so `position-area` plus `position-try-fallbacks` on the popover is enough. **DO NOT** compute coordinates in JavaScript.
- **Keep it plain text.** If the content needs a link, button, or image, it is a hovercard, not a tooltip (see the table above).

```html
<!-- Trigger: a real control, with its own accessible name -->
<button type="button" interestfor="save-tip" aria-label="Save">
  <!-- icon -->
</button>

<!-- Tooltip: hint popover, plain text that adds to the name, no role or ARIA wiring needed.
     The class scopes the styles below so they don't also hit hovercards or other hint popovers. -->
<div id="save-tip" class="tooltip" popover="hint">Save your changes (Ctrl+S)</div>
```

```css
.tooltip[popover="hint"] {
  /* Implicit anchor from interestfor: no anchor-name or position-anchor needed */
  position-area: block-start;
  /* Flip to block-end when there is no room above the trigger */
  position-try-fallbacks: flip-block;
  /* Reset the UA popover centering so anchor positioning takes over */
  margin: unset;
  inset: auto;
}
```

### Accessibility

{{ FEATURE("interest-invokers", "accessibility") }}

The native `popover="hint"` and `interestfor` behavior already satisfies WCAG 1.4.13 (Content on Hover or Focus). Keep it that way: **DO NOT** hide the tooltip from script on `pointerleave` or on a timer.

- **Dismissible:** the user can close the tooltip with `Escape` without moving the pointer or focus.
- **Hoverable:** the pointer can move from the trigger onto the tooltip without it disappearing, so users with magnification can read it.
- **Persistent:** the tooltip stays visible until interest is lost, the user dismisses it, or its content is no longer valid.

### Timing

{{ FEATURE("interest-invokers", "timing") }}

## Going further

- **A directional arrow (or any styling) that must move when the tooltip flips to a fallback position:** {{ GUIDE_REF("position-aware-tooltips") }}. Keep this guide's `interestfor` trigger; that guide's explicit `role="tooltip"` and `aria-describedby` apply only to its click-opened `popovertarget` example.
- **Fade or slide the tooltip in and out:** {{ GUIDE_REF("animate-to-from-top-layer") }}.

## Fallback strategies

{{ FEATURE_FALLBACKS("interest-invokers") }}

{{ FEATURE_FALLBACKS("popover") }}

{{ BASELINE_STATUS("popover-hint") }}

In browsers that support `popover` but not the `hint` value, the attribute falls back to the `manual` state. The `interestfor` polyfill still shows and hides the tooltip on interest, but `Escape` and light dismiss are no longer native, and a tooltip opened via focus may stay open when a second one opens via hover. The popover polyfill does not add hint behavior either.

{{ FEATURE_FALLBACKS("anchor-positioning") }}
