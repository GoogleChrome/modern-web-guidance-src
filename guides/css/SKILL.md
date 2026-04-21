---
name: css
description: Action-oriented guidelines for modern CSS architecture, layouts, and performance. Use this skill when authoring styles, managing design systems, or optimizing web rendering.
---

# CSS: Modern Architecture and Performance

These guidelines provide a high-density reference for writing maintainable, performant, and standard-compliant CSS.

## 1. Foundations

Be allergic to knowledge duplication. Prefer variables over repetition, but whenever possible, prefer built-in conventions such as:
- `currentColor` instead of defining a variable and setting `color` to it
- The `inherit` keyword instead of defining a variable on the parent and using it on the same property across parent and child.
- `em` units instead of `font-size: var(--size)`
- `cqw`/`cqh` units instead of repeating box model values.
- Code duplication is not knowledge duplication. The goal is robustness and maintainability, not saving characters.
- Prefer **logical properties and values** over physical ones (e.g. `margin-inline-start` instead of `margin-left`) so that styles adapt to different writing modes and orientations. Even if the page author does not plan to localize, external translation tools often display translated text in context.
- Do not use logical properties indiscriminately — ask yourself "would I want this to flip in RTL?" — if the answer is no, use the physical property instead.
- Consider different viewing modes (dark mode, high contrast mode), different viewport sizes, and different input modes (touch, keyboard, pointer).

## 2. Inheritance and The Cascade

**Avoid** introducing BEM naming conventions to manage specificity.
Instead, use modern CSS features such as cascade layers and `:where()` to make cascade behavior predictable and follow author intent.

Use cascade layers (`@layer`) to define explicit priority zones (e.g., `reset`, `base`, `theme`, `components`, `utilities`), and declare their order upfront (e.g. `@layer reset, base, theme, components, utilities;`).
Within each layer, use `:where()` to make selectors only compete based on meaningful signals, not incidental filters (`:not()` edge cases, remote ancestors, etc.) or for one-off easily overridable defaults..

<!-- - **DO** use keywords like `inherit`, `initial`, `unset`, or `revert` to explicitly control inheritance.
TODO too vague move this elsewhere and ground it on use cases
-->

## 3. Selectors and scoping

Modern browser-native selectors reduce the need for preprocessors and complex state-tracking in JS.

### Prefer CSS selectors over JS for complex element targeting

- **DO** use `:has()` to style parents based on child state instead of managing classes in JS (e.g. `label:has(:checked)` instead of a manual `label.has-checked` class)
- **DO NOT** nest `:has()` or use pseudo-elements inside it (browser API limitation)
- Use `:nth-child(<An+B> of <selector>)` when you need to style every n-th element of a certain type. E.g. `details:nth-child(1 of [open])` will style the first open `<details>` element it finds, whereas `details[open]:first-child` would style only the first child iff it was open.

### Use `:is()` (or `:where()`) instead of CSS rule duplication for fallbacks

**DO NOT** duplicate CSS rules to provide fallbacks for pseudo-classes that may not be supported — use `:is()` or `:where()` instead and take advantage of their forgiving parsing rules.

```css
/* BAD: duplicate rules instead of using `:where()` */
[popover]:popover-open {
  /* styles for native popovers */
}
[popover].\:popover-open {
  /* same styles again, for polyfilled popovers */
}

/* GOOD */
[popover]:where(:popover-open, .\:popover-open) {
  /* same styles in one rule */
}
```

Do NOT use this for pseudo-elements, as they are not supported in `:is()` or `:where()`.

### Avoid overmatching

Use `:not()` to exclude states/elements instead of applying styles more widely than is needed and then undoing them.
For example, don't do this:

```css
.fancy-list li {
  border-bottom: 1px solid silver;
}

.fancy-list li:last-child {
  border-bottom: none;
}
```

Instead, do this:

```css
.fancy-list li:not(:last-child) {
  border-bottom: 1px solid silver;
}
```

While `:not()` + descendant selectors can exclude subtrees, this works poorly for deeply nested structures.
For example, `.card :not(.content *)` will not work as expected for nested cards.
`@scope` fixes this as it takes hierarchical proximity into account:

```css
@scope (.card) to (.content) {
  /* styles for elements inside .card but not inside .content */
}
```

This will work as expected even for nested cards.

