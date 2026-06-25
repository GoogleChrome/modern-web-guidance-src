# Modern Web Development: Redundancy Mirror (Common Knowledge)

This document serves as a comprehensive "Redundancy Mirror," documenting the standard best practices, APIs, and syntax I natively understand for modern web development (Web Platform/WebMCP). 

---

## 1. Modern JavaScript (ECMAScript)

### Core Language Features
*   **Optional Chaining & Nullish Coalescing**: Use `?.` and `??` for safer property access and default value assignment instead of verbose logical `&&` or `||` checks.
*   **Asynchronous Patterns**: Prefer `async/await` over raw `Promise.then()` chains. 
*   **Advanced Promise APIs**: 
    *   `Promise.allSettled()` for handling multiple independent requests where partial success is acceptable.
    *   `Promise.any()` for racing multiple sources for the first success.
    *   `Promise.withResolvers()` (Baseline 2024) for creating a promise with its resolution/rejection functions in the same scope.
*   **Data Structures**: Use `Map` and `Set` for key-value pairs and unique collections when performance or non-string keys are required. Use `WeakMap` and `WeakSet` for memory-safe object associations.
*   **Functional Array Methods**: Use non-mutating methods like `toSorted()`, `toReversed()`, and `toSpliced()` (Baseline 2023) to maintain immutability.
*   **Grouping**: Use `Object.groupBy()` and `Map.groupBy()` for efficient data categorization.
*   **Deep Cloning**: Use `structuredClone()` for native deep copies of objects (including Dates, RegEx, and Arrays) instead of `JSON.parse(JSON.stringify())`.

### Modules & Architecture
*   **ES Modules (ESM)**: Use standard `import`/`export`. Favor named exports for better tree-shaking and discoverability.
*   **Top-level await**: Use directly in modules to simplify initialization logic.
*   **Dynamic Imports**: Use `import()` for code splitting and lazy-loading non-critical paths.

---

## 2. CSS Architecture & Modern Features

### Layout & Selection
*   **Grid & Flexbox**: Use Flexbox for 1D layouts and Grid for 2D layouts. Use `gap` (supported in both) for spacing.
*   **Subgrid**: Use `grid-template-columns: subgrid` to align nested elements with the parent grid.
*   **The `:has()` Selector**: The "parent selector." Use it for conditional styling based on child states (e.g., `.card:has(img)`).
*   **Container Queries**: Use `@container` to style elements based on the size of their parent container rather than the viewport.
*   **Logical Properties**: Use `margin-inline`, `padding-block`, `inset-inline-start` instead of `left`/`right`/`top`/`bottom` to support multi-directional layouts (LTR/RTL) automatically.

### Organization & Modern Syntax
*   **Native Nesting**: Use browser-native CSS nesting to group related styles without preprocessors like Sass.
*   **Cascade Layers (`@layer`)**: Use layers to manage specificity and prevent third-party styles from overriding application-level defaults.
*   **Variables (Custom Properties)**: Use `--var` for tokens and dynamic runtime styling. Define defaults with `var(--name, fallback)`.
*   **Color Level 4/5**: Use `oklch()` or `oklab()` for perceptually uniform colors. Use `color-mix()` for dynamic shading and blending.

---

## 3. Web Platform APIs (Standard Library)

### DOM & Interactivity
*   **Intersection Observer**: Use for lazy-loading images, infinite scroll, or triggering animations when elements enter the viewport.
*   **Resize Observer**: Use for responding to element size changes (more granular than `window.onresize`).
*   **Mutation Observer**: Use for monitoring changes to the DOM tree (attributes, children).
*   **Popover API**: Use the `popover` attribute for tooltips, menus, and overlays without managing z-index manually.
*   **Dialog API**: Use `<dialog>` and `.showModal()` for accessible, focus-trapped modal windows.

### Data & State
*   **Fetch API**: Use for network requests with `AbortController` for cancellation.
*   **Storage**: 
    *   `localStorage` for persistent simple data.
    *   `IndexedDB` for complex, large-scale client-side data.
*   **Streams API**: Use for processing large data chunks (e.g., video, large JSON) without loading everything into memory.
*   **Web Workers**: Use for offloading heavy computation (image processing, data crunching) to keep the main thread responsive.

### Progressive Enhancements (Cutting Edge)
*   **View Transitions API**: Use `document.startViewTransition()` for smooth, app-like transitions between page states.
*   **Scroll-driven Animations**: Use `scroll-timeline` or `view-timeline` for animations tied to scroll position without JS scroll listeners.
*   **Speculation Rules**: Use `<script type="speculationrules">` to hint the browser to pre-render or pre-fetch pages for near-instant navigation.

---

## 4. HTML & Accessibility (A11y)

### Semantic Structure
*   **Meaningful Elements**: Use `<main>`, `<nav>`, `<article>`, `<section>`, `<aside>`, `<header>`, and `<footer>` to provide document structure.
*   **Form Controls**: Always associate `<label>` with inputs. Use `inputmode` and `autocomplete` attributes to improve mobile UX.
*   **Headings**: Maintain a logical `<h1>` through `<h6>` hierarchy for screen readers.

### Accessibility Attributes
*   **ARIA**: Use sparingly; semantic HTML is preferred. Use `aria-live` for dynamic content updates and `aria-expanded` for toggles.
*   **The `inert` Attribute**: Use to globally disable interaction and hide elements from the accessibility tree (e.g., content behind a modal).
*   **Focus Management**: Ensure a visible focus ring (`:focus-visible`) and logical tab order.

---

## 5. Performance & Optimization

### Loading Patterns
*   **Native Lazy Loading**: Use `loading="lazy"` on `<img>` and `<iframe>`.
*   **Fetch Priority**: Use `fetchpriority="high"` for LCP (Largest Contentful Paint) elements.
*   **Image Optimization**: Use `<picture>` with `srcset` and modern formats like WebP or AVIF.

### Critical Metrics (Core Web Vitals)
*   **LCP (Largest Contentful Paint)**: Prioritize early loading of the largest visible element.
*   **CLS (Cumulative Layout Shift)**: Provide explicit `width`/`height` or `aspect-ratio` for images and containers to prevent layout jumps.
*   **INP (Interaction to Next Paint)**: Keep the main thread clear to ensure user interactions (clicks, taps) are acknowledged immediately.

---

## 6. Clean Code & Architectural Principles

### Patterns
*   **Composition over Inheritance**: Build complex UI by nesting components rather than extending classes.
*   **Immutability**: Avoid mutating objects or arrays directly; use spreads `[...]`, `{...}`, or the new functional array methods.
*   **Single Responsibility**: Functions and components should do one thing well.
*   **Declarative Logic**: Focus on *what* should be rendered based on state, rather than *how* to manually manipulate the DOM (even when using vanilla JS).

### TypeScript Best Practices
*   **Strong Typing**: Avoid `any`. Use `unknown` for data from external sources and perform type narrowing.
*   **Discriminated Unions**: Use a shared `type` field to distinguish between variants in a union (e.g., `SuccessResponse | ErrorResponse`).
*   **Utility Types**: Use `Pick`, `Omit`, `Partial`, and `Readonly` to derive types from existing ones.
