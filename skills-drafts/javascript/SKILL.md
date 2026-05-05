---
name: javascript
description: Project-specific standards for modern JavaScript, focusing on performance, CSS-first architecture, and advanced web platform heuristics.
---

# JavaScript Differential Standards

This skill provides additive guidance and behavioral steering beyond standard ES2022+ best practices. It assumes the model is already proficient in modern syntax (`const`, `async/await`, optional chaining, etc.) as documented in standard guides.

## Modern Syntax and Standards

- **Precise Calculations**: Use integers or whole numbers for precision-critical math (e.g., currency) to avoid floating-point issues (`0.1 + 0.2 !== 0.3`).
- **Ternary Constraints**: Use ternary operators (`? :`) ONLY for value assignment. Never use them for side effects or complex logic; use `if/else` for actions.
- **Named Exports**: Use named exports exclusively to improve grep-ability, enable better tree-shaking, and prevent refactoring errors associated with default exports.

## Collections and Iteration

| Requirement | Data Structure | Key Type | Order Preserved |
| :--- | :--- | :--- | :--- |
| **Unique values** | `Set` | Value itself | ✅ Yes |
| **Object-keyed pairs** | `Map` | Any (Objects/Primitives) | ✅ Yes |
| **Standard JSON pairs** | Object `{}` | String / Symbol | ❌ No |
| **Ordered lists** | Array `[]` | Integer Index | ✅ Yes |

**Rule**: Use `Map` for dynamic dictionaries and lookup tables; use plain objects `{}` only for static, known-shape configuration records.

## DOM Manipulation and Performance

- **Reduce Layout Thrashing (Reflows)**: Accessing geometric properties (`offsetHeight`, `clientWidth`) after a DOM write forces synchronous layout. Batch all DOM reads first, then all DOM writes.
- **Offload Heavy Tasks with Web Workers**: Do not block the main thread with heavy computation. Offload non-DOM work like data manipulation or image rendering to Web Workers.
- **Prevent Memory Leaks**: Use a shared AbortController signal to clean up multiple asynchronous events (fetches, listeners, timers) when a component or scope is destroyed.
- **Share Observer Instances**: If there are many elements to observe with a `ResizeObserver` or `IntersectionObserver`, attach them to a single shared Observer instance rather than spawning one per item.
- **Use `DocumentFragment` for Batch Appends**: When inserting many elements, append them first to an in-memory `DocumentFragment` before a single insertion into the live DOM tree.

## Modern Browser APIs & Behavioral Steering

- **CSS-First Architecture**: Always prefer HTML and CSS for UI over JavaScript. 
    - Use `<details>`/`<summary>` or CSS `:checked` for accordions and tabs.
    - Use `loading="lazy"` or Scroll-driven animations instead of `IntersectionObserver` where possible.
    - Use Container Queries instead of `ResizeObserver` for component-level responsiveness.
- **Progressive Enhancement**: Ensure core functionality works if JavaScript fails to load. Use JavaScript to enhance, not to provide the only path to critical features.
- **Native Element Integrity**: Use native elements (`<button>`, `<a>`, `<select>`) rather than recreating their behaviors with generic elements and event listeners. Use JavaScript to manage dynamic state like `aria-expanded`.
- **Avoid Extending CustomEvent**: Prefer native event types or extend the base `Event` class directly instead of `CustomEvent` for better performance and clearer type definitions.

## Security and Delivery

- **Prevent DOM-XSS with Trusted Types**: Enforce Trusted Types in CSP to reject direct raw string assignments to dangerous sinks (like `innerHTML`). Use standard sanitization libraries like **DOMPurify** with `RETURN_TRUSTED_TYPE: true`.
- **Use Import Maps**: Use `<script type="importmap">` for module resolution to maintain clean import statements without requiring complex build-time aliasing.
