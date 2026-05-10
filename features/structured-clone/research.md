# Comprehensive Research Report on the Web Platform Feature 'structuredClone'

**Key Points:**
*   **Native Capabilities**: `structuredClone()` is a native JavaScript API introduced in 2022 that creates deep copies of complex objects, addressing long-standing limitations in the language.
*   **Broad Type Support**: Unlike legacy JSON methods, it natively supports `Map`, `Set`, `Date`, `RegExp`, `ArrayBuffer`, and cyclical data structures.
*   **Transferable Objects**: The API allows for zero-copy memory transfers (e.g., `ArrayBuffer`), enabling massive performance gains in multi-threaded environments like Web Workers.
*   **Strict Limitations**: It intentionally rejects functions, DOM nodes, and object prototypes, throwing a `DataCloneError` when encountering uncloneable entities.
*   **Performance Nuances**: While generally outperforming complex third-party libraries and reducing bundle sizes, highly optimized legacy methods (like `JSON.parse(JSON.stringify)`) may still execute faster on extremely small, flat objects.

**Introduction to the Feature**
For the majority of JavaScript's history, developers lacked a reliable, built-in mechanism for deep-copying objects. The community largely relied on heavy third-party utility libraries or hacked together workarounds utilizing JSON serialization. The `structuredClone()` API emerged to fulfill this need by exposing the browser's internal "structured clone algorithm"—the same engine used for Web Worker message passing and IndexedDB storage—directly to developers.

**Current Adoption and Controversy**
The adoption of `structuredClone()` has been rapid across modern web development, particularly in state management paradigms like React and Redux. However, its strict rules regarding uncloneable properties (such as functions or class instances) have caused friction. While some developers view the resulting `DataCloneError` exceptions as a necessary safeguard for data integrity, others find it restrictive when dealing with hybrid objects, occasionally leading to debates over whether it can truly replace heavy-duty libraries like Lodash's `cloneDeep`.

---

## 1. Overview and Historical Context

Historically, JavaScript developers faced significant friction when attempting to perform deep copies of objects. A deep copy, as opposed to a shallow copy, recursively duplicates all nested structures so that no shared memory references remain between the original object and the clone [cite: 1, 2]. Without a native solution, developers generally resorted to three problematic alternatives:

1.  **The JSON Serialization Hack (`JSON.parse(JSON.stringify(obj))`)**: This was the most common workaround. While heavily optimized by JavaScript engines like V8 [cite: 3], it suffers from severe limitations. It completely discards functions, fails silently by omitting `undefined` values, mangles `Date` objects into strings, converts `Map` and `Set` instances into empty objects, and throws fatal errors when encountering circular references [cite: 3, 4].
2.  **Utility Libraries (e.g., Lodash `_.cloneDeep`)**: Libraries provided robust, edge-case-resistant cloning. However, this came at the cost of network payload and bundle size. Importing just the Lodash `cloneDeep` function adds approximately 17.4KB (5.3KB gzipped) to an application's bundle, which negatively impacts loading times and performance budgets, particularly in serverless environments or micro-frontends [cite: 5, 6].
3.  **Custom Recursive Functions**: Developers frequently wrote bespoke recursive traversals. These were notoriously fragile, often failing to account for edge cases like prototype chains, Symbol properties, or circular references, leading to infinite loops or stack overflow errors [cite: 7, 8].

The web platform already possessed a robust internal mechanism for deep-copying JavaScript values. Operations such as storing a JavaScript value in IndexedDB or transmitting messages between the main thread and a Web Worker via `postMessage()` required serializing and deserializing data across isolated realms [cite: 3, 9]. The specification defining this process is known as the **structured clone algorithm**. 

In early 2022, following amendments to the HTML specification, browsers began exposing this internal algorithm directly to developers via the `structuredClone()` global method [cite: 3, 10]. Supported natively in Chrome, Edge, Safari, Firefox, Node.js (v17+), and Deno, `structuredClone()` provides an efficient, zero-dependency solution for deep cloning complex data structures [cite: 5, 11]. 

## 2. Core Capabilities and Algorithm Mechanics

The `structuredClone()` method creates a deep clone of a given value. Under the hood, the structured clone algorithm recurses through the input object while maintaining an internal map of previously visited references [cite: 9]. This internal map allows the algorithm to elegantly handle cyclical data structures (circular references) without triggering infinite loops, a massive architectural advantage over JSON serialization [cite: 3, 9].

