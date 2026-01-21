---
description: Improve error handling in asynchronous JavaScript code by using Promise.try to uniformly handle both synchronous and asynchronous callbacks.
filename: promise-try-error-handling
category: ui
---

# Promise.try for Easier Error Handling

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/try

## Best Practices

Use `Promise.try` to simplify error handling for synchronous callback functions passed to Promises. This method ensures that exceptions thrown by synchronous callbacks are caught and propagated as promise rejections, allowing for uniform handling with `.then()`, `.catch()`, and `.finally()`.

```js
// Use Promise.try to wrap synchronous callbacks that might throw
Promise.try(callback)
  .then(result => {
    console.log("Success:", result);
  })
  .catch(error => {
    console.error("Error caught:", error);
  })
  .finally(() => {
    console.log("Operation settled.");
  });
```

When your callback function requires arguments, `Promise.try` supports passing them as subsequent arguments, avoiding the need for an extra closure:

```js
// Passing arguments to the callback
Promise.try(callback, param1, param2);
```

The primary benefit of `Promise.try` is that it allows you to treat synchronous and asynchronous callbacks in a consistent manner when working with Promises. This is particularly useful for utility functions that accept callbacks, ensuring robust error handling regardless of the callback's nature.

**Note:** When using `async`/`await` syntax, a standard `try`/`catch`/`finally` block is the preferred method for handling errors, rather than `Promise.try`.

## Fallback strategies

`Promise.try` is now Baseline Newly available, meaning it is supported in all major browser engines. Developers can use this feature with confidence. No specific fallback strategies are generally required due to its widespread support.

For developers targeting extremely old browsers that may not support `Promise.try`, consider polyfilling Promise methods if absolutely necessary, although this is rarely a concern for modern web development.