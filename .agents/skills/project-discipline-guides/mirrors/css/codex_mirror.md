Below is a “Redundancy Mirror” of CSS knowledge I would treat as broadly common, native working knowledge when building modern web interfaces. It intentionally includes fundamentals, modern syntax, maintainability conventions, layout patterns, progressive enhancement, and browser API usage that I would apply by default without needing project-specific guidance.

**CSS Best Practices And Common Knowledge**

**Core Mental Model**

CSS is a declarative styling language built around the cascade, inheritance, specificity, source order, and computed values.

A good CSS implementation usually optimizes for:

- Predictable cascade behavior
- Low specificity
- Reusable design tokens
- Responsive layouts by default
- Accessibility-preserving visual styles
- Maintainable component boundaries
- Minimal layout shifts
- Progressive enhancement for newer features
- Clear separation between structure, behavior, and presentation
- Avoiding brittle selectors that depend on incidental DOM structure

CSS should generally describe visual rules, layout relationships, interaction states, and design-system constraints. JavaScript should usually handle state and behavior, while CSS should handle state presentation when possible through selectors, media queries, container queries, pseudo-classes, animations, and transitions.

**The Cascade**

The cascade determines which declaration wins when multiple rules target the same element.

Cascade order is affected by:

- Origin: user-agent, user, author
- Importance: normal vs `!important`
- Cascade layers
- Specificity
- Scoping proximity, where relevant
- Source order

Avoid relying on high specificity unless necessary. Prefer predictable ordering, layers, component boundaries, and custom properties.

Avoid excessive use of `!important`. It is appropriate for narrow utility overrides, accessibility-enforced styles, user preference overrides, or integration escape hatches, but should not be the default way to win conflicts.

**Specificity**

Specificity roughly ranks selectors as:

- Inline styles
- IDs
- Classes, attributes, and pseudo-classes
- Elements and pseudo-elements

Examples:

```css
button {
  color: black;
}

.button {
  color: blue;
}

#submit {
  color: red;
}
```

Prefer class selectors for authored styles. Avoid styling with IDs because they create high specificity and reduce reusability.

Avoid deep descendant selectors such as:

```css
.page .sidebar .section .card .title {
}
```

Prefer a local class:

```css
.card-title {
}
```

Use `:where()` to intentionally keep specificity low:

```css
:where(article, section, aside) h2 {
  margin-block-start: 0;
}
```

`:where()` always has zero specificity.

Use `:is()` to group selectors while preserving the specificity of its most specific argument:

```css
:is(h1, h2, h3) {
  line-height: 1.1;
}
```

Use `:not()` for exclusion logic, but avoid making selectors hard to understand:

```css
.button:not(:disabled) {
  cursor: pointer;
}
```

Use `:has()` for parent/state-aware styling where supported:

```css
.field:has(input:invalid) {
  border-color: red;
}
```

Treat `:has()` as a powerful modern selector. It is useful for forms, cards, navigation state, layout adjustments, and progressive enhancement, but avoid overly broad expensive selectors such as `body:has(...)` unless necessary.

**Cascade Layers**

Use `@layer` to create predictable groups of CSS.

Common layer order:

```css
@layer reset, base, tokens, layout, components, utilities, overrides;
```

Example:

```css
@layer reset {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
}

@layer base {
  body {
    margin: 0;
    font-family: system-ui, sans-serif;
  }
}

@layer components {
  .button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
}

@layer utilities {
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
```

Unlayered author styles outrank layered styles, so if using layers, be intentional about where third-party and app CSS are placed.

Cascade layers are especially useful for:

- Resets
- Design systems
- Utility classes
- Third-party CSS
- Framework integration
- Large applications with multiple style origins

**Inheritance**

Many text-related properties inherit by default:

- `color`
- `font-family`
- `font-size`
- `font-weight`
- `line-height`
- `text-align`
- `visibility`

Many box/layout properties do not inherit:

- `margin`
- `padding`
- `border`
- `display`
- `width`
- `height`
- `background`

Use inheritance deliberately for typography and design tokens.

Useful global patterns:

```css
body {
  color: var(--color-text);
  font-family: var(--font-body);
  line-height: 1.5;
}

button,
input,
textarea,
select {
  font: inherit;
}
```

**Box Model**

Use `box-sizing: border-box` globally:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}
```

This makes widths and heights include padding and border, which is usually easier to reason about.

Understand:

- Content box
- Padding
- Border
- Margin
- Scrollable overflow
- Containing blocks
- Formatting contexts

Margins can collapse vertically in normal block flow. Padding, borders, flex/grid containers, overflow contexts, and flow-root containers can prevent margin collapse.

Use logical properties instead of physical properties where possible:

```css
.card {
  padding-block: 1rem;
  padding-inline: 1.25rem;
  margin-block-end: 1rem;
}
```

Prefer:

- `margin-inline`
- `margin-block`
- `padding-inline`
- `padding-block`
- `border-inline`
- `border-block`
- `inset-inline`
- `inset-block`

Instead of always using:

- `margin-left`
- `margin-right`
- `padding-top`
- `bottom`

Logical properties support different writing modes and directions.

**Modern Units**

Common length units:

```css
px
rem
em
%
vw
vh
vmin
vmax
ch
ex
lh
rlh
```

Use `rem` for type and most spacing that should scale with user preferences.

Use `em` for values that should scale relative to the element’s font size.

Use `ch` for readable text widths:

```css
.article {
  max-inline-size: 70ch;
}
```

Use modern viewport units for mobile-safe layouts:

```css
.hero {
  min-block-size: 100dvh;
}
```

Relevant viewport units:

- `vh`, `vw`: classic viewport units
- `svh`, `svw`: small viewport
- `lvh`, `lvw`: large viewport
- `dvh`, `dvw`: dynamic viewport

Prefer `dvh` for full-height app surfaces when browser UI may expand/collapse.

Use `min()`, `max()`, and `clamp()` for responsive constraints:

```css
.container {
  inline-size: min(100% - 2rem, 72rem);
  margin-inline: auto;
}

h1 {
  font-size: clamp(2rem, 5vw, 4rem);
}
```

However, avoid viewport-scaled text when predictable readability is more important. Fluid type should be constrained and tested.

Use `calc()` for arithmetic:

```css
.sidebar {
  inline-size: calc(100% - var(--nav-width));
}
```

Modern CSS supports math functions such as:

```css
min()
max()
clamp()
calc()
round()
mod()
rem()
sin()
cos()
tan()
asin()
acos()
atan()
atan2()
pow()
sqrt()
hypot()
log()
exp()
abs()
sign()
```

Browser support varies for newer math functions, so use progressive enhancement for less-established ones.

**Custom Properties**

Use CSS custom properties for design tokens and runtime-themable values:

```css
:root {
  --color-bg: #ffffff;
  --color-text: #111827;
  --space-2: 0.5rem;
  --radius-md: 0.5rem;
}
```

Use them in declarations:

```css
.card {
  background: var(--color-bg);
  color: var(--color-text);
  padding: var(--space-2);
  border-radius: var(--radius-md);
}
```

Use fallbacks:

```css
.button {
  color: var(--button-color, currentColor);
}
```

Custom properties inherit by default.

Use component-local variables to make variants easier:

```css
.button {
  --button-bg: black;
  --button-color: white;

  background: var(--button-bg);
  color: var(--button-color);
}

