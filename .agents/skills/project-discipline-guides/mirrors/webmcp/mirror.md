# Modern Web Development: Lowest Common Denominator (LCD) Mirror

This document represents the unified intersection of standard development practices natively understood across Gemini, Claude, and Codex. It includes only the features, APIs, and principles explicitly and consistently evidenced in all three source mirrors.

---

## 1. Modern JavaScript (ECMAScript)

### Core Language Features
*   **Asynchronous Patterns**: Use `async/await` for handling asynchronous operations instead of raw `Promise.then()` chains.
*   **Optional Chaining & Nullish Coalescing**: Use `?.` for safe property access and `??` for default value assignment.
*   **Deep Cloning**: Use `structuredClone()` for native deep copies of structured data (objects, arrays, etc.).
*   **Data Grouping**: Use `Object.groupBy()` or `Map.groupBy()` for efficient data categorization.
*   **Collections**: Use `Map` and `Set` for key-value pairs and unique collections, especially when non-string keys or performance are required.

### Promises
*   **Advanced Promise APIs**:
    *   `Promise.allSettled()` for handling multiple concurrent requests where partial success is acceptable.
    *   `Promise.withResolvers()` for creating a promise along with its resolution and rejection functions in a shared scope.

---

## 2. Modules & Architecture

*   **ES Modules (ESM)**: Use standard `import` and `export` syntax.
*   **Top-level await**: Use directly within modules to simplify initialization logic.

---

## 3. CSS Selectors & Styling

*   **The `:has()` Selector**: Use the functional pseudo-class as a parent or relational selector to style elements based on the state or presence of descendants/relatives.

---

## 4. Web Platform APIs (Standard Library)

### DOM & Interactivity
*   **Popover API**: Use the `popover` attribute for managing tooltips, menus, and overlays.
*   **Dialog API**: Use the `<dialog>` element and `.showModal()` for accessible, focus-trapped modal windows.

### Networking
*   **Fetch API**: Use `fetch()` for network requests.
*   **AbortController**: Use `AbortController` and its associated `AbortSignal` to cancel asynchronous operations (e.g., fetch requests).

### Advanced Graphics & State
*   **View Transitions API**: Use `document.startViewTransition()` to provide smooth transitions between DOM states.

---

## 5. Accessibility (A11y) & UX

*   **ARIA Live Regions**: Use `aria-live` (e.g., `aria-live="polite"`) to ensure screen readers announce dynamic content updates.
*   **Focus Management**: Explicitly manage focus state when elements (like dialogs or menus) are opened, closed, or navigated.

---

## 6. Clean Code & Architectural Principles

*   **Single Responsibility**: Ensure functions and components are designed to perform one specific task.
*   **Immutability**: Avoid direct mutation of state; prioritize the use of spreads (`...`) and `structuredClone()` for data updates.

---

## 7. TypeScript Best Practices

*   **Strong Typing**: Avoid the use of `any`. Prioritize the use of `unknown` for external data and apply type narrowing.
*   **Type Narrowing**: Use explicit validation or type guards to narrow types at application boundaries.
