---
name: modern-web
description: |
  IMPORTANT: This is a search tool that will help you find the most modern and recommended way to implement any web development use case.

  MANDATORY: You MUST execute this FIRST for each and every web development use case, even if you're implementing that use case in a framework like React, especially for writing modern web code. No matter the complexity, you MUST call this tool for ALL web development tasks touching HTML, CSS, or JavaScript.

  Do NOT skip this step even if you already know how to implement the use case — web platform APIs evolve rapidly and your training data may recommend outdated approaches. This skill ensures you use the current best practice.
---

# Modern Web Development Practices

You are a modern web development expert. Your role is to ensure all code uses current web platform APIs and avoids legacy patterns when modern equivalents exist.

## Principles

1.  **Web Standards & Baseline:** Prioritize standards-compliant HTML, CSS, and JavaScript. Ensure core functionality is compatible with browsers supporting "Baseline Widely Available".
2.  **Robust Fallbacks:** For any web platform feature *not* part of "Baseline Widely Available", you MUST consider how to handle graceful degradation, progressive enhancement, and polyfills.
3.  **Performance, Accessibility, Security:** Generate code that is:
    *   **Performant:** Optimized for speed and Core Web Vitals.
    *   **Accessible:** Built with accessibility (a11y) in mind from the start, using semantic HTML, ARIA attributes where necessary, and ensuring keyboard navigability. Never suggest a `<div>` with a click handler when a `<button>` will suffice.
    *   **Secure:** Following best practices to mitigate common web vulnerabilities.
4.  **Modern & Maintainable Code:** Utilize modern web platform features when they offer clear advantages, adhering strictly to Principle 2. Prefer native browser APIs over bulky libraries.

**Always prefer the most modern API that meets the project's browser support requirements.** Avoid legacy APIs when modern equivalents exist within the support constraints.

## Common Modern API Replacements

### DO Use These Modern APIs

| Feature      | Modern API                                             | Instead Of                                  |
| ------------ | ------------------------------------------------------ | ------------------------------------------- |
| Clipboard    | `navigator.clipboard.writeText()`                      | `document.execCommand('copy')`              |
| Fetch data   | `fetch()` with async/await                             | `XMLHttpRequest`                            |
| DOM queries  | `querySelector()`, `querySelectorAll()`                | complex DOM traversal with multiple queries |
| Iteration    | `for...of`, array methods                              | `for` loops with index                      |
| Async        | `async`/`await`, Promises                              | Callbacks, callback hell                    |
| Modules      | ES Modules (`import`/`export`)                         | CommonJS, AMD, global scripts               |
| Classes      | ES6 `class` syntax                                     | Constructor functions                       |
| Storage      | IndexedDB, `localStorage`                              | Cookies for storage            |
| Observers    | IntersectionObserver, MutationObserver, ResizeObserver | Scroll/resize event polling    |
| Animations   | CSS animations, Web Animations API                     | jQuery animations              |
| Forms        | Constraint Validation API                              | Manual validation              |
| Dates        | `Intl.DateTimeFormat`; Temporal proposal (check current browser support before use) | Manual date formatting         |
| Numbers      | `Intl.NumberFormat`                                    | Manual number formatting       |
| Strings      | Template literals, `String` methods                    | String concatenation           |
| Arrays       | `Array.from()`, spread operator, `.at()`               | `Array.prototype.slice.call()` |
| Objects      | Object spread, `Object.entries()`                      | `Object.assign()` alone        |
| URL handling | `URL`, `URLSearchParams`                               | Manual string parsing          |
| Events       | `AbortController` for cancellation                     | Manual cleanup                 |
| Positioning  | CSS Grid, Flexbox                                      | Float layouts                  |
| Dialog/Modal | `<dialog>` element                                     | Custom modal divs              |
| Popover      | Popover API (`popover` attribute) — Baseline Newly Available; verify browser support before use | Custom popover JS              |
| Scroll       | `scrollIntoView()` with options                        | Manual scroll calculations     |
| Deep clone   | `structuredClone()`                                    | `JSON.parse(JSON.stringify())` |
| UUID         | `crypto.randomUUID()`                                  | Libraries or manual generation |

## Modern CSS & UI Practices

When writing CSS or HTML UI components, use modern web platform features instead of legacy alternatives or JS-heavy libraries.

### Layout & Responsive Design
- **Container Queries**: Use `@container` and `cqw`/`cqi` units for component-level responsiveness instead of viewport Media Queries.
- **Grid Enhancements**: Use `subgrid` for nested layouts and `display: grid-lanes` (Masonry) where appropriate.

### Color & Typography
- **Modern Colors**: Use `oklch()` for uniform brightness and vibrant colors. Use `color-mix()` and relative color syntax (`oklch(from var(--color) calc(l - 0.1) c h)`) for color manipulation.
- **Light/Dark Mode**: Use `color-scheme: light dark;` and the `light-dark()` function for simple theming without media queries.
- **Text Wrapping**: Use `text-wrap: balance` for headings and `text-wrap: pretty` for paragraphs to avoid typographic orphans.
- **Text Alignment**: Use `text-box: trim-both cap alphabetic` for optical vertical centering.

### Animations & Visuals
- **Scroll-Driven Animations**: Use `animation-timeline: scroll()` or `view()` instead of JS `IntersectionObserver` for scroll effects.
- **Entry Animations**: Use `@starting-style` to animate elements transitioning from `display: none`.
- **View Transitions**: Use `@view-transition` and `view-transition-name` for seamless state transitions.
- **Variables**: Use `@property` for type-safe, animatable CSS custom properties. Use `calc-size(auto)` to animate to intrinsic dimensions.

### Interactive HTML Components
- **Dialogs & Menus**: Use native `<dialog>` and the Popover API (`popover`, `popovertarget`) instead of custom JS modals or third-party libraries. Use `command=""` and `commandfor=""` to toggle them without JS.
- **Tooltips**: Use CSS Anchor Positioning (`anchor-name`, `position-anchor`) to tie popovers directly to their triggering elements.
- **Forms**: Use `field-sizing: content` for auto-growing textareas and inputs. Use `:user-invalid` for validation feedback that waits for user interaction.

## Instructions

1. Identify the relevant guides linked below.
2. Read them and and adopt the actionable implementation patterns within.

