# JavaScript Unified Lowest Common Denominator (LCD) Mirror

This document represents the intersection of standard JavaScript knowledge and best practices consistently evidenced across three independent source mirrors.

## 1. Variables and Scope

*   **Declaration Strategy**: Use `const` by default for all variables. Use `let` only when reassignment is explicitly required. 
*   **Avoid `var`**: Do not use `var` due to its function-scoping and hoisting behaviors.
*   **Block Scoping**: Leverage the block-scoped nature of `let` and `const` to prevent accidental global leakage and hoisting issues.

## 2. Functions and Modern Syntax

*   **Arrow Functions**: Use arrow functions (`() => {}`) for callbacks and to preserve the lexical `this` context.
*   **Function Declarations**: Use the `function` keyword for top-level logic or when hoisting is intentionally required.
*   **Default Parameters**: Assign default values in function signatures (`param = value`) to handle missing arguments.
*   **Rest Parameters**: Use the rest syntax (`...args`) to capture an indefinite number of arguments as an array.
*   **Destructuring**: Use destructuring to extract values from objects and arrays:
    *   `const { key } = object;`
    *   `const [first] = array;`
*   **Spread Operator**: Use the `...` syntax for shallow copying or merging objects and arrays.
*   **Template Literals**: Use backticks for string interpolation (`${value}`) and creating multi-line strings.

## 3. Objects and Arrays

*   **Property Enhancements**: 
    *   **Shorthand Properties**: Use `{ name }` when the key and variable name match.
    *   **Computed Property Names**: Use `{[key]: value}` for dynamic property keys.
*   **Safety Operators**:
    *   **Optional Chaining (`?.`)**: Safely access nested properties (e.g., `user?.profile?.id`).
    *   **Nullish Coalescing (`??`)**: Provide fallback values specifically for `null` or `undefined`.
*   **Standard Methods**:
    *   **Object Methods**: `Object.keys()`, `Object.values()`, `Object.entries()`, and `Object.fromEntries()`.
    *   **Array Iteration/Transformation**: `forEach`, `map`, `filter`, `reduce`.
    *   **Array Searching**: `find`, `findIndex`, `some`, `every`, `includes`.
    *   **Array Utility**: `flat()`, `flatMap()`, and `at()` (for relative/negative indexing).

## 4. Asynchronous Programming

*   **Promises**: Use Promises for managing all asynchronous operations.
*   **Async/Await**: Use `async`/`await` for readable asynchronous control flow. 
*   **Error Handling**: Always wrap asynchronous logic in `try/catch` blocks.
*   **Promise Concurrency**:
    *   `Promise.all()`: Fails fast if any promise rejects.
    *   `Promise.allSettled()`: Waits for all promises to finish regardless of outcome.
    *   `Promise.any()`: Returns the first fulfilled promise.
    *   `Promise.race()`: Returns the first settled promise (resolve or reject).

## 5. Classes and Modules

*   **ES Modules (ESM)**: Use `import` and `export` statements for modularity.
*   **Class Syntax**: Use the `class` keyword for stateful entities.
    *   **Private Fields**: Use the `#` prefix for private class members (e.g., `#state`).
    *   **Inheritance**: Use `extends` and `super()` for class-based inheritance.

## 6. Web APIs

*   **Fetch API**: Use `fetch()` for network requests. Always check `response.ok` as `fetch` does not reject on HTTP error statuses (4xx/5xx).
*   **AbortController**: Use `AbortController` and `AbortSignal` to cancel asynchronous tasks like network requests.
*   **URL API**: Use `URL` and `URLSearchParams` to manipulate URLs and query strings.
*   **DOM Manipulation**:
    *   Selection: `querySelector` and `querySelectorAll`.
    *   Attributes/Classes: `classList` (add, remove, toggle) and `dataset`.
    *   Events: `addEventListener` (including options like `{ once: true }` or `{ signal }`).
*   **Deep Cloning**: Use `structuredClone()` for deep copies of objects.
*   **Observers**: Use `IntersectionObserver` and `ResizeObserver` for responding to layout and visibility changes.
*   **Intl API**: Use the `Intl` namespace (e.g., `DateTimeFormat`, `NumberFormat`) for localized formatting.

## 7. Error Handling and Debugging

*   **Custom Errors**: Extend the `Error` class to create domain-specific error types.
*   **Error Cause**: Use the `cause` property when re-throwing to preserve original stack traces: `new Error("msg", { cause: err })`.
*   **Console Methods**: Utilize `log`, `warn`, `error`, `table`, `group`, and `time` for development and debugging.

## 8. Clean Code Principles

*   **Descriptive Naming**: Use clear, intention-revealing names for variables and functions.
*   **Early Returns**: Use guard clauses to handle edge cases early and reduce function nesting.
*   **Immutability**: Avoid mutating objects, arrays, or function arguments; return new instances instead.
*   **Pure Functions**: Prioritize functions that return consistent outputs for given inputs without side effects.
*   **Comments**: Use comments to explain *why* complex logic exists, rather than *what* the code is doing.

