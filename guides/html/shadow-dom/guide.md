---
name: shadow-dom
description: Encapsulate a component's DOM and styles with Shadow DOM, construct the tree efficiently with HTML templates, and project consumer content with slots.
web-feature-ids:
  - shadow-dom
  - slot
---

# Shadow DOM, Templates & Slots

A shadow root is an encapsulated DOM subtree attached to a host element: styles inside it do not leak out, and page styles do not leak in (except inherited properties). Templates construct the tree efficiently; slots project Light DOM content into it.

## Attaching a shadow root

```javascript
this.attachShadow({ mode: 'open', delegatesFocus: true });
```

`delegatesFocus: true` makes focusing the host move focus to the first focusable element inside the shadow tree, and routes `:focus` styling to the host. Set it whenever the component wraps focusable controls; it is required for label-click and keyboard accessibility. (Use `mode: 'open'` in almost all cases — see the cross-cutting rules in {{ GUIDE_REF("web-components") }}.)

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

## Slots: the parts that surprise people

Default vs. named slots work as documented; these are the behaviors that bite:

- **Whitespace counts.** Text nodes between elements (including pure whitespace) are assigned to the default slot, so a default slot is rarely truly "empty."
- **DOM order is preserved, not slot order.** Projected nodes keep their original Light DOM order for `:first-child`/`:last-child` purposes, regardless of which slot they fill. A `::slotted(*:first-child)` rule targets the first *DOM* child, not the first child of that slot, so it often will not match what you expect.
- **`slotchange` is the upgrade-timing signal.** It fires when assigned nodes change (including initial assignment) and is the reliable way to know Light DOM children have arrived after an upgrade, when they may not have existed during `connectedCallback`.

```javascript
this.shadowRoot.querySelector('slot[name="header"]')
  .addEventListener('slotchange', (e) => {
    const nodes = e.target.assignedElements();
    this.toggleAttribute('has-header', nodes.length > 0);
  });
```

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

