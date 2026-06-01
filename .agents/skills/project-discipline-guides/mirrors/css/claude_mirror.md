# CSS Best Practices, Syntax, and APIs: Comprehensive Guide

## 1. Selectors

### Basic Selectors
- **Type**: `div`, `p`, `h1`
- **Class**: `.btn`, `.card`
- **ID**: `#header` (avoid for styling; use for fragments/JS hooks)
- **Universal**: `*` (use sparingly; performance impact)
- **Attribute**: `[type="text"]`, `[href^="https"]`, `[class*="btn-"]`, `[lang|="en"]`, `[data-state="open"]`

### Combinators
- **Descendant**: `nav a`
- **Child**: `ul > li`
- **Adjacent sibling**: `h2 + p`
- **General sibling**: `h2 ~ p`

### Pseudo-classes
- **State**: `:hover`, `:focus`, `:focus-visible`, `:focus-within`, `:active`, `:visited`, `:target`
- **Form**: `:checked`, `:disabled`, `:enabled`, `:required`, `:optional`, `:valid`, `:invalid`, `:in-range`, `:out-of-range`, `:placeholder-shown`, `:read-only`, `:read-write`, `:default`, `:indeterminate`, `:user-valid`, `:user-invalid`
- **Structural**: `:root`, `:empty`, `:first-child`, `:last-child`, `:only-child`, `:nth-child(n)`, `:nth-of-type(n)`, `:first-of-type`, `:last-of-type`
- **Logical**: `:is(h1, h2, h3)`, `:where(.a, .b)` (zero specificity), `:not(.foo)`, `:has(> img)` (parent selector)
- **Linguistic**: `:lang(en)`, `:dir(rtl)`
- **Other**: `:default`, `:scope`, `:any-link`, `:fullscreen`, `:modal`, `:popover-open`

### Pseudo-elements
- `::before`, `::after` (require `content` property)
- `::first-letter`, `::first-line`
- `::selection`, `::placeholder`
- `::marker` (list bullets)
- `::backdrop` (dialog/fullscreen)
- `::file-selector-button`
- `::details-content`
- `::view-transition-*`

### `:has()` Examples
```css
/* Card with image */
.card:has(img) { padding-top: 0; }

/* Form with invalid field */
form:has(:invalid) button[type="submit"] { opacity: 0.5; }

/* Layout adapts to children */
.grid:has(> :nth-child(4)) { grid-template-columns: repeat(2, 1fr); }
```

### Specificity Best Practices
- Keep specificity low and flat
- Avoid IDs in selectors
- Avoid `!important` (use only for utility overrides if necessary)
- Use `:where()` for zero-specificity grouping
- Avoid deeply nested selectors

---

## 2. The Cascade, Inheritance & Layers

### Cascade Layers
```css
@layer reset, base, components, utilities;

@layer reset {
  * { margin: 0; }
}

@layer components {
  .btn { padding: 0.5rem 1rem; }
}
```
- Layers control cascade independently of specificity
- Later layers win over earlier layers
- Unlayered styles win over layered styles

### Inheritance
- Inherited: `color`, `font-*`, `line-height`, `text-*`, `visibility`, `cursor`
- Not inherited: `margin`, `padding`, `border`, `background`, `width`, `height`
- Force with `inherit`, `initial`, `unset`, `revert`, `revert-layer`

### `all` Property
```css
.reset-component { all: unset; }
```

---

## 3. Custom Properties (CSS Variables)

```css
:root {
  --color-primary: oklch(60% 0.15 250);
  --space-1: 0.25rem;
  --space-2: 0.5rem;
}

.btn {
  background: var(--color-primary);
  padding: var(--space-2) var(--space-4, 1rem); /* fallback */
}
```

### Typed Custom Properties (`@property`)
```css
@property --gradient-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

@keyframes spin-gradient {
  to { --gradient-angle: 360deg; }
}
```

### Best Practices
- Define design tokens at `:root`
- Scope component variables to component selectors
- Use `--` prefix conventions: `--color-*`, `--space-*`, `--font-*`, `--radius-*`
- Custom properties cascade and inherit (unlike Sass variables)

---

## 4. Layout

