---
description: Learn how to semantically structure and creatively style HTML lists for better web accessibility and design.
filename: list-styling-and-semantics
category: ui
---

# Creative List Styling

This article explores how to semantically structure different types of HTML lists and provides creative styling techniques using CSS to enhance their visual appeal and usability.

## Best Practices

### Semantic HTML Lists

*   **Use `<ul>` for unordered lists:** When the order of items is not important (e.g., navigation menus, feature lists).
*   **Use `<ol>` for ordered lists:** When the order of items is crucial (e.g., instructions, rankings, multi-step processes).
*   **Use `<dl>` for description lists:** For pairing terms with their definitions or descriptions (e.g., glossaries, product specifications).
*   **Wrap list items correctly:** Ensure `<li>` elements are direct children of `<ul>` or `<ol>`, and `<dt>` and `<dd>` are direct children of `<dl>`.
*   **Consider accessibility:** Use ARIA attributes like `aria-label` for navigation menus and `aria-current` to indicate the active page.

### Styling Lists

*   **`::marker` pseudo-element:** Use for simple customizations of default list markers (bullets, numbers), such as changing color or using custom images.
*   **`::before` pseudo-element:** Offers more flexibility for complex custom markers, positioning, animations, and transitions, especially when `::marker` limitations are encountered.
*   **`list-style: none;`:** Remove default list styling when creating completely custom list designs (e.g., horizontal navigation). Be mindful of accessibility implications and consider adding `role="list"` for screen readers.
*   **CSS Counters:** Utilize `counter()` and `counter-increment` for custom numbering sequences and advanced ordered list styling.
*   **CSS Custom Properties:** Leverage custom properties (`--variable-name`) to create dynamic styling based on list item index or length, enabling effects like progress bars or color transitions.
*   **CSS Grid and Flexbox:** Employ these layout modules for arranging list items in custom patterns, such as grids or horizontal rows.
*   **`column-count` and `column-width`:** Use for multi-column list layouts, ensuring responsive design. Use `break-inside: avoid;` on list items to prevent content breaks across columns.

### List Attributes

*   **`reversed` attribute on `<ol>`:** Easily create lists that count down numerically.
*   **`start` attribute on `<ol>`:** Specify the starting number for an ordered list, useful for splitting lists into logical groups.

### Description List Styling

*   **Wrapper `<div>` within `<dl>`:** Group `<dt>` and `<dd>` pairs using `<div>` to facilitate card-like styling or other distinct visual groupings.
*   **Direct Grid/Flex Layout on `<dl>`:** Apply grid or flex properties directly to the `<dl>` element for layouts where terms and descriptions align across all items.

## Resources

*   [Learn CSS Lists](/learn/css/lists)
*   [Custom markers using ::marker](/articles/css-marker-pseudo-element)
*   [CSS Lists, Markers and Counters](https://www.smashingmagazine.com/2019/07/css-lists-markers-counters/)
*   [Lists and Safari Accessibility](https://www.scottohara.me/blog/2019/01/12/lists-and-safari.html)