### Supported Data Types
The algorithm is capable of serializing and deserializing a much broader range of native JavaScript types than JSON. Supported types include:
*   **Primitives**: Strings, numbers, booleans, `null`, `undefined`, and `BigInt` [cite: 6, 11].
*   **Complex Data Structures**: Objects, Arrays, `Map`, and `Set` [cite: 12].
*   **Specialized Objects**: `Date` and `RegExp` (though the `lastIndex` property of RegExp is not preserved) [cite: 6, 9].
*   **Binary Data**: `ArrayBuffer`, `TypedArray` (e.g., `Uint8Array`), and `DataView` [cite: 6, 11].
*   **Web APIs**: `Blob`, `File`, `FileList`, and `ImageBitmap` (in browser environments) [cite: 7, 13].
*   **Error Objects**: Depending on the specific environment and specification version, standard Error objects (`DOMException`, `Error`, `RangeError`, `TypeError`, etc.) are serializable [cite: 14].

Because the algorithm natively understands these types, a `Date` object emerges from `structuredClone()` as a true `Date` instance, and a `Map` emerges as a functional `Map`, completely avoiding the data degradation inherent to the JSON hack [cite: 6, 12].

## 3. Developer Use Cases

The introduction of `structuredClone()` has solved numerous architectural problems across the JavaScript ecosystem. Research into real-world developer discussions, framework implementations, and library usage reveals several distinct, high-value use cases.

### 3.1. State Management and Immutability in Component-Based UI Frameworks

In modern UI frameworks like React, Redux, and Zustand, state immutability is a foundational principle. Frameworks rely on referential equality (`oldState !== newState`) to determine when to trigger re-renders. Modifying an object in place (mutation) circumvents this detection, leading to stalled UI updates and subtle, difficult-to-trace bugs [cite: 15].

Developers frequently use the spread operator (`...`) to create new state objects. However, the spread operator only creates a **shallow copy**. If the state object contains nested arrays or objects, the nested references point to the exact same memory locations as the original state [cite: 6, 16]. 

**The Problem Solved**:
When a developer modifies a deeply nested property after a shallow copy, they inadvertently mutate the original state tree. For complex React applications, ensuring true immutability previously required bulky libraries. `structuredClone()` provides a native, robust mechanism to generate a completely independent copy of the state tree, ensuring that deep mutations in isolated components do not pollute the global store [cite: 11, 17]. It serves as a direct replacement for `JSON.parse(JSON.stringify())` inside state reducers, safely preserving `Date` objects or `Set` instances stored in the UI state [cite: 16, 18].

### 3.2. Web Worker Communication and Thread Isolation

JavaScript is traditionally single-threaded. To achieve concurrency without blocking the main UI thread, developers utilize Web Workers. Because Web Workers operate in an isolated memory space, the main thread and the worker thread do not share variables; they communicate by passing messages back and forth [cite: 13].

**The Problem Solved**:
When `postMessage()` is invoked, the browser automatically applies the structured clone algorithm to send a copy of the data. However, developers frequently need to clone data *before* assembling the payload or *after* receiving it, to ensure that the message handler does not mutate localized configurations [cite: 13]. `structuredClone()` guarantees that the data manipulated within the worker is completely structurally severed from the main thread, preventing race conditions and unexpected reference pollution across architectural boundaries [cite: 17].

### 3.3. Zero-Copy Data Transfer for High-Performance Workloads

While deep copying is useful, it can become an enormous performance bottleneck when dealing with massive datasets, such as processing a 50MB `ArrayBuffer` containing high-resolution image data, audio streams, or WebGL geometries. Running a deep clone on a 50MB buffer can take hundreds of milliseconds, resulting in noticeable UI stutter or frozen frames [cite: 19].

**The Problem Solved**:
`structuredClone()` accepts an optional `options` parameter that accepts a `transfer` array. This allows the developer to mark specific **Transferable Objects** (like `ArrayBuffer`, `MessagePort`, or `ImageBitmap`). Instead of copying the megabytes of memory byte-by-byte, the engine performs a "zero-copy" transfer [cite: 10, 19]. Ownership of the memory is instantly detached from the original realm and attached to the new object. Research indicates that transferring a 50MB `ArrayBuffer` can be up to 100x faster (~5ms) than copying it (~500ms) [cite: 19].

### 3.4. Deep Snapshotting, Undo/Redo, and Backend Configurations

In Node.js backend development and complex client-side applications, it is common to implement "snapshotting"—saving the exact state of an application at a point in time. This is critical for building Undo/Redo functionality, caching configuration objects passed through multiple middleware layers, or generating unpolluted test fixtures [cite: 6, 11].

**The Problem Solved**:
Backend configurations often contain circular references or complex types like `RegExp` for routing tables and `Map` for in-memory caching. Attempting to snapshot these using JSON methods results in fatal crashes (`TypeError: Converting circular structure to JSON`) [cite: 18]. `structuredClone()` enables developers to safely capture a point-in-time snapshot of the entire runtime state, completely immune to subsequent mutations by downstream middleware or user actions [cite: 6].

