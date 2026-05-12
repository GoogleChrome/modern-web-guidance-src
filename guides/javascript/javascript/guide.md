---
name: javascript
description: Modern JavaScript development - use this guide when writing, reviewing, or debugging client-side JavaScript code, including DOM manipulation, asynchronous logic, and performance optimization.
---

# JavaScript Development Standards

This skill is a baseline for writing clean, performant, and secure JavaScript. These guidelines apply to web platform development and assume modern ECMAScript standards (ES2023+).

This skill defers to specific use-case guidance found in the `/guides/` directory when applicable.

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

- **Prefer HTML and CSS for UI over JavaScript** - Don't use JavaScript when a feature is possible without it, (e.g., `<details>` and `<summary>` for simple accordion components, Relative Color Syntax for color manipulation, `position:sticky` for sticky positioning, or native form validation).
- **Prefer HTML and CSS features over Observers**: Use `<img loading="lazy" />` or scroll driven animations over `IntersectionObserver`, and container queries over `ResizeObserver`.
- **Use JavaScript as a Progressive Enhancement**: Anticipate that JavaScript will not always be able to run, and ensure your site is functional without it.
- **Avoid Extending CustomEvent**: Use native events like `TouchEvent` or `FocusEvent` when possible, or extend `Event`.
- **Avoid Recreating Native Elements**: Use `<button>` to trigger events, `<a>` to navigate, etc. Avoid replicating their behavior by adding event listeners to `<div>` or other generic elements. Do use JavaScript to add required dynamic ARIA, for instance `aria-expanded` or `aria-selected`.

## Security

- **Prevent DOM-XSS with Trusted Types**: Enforce Trusted Types in CSP to reject direct raw string assignments to dangerous sinks (like `innerHTML`). Use standard sanitization libraries like **DOMPurify** with `RETURN_TRUSTED_TYPE: true`.

## Delivery

- **Use Import Maps**: Use `<script type="importmap">` to control how `import` statements resolve.

**Heuristic Rule**: Use `Promise.all()` when you need all results to proceed (e.g., initial data load). Use `Promise.allSettled()` when results are independent (e.g., batching multiple analytics pings).

## Objects, Classes, and Prototypes

- **Prefer Class Syntax**: Use modern `class` over legacy constructor functions and `prototype` manipulation.
- **Use `#` for Private Encapsulation**: Utilize the `#` prefix for internal fields and methods to expose only necessary surface area.
- **Super Calls First**: In subclass constructors, always call `super()` before accessing `this`.
- **Static Utilities**: Use `static` methods for utility functions or domain factories that do not need instance state.
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

  static fromConfig(config) { // Factory utility
    return new UserService(config.token);
  }
}
```

## Collections and Iteration

- **Prefer Array Literals**: Use `[]` over `new Array()`.
- **Iterate with `for...of`**: Use `for...of` for standard iterable collections. Use `for...in` sparingly and only for plain object properties (paired with `Object.hasOwn`).
- **Sets for Uniqueness**: Use `Set` when you require collections of unique values.
- **Maps for Complex Keys**: Use `Map` when keys are complex objects or when insertion order is critical.
- **Weak Collections for Memory Management**: Use `WeakMap` or `WeakSet` to associate temporary data with objects without preventing garbage collection.

### JS Collection Decision Matrix

| Requirement | Data Structure | Key Type | Order Preserved |
| :--- | :--- | :--- | :--- |
| **Unique values** | `Set` | Value itself | ✅ Yes |
| **Object-keyed pairs** | `Map` | Any (Objects/Primitives) | ✅ Yes |
| **Standard JSON pairs** | Object `{}` | String / Symbol | ❌ No |
| **Ordered lists** | Array `[]` | Integer Index | ✅ Yes |

**Heuristic Rule**: Use `Map` for dynamic dictionaries and lookup tables, `Set` for lists of unique items, and arrays for ordered lists of non-unique items.

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

- **Prefer Modern Browser APIs over Third Party Libraries** - Use native APIs like `document.querySelectorAll()` over jQuery selectors, and `Object.groupBy()` over Lodash `groupBy()`.
- **Prefer HTML and CSS for UI over JavaScript** - Don't use JavaScript when a feature is possible without it, (e.g., `<details>` and `<summary>` for simple accordion components, Relative Color Syntax for color manipulation, `position:sticky` for sticky positioning, or native form validation).
- **Prefer HTML and CSS features over Observers**: Use `<img loading="lazy" />` or scroll driven animations over `IntersectionObserver`, and container queries over `ResizeObserver`.
- **Use JavaScript as a Progressive Enhancement**: Anticipate that JavaScript will not always be able to run, and ensure your site is functional without it.
- **Trigger Actions Using `addEventListener()`**: Don't use `on*` HTML attributes like `onclick`.
- **Avoid Extending CustomEvent**: Use native events like `TouchEvent` or `FocusEvent` when possible, or extend `Event`.
- **Avoid Recreating Native Elements**: Use `<button>` to trigger events, `<a>` to navigate, etc. Avoid replicating their behavior by adding event listeners to `<div>` or other generic elements. Do use JavaScript to add required dynamic ARIA, for instance `aria-expanded` or `aria-selected`.

## Security

- **Prevent DOM-XSS with Trusted Types**: Enforce Trusted Types in CSP to reject direct raw string assignments to dangerous sinks (like `innerHTML`). Use standard sanitization libraries like **DOMPurify** with `RETURN_TRUSTED_TYPE: true`.
- **Never Use Eval Utilities**: Avoid `eval()`, `setTimeout(string)`, or `new Function()`. Use `JSON.parse()` for parsing and standard functions for evaluation.

## Delivery

- **Use Import Maps**: Use `<script type="importmap">` to control how `import` statements resolve.
- **Preprocess Scripts to Reduce Filesize**: Use preprocessor tooling to minimize and tree shake the scripts delivered in production. 
