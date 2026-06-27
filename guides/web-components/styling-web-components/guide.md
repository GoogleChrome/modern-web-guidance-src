---
name: styling-web-components
description: Style across the shadow boundary with :host selectors, inherited and custom properties for theming, ::slotted and ::part, and cascade layers and container queries inside components.
web-feature-ids:
  - shadow-parts
  - host-context
  - cascade-layers
  - container-queries
---

# Styling Web Components

Shadow DOM is a style boundary: page rules don't reach in and component rules don't leak out, except **inherited** properties (including custom properties). Cross it deliberately through the channels below.

## `:host`, `:host()`, `:host-context()`

```css
/* The component's own host element, styled from inside its shadow tree. */
:host { display: block; }

/* Only when the host matches a selector (e.g. a reflected state attribute). */
:host([disabled]) { opacity: 0.5; pointer-events: none; }

/* Based on an ancestor in the Light DOM; useful for theming. */
:host-context([theme="dark"]) { background: #111; color: #eee; }
```

`:host-context()` reaches *outside* the boundary to test ancestors, which makes it powerful for theming but has weaker support; gate any reliance on it and prefer an inherited CSS custom property (below) where possible.

{{ BASELINE_STATUS("host-context") }}

## Inherited properties and custom properties cross the boundary

Inherited CSS properties (`color`, `font-family`, `line-height`, and CSS custom properties) **do** pass through the shadow boundary. This makes custom properties the primary theming API: expose them with sensible fallbacks.

```css
:host {
  /* Consumers override --card-bg from outside; the fallback keeps it usable. */
  background: var(--card-bg, white);
  color: var(--card-fg, black);
}
```

A custom property *defined* on `:host` can only be overridden by rules targeting the host element specifically. To let it inherit and be overridable from anywhere up the tree, leave it unset on `:host` and rely on the fallback in each `var()`; do not seed it with a value on `:host`.

## `::slotted()`: styling projected Light DOM

`::slotted(selector)` targets the **top-level** nodes assigned to a slot. It cannot reach their descendants, and it loses to any Light DOM rule (the consumer owns their own content), so use it for light touch-ups, not control.

```css
/* Matches a slotted <p>, but NOT a <p> nested inside a slotted <div>. */
::slotted(p) { margin: 0; }
```

## `::part()` and `exportparts`: expose internals for theming

Mark an internal element with `part="name"` to let consumers style it with any property, without learning your internal structure.

```html
<!-- inside the shadow template -->
<button part="submit">Submit</button>
```

```css
/* consumer stylesheet */
my-card::part(submit) { background: navy; color: white; }
```

Expose a few **high-level** parts (button, input, label), not every `<div>`; broad part surfaces become a brittle API. To re-expose a nested component's parts upward through your own component, forward them with `exportparts`:

```html
<inner-widget exportparts="submit: card-submit"></inner-widget>
```

Choose between the two channels deliberately: **custom properties** for a constrained, design-system-safe set of values; **parts** for unrestricted styling of a specific element.

{{ BASELINE_STATUS("shadow-parts") }}

## `@layer` and container queries inside components

- **Cascade layers** (`@layer`) work inside a shadow root and are scoped to it; a layer name in the shadow tree is independent of a same-named layer in the page. Use them to order your own component styles (e.g. `@layer base, theme;`) so consumer overrides via custom properties and `::part` still win predictably.
- **Container queries** are the right tool for responsive components: a component should respond to the space it's given, not the viewport. Declare the host or a wrapper as a container and query it, so the same component adapts in a sidebar or a full-width region.

```css
:host { container-type: inline-size; }

@container (min-width: 30rem) {
  .card { grid-template-columns: 1fr 2fr; }
}
```

{{ BASELINE_STATUS("cascade-layers") }}

{{ BASELINE_STATUS("container-queries") }}
