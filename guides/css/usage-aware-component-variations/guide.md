---
name: usage-aware-component-variations
description: Build components that adapt visual logic based on semantic context using CSS container style queries.
web-feature-ids:
  - container-style-queries
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@container#container_style_queries
  - https://developer.chrome.com/docs/css-ui/style-queries
---

# Semantic Component Adaptation

Use style queries (`@container style()`) to trigger component variations based on inherited semantic context flags rather than viewport or container dimensions. This replaces deep descendant selectors (e.g., `.sidebar .card`) and improves component encapsulation.

In design systems, this lets a component respond to its surrounding context without that context needing to know the component exists. For example, a card placed inside a section marked `--surface: featured` can swap to a filled button and reveal a promotional badge — the section never names `.button` or `.badge`, and the card never inspects its parent.

## How is this different from design-token-reactivity?

[`design-token-reactivity`](../design-token-reactivity/guide.md) covers *token-level* changes: density modes, themes, and other higher-order tokens that uniformly shift values (paddings, colors) across many components.

This guide covers *behavioral* changes: a component deciding **what to render, how to arrange itself, or which variant to present** in response to its context. Hiding/showing a badge, switching layout direction, or swapping a button variant all fit here.

## Mental Model

- **Size Queries:** Use for layout/density changes (width/height).
- **Style Queries:** Use for semantic logic — what the component should *do* in this context.

## Implementation Directives

1. Define a semantic context flag using a CSS custom property on a container.
2. **DO NOT** set `container-type` for style queries; they query inherited custom properties on the nearest ancestor and don't require an explicit containment context.
3. **MANDATORY**: Use `@container style(--property: value)` to apply conditional styles to descendant elements. Style queries cannot match the element the property is set on — only its descendants.
4. **DO** prefer style queries over descendant selectors to avoid specificity inflation and hardcoded DOM dependencies.

## Implementation Example

```css
/* 1. Set the context on a layout container */
.featured {
  --surface: featured; /* Semantic context flag for children */
}

/* 2. Component reacts to inherited flag */
.button {
  /* Default: Outlined informational style */
  background: transparent;
  border: 1px solid currentColor;
}

.badge {
  /* Default: Hidden — only revealed in featured surfaces */
  display: none;
}

@container style(--surface: featured) {
  .button {
    /* Automatic switch to Filled promotional style */
    background: var(--brand-accent);
    color: white;
    border: none;
  }

  .badge {
    /* Reveal decorative elements only in featured context */
    display: block;
  }
}
```

## Fallback Strategies

{{ BASELINE_STATUS("container-style-queries") }}

Until container style queries are widely available, layer them on as a progressive enhancement: ship a selector-based default that works everywhere, and let the style query override it when supported. Use `:where()` on the context selector so the style query (same specificity, later in source order) wins automatically.

```css
/* Default styles — work everywhere */
.button {
  background: transparent;
  border: 1px solid currentColor;
}

.badge {
  display: none;
}

/* Selector-based contextual styles — broad browser support */
:where(.featured) .button {
  background: var(--brand-accent);
  color: white;
  border: none;
}

:where(.featured) .badge {
  display: block;
}

/* Progressive enhancement: style queries override when supported */
@container style(--surface: featured) {
  .button {
    background: var(--brand-accent);
    color: white;
    border: none;
  }

  .badge {
    display: block;
  }
}
```

The selector fallback ties the contextual styling to a class name, which couples the component to its DOM placement. Once style queries are widely supported, the `:where()` rule can be removed.
