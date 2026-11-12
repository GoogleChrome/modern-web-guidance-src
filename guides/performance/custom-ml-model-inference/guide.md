---
name: custom-ml-model-inference
description: Run custom machine learning models, such as classifiers, small vision or audio networks, or similarity scoring, directly in the browser on the user's device.
web-feature-ids:
  - webgpu
  - wasm
  - wasm-simd
  - float16array
---

# Running custom machine learning models in the browser

Running your own model weights in the browser keeps user data on the device and removes server inference costs. Use this guide when your app ships its own model or model layers, such as a classifier head on top of embeddings, a small vision or audio model, or a custom neural network layer.

> [!NOTE]
> If a browser-provided model covers the task, you don't need to ship weights. For summarizing, translating, detecting languages, or general prompting, see {{ GUIDE_REF("summarizer") }}, {{ GUIDE_REF("translator") }}, {{ GUIDE_REF("language-detection") }}, and {{ GUIDE_REF("language-model") }}. For general-purpose GPU math that isn't a neural network, see {{ GUIDE_REF("data-parallel-computation") }}.

## Choose how to run the model

- **WebGPU compute shaders (this guide):** models and layers you define yourself, such as dense (fully connected) layers, small multilayer perceptrons, classifier heads, similarity scoring, or custom operators. You control the weight format, the precision, and the fallback.
- **An ML runtime with a WebGPU backend:** standard architectures exported from a training framework, such as transformers, convolutional networks, or speech models with dozens of operator types. Writing and maintaining WGSL kernels for every operator may not be practical. See [Alternative solutions](#alternative-solutions).

To decide, ask: does the model use only a few operators that you can write as compute shaders? If yes, use WebGPU directly. If the model is a large standard architecture, use a runtime.

WebGPU provides compute shaders, general-purpose storage buffers, workgroup shared memory, and optional 16-bit floating-point (`f16`) shader arithmetic, which efficient neural network inference relies on.

## Create the GPU device

Create the device only when the user asks for the feature.

{{ FEATURE("webgpu", "device-creation") }}

## Choose `f16` or `f32` precision

- **`f16` (half precision):** half the memory and memory bandwidth of `f32`, and faster arithmetic on GPUs with native `f16` support. Its range is about ±65,504 with roughly 3 decimal digits of precision.
- **`f32` (single precision):** about 7 decimal digits and a much wider range.

`f16` requires the `shader-f16` feature. Summing hundreds of `f16` values loses accuracy, so accumulate long sums in `f32` even when you store data as `f16`.

**Recommendation:**

- Use `f16` to store weights and inputs, which is enough for most inference.
- Use `f32` when the GPU doesn't support `shader-f16`, for values outside the `f16` range or that need more precision, and for accumulating long sums. Summing hundreds of products in `f16` loses accuracy, which is why the kernel below accumulates in `f32`.

If you publish weight files in both precisions, download the `f16` file only when `supportsF16` is true, which halves the download.

## Load and cache model weights

Weight files can be tens to hundreds of megabytes. Download them only after a user action that asks for the feature, and store them with the Cache API so later visits reuse them:

```js
async function loadWeights(url) {
  // Version the cache name to invalidate old model files.
  const cache = 'caches' in self ? await caches.open('model-weights-v1') : null;
  let response = await cache?.match(url);
  if (!response) {
    response = await fetch(url);
    if (!response.ok) throw new Error(`Weight download failed: ${response.status}`);
    try {
      await cache?.put(url, response.clone());
    } catch {
      // Storage quota exceeded: keep working without caching.
    }
  }
  return new Float32Array(await response.arrayBuffer());
}
```

## Upload weights to GPU buffers

Upload static weights once, and per inference call only write the new input.

`writeBuffer()` byte counts and storage buffer bindings must be multiples of 4 bytes. `f32` values are always aligned, but an odd-length `f16` array is not, so pad it by one element:

```js
// Converts f32 values to the GPU storage format, padded to a multiple of 4 bytes.
function toGpuArray(float32Values, supportsF16) {
  if (!supportsF16) return float32Values;
  const length = float32Values.length + (float32Values.length % 2);
  if (typeof Float16Array !== 'function') {
    return toHalfBits(float32Values, length); // See "`Float16Array` fallback"
  }
  const half = new Float16Array(length);
  half.set(float32Values); // Converts each value to f16
  return half;
}

function createStorageBuffer(device, data) {
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}
```

## Run the inference kernel

This dense layer computes `output = ReLU(W · x + b)`. It reads `f16` or `f32` values through a type alias, and accumulates in `f32`, because summing hundreds of `f16` products loses precision. The uniform struct is padded to 16 bytes to match the 16-byte uniform buffer:

```js
function createDenseLayerModule(device, supportsF16) {
  const header = supportsF16 ? 'enable f16;\nalias wtype = f16;' : 'alias wtype = f32;';
  return device.createShaderModule({
    code: `
      ${header}
      struct Dims { inputSize: u32, outputSize: u32, _pad0: u32, _pad1: u32 };

      @group(0) @binding(0) var<uniform> dims: Dims;
      @group(0) @binding(1) var<storage, read> weights: array<wtype>;
      @group(0) @binding(2) var<storage, read> inputVec: array<wtype>;
      @group(0) @binding(3) var<storage, read> biasVec: array<wtype>;
      @group(0) @binding(4) var<storage, read_write> outputVec: array<f32>;

      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) id: vec3u) {
        let row = id.x;
        if (row >= dims.outputSize) { return; } // Guard the last partial workgroup
        var sum = f32(biasVec[row]);
        let rowOffset = row * dims.inputSize;
        for (var col = 0u; col < dims.inputSize; col++) {
          sum += f32(weights[rowOffset + col]) * f32(inputVec[col]);
        }
        outputVec[row] = max(0.0, sum);
      }
    `,
  });
}

// Uniform buffer: [inputSize, outputSize, padding, padding]
const dimsBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
device.queue.writeBuffer(dimsBuffer, 0, new Uint32Array([inputSize, outputSize, 0, 0]));
```