### Flexbox
```css
.flex {
  display: flex;
  flex-direction: row | column;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: flex-start | center | space-between | space-around | space-evenly;
  align-items: stretch | center | flex-start | flex-end | baseline;
  align-content: ...;
}

.item {
  flex: 1 1 auto; /* grow shrink basis */
  flex: 1; /* shorthand */
  align-self: center;
  order: 2;
}
```

### Grid
```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  gap: 1rem;
}

.item {
  grid-column: 1 / -1;
  grid-row: span 2;
  grid-area: main;
}

/* Subgrid */
.child {
  display: grid;
  grid-template-columns: subgrid;
}
```

### Modern Layout Patterns
```css
/* Holy Grail / Auto-fit cards */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  gap: 1rem;
}

/* Stack with consistent gap */
.stack > * + * { margin-block-start: 1rem; }

/* Center anything */
.center { display: grid; place-items: center; }
```

### Container Queries
```css
.card-container {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 400px) {
  .card { display: grid; grid-template-columns: 1fr 2fr; }
}

/* Container query units */
.title { font-size: clamp(1rem, 5cqi, 2rem); }
```

### Aspect Ratio
```css
.video { aspect-ratio: 16 / 9; }
.square { aspect-ratio: 1; }
```

---

## 5. Box Model

```css
*, *::before, *::after { box-sizing: border-box; }

.box {
  inline-size: 100%; /* logical: width */
  block-size: auto;  /* logical: height */
  margin-inline: auto;
  padding-block: 1rem;
  border: 1px solid;
  border-radius: 0.5rem;
}
```

### Logical Properties
Prefer logical over physical for i18n:
- `margin-inline-start` over `margin-left`
- `padding-block` over `padding-top`/`padding-bottom`
- `inset-inline` over `left`/`right`
- `border-inline-end` over `border-right`

---

## 6. Units

### Absolute
- `px` (most common for screens)
- `pt`, `pc`, `in`, `cm`, `mm` (rare on web; print)

### Relative
- `em` (relative to element font-size)
- `rem` (relative to root font-size) — preferred for sizing
- `%` (relative to parent)
- `ch` (width of "0")
- `ex`, `cap`, `ic`, `lh`, `rlh`

### Viewport
- `vw`, `vh`, `vmin`, `vmax`
- `svw/svh` (small), `lvw/lvh` (large), `dvw/dvh` (dynamic) — handles mobile browser chrome

### Container
- `cqw`, `cqh`, `cqi`, `cqb`, `cqmin`, `cqmax`

### Best Practices
- Use `rem` for typography and spacing
- Use `px` for borders and small fixed details
- Use `%` and `fr` for fluid layouts
- Use `dvh`/`svh`/`lvh` over `vh` for mobile

---

## 7. Typography

```css
:root {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  line-height: 1.5;
  text-rendering: optimizeLegibility;
}

body {
  font-size: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
}

/* Fluid type scale */
h1 { font-size: clamp(2rem, 1.5rem + 2.5vw, 3.5rem); }

/* Variable fonts */
@font-face {
  font-family: "Inter";
  src: url("inter.woff2") format("woff2-variations");
  font-weight: 100 900;
  font-display: swap;
}

.heading {
  font-variation-settings: "wght" 650, "slnt" -5;
}

/* Modern features */
p {
  text-wrap: pretty; /* or balance for headings */
  hyphens: auto;
  hanging-punctuation: first last;
  font-feature-settings: "kern", "liga";
  font-variant-numeric: tabular-nums;
}

h1, h2, h3 { text-wrap: balance; }
```

### `@font-face` Best Practices
- Use `woff2` format
- Always set `font-display: swap` (or `optional`)
- Preload critical fonts: `<link rel="preload" as="font" crossorigin>`
- Use `size-adjust`, `ascent-override` to reduce CLS

---

## 8. Color

### Modern Color Functions
```css
:root {
  --primary: oklch(60% 0.15 250);
  --primary-light: oklch(from var(--primary) 80% c h);
  --primary-alpha: oklch(60% 0.15 250 / 0.5);
}

/* Wide-gamut */
.vivid { color: color(display-p3 1 0 0.3); }

/* Color mixing */
.muted { background: color-mix(in oklch, var(--primary), white 30%); }

/* Relative colors */
.hover { background: hsl(from var(--primary) h s calc(l - 10%)); }
```