.button[data-variant='danger'] {
  --button-bg: crimson;
}
```

This is often cleaner than duplicating full rule blocks.

Use `@property` to register typed custom properties when animating or constraining them:

```css
@property --progress {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}
```

This enables smoother interpolation for supported custom values.

Use progressive enhancement for `@property` if older browser support matters.

**Design Tokens**

Common token categories:

```css
--color-*
--font-*
--text-*
--space-*
--radius-*
--shadow-*
--border-*
--z-*
--duration-*
--ease-*
--container-*
```

Prefer semantic tokens over hard-coded values in components:

```css
:root {
  --color-surface: white;
  --color-surface-muted: #f8fafc;
  --color-text: #0f172a;
  --color-text-muted: #64748b;
  --color-accent: #2563eb;
}
```

Avoid using raw palette names everywhere:

```css
/* Less maintainable */
.alert {
  color: var(--red-700);
}

/* More semantic */
.alert {
  color: var(--color-danger-text);
}
```

A good system often has both:

- Primitive tokens: `--blue-500`, `--gray-100`
- Semantic tokens: `--color-action-bg`, `--color-danger-text`

**Color**

Modern CSS supports many color formats:

```css
#fff
#ffffff
rgb(255 255 255)
rgb(255 255 255 / 0.8)
hsl(220 80% 50%)
hsl(220 80% 50% / 0.8)
lab()
lch()
oklab()
oklch()
color()
color-mix()
```

Prefer modern space-separated syntax:

```css
color: rgb(15 23 42 / 0.9);
```

Use `currentColor` for borders, icons, and decorations that should follow text color:

```css
.icon {
  color: var(--color-accent);
  stroke: currentColor;
}
```

Use `transparent` carefully, especially with gradients, because transparent black can affect interpolation. Prefer explicit alpha colors where necessary.

Use `color-mix()` for deriving related colors:

```css
.button:hover {
  background: color-mix(in oklch, var(--color-accent), black 10%);
}
```

Use `oklch()` or `oklab()` for perceptually consistent color adjustments when supported.

Example:

```css
:root {
  --brand: oklch(55% 0.18 250);
}
```

Use `@supports` to progressively enhance modern color:

```css
.button {
  background: #2563eb;
}

@supports (background: oklch(55% 0.18 250)) {
  .button {
    background: oklch(55% 0.18 250);
  }
}
```

Ensure color contrast meets accessibility requirements. Text contrast should generally meet WCAG guidance:

- Normal text: at least 4.5:1
- Large text: at least 3:1
- Non-text UI indicators: at least 3:1 where applicable

Do not rely on color alone to convey state. Pair color with text, iconography, shape, position, or ARIA-accessible state.

**Typography**

Set a sensible body font stack:

```css
body {
  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
}
```

Use `line-height` unitlessly:

```css
body {
  line-height: 1.5;
}
```

Unitless line-height scales better with inherited font sizes.

Use readable line lengths:

```css
.prose {
  max-inline-size: 65ch;
}
```

Use `font-size-adjust` when fallback metrics matter.

Use `font-feature-settings` sparingly. Prefer higher-level properties when available:

```css
body {
  font-kerning: normal;
  font-variant-ligatures: common-ligatures;
}
```

Use `font-variation-settings` for variable fonts only when specific axes are needed:

```css
.logo {
  font-variation-settings: 'wght' 650;
}
```

Prefer standard properties like `font-weight`, `font-stretch`, and `font-style` where possible.

Use `@font-face` for custom fonts:

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}
```

Use `font-display: swap` or `optional` to reduce invisible text.

Prefer `woff2`.

Avoid loading too many font weights/styles. Variable fonts can reduce requests but still need performance care.

Use `text-wrap` where appropriate:

```css
h1,
h2,
h3 {
  text-wrap: balance;
}

p {
  text-wrap: pretty;
}
```

`text-wrap: balance` is useful for headings and short blocks. `text-wrap: pretty` can improve paragraph wrapping where supported.

Use `overflow-wrap` for long content:

```css
.content {
  overflow-wrap: break-word;
}
```

For very defensive wrapping:

```css
.content {
  overflow-wrap: anywhere;
}
```

Use `hyphens: auto` where language is specified:

```css
article {
  hyphens: auto;
}
```

Ensure the document has a correct `lang` attribute for hyphenation and accessibility.

**Resets And Base Styles**

A modern reset often includes:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  min-block-size: 100vh;
  font-family: system-ui, sans-serif;
  line-height: 1.5;
}

img,
picture,
svg,
canvas,
video {
  display: block;
  max-inline-size: 100%;
}

button,
input,
textarea,
select {
  font: inherit;
}

button {
  cursor: pointer;
}

:disabled {
  cursor: not-allowed;
}

textarea {
  resize: vertical;
}
```

Avoid removing all default focus styles globally.

Bad:

```css
*:focus {
  outline: none;
}
```

Better:

```css
:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

Use `:focus-visible` to avoid noisy mouse focus while preserving keyboard focus.

Use `prefers-reduced-motion` to reduce animations:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

A less aggressive version may be better in app-specific contexts.

**Layout Fundamentals**

Prefer normal document flow where possible. Reach for absolute positioning only when an element should be removed from flow.

Common layout mechanisms:

- Block flow
- Inline flow
- Flexbox
- Grid
- Multi-column layout
- Positioned layout
- Float, mostly for legacy text wrapping
- Table layout, mostly for actual tables or special layout constraints

Use `display: flow-root` to create a new block formatting context:

```css
.card {
  display: flow-root;
}
```

This can contain floats and prevent margin collapse.

**Flexbox**

Use flexbox for one-dimensional layout: rows or columns.

```css
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
```

Common properties:

```css
display: flex;
flex-direction: row | column;
flex-wrap: wrap;
justify-content: flex-start | center | space-between;
align-items: stretch | center | baseline;
align-content: start | center | space-between;
gap: 1rem;
```

Child properties:

```css
.item {
  flex: 1 1 auto;
  align-self: center;
  order: 2;
}
```

Use `gap` instead of margins for spacing between flex children.

Know that flex items have `min-width: auto` by default, which can cause overflow. Use:

```css
.flex-child {
  min-inline-size: 0;
}
```

This is common for truncation and nested layouts.

For equal-width flexible children:

```css
.item {
  flex: 1 1 0;
}
```

For fixed-size controls in a flexible row:

```css
.icon-button {
  flex: 0 0 auto;
}
```

For wrapping layouts:

```css
.cluster {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
```

**Grid**

Use grid for two-dimensional layout.

```css
.dashboard {
  display: grid;
  grid-template-columns: 16rem 1fr;
  gap: 1rem;
}
```

Use `fr` units for distributing available space:

```css
.layout {
  grid-template-columns: 1fr 2fr;
}
```

Use `minmax()` to prevent overflow:

```css
.grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
```

Use responsive auto-fit patterns:

```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));
  gap: 1rem;
}
```

Use `auto-fill` when you want empty tracks preserved; use `auto-fit` when you want tracks to collapse and items to stretch.

Use named grid areas for page layouts where readability helps:

```css
.page {
  display: grid;
  grid-template:
    'header header' auto
    'nav main' 1fr
    / 16rem 1fr;
}

.header {
  grid-area: header;
}
```

