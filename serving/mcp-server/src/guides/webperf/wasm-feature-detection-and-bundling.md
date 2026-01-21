---
description: Learn how to use the newest WebAssembly features while supporting users across all browsers by compiling code into different bundles.
filename: wasm-feature-detection-and-bundling
category: webperf
---

# WebAssembly feature detection and bundling

Reference docs:
- [WebAssembly Features Roadmap](https://webassembly.org/roadmap/)
- [wasm-feature-detect library](https://github.com/GoogleChromeLabs/wasm-feature-detect)
- [Emscripten documentation](https://emscripten.org/docs/index.html)

## Best Practices

To leverage new WebAssembly features while ensuring broad browser compatibility, adopt a multi-bundle approach. This involves:

1.  **Identifying desired features:** Determine which new WebAssembly features (e.g., SIMD, threads, exception handling) you want to utilize for performance or other benefits.
2.  **Grouping by browser support:** Categorize browsers into "cohorts" based on their support for these features. A common approach is to group by major browser engines (Chrome-based, Firefox, Safari) and include a "baseline" cohort for older browsers.
3.  **Compiling separate bundles:** Compile your WebAssembly code multiple times, once for each feature cohort. This ensures that each bundle only contains instructions supported by its target browsers. Use compiler flags (e.g., Emscripten's `-msimd128`, `-pthread`, `-fwasm-exceptions`) to enable specific features during compilation.
4.  **Conditional loading with JavaScript:** In your main JavaScript application, use a feature detection library (like `wasm-feature-detect`) in conjunction with dynamic `import()` statements. This allows you to detect the features supported by the user's browser at runtime and load the corresponding, most optimized Wasm bundle.

### Example Compilation Commands (Emscripten)

Let's assume you want to use SIMD, threads, and exception handling.

```bash
# Bundle 1: Threads + SIMD + Wasm exceptions
$ emcc main.cpp -o main.threads-simd-exceptions.mjs -pthread -msimd128 -msse2 -fwasm-exceptions

# Bundle 2: Threads + SIMD + JavaScript exceptions fallback
$ emcc main.cpp -o main.threads-simd.mjs -pthread -msimd128 -msse2 -fexceptions

# Bundle 3: Threads + JavaScript exception fallback
$ emcc main.cpp -o main.threads.mjs -pthread -fexceptions

# Bundle 4: Basic Wasm with JavaScript exception fallback
$ emcc main.cpp -o main.basic.mjs -fexceptions
```

### Example Conditional Loading (JavaScript)

```js
import { simd, threads, exceptions } from 'https://unpkg.com/wasm-feature-detect?module';

let initModule;
if (await threads()) {
  if (await simd()) {
    if (await exceptions()) {
      initModule = import('./main.threads-simd-exceptions.mjs');
    } else {
      initModule = import('./main.threads-simd.mjs');
    }
  } else {
    initModule = import('./main.threads.mjs');
  }
} else {
  initModule = import('./main.basic.mjs');
}

const Module = await initModule();
// Use the loaded Emscripten Module object
```

## Fallback strategies

The core principle is to provide a baseline experience for all users, progressively enhancing it for those with more capable browsers.

-   **Always include a baseline bundle:** Ensure you have a compilation of your code that relies only on the most fundamental WebAssembly features, providing a working experience even for users with outdated browsers or those who haven't updated.
-   **Leverage feature detection:** Use runtime JavaScript to accurately identify the WebAssembly features supported by the user's current environment. Libraries like `wasm-feature-detect` abstract away the complexities of checking for specific capabilities like SIMD, threads, or exception handling.
-   **Dynamic module loading:** Utilize `import()` to load the appropriate Wasm bundle only after feature detection confirms support. This avoids downloading unnecessary code and ensures users get the most performant version available to them.
-   **Consider real-world usage:** As the number of feature combinations grows, it may become unmanageable to create a bundle for every possibility. Analyze your user data to identify the most common feature combinations and prioritize those. It might be acceptable to let users on less common or older browsers fall back to a slightly less optimized bundle, as long as the application remains functional.
-   **Compile-time feature selection:** Within your source code (e.g., C++), use preprocessor directives (`#ifdef`) to conditionally compile different code paths based on detected features (e.g., `__EMSCRIPTEN_PTHREADS__`, `__SSE2__`). This allows for fine-grained optimization within the Wasm modules themselves.

---