# JavaScript Unified Lowest Common Denominator (LCD) Mirror (Revised)

This document represents the absolute intersection of JavaScript knowledge consistently evidenced across the Gemini, Claude, and Codex source mirrors. It strictly excludes any feature, API, or best practice missing from any one of the source documents.

## 1. Variables and Scope

*   **Declaration Strategy**: Use `const` by default for variables. Use `let` only when the variable must be reassigned.
*   **Avoid `var`**: Do not use `var` for variable declarations.
*   **Scoped Declarations**: Understand that `let` and `const` provide block-scoped declarations, which prevents accidental global leakage and issues associated with hoisting.

## 2. Functions and Modern Syntax

*   **Arrow Functions**: Use arrow functions (`() => {}`) for callbacks and when preserving the lexical `this` context is required.
*   **Function Declarations**: Use traditional `function` declarations for top-level logic or when hoisting is required.
*   **Default Parameters**: Use default values in function signatures (`param = value`) to handle missing arguments.
*   **Rest Parameters**: Use the rest syntax (`...args`) to capture an indefinite number of arguments into a single array.
*   **Destructuring**: Use destructuring to extract data from objects and arrays:
    *   `const { key } = object;`
    *   `const [first] = array;`
    *   Destructuring is also applicable to function parameters.
*   **Spread Operator (Arrays/Objects)**: Use the spread syntax (`...`) for shallow copying or merging objects and arrays.
*   **Template Literals**: Use backticks for string interpolation (`${value}`) and for defining multi-line strings.

## 3. Objects and Arrays

*   **Object Literals**:
    *   **Shorthand Properties**: Use `{ key }` when the variable name matches the property key.
    *   **Computed Property Names**: Use `{[key]: value}` for dynamic property keys.
*   **Safe Access and Defaults**:
    *   **Optional Chaining (`?.`)**: Safely access deeply nested properties (e.g., `user?.address?.city`).
    *   **Nullish Coalescing (`??`)**: Provide fallback values specifically for `null` or `undefined` inputs.
*   **Core Methods**:
    *   **Object Static Methods**: `Object.keys()`, `Object.values()`, `Object.entries()`, and `Object.fromEntries()`.
    *   **Array Transformation/Iteration**: `map`, `filter`, `forEach`, `reduce`.
    *   **Array Searching**: `find`, `findIndex`, `some`, `every`, `includes`.
    *   **Array Utility**: `flat()`, `flatMap()`, and `at()` (for relative indexing, such as the last element).

## 4. Asynchronous Programming

*   **Promises**: Use Promises for all asynchronous operations.
*   **Async/Await**: Use `async`/`await` for readable asynchronous control flow.
*   **Error Handling**: Wrap asynchronous logic in `try/catch` blocks to handle failures.
*   **Promise Combinators**:
    *   `Promise.all()`: Continues only if all promises fulfill.
    *   `Promise.allSettled()`: Waits for all promises to finish regardless of outcome.
    *   `Promise.any()`: Continues as soon as the first promise fulfills.
    *   `Promise.race()`: Continues as soon as the first promise settles (fulfills or rejects).

## 5. Classes and Modules

*   **ES Modules (ESM)**: Use `import` and `export` statements. Named exports are preferred, while default exports should be used when a module has a primary concept.
*   **Dynamic Imports**: Use `import()` for lazy-loading or code-splitting.
*   **Class Syntax**: Use the `class` keyword for defining stateful entities.
    *   **Private Fields**: Use the `#` prefix (e.g., `#field`) for truly private class members.
    *   **Inheritance**: Use `extends` and `super()` to implement class inheritance.

## 6. Standard Web APIs

*   **Fetch API**: Use `fetch()` for network requests. Always check `response.ok` because `fetch` only rejects on network failure, not on HTTP error status codes (4xx/5xx).
*   **AbortController**: Use `AbortController` and `AbortSignal` to cancel asynchronous tasks such as network requests.
*   **URL API**: Use the `URL` and `URLSearchParams` objects to parse and manipulate URLs and query parameters.
*   **Deep Cloning**: Use `structuredClone()` for deep cloning objects.
*   **Internationalization (Intl)**: Use the `Intl` API (e.g., `DateTimeFormat`, `NumberFormat`) for locale-aware formatting.
*   **DOM Selection and Interaction**:
    *   Use `querySelector` and `querySelectorAll` for element selection.
    *   Use `classList` (add, remove, toggle) for CSS class management.
    *   Use `dataset` for accessing `data-*` attributes.
    *   Use `addEventListener` for event handling (including options like `once` or `signal`).
*   **Observers**: Use `IntersectionObserver` and `ResizeObserver` for responding to element visibility and size changes.

## 7. Error Handling and Debugging

*   **Custom Errors**: Extend the `Error` class to create specific error types.
*   **Error Cause**: Use the `cause` property when throwing errors to maintain a chain of responsibility: `new Error("message", { cause: originalError })`.
*   **Console Methods**: Use `console.log`, `console.warn`, `console.error`, `console.table`, and `console.time`/`timeEnd`.

## 8. Clean Code and Best Practices