**DO NOT** use global resets (styles on `*`) as they cannot be overridden by web components or lower-priority cascade layers (without `!important`). Instead, apply reset styles to specific element types and/or conditions.


### Nesting and scoping

Use native CSS nesting to group related styles where this improves maintainability and readability.

Prefer `@scope` over nesting when proximity should matter more than pure specificity. This is common in selectors that can be nested in any order, but the closest matching one (in element -> ancestor order) should win, e.g. theming classes.

For example this will not work as expected:
```css
.dark .invert { color-scheme: light }
.light .invert { color-scheme: dark }
```

If `.invert` is nested within _both_ `.dark` and `.light`, it will always resolve to dark mode as both rules have the same specificity.
Using `@scope` fixes this:

```css
@scope (.dark) {
  .invert { color-scheme: light }
}

@scope (.light) {
  .invert { color-scheme: dark }
}
```


## 2. Advanced Visuals, Borders, and Blend Modes
Modern CSS provides advanced effects for depth, textures, and non-rectangular geometries.

### DOs and DON'Ts
- **DO** layer multiple shadows (comma-separated) for realistic soft depth effects.
- **DO** use `filter: drop-shadow()` instead of `box-shadow` for non-rectangular shapes or transparent PNGs.
- **DO** use elliptical `border-radius` (e.g., `10px / 20px`) for proportional curves without extra elements.
- **DO** use `mix-blend-mode` and `background-blend-mode` for lighting overlays (limit scope with `isolation: isolate`).
- **DO** use keywords before length values in `background-position` (e.g., `bottom 10px right 20px`).
- **DO** use `clip-path` and `mask-image` for custom geometric reveals and smooth fade-outs.
- **DO** use `::selection` to customize highlighted text colors.

### Code Example: Advanced Visuals
```css
.card {
  box-shadow:
    0 1px 1px rgba(0,0,0,0.1),
    0 2px 2px rgba(0,0,0,0.1),
    0 4px 4px rgba(0,0,0,0.1); /* Layered shadow */

  border-radius: 50px / 25px; /* Elliptical corners */
}

.icon {
  filter: drop-shadow(0 5px 15px rgba(0,0,0,0.5)); /* Edge-following shadow */
}

.hero {
  background-image: url('texture.png'), linear-gradient(to bottom, #fff, #eee);
  background-blend-mode: soft-light;
}

.portrait {
  clip-path: circle(50% at center);
  mask-image: linear-gradient(to bottom, black, transparent);
}
```

## 3. Focus management

- Use `:focus-visible` to define custom focus rings, not `:focus`.
- Do not remove the browser's default focus rings (via `outline: none`) without providing an alternative visible focus style.
- Prefer `outline` over other properties (e.g. `box-shadow`) for focus rings. If you must rely on `box-shadow` for focus rings, provide an `outline`-based fallback for High Contrast Mode using the `forced-colors` media query.
- Pair focus outlines with `outline-offset` to visually separate the ring from the element.

## 4. Design Systems and Theming

CSS Custom Properties (Variables) and modern color functions are the foundation of dynamic theming.

### DOs and DON'Ts
- **DO** define design tokens as Custom Properties (`--brand-color`) on `:root`.
- **DO** use `light-dark()` for simplified color scheme support (requires `color-scheme: light dark;`).
- **DO** leverage `light-dark()` responding to *localized* `color-scheme` overrides (forcing dark theme on a subtree).
- **DO** use `color-mix(in oklab, var(--primary) 70%, white 30%)` for dynamic tints outside of relative color syntax.
- **DO** use **Relative Color Syntax** (`oklch(from var(--primary) l c h / 0.5)`) to derive tints dynamically.

### Code Example: Modern Theming
```css
:root {
  color-scheme: light dark;
  --primary: oklch(60% 0.15 250);
}

.dark-sidebar {
  color-scheme: dark; /* Forces child light-dark() values to use dark options */
}
```

### Theme Management Matrix

| Feature | `light-dark()` | `@media (prefers-color-scheme)` |
| :--- | :--- | :--- |
| **Scope** | Local or Global | Strictly Global |
| **Trigger Mechanism** | `color-scheme` property | OS/Browser preference |
| **Component Overrides** | ✅ Easy | ❌ Difficult |

