# Porting C/C++ Libraries to the Web

This guide covers porting libraries with standard build systems (CMake, autoconf) and using Docker for cross-platform builds.

## General Best Practices

1. **Static Libraries Only:** Emscripten primarily works with static libraries (`.a`). Shared libraries (`.so`, `.dll`) are not supported in the same way.
2. **Handle I/O:** Libraries that rely on direct file system access (e.g., `fopen`, `fread`) will use Emscripten's virtual file system. Ensure you configure it properly (MEMFS by default).
3. **Threading:** Standard pthreads (`-pthread`) require `SharedArrayBuffer`, which needs specific HTTP headers (`Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin`).
4. **Network:** Standard BSD sockets are not available. Use `emscripten/fetch.h` or WebSockets.

---

## CMake Porting

The most reliable way is using `emcmake`.

```bash
# In your library directory
mkdir build && cd build
emcmake cmake .. -DCMAKE_BUILD_TYPE=Release
emmake make
```

`emcmake` acts as a wrapper that sets the necessary toolchain variables.

---

## Autoconf Porting (configure scripts)

Use `emconfigure`.

```bash
emconfigure ./configure --host=wasm32-unknown-emscripten --disable-shared
emmake make
```

### Building on Windows (using Docker)

Windows users often lack the environment for `autoconf` (configure scripts). Use the official Emscripten Docker image.

```bash
# Run this from the root of your project
docker run --rm -v $(pwd):/src emscripten/emsdk \
  sh -c "emconfigure ./configure --host=wasm32-unknown-emscripten --disable-shared && emmake make"
```

- `-v $(pwd):/src`: Mounts your current directory to `/src` in the container.
- `emscripten/emsdk`: The official SDK image.
- `--host=wasm32-unknown-emscripten`: Critical for configure to recognize the target.

---

## Common Pitfalls

### 1. Blocking the Main Thread
**The Problem:** C++ code often uses synchronous loops or waits. In the browser, this freezes the UI.
**The Fix:** 
- Use `emscripten_set_main_loop()` to return control to the browser.
- Use **Asyncify** (`-sASYNCIFY`) to suspend/resume C++ execution during async JS calls.
- Run heavy computation in a **Web Worker**.

### 2. Main Memory Growth
By default, WASM heap is fixed.
**The Fix:** Always compile with `-sALLOW_MEMORY_GROWTH` for modern apps.

### 3. Stack Overflow
The WASM stack is separate from the heap and much smaller by default.
**The Fix:** Increase stack size with `-sSTACK_SIZE=X` (e.g., 5MB) if you have deep recursion or large stack-allocated arrays.