### Color Spaces
- `oklch()` — perceptually uniform, preferred for design systems
- `oklab()` — perceptual, Cartesian
- `lch()`, `lab()` — older perceptual
- `hsl()`, `hwb()` — intuitive but not perceptual
- `rgb()`, `rgba()` — legacy
- `color(display-p3 ...)` — wide gamut

### Best Practices
- Use `oklch` for design tokens (predictable lightness)
- Slash syntax for alpha: `rgb(0 0 0 / 0.5)`
- `color-scheme: light dark;` for native UI theming
- Use `light-dark()` function for theme-aware colors

```css
:root { color-scheme: light dark; }
.surface { background: light-dark(white, #111); }
```

---

## 9. Backgrounds, Borders, Effects

```css
.box {
  background:
    linear-gradient(180deg, transparent, rgb(0 0 0 / 0.5)),
    url("hero.jpg") center / cover no-repeat;
  background-clip: text; /* gradient text */
  -webkit-background-clip: text;
}

.card {
  border: 1px solid oklch(80% 0 0);
  border-radius: 0.5rem;
  box-shadow:
    0 1px 2px oklch(0% 0 0 / 0.1),
    0 4px 12px oklch(0% 0 0 / 0.05);
}

.glass {
  backdrop-filter: blur(12px) saturate(180%);
  background: oklch(100% 0 0 / 0.6);
}
```

### Modern Gradients
```css
.conic { background: conic-gradient(from 0deg, red, yellow, green, blue, red); }
.radial { background: radial-gradient(circle at top, white, black); }
.hue { background: linear-gradient(in oklch longer hue, red, blue); }
```

---

## 10. Transitions & Animations

```css
.btn {
  transition: background-color 200ms ease-out,
              transform 150ms ease;
}

.btn:hover { transform: translateY(-2px); }

@keyframes fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.entrance {
  animation: fade-in 300ms ease-out both;
}

/* Animate to/from auto with calc-size or display: none */
.menu {
  display: none;
  transition: display 200ms allow-discrete, opacity 200ms;
  opacity: 0;
}
.menu.open {
  display: block;
  opacity: 1;
  @starting-style { opacity: 0; }
}

/* Scroll-driven animations */
@keyframes reveal {
  from { opacity: 0; }
  to { opacity: 1; }
}
.reveal {
  animation: reveal linear;
  animation-timeline: view();
  animation-range: entry 0% cover 30%;
}

/* Respect motion preferences */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Best Practices
- Animate `transform` and `opacity` (compositor-only) for 60fps
- Avoid animating `width`, `height`, `top`, `left` (layout thrash)
- Use `will-change` sparingly; remove after animation
- Provide `prefers-reduced-motion` alternative

---

## 11. Transforms

```css
.box {
  transform: translate(10px, 20px) rotate(45deg) scale(1.2);
  transform-origin: top left;
}

/* Individual transforms (composable) */
.box {
  translate: 10px 20px;
  rotate: 45deg;
  scale: 1.2;
}

/* 3D */
.scene { perspective: 1000px; }
.card {
  transform-style: preserve-3d;
  transform: rotateY(20deg);
  backface-visibility: hidden;
}
```

---

## 12. Responsive Design

### Mobile-First Media Queries
```css
.card { padding: 1rem; }

@media (min-width: 48rem) {
  .card { padding: 2rem; }
}

/* Range syntax */
@media (768px <= width < 1024px) { ... }

/* Feature queries */
@media (hover: hover) and (pointer: fine) {
  .btn:hover { ... }
}

@media (prefers-color-scheme: dark) { ... }
@media (prefers-reduced-motion: reduce) { ... }
@media (prefers-contrast: more) { ... }
@media (forced-colors: active) { ... }
@media (display-mode: standalone) { ... }
@media (orientation: portrait) { ... }
@media (resolution: 2dppx) { ... }
```

### Feature Queries
```css
@supports (display: grid) {
  .layout { display: grid; }
}