*   **Intention-Revealing Naming**: Use names that clearly describe the intent of variables and functions. Avoid vague names.
*   **Early Returns**: Use guard clauses to handle edge cases early and reduce the depth of nested logic.
*   **Immutability**: Avoid mutating objects, arrays, or function arguments. Return new data structures instead.
*   **Pure Functions**: Aim for functions that produce the same output for the same input and have no side effects.
*   **Magic Numbers**: Extract literal values into named constants for better readability.
*   **Single Responsibility**: Keep modules and functions focused on a single responsibility.
*   **Comments**: Use comments to explain *why* a piece of code exists or follows a specific pattern, rather than *what* the code is doing.

# JavaScript Unified Lowest Common Denominator (LCD) Mirror (Final)

This document represents the absolute literal intersection of the Gemini, Claude, and Codex mirrors. Only features and guidelines explicitly evidenced in all three sources are included.

## 1. Variables and Scope

*   **Declarations**: Use `const` by default. Use `let` only when reassignment is necessary.
*   **Avoid `var`**: Do not use `var`.
*   **Block Scope**: Utilize `let` and `const` for block-scoped declarations to prevent global scope leakage and issues with hoisting.

## 2. Functions and Modern Syntax

*   **Function Types**: 
    *   Use arrow functions (`() => {}`) for callbacks and to preserve lexical `this`.
    *   Use `function` declarations for top-level logic or when hoisting is needed.
*   **Parameters**:
    *   **Default Parameters**: Use `param = value` in signatures to handle missing arguments.
    *   **Rest Parameters**: Use `...args` to capture multiple arguments as an array.
*   **Destructuring**: Use destructuring to extract values from objects and arrays (applicable to variables and function parameters).
*   **Spread Operator**: Use `...` for shallow copying and merging of objects and arrays.
*   **Template Literals**: Use backticks for string interpolation (`${value}`) and multi-line strings.

## 3. Objects and Arrays

*   **Object Literals**:
    *   **Shorthand Properties**: Use `{ key }` when the variable name matches the property name.
    *   **Computed Property Names**: Use `{[key]: value}` for dynamic keys.
*   **Safety and Defaults**:
    *   **Optional Chaining (`?.`)**: Safely access nested properties.
    *   **Nullish Coalescing (`??`)**: Provide fallbacks for `null` or `undefined`.
*   **Static Object Methods**: `Object.keys()`, `Object.values()`, `Object.entries()`, and `Object.fromEntries()`.
*   **Array Methods**:
    *   **Iteration/Transformation**: `forEach`, `map`, `filter`, `reduce`.
    *   **Searching/Validation**: `find`, `findIndex`, `some`, `every`, `includes`.
    *   **Utility**: `flat()`, `flatMap()`, and `at()` (for relative indexing).

## 4. Asynchronous Programming

*   **Execution**: Use `async`/`await` and Promises for asynchronous control flow.
*   **Error Handling**: Use `try/catch` blocks to manage asynchronous failures.
*   **Promise Combinators**:
    *   `Promise.all()`: Continues if all fulfill.
    *   `Promise.allSettled()`: Waits for all to finish regardless of outcome.
    *   `Promise.any()`: Returns the first fulfilled promise.
    *   `Promise.race()`: Returns the first settled promise.

## 5. Classes and Modules

*   **ES Modules**: Use `import` and `export`. Prefer named exports.
*   **Dynamic Imports**: Use `import()` for lazy loading.
*   **Class Syntax**: Use the `class` keyword.
    *   **Private Fields**: Use the `#` prefix for private members.
    *   **Inheritance**: Use `extends` and `super()`.

## 6. Standard Web APIs

*   **Networking**: Use `fetch()`. Always check `response.ok` (it does not reject on 4xx/5xx).
*   **Cancellation**: Use `AbortController` and `AbortSignal`.
*   **URLs**: Use `URL` and `URLSearchParams` for manipulation.
*   **Cloning**: Use `structuredClone()` for deep copies.
*   **Internationalization (Intl)**: Use `Intl` for locale-aware formatting (specifically `DateTimeFormat`, `NumberFormat`, and `RelativeTimeFormat`).
*   **DOM**:
    *   Selection: `querySelector` and `querySelectorAll`.
    *   Attributes: `classList` and `dataset`.
    *   Events: `addEventListener` (including options like `once` and `signal`).
*   **Observers**: Use `IntersectionObserver` and `ResizeObserver`.

## 7. Error Handling and Debugging

*   **Errors**: Extend the `Error` class for custom types and use the `cause` property for re-throwing.
*   **Console**: Use `console.log` and `console.error`.

## 8. Clean Code Principles

*   **Naming**: Use descriptive, intention-revealing names.
*   **Flow Control**: Use guard clauses (early returns) to reduce nesting.
*   **Immutability**: Prefer non-mutating operations; avoid mutating arguments.
*   **Functions**: Aim for pure functions and adhere to the Single Responsibility Principle.
*   **Constants**: Replace literal values (magic numbers) with named constants.
*   **Documentation**: Use comments to explain *why* something is done, not *what* is done.

