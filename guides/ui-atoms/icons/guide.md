---
name: icons
description: Display and manage icons that can be set and parameterized from CSS, are fast to load, crisp at any resolution and are properly exposed to (or hidden from) assistive technologies.
web-feature-ids:
  - svg
  - masks
  - image-set
  - container-style-queries
  - registered-custom-properties
  # - tmp-link-parameters
guides:
  - precise-text-alignment
---

# Using and managing icons


## Choosing an Icon Technique

Icon storage and rendering are separate choices: an SVG sprite can be used with `<use>` or as a CSS icon source.

* **CSS icon system:** Use when CSS should choose the icon. Use a mask for single-color icons or a background image for full-colour ones.
* **Inline SVG:** Use when you need control over individual paths.

With `<use>`, page CSS cannot select paths inside the referenced symbol. Inherited and custom properties can reach them if the paths use those properties, for example `fill="var(--icon-fill, currentColor)"`. For arbitrary path styling or animation, use inline SVG. Avoid recoloring `<img>` icons with CSS filters; they are brittle and offer limited control.

If a page renders thousands of icons at once, benchmark the actual page and assets. In a stress test, inline SVG had a small performance advantage at that scale, but results depend on the browser and implementation. [Cloud Four's SVG icon stress test](https://cloudfour.com/thinks/svg-icon-stress-test/)

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

Define SVG icons and the default `--icon-size` as reusable custom properties using inline SVG data URIs or root-relative URLs (e.g., `url("/icons/trash.svg")`). When an icon is loaded from an external SVG file, use a root-relative URL or an embedded data URI. A relative URL used through a custom property can resolve relative to the stylesheet where the icon is used, rather than the stylesheet where the custom property is defined. If those stylesheets are in different directories, the URL may resolve to the wrong file.

To keep a URL relative to the stylesheet that defines the icon token, register the token as an `<image>` property and put the URL in `initial-value`:

```css
@property --icon-caret {
  syntax: "<image>";
  inherits: true;
  initial-value: url("icons/caret.svg");
}
```

The usual limitations of `@property`, namely that registered properties are global and shadow roots cannot register properties, are less relevant here since these icon tokens are meant to be global. 
The main downside of this approach is that it requires a lot more boilerplate (though it compresses well), and that it limits browser support. If root-relative URLs are an option, they are a simpler solution.

```css
:root {
  --icon-size: 1em;
  --icon-style-spacing: 0.4em;
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
    margin-inline-end: var(--icon-style-spacing);
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

  :where(:not(:empty))::after {
    margin-inline-start: var(--icon-style-spacing);
  }
}
```

### 4. Standalone and Icon-Only Element Forwarding

For standalone icons or icon-only buttons, apply `.icon` directly to the empty element (the button itself for an icon-only control) and set its icon with `--icon`. The class forwards `--icon` to `--icon-start`:

```css
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

Put the `.icon` class and `--icon` property directly on an icon-only button. Give the button an accessible name with `aria-label`; the CSS-generated icon is decorative. For standalone informative icons, expose the `.icon` element with `role="img"` and `aria-label`:

```html
<!-- Icon-only interactive control -->
<button class="icon" style="--icon: var(--icon-trash);" aria-label="Delete item"></button>

<!-- Standalone informative icon -->
<span class="icon" style="--icon: var(--icon-favorite);" role="img" aria-label="Favorite"></span>
```

## Alternatives to the CSS Icon System

Use inline SVG when you need direct access to individual paths, such as for customizable multi-color icons or path-level animations. No example is needed here: the key distinction is that inline SVG exposes the icon's elements in the document.

For reusable SVG icons stored in an external sprite, reference a symbol with `<use>`:

```html
<button aria-label="Delete item">
  <svg aria-hidden="true" width="24" height="24">
    <use href="/icons.svg#icon-trash"></use>
  </svg>
</button>
```

The sprite file defines the `icon-trash` symbol once, and pages can reference it where needed. External sprites can be cached and reused, but styling the referenced SVG's internals is limited compared with inline SVG.

## Fallback Strategies

### Registered Custom Properties

{{ BASELINE_STATUS("registered-custom-properties") }}

### Container Style Queries

{{ BASELINE_STATUS("container-style-queries") }}

To support browsers without Container Style Queries, use classes or component selectors as fallback hooks. Keep icon selection in custom properties; inline-style selectors alone miss icons assigned through CSS rules.

```css
:where(.icon-start)::before {
  --icon-start: inherit;
  content: image-set(linear-gradient(transparent 0 100%), var(--icon-start));
  /* icon styles */
}

:where(.icon-end)::after {
  --icon-end: inherit;
  content: image-set(linear-gradient(transparent 0 100%), var(--icon-end));
  /* icon styles */
}

:where(.icon:empty)::before {
  --icon-start: var(--icon);
  content: image-set(linear-gradient(transparent 0 100%), var(--icon-start));
  /* icon styles */
}

:where(.icon-start:not(.icon, :empty))::before {
  margin-inline-end: var(--icon-style-spacing);
}

:where(.icon-end:not(.icon, :empty))::after {
  margin-inline-start: var(--icon-style-spacing);
}
```

This `image-set()` pattern makes `content` invalid when the custom property is unset, so it falls back to `none` and the pseudo-element disappears without adding or removing a class. It does not remove the pseudo-element's other styles or prevent conflicts with other `::before` or `::after` rules, so use these hooks only where those pseudo-elements are available for icons.

### Safari Browser Workarounds

Safari has two rendering bugs affecting icons: WebKit [#301609](https://bugs.webkit.org/show_bug.cgi?id=301609) can prevent them from appearing until user interaction, and [#320220](https://bugs.webkit.org/show_bug.cgi?id=320220) also affects their rendering. The workaround below addresses both:

```css
@keyframes webkit-301609 {}

@supports ((-webkit-nbsp-mode: normal) or (-webkit-touch-callout: none) or (font: -apple-system-body)) and (content-visibility: auto) {
  @layer webkit-301609-fix {
    ::before, ::after {
      animation: webkit-301609 0s;
    }
  }
}
```

The `@supports` query targets Safari only, and `@layer` reduces animation conflicts.

WebKit bug #325900 can prevent a direct override of `--icon-start` from taking effect in some cases, such as changing the icon on hover. This affects the workaround for non-inheriting registered properties. For Safari, register `--icon-start` as inheriting and reset it on descendants inside the style query:

```css
@supports ((-webkit-nbsp-mode: normal) or
           (-webkit-touch-callout: none) or
           (font: -apple-system-body)) and (content-visibility: auto) {
  /* Override previous declaration */
  @property --icon-start {
    syntax: "*";
    inherits: true;
  }

  @layer webkit-325900-fix {
    @container style(--icon-start) {
      * {
        --icon-start: initial;
      }
    }
  }
}
```

The reset prevents the icon value from propagating to descendants. Keeping it in a layer lets unlayered icon declarations take precedence over the reset.
