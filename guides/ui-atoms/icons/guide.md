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

Use CSS Masks and Container Style Queries to inject scalable vector icons into any element via CSS variables. This approach delivers zero-markup injection, dynamic color control, and automatic transitions without altering HTML structure.

## Choosing the Right Technique

Use this decision tree to select the appropriate icon technique for your use case:

1. **Does it need to animate internal vector paths, or use multiple colors in a single icon?**
   * **Yes**: Use **Inline SVG**. This is the only way to gain full DOM access to the icon's internals.
   * **No**: Proceed to step 2.
2. **Is browser caching and performance of a long list of static icons a primary goal?**
   * **Yes**: Keep the icon as an external file. Proceed to step 3.
   * **No**: Use the **CSS-Driven Icon Engine** (CSS Masks + Style Queries). It is the cleanest, zero-markup approach for general UI.
3. **Does it need to dynamically change the icon's color via CSS?**
   * **Yes**: Use the **CSS-Driven Icon Engine** or **`<img>` + CSS filters**.
   * **No**: Use a **Plain `<img>`** tag. This is the fastest, lowest-overhead method for static, immutable icons.

### Comparison at a glance

| Technique                     | Color Control        | Multi-color |    Animatable    | DOM Overhead | Cachable |
| :---------------------------- | :------------------- | :---------: | :--------------: | :----------: | :------: |
| **CSS-Driven Engine (Masks)** | Full (currentColor)  |      ❌      | ✅ (Tints/Sizing) |   0 Nodes    |    ✅     |
| **Inline SVG**                | Full (CSS/DOM)       |      ✅      | ✅ (Vector paths) |     High     |    ❌     |
| **`<img>` + CSS Filter**      | Partial (Color math) | ⚠️ (Limited) |   ✅ (Filters)    |    1 Node    |    ✅     |
| **Plain `<img>`**             | None                 |      ❌      |        ❌         |    1 Node    |    ✅     |

## Primary Approach: CSS-Driven Icon Engine

The engine uses three CSS capabilities to render icons:

1. **Registered Custom Properties (`@property`)**: Register `--icon-start` and `--icon-end` with `"*"` syntax and `inherits: false` so icon variables do not inherit into child elements.
2. **Container Style Queries (`@container style(...)`)**: Automatically detects and renders when custom properties are set.
3. **CSS Masks & `currentColor`**: Icons render as pseudo-elements using masks, with sizing in relative units (`em`) and colors via `currentColor`.

## Implementation

### 1. Register Custom Properties

```css
@property --icon-start {
  syntax: "*";
  inherits: false;
}

@property --icon-end {
  syntax: "*";
  inherits: false;
}
```

### 2. Defining Icon Assets as Design Tokens

Define SVG icons and the default `--icon-size` as reusable custom properties using inline SVG data URIs or root-relative URLs (e.g., `url("/icons/trash.svg")`):

```css
:root {
  --icon-size: 1em;
  --icon-trash: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z'/%3E%3C/svg%3E");
  --icon-favorite: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'/%3E%3C/svg%3E");
}
```

### 3. Setting Up the Container Style Queries

This block handles the injection, sizing, masking, and automatic layout adjustments. Because the engine uses `background-color: currentColor`, the icon automatically adopts the parent's text color and responds to standard transitions.

```css
/* Style query for elements configuring a start icon */
@container style(--icon-start) {
  ::before {
    --icon-start: inherit; /* Forward the value inside the query block */
    content: "";
    display: inline-block;
    width: var(--icon-size);
    height: var(--icon-size);
    background-color: currentColor;
    mask: var(--icon-start) no-repeat center / contain;
    vertical-align: middle;
  }

  /* Automatically add spacing ONLY if the element has other text or sibling content */
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
    width: var(--icon-size);
    height: var(--icon-size);
    background-color: currentColor;
    mask: var(--icon-end) no-repeat center / contain;
    vertical-align: middle;
  }

  :not(.icon, :empty)::after {
    margin-inline-start: 0.4em;
  }
}
```