---

## 4. Implementation Patterns and Code Examples

The API surface of `structuredClone()` is intentionally minimal, consisting of a single function signature: `structuredClone(value, options)`. However, developers employ several distinct architectural patterns when integrating it.

### 4.1. Basic Deep Copying for Complex Topologies

The most common pattern is a straightforward synchronous call to safely duplicate data structures containing non-JSON-compliant types.

```javascript
// A complex state object with a Date, a Set, and a circular reference
const applicationState = {
  user: {
    id: 402,
    username: "research_agent",
    lastLogin: new Date()
  },
  permissions: new Set(["read", "write", "execute"]),
  metadata: {}
};

// Create a circular reference (which would crash JSON.stringify)
applicationState.metadata.parent = applicationState;

// Safely perform a deep clone
const clonedState = structuredClone(applicationState);

// The clone is completely decoupled from the original
clonedState.permissions.add("admin");
console.log(applicationState.permissions.has("admin")); // false
console.log(clonedState.lastLogin instanceof Date); // true
console.log(clonedState.metadata.parent === clonedState); // true
```
*Implementation context: This pattern is heavily utilized in Redux reducers and React `useReducer` hooks to enforce strict immutability [cite: 11, 15].*

### 4.2. Transferring Memory Ownership

To avoid the CPU and memory overhead of copying binary data, developers utilize the `transfer` property. This pattern is essential for video processing, canvas manipulation, and WebAssembly data bridges.

```javascript
// Allocate a 16MB buffer
const buffer = new ArrayBuffer(16 * 1024 * 1024);
const payload = {
  id: "video_frame_001",
  data: new Uint8Array(buffer)
};

console.log(payload.data.byteLength); // 16777216

// Clone the object, but TRANSFER ownership of the underlying buffer
const detachedClone = structuredClone(payload, { 
  transfer: [payload.data.buffer] 
});

// The original buffer is instantly detached and neutralized to 0 bytes
console.log(payload.data.byteLength); // 0
console.log(detachedClone.data.byteLength); // 16777216
```
*Architectural caveat: Once an object is transferred, any subsequent attempt to read or modify the original detached buffer will fail or return zero bytes. Developers must explicitly architect their data flow to account for this permanent loss of ownership [cite: 10, 13].*

### 4.3. Decision Tree: Choosing the Right Copying Mechanism

Because deep cloning carries inherent computational cost, senior engineers often implement decision trees to prevent "over-cloning," which can bloat CPU usage and trigger aggressive garbage collection [cite: 1]. A common heuristic applied in modern Node.js and React development involves evaluating the object's topology [cite: 6]:

1.  **Is the object completely flat (no nested objects/arrays)?** -> Use the spread operator (`{ ...obj }`) or `Object.assign()`. The overhead of structured cloning is unjustified.
2.  **Does the object contain native types (`Date`, `Map`, `Set`) or circular references?** -> Use `structuredClone()`.
3.  **Does the object contain functions, DOM nodes, or custom class instances whose prototype methods must be preserved?** -> `structuredClone()` will fail or degrade the data. Rethink the data structure to separate data from logic, or fall back to a library like Lodash's `cloneDeep()` [cite: 6, 20].

---

## 5. Architectural Trade-Offs and Performance Benchmarks

The decision to adopt `structuredClone()` involves navigating distinct trade-offs between bundle size, execution speed, and execution safety.

### 5.1. Bundle Size vs. Reliability

Prior to `structuredClone()`, the standard for reliable deep copying was Lodash's `cloneDeep`. Importing `lodash/cloneDeep` introduces roughly 17.4KB of uncompressed JavaScript into the browser payload [cite: 5]. While this seems minor, in performance-critical applications (such as mobile-first web apps or serverless cold starts in Node.js), eliminating unnecessary dependencies is a priority [cite: 6]. 

`structuredClone()` provides a native, zero-dependency alternative [cite: 5]. However, the trade-off is that `cloneDeep` is significantly more forgiving. Lodash will gracefully handle functions (by copying the reference) and preserve prototype chains, whereas the native API will violently throw errors or silently strip metadata [cite: 1, 21].

### 5.2. Execution Speed and Memory Overhead

The performance profile of `structuredClone()` is highly dependent on the environment and the payload size. 

