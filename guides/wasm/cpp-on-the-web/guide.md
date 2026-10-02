---
name: cpp-on-the-web
description: Compile C/C++ to WebAssembly using Emscripten
web-feature-ids:
  - wasm
---

# Compiling C and C++ to WebAssembly with Emscripten

Use Emscripten to compile C and C++ into high-performance WebAssembly (Wasm)
modules for the browser.

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
- `-Oz` (or `-O3`) + `-flto`: Optimizes for minimal payload size in release builds.

## 2. Avoid blocking the main thread

If a call into WebAssembly is likely to take a significant amount of time (i.e.
more than a few milliseconds) it should **not** be called on the main browser
thread.

To avoid running such code on the main browser thread there are several possible
approaches:

1. Run the whole WebAssembly program in a Web Worker.  This is often the
   simplest solution since it doesn't involve setting up SharedArrayBuffer
   access, or changing the program source.

2. Use pthreads or Wasm Workers.  This allows the work to be shared across
   many workers but requires SharedArrayBuffer access which can involve adding
   COOP/COEP HTTP headers.

3. Refactor the C/C++ code to avoid long running calls.  For example slicing
   the work into small pieces that can be called from `requestIdleCallback`.

## 3. Pay attention for runtime warnings and errors

Make sure you actually test the resulting WebAssembly program and that no
warnings or errors are generated on the console.

Build and run the programs with `-sASSERTIONS` enabled and fix any runtime
failures that are produced.

## 4. Avoid dynamic linking if possible

Emscripten works best with static libraries (`.a`). Shared libraries (`.so`,
`.dylib`, `.dll`) are less useful in browser deployment and can complicate
things unnecessarily.

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