@supports not (selector(:has(*))) {
  /* Fallback for browsers without :has */
}
```

### Fluid Sizing with `clamp()`
```css
.container {
  inline-size: clamp(20rem, 90vw, 75rem);
  font-size: clamp(1rem, 0.9rem + 0.5vw, 1.25rem);
  padding: clamp(1rem, 5vw, 3rem);
}
```

---

## 13. Functions

### Math
- `calc()` — basic math
- `min()`, `max()`, `clamp()`
- `round()`, `mod()`, `rem()`
- `sin()`, `cos()`, `tan()`, `asin()`, `acos()`, `atan()`, `atan2()`
- `sqrt()`, `pow()`, `exp()`, `log()`, `hypot()`, `abs()`, `sign()`

### Color
- `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`
- `color()`, `color-mix()`, `light-dark()`

### Other
- `var()`, `env()`, `attr()`
- `url()`, `image-set()`
- `linear-gradient()`, `radial-gradient()`, `conic-gradient()`

---

## 14. Modern CSS Features

### Nesting (Native)
```css
.card {
  padding: 1rem;

  & .title {
    font-size: 1.5rem;
  }

  &:hover {
    background: oklch(95% 0 0);
  }

  @media (min-width: 48rem) {
    padding: 2rem;
  }
}
```

### Scope
```css
@scope (.card) to (.content) {
  :scope { padding: 1rem; }
  img { border-radius: 0.5rem; }
}
```

### Anchor Positioning
```css
.tooltip {
  position: absolute;
  position-anchor: --my-anchor;
  top: anchor(bottom);
  left: anchor(center);
}
```

### View Transitions
```css
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 300ms;
}

.card { view-transition-name: card; }
```

```js
document.startViewTransition(() => updateDOM());
```

### Popover & Dialog
```css
[popover] { ... }
:popover-open { ... }
::backdrop { background: oklch(0% 0 0 / 0.5); }

dialog[open] { ... }
dialog::backdrop { backdrop-filter: blur(4px); }
```

### Container Style Queries (limited support)
```css
@container style(--theme: dark) { ... }
```

---

## 15. Accessibility

```css
/* Visible focus */
:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

/* Don't remove outlines without replacement */
:focus { outline: none; } /* BAD without :focus-visible */

/* Screen reader only */
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
}

/* Tap targets >= 44x44px */
button { min-block-size: 2.75rem; min-inline-size: 2.75rem; }

/* Respect user preferences */
@media (prefers-reduced-motion: reduce) { ... }
@media (prefers-reduced-transparency: reduce) { ... }
@media (prefers-contrast: more) { ... }
@media (forced-colors: active) {
  .btn { border: 1px solid CanvasText; }
}
```

### Best Practices
- Maintain WCAG color contrast (4.5:1 body, 3:1 large text)
- Don't convey info via color alone
- Use semantic HTML; CSS shouldn't replace it
- Use `pointer-events: none` carefully (breaks keyboard accessibility independently)
- Use system colors (`Canvas`, `CanvasText`, `LinkText`, etc.) in `forced-colors`

---

## 16. Performance

### Critical CSS
- Inline critical above-the-fold CSS
- Defer non-critical with `media="print"` toggle or `rel="preload"`

### Properties That Are Cheap
- `transform`, `opacity`, `filter` (compositor-only)

### Properties That Are Expensive
- Layout: `width`, `height`, `padding`, `margin`, `top/left`
- Paint: `color`, `background`, `box-shadow`

### Containment
```css
.card {
  contain: layout paint style;
  content-visibility: auto;
  contain-intrinsic-size: auto 300px;
}
```

### Will-change
```css
.menu { will-change: transform; } /* Use temporarily, not permanently */
```

### Other
- Use `loading="lazy"` on images (HTML, but pairs with CSS)
- Use modern image formats (`avif`, `webp`) via `image-set()`
- Minimize selector complexity
- Avoid `@import` in CSS (blocks parallel loading); use `<link>`

---

## 17. Forms & Inputs

```css
input, textarea, select, button {
  font: inherit;
  color: inherit;
}

input:user-invalid { border-color: red; }
input:user-valid { border-color: green; }

input::placeholder { color: oklch(60% 0 0); }

/* Custom checkboxes via accent-color (cheap) */
input[type="checkbox"] { accent-color: var(--primary); }

/* Form validation */
input:required:invalid { ... }

