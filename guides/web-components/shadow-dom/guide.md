---
name: shadow-dom
description: Encapsulate a component's DOM and styles with Shadow DOM, construct the tree efficiently with HTML templates, and project consumer content with slots.
web-feature-ids:
  - shadow-dom
  - slot
---

# Shadow DOM, Templates & Slots

A shadow root is an encapsulated DOM subtree attached to a host element. Styles defined inside it do not leak out, and page styles do not leak in (apart from a few inherited exceptions, covered in the styling guide). Templates construct the tree efficiently and slots project consumer content into it; the three are one mental model, documented together here.

## Attaching a shadow root

```javascript
this.attachShadow({ mode: 'open', delegatesFocus: true });
```

- Prefer `mode: 'open'` so dev tools and `element.shadowRoot` can inspect the tree. Use `'closed'` only when you must hide the internal structure from page scripts.
- `delegatesFocus: true` makes focusing the host move focus to the first focusable element inside the shadow tree, and routes `:focus` styling to the host. Set it whenever the component wraps focusable controls; it is essential for label-click and keyboard accessibility.

{{ BASELINE_STATUS("shadow-dom") }}

## Templates: construct the tree efficiently

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

Keep templates lean. Deeply nested "div soup" and many levels of nested shadow roots both add measurable style-resolution and layout cost, a major performance hit at scale. Prefer a flat structure and semantic elements.

## Slots: project Light DOM content

A `<slot>` is a placeholder in the shadow tree that displays Light DOM children of the host. The unnamed `<slot>` is the **default** slot; any child not assigned to a named slot lands there (including whitespace text nodes). Named slots receive children carrying a matching `slot="name"` attribute.

```html
<my-card>
  <h2 slot="header">Title</h2>
  <p>Body content goes to the default slot.</p>
  <small slot="footer">Footer</small>
</my-card>
```

- **MANDATORY**: use semantic elements inside the template. Most accessibility failures in shadow trees come from non-semantic markup; a slot does not change the role of what it projects.
- **DOM order is preserved, not slot order**: projected nodes keep their original Light DOM order for `:first-child`/`:last-child` purposes, regardless of which slot they fill. A `::slotted(*:first-child)` rule targets the first *DOM* child, not the first child of that slot, so it often will not match what you expect.

React to content changes with the `slotchange` event, which fires when the set of assigned nodes changes (including on initial assignment):

```javascript
this.shadowRoot.querySelector('slot[name="header"]')
  .addEventListener('slotchange', (e) => {
    const nodes = e.target.assignedElements();
    this.toggleAttribute('has-header', nodes.length > 0);
  });
```

`slotchange` is also the reliable signal that Light DOM children have arrived after an upgrade, when they may not have existed during `connectedCallback`.

## Loading stylesheets into a shadow root

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
    // The same sheet object is reused by every instance; no per-instance parse.
    this.shadowRoot.adoptedStyleSheets = [sheet];
  }
}
```
