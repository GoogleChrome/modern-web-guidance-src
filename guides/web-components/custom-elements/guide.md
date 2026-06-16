---
name: custom-elements
description: Define, register, and manage the lifecycle of autonomous custom elements, covering constructor rules, lifecycle callbacks, upgrade timing, attribute/property reflection, and naming conventions.
web-feature-ids:
  - autonomous-custom-elements
  - customized-built-in-elements
---

# Custom Elements

A custom element is a class registered against a tag name via `customElements.define()`. Registration and basic lifecycle are well understood by most tools; what follows leads with the parts routinely gotten wrong.

## Registration and base class

- **MANDATORY**: The tag name must be kebab-case with at least one hyphen (e.g. `my-element`). This is what distinguishes custom elements from current and future built-ins.
- Extend the base `HTMLElement` class. Avoid *customized built-in elements* (`extends HTMLButtonElement` with `is="…"`); Safari has permanently declined to ship them.

```javascript
class MyElement extends HTMLElement {
  constructor() {
    super(); // ✅ MANDATORY: call super() first, before touching `this`.
    this.attachShadow({ mode: 'open' });
  }
  connectedCallback() {
    this.render();
  }
}
customElements.define('my-element', MyElement);
```

{{ BASELINE_STATUS("customized-built-in-elements") }}

## Lifecycle: do the right work in the right callback

| Callback | Use for | Avoid |
| :--- | :--- | :--- |
| `constructor` | Attaching the shadow root, initializing internal state. | DOM reads/writes, reading attributes or children (the element may not be in the document yet). |
| `connectedCallback` | Setup that needs the DOM: rendering, adding listeners, reading attributes. May run more than once if the element is moved. | Assuming it runs only once; assuming all Light DOM children are present (see upgrade timing below). |
| `disconnectedCallback` | Tearing down global listeners, timers, and observers to prevent leaks. | Assuming the element is gone for good (it may be re-inserted). |
| `attributeChangedCallback(name, old, new)` | Reacting to changes of attributes named in `observedAttributes`. | Heavy work for attributes that don't affect output. |

The constructor **MANDATORY** rule is strict: calling `super()` after any statement that touches `this` throws. Initialize nothing before it.

## Upgrade timing and `:defined`

An element can exist in the DOM *before* its class is registered (in server-rendered HTML, or when the script loads late). Until defined it is an inert `HTMLElement` with none of your behavior; when `customElements.define()` runs, the browser **upgrades** every matching element already in the document, running its constructor and `connectedCallback` then.

Two consequences models routinely miss:

1. **Attributes and children may already be present** when your constructor/`connectedCallback` runs on upgrade. Read existing attributes in `connectedCallback` to sync initial state, and never assume the element started empty.
2. **Children may still be missing** even in `connectedCallback` if the HTML parser hasn't reached them yet. If you depend on Light DOM children, wait for them: use a `slotchange` listener, or defer with `customElements.whenDefined()`.

Style undefined elements out of view to avoid a flash of unstyled content:

```css
/* Hide the element until its definition has upgraded it. */
my-element:not(:defined) { visibility: hidden; }
```

```javascript
await customElements.whenDefined('my-element'); // resolves once registered
```

## Attribute ⇄ property reflection

Keep the HTML attribute and the JS property in sync so the element is usable from both markup and script. Attribute values are **always strings**; coerce them.

```javascript
class MyToggle extends HTMLElement {
  static observedAttributes = ['label', 'disabled'];

  // String attribute reflected via getter/setter.
  get label() { return this.getAttribute('label') ?? ''; }
  set label(v) {
    v ? this.setAttribute('label', v) : this.removeAttribute('label');
  }

  // Boolean attribute: present = true, absent = false. Never set it to "false".
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(on) { this.toggleAttribute('disabled', !!on); }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal !== newVal) this.render();
  }
}
```

Pitfalls:

- **`observedAttributes` discipline**: list only attributes whose change must re-render or trigger a side effect. Observing everything adds a callback to every mutation for no benefit.
- **Reflection loops**: a setter that writes an attribute will re-enter `attributeChangedCallback`. Guard with an `oldVal !== newVal` check, as above.
- **Style-only state**: you may reflect a property to an attribute purely for CSS targeting (`:host([loading])`) *without* observing it, as long as the component is the sole writer of that attribute.

## Naming conventions

- Public properties and methods: `camelCase`, matching DOM conventions (`this.userName`, `this.refresh()`).
- True-private state: native `#` fields (`#count`) for hard encapsulation; a `_` prefix only when subclasses must still reach it.
- Do **not** shadow global attributes (`style`, `class`, `id`, `slot`, `part`, `title`, `lang`, `dir`) with your own properties; doing so breaks their built-in behavior. Note `disabled` is only global on form controls; on other elements you must implement its effect yourself.
