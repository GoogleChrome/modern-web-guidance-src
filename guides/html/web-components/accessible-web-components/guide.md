---
name: accessible-web-components
description: Make custom elements accessible by default, setting roles and ARIA state via the ElementInternals ARIA mixin, managing focus with delegatesFocus, and keeping ARIA relationships within a single shadow root.
web-feature-ids:
  - aria-attribute-reflection
  - shadow-dom
---

# Accessible Web Components

A shadow boundary changes how semantics and ARIA work. Two failures dominate: missing semantics inside the shadow tree, and ARIA references that silently break because they cannot cross shadow roots.

Start from semantic markup: use real `<button>`, `<nav>`, `<ul>` inside the template so most semantics come for free, and reserve `ElementInternals`/ARIA for the gaps.

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

## Focus management and `delegatesFocus`

- Attach the shadow root with `delegatesFocus: true` when the component wraps focusable controls. Focusing the host then forwards focus to the first focusable child, and `:focus`/label clicks behave as users expect.
- For roving focus or moving focus into a newly revealed region, give the target `tabindex="-1"` and call `.focus()`; make programmatically-focusable targets explicit rather than relying on tab order.

## ARIA relationships across shadow roots

- **MANDATORY**: an `id` referenced by `aria-labelledby`, `aria-describedby`, `aria-controls`, etc. resolves only within the referencing element's **own** tree. An `id`-based attribute in the Light DOM cannot point at an `id` inside a shadow tree, and vice versa; the reference is silently ignored.
- To cross the boundary, use the reflected ARIA *element* properties (e.g. `ariaLabelledByElements`, `ariaDescribedByElements`, etc), which take direct JS element references instead of ids. They resolve **outward**: an element inside a shadow tree can point at a target in the Light DOM or any ancestor tree (including slotted content), so you can label a shadow-internal control from Light DOM content — something `id` references can't express.
- They do **not** resolve **inward**: an element can't reference *into* a descendant shadow tree (e.g. a host can't be labelled by its own shadow content). For that direction the emerging **Reference Target** mechanism is the standards direction, but it is not yet broadly available.
- When a relationship can't be expressed either way, keep it within one tree (render the label in the same tree) or use `aria-label` text instead of an `id` reference.

## Fallback strategies

{{ BASELINE_STATUS("aria-attribute-reflection") }}

Where the `ElementInternals` ARIA mixin is unavailable, set the role and ARIA state as attributes on the host instead (`this.setAttribute('role', 'switch')`). It works everywhere, at the cost of putting attributes in the DOM that a consumer could override.

{{ BASELINE_STATUS("aria-attribute-reflection", "api.Element.ariaLabelledByElements") }}

Where the reflected ARIA *element* properties are unavailable, use an `id`-based `aria-*` attribute for same-tree relationships; a cross-boundary label has no `id`-based equivalent, so fall back to `aria-label` text.