Use subgrid where supported to align nested content to parent grid tracks:

```css
.card-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

.card {
  display: grid;
  grid-template-rows: subgrid;
}
```

Progressively enhance `subgrid` if supporting older browsers.

Use alignment properties:

```css
place-items: center;
place-content: center;
justify-items: start;
align-items: center;
```

`place-*` shorthands combine block and inline axis alignment.

**Container Queries**

Use container queries when components should respond to their own available space, not the viewport.

Define a query container:

```css
.card-shell {
  container-type: inline-size;
}
```

Query it:

```css
@container (min-width: 36rem) {
  .card {
    display: grid;
    grid-template-columns: 12rem 1fr;
  }
}
```

Use named containers when needed:

```css
.sidebar {
  container: sidebar / inline-size;
}

@container sidebar (min-width: 24rem) {
  .filter-panel {
    display: grid;
  }
}
```

Use container query units:

```css
.card-title {
  font-size: clamp(1rem, 5cqi, 1.5rem);
}
```

Container query units include:

- `cqw`
- `cqh`
- `cqi`
- `cqb`
- `cqmin`
- `cqmax`

Use container queries for:

- Cards
- Sidebars
- Toolbars
- Reusable modules
- Embeddable widgets
- Responsive components inside variable app layouts

Prefer media queries for global layout shifts and environment preferences. Prefer container queries for component-local responsiveness.

**Media Queries**

Use media queries for viewport, device, and user preference conditions.

```css
@media (min-width: 48rem) {
  .layout {
    display: grid;
    grid-template-columns: 16rem 1fr;
  }
}
```

Use range syntax:

```css
@media (width >= 48rem) {
}
```

Common media features:

```css
width
height
orientation
aspect-ratio
resolution
hover
any-hover
pointer
any-pointer
prefers-color-scheme
prefers-reduced-motion
prefers-contrast
forced-colors
prefers-reduced-transparency
prefers-reduced-data
update
scripting
display-mode
```

Use pointer/hover queries for interaction design:

```css
@media (hover: hover) and (pointer: fine) {
  .button:hover {
    background: var(--button-hover);
  }
}
```

Use dark mode:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0f172a;
    --color-text: #f8fafc;
  }
}
```

Use high contrast/forced colors support:

```css
@media (forced-colors: active) {
  .button {
    border: 1px solid ButtonText;
  }
}
```

Do not assume hover exists. Touch devices may not support hover reliably.

**Responsive Design**

Prefer mobile-first or content-first CSS:

```css
.card {
  display: grid;
  gap: 1rem;
}

@media (width >= 48rem) {
  .card {
    grid-template-columns: 16rem 1fr;
  }
}
```

Use intrinsic layout patterns instead of fixed breakpoints where possible:

```css
.grid {
  grid-template-columns: repeat(auto-fit, minmax(min(18rem, 100%), 1fr));
}
```

Use fluid constraints:

```css
.wrapper {
  inline-size: min(100% - 2rem, 72rem);
  margin-inline: auto;
}
```

Avoid fixed widths that break small screens:

```css
/* Avoid */
.modal {
  width: 600px;
}

/* Better */
.modal {
  inline-size: min(100% - 2rem, 37.5rem);
}
```

Prefer `max-inline-size` and `min()` for defensive sizing.

Ensure text, buttons, forms, tables, and media do not overflow small viewports.

Use horizontal scrolling only when appropriate, such as data tables:

```css
.table-wrap {
  overflow-x: auto;
}
```

**Positioning**

Position values:

```css
static
relative
absolute
fixed
sticky
```

Use `position: relative` to establish a containing block for absolute children.

```css
.card {
  position: relative;
}

.badge {
  position: absolute;
  inset-block-start: 0.5rem;
  inset-inline-end: 0.5rem;
}
```

Use logical inset properties:

```css
.toast {
  position: fixed;
  inset-block-end: 1rem;
  inset-inline-end: 1rem;
}
```

Use `position: sticky` for sticky headers/sidebars:

```css
.section-nav {
  position: sticky;
  inset-block-start: 1rem;
}
```

Sticky requires room to stick and can be affected by overflow ancestors.

Use z-index deliberately. Create a z-index scale:

```css
:root {
  --z-dropdown: 1000;
  --z-sticky: 1100;
  --z-modal: 1200;
  --z-toast: 1300;
}
```

Remember stacking contexts can be created by:

- Positioned elements with z-index
- `opacity` less than 1
- `transform`
- `filter`
- `perspective`
- `isolation: isolate`
- `contain`
- `will-change`
- `mix-blend-mode`
- Some `clip-path`, `mask`, and animation states

Use `isolation: isolate` to contain stacking behavior:

```css
.app-shell {
  isolation: isolate;
}
```

**Overflow And Scrolling**

Use overflow intentionally:

```css
.panel {
  overflow: auto;
}
```

Use axis-specific properties:

```css
.panel {
  overflow-x: auto;
  overflow-y: hidden;
}
```

Use `overflow: clip` when content should be clipped without creating a scroll container:

```css
.media {
  overflow: clip;
}
```

Use `scrollbar-gutter` to avoid layout shift when scrollbars appear:

```css
html {
  scrollbar-gutter: stable;
}
```

Use scroll snapping for carousels or paged sections where appropriate:

```css
.carousel {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
}

.slide {
  flex: 0 0 100%;
  scroll-snap-align: start;
}
```

Use `scroll-margin` for anchored headings under sticky headers:

```css
[id] {
  scroll-margin-block-start: 5rem;
}
```

Use `overscroll-behavior` to control scroll chaining:

```css
.modal {
  overscroll-behavior: contain;
}
```

Use `scroll-behavior: smooth` carefully and disable or avoid it for users who prefer reduced motion:

```css
html {
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
```

**Sizing**

Prefer logical sizing:

```css
.box {
  inline-size: 100%;
  max-inline-size: 64rem;
  block-size: auto;
}
```

Use `min-block-size` rather than `height` for flexible vertical sections:

```css
.hero {
  min-block-size: 100dvh;
}
```

Use aspect ratio for media and fixed-format UI:

```css
.thumbnail {
  aspect-ratio: 16 / 9;
  object-fit: cover;
}
```

Use intrinsic sizing keywords:

```css
width: min-content;
width: max-content;
width: fit-content;
```

Use defensive grid/flex sizing:

```css
grid-template-columns: minmax(0, 1fr);
min-inline-size: 0;
```

Avoid setting `height: 100vh` for mobile full-screen UIs unless dynamic viewport behavior has been considered.

Prefer:

```css
min-block-size: 100dvh;
```

**Images And Media**

Make images responsive:

```css
img {
  max-inline-size: 100%;
  block-size: auto;
}
```

Use `object-fit`:

```css
.avatar {
  inline-size: 3rem;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 50%;
}
```

Values:

```css
fill
contain
cover
none
scale-down
```

Use `object-position` for crop alignment:

```css
.hero-image {
  object-fit: cover;
  object-position: center top;
}
```

Use `aspect-ratio` to prevent layout shift.

Use `background-image` for decorative images, not meaningful content. Use `<img>` or `<picture>` for content images.

Use CSS gradients for lightweight decoration:

```css
.banner {
  background:
    linear-gradient(rgb(0 0 0 / 0.3), rgb(0 0 0 / 0.3)),
    url('/image.jpg') center / cover;
}
```

**Backgrounds And Borders**

Useful background properties:

```css
background-color
background-image
background-repeat
background-position
background-size
background-origin
background-clip
background-attachment
```

Use shorthand carefully:

```css
.hero {
  background: url('/hero.jpg') center / cover no-repeat;
}
```

Multiple backgrounds stack front-to-back:

```css
.hero {
  background:
    linear-gradient(rgb(0 0 0 / 0.4), rgb(0 0 0 / 0.4)),
    url('/hero.jpg') center / cover no-repeat;
}
```

Use border logical properties:

```css
.card {
  border-block-start: 1px solid var(--color-border);
}
```

Use `border-radius` consistently from tokens:

```css
.card {
  border-radius: var(--radius-md);
}
```

Use `outline` for focus rings because it does not affect layout.

**Shadows And Elevation**

Use shadows sparingly and consistently.

```css
:root {
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.08);
  --shadow-md: 0 8px 24px rgb(0 0 0 / 0.12);
}
```

Avoid overly heavy shadows. Combine subtle border and shadow for surfaces:

```css
.card {
  border: 1px solid rgb(0 0 0 / 0.08);
  box-shadow: var(--shadow-sm);
}
```

Use `filter: drop-shadow()` for irregular shapes and transparent images:

```css
.logo {
  filter: drop-shadow(0 2px 4px rgb(0 0 0 / 0.2));
}
```

Use performance care with large blurred shadows and filters.

**Forms**

Preserve usability and accessibility.

Use `font: inherit` on controls.

```css
input,
button,
textarea,
select {
  font: inherit;
}
```

Use visible focus states:

```css
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
button:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

