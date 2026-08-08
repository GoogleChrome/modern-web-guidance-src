# JavaScript Knowledge Mirror: Standard Best Practices & APIs

This guide represents a baseline of modern JavaScript knowledge, covering syntax, standard library features, and clean code principles.

## 1. Variables and Scope

*   **`const` and `let`**: Use `const` by default for all variable declarations. Use `let` only when the variable must be reassigned. Never use `var`.
*   **Block Scope**: Understand that `let` and `const` are block-scoped, preventing hoisting issues and accidental global leakage.
*   **Global Avoidance**: Minimize the use of the global scope. Wrap code in modules or functions.

## 2. Functions and Modern Syntax

*   **Arrow Functions**: Use arrow functions (`() => {}`) for short callbacks and when you need to preserve the lexical `this` context.
*   **Function Declarations**: Use `function` declarations for top-level logic or when hoisting is intentionally required (rare).
*   **Default Parameters**: Use default values in function signatures (`function fn(a = 10) {}`) instead of conditional checks inside the body.
*   **Rest Parameters**: Use `...args` to handle an indefinite number of arguments as an array.
*   **Destructuring**: 
    *   **Objects**: `const { name, age } = user;`
    *   **Arrays**: `const [first, second] = list;`
    *   **Function Arguments**: `function print({ id, label }) {}`
*   **Spread Operator**: Use `...` for shallow copying objects/arrays or merging them (`{ ...defaults, ...overrides }`).
*   **Template Literals**: Use backticks for string interpolation and multi-line strings: `` `Value: ${val}` ``.

## 3. Objects and Arrays

*   **Shorthand Properties**: Use `{ name }` instead of `{ name: name }`.
*   **Computed Property Names**: Use `{[key]: value}` for dynamic keys.
*   **Optional Chaining (`?.`)**: Safely access deeply nested properties: `user?.profile?.email`.
*   **Nullish Coalescing (`??`)**: Use `??` to provide fallback values for `null` or `undefined`, avoiding the pitfalls of `||` with falsy values like `0` or `""`.
*   **Array Methods**:
    *   Iteration: `forEach` (side effects), `map` (transformation).
    *   Filtering/Searching: `filter`, `find`, `findIndex`, `some`, `every`, `includes`.
    *   Reducing: `reduce` (for complex aggregations).
    *   Flattening: `flat()`, `flatMap()`.
    *   Access: `.at(-1)` for the last element.
*   **Object Methods**: `Object.keys()`, `Object.values()`, `Object.entries()`, and `Object.fromEntries()`.
*   **`Object.groupBy()`**: (Modern) Use for categorizing items in an array.

## 4. Asynchronous Programming

*   **Promises**: Use Promises for all asynchronous operations.
*   **`async/await`**: Use `async`/`await` for cleaner, more readable asynchronous code. Always wrap in `try/catch` for error handling.
*   **Promise Concurrency**:
    *   `Promise.all()`: Fails fast if any promise rejects.
    *   `Promise.allSettled()`: Waits for all to finish, regardless of outcome.
    *   `Promise.any()`: Returns the first successful promise.
    *   `Promise.race()`: Returns the result of the first settled promise (resolve or reject).
*   **`AbortController`**: Use `AbortController` and `AbortSignal` to cancel `fetch` requests or other async tasks (e.g., timeouts).

## 5. Classes and Modules

*   **ES Modules (ESM)**: Use `import` and `export`. Prefer named exports for better tooling support, use `default` export sparingly.
*   **Dynamic Imports**: Use `import()` for code-splitting and lazy-loading.
*   **Class Syntax**: Use the `class` keyword.
    *   **Private Fields**: Use the `#` prefix for truly private class members: `#internalState`.
    *   **Static Blocks**: Use `static {}` for complex static initialization.
    *   **Inheritance**: Use `extends` and `super()`.

## 6. Standard Web APIs

*   **Fetch API**: Use `fetch()` for network requests. Remember it doesn't reject on 4xx/5xx errors; check `response.ok`.
*   **URL and URLSearchParams**: Use the `URL` API to parse and manipulate URLs and query parameters instead of string manipulation.
*   **`structuredClone()`**: Use for deep cloning objects (native alternative to `JSON.parse(JSON.stringify())` or Lodash).
*   **Intl API**: Use `Intl.NumberFormat`, `Intl.DateTimeFormat`, and `Intl.RelativeTimeFormat` for localization.
*   **DOM Manipulation**:
    *   Use `querySelector` and `querySelectorAll`.
    *   Use `classList` (`add`, `remove`, `toggle`, `contains`) for CSS classes.
    *   Use `dataset` for `data-*` attributes.
    *   Use `addEventListener` with options like `{ once: true }` or `{ signal }`.
*   **Intersection Observer**: Use for lazy-loading or scroll-triggered animations.
*   **Resize Observer**: Use for responding to element size changes.

## 7. Error Handling and Debugging

*   **Custom Errors**: Extend the `Error` class for domain-specific errors.
*   **Error Cause**: Use the `cause` property when re-throwing errors to maintain the stack trace: `new Error("Failed", { cause: originalErr })`.
*   **`console` methods**: Beyond `log`, use `warn`, `error`, `table`, `group/groupEnd`, and `time/timeEnd`.

## 8. Clean Code and Best Practices

*   **Naming**: 
    *   `camelCase` for variables and functions.
    *   `PascalCase` for classes and components.
    *   `SCREAMING_SNAKE_CASE` for constants.
    *   Use descriptive, verb-based names for functions (e.g., `getUserData`, `isEmailValid`).
*   **Early Returns**: Use guard clauses to exit functions early, reducing nesting.
*   **Immutability**: Avoid mutating state or function arguments. Return new objects/arrays instead.
*   **Pure Functions**: Aim for functions with no side effects that return the same output for the same input.
*   **Avoid Magic Numbers**: Extract literals to named constants.
*   **Module Size**: Keep modules focused (Single Responsibility Principle).
*   **Comments**: Use comments to explain *why* something is done, not *what* is being done (the code should be self-documenting).
