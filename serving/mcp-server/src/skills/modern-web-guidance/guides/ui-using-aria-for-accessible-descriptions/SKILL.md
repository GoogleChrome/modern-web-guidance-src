---
description: Use ARIA attributes like aria-label, aria-labelledby, and aria-describedby to enhance the accessibility of web elements for users of assistive technologies.
filename: using-aria-for-accessible-descriptions
category: ui
---

# ARIA Labels and Relationships

When creating accessible web experiences, it's crucial to provide clear and understandable descriptions for interactive elements, especially for users who rely on assistive technologies. ARIA (Accessible Rich Internet Applications) provides several attributes to achieve this, ensuring that the purpose and state of elements are conveyed effectively.

## Best Practices for ARIA Labeling and Descriptions

### `aria-label`

Use `aria-label` to provide a direct string label for an element when a visible label is not present or when you need to override existing labeling mechanisms. This is particularly useful for icon-only buttons or other graphical controls where visual cues alone are insufficient for accessibility.

**DO** use `aria-label` when an element's purpose is conveyed through visuals alone (e.g., an icon button).
**DO NOT** use `aria-label` if the element already has a clear, visible label that is programmatically associated with it (e.g., a `<label>` element). Using `aria-label` will override the native label.

```html
<button aria-label="Close dialog">X</button>
```

### `aria-labelledby`

Employ `aria-labelledby` to associate an element with one or more existing elements on the page that serve as its label. This is powerful for constructing labels from multiple pieces of text or referencing hidden elements.

**DO** use `aria-labelledby` to create labels from existing text elements, especially when the label needs to be composed from multiple sources.
**DO** use `aria-labelledby` to associate labels with non-interactive elements or elements that cannot be labeled by standard HTML methods.
**DO NOT** forget that `aria-labelledby` overrides all other label sources, including `aria-label` and native `<label>` elements.

```html
<div id="section-heading">Section Title</div>
<p id="section-description">This section contains important information.</p>
<div role="region" aria-labelledby="section-heading section-description">
  <!-- Content of the section -->
</div>
```

### `aria-describedby`

Utilize `aria-describedby` to associate descriptive text with an element, providing supplementary information that is not part of its primary label. This is ideal for conveying additional context, instructions, or requirements.

**DO** use `aria-describedby` for additional information that enhances understanding but is not essential for identifying the element's core function.
**DO** use `aria-describedby` to link input fields to their requirements or validation messages.
**DO NOT** use `aria-describedby` for the primary label of an element; use `aria-label` or `aria-labelledby` for that purpose.

```html
<label for="password">Password:</label>
<input type="password" id="password" aria-describedby="password-requirements">
<p id="password-requirements">Password must be at least 8 characters long and include a number.</p>
```

## ARIA Relationship Attributes

ARIA relationship attributes establish semantic connections between elements, enhancing how assistive technologies interpret the structure and flow of the page.

### `aria-owns`

Use `aria-owns` to indicate that an element, though separated in the DOM, should be treated as a child of another element by assistive technologies. This is often used for managing complex widget structures like custom menus or tooltips that are not direct DOM children.

**DO** use `aria-owns` to create a logical parent-child relationship for assistive technologies when the DOM structure doesn't accurately reflect the intended user experience (e.g., for a submenu).

### `aria-activedescendant`

The `aria-activedescendant` attribute allows you to designate which element within a composite widget should receive focus when the parent element itself has focus. This is commonly used in custom select boxes or listboxes to manage focus indication.

**DO** use `aria-activedescendant` in custom components that mimic native interactive elements (like listboxes) to ensure focus is correctly reported to assistive technologies.

### `aria-describedby` (also a relationship attribute)

As mentioned above, `aria-describedby` is also a relationship attribute that links an element to its descriptive content, regardless of their DOM proximity.

### `aria-posinset` and `aria-setsize`

These attributes are crucial for defining the position and total count of items within a set when the DOM structure doesn't inherently provide this information (e.g., with virtualized lists).

**DO** use `aria-posinset` and `aria-setsize` for dynamically loaded or virtualized lists to accurately inform assistive technologies about the item's position and the total number of items.

By thoughtfully applying these ARIA attributes, you can significantly improve the accessibility of your web applications, ensuring a better experience for all users.