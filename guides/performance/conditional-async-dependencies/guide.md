---
name: conditional-async-dependencies
description: Conditionally load or initialize async dependencies (such as importing polyfills for missing web features) without requiring complex orchestration across all of a page's script dependencies.
web-feature-ids:
  - top-level-await
  - popover
sources:
  - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await
  - https://bugs.webkit.org/show_bug.cgi?id=242740
---

Top-level `await` allows modules to act as asynchronous functions, meaning they can pause module execution to await promises. This is extremely useful for conditionally loading async dependencies—like polyfills or heavy secondary libraries—only when required by the browser. 

By utilizing top-level await, you can encapsulate the conditional loading logic inside a single module, effectively preventing downstream consumer modules from executing until the dependency is fully loaded and ready.

### Conditional Polyfill Pattern

This approach encapsulates feature detection and the dynamic import inside a single dependency module.

```javascript
// conditionally-load-polyfill.js

// Check if the feature is missing before doing work.
// MANDATORY: Prefer checking HTMLElement.prototype over window or document
// when checking for a global DOM attribute or property like popover.
if (!('popover' in HTMLElement.prototype)) {
  // Use top-level await to pause the execution of any module that imports this file 
  // until the polyfill finishes downloading and executing.
  await import('/path/to/popover-polyfill.js');
}

// Export a marker if needed by your application
export const polyfillLoaded = true;
```

```javascript
// main.js

// MANDATORY: Because conditionally-load-polyfill.js uses top-level await, 
// this import will block execution of main.js until the polyfill is ready.
import './conditionally-load-polyfill.js';

// Now it is safe to use the feature (e.g., showing a popover)
const myPopover = document.getElementById('my-popover');
if (myPopover) {
  myPopover.showPopover();
}
```

### Avoiding Safari Top-Level Await Bug

**MANDATORY:** You must structure your imports carefully to avoid WebKit Bug 242740. Safari has a bug where a `ReferenceError` is thrown if multiple modules *simultaneously* import a module that contains a top-level await.

```javascript
// DO NOT do this: importing the top-level await module from multiple sibling modules
// simultaneously will crash in Safari.
// 
// a.js: import './conditionally-load-polyfill.js';
// b.js: import './conditionally-load-polyfill.js';
// main.js: import './a.js'; import './b.js'; // CRASH!

// INSTEAD, guarantee a single entry point:
// Import the top-level await module ONCE at the very top of your application tree.
import './conditionally-load-polyfill.js';

// Then import the rest of your application code, ensuring the await resolves first.
import './app.js';
```

### Fallback strategies

{{ BASELINE_STATUS("top-level-await") }}
{{ BASELINE_STATUS("popover") }}

If you must support older browsers that lack top-level `await` support entirely, you cannot use it to block module execution. Instead, you must use standard asynchronous functions or dynamic `import()` and orchestrate the initialization manually:

```javascript
// fallback.js
// Instead of top-level await, wrap the dynamic import in an async function
export async function initializeDependencies() {
  if (!('popover' in HTMLElement.prototype)) {
    await import('/path/to/popover-polyfill.js');
  }
}

// main.js
import { initializeDependencies } from './fallback.js';

// You must manually await the initialization before running your app logic
initializeDependencies().then(() => {
  // Safe to use the polyfilled feature here
  const myPopover = document.getElementById('my-popover');
  if (myPopover) {
    myPopover.showPopover();
  }
});
```
