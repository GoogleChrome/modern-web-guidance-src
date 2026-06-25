# CSS Unified Lowest Common Denominator (LCD) Knowledge Mirror

## 1. Modern Syntax & Selectors
*   **Native Nesting**: Use browser-native nesting with the `&` selector to improve locality and readability.
*   **Logical Selectors**:
    *   `:is()`: Group multiple selectors while preserving the specificity of the most specific argument.
    *   `:where()`: Group selectors with **zero specificity**, ideal for resets and base styles.
    *   `:has()`: Use as a "parent selector" or relational selector to style elements based on their children or state.
    *   `:not()`: Exclude specific elements from a selector.
*   **Pseudo-classes**: Prefer `:focus-visible` over `:focus` to ensure focus indicators only appear for keyboard users.

## 2. Architecture & The Cascade
*   **Cascade Layers (`@layer`)**: Organize styles into explicit layers (e.g., `reset`, `base`, `components`) to manage the cascade independently of selector specificity.
*   **Custom Properties (CSS Variables)**:
    *   Use for design tokens (colors, spacing, typography).
    *   Define global tokens at the `:root` level and scope component-specific variables locally.
*   **Typed Custom Properties (`@property`)**: Register variables with specific types (syntax) to enable smooth transitions and animations.

## 3. Layout & Responsiveness
*   **Flexbox**: Use for one-dimensional layouts. Utilize `gap` for consistent spacing between children.
*   **CSS Grid**:
    *   Use for two-dimensional layouts.
    *   Employ `repeat(auto-fit, minmax(size, 1fr))` for intrinsic responsiveness.
    *   **Subgrid**: Use `grid-template-columns: subgrid` or `grid-template-rows: subgrid` to align nested elements with the parent's grid tracks.
*   **Container Queries (`@container`)**: Apply styles based on a parent container's size rather than the viewport.
*   **Logical Properties**: Prefer logical properties (e.g., `margin-inline`, `padding-block`, `inset-inline`) over physical ones to support different writing modes and directions automatically.
*   **Box Model**: Always use `box-sizing: border-box` to ensure padding and borders are included in element dimensions.

## 4. Units & Sizing
*   **Relative Units**:
    *   `rem`: Use for typography and spacing to respect user font size preferences.
    *   `ch`: Use for limiting line length to improve readability.
*   **Viewport Units**: Use `vh` and `vw`, as well as newer units `svh`, `lvh`, and `dvh` to handle mobile browser UI shifts.
*   **Math Functions**: Use `calc()`, `min()`, `max()`, and `clamp()` for fluid typography and responsive sizing constraints.
*   **Aspect Ratio**: Use the `aspect-ratio` property to reserve space for media and prevent layout shifts.

## 5. Colors & Theming
*   **Modern Color Spaces**: Use `oklch()` or `lch()` for perceptually uniform color definitions.
*   **Color Functions**:
    *   `color-mix()`: Derivatively tint or shade colors dynamically.
*   **System Controls**: Use `accent-color` to apply theme colors to native form elements.
*   **Dark Mode**: Utilize `prefers-color-scheme` media queries to support user system preferences.

## 6. Typography
*   **Variable Fonts**: Use to control multiple font axes (weight, slant, etc.) with a single file.
*   **Text Wrapping**:
    *   `text-wrap: balance`: Prevents orphans in headings.
    *   `text-wrap: pretty`: Optimizes line breaks and hyphenation for body text.
*   **Font Loading**: Always set `font-display: swap` to ensure text remains visible during font loading.

## 7. Interactions & Animations
*   **Transitions & Keyframes**: Use standard `transition` and `@keyframes` for state changes and animations.
*   **View Transitions**: Use the View Transitions API for seamless state or page transitions.
*   **Scroll-Driven Animations**: Use properties like `scroll-timeline` or `view-timeline` to link animations to scroll progress without JavaScript.
*   **Performance**: Prefer animating `transform` and `opacity` to avoid layout thrashing. Use `will-change` sparingly for complex animations.

## 8. Performance & Accessibility
*   **Rendering Optimization**:
    *   `content-visibility: auto`: Improves rendering performance for off-screen elements.
    *   `contain`: Use to limit the scope of browser reflows and repaints.
*   **Accessibility Standards**:
    *   Maintain high color contrast ratios.
    *   Support user preferences via `prefers-reduced-motion` and `forced-colors` media queries.
*   **Layout Stability**: Use `object-fit` and `aspect-ratio` on images to prevent Cumulative Layout Shift (CLS).
