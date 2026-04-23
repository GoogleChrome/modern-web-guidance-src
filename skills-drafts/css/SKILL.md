---
name: css
description: Action-oriented guidelines for modern CSS architecture, layouts, and performance. Use this skill when authoring styles, managing design systems, or optimizing web rendering.
---

# CSS: Modern Architecture and Performance

These guidelines provide a high-density reference for writing maintainable, performant, and standard-compliant CSS.

## 1. Architectural Foundations and The Cascade
Effective CSS architecture focuses on managing the global namespace and controlling specificity natively.

### DOs and DON'Ts
- **DO** use a global `box-sizing: border-box` reset to ensure padding doesn't break layouts.
- **DO** use keywords like `inherit`, `initial`, `unset`, or `revert` to explicitly control inheritance.
- **DO** use **Cascade Layers** (`@layer`) to define explicit priority zones (e.g., `reset`, `base`, `theme`, `components`, `utilities`).
- **DO** declare the layer order upfront in your main CSS file: `@layer reset, base, theme, components, utilities;`.
- **DO** understand that `!important` declarations in a lower-priority layer override those in a higher-priority layer (precedence is reversed).
- **DO** use specialized naming conventions like **BEM** (`.block__element--modifier`) to avoid namespace collisions.
- **DO** use `isolation: isolate` to create a fresh stacking context without side-effects.

### Code Example: Foundations & Reset
```css
/* Global Reset */
*, *::before, *::after {
  box-sizing: border-box;
}

/* 1. Define order */
@layer reset, theme, components;

/* 2. Low priority foundational styles */
@layer reset {
  a { color: inherit; text-decoration: none; }
}

/* 3. Higher priority component styles */
@layer components {
  .btn {
    background: var(--brand);
    color: white;
  }
}

/* Unlayered styles (Highest priority outside of !important) */
.emergency-override {
  display: block;
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
- **DO** use CSS Counters (`counter-reset`, `counter-increment`) for automated numbering visible in `::before`/`::after`.

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


## 3. Native Selectors and Scoping
Modern browser-native selectors reduce the need for preprocessors and complex state-tracking in JS.

### DOs and DON'Ts
- **DO** use native CSS nesting to group related styles (3 levels max).
- **DO** use `:has()` to style parents based on child state (e.g., `.form-group:has(:invalid)`).
- **DON'T** nest `:has()` or use pseudo-elements inside `:has()` (browser API limitation).
- **DO** use Attribute selectors (e.g., `[disabled]`) to style elements based on their state or metadata.
- **DO** use `:where()` for baseline styles you want to be easily overridable (0 specificity).
- **DO** use `:focus-visible` instead of `:focus` to hide focus rings for pointer interactions (mouse/touch) while preserving them for keyboard navigation and elements requiring text input.
- **DO** pair focus outlines with `outline-offset` to separate the ring from the element.
- **DON'T** use `outline: none` without providing a visible focus style.
- **DON'T** rely on `box-shadow` for focus rings if you need to support Windows High Contrast Mode (use `outline` instead).
- **DON'T** use `::before` or `::after` on replaced elements (`<img>`, `<input>`, `<video>`).

### Code Example: Advanced Selectors
```css
.card {
  position: relative;
  
  /* Accessible focus visible state */
  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px; /* Separate ring from border */
  }
  
  /* Conditional styling based on content */
  &:has(img) { padding: 0; }
  
  /* State management without extra classes */
  &:has(input:checked) { border-color: var(--active); }
  
  /* Shared styles without high specificity */
  :is(.title, .subtitle) {
    margin: 0;
    font-weight: bold;
  }
}

/* Zero-specificity reset */
:where(a) { color: blue; }
```

### Functional Selectors Specificity Matrix

| Selector | Specificity Weight | Primary Use Case |
| :--- | :--- | :--- |
| **`:where()`** | Exactly **0** | Baseline resets and design system defaults. |
| **`:is()`** | Max specificity of its arguments | Reducing code duplication for shared styles. |
| **`:has()`** | Max specificity of its arguments | Parent/relational styling based on child states or siblings. |

**Single-Sentence Mental Model**: "`:where()` = Spec-neutral resets, `:is()` = Spec-heavy grouping, `:has()` = Relational state."

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

## 9. Scoping and Shadow DOM
Keep CSS architecture clean by explicitly scoping styles to components.

### DOs and DON'Ts
- **DO** use native `@scope` to isolate styles to a component boundary (e.g., `@scope (.card) to (.content) { ... }`).
- **DO** use `:host` to style the custom element wrapper in Shadow DOM.
- **DON'T** use global resets if you are relying on Shadow DOM isolation, as they will override local component styles unless scoped.

### Code Example: Scoped CSS
```css
/* Isolation without BEM side-effects */
@scope (.media-object) {
  .title {
    font-weight: bold;
  }
}
```