Style disabled states clearly:

```css
:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
```

Use pseudo-classes:

```css
input:required
input:optional
input:valid
input:invalid
input:user-valid
input:user-invalid
input:placeholder-shown
input:checked
input:indeterminate
input:disabled
input:enabled
input:read-only
input:read-write
```

Example:

```css
.field:has(input:user-invalid) .error {
  display: block;
}
```

Use `accent-color` for native checkbox/radio/range accents:

```css
:root {
  accent-color: var(--color-accent);
}
```

Use `caret-color` where useful:

```css
input {
  caret-color: var(--color-accent);
}
```

Use `color-scheme` to improve native form controls in dark mode:

```css
:root {
  color-scheme: light dark;
}
```

Or per theme:

```css
[data-theme='dark'] {
  color-scheme: dark;
}
```

Use `appearance: none` only when fully replacing native control styling and preserving accessibility.

Avoid making custom select/checkbox/radio controls unless necessary. Native controls are usually more accessible and robust.

Use `resize: vertical` for textareas unless a fixed behavior is required.

```css
textarea {
  resize: vertical;
}
```

**Buttons And Interactive Elements**

Use semantic HTML first:

- `<button>` for actions
- `<a>` for navigation
- Form controls for form inputs

CSS should not compensate for incorrect semantics.

Button baseline:

```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-block-size: 2.5rem;
  padding-inline: 1rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font: inherit;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}
```

Support states:

```css
.button:hover {
}

.button:active {
}

.button:focus-visible {
}

.button:disabled,
.button[aria-disabled='true'] {
}
```

Do not rely only on `:hover`.

For icon buttons, ensure stable dimensions:

```css
.icon-button {
  display: inline-grid;
  place-items: center;
  inline-size: 2.5rem;
  block-size: 2.5rem;
}
```

Ensure accessible names are provided in HTML via text, `aria-label`, or associated content.

**Links**

Links should be visually identifiable.

```css
a {
  color: var(--color-link);
  text-decoration-thickness: from-font;
  text-underline-offset: 0.15em;
}
```

Use hover/focus states:

```css
a:hover {
  text-decoration-style: solid;
}

a:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

Avoid removing underlines from body text links unless another clear affordance exists.

**Tables**

Use semantic tables for tabular data.

```css
table {
  inline-size: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 0.75rem;
  text-align: start;
  border-block-end: 1px solid var(--color-border);
}
```

Use wrappers for overflow:

```css
.table-wrap {
  overflow-x: auto;
}
```

Use `caption-side` if styling captions:

```css
caption {
  caption-side: bottom;
}
```

Use sticky headers carefully:

```css
thead th {
  position: sticky;
  inset-block-start: 0;
  background: var(--color-surface);
}
```

**Lists**

Use semantic lists for grouped items.

Remove list styling only when the semantics remain useful but the visual bullets are unwanted:

```css
.nav-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
```

Use `::marker` for marker styling:

```css
li::marker {
  color: var(--color-accent);
}
```

**Pseudo-Classes**

Common pseudo-classes:

```css
:hover
:active
:focus
:focus-visible
:focus-within
:visited
:target
:checked
:disabled
:enabled
:required
:optional
:valid
:invalid
:user-valid
:user-invalid
:placeholder-shown
:first-child
:last-child
:only-child
:nth-child()
:nth-last-child()
:first-of-type
:last-of-type
:empty
:not()
:is()
:where()
:has()
:root
:scope
:lang()
:dir()
:fullscreen
:popover-open
:modal
```

Use `:focus-within` for parent styling:

```css
.search {
  border: 1px solid var(--color-border);
}

.search:focus-within {
  border-color: var(--color-focus);
}
```

Use `:target` for anchor-linked sections:

```css
:target {
  scroll-margin-block-start: 5rem;
}
```

Use modern `nth-child` selector syntax:

```css
.item:nth-child(odd) {
}

.item:nth-child(3n + 1) {
}

.item:nth-child(2 of .featured) {
}
```

Use `:empty` cautiously because whitespace text nodes affect it.

**Pseudo-Elements**

Common pseudo-elements:

```css
::before
::after
::marker
::placeholder
::selection
::backdrop
::file-selector-button
::first-letter
::first-line
::cue
::part()
::slotted()
```

Use `::before` and `::after` for decorative generated content:

```css
.badge::before {
  content: '';
  inline-size: 0.5rem;
  block-size: 0.5rem;
  border-radius: 50%;
  background: currentColor;
}
```

Do not put meaningful content only in CSS pseudo-elements because assistive technology support can vary and generated content is not a substitute for semantic HTML.

Style selection:

```css
::selection {
  background: var(--color-selection-bg);
  color: var(--color-selection-text);
}
```

Style placeholders with adequate contrast:

```css
::placeholder {
  color: var(--color-text-muted);
  opacity: 1;
}
```

Use `::backdrop` for dialogs/popovers:

```css
dialog::backdrop {
  background: rgb(0 0 0 / 0.5);
}
```

Use `::file-selector-button` for file inputs:

```css
input[type='file']::file-selector-button {
  font: inherit;
}
```

**Nesting**

Modern CSS supports native nesting.

```css
.card {
  padding: 1rem;

  & h2 {
    margin-block-start: 0;
  }

  &:hover {
    border-color: var(--color-accent);
  }

  @media (width >= 48rem) {
    padding: 1.5rem;
  }
}
```

Use nesting sparingly. Avoid deeply nested selectors because they increase coupling and specificity.

Good:

```css
.card {
  & > header {
  }

  & .card-title {
  }

  &:has(img) {
  }
}
```

Avoid:

```css
.page {
  & .sidebar {
    & .nav {
      & ul {
        & li {
          & a {
          }
        }
      }
    }
  }
}
```

Nested CSS should improve locality, not recreate DOM trees.

**Scoping**

Use local component classes, cascade layers, CSS modules, shadow DOM, or naming conventions to keep styles scoped.

Modern CSS includes `@scope`:

```css
@scope (.card) {
  h2 {
    margin-block-start: 0;
  }
}
```

Use progressive enhancement if relying on `@scope`, since browser support may vary.

`@scope` is useful for limiting broad selectors to a subtree without increasing specificity.

**Animations And Transitions**

Use transitions for simple state changes:

```css
.button {
  transition:
    background-color 150ms ease,
    color 150ms ease,
    border-color 150ms ease;
}
```

Prefer animating compositor-friendly properties:

- `transform`
- `opacity`

Avoid animating layout-heavy properties where possible:

- `width`
- `height`
- `top`
- `left`
- `margin`
- `padding`

Use `@keyframes` for defined animations:

```css
@keyframes fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.dialog {
  animation: fade-in 180ms ease-out;
}
```

Use custom easing tokens:

```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 150ms;
}
```

Respect reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  .dialog {
    animation: none;
  }
}
```