**Single-Sentence Mental Model**: "`light-dark()` = Contextual theme (supports local overrides), `@media` = Global preference (OS-level)."

## 5. Transitions, Animations, and Performance
Rendering performance is critical for smooth user experiences, especially in heavy DOM trees.

### DOs and DON'Ts
- **DO** only animate `transform` and `opacity` to ensure animations stay on the compositor thread.
- **DO** use `translate` (or `transform: translate()`) instead of animating `top`/`left`/`right`/`bottom` to avoid triggering layout reflows and ensure smoother animations.
- **DO** use `transition-behavior: allow-discrete` to animate layout properties like `display` or `<dialog>` state natively.
- **DO** always pair `content-visibility` with `contain-intrinsic-size` to prevent scrollbar jumps (CLS).
- **DO** use `contain: layout style paint` to isolate component rendering updates.

### Code Example: Render Optimization
```css
.large-section {
  content-visibility: auto;
  contain-intrinsic-size: auto 800px;
}

.popover-reveal {
  /* Allow discrete animations for display transitions */
  transition: display 0.2s allow-discrete;
}
```



## 6. Modern Gradients and Color Spaces
Create vibrant UI patterns without gray dead-zones using modern color spaces.

### DOs and DON'Ts
- **DO** use `in <color-space>` (e.g., `in oklch` or `in oklab`) to avoid vibrant colors washing out into grayscale in between.
- **DO** use hard-edge color stops for sharp patterns (e.g., `red 50%, blue 50%`).
- **DO** use `conic-gradient()` for progress rings or charts.
- **DON'T** use `linear-gradient()` without a color space override if you are transitioning between highly saturated colors.

### Code Example: Modern Gradients
```css
/* Smooth, vibrant transition without standard gray dead-zones */
.hero-gradient {
  background: linear-gradient(in oklch, var(--primary), var(--secondary));
}

/* Hard-edge stripes */
.stripe-bg {
  background: linear-gradient(to right, var(--main) 50%, var(--accent) 50%);
}
```

## 7. Responsive Typography and Visual Sizing
Use fluid and accessible typography that respects viewport widths and browser zoom.

### DOs and DON'Ts
- **DO** use unitless numbers for `line-height` (e.g., `1.5`) to ensure relative scaling during font-size inheritance.
- **DO** use `clamp(min, preferred, max)` for fluid typography without media queries.
- **DO** use standalone `min()` and `max()` to constrain values responsively.
- **DO** use `text-wrap: balance` for short headlines (up to 4-6 lines) to prevent uneven orphans.
- **DO** use `overflow-wrap: break-word` (or `anywhere`) to contain long URLs.
- **DO** use `@container` queries to create component-driven responsive layouts that adapt to their parent container's size rather than the viewport.
- **DO** use dynamic viewport units (`dvh`, `dvw`) instead of `vh`/`vw` to prevent layout breakage when mobile browser UI elements (like address bars) appear or disappear.
- **DO** use `aspect-ratio` for media elements (like `<img>` and `<video>`) to reserve space during loading and prevent Cumulative Layout Shift (CLS).
- **DON'T** use `px` for font-size. Prefer `rem` to honor the user's browser font-size preferences (root font size), as `px` values are absolute and may ignore user-defined defaults.
- **DON'T** use `vw` alone for font-size without a min/max clamp, as it can scale text too small or too large on extreme screens.

### Code Example: Fluid Typography
```css
h1 {
  font-size: clamp(2rem, 5vw + 1rem, 4rem); /* Fluid typography */
  text-wrap: balance;
  line-height: 1.2;
}

.url-container {
  overflow-wrap: anywhere;
  hyphens: auto;
}
```

## 8. Transitions, View Transitions, and Scroll Motion
Leverage browser-native APIs for page navigations and viewport-bound animations.

### DOs and DON'Ts
- **DO** use `prefers-reduced-motion` media queries to turn off heavy motion for users who prefer it.
- **DO** use **Scroll-Driven Animations** (`animation-timeline: scroll()`) for scroll-bound parallax effects instead of JS listeners.
- **DO** use the **View Transitions API** (`view-transition-name`) to animate layouts seamlessly between page states.

### Code Example: Native Motion Primitives
```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; }
}

.scroll-tracker {
  animation: progress-tint linear;
  animation-timeline: scroll(); /* Native, zero-JS */
}
```
