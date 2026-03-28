---
name: javascript
description: Action-oriented guidelines for modern JavaScript development. Use this skill when writing, reviewing, or debugging JavaScript code, including DOM manipulation, asynchronous logic, and performance optimization.
---

# JavaScript Development Standards

Use this skill as a baseline for writing clean, performant, and secure JavaScript. These guidelines apply to web platform development and assume modern ECMAScript standards (ES2022+).

This skill defers to specific use-case guidance found in the `/guides/` directory when applicable.

## Modern Syntax and Variable Declarations

- **Use `const` by Default**: Use `const` for all variable declarations. Use `let` only when reassignment is strictly required. 
- **Never Use `var`**: Deprecate the legacy `var` keyword to avoid function-scoping and hoisting bugs.
- **Enforce Strict Mode**: Add `"use strict";` at the top of scripts or functions if not inside an ES module or class (which are strict by default).
- **Use Semicolons**: Do not rely on Automatic Semicolon Insertion (ASI). Always terminate statements with a semicolon.
- **Prefer Primitives and Literals**: Avoid object wrappers (e.g., `new String()`, `new Number()`). Use literals and standard conversion functions (e.g., `Number()`, `String()`).
- **Use Strict Equality `===`**: Always use `===` and `!==` over `==` and `!=` to bypass dangerous implicit type coercion.
- **Nullish Operators for Safety**:
    - Use Optional Chaining (`?.`) to safely traverse nested objects without throwing `TypeError`.
    - Use Nullish Coalescing (`??`) for defaults instead of logical OR (`||`) to avoid accidentally overriding valid falsy values like `0` or `""`.
- **Use Template Literals**: Use backticks `` ` `` and `${}` for string interpolation instead of concatenation `+`.
- **Naming Conventions**: Use `camelCase` for variables and functions, `PascalCase` for classes.
- **Precise Calculations**: Use integers or whole numbers for precision-critical math (e.g., currency) to avoid floating-point issues (`0.1 + 0.2 !== 0.3`).

```javascript
// ✅ GOOD
const score = 0;
const finalScore = score ?? 10; // 0

// ❌ BAD
const finalScoreLegacy = score || 10; // 10 (incorrectly overrides 0)
```

## Functions and Async Flow

- **Prefer Rest and Default Parameters**: Use Rest parameters (`...args`) instead of the legacy `arguments` object. Define defaults inside the signature (`param = value`).
- **Arrow Functions for Lexical `this`**: Use arrow functions when you want to preserve the surrounding context's `this` (e.g., inside callbacks or timers).
- **Standard Functions for Dynamic `this`**: Use standard function syntax (`functionName() {}`) when you need `this` to bind dynamically (e.g., object methods or event handlers).
- **Asynchronous Flow with `async/await`**: Use `async`/`await` for readable asynchronous code instead of heavy promise chains or callbacks. Always wrap with `try/catch` for error handling.
- **Fail Fast with Early Returns**: Return early from functions to keep code flat and avoid deep `if-else` nesting.

```javascript
// ✅ GOOD: Readable async flow
async function fetchData(url) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Fetch failed:", error);
    throw error; // Propagate or handle
  }
}
```

## Objects, Classes, and Prototypes

- **Prefer Class Syntax**: Use modern `class` over legacy constructor functions and `prototype` manipulation.
- **Use `#` for Private Encapsulation**: Utilize the `#` prefix for internal fields and methods to expose only necessary surface area.
- **Super Calls First**: In subclass constructors, always call `super()` before accessing `this`.
- **Static Utilities**: Use `static` methods for utility functions or domain factories that do not need instance state.
- **Safe Property Checks**: Use `Object.hasOwn(obj, "prop")` instead of `obj.hasOwnProperty("prop")`.
- **Avoid Prototype Poisoning**: Use `Object.getPrototypeOf()` and `Object.setPrototypeOf()` instead of the legacy `__proto__`.

```javascript
class UserService {
  #privateToken; // Encapsulated

  constructor(token) {
    this.#privateToken = token;
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

**Heuristic Rule**: Use `Map` for dynamic dictionaries with non-string keys, and `Set` for deduplication.

## DOM Manipulation and Performance

- **Reduce Layout Thrashing (Reflows)**: Accessing geometric properties (`offsetHeight`, `clientWidth`) after a DOM write forces synchronous layout. Batch all DOM reads first, then all DOM writes.
- **Use `DocumentFragment` for Batch Appends**: When inserting many elements, append them first to an in-memory `DocumentFragment` before a single insertion into the live DOM tree.
- **Offload Heavy Tasks with Web Workers**: Do not block the main thread with heavy computation. Offload non-DOM work to Web Workers.
- **Break Up Long Tasks with `scheduler.yield()`**: Break CPU-heavy tasks taking >50ms using `await scheduler.yield()` to improve Interaction to Next Paint (INP). Use `scheduler.postTask()` if you need task prioritization (`user-blocking`, `user-visible`, `background`).
- **Prevent Memory Leaks**: Remove event listeners when removing DOM elements and set detached DOM references to `null` to allow garbage collection.

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

## Modern Event Observers

- **Prefer Observers over Event Clutter**: Replace expensive scroll or resize events with non-main-thread Observers.
- **Use `IntersectionObserver`**: Implement lazy loading or tracking viewport entry with `IntersectionObserver`.
- **Use `ResizeObserver`**: Track element dimensions without using `window.onresize`.
- **Share Observer Instances**: For massive datasets, attach elements to a single shared Observer instance rather than spawning one per item.
- **Disconnect Cleanup**: Always call `.unobserve(el)` or `.disconnect()` when elements or components unmount to prevent memory leaks.

## Build Optimization and Security

- **Preserve Static Imports for Tree Shaking**: Ensure your bundle configuration (e.g. Babel) preserves static imports (`modules: false`) to enable dead-code elimination.
- **Explicit `sideEffects` in `package.json`**: Declare `"sideEffects": false` to allow bundlers to drop dead code aggressively. If your project imports styles directly (e.g. `import './style.css'`), specify them in an array to prevent them from being dropped.
- **Eradicate DOM-XSS with Trusted Types**: Enforce Trusted Types in CSP to reject direct raw string assignments to dangerous sinks (like `innerHTML`). Use standard sanitization libraries like **DOMPurify** with `RETURN_TRUSTED_TYPE: true`.
- **Never Use Eval Utilities**: Avoid `eval()`, `setTimeout(string)`, or `new Function()`. Use `JSON.parse()` for parsing and standard functions for evaluation.

```json
// Example: Preserving styles while tree-shaking javascript
"sideEffects": [
  "**/*.css",
  "**/*.scss"
]
```

```javascript
import DOMPurify from 'dompurify';

const dirtyInput = "<img src=x onerror=alert('XSS')>";
const container = document.getElementById('content');

// Will throw in strict CSP environments if Trusted Types are enforced
// container.innerHTML = dirtyInput; 

// Secure: DOMPurify returns a TrustedHTML object accepted by the browser
container.innerHTML = DOMPurify.sanitize(dirtyInput, { 
    RETURN_TRUSTED_TYPE: true 
});
```