Use `transition-behavior: allow-discrete` for discrete transitions where supported:

```css
.popover {
  transition:
    opacity 150ms ease,
    display 150ms allow-discrete;
}
```

Use `@starting-style` for entry transitions where supported:

```css
[popover]:popover-open {
  opacity: 1;

  @starting-style {
    opacity: 0;
  }
}
```

Use progressive enhancement for newer transition features.

Use scroll-driven animations progressively:

```css
@supports (animation-timeline: scroll()) {
  .progress {
    animation: grow linear both;
    animation-timeline: scroll();
  }
}
```

Scroll-driven animations are useful for progress indicators and reveal effects but should be optional and motion-safe.

**Transforms**

Common transforms:

```css
translate
scale
rotate
skew
matrix
perspective
```

Prefer individual transform properties where useful:

```css
.card:hover {
  translate: 0 -2px;
  scale: 1.01;
}
```

Instead of always composing:

```css
transform: translateY(-2px) scale(1.01);
```

Use `transform-origin`:

```css
.menu {
  transform-origin: top right;
}
```

Transforms create stacking contexts and affect containing blocks for fixed/absolute descendants in some cases.

**Filters, Blend Modes, Masks**

Use filters carefully because they can be expensive:

```css
.image {
  filter: grayscale(1) contrast(1.1);
}
```

Common filters:

```css
blur()
brightness()
contrast()
drop-shadow()
grayscale()
hue-rotate()
invert()
opacity()
saturate()
sepia()
```

Use `backdrop-filter` for translucent UI, with fallback:

```css
.panel {
  background: rgb(255 255 255 / 0.85);
}

@supports (backdrop-filter: blur(12px)) {
  .panel {
    background: rgb(255 255 255 / 0.65);
    backdrop-filter: blur(12px);
  }
}
```

Use blend modes sparingly:

```css
.overlay {
  mix-blend-mode: multiply;
}
```

Use masks for advanced clipping where appropriate:

```css
.fade {
  mask-image: linear-gradient(black, transparent);
}
```

Provide fallbacks for important content.

**Clipping And Shapes**

Use `clip-path` for visual clipping:

```css
.avatar {
  clip-path: circle();
}
```

Use `border-radius` for simple rounded clipping.

Use `shape-outside` for text wrapping around floated shapes:

```css
.figure {
  float: inline-start;
  shape-outside: circle();
}
```

This is less common but valid for editorial layouts.

**Containment And Performance**

Use `contain` to isolate rendering/layout/paint when appropriate:

```css
.widget {
  contain: layout paint;
}
```

Values include:

```css
size
layout
style
paint
content
strict
```

Use `content-visibility` for large offscreen sections:

```css
.section {
  content-visibility: auto;
  contain-intrinsic-size: 600px;
}
```

This can improve initial rendering performance for long pages.

Use `will-change` sparingly and temporarily:

```css
.card {
  will-change: transform;
}
```

Do not apply `will-change` broadly. It can increase memory use.

Avoid layout thrash from CSS choices that force excessive reflow.

Minimize expensive selectors across huge DOMs, though modern engines are generally efficient.

Avoid unnecessary deeply nested selectors, universal selectors in hot subtrees, and broad `:has()` selectors when performance matters.

**Accessibility**

CSS should preserve accessibility.

Do not remove focus indicators.

Use `:focus-visible`:

```css
:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

Use reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    scroll-behavior: auto;
  }
}
```

Respect user color preferences:

```css
@media (prefers-color-scheme: dark) {
}
```

Support forced colors:

```css
@media (forced-colors: active) {
  .button {
    forced-color-adjust: auto;
  }
}
```

Avoid hiding content from screen readers unintentionally.

Visually hidden utility:

```css
.visually-hidden {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

Do not use `display: none` or `visibility: hidden` for content that should remain available to assistive tech.

Use sufficient touch targets, generally around 44 by 44 CSS pixels where possible.

Do not use CSS to reorder content in ways that break keyboard or screen-reader reading order.

Be cautious with:

```css
order
grid-area
position: absolute
```

Visual order should usually match DOM order.

Use `prefers-contrast` where useful:

```css
@media (prefers-contrast: more) {
  :root {
    --color-border: CanvasText;
  }
}
```

Use `forced-color-adjust` only when you have a strong reason to opt out of system colors.

**Hiding Content**

Different hiding techniques have different effects.

Remove visually and from accessibility tree:

```css
.hidden {
  display: none;
}
```

Hide visually but preserve layout:

```css
.invisible {
  visibility: hidden;
}
```

Hide visually but preserve for screen readers:

```css
.sr-only {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

Hide overflow:

```css
.clipped {
  overflow: hidden;
}
```

Use the right hiding technique for the intended behavior.

**Logical Properties And Internationalization**

Prefer logical properties:

```css
margin-inline-start
margin-inline-end
margin-block-start
margin-block-end
padding-inline
padding-block
border-inline
border-block
inset-inline
inset-block
inline-size
block-size
min-inline-size
max-inline-size
min-block-size
max-block-size
```

Use logical values:

```css
text-align: start;
float: inline-start;
clear: inline-end;
```

This improves support for RTL and vertical writing modes.

Use `:dir()` for direction-specific styling:

```css
:dir(rtl) .icon {
  scale: -1 1;
}
```

Use `:lang()` for language-specific typography:

```css
:lang(ja) {
  line-break: strict;
}
```

**Theming**

Use custom properties and attributes/classes for themes:

```css
:root {
  --color-bg: white;
  --color-text: black;
}

[data-theme='dark'] {
  --color-bg: #0f172a;
  --color-text: #f8fafc;
  color-scheme: dark;
}
```

Use media query defaults:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0f172a;
    --color-text: #f8fafc;
    color-scheme: dark;
  }
}
```

Allow explicit user choice to override system preference.

Avoid duplicating entire component styles for themes. Prefer token changes.

**Component Styling**

Good component CSS typically:

- Has a single clear root class
- Uses custom properties for variants
- Keeps specificity low
- Avoids leaking styles globally
- Defines all relevant states
- Uses stable dimensions where needed
- Handles overflow and long content
- Works in different containers
- Does not rely on exact page placement

Example:

```css
.alert {
  --alert-bg: var(--color-info-bg);
  --alert-border: var(--color-info-border);
  --alert-text: var(--color-info-text);

  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--alert-border);
  border-radius: var(--radius-md);
  background: var(--alert-bg);
  color: var(--alert-text);
}