1.  **Small, Flat Objects**: The legacy hack `JSON.parse(JSON.stringify())` remains faster for very small, simple JSON objects [cite: 6]. Browser engines, particularly V8, have aggressively optimized JSON serialization due to its ubiquitous presence in web applications. Research indicates that for simple objects without special types, the JSON hack can be 2–3 times faster than `structuredClone()` [cite: 3, 6].
2.  **Large and Complex Objects**: As the payload scales in size and structural complexity, `structuredClone()` vastly outperforms JSON serialization [cite: 3]. Furthermore, an academic benchmarking study comparing native JavaScript utilities to libraries found that `structuredClone()` outperforms Lodash's `cloneDeep` in average execution time. Specifically, for an object with 100,000 attributes, `cloneDeep` took over 7 milliseconds, whereas the native implementation performed notably faster and consumed less memory [cite: 22]. 
    *   *Note on Controversy:* There is conflicting community sentiment. Older discussions (e.g., StackOverflow threads) occasionally claim native cloning is slower than Lodash [cite: 23]. However, recent systematic benchmarks and academic studies suggest that native solutions generally execute faster and with a lower memory footprint, though execution times can vary slightly across engines like Safari and Chrome [cite: 22, 24].

---

## 6. Technical Caveats and Edge Cases

While `structuredClone()` is powerful, its strict adherence to the structured clone algorithm introduces several severe edge cases. Developers migrating legacy codebases often encounter unexpected crashes.

### 6.1. The `DataCloneError` Exception

The most prominent barrier to adoption is the `DataCloneError` (a `DOMException`). The algorithm explicitly refuses to serialize functions and DOM nodes. If `structuredClone()` encounters a function anywhere within the nested tree, it immediately halts and throws [cite: 3, 9].

```javascript
const componentState = {
  data: [cite: 4, 14, 25],
  onClick: () => console.log("Clicked") 
};

try {
  // This will throw a DataCloneError because of the onClick function
  const safeState = structuredClone(componentState);
} catch (error) {
  console.error(error.name); // "DataCloneError"
}
```
This is a frequent source of bugs in frameworks. For example, developers using the Vercel AI SDK encountered `DataCloneError` crashes when passing message objects that inadvertently contained proxies, class instances, or complex tool invocations into components utilizing `structuredClone()` [cite: 26]. Similarly, users of the IndexedDB wrapper Dexie.js encountered cloning errors when objects attached with helper methods were saved to the database [cite: 27].

### 6.2. Loss of Prototype Chains and Methods

`structuredClone()` is fundamentally a *data* duplicator, not an *object* duplicator. If a developer attempts to clone an instance of a custom class, the returned object will be a Plain Old JavaScript Object (POJO) [cite: 3]. The prototype chain is not walked, and any property descriptors, getters, or setters are completely discarded [cite: 9]. 

```javascript
class User {
  constructor(name) { this.name = name; }
  getGreeting() { return `Hello, ${this.name}`; }
}

const admin = new User("Alice");
const clone = structuredClone(admin);

console.log(clone.name); // "Alice"
console.log(clone instanceof User); // false (Prototype is lost)
// clone.getGreeting() would throw a TypeError: clone.getGreeting is not a function
```
For architectures heavily reliant on Object-Oriented Programming (OOP), this behavior breaks application logic. In such cases, developers must manually re-instantiate classes or rely on `lodash.cloneDeep` [cite: 1, 21].

### 6.3. Uncloneable Primitives and Browser Discrepancies

*   **Symbols**: The algorithm cannot clone `Symbol` primitives. Attempting to clone an object containing a Symbol key or value will result in a `DataCloneError`. Some developers argue this is overly restrictive since Symbols are unique and immutable by design, but the specification forbids their duplication [cite: 21].
*   **Error Objects**: The serialization of Error objects exhibits historical discrepancies. While modern specifications and MDN documentation state that standard `Error`, `DOMException`, and `TypeError` objects are serializable [cite: 14], certain runtime implementations have lagged or exhibited bugs. For instance, a reported issue in Node.js (v19.9.0) demonstrated that attempting to clone a `DataCloneError` resulted in an empty object `{}` rather than a properly formatted error clone [cite: 28].
*   **Property Metadata**: If an object's property is marked as `readonly` via an object descriptor, the clone will revert to the default read/write behavior, potentially exposing the cloned object to unintended mutations [cite: 9].

---

## 7. Conclusion

The addition of `structuredClone()` to the global JavaScript namespace represents a significant maturation of the web platform. By exposing the battle-tested algorithm used by Web Workers and IndexedDB, browser vendors have eliminated the need for fragile JSON serialization hacks and heavy utility libraries for standard data duplication. 

Its ability to flawlessly traverse circular references, preserve native types like `Map` and `Date`, and perform zero-copy memory transfers of `ArrayBuffers` makes it indispensable for modern state management, high-performance streaming, and multi-threading. However, engineers must remain acutely aware of its strict limitations. Its propensity to throw `DataCloneError` exceptions upon encountering functions, and its stripping of class prototypes, mandates that `structuredClone()` be used strictly for pure data payloads rather than behavioral objects. When applied correctly within its intended scope, it offers an elegant, zero-dependency solution to one of JavaScript's oldest architectural headaches.

