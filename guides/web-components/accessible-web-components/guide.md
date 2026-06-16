---
name: accessible-web-components
description: Make custom elements accessible by default, setting roles and ARIA state via the ElementInternals ARIA mixin, managing focus with delegatesFocus, and keeping ARIA relationships within a single shadow root.
web-feature-ids:
  - aria-attribute-reflection
  - shadow-dom
---

# Accessible Web Components

A shadow boundary changes how semantics and ARIA work. The two failures that dominate: missing semantics inside the shadow tree, and ARIA references that silently break because they cannot cross shadow roots. This guide is about making custom elements accessible by default.

The foundation is semantic markup: use real `<button>`, `<nav>`, `<ul>` inside the template so most semantics come for free, and reserve `ElementInternals`/ARIA for the gaps.

## Default semantics via the ElementInternals ARIA mixin

Set a custom element's role and ARIA state in JS through `ElementInternals`, rather than writing ARIA attributes onto the host. This keeps the semantics as defaults the component owns, while still letting a consumer override them with attributes in the Light DOM.

```javascript
class ToggleSwitch extends HTMLElement {
  #internals;
  constructor() {
    super();
    this.#internals = this.attachInternals();
    this.#internals.role = 'switch';          // default role, no host attribute needed
    this.#internals.ariaChecked = 'false';    // exposed to the accessibility tree
  }
  toggle() {
    const on = this.#internals.ariaChecked !== 'true';
    this.#internals.ariaChecked = String(on);
  }
}
customElements.define('toggle-switch', ToggleSwitch);
```

This avoids polluting the DOM with ARIA attributes and prevents consumers from accidentally clobbering them, while the accessibility tree still sees the correct role and state.

{{ BASELINE_STATUS("aria-attribute-reflection") }}

## Focus management and `delegatesFocus`

- Attach the shadow root with `delegatesFocus: true` when the component wraps focusable controls. Focusing the host then forwards focus to the first focusable child, and `:focus`/label clicks behave as users expect.
- For roving focus or moving focus into a newly revealed region, give the target `tabindex="-1"` and call `.focus()`; make programmatically-focusable targets explicit rather than relying on tab order.

## ARIA relationships cannot cross shadow roots

- **MANDATORY**: an `id` referenced by `aria-labelledby`, `aria-describedby`, `aria-controls`, etc. must live in the **same** tree as the referencing element. An attribute in the Light DOM cannot point at an `id` inside the shadow tree, and vice versa; the reference is silently ignored.
- Keep each ARIA relationship within one root. If a label in the shadow tree must describe a slotted Light DOM element, move the relationship into one tree (e.g. render the label in the Light DOM, or use `aria-label` text instead of an `id` reference).
- For element-to-element references that genuinely must cross roots, the emerging **Reference Target** mechanism is the standards direction, but it is not yet broadly available; design to keep references within a single tree today.