### 4. Standalone and Icon-Only Element Forwarding

For standalone icons or buttons that have no text (e.g. icon-only controls), establish an empty `.icon` class that forwards a general `--icon` property to `--icon-start`:

```css
.icon {
  display: inline-block;
  width: var(--icon-size);
  height: var(--icon-size);
  vertical-align: middle;
  flex-shrink: 0;
  color: inherit;
}

.icon:empty {
  --icon-start: var(--icon);
}
```

## Usage Examples

### Decorative Icons (Via CSS Property)

Attach an icon to a button or other element by setting `--icon-start` or `--icon-end`:

```html
<button style="--icon-start: var(--icon-trash);">
  Delete Item
</button>
```

### Icon-Only Controls

For standalone icons or icon-only buttons, use an empty `.icon` element with an accessible name on the container:

```html
<button aria-label="Delete item">
  <span class="icon" style="--icon: var(--icon-trash);" aria-hidden="true"></span>
</button>
```

## When to Use Inline SVG Instead

If you need multi-color icons or arbitrary path-level animations, use Inline SVG. It provides full DOM access but requires more markup:

```html
<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
  <path d="..." fill="currentColor" />
  <circle cx="12" cy="12" r="3" fill="var(--icon-accent, gold)" />
</svg>
```

## Common Pitfalls

- **Missing or Malformed `viewBox`**: SVG assets must have a valid `viewBox` attribute (e.g., `viewBox="0 0 24 24"`) to render correctly when used as masks or backgrounds. Omitting it causes scale distortion and layout issues.
- **Cursor Interaction Requirement (Safari)**: Without the workaround above, Safari requires user interaction before rendering icons.

{{ FEATURE_ISSUES("masks") }}
{{ FEATURE_ISSUES("container-style-queries") }}

## Fallback Strategies

{{ FEATURE_FALLBACKS("masks") }}
{{ FEATURE_FALLBACKS("container-style-queries") }}
{{ FEATURE_FALLBACKS("registered-custom-properties") }}

### For Browsers Without Container Style Queries

Use the `@supports not (container-name: container)` directive with style attribute substring selectors to inject icons when `--icon-start` or `--icon-end` are set inline:

```css
@supports not (container-name: container) {
  [style*="--icon-start"]::before {
    content: "";
    display: inline-block;
    width: var(--icon-size);
    height: var(--icon-size);
    background-color: currentColor;
    mask: var(--icon-start) no-repeat center / contain;
    vertical-align: middle;
  }

  [style*="--icon-start"]:not(.icon, :empty)::before {
    margin-inline-end: 0.4em;
  }

  [style*="--icon-end"]::after {
    content: "";
    display: inline-block;
    width: var(--icon-size);
    height: var(--icon-size);
    background-color: currentColor;
    mask: var(--icon-end) no-repeat center / contain;
    vertical-align: middle;
  }

  [style*="--icon-end"]:not(.icon, :empty)::after {
    margin-inline-start: 0.4em;
  }

  .icon:empty[style*="--icon"]::before {
    content: "";
    display: inline-block;
    width: var(--icon-size);
    height: var(--icon-size);
    background-color: currentColor;
    mask: var(--icon) no-repeat center / contain;
    vertical-align: middle;
  }
}
```

### Safari Browser Workarounds

Safari has two bugs affecting icons (WebKit #301609, #320220): icons don't render until user interaction, and a related rendering issue. Apply this CSS fix to force immediate rendering:

```css
@keyframes webkit-301609 {}

@supports (-webkit-nbsp-mode: normal) and (content-visibility: auto) {
  @layer webkit-301609-fix {
    ::before, ::after {
      animation: webkit-301609 0s;
    }
  }
}
```

The `@supports` query targets Safari only, and `@layer` reduces animation conflicts.