.alert[data-tone='danger'] {
  --alert-bg: var(--color-danger-bg);
  --alert-border: var(--color-danger-border);
  --alert-text: var(--color-danger-text);
}
```

Use data attributes for state and variants when appropriate:

```css
.tabs [role='tab'][aria-selected='true'] {
  color: var(--color-accent);
}
```

Styling ARIA states is appropriate, but ARIA should not be added only for styling. Use ARIA when it represents real accessibility state.

**Utility Classes**

Utility classes can be useful for common single-purpose styles.

Examples:

```css
.stack {
  display: grid;
  gap: var(--stack-gap, 1rem);
}

.cluster {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--cluster-gap, 0.75rem);
}

.center {
  display: grid;
  place-items: center;
}

.wrapper {
  inline-size: min(100% - 2rem, var(--wrapper-max, 72rem));
  margin-inline: auto;
}
```

Avoid creating uncontrolled utility sprawl without conventions.

Use utilities for:

- Layout primitives
- Spacing helpers
- Visually hidden content
- Text truncation
- Container wrappers
- Repeated alignment patterns

**Common Layout Patterns**

Stack:

```css
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--gap, 1rem);
}
```

Cluster:

```css
.cluster {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--gap, 0.75rem);
}
```

Sidebar:

```css
.with-sidebar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.with-sidebar > :first-child {
  flex: 0 0 16rem;
}

.with-sidebar > :last-child {
  flex: 1 1 0;
  min-inline-size: min(100%, 24rem);
}
```

Responsive grid:

```css
.auto-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));
  gap: 1rem;
}
```

Holy grail layout:

```css
.app {
  min-block-size: 100dvh;
  display: grid;
  grid-template:
    'header header' auto
    'sidebar main' 1fr
    / auto 1fr;
}
```

Centering:

```css
.center {
  display: grid;
  place-items: center;
}
```

Media object:

```css
.media-object {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}
```

Sticky footer:

```css
body {
  min-block-size: 100dvh;
  display: grid;
  grid-template-rows: auto 1fr auto;
}
```

Text truncation:

```css
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

Multi-line clamp:

```css
.line-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

Modern `line-clamp` support is improving, but prefixed syntax remains common.

**State Styling**

Use classes, data attributes, ARIA attributes, and pseudo-classes.

```css
.menu[data-open='true'] {
  display: block;
}

.accordion-button[aria-expanded='true'] .icon {
  rotate: 180deg;
}

.form-field:has(:focus-visible) {
  border-color: var(--color-focus);
}
```

Prefer state attributes that reflect real state.

Avoid relying on class names like `.active` without clear ownership in large systems if attributes are more descriptive.

**Dialogs, Popovers, And Top Layer**

Style native dialogs:

```css
dialog {
  border: 0;
  border-radius: var(--radius-md);
  padding: 0;
  max-inline-size: min(100% - 2rem, 40rem);
}

dialog::backdrop {
  background: rgb(0 0 0 / 0.5);
}
```

Use `:modal` where appropriate:

```css
dialog:modal {
  box-shadow: var(--shadow-lg);
}
```

Style popovers:

```css
[popover] {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.5rem;
  background: var(--color-surface);
}

[popover]:popover-open {
  display: grid;
}
```

Use `@starting-style` and `transition-behavior` for progressive popover/dialog transitions.

Top-layer elements such as modal dialogs and popovers are not controlled by ordinary z-index in the same way as normal page elements.

**Anchor Positioning**

CSS Anchor Positioning is a cutting-edge feature useful for positioning popovers/tooltips relative to an anchor.

Conceptually:

```css
.trigger {
  anchor-name: --trigger;
}

.tooltip {
  position-anchor: --trigger;
  inset-area: block-end;
}
```

Support has historically been limited, so use as progressive enhancement with JS or simpler positioning fallback.

Use `@supports`:

```css
@supports (anchor-name: --anchor) {
  .trigger {
    anchor-name: --trigger;
  }
}
```

**View Transitions**

The View Transitions API can animate page or state transitions with CSS pseudo-elements.

Common CSS hooks include:

```css
::view-transition
::view-transition-group()
::view-transition-image-pair()
::view-transition-old()
::view-transition-new()
```

Example:

```css
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 200ms;
}
```

Use progressive enhancement. Do not make navigation depend on view transitions.

Respect reduced motion.

**CSS And Shadow DOM**

When styling web components:

Use `:host`:

```css
:host {
  display: block;
}
```

Use host states:

```css
:host([disabled]) {
  opacity: 0.5;
}
```

Use `::slotted()` for slotted content:

```css
::slotted(img) {
  max-inline-size: 100%;
}
```

Use `::part()` to expose styleable internals:

```css
custom-select::part(button) {
  border-radius: var(--radius-sm);
}
```

Custom properties cross shadow boundaries and are useful for theming.

**Feature Queries**

Use `@supports` for progressive enhancement:

```css
.card {
  display: flex;
}

