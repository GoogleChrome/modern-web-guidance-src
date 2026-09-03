---
name: icons
description: Display and manage icons that can be set and parameterized from CSS, are fast to load, crisp at any resolution and are properly exposed to (or hidden from) assistive technologies.
web-feature-ids:
  - svg
  - masks
  - image-set
  - container-style-queries
  - registered-custom-properties
  - tmp-linked-parameters
guides:
  - precise-text-alignment
---

# SVG Icon Implementation

Modern web icon systems prioritize performance, accessibility, ease of styling, and separation of concerns. Rather than flooding HTML templates with repetitive inline SVG code or relying on un-semantic and inaccessible "icon fonts," modern architectures utilize **CSS Masks and Container Style Queries** to create a zero-markup, highly flexible icon engine.

This approach allows you to inject scalable vector icons into any element (such as buttons, links, or badges) using standard CSS variables, without modifying the underlying HTML markup.

---

## Core Concept: CSS-Driven Icon Engine

The engine relies on three modern CSS capabilities:
1. **Registered Custom Properties (`@property`)**: We register `--icon-start` and `--icon-end` with a `<image>` syntax and `inherits: false`. This ensures type safety and prevents unexpected inheritance issues.
2. **Container Style Queries (`@container style(...)`)**: The browser automatically monitors elements for changes to these custom properties. Setting a property like `--icon-start: var(--icon-trash)` instantly compiles and injects the icon.
3. **CSS Masks & `currentColor`**: Icons are rendered as pseudo-elements (`::before` / `::after`) using a CSS mask. Sizing is governed by relative units (`1em`), and colors dynamically transition using `currentColor`, allowing seamless CSS transitions.

---

## Basic implementation

### 1. Registering the Custom Properties

Standard custom properties are treated as generic strings, which can cause layout or inheritance bugs when resolving complex CSS types like image URLs. Registering them with `@property` ensures they are correctly typed as `<image>` elements:

```css
@property --icon-start {
  syntax: "<image>";
  inherits: false;
}

@property --icon-end {
  syntax: "<image>";
  inherits: false;
}
```

### 2. Defining SVG Assets as Variables

Instead of loading individual files inline, define your SVG icons as reusable custom variables at the `:root`. You can use inline SVG data URIs (for maximum performance and offline availability) or relative URLs:

```css
:root {
  /* Inline SVG Data URI (Optimized & Self-contained) */
  --icon-trash: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z'/%3E%3C/svg%3E");
  --icon-favourite: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'/%3E%3C/svg%3E");
}
```

### 3. Setting Up the Container Style Queries

This block handles the injection, sizing, masking, and automatic layout adjustments. Because we use `background-color: currentColor`, the icon automatically adopts the parent's text color and responds to standard CSS hover and focus transitions.

```css
/* Style query for elements configuring a start icon */
@container style(--icon-start) {
  ::before {
    --icon-start: inherit; /* Forward the value inside the query block */
    content: "";
    display: inline-block;
    width: 1.25em;
    height: 1.25em;
    background-color: currentColor;
    mask: var(--icon-start) no-repeat center / contain;
    -webkit-mask: var(--icon-start) no-repeat center / contain;
    opacity: 0.85;
    pointer-events: none;
    vertical-align: middle;
  }

  /* Automatically add padding/spacing ONLY if the element has other text or sibling content */
  :not(.icon, :empty)::before {
    margin-inline-end: 0.4em;
  }
}

/* Style query for elements configuring an end icon */
@container style(--icon-end) {
  ::after {
    --icon-end: inherit;
    content: "";
    display: inline-block;
    width: 1.25em;
    height: 1.25em;
    background-color: currentColor;
    mask: var(--icon-end) no-repeat center / contain;
    -webkit-mask: var(--icon-end) no-repeat center / contain;
    opacity: 0.85;
    pointer-events: none;
    vertical-align: middle;
  }

  :not(.icon, :empty)::after {
    margin-inline-start: 0.4em;
  }
}
```

### 4. Standalone and Icon-Only Element Forwarding

For standalone icons or buttons that have no text (e.g. icon-only controls), we establish an empty `.icon` class that forwards a general `--icon` property to `--icon-start`:

```css
.icon {
  display: inline-block;
  width: 1.25em;
  height: 1.25em;
  vertical-align: middle;
  flex-shrink: 0;
  color: inherit;
}

.icon:empty {
  --icon-start: var(--icon);
}
```

---

## HTML Usage Examples

### Decorative Icons (Zero Extra Markup)
To attach an icon to a button, link, or header, simply set the `--icon-start` or `--icon-end` custom properties directly in CSS or style tags:

```html
<!-- No svg tags inside! The icon is rendered purely via pseudo-elements -->
<button style="--icon-start: var(--icon-trash);">
  Delete Item
</button>
```

### Standalone and Icon-Only Buttons
For cases where an icon stands alone without adjacent text, use an empty `.icon` element inside an interactively labeled container:

```html
<button aria-label="Delete item">
  <span class="icon" style="--icon: var(--icon-trash);" aria-hidden="true"></span>
</button>
```

---

## Strengths and Trade-offs

### Pros:
- **Zero HTML clutter**: No inline SVG paths bloated across your templates.
- **Skins & Themes**: Easily swap icons or colors with standard CSS rule modifications (e.g., swapping to a filled icon on `:hover` or in dark mode).
- **Automated Layout**: Space/margins are dynamically calculated and applied only when the container is not empty, avoiding orphan spacing.
- **Built-in Transitions**: Colors transition seamlessly using native CSS text `color` transitions, powered by `currentColor` masking.

### Cons:
- **Single Color**: Limited to single-color icons (perfect for 99% of UI utility icons). For complex, multi-color illustrations, inline SVG is still preferred.
- **No Morphing**: You cannot animate or morph vector paths directly; use inline SVG if path-level morph animations are required.

---

## Known issues to be aware of

- **Safari Style Query Support**: Style queries are widely supported in modern browsers, but ensure any targeted older Safari runtimes have a fallback pattern if needed (such as class toggling).
- **Linked Parameters**: Once linked parameters ship natively, masking workarounds can be replaced with native background parameters, keeping this same custom property contract as the primary guidance.

{{ FEATURE_ISSUES("masks") }}
{{ FEATURE_ISSUES("container-style-queries") }}

## Fallback strategies

{{ FEATURE_FALLBACKS("masks") }}
{{ FEATURE_FALLBACKS("container-style-queries") }}
{{ FEATURE_FALLBACKS("registered-custom-properties") }}