---

## 8. Sources

*   [cite: 14] CanIUse.com, "structuredClone Browser Support and Serializable Errors"
*   [cite: 25] Coding Beauty Medium, "structuredClone(): The easiest way to deep copy objects in JavaScript"
*   [cite: 4] Rajsek / Medium, "The Power of structuredClone(): A Comprehensive Guide to Deep Cloning in JavaScript"
*   [cite: 12] Vivek Sinh Rajput / Dev.to, "structuredClone - How to use it"
*   [cite: 5] ExplainThis.io, "Deep Cloning in JavaScript: structuredClone vs cloneDeep"
*   [cite: 9] MDN Web Docs, "Structured clone algorithm"
*   [cite: 10] MDN Web Docs, "Window: structuredClone() method"
*   [cite: 18] Stackademic Medium, "Goodbye JSON.stringify and obj Welcome structuredClone for deep cloning in JavaScript"
*   [cite: 6] JSManifest, "Real-World Use Cases: When to Use structuredClone in Node.js"
*   [cite: 3] Surma / Web.dev, "Deep-copying in JavaScript using structuredClone"
*   [cite: 7] JavaScript in Plain English, "What is Structured Clone Algorithm in JavaScript?"
*   [cite: 26] Vercel AI SDK GitHub Issue #7629, "DataCloneError when using structuredClone(lastMessage) in processChatResponse"
*   [cite: 28] Node.js GitHub Issue #49181, "structuredClone bug with Error objects"
*   [cite: 21] Tiago Bertolo / Medium, "Which is the best method for deep cloning in javascript?"
*   [cite: 27] Dexie.js GitHub Issue #647, "DataCloneError saving objects with methods"
*   [cite: 20] H. Jain / Medium, "Deep vs Shallow Copy in JavaScript: When structuredClone Wins and cloneDeep Saves You"
*   [cite: 1] JavaScript in Plain English, "Deep vs Shallow Copy in JavaScript Performance Best Practices"
*   [cite: 29] Latenode Community, "What are the best techniques for deep cloning an object in JavaScript?"
*   [cite: 22] DiVA Portal (Academic Paper), "Measuring execution time and memory usage of utility libraries versus native solutions"
*   [cite: 8] Asierr / Medium, "structuredClone() in JavaScript: Deep Copy Without the Pain in 2025"
*   [cite: 16] S. Batavi / Medium, "structuredClone: A modern way to deep clone objects in JavaScript"
*   [cite: 17] Moscarillo, "structuredClone - The Native Superpower"
*   [cite: 30] StackOverflow, "Right way to clone objects/arrays during setState in React"
*   [cite: 13] A. Obregon / Medium, "JavaScript Workers and Structured Clone Mechanics"
*   [cite: 2] Shapkarin.me, "Deep Cloning in JavaScript: Mastering structuredClone()"
*   [cite: 19] R. Chopra / Medium, "How Streaming, Transferables, and Structured Clone Revolutionize Multi-Threading"
*   [cite: 12] Vivek Sinh Rajput / Dev.to, "Understanding structuredClone() in JavaScript"
*   [cite: 11] Shanthi Palani / Dev.to, "structuredClone() — The Deep Copy Hero JavaScript Deserved"
*   [cite: 15] Shubham / Medium, "React Redux Part I - Immutability"
*   [cite: 31] Teague Stockwell, "React State Stores Observer Pattern"
*   [cite: 32] Reddit / r/webdev, "What's new in web development that you use regularly?"
*   [cite: 6] JSManifest, "structuredClone and cloneDeep size comparisons"
*   [cite: 23] StackOverflow, "What is the most efficient way to deep clone an object in JavaScript?"
*   [cite: 24] GitHub Gist / eustatos, "Benchmark comparison for time-travel debugging"
*   [cite: 3] Web.dev, "Performance comparison between structuredClone and JSON.parse"