/* Field sizing */
textarea { field-sizing: content; }
```

---

## 18. Logical Property Reference

| Physical | Logical |
|---|---|
| `width` | `inline-size` |
| `height` | `block-size` |
| `margin-top` | `margin-block-start` |
| `margin-bottom` | `margin-block-end` |
| `margin-left` | `margin-inline-start` |
| `margin-right` | `margin-inline-end` |
| `padding-top` | `padding-block-start` |
| `top`, `bottom` | `inset-block-start`, `inset-block-end` |
| `left`, `right` | `inset-inline-start`, `inset-inline-end` |
| `text-align: left` | `text-align: start` |
| `border-left` | `border-inline-start` |

Shorthands: `margin-block`, `margin-inline`, `padding-block`, `padding-inline`, `inset-block`, `inset-inline`.

---

## 19. Naming & Organization

### BEM
```css
.card { }
.card__title { }
.card__image { }
.card--featured { }
```

### Other Methodologies
- **OOCSS**: Separate structure from skin
- **SMACSS**: Base, Layout, Module, State, Theme
- **ITCSS**: Settings, Tools, Generic, Elements, Objects, Components, Utilities
- **Utility-first**: Tailwind-style atomic classes
- **CUBE CSS**: Composition, Utility, Block, Exception

### File Organization
```
styles/
  tokens/
  reset.css
  base/
  layouts/
  components/
  utilities/
  themes/
  main.css
```

### Best Practices
- Use consistent naming convention throughout project
- Prefer classes over IDs and tags for styling
- Use kebab-case for class names
- Keep selectors shallow
- Group related properties; use a consistent order (e.g., positioning → box model → typography → visual)

---

## 20. Reset / Normalize

```css
*, *::before, *::after { box-sizing: border-box; }

* { margin: 0; }

html { -webkit-text-size-adjust: 100%; tab-size: 4; }

body {
  min-block-size: 100dvh;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

img, picture, video, canvas, svg {
  display: block;
  max-inline-size: 100%;
}

input, button, textarea, select { font: inherit; }

p, h1, h2, h3, h4, h5, h6 { overflow-wrap: break-word; }

#root, #__next { isolation: isolate; }
```

---

## 21. At-rules Reference

- `@import` (avoid; use bundler)
- `@media`
- `@supports`
- `@container`
- `@layer`
- `@scope`
- `@keyframes`
- `@font-face`
- `@font-feature-values`
- `@page` (print)
- `@property`
- `@starting-style`
- `@view-transition`
- `@charset`
- `@namespace`

---

## 22. Common Anti-Patterns to Avoid

- Using `!important` to win specificity battles (fix root cause)
- Magic numbers (`margin-top: 37px`)
- Deeply nested selectors (`.a .b .c .d span`)
- Styling by ID (`#header`)
- Type selectors with class (`div.card`)
- Removing focus outlines without replacement
- Using `px` for everything (no scaling for user font preferences)
- Animating `width`/`height`/`top`/`left` instead of `transform`
- Using `float` for layout (use Flexbox/Grid)
- Vendor prefixes for non-experimental features (use Autoprefixer if needed)
- `* { transition: all }` (causes unintended animations)
- `position: absolute` without a positioned parent
- Hiding content with `display: none` when accessibility matters (vs. `aria-hidden`/`hidden` attribute)
- Inline styles (except for dynamic values)
- Magic background images (use semantic `<img>` for content)

---

## 23. Print Styles

```css
@media print {
  @page { margin: 2cm; }
  body { color: black; background: white; }
  a::after { content: " (" attr(href) ")"; }
  .no-print { display: none; }
}
```

---

## 24. Internationalization

```css
html { writing-mode: horizontal-tb; }

[dir="rtl"] .icon { transform: scaleX(-1); }

/* Use logical properties throughout */
.card { padding-inline-start: 1rem; }

/* Vertical writing modes */
.vertical { writing-mode: vertical-rl; text-orientation: mixed; }
```

---

## 25. CSS-in-JS / Build Considerations

- Prefer CSS Modules, Vanilla Extract, or plain CSS over runtime CSS-in-JS for performance
- Use PostCSS / Lightning CSS / esbuild for processing
- Autoprefixer for vendor prefixes
- Minify in production
- Use source maps in development
- Tree-shake unused styles (PurgeCSS, Tailwind JIT)

---

## 26. Quick Reference: Sensible Defaults

```css
:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;
  line-height: 1.5;
  --radius: 0.5rem;
  --space: 1rem;
}

*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; }

body {
  min-block-size: 100dvh;
  -webkit-font-smoothing: antialiased;
}

img, svg, video { display: block; max-inline-size: 100%; }

:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
