---
name: javascript
description: Modern JavaScript development - use this guide when writing, reviewing, or debugging client-side JavaScript code, including DOM manipulation, asynchronous logic, and performance optimization.
---

# JavaScript Development Standards

This skill is a baseline for writing clean, performant, and secure JavaScript. These guidelines apply to web platform development and assume modern ECMAScript standards (ES2023+).

This skill defers to specific use-case guidance found in the `/guides/` directory when applicable.

## Objects, Classes, and Prototypes

- **Safe Property Checks**: Use `Object.hasOwn(obj, "prop")` instead of `obj.hasOwnProperty("prop")`.
- **Avoid Prototype Poisoning**: Use `Object.getPrototypeOf()` and `Object.setPrototypeOf()` instead of the legacy `__proto__`.
- **Use Getters and Setters**: Encapsulate custom logic, value validation and formatting using `get` and `set`. 

```javascript
class UserService {
  #privateToken; // Encapsulated

  constructor(token) {
    this.#privateToken = token;
  }

  set privateToken(token){
    if(!validateToken(token)){
      console.log('Invalid Token');
    } else {
      this.#privateToken = token;
    }
  }

  get hasValidToken(){
    return validateToken(this.#privateToken)
  }
}
```

## DOM Manipulation and Performance

- **Reduce Layout Thrashing (Reflows)**: Accessing geometric properties (`offsetHeight`, `clientWidth`) after a DOM write forces synchronous layout. Batch all DOM reads first, then all DOM writes.
- **Offload Heavy Tasks with Web Workers**: Do not block the main thread with heavy computation. Offload non-DOM work like data manipulation or image rendering to Web Workers.
- **Prevent Memory Leaks**: Remove event listeners when removing DOM elements, set detached DOM references to `null`, and clear timers to allow garbage collection. Use a shared AbortController signal to clean up multiple asynchronous events.
- **Share Observer Instances**: If there are many elements to observe with a `ResizeObserver` or `IntersectionObserver`, attach them to a single shared Observer instance rather than spawning one per item.
- **Disconnect Cleanup**: Always call `.unobserve(el)` or `.disconnect()` when elements or components unmount to prevent memory leaks.
- **Use `DocumentFragment` for Batch Appends**: When inserting many elements, append them first to an in-memory `DocumentFragment` before a single insertion into the live DOM tree.

```javascript
// Clean up multiple items with a shared AbortController.
const controller = new AbortController();
const signal = controller.signal;

// Use the same `signal` when setting up event listeners and fetches.
async function setup(){
  button.addEventListener('click', ()=>{}, { signal })
  const response = await fetch(url, { signal });
}
// Calling `abort()` cleans up all processes with a shared signal.
function tearDown(){
  controller.abort();
}
```

```javascript
// ✅ Optimized Batch DOM Insertion
const list = document.getElementById('myList');
const fragment = document.createDocumentFragment();

for (let i = 0; i < 1000; i++) {
    const li = document.createElement('li');
    li.textContent = `Item ${i + 1}`;
    fragment.appendChild(li); // Appended in-memory, no reflow
}
list.appendChild(fragment); // Single layout recalculation pass
```

## Modern Browser APIs

- **Use Object.groupBy()**: Prefer the native modern `Object.groupBy()` to group collection objects by criteria. Do **not** use Lodash `groupBy` or manual loop-based grouping logic.
- **Prefer HTML and CSS for UI over JavaScript** - Don't use JavaScript when a feature is possible without it, (e.g., `<details>` and `<summary>` for simple accordion components, Relative Color Syntax for color manipulation, `position:sticky` for sticky positioning, or native form validation).
- **Prefer HTML and CSS features over Observers**: Use `<img loading="lazy" />` or scroll driven animations over `IntersectionObserver`, and container queries over `ResizeObserver`.
- **Use JavaScript as a Progressive Enhancement**: Anticipate that JavaScript will not always be able to run, and ensure your site is functional without it.
- **Avoid Extending CustomEvent**: Use native events like `TouchEvent` or `FocusEvent` when possible, or extend `Event`.
- **Avoid Recreating Native Elements**: Use `<button>` to trigger events, `<a>` to navigate, etc. Avoid replicating their behavior by adding event listeners to `<div>` or other generic elements. Do use JavaScript to add required dynamic ARIA, for instance `aria-expanded` or `aria-selected`.

## Security

- **Prevent DOM-XSS with Trusted Types**: Enforce Trusted Types in CSP to reject direct raw string assignments to dangerous sinks (like `innerHTML`). Use standard sanitization libraries like **DOMPurify** with `RETURN_TRUSTED_TYPE: true`.

## Delivery

- **Use Import Maps**: Use `<script type="importmap">` to control how `import` statements resolve.
