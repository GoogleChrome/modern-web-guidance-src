---
name: declarative-shadow-dom
description: Server-render a custom element's shadow tree as plain HTML with Declarative Shadow DOM, then hydrate it in place without re-rendering or a flash of unstyled content.
web-feature-ids:
  - declarative-shadow-dom
---

# Declarative Shadow DOM

Declarative Shadow DOM (DSD) lets the server send a shadow tree as plain HTML, so the component is styled and structured *before* any JavaScript runs. This is a different task from runtime composition: the markup arrives complete, and the element is later upgraded ("hydrated") by its class if one is registered. Use DSD for server-side rendering, streaming, and avoiding a flash of unstyled content (FOUC).

## Authoring a declarative shadow root

Nest a `<template>` with the `shadowrootmode` attribute as the first child of the host. The parser attaches its content as a shadow root and removes the template; no script needed.

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

## Hydration timing

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
    // and do NOT re-render; that would discard the server's DOM and flash.
  }
}
```

Set `shadowrootmode="open"` (not `closed`) for almost all cases, so scripts and tools can reach `this.shadowRoot` to hydrate. To serialize an existing shadow root back to HTML on the server or in tests, use `getHTML({ serializableShadowRoots: true })` and attach the root with `serializable: true`.

## Avoiding FOUC

DSD renders correctly on first paint only if styles ship inside the declarative template. To preserve that:

- Put component CSS **inside** the `<template shadowrootmode>` (a `<style>` tag or a `<link>`), not in a separate script-loaded sheet.
- Pair with `my-card:not(:defined) { … }` only for styles that must wait for JS; the structural styles should already be in the shadow root and need no such guard.
- Do not re-render the shadow tree on hydration. Treat the server markup as authoritative and attach behavior to it.
