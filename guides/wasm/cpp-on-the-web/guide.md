---
name: cpp-on-the-web
description: Compile C and C++ to WebAssembly for the modern web with Emscripten
web-feature-ids:
  - wasm
---

# Compiling C and C++ to WebAssembly with Emscripten

Use Emscripten to compile C and C++ into high-performance WebAssembly (Wasm)
modules for the browser, using modern ES6 module output and Embind for clean
JavaScript interoperability.

## 1. Modern Emscripten Compilation Flags

When compiling and linking with `emcc` or `em++`, always use modern modular
flags:

- `-sEXPORT_ES6`: Emits standard ES6 module syntax (`import`/`export`) rather
  than legacy global objects. This automatically sets `-sMODULARIZE`.
- `-sENVIRONMENT=web`: Strips Node.js/shell runtime code to minimize bundle
  size.
- `-sSTRICT`: Enforces modern Emscripten defaults and fails on deprecated
  flags.
- `-sALLOW_MEMORY_GROWTH`: Allows the WebAssembly linear memory heap to expand
  dynamically when allocating memory.
- `--bind`: Enables **Embind** for safe, type-rich C++ and JavaScript bindings.
- `-Oz` (or `-O3 -flto`): Optimizes for minimal payload size in release builds.

## 2. C++ Implementation with Embind

Use Embind (`emscripten/bind.h`) to expose C++ functions, classes, and typed
data buffers to JavaScript.

```cpp
// filter.cpp - C++ image processing compiled to WebAssembly
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <cstdint>
#include <algorithm>

// Apply a grayscale/sepia filter directly to an RGBA byte buffer
void applyImageFilter(std::string bufferAddress, size_t length) {
  // Direct pointer access into WebAssembly memory for zero-copy performance
  uint8_t* pixels = reinterpret_cast<uint8_t*>(std::stoull(bufferAddress));

  for (size_t i = 0; i < length; i += 4) {
    uint8_t r = pixels[i];
    uint8_t g = pixels[i + 1];
    uint8_t b = pixels[i + 2];

    // Compute luminance value
    uint8_t gray = static_cast<uint8_t>(0.299f * r + 0.587f * g + 0.114f * b);

    // Apply sepia tint
    pixels[i]     = static_cast<uint8_t>(std::min(255.0f, (gray * 1.2f)));
    pixels[i + 1] = static_cast<uint8_t>(std::min(255.0f, (gray * 1.0f)));
    pixels[i + 2] = static_cast<uint8_t>(std::min(255.0f, (gray * 0.8f)));
  }
}

// Bind C++ functions to JavaScript
EMSCRIPTEN_BINDINGS(image_module) {
  emscripten::function("applyImageFilter", &applyImageFilter);
}
```

## 3. Compilation Workflow

Use separate compilation (`-c`) for `.cpp` files to enable incremental builds:

```bash
# 1. Compile C++ source to object file
em++ -c filter.cpp -o filter.o -O3 -flto -sSTRICT

# 2. Link into ES6 module with Embind
em++ filter.o -o filter.mjs -O3 -flto -sSTRICT -sEXPORT_ES6 -sENVIRONMENT=web -sALLOW_MEMORY_GROWTH --bind
```

## 4. Loading and Executing in JavaScript

Load the emitted `.mjs` module in your web application as an ES6 import:

```javascript
// Load the WebAssembly ES6 module
import createModule from './filter.mjs';

// Initialize the Wasm instance
const wasmModule = await createModule();

// Pass an HTML5 Canvas ImageData buffer to C++
export function processCanvasImage(canvas, context) {
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const byteCount = imageData.data.length;

  // Allocate buffer inside WebAssembly linear memory
  const bufferPtr = wasmModule._malloc(byteCount);

  // Copy JS Uint8ClampedArray into WebAssembly heap
  wasmModule.HEAPU8.set(imageData.data, bufferPtr);

  // Invoke C++ processing function with pointer address
  wasmModule.applyImageFilter(bufferPtr.toString(), byteCount);

  // Copy processed bytes back to ImageData
  imageData.data.set(
    wasmModule.HEAPU8.subarray(bufferPtr, bufferPtr + byteCount)
  );

  // Free allocated WebAssembly memory
  wasmModule._free(bufferPtr);

  // Render updated pixels to canvas
  context.putImageData(imageData, 0, 0);
}
```

## 5. Porting Existing C/C++ Libraries

When integrating existing C/C++ libraries with standard build systems:

### CMake Projects
Wrap CMake commands with `emcmake` and `emmake`:
```bash
mkdir build && cd build
emcmake cmake .. -DCMAKE_BUILD_TYPE=Release
emmake make
```

### Autoconf / Make Projects
Use `emconfigure` to set cross-compilation toolchain targets:
```bash
emconfigure ./configure --host=wasm32-unknown-emscripten --disable-shared
emmake make
```

**MANDATORY:** Emscripten works with static libraries (`.a`). Shared libraries
(`.so`, `.dylib`, `.dll`) are not supported for standard browser deployment.

## 6. Common Pitfalls and Best Practices

- **Blocking the Main Thread:** Long-running C++ loops freeze browser UI
  rendering. Offload heavy computations to a Web Worker or use
  `emscripten_set_main_loop()` to yield control.
- **Asynchronous JS Calls from C++:** If C++ code needs to call asynchronous
  browser APIs or await promises, use **JSPI** (`-sJSPI`) or **Asyncify**
  (`-sASYNCIFY`).
- **Memory Limits and Stack Size:** WebAssembly linear memory stack size is
  separate from heap memory. If recursion or local buffers exceed default stack
  limits, specify `-sSTACK_SIZE=5MB`.
- **Filesystem and Networking:** Standard file I/O (`fopen`) is virtualized via
  Emscripten's virtual memory filesystem (MEMFS). Standard BSD sockets are
  unsupported; use WebSockets or the Emscripten Fetch API.

## 7. Fallback Strategies

If WebAssembly is not supported in target environments, implement a JavaScript
fallback:

{{ FEATURE_FALLBACKS("wasm") }}