**Sources:**
1. [plainenglish.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFrmY_TFY2DJp5Hmrprx_8mJSJLUjneOV99tMLxcyswy9rmthUB3HeBR71b06l4FKWX6MEFeD_waIve8yrABa0jI6DTYkwbAzXR9UNY68Llcj8HTJLQI1e6d1P9b1a43xnYTD_0jsjJNQjh9vQoEaILo6IvJms_RBRY0GmGKQL8NQ9TbjBPMk8qROOTkhJmbubmzdeO2UYLDv0wrKGFi-IC0MNq)
2. [shapkarin.me](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHfpBIs4d-FZ_XcbZJ53BT5cqKCtcJX6kEvEVD96Rb-uJ3eaZ8u2jqDtBlZlk41vioh0U4R-EvgNeGjVs9sLRqAivsly9JwyfhMFJ2MAY-VeOkT_8Jbpy-pzed7TsCWBthJvGec)
3. [Link](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHlt6Oy0V2exH95tJWihHTLPHuP6i3Fcx_tU4YUzC96hEq2VsA7thyOvQQn6iXJuimw1TkcGw1ep5kcU-UoGavWPE7IITdhxP_WskvS4Zgg-w6zgKnEdhJFiR4_e_wc1A==)
4. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEBxiByG6AfzGBLupJAhoHkiBJUUfUltA8ifzcjuGiWKAnLmlSYaOkNrkdIRoFzz_JZnME3HZJcTEzit2qelUJ7Ek_ASqVIGJsXMJ-6O4LZDezCA-sOsP156rSNwP4jckh-eq-5uLjyFEE2A6TKcSdxZUUhQjtjijIDf7j9nJEZMV--L5UrV35u52hxRCixDgLTrR-X_9_wJaax9ZinwnB1lPM-yqzz0upH6mSVbqrDUgwUQcA=)
5. [explainthis.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHZXvHaIMyuJa8qGjMPhtGKaRkg-zs75z_4Cek9qtlCSLOTheA2tQUgjkD31LY26_jsxSSkl24nHwR19CCdO_znx3ZGBfCy0h-Bqs9-EetcgN5-wt7K0UIhM-H9D2-v8Uv5N-IPHV8=)
6. [jsmanifest.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFMU31nqnuL1js8lVt3WRD0t81CGT-0nv_p5xK_JuD5vdEwtO0VvBDWaakMXvf-vgoid6a4gRPzc7cjXAJACAa16lzOx-HiehE5VOSvm7jyO4uEc9UkseGtssl8EWifsMuuZR6QIdhWcAe-5pWO8zB8)
7. [plainenglish.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGWkQ4GVnh56L0OgNJpJKTGPUtU3eSHQ7v5FfT4W-rmE-m47526UsbLm2rbOza7lD7PptlGunGLiMla7fza67Yz8jn8NpogNuyyxBZf9Cs_nrT4NPG4foGVcHLGW1EsumGr-yNny4hslQIoRuRGKl97SfAc95Vlcsy2Nf0AaSDu36Gs9SdKTJM-Bitk6TXE11P6Bvvcc5Q=)
8. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH2DXrsh7pFHzFV4-Vq7oPbRsgHWBQpRmgdCayBMiq5ZzwE9i7o9xfl9Zf5-QYk9kc8UdujVognHDNjoU8eUYEcqWDcNlwDfLc-hOEz4LQNx35W3xYnadCAYmVfVjMot7WAK9a_x2dFZVc1qXzbdvydg3U029_n_IjPyZzXAcpImIfXPGKqAhf-2n6NRnaK1DLrKmyc1BPvYIRXyTWKgQ==)
9. [mozilla.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGI_c5NgJeRCzAlceG9eKlaPRLYRspNrKE67lmSLKhIIekXNAdK98nziU8l4UTTe_7spUUtWRj_mH2Zbo1Y6gA_ixL0IE3xWbMsCBbz2xxckodwnJLF1sTt0zkZxJq0wRKMJzD4hO69H0sfzCucIJN2jSQZ0Hs56L16nDs4wBkZlT0he765IHxhGr4TIH0oLZYa)
10. [mozilla.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGlDBJmv8_Jg1xsxPvc5371yqgRpqoyo1r9StW_i4hUGljbD7weSIHi9zrCqhAmRjRNf1V6WHj-gL_5C31Goh-lQyNqy-d9Qf9oDZUZG0IM30dSoMaxOL-SOgzlVoOBaduXiRgsXkLIny6CNsMxvQnekM8IJDEg5vyBzt3m8w==)
11. [dev.to](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGfoQh-AfUC86XEv-vEelP0NgL-ajP7foihtpU0gWHnaVRRHQHBUHBosafILEPtigFRMJX-PockKx0iWP6YfmngjsVnhLIVubwCPVxLr2EFh0lRnGyvo7H6Ke3YiVD8l_CVBTFXq225SVLD_A3yocc5VdzfVhLdgte61GqTFXpVay3898E1NyiVuGINsu3SWQ==)
12. [dev.to](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH5PMGIbrRFf49X5enBilRWKiqwPC7RVLIWdyYfBdgeATsWcmpVVq8uuuO6y95B5G2hfBYInGDkaK4iAC1whs4hZcSsxp1VkRhcEG0jdNJVfirQZHCat_zepVOjfqznpFmTGrpao_jV4JqsKdJ2y2nQotsztQHgJDY=)
13. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFBTybnfIhMNB0I8KtQXcudV0_z6fEAYAQ5W8vslpGfHnz_f23epb10PJKZLErRWmVEIDUAKzEdlPyhVDFHC6tlPS883NttdkGHiSHifHSsrBV2bkGTSOpsDrb4vjuBujlxBd49lzgXhyaf7UnF36Ms4U8NPE3NzGVKpIIaS9iH7s_c0YfJ6qmSyzz3rkFhIhxrOkej_G4ppHQ=)
14. [caniuse.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHCHQ7L0mOFU14HTeRgukywSoYE5CHrB3PuQUxNYyGKBopJElSZyebHJTMz8O6lK06Ottq-j164Yt2to4UABkNo2GOOFhAOr-7VCcIuIZx3-Bl70uq2moeaUWXOrrUu_BbI)
15. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFhaZ-UinNwBs1iYhaqt2xPAcU2ydG9tIL2asDiQlT4uNDSY8gBYwOBMqr3iXQCFAJJO8oCkcGAQYs79faGCfwuAgn56km9n7yQ4zbwaOp-962GbLchojDEYSD6ndfTPfI3F9PICarwCI9wc0P-shuXooXq6tI=)
16. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFttsswRO53mQ01Hzwako_cVvH01LezKn07VRmrCSETOsCjmsHOSnMx0BgId7_R0-SJV9CRsv9NizU5iIaAAo3-2RBNSiJqctm43H05TVDh5_b4GAq0DnnuNvNpcrUJtjILSQMCToG7wERUYVsLM8N83geBxL8RjViWd6brr3y1744YHnGxCFNRrq-Fa-stgU69og_CiWgk_yFhZQqqiq-OrQ3-mri3qQ==)
17. [moscarillo.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFrj7e3VbdpQtHIlEfKt_q4PetfB0UITLUw7A3atP0hcEU8oN5A8z0RyryMn-XM-5lIhr66lwbYCGkZJWeQMqTD-L7FBOSDr8WNJtfNJtMMLOAwHGh3W4e4Nf6iaTYKbgBUE0zB26rN)
18. [stackademic.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEsL-3bNsnibvD3YGAJBZ0spknPJYV36DqheFGeDs00tf4lFmfw8sl0_5xgPfq40kWzk8b0rJhHGNga1j4MMO3uFgmvLDstyqbF7w1PmnXOdVuLV9BHsPFU3_aJaf5OUbxyDh8x65_Ku3gjcMfx-JmAsIy3C_o8x6rd6wCsLkUpBh9asdAPFIaafvioXfFiZ1vlXeWYVZWK5lmfQh9dMabt7N5DfCnzVGEI7eLjcP5EzXnhg5sx)
19. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGr1C8fgao-J4XqLAl1yiWFCSnDnMyoa4RUC6Nn7ejfDkJG5Fp7u6ptTpoq41y_LiLRq5Exl0mpBX6Zg47bSPRolDmP1WjgBfQsYcAR1UF_enyk0ZQLqGCRULvFg2au4rKE7W3AyGKXzJov_8Jyk_GJ7g5265ZZ2rM5WWBA_MbLuTpwzRRfgSBT_Efu4MsSFO64peendV4aXTj0Z6hZAXbo1_6g2wJmaSoDfvbdNmolRkv2Hg==)
20. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH0arkQ_4X_omDN9nvLR6cjECeEYLoYUhA1nByZkSN_BzPynstqiO3HQyWUkdRvjoyl03uuL5-wUOBB1mwAWYJq5dYcbPEXodWKAwcJJpvq1k_uAcKakfC2YJ4ciagV5clmXCMM3txmad8D59-tssS7hHtYoEceAgnecI1rufynbS0WICsV_2b8w5XQuqXLubcAzmfbsdJgeWCtDXq1iFGq-eqxSw_snbFP4Q5SXYBXkkL6SUFJ)
21. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHbHYWY5_1Tw-P9snGU4GmhSdK5qKRylpWEw898k59W0GW0Qqj3AGsFJTQ-seEMWQ4PMixZ-rWHIrCWeVGoVp6hbTmc8ZErR2Xj8GiIpamJiJKNYDgNgIZxN3BpTeAwxQfmedn-igEFQ_hQ9DRixMEOALn0pEpQIfkqX18oQ7rxHAmyS6OFOJmxZTJ4Z_H4t-u1od7duXxrxVPqKiofnDaTLU_0YBB8tQSHMrAY)
22. [diva-portal.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFo7l9uRsnOLj3y_NjnVsuQyoOIEeHYIzrWTvh5yoKud3tMingY0d_8K5z1mCqXT_Uy8SfDjLo8Nn6PrASVu8gpHny-ot6rY8YP92qjTuGcW4wq7MffCnqr4nVg8uMZ_XhptsKjllQNf8Uay9regHQyj72THZXcLTU=)
23. [stackoverflow.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGKHjWULdnXn6_0wNg0_24ApUWL3QYSCb6aJ9BoLdC2DigfIbJaXLNyjKtzQgRseUQWXHRpmI7ySjTDo0LG3De3B59vd5T4KgyIUmRhY_TF3C38cpeSjhuA2apKeYIDtkmb0vtBO2Dl7RYMymbTSmk_2BW280n3R7WMv5R1uVwzfgabxv99HADBIhE6psFgIZgkfU57V2-JGPeYXOD4S-B1IK7TKNU=)
24. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFAYRf8mPmp_KsPVx47mQQ-j_Xn_KIXbZ_t0mXt0lH0QjR3HA-s4Z6iaUAwLy8t6UIly5D5OpKDD_zj7dARrPQLYNRZDtyHt2OYN-zq2iD-XOHV_Ay9xN9TH4Iriy_-DUnuBxGDwAs-R1bH5JdwzoQeeK0BeHcEWQ==)
25. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFe73BOdcY9TXa-k3cUR9IVelbW2cIJHpZuV8Gi8rMPuf42VOOSpm9p29I3QthNqMhZ62QhXMAZzDjX7PEBbdahto-YD-7fQCzVGXeqhuVGcyzLe8Wivns-qOHowFWc5bvShNuYwFqT4kOJCw2hVhXXjeJLFSZN)
26. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFrF9EPM0CTZb-tiJKzNoMC0Q5xA6pF9DKHHW-Pk08NOZBGdxjIPG-m7GtzAhzypQX6DfKxaY3HA-L1_VrXI3-x-VwCSTB-A5OiTwKNLGYRG-WYUo_MrUHwXzatmJDx)
27. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGCzwu15bkxuv8Ug6T3g2gpObCxfyWP2OCjYVFlARL-bNQ4KsrEe1JJ3wU2kBssDtE92ezsCSRQv7oF38YyUD_VnRSF6KymFAh1_a71vXT7tszqOqnXfINVc8AnIeNYR0dFtL47FuGr)
28. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGmSzi-8XAmPAgBuMdz2fCqL0SyZyz3uOdk3vP03SO3OGx56jqvNeH5EZPeTrHIEky2tJgw1UnK6W3LUfEItxd6-CJStplhrBSbVu1H_-Q3nG_IcPwsOxD5tQZWl2S6eK9N)
29. [latenode.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHNzYQSChogUMZrkllUV2_Pt_n3Gu25StyTXZBuSeb4bfeYDCO_V9l_h2EcniSyjg9OECgdUiiMrDyYgxPddWVy9innRG_1l4R0yVfDReOYxKglAC6UzQFE7l5TTXkK8erDYKWTljNa2LtHUn0fOUMFjNPjsfsvREa7iaWA7NsZaMllR0qTZ0pbzYYqZjO3RUJo-MJRz0ILAL5h71exK1mXqg==)
30. [stackoverflow.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHaFcIruVZc58RnO8IT8teFHwZFwvEoz1Wq4_IC89R53GKQ7nPIku4qt9zuQuZy5JUCf44AO-oEw0j_v_2fXkuxL3nUi-ezpYlg7EqEJ8jeG7GSHL3R-vfzjCjK6x-HzIhhCREAa0uIgCY6MHXHGB8fMCTnRvfmiZDIWxn6JkRoqww3zi3Ah9YcoAu7Dji2D-zhaNAogIgI_NqsHblI)
31. [teaguestockwell.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFwfLbop_PUqMvV49XcOXEB8ZTtnXve6QLRpJ6wyO6saXqF6uszsPN9H1yU2VD06R6DVYuSLWY_jPUi4zgXNUg9eiJvP6IbPMZ44yQkK-Q-hLD75dFfMjwr5oW7Zz0Q55VFnYyt6aX3Qkk=)
32. [reddit.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG4HwqsYWNUKAD0y_LCN_737gzwsKWCaBcPZpJTJLjEksIbH5QF7wgeery77HderxWqiaG5Y07AvjKDeBAvKmZDZxd5q8H4nSGvh-YaCC2OAiNXhG6x2qRx4SdAUdpTyEg1teudGe4az2y2YJg-r5CBqhuFvmMRN-0bCutyFHwobaeACbrD2M3R0na0RSTquo7C)
