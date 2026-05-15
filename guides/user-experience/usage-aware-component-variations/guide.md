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

In the context of design system components, style queries become invaluable in allowing styles to respond to their containers without the need for style-specific APIs that need to be pushed down to every descendant.

## Mental Model

- **Size Queries:** Use for layout/density changes (width/height).
- **Name-only Queries** Use for layout context (i.e., breadcrumbs).
- **Style Queries:** Use for semantic logic (themes, priority, variants).

## Implementation Directives

1. Define a semantic "context flag" using a CSS custom property on a container.
2. **DO NOT** use `container-type` for style queries; they work on any element that inherits the property.
3. **MANDATORY**: Use `@container style(--property: value)` to apply conditional styles to child elements.
4. **DO** prefer style queries over descendant selectors to avoid specificity inflation and hardcoded DOM dependencies.

## Implementation Example

```css
/* 1. Set the context on a layout container */
.promo {
  --priority: high; /* Semantic flag for children */
}

/* 2. Component reacts to inherited flag */
.button {
  /* Default: Outlined informational style */
  background: transparent;
  border: 1px solid currentColor;
}

@container style(--priority: high) {
  .button {
    /* Automatic switch to Filled promotional style */
    background: var(--brand-accent);
    color: white;
    border: none;
  }

  .badge {
    /* Reveal decorative elements only in high-priority context */
    display: block;
  }
}
```

## Fallback Strategies

{{ FEATURE_FALLBACKS("container-style-queries") }}

**MANDATORY**: Provide a safe default experience (progressive enhancement), and use a manual fallback if the context is critical.

```css
/* Fallback for browsers without style query support */
@supports not (container-type: inline-size) {
  section.promo .button {
    background: var(--brand-accent);
    color: white;
  }
}
```