Dispatch `Math.ceil(outputSize / 64)` workgroups, copy `outputVec` to a `MAP_READ` staging buffer, and read it with `await stagingBuffer.mapAsync(GPUMapMode.READ)`.

This kernel computes one output row per thread. For large matrix multiplications, tile the inputs into `var<workgroup>` shared memory so that each workgroup reuses loaded values.

## Run inference off the main thread

Run weight loading and inference in a dedicated module Worker so input, scrolling, and rendering stay responsive. WebGPU and the Cache API are available in workers. Load the model on the first request rather than when the worker starts:

```js
// main.js
const worker = new Worker(new URL('./inference-worker.js', import.meta.url), { type: 'module' });
worker.addEventListener('message', ({ data }) => renderResult(data.output));
runButton.addEventListener('click', () => worker.postMessage({ type: 'infer', input }));
```

```js
// inference-worker.js
let modelPromise = null; // Weights, plus the GPU resources or null for the CPU fallback
let queue = Promise.resolve();

self.addEventListener('message', ({ data }) => {
  if (data.type !== 'infer') return;
  // Run one inference at a time: the staging buffer can't be mapped twice at once.
  queue = queue.then(() => infer(data.input));
});

async function infer(input) {
  modelPromise ??= loadModel(); // Weights, device, and pipeline: created once, on demand
  try {
    const model = await modelPromise;
    let output = null;
    if (model.gpu) {
      try {
        output = await model.gpu.run(input);
      } catch {
        model.gpu.device.destroy(); // Release GPU memory, and stop using the GPU path
        model.gpu = null;
      }
    }
    output ??= runOnCpu(model.weights, input); // denseLayerOnCpu() for each layer
    self.postMessage({ type: 'result', output });
  } catch (err) {
    modelPromise = null; // Loading the weights failed: allow a retry
    self.postMessage({ type: 'error', message: err.message });
  }
}
```

`loadModel()` returns `gpu: null` when the GPU path isn't available, so a failed GPU setup doesn't prevent CPU inference.

## Handle GPU errors and device loss

{{ FEATURE("webgpu", "error-handling") }}

## Verify before finishing

Test the result. Check each of these, and fix and re-test any that fail:

- **No WebGPU:** with WebGPU unavailable, or with `requestAdapter()` resolving to `null`, inference still produces results on the CPU.
- **Precision:** `f16` storage is used only when `shader-f16` is available, and odd-length `f16` arrays are padded.
- **Responsiveness:** the page keeps responding to input while weights load and inference runs.
- **On demand:** no weights download before the user asks for the feature.
- **Caching:** reloading the page doesn't download the weights again.

## Alternative solutions

For standard model architectures, an ML runtime may be more practical than hand-written kernels. Several open-source runtimes run models in the browser with a WebGPU backend and a WebAssembly backend, for example MediaPipe, ONNX Runtime Web, TensorFlow.js, Transformers.js, and WebLLM. Choose based on the model formats and tasks your project needs.

When you use a runtime, apply the same practices as the native path:

- Select the WebGPU backend only after `requestAdapter()` resolves to a non-null adapter, and select the WebAssembly backend otherwise.
- Load `f16` or `q4f16` model variants only when `shader-f16` is available.
- Run the runtime in a Web Worker, load the model on demand, and cache model files.
- If creating a WebGPU session or running inference fails, recreate it with the WebAssembly backend.

## Fallback strategies

### WebGPU fallback

{{ BASELINE_STATUS("webgpu") }}

When `'gpu' in navigator` is false, `requestAdapter()` resolves to `null`, or GPU setup fails, run the same layers on the CPU in the Worker. For larger models, compile the CPU path to WebAssembly with SIMD. The CPU path produces comparable results.

```js
function denseLayerOnCpu(weights, inputVec, biasVec, inputSize, outputSize) {
  const out = new Float32Array(outputSize);
  for (let row = 0; row < outputSize; row++) {
    let sum = biasVec[row];
    for (let col = 0; col < inputSize; col++) sum += weights[row * inputSize + col] * inputVec[col];
    out[row] = Math.max(0, sum);
  }
  return out;
}
```

### `shader-f16` fallback

When `adapter.features.has('shader-f16')` is false, compile the kernel with `alias wtype = f32;` and upload `f32` data, as shown above.

### `Float16Array` fallback

{{ BASELINE_STATUS("float16array") }}

If your Baseline target doesn't include `Float16Array`, convert `f32` values to 16-bit bit patterns in a `Uint16Array` and upload that instead:

```js
// Converts f32 values to IEEE 754 half-precision bits, padded to a multiple of 4 bytes.
// Truncates the mantissa and flushes values too small for f16 to zero, which is
// acceptable for most GPU data. Unlike Float16Array, NaN becomes Infinity.
function toHalfBits(float32Values, length = float32Values.length + (float32Values.length % 2)) {
  const bits = new Uint16Array(length);
  const u32 = new Uint32Array(new Float32Array(float32Values).buffer);
  for (let i = 0; i < u32.length; i++) {
    const x = u32[i];
    const sign = (x >>> 16) & 0x8000;
    const exp = ((x >>> 23) & 0xff) - 112; // Re-bias the exponent: 127 - 15
    if (exp <= 0) bits[i] = sign; // Too small: signed zero
    else if (exp >= 31) bits[i] = sign | 0x7c00; // Too large: infinity
    else bits[i] = sign | (exp << 10) | ((x >>> 13) & 0x3ff);
  }
  return bits;
}
```
