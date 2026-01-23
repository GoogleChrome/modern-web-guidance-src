---
description: Use the CSS `if()` function to conditionally apply styles based on media queries, support queries, or element styles, enabling dynamic and responsive user interfaces.
filename: css-if-function-conditionals
category: ui
---

# CSS `if()` function for dynamic styling

Reference docs:
- [MDN Web Docs: CSS `if()` function](https://developer.mozilla.org/en-US/docs/Web/CSS/if())

## Best Practices

The CSS `if()` function allows for inline conditional styling, simplifying the management of dynamic styles that would otherwise require separate media queries or support rules. It can be used with `media()`, `supports()`, and `style()` queries.

### Inline Media Queries

Use `if()` to embed media query logic directly within your property declarations, making styles more concise and easier to manage.

```css
button {
  aspect-ratio: 1;
  width: if(media(any-pointer: fine): 30px; else: 44px);
}
```

This is equivalent to:

```css
button {
  aspect-ratio: 1;
  width: 44px;
}

@media (any-pointer: fine) {
  button {
    width: 30px;
  }
}
```

### Inline Support Queries

Conditionally apply styles based on browser support for specific features, such as advanced color spaces.

```css
body {
  background-color: if(
    supports(color: oklch(0.7 0.185 232)): oklch(0.7 0.185 232);
    else: #00adf3;
  );
}
```

This allows users with supporting browsers to experience richer styles, while others receive a fallback. Note that for such support queries to work, `if()` itself must be supported by the browser.

### Visualizing UI State with Style Queries

Leverage `if()` with `style()` queries to dynamically style elements based on their current state, such as `pending` or `complete`, often managed via custom properties or data attributes.

```html
<div class="card" data-status="complete">
  ...
</div>
```

```css
.card {
  --status: attr(data-status type(<custom-ident>));
  border-color: if(
                style(--status: pending): royalblue;
                style(--status: complete): seagreen;
                else: gray);
}
```

This approach allows for direct styling of the targeted element without the need for a parent element to initiate the query, as would be the case with standalone CSS style queries.

## Fallback Strategies

When using the `if()` function, the `else` keyword provides a built-in fallback mechanism. This is crucial for ensuring a graceful degradation of styles when the primary conditions are not met.

- **DO** always include an `else` clause in your `if()` function when a fallback value is necessary.
- **DO** ensure fallback values are sensible and maintain a usable experience for users in unsupported environments.
- **DO** consider using simpler, more widely supported CSS features as fallbacks.

The `if()` function simplifies the architecture of CSS by allowing developers to manage conditional logic directly within property declarations, leading to cleaner and more maintainable stylesheets. As features like style queries evolve, `if()` is expected to become even more powerful, potentially supporting range queries and integration with upcoming CSS function proposals.