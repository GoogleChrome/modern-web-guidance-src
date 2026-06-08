---
name: web-components
description: Action-oriented guidelines for authoring and using Web Components. Covers Custom Elements, Shadow DOM, templates and slots, Declarative Shadow DOM, styling across the shadow boundary, Form-Associated Custom Elements, and accessibility. Use this skill when building reusable UI components, design systems, or server-rendered custom elements.
---

# Web Components

Web Components are a collection of specifications — Custom Elements, Shadow DOM, and HTML Templates — for building reusable, framework-agnostic custom elements whose markup and styles can be encapsulated from the rest of the document. They are the platform primitive behind design systems, embeddable widgets, and self-contained UI.

Each section below is self-contained: it opens with enough context to be read in isolation and restates any cross-cutting fact it depends on, rather than referring you elsewhere.

## Table of Contents

- [Glossary](#glossary) and [Decision matrix](#decision-matrix) — shared reference
- [Custom Elements](#custom-elements) — defining elements, lifecycle, reflection, upgrade timing
- [Shadow DOM, Templates & Slots](#shadow-dom-templates--slots) — encapsulation, composition, stylesheets
- [Declarative Shadow DOM](#declarative-shadow-dom) — server-rendered shadow roots and hydration
- [Styling](#styling) — crossing the shadow boundary
- [Form-Associated Custom Elements](#form-associated-custom-elements) — native form participation
- [Accessibility](#accessibility) — semantics, focus, and ARIA across shadow roots

The retrieval CLI routes by semantic search, so this list is a quick orientation, not a router — there is intentionally no deep cross-linked index.

## Glossary

| Term | Definition |
| :--- | :--- |
| **Custom Element** | A user-defined HTML tag registered via `customElements.define()`. |
| **Autonomous Custom Element** | A custom element extending the base `HTMLElement` class (e.g. `<my-card>`). |
| **Customized Built-in Element** | A custom element extending a specific native element (e.g. `<button is="my-button">`). Not recommended for production — Safari has declined to implement them. |
| **Shadow DOM** | An encapsulated DOM subtree attached to an element, isolated from the main document's styles and markup. |
| **Shadow Root** | The root node of a Shadow DOM subtree. |
| **Shadow Host** | The regular DOM node a shadow root is attached to. |
| **Light DOM** | The regular DOM inside an element that is *not* part of its shadow tree. Slotted content lives here. |
| **Slot** | A placeholder (`<slot>`) inside a shadow tree that projects Light DOM content into the component. |
| **HTML Template** | The `<template>` element — inert markup that is parsed but not rendered, cloned for reuse. |
| **ElementInternals** | The object returned by `this.attachInternals()`, exposing form participation, validity, and ARIA semantics to a custom element. |
| **Observed Attributes** | The static list of attribute names that trigger `attributeChangedCallback` when changed. |

## Decision matrix

| If you need to… | Use… | Reasoning |
| :--- | :--- | :--- |
| Create a new semantic tag (e.g. `<user-profile>`) | **Custom Elements** | Defines behavior and lifecycle. |
| Scope styles to the component, preventing CSS leakage | **Shadow DOM** | Strict style and DOM isolation. |
| Inject consumer content into specific regions of a component | **Slots** | Composition without breaking encapsulation. |
| Render a custom element's shadow tree on the server | **Declarative Shadow DOM** | Markup is visible before JS runs; no FOUC. |
| Submit a value to a surrounding `<form>` | **Form-Associated Custom Elements** | Native participation without hidden inputs. |
| Inherit the host page's global CSS and theme | **Custom Element with no shadow root** | Light DOM inherits global styles directly. |

## Custom Elements

A custom element is a class registered against a tag name. The registration and basic lifecycle are well understood by most tools; what follows leads with the parts that are routinely gotten wrong.

### Decide whether you even need one

Reach for a custom element only when you need encapsulated behavior, lifecycle, or a reusable JS-backed API on a tag. Do **not** build one when:

- A plain HTML element with CSS would do. A styled `<button>` or `<details>` is more accessible and cheaper than a re-implementation.
- The thing is purely presentational with no behavior. A class on a native element is more performant and can be scoped using @layers or @scope.
- You only need style scoping on the server with no interactivity — a scoped stylesheet or [Declarative Shadow DOM](#declarative-shadow-dom) without an upgrade may be enough.

Rebuilding native semantics (a custom `<my-button>` that re-creates focus, activation, and ARIA) is the most common misuse: you inherit the maintenance cost of the platform's accessibility for free only if you reuse the native element.

### Registration and base class

- **MANDATORY**: The tag name must be kebab-case with at least one hyphen (e.g. `my-element`). This is what distinguishes custom elements from current and future built-ins.
- Extend the base `HTMLElement` class. Avoid *customized built-in elements* (`extends HTMLButtonElement` with `is="…"`) — Safari has permanently declined to ship them.

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

### Lifecycle: do the right work in the right callback

| Callback | Use for | Avoid |
| :--- | :--- | :--- |
| `constructor` | Attaching the shadow root, initializing internal state. | DOM reads/writes, reading attributes or children — the element may not be in the document yet. |
| `connectedCallback` | Setup that needs the DOM: rendering, adding listeners, reading attributes. May run more than once if the element is moved. | Assuming it runs only once; assuming all Light DOM children are present (see upgrade timing below). |
| `disconnectedCallback` | Tearing down global listeners, timers, and observers to prevent leaks. | Assuming the element is gone for good — it may be re-inserted. |
| `attributeChangedCallback(name, old, new)` | Reacting to changes of attributes named in `observedAttributes`. | Heavy work for attributes that don't affect output. |

The constructor **MANDATORY** rule is strict: calling `super()` after any statement that touches `this` throws. Initialize nothing before it.

### Upgrade timing and `:defined`

An element can exist in the DOM *before* its class is registered — for example, in server-rendered HTML or when the script loads late. While undefined it is an inert `HTMLUnknownElement`-like node; when `customElements.define()` runs, the browser **upgrades** every matching element already in the document, running its constructor and `connectedCallback` then.

Two consequences models routinely miss:

1. **Attributes and children may already be present** when your constructor/`connectedCallback` runs on upgrade. Read existing attributes in `connectedCallback` to sync initial state, and never assume the element started empty.
2. **Children may still be missing** even in `connectedCallback` if the HTML parser hasn't reached them yet. If you depend on Light DOM children, wait for them — use a `slotchange` listener (see [Shadow DOM, Templates & Slots](#shadow-dom-templates--slots)) or defer with `customElements.whenDefined()`.

Style undefined elements out of view to avoid a flash of unstyled content:

```css
/* Hide the element until its definition has upgraded it. */
my-element:not(:defined) { visibility: hidden; }
```

```javascript
await customElements.whenDefined('my-element'); // resolves once registered
```

### Attribute ⇄ property reflection

Keep the HTML attribute and the JS property in sync so the element is usable from both markup and script. Attribute values are **always strings** — coerce them.

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

### Naming conventions

- Public properties and methods: `camelCase`, matching DOM conventions (`this.userName`, `this.refresh()`).
- True-private state: native `#` fields (`#count`) for hard encapsulation; a `_` prefix only when subclasses must still reach it.
- Do **not** shadow global attributes (`style`, `class`, `id`, `slot`, `part`, `title`, `lang`, `dir`) with your own properties — you will break their built-in behavior. Note `disabled` is only global on form controls; on other elements you must implement its effect yourself.

## Shadow DOM, Templates & Slots

A shadow root is an encapsulated DOM subtree attached to a host element. Styles defined inside it do not leak out, and page styles do not leak in (with a few inherited exceptions, covered in [Styling](#styling)). Templates are the efficient construction mechanism for a shadow tree, and slots are how consumer content is projected into it — the three are one mental model and are documented together here.

### Attaching a shadow root

```javascript
this.attachShadow({ mode: 'open', delegatesFocus: true });
```

- Prefer `mode: 'open'` so dev tools and `element.shadowRoot` can inspect the tree. Use `'closed'` only when you must hide the internal structure from page scripts.
- `delegatesFocus: true` makes focusing the host move focus to the first focusable element inside the shadow tree, and routes `:focus` styling to the host. Set it whenever the component wraps focusable controls — it is essential for label-click and keyboard accessibility.

{{ BASELINE_STATUS("shadow-dom") }}

### Templates: construct the tree efficiently

Define a `<template>` **once** (module scope or a static field) and clone it per instance. Cloning a parsed fragment is far faster than re-parsing an `innerHTML` string on every construction.

```javascript
const template = document.createElement('template');
template.innerHTML = `
  <div class="card">
    <slot name="header"></slot>
    <div class="body"><slot></slot></div>
    <slot name="footer"></slot>
  </div>
`;

class MyCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    // MANDATORY: deep-clone the template content so each instance gets its own nodes.
    this.shadowRoot.append(template.content.cloneNode(true));
  }
}
customElements.define('my-card', MyCard);
```

Keep templates lean — deeply nested "div soup" and many levels of nested shadow roots both add measurable style-resolution and layout cost; this can lead to a major performance hit at scale. Prefer a flat structure and semantic elements.

### Slots: project Light DOM content

A `<slot>` is a placeholder in the shadow tree that displays Light DOM children of the host. The unnamed `<slot>` is the **default** slot — any child not assigned to a named slot lands there (including whitespace text nodes). Named slots receive children carrying a matching `slot="name"` attribute.

```html
<my-card>
  <h2 slot="header">Title</h2>
  <p>Body content goes to the default slot.</p>
  <small slot="footer">Footer</small>
</my-card>
```

- **MANDATORY**: use semantic elements inside the template. Most accessibility failures in shadow trees come from non-semantic markup; a slot does not change the role of what it projects.
- **DOM order is preserved, not slot order**: projected nodes keep their original Light DOM order for `:first-child`/`:last-child` purposes, regardless of which slot they fill. A `::slotted(*:first-child)` rule targets the first *DOM* child, not the first child of that slot — so it often will not match what you expect.

React to content changes with the `slotchange` event, which fires when the set of assigned nodes changes (including on initial assignment):

```javascript
this.shadowRoot.querySelector('slot[name="header"]')
  .addEventListener('slotchange', (e) => {
    const nodes = e.target.assignedElements();
    this.toggleAttribute('has-header', nodes.length > 0);
  });
```

`slotchange` is also the reliable signal that Light DOM children have arrived after an upgrade, when they may not have existed during `connectedCallback`.

### Loading stylesheets into a shadow root

| Method | Pros | Cons |
| :--- | :--- | :--- |
| `<style>` in the template | Simple, fully encapsulated, works without JS. | Duplicated per instance; bloats the DOM at scale. |
| `<link rel="stylesheet">` | Cacheable external file. | Extra request; risks a flash of unstyled content. |
| `adoptedStyleSheets` | One shared `CSSStyleSheet` across all instances; fastest at scale. | Requires JS; constructed sheets don't support `@import`. |

For many instances of one component, prefer a shared constructed stylesheet:

```javascript
const sheet = new CSSStyleSheet();
sheet.replaceSync(`:host { display: block; }`);

class MyCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    // The same sheet object is reused by every instance — no per-instance parse.
    this.shadowRoot.adoptedStyleSheets = [sheet];
  }
}
```

## Declarative Shadow DOM

Declarative Shadow DOM (DSD) lets the server send a shadow tree as plain HTML, so the component is styled and structured *before* any JavaScript runs. This is a different task from runtime composition: the markup arrives complete, and the element is later upgraded ("hydrated") by its class if one is registered. Use DSD for server-side rendering, streaming, and avoiding a flash of unstyled content (FOUC).

### Authoring a declarative shadow root

Nest a `<template>` with the `shadowrootmode` attribute as the first child of the host. The parser attaches its content as a shadow root and removes the template — no script needed.

```html
<my-card>
  <template shadowrootmode="open">
    <style>
      .card { border: 1px solid; border-radius: 8px; padding: 1rem; }
    </style>
    <div class="card">
      <slot name="header"></slot>
      <div class="body"><slot></slot></div>
    </div>
  </template>

  <!-- Light DOM children are projected into the slots above. -->
  <h2 slot="header">Server-rendered title</h2>
  <p>Visible and styled before JS loads.</p>
</my-card>
```

{{ BASELINE_STATUS("declarative-shadow-dom") }}

### Hydration timing

When the matching class is registered, the browser upgrades the host. Because the shadow root **already exists**, the constructor must not blindly create a second one:

```javascript
class MyCard extends HTMLElement {
  constructor() {
    super();
    // Reuse the server-rendered shadow root if present; only create one if absent.
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.append(template.content.cloneNode(true));
    }
    // Otherwise hydrate in place: wire up listeners against existing markup,
    // and do NOT re-render — that would discard the server's DOM and flash.
  }
}
```

Set `shadowrootmode="open"` (not `closed`) for almost all cases, so scripts and tools can reach `this.shadowRoot` to hydrate. To serialize an existing shadow root back to HTML on the server or in tests, use `getHTML({ serializableShadowRoots: true })` and attach the root with `serializable: true`.

### Avoiding FOUC

The whole point of DSD is that styles ship inside the declarative template, so the component renders correctly on first paint. To keep that guarantee:

- Put component CSS **inside** the `<template shadowrootmode>` (a `<style>` tag or a `<link>`), not in a separate script-loaded sheet.
- Pair with `my-card:not(:defined) { … }` only for styles that must wait for JS; the structural styles should already be in the shadow root and need no such guard.
- Do not re-render the shadow tree on hydration. Treat the server markup as authoritative and attach behavior to it.

## Styling

Shadow DOM is a style boundary: page rules don't reach in and component rules don't leak out — except for **inherited** properties. This section covers every selector and channel for styling across that boundary.

### `:host`, `:host()`, `:host-context()`

```css
/* The component's own host element, styled from inside its shadow tree. */
:host { display: block; }

/* Only when the host matches a selector — e.g. a reflected state attribute. */
:host([disabled]) { opacity: 0.5; pointer-events: none; }

/* Based on an ancestor in the Light DOM — useful for theming. */
:host-context([theme="dark"]) { background: #111; color: #eee; }
```

`:host-context()` reaches *outside* the boundary to test ancestors, which makes it powerful for theming but has weaker support — gate any reliance on it and prefer an inherited CSS custom property (below) where possible.

{{ BASELINE_STATUS("host-context") }}

### Inherited properties and custom properties cross the boundary

Inherited CSS properties (`color`, `font-family`, `line-height`, and CSS custom properties) **do** pass through the shadow boundary. This makes custom properties the primary theming API: expose them with sensible fallbacks.

```css
:host {
  /* Consumers override --card-bg from outside; the fallback keeps it usable. */
  background: var(--card-bg, white);
  color: var(--card-fg, black);
}
```

A custom property *defined* on `:host` can only be overridden by rules targeting the host element specifically. To let it inherit and be overridable from anywhere up the tree, leave it unset on `:host` and rely on the fallback in each `var()` — do not seed it with a value on `:host`.

### `::slotted()` — styling projected Light DOM

`::slotted(selector)` targets the **top-level** nodes assigned to a slot. It cannot reach their descendants, and it loses to any Light DOM rule (the consumer owns their own content), so use it for light touch-ups, not control.

```css
/* Matches a slotted <p>, but NOT a <p> nested inside a slotted <div>. */
::slotted(p) { margin: 0; }
```

### `::part()` and `exportparts` — expose internals for theming

Mark an internal element with `part="name"` to let consumers style it with any property, without learning your internal structure.

```html
<!-- inside the shadow template -->
<button part="submit">Submit</button>
```

```css
/* consumer stylesheet */
my-card::part(submit) { background: navy; color: white; }
```

Expose a few **high-level** parts (button, input, label), not every `<div>` — broad part surfaces become a brittle API. To re-expose a nested component's parts upward through your own component, forward them with `exportparts`:

```html
<inner-widget exportparts="submit: card-submit"></inner-widget>
```

Choose between the two channels deliberately: **custom properties** for a constrained, design-system-safe set of values; **parts** for unrestricted styling of a specific element.

{{ BASELINE_STATUS("shadow-parts") }}

### `@layer` and container queries inside components

- **Cascade layers** (`@layer`) work inside a shadow root and are scoped to it — a layer name in the shadow tree is independent of a same-named layer in the page. Use them to order your own component styles (e.g. `@layer base, theme;`) so consumer overrides via custom properties and `::part` still win predictably.
- **Container queries** are the right tool for responsive components: a component should respond to the space it's given, not the viewport. Declare the host or a wrapper as a container and query it, so the same component adapts in a sidebar or a full-width region.

```css
:host { container-type: inline-size; }

@container (min-width: 30rem) {
  .card { grid-template-columns: 1fr 2fr; }
}
```

{{ BASELINE_STATUS("cascade-layers") }}

{{ BASELINE_STATUS("container-queries") }}

## Form-Associated Custom Elements

Models routinely fall back to a hidden `<input>` to get a custom control's value into a form. The platform solution is **Form-Associated Custom Elements** (FACE): with `formAssociated` and `ElementInternals`, a custom element submits its own value, participates in validation, and reflects form state natively.

```javascript
class RatingInput extends HTMLElement {
  // MANDATORY: opt in. Without this, attachInternals() form APIs are unavailable.
  static formAssociated = true;

  #internals;
  #value = '';

  constructor() {
    super();
    this.#internals = this.attachInternals();
    this.attachShadow({ mode: 'open' });
  }

  get value() { return this.#value; }
  set value(v) {
    this.#value = v;
    // Push the value into the owning <form> for submission.
    this.#internals.setFormValue(v);
    this.#validate();
  }

  #validate() {
    if (this.hasAttribute('required') && !this.#value) {
      // Mark invalid and supply the native validation message + anchor.
      this.#internals.setValidity(
        { valueMissing: true },
        'Please choose a rating.',
        this.shadowRoot.querySelector('[tabindex]'),
      );
    } else {
      this.#internals.setValidity({}); // clear
    }
  }

  // Optional FACE lifecycle hooks:
  formResetCallback() { this.value = ''; }
  formDisabledCallback(disabled) { this.toggleAttribute('disabled', disabled); }
  formStateRestoreCallback(state) { this.value = state; }
}
customElements.define('rating-input', RatingInput);
```

Key points:

- `static formAssociated = true` is **MANDATORY** — it unlocks the form-related `ElementInternals` methods and the `formXxxCallback` lifecycle.
- `setFormValue(value)` is what submits — no hidden input required. Pass a `FormData` for multi-value controls.
- `setValidity(flags, message, anchor)` integrates with native constraint validation: the form won't submit while invalid, `:invalid`/`:valid` apply, and the anchor element receives focus on report. Call `setValidity({})` to clear.
- Implement `formResetCallback`, `formDisabledCallback`, and `formStateRestoreCallback` so the element behaves like a native control on reset, `fieldset[disabled]`, and back/forward autofill restore.

{{ BASELINE_STATUS("form-associated-custom-elements") }}

## Accessibility

A shadow boundary changes how semantics and ARIA work. The two failures that dominate: missing semantics inside the shadow tree, and ARIA references that silently break because they cannot cross shadow roots. This section is about making custom elements accessible by default.

### Default semantics via the ElementInternals ARIA mixin

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

### Focus management and `delegatesFocus`

- Attach the shadow root with `delegatesFocus: true` when the component wraps focusable controls. Focusing the host then forwards focus to the first focusable child, and `:focus`/label clicks behave as users expect.
- For roving focus or moving focus into a newly revealed region, give the target `tabindex="-1"` and call `.focus()` — make programmatically-focusable targets explicit rather than relying on tab order.

### ARIA relationships cannot cross shadow roots

- **MANDATORY**: an `id` referenced by `aria-labelledby`, `aria-describedby`, `aria-controls`, etc. must live in the **same** tree as the referencing element. An attribute in the Light DOM cannot point at an `id` inside the shadow tree, and vice versa — the reference is silently ignored.
- Keep each ARIA relationship within one root. If a label in the shadow tree must describe a slotted Light DOM element, move the relationship into one tree (e.g. render the label in the Light DOM, or use `aria-label` text instead of an `id` reference).
- For element-to-element references that genuinely must cross roots, the emerging **Reference Target** mechanism is the standards direction, but it is not yet broadly available — design to keep references within a single tree today.

Pair these with the semantic-markup rule from [Shadow DOM, Templates & Slots](#shadow-dom-templates--slots): use real `<button>`, `<nav>`, `<ul>` inside the template so most semantics come for free, and reserve `ElementInternals`/ARIA for the gaps.
