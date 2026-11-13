---
name: interest-triggered-tooltips
description: Show a tooltip or supplemental information when a user hovers over, focuses on, or long-presses an interactive element, without requiring a click.
web-feature-ids:
  - interest-invokers
  - popover
  - popover-hint
  - anchor-positioning
---

# Show a tooltip when hovering

Users expect to see additional related information without completely changing their context. Showing a tooltip when a user is interested in more information can be useful to provide definitions for a term, clarifying the action an icon-only button will take, or provide additional form field guidance.

## Should you use a tooltip?

A toggletip is a small button, usually an "i" or "?" icon, placed next to a control or a piece of content, whose only job is to reveal more information. The choice between tooltip, toggletip, and inline content is about how important and how long the information is:

- **Tooltip** (on the control itself): a short clarification of what the control does. Missing it costs the user little.
- **Toggletip** (an "i" or "?" next to the control or content): information users may well want but most don't need every time, such as why a field is required, how a total was computed, or what a policy means, or anything longer than a phrase. Showing it inline would add clutter, but it deserves an explicit, visible affordance so every user can find it deliberately rather than by happening to hover, including on touch and with a screen reader. See below for guidance on creating toggletips.
- **Inline content**: information most users need in order to act, or need while they act (password rules while typing, a value they copy). A popover closes as soon as they click or focus elsewhere.

## Creating the tooltip

You can create a popover with the required behavior by adding the `popover="hint"` attribute to a `<div>` or other semantically appropriate element. When the user opens the tooltip, this hides other `popover="hint"` tooltips, but doesn't hide `auto` or `manual` tooltips. It also handles dismissing nested tooltips.

It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.

The tooltip element must have an `id` attribute with a unique value:

```html
<!-- MANDATORY: The tooltip element must have popover="hint" so it light-dismisses
     without closing unrelated auto or manual popovers. -->
<div popover="hint" id="tooltip">Tooltip content</div>
```

A user expresses interest in the additional information by hovering or focusing on an `<a>` or `<button>` element. The element must have an `interestfor` attribute that matches the `id` attribute of the tooltip.

```html
<!-- The `interestfor` attribute can be applied to a `<button>` element: -->
<button interestfor="tooltip">Tooltip trigger</button>

<!-- The `interestfor` attribute can also be applied to an `<a>` element (href is an example): -->
<a interestfor="tooltip" href="/docs/dom">Tooltip trigger</a>
```

The trigger must have a visual indicator to indicate that there is additional information available by interacting with the trigger.

### Accessibility

{{ FEATURE("interest-invokers", "accessibility") }}

### Accessibility Constraints (WCAG 1.4.13)

Even with `interestfor` handling the semantics above, your implementation MUST still satisfy WCAG 1.4.13 (Content on Hover or Focus):
- **Dismissible:** Users must be able to dismiss the tooltip without moving pointer hover or keyboard focus (e.g., by pressing the `Escape` key). The native `popover` attribute manages this binding automatically.
- **Hoverable:** The pointer must be able to move over the tooltip content itself without the tooltip disappearing. This allows users with magnification tools to read the tooltip text safely.
- **Persistent:** The tooltip must remain visible until the hover or focus trigger is removed, the user explicitly dismisses it, or its content is no longer valid.

### Positioning the tooltip

The tooltip is positioned using **CSS Anchor Positioning**. When the tooltip is opened using `interestfor`, the trigger element automatically becomes an **implicit anchor** for the popover.

In modern browsers supporting native anchor positioning, you do **not** need to define an `anchor-name` on the trigger or a `position-anchor` on the tooltip. You can position the tooltip directly relative to its implicit anchor using `position-area` and handle collision flipping with `position-try-fallbacks`:

```css
[popover] {
  /* Implicit anchor from interestfor: no anchor-name or position-anchor needed */
  position-area: block-start;
  position-try-fallbacks: flip-block;
  /* Override UA popover centering (`inset: 0; margin: auto`) so the tooltip sits adjacent to its anchor */
  inset: auto;
  margin: 0;
}
```

## Toggletips: an "i" or "?" button

Give a toggletip both triggers: `interestfor` opens it on hover, focus, and long-press; `popovertarget` opens it on click, tap, and `Enter`.

```html
<label>Shipping <input name="shipping"></label>
<!-- The name says what the button reveals; the "?" alone is not a name. -->
<button type="button" interestfor="shipping-help" popovertarget="shipping-help" popovertargetaction="show" aria-label="More about shipping">?</button>
<!-- Right after the trigger, so it reads in sequence. -->
<div id="shipping-help" popover="hint">Free shipping applies to orders over $50. Orders placed before 2pm ship the same day.</div>
```

- Use `popovertargetaction="show"`, not the default `toggle`: hover has usually opened the popover already, and a toggle would close it on the click that follows. When opened by hover or focus alone, losing interest closes it; when opened by click, tap, or `Enter`, `Escape` or light dismiss (clicking outside) closes it.
- Keep `popover="hint"`: hovering across a toggletip must not close an open menu, which an `auto` popover would.
- Position it like any tooltip. The button is the popover's implicit anchor through either attribute.

## Fallback strategies

{{ FEATURE_FALLBACKS("interest-invokers") }}

{{ FEATURE_FALLBACKS("popover") }}

### Fallbacks & browser support for `popover="hint"`

{{ BASELINE_STATUS("popover-hint") }}

The `@oddbird/popover-polyfill` package does not polyfill `popover="hint"` in browsers that already support native `popover` (`auto` and `manual`). In those browsers, the unrecognized `"hint"` value defaults to `popover="manual"` (the HTML invalid value default), so a tooltip opened via keyboard focus may remain open if a second tooltip is opened via pointer hover unless explicitly dismissed on loss of interest by the invoker.

A toggletip can also be opened by click, with no interest to lose, so a `manual` fallback would never close. Where `hint` is unsupported, switch toggletips to `popover="auto"` as they open. This MUST happen in `beforetoggle`: the browser reads the popover type after that event, whereas changing the type of an already open popover closes it. `beforetoggle` does not bubble, so delegate with a capturing listener:

```js
// The `popover` property reports the state the browser actually uses: "manual" when `hint` is unsupported.
const probe = document.createElement("div");
probe.popover = "hint";
if (probe.popover !== "hint") {
  document.addEventListener("beforetoggle", ({ target, newState }) => {
    const toggletip = target.getAttribute("popover") === "hint"
      && document.querySelector(`[popovertarget="${CSS.escape(target.id)}"]`);
    if (newState === "open" && toggletip) {
      target.popover = "auto";
    }
  }, true);
}
```

{{ FEATURE("anchor-positioning", "popover-fallbacks") }}