@supports (display: grid) {
  .card {
    display: grid;
  }
}
```

Use selector feature queries:

```css
@supports selector(:has(*)) {
  .field:has(input:invalid) {
    border-color: red;
  }
}
```

Use negative feature queries carefully:

```css
@supports not (container-type: inline-size) {
}
```

Prefer a solid baseline fallback first, then enhanced styles.

**Imports**

Use `@import` sparingly in production CSS because it can delay loading. Prefer bundler-managed imports or HTML `<link>` where appropriate.

If using `@import`, put it at the top before normal style rules:

```css
@import url('./tokens.css') layer(tokens);
```

Modern `@import` can specify layers and supports:

```css
@import url('./modern.css') supports(display: grid) layer(components);
```

**Print Styles**

Add print styles for content-heavy pages:

```css
@media print {
  body {
    color: black;
    background: white;
  }

  nav,
  aside,
  .no-print {
    display: none;
  }

  a[href]::after {
    content: ' (' attr(href) ')';
  }
}
```

Avoid printing unnecessary UI.

Ensure text is legible and backgrounds are not required.

**CSS Syntax**

Ruleset:

```css
selector {
  property: value;
}
```

Comments:

```css
/* Comment */
```

Custom properties:

```css
--name: value;
property: var(--name);
```

At-rules:

```css
@media {}
@supports {}
@container {}
@layer {}
@scope {}
@keyframes {}
@property {}
@font-face {}
@import
@charset
@page
```

Shorthands:

```css
margin: 1rem;
padding: 1rem 2rem;
border: 1px solid currentColor;
background: white url('/x.png') center / cover no-repeat;
font: italic 700 1rem/1.5 system-ui;
```

Use shorthands carefully because they reset omitted subproperties.

Example:

```css
background: red;
```

This resets background image, position, size, repeat, and related longhands.

Use longhands when preserving existing subproperties matters.

**Selectors**

Common selectors:

```css
*                         /* universal */
div                       /* type */
.button                   /* class */
#main                     /* id */
[disabled]                /* attribute */
[type='button']           /* exact attribute */
[href^='https']           /* starts with */
[href$='.pdf']            /* ends with */
[class*='icon']           /* contains */
.parent .child            /* descendant */
.parent > .child          /* direct child */
.item + .item             /* adjacent sibling */
.item ~ .item             /* general sibling */
```

Prefer stable class/data selectors over styling incidental DOM.

Avoid styling generated framework class names unless they are stable API.

Use attribute selectors for state and variants:

```css
.button[data-size='sm'] {
}
```

**Naming**

Common naming approaches:

- BEM-like: `.card`, `.card__title`, `.card--featured`
- Utility-first: `.flex`, `.gap-4`, `.text-sm`
- Component-scoped classes
- CSS Modules
- Data attributes for state
- Design-system tokens

Whatever the naming convention, names should be:

- Clear
- Stable
- Purposeful
- Not overly tied to current visual style
- Not overly tied to DOM depth

Prefer `.product-card` over `.blue-box`.

Prefer `.sidebar-nav` over `.left-stuff`.

Avoid vague classes like `.thing`, `.box1`, `.new-style`.

**Maintainability**

Keep CSS organized by responsibility:

- Reset/base
- Tokens
- Typography
- Layout primitives
- Components
- Utilities
- Overrides

Avoid global leakage.

Avoid magic numbers. Use named tokens or explain unavoidable values.

Avoid duplicating large rule blocks. Use custom properties, shared classes, or component composition.

Keep specificity flat.

Use comments for non-obvious hacks or browser workarounds:

```css
/* Prevent flex child from overflowing when the title is truncated. */
.card-title {
  min-inline-size: 0;
}
```

Remove dead CSS.

Use formatting consistently.

Use linting where available.

Common tools:

- Stylelint
- Prettier
- PostCSS
- Autoprefixer
- CSS Modules
- Sass, Less, or modern native CSS depending on stack
- Lightning CSS
- Bundler CSS pipelines

Do not add a preprocessor just for nesting or variables now that native CSS supports many of those features, unless the project already uses one or needs its module/mixin tooling.

**Preprocessors**

Sass/Less remain useful for:

- Build-time functions
- Loops
- Maps
- Mixins
- File organization
- Legacy browser support
- Existing codebases

But prefer native CSS features when they meet the need:

- Custom properties over Sass variables for runtime theming
- Native nesting over Sass nesting if supported by tooling
- Cascade layers over import-order hacks
- Container queries over breakpoint mixins for component responsiveness

Avoid overusing mixins that hide emitted CSS complexity.

**CSS Modules And Scoped CSS**

CSS Modules prevent accidental global collisions.

Example:

```css
.card {
  padding: 1rem;
}
```

Used from JS as an imported class map.

Good for component applications.

Still use semantic class names and design tokens. CSS Modules do not remove the need for good cascade and layout practices.

**CSS-In-JS**

CSS-in-JS can be useful for dynamic styling, colocated component styles, and design-system abstractions.

Prefer static extraction where possible.

Avoid generating excessive runtime styles.

Use CSS variables for dynamic values instead of creating new classes/rules for every value.

Example:

```css
.card {
  border-color: var(--card-border);
}
```

Then set:

```html
<div class="card" style="--card-border: red"></div>
```

Use inline styles for truly dynamic one-off values, not for broad styling systems.

**Utility-First CSS**

Utility-first systems such as Tailwind can be effective.

Best practices:

- Use design tokens consistently
- Extract repeated component patterns when markup becomes noisy
- Avoid arbitrary values unless necessary
- Keep responsive and state variants readable
- Do not fight the framework with lots of ad hoc CSS
- Preserve semantic HTML and accessibility

Utility-first CSS is still CSS; layout, cascade, specificity, and accessibility principles still apply.

**Performance**

CSS performance best practices:

- Keep CSS payload reasonably small
- Remove unused CSS
- Avoid loading unused fonts and weights
- Avoid render-blocking CSS where possible
- Inline only critical CSS when it materially helps
- Avoid excessive expensive effects
- Prefer transform/opacity animations
- Use `content-visibility` for long pages where appropriate
- Avoid frequent layout changes during animation
- Use modern image sizing to avoid layout shifts
- Avoid broad, complex selectors in enormous documents
- Use containment for isolated widgets
- Avoid unnecessary `will-change`
- Use cascade layers and low specificity to reduce override bloat

CSS is render-blocking by default, so file size and delivery strategy matter.

**Browser Compatibility**

Use progressive enhancement.

Baseline approach:

```css
.component {
  /* broadly supported fallback */
}

@supports (new-feature: value) {
  .component {
    /* enhancement */
  }
}
```

Do not ship a feature without fallback if it affects core usability.

Use build tools like Autoprefixer when supporting older browsers or features requiring prefixes.

Vendor prefixes still appear for some features:

```css
-webkit-line-clamp
-webkit-text-size-adjust
-webkit-font-smoothing
```

Avoid unnecessary prefixes in hand-authored CSS unless needed.

Do not rely on browser-specific pseudo-elements for essential behavior unless there is a fallback.

**Progressive Enhancement**

Good progressive enhancement means:

- The basic layout and content work everywhere you support
- Newer browsers get better layout, animation, color, or interaction
- Unsupported features fail harmlessly
- Critical functionality does not depend on decorative CSS
- Feature queries guard risky enhancements

Examples:

```css
.card {
  display: block;
}

@supports (display: grid) {
  .card {
    display: grid;
  }
}
```

```css
.popover {
  position: absolute;
}

