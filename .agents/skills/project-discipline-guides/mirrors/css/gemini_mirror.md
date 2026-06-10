# CSS Comprehensive Best Practices & Modern API Guide (Redundancy Mirror)

## 1. Modern Syntax & Selectors
*   **Native Nesting**: Use browser-native nesting. Avoid deep nesting (max 3 levels) to prevent specificity bloat and maintain readability.
    ```css
    .card {
      padding: 1rem;
      & .title { font-weight: bold; }
      @media (width > 600px) { padding: 2rem; }
    }
    ```
*   **Logical Selectors**:
    *   `:is()`: Reduces repetition in complex selectors without increasing specificity.
    *   `:where()`: Similar to `:is()` but with **zero specificity**, ideal for resets and base styles.
    *   `:has()`: The "parent selector." Use for relational styling (e.g., `.card:has(img) { ... }`).
*   **Pseudo-classes**: Prefer `:focus-visible` over `:focus` for better UX. Use `:not()` to exclude elements without complex overrides.

## 2. Architecture & The Cascade
*   **Cascade Layers (`@layer`)**: Organize styles into explicit layers (e.g., `reset`, `base`, `components`, `utilities`) to solve specificity wars.
*   **Custom Properties (Variables)**:
    *   Use for tokens (colors, spacing, typography).
    *   Scope variables locally when possible.
    *   Use `@property` for typed variables to enable animation of custom properties.
*   **Scoped CSS**: Use `@scope (.component) to (.slots)` for native component encapsulation (progressive enhancement).

## 3. Layout & Responsiveness
*   **CSS Grid**:
    *   Use `grid-template-areas` for readable layouts.
    *   `repeat(auto-fit, minmax(size, 1fr))` for intrinsic responsiveness without media queries.
    *   **Subgrid**: Use `grid-template-columns: subgrid` to align nested elements to the parent grid.
*   **Flexbox**: Use `gap` for spacing instead of margins on children.
*   **Container Queries**: Use `@container` (inline-size) for component-driven responsiveness based on the parent's size rather than the viewport.
*   **Logical Properties**: Use `margin-inline`, `padding-block`, `inset-inline-start` instead of top/bottom/left/right to support RTL/LTR automatically.
*   **Box Sizing**: Always use `box-sizing: border-box`.

## 4. Units & Sizing
*   **Relative Units**:
    *   `rem` for typography and spacing (accessibility).
    *   `ch` for limiting line length (ideal for readability, ~65-75ch).
    *   `vh`/`vw` and the new viewport units: `svh`, `lvh`, `dvh` (to handle mobile browser UI shifts).
*   **Math Functions**:
    *   `clamp(min, preferred, max)` for fluid typography and sizing.
    *   `calc()`, `min()`, and `max()` for complex calculations.
*   **Aspect Ratio**: Use the `aspect-ratio` property instead of padding hacks.

## 5. Colors & Theming
*   **Modern Color Spaces**: Prefer `oklch()` or `lch()` for perceptually uniform colors and access to wider gamuts.
*   **Color Functions**:
    *   `color-mix(in oklch, color1, color2 percentage)` for dynamic tinting/shading.
    *   Relative color syntax: `oklch(from var(--primary) l c h / 0.5)` for transparency.
*   **System Colors**: Use `accent-color` for native form elements.
*   **Dark Mode**: Use `light-dark(lightValue, darkValue)` or `prefers-color-scheme`.

## 6. Typography
*   **Variable Fonts**: Utilize `font-variation-settings` for fine-grained control over weight, slant, etc.
*   **Text Wrapping**:
    *   `text-wrap: balance` for headings (prevents orphans).
    *   `text-wrap: pretty` for body text (better hyphenation/line breaks).
*   **Font Display**: Always use `font-display: swap`.

## 7. Interactions & Animations
*   **Transitions**: Use `transition: property duration timing-function`. Prefer `prefers-reduced-motion` media queries.
*   **View Transitions**: Use the View Transitions API for seamless page/state transitions.
*   **Scroll-Driven Animations**: Use `scroll-timeline` and `view-timeline` for scroll-linked effects without JS.
*   **Performance**: Use `will-change` sparingly for complex animations. Prefer `transform` and `opacity` to avoid layout thrashing.

## 8. Performance & Accessibility
*   **Content Visibility**: Use `content-visibility: auto` for off-screen elements to improve rendering performance.
*   **Containment**: Use `contain: layout paint` to limit browser reflows.
*   **A11y Standards**:
    *   Maintain high color contrast (WCAG 2.1).
    *   Never remove `outline` without a `:focus-visible` replacement.
    *   Use `forced-colors` media query for high-contrast mode support.
*   **Images**: Use `object-fit` and `aspect-ratio` to prevent layout shifts (CLS). Use `image-set()` for responsive backgrounds.