@supports (anchor-name: --x) {
  .trigger {
    anchor-name: --trigger;
  }

  .popover {
    position-anchor: --trigger;
  }
}
```

**Common Modern Features I Would Consider Normal**

These are modern CSS features I would generally know and consider usable in current development, depending on project browser targets:

- Flexbox
- Grid
- Subgrid
- Container queries
- Container query units
- Cascade layers
- CSS nesting
- `:is()`
- `:where()`
- `:has()`
- `:focus-visible`
- Logical properties
- Dynamic viewport units
- `clamp()`, `min()`, `max()`
- `aspect-ratio`
- `gap` in flex and grid
- `color-mix()`
- `oklch()` / `oklab()`
- `accent-color`
- `color-scheme`
- `scroll-margin`
- `scroll-padding`
- `scroll-snap`
- `overscroll-behavior`
- `content-visibility`
- `contain-intrinsic-size`
- `@property`
- `@supports selector(...)`
- `@layer`
- `@container`
- Native dialog styling with `::backdrop`
- Popover styling with `:popover-open`
- `text-wrap: balance`
- `text-wrap: pretty`
- `line-clamp`
- Individual transform properties
- `:user-valid` / `:user-invalid`
- Range media query syntax

**Cutting-Edge Features Suitable For Progressive Enhancement**

Use these with fallbacks or feature queries:

- CSS Anchor Positioning
- Scroll-driven animations
- View Transitions API CSS pseudo-elements
- `@scope`
- Advanced CSS math functions
- `transition-behavior: allow-discrete`
- `@starting-style`
- Advanced color functions where support varies
- Newer selectors and pseudo-classes where support may lag
- Masonry-style CSS grid features, where experimental
- Style queries for container queries, where supported

**Common CSS APIs And At-Rules**

`@media`:

```css
@media (width >= 48rem) {
}
```

`@container`:

```css
@container (inline-size > 30rem) {
}
```

`@supports`:

```css
@supports (display: grid) {
}
```

`@layer`:

```css
@layer base, components, utilities;
```

`@font-face`:

```css
@font-face {
  font-family: Example;
  src: url('/example.woff2') format('woff2');
  font-display: swap;
}
```

`@keyframes`:

```css
@keyframes spin {
  to {
    rotate: 1turn;
  }
}
```

`@property`:

```css
@property --angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}
```

`@scope`:

```css
@scope (.component) {
  h2 {
    margin: 0;
  }
}
```

`@page`:

```css
@page {
  margin: 1in;
}
```

**Common CSS Properties**

Layout:

```css
display
position
inset
inset-block
inset-inline
z-index
float
clear
contain
content-visibility
```

Box model:

```css
box-sizing
inline-size
block-size
width
height
min-width
max-width
min-height
max-height
margin
padding
border
border-radius
outline
overflow
```

Flex:

```css
flex
flex-basis
flex-grow
flex-shrink
flex-direction
flex-wrap
justify-content
align-items
align-content
align-self
order
gap
row-gap
column-gap
```

Grid:

```css
grid
grid-template
grid-template-columns
grid-template-rows
grid-template-areas
grid-auto-flow
grid-auto-columns
grid-auto-rows
grid-column
grid-row
grid-area
justify-items
align-items
place-items
justify-content
align-content
place-content
```

Typography:

```css
font
font-family
font-size
font-weight
font-style
font-stretch
line-height
letter-spacing
word-spacing
text-align
text-decoration
text-transform
text-indent
text-wrap
white-space
overflow-wrap
word-break
hyphens
font-kerning
font-feature-settings
font-variation-settings
```

Color and background:

```css
color
background
background-color
background-image
background-position
background-size
background-repeat
background-clip
background-origin
opacity
color-scheme
accent-color
```

Visual effects:

```css
box-shadow
text-shadow
filter
backdrop-filter
mix-blend-mode
background-blend-mode
clip-path
mask
```

Transforms and motion:

```css
transform
translate
rotate
scale
transform-origin
transition
transition-property
transition-duration
transition-timing-function
transition-delay
animation
animation-name
animation-duration
animation-timing-function
animation-delay
animation-iteration-count
animation-direction
animation-fill-mode
animation-play-state
```

Scrolling:

```css
scroll-behavior
scroll-margin
scroll-padding
scroll-snap-type
scroll-snap-align
scrollbar-gutter
overscroll-behavior
```

Interaction:

```css
cursor
pointer-events
user-select
touch-action
caret-color
resize
appearance
```

Tables:

```css
border-collapse
border-spacing
caption-side
table-layout
vertical-align
```

Lists:

```css
list-style
list-style-type
list-style-position
list-style-image
```

Generated content:

```css
content
counter-reset
counter-increment
counter-set
quotes
```

**Clean Code Principles For CSS**

Use the least powerful selector that works.

Prefer classes and attributes over IDs.

Keep specificity low and consistent.

Avoid deeply nested selectors.

Avoid styling based on fragile DOM structure.

Use semantic tokens.

Use logical properties.

Use layout primitives.

Use modern layout instead of arbitrary positioning.

Use progressive enhancement.

Respect user preferences.

Preserve accessibility defaults.

Avoid global overrides unless they are intentional base styles.

Keep related styles together.

Keep utility classes single-purpose.

Avoid magic numbers.

Document hacks.

Delete unused CSS.

Prefer native CSS features over extra abstractions when sufficient.

Make responsive behavior intrinsic where possible.

Test narrow widths, long text, zoom, keyboard focus, reduced motion, dark mode, and high contrast.

**Common Mistakes**

Removing focus outlines without replacement.

Using fixed heights for dynamic content.

Using `100vh` on mobile without considering browser UI.

Forgetting `min-width: 0` in flex/grid children.

Using color alone for state.

Overusing `position: absolute`.

Overusing `!important`.

Using IDs for styling.

Creating high-specificity selectors that require more overrides later.

Animating layout properties unnecessarily.

Forgetting reduced-motion preferences.

Using background images for meaningful content.

Not reserving image/media space, causing layout shift.

Making visual order differ from DOM order.

Using hover-only interactions.

Ignoring RTL/writing mode issues.

Using `overflow: hidden` to mask layout bugs.

Styling native controls so heavily that accessibility suffers.

Loading excessive font files.

Failing to handle long words, long names, or translated strings.

Assuming viewport width equals component width.

Putting all responsive behavior in global breakpoints instead of using container queries.

**Default Practical CSS Baseline**

A reasonable default baseline I would commonly apply:

```css
@layer reset, base, layout, components, utilities;

@layer reset {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  body,
  h1,
  h2,
  h3,
  h4,
  p,
  figure,
  blockquote,
  dl,
  dd {
    margin: 0;
  }

  img,
  picture,
  svg,
  canvas,
  video {
    display: block;
    max-inline-size: 100%;
  }

  button,
  input,
  textarea,
  select {
    font: inherit;
  }
}

@layer base {
  :root {
    color-scheme: light;
    --color-bg: #ffffff;
    --color-text: #111827;
    --color-muted: #6b7280;
    --color-border: #d1d5db;
    --color-focus: #2563eb;
    --space-1: 0.25rem;
    --space-2: 0.5rem;
    --space-3: 0.75rem;
    --space-4: 1rem;
    --radius-sm: 0.375rem;
    --radius-md: 0.5rem;
  }

  body {
    min-block-size: 100dvh;
    background: var(--color-bg);
    color: var(--color-text);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.5;
  }

  :focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  a {
    color: inherit;
    text-underline-offset: 0.15em;
  }
}

@layer layout {
  .wrapper {
    inline-size: min(100% - 2rem, 72rem);
    margin-inline: auto;
  }

  .stack {
    display: grid;
    gap: var(--stack-gap, 1rem);
  }

  .cluster {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--cluster-gap, 0.75rem);
  }

  .auto-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));
    gap: var(--grid-gap, 1rem);
  }
}

@layer utilities {
  .visually-hidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
  }
}
```

**Default Decision Rules**

Use grid when both rows and columns matter.

Use flexbox when arranging items along one axis.

Use container queries when a component responds to its own space.

Use media queries when the whole page responds to the viewport or environment.

Use custom properties for themeable runtime values.

Use Sass/build-time variables only for compile-time abstractions.

Use native controls unless custom controls are necessary.

Use semantic HTML and then style it.

Use progressive enhancement for newer CSS.

Use low specificity by default.

Use logical properties by default.

Use `rem`, `em`, `%`, `fr`, `ch`, and modern viewport units appropriately.

Use fixed pixel values mostly for borders, icons, hairlines, and precise control dimensions.

Use `aspect-ratio` to reserve media space.

Use `minmax(0, 1fr)` and `min-inline-size: 0` to prevent overflow in grid/flex layouts.

Use visible focus styles.

Use reduced motion handling.

Use dark mode and forced-color awareness when relevant.

Use clean tokens and avoid repeating raw values across components.
