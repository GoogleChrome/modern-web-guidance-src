---
name: data-parallel-computation
description: Speed up large data-parallel calculations, such as physics simulations, matrix math, or statistical models, on the user's device.
web-feature-ids:
  - webgpu
  - js-modules-workers
  - wasm
  - wasm-simd
---

# Running parallel computations on the GPU

When an app processes hundreds of thousands of values per step, such as a physics simulation, a matrix multiplication, or a Monte Carlo model, a JavaScript loop blocks rendering, and even Web Workers are limited by the number of CPU cores. WebGPU compute shaders run the same calculation on thousands of GPU threads in parallel.

> [!NOTE]
> To run neural network layers or custom machine learning models, including `f16` storage, see {{ GUIDE_REF("custom-ml-model-inference") }}.

## Choose where to run the computation

- **WebGPU compute shaders (this guide):** calculations that do a lot of arithmetic per value over large datasets, such as matrix multiplication, N-body or particle simulations, Monte Carlo sampling, or image-sized grids. Results that stay on the GPU between steps benefit the most.
- **A Web Worker, optionally with WebAssembly SIMD:** light per-element work (for example, scaling or normalizing an array), small datasets, or calculations that need the result after every step. Copying data to the GPU and reading it back has a fixed cost that can exceed the time the calculation takes on the CPU.

To decide, measure both paths with realistic data sizes. Keep data on the GPU across iterations, and read back only the values you need.

## Create the GPU device

{{ FEATURE("webgpu", "device-creation") }}

This guide uses `f32` data, so it doesn't need `supportsF16`.

## Write the compute shader

Each invocation computes one output value. Pass the element count in a uniform buffer, and skip invocations past the end, because the last workgroup is usually partial. This example advances a damped spring by a number of time steps for each element:

```js
const WORKGROUP_SIZE = 64; // Use one constant for the shader and the dispatch

const module = device.createShaderModule({
  code: `
    struct Params { count: u32 };

    @group(0) @binding(0) var<uniform> params: Params;
    @group(0) @binding(1) var<storage, read> inputData: array<f32>;
    @group(0) @binding(2) var<storage, read_write> outputData: array<f32>;

    @compute @workgroup_size(${WORKGROUP_SIZE})
    fn main(@builtin(global_invocation_id) id: vec3u) {
      let i = id.x;
      if (i >= params.count) { return; } // Skip the partial last workgroup
      var x = inputData[i]; // Example: initial spring displacement
      var v = 0.0;
      for (var n = 0; n < 100; n++) {
        v += (-4.0 * x - 0.5 * v) * 0.01;
        x += v * 0.01;
      }
      outputData[i] = x;
    }
  `,
});

const pipeline = await device.createComputePipelineAsync({
  layout: 'auto',
  compute: { module, entryPoint: 'main' },
});
```

Choose the workgroup size:

- **64 for 1D data:** a good starting point. It's a multiple of the 32- or 64-thread execution width of most GPUs, and within the default limits.
- **8×8 or 16×16 for 2D grids**, such as images or matrices: `@workgroup_size(8, 8)`.
- **Tune with measurements.** Memory-bound kernels often run well at 128 or 256; kernels that use `var<workgroup>` shared memory may need smaller workgroups.

Workgroup sizes up to 256 invocations in total (and up to 64 in the z dimension) work on every device without checks, because they're within the default limits. Larger sizes require requesting higher `maxComputeInvocationsPerWorkgroup` and `maxComputeWorkgroupSize*` limits, which not every adapter supports.

A single dispatch dimension allows at most 65,535 workgroups, which covers about 4.19 million elements at a workgroup size of 64. For more elements, dispatch in two dimensions, and compute the index from both:

```js
const groups = Math.ceil(count / WORKGROUP_SIZE);
const groupsX = Math.min(groups, device.limits.maxComputeWorkgroupsPerDimension);
const groupsY = Math.ceil(groups / groupsX);
// pass.dispatchWorkgroups(groupsX, groupsY);
// In WGSL, add @builtin(num_workgroups) nwg: vec3u, and use:
// let i = id.x + id.y * nwg.x * WORKGROUP_SIZE;
```

## Create buffers once

Create the buffers and the bind group once, when the GPU path starts, and reuse them for every run. A storage buffer can't be mapped for JavaScript to read, because a buffer with `MAP_READ` usage can have no other usage except `COPY_DST`. Create a separate staging buffer to copy the results into:

```js
const bytes = count * 4; // f32 values: always a multiple of 4 bytes
const paramsBuffer = device.createBuffer({ size: 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
const inputBuffer = device.createBuffer({ size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
const outputBuffer = device.createBuffer({ size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
const stagingBuffer = device.createBuffer({ size: bytes, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });

device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([count]));

const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: paramsBuffer } },
    { binding: 1, resource: { buffer: inputBuffer } },
    { binding: 2, resource: { buffer: outputBuffer } },
  ],
});
```

Wrap this setup in error scopes, as shown in [Handle GPU errors and device loss](#handle-gpu-errors-and-device-loss). The buffers and `params.count` are sized for one element count. When the count changes, destroy the old buffers, and create new buffers, a new bind group, and a new `params.count` value.

## Run the computation and read results back

For each run, write the input, dispatch, copy the output to the staging buffer, and map it. `unmap()` detaches the mapped range, so copy or process the values before calling it:

```js
async function runOnGpu(input) {
  device.queue.writeBuffer(inputBuffer, 0, input); // Only the input changes per run
  device.pushErrorScope('validation');
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(input.length / WORKGROUP_SIZE));
  pass.end();
  encoder.copyBufferToBuffer(outputBuffer, 0, stagingBuffer, 0, input.byteLength);
  device.queue.submit([encoder.finish()]);
  if (await device.popErrorScope()) throw new Error('GPU run failed validation');

  await stagingBuffer.mapAsync(GPUMapMode.READ);
  const result = new Float32Array(stagingBuffer.getMappedRange().slice(0));
  stagingBuffer.unmap();
  return result;
}
```

- **Run one computation at a time per staging buffer.** `mapAsync()` fails while the buffer is already mapped or being mapped. For continuous readback, rotate between two or more staging buffers.
- **Skip readback when you don't need the values on the CPU.** For example, a simulation that renders particles can bind the same storage buffer as vertex data, if you add `GPUBufferUsage.VERTEX` to its usage.
- **Read back only what you need**, such as a summary computed on the GPU, rather than the full array.

## Run the computation off the main thread

Run device creation, uploads, and readback in a dedicated module Worker, so input, scrolling, and rendering stay responsive. WebGPU is available in workers. Create the GPU resources on the first request, and fall back to the CPU when the GPU path isn't available or fails:

```js
// main.js
const worker = new Worker(new URL('./compute-worker.js', import.meta.url), { type: 'module' });
worker.addEventListener('message', ({ data }) => showResult(data.result));
runButton.addEventListener('click', () => {
  const input = readInputValues(); // A new Float32Array for every run
  worker.postMessage({ input }, [input.buffer]); // Transfer instead of copying
});
```

```js
// compute-worker.js
let gpu; // GPU resources (undefined until the first run), or null for the CPU fallback
let queue = Promise.resolve();

self.addEventListener('message', ({ data }) => {
  // Run one computation at a time: the staging buffer can't be mapped twice at once.
  queue = queue.then(() => compute(data.input));
});

async function compute(input) {
  if (gpu === undefined) {
    gpu = await setUpGpu(input.length); // createGpuDevice(), pipeline, buffers, and bind group, or null
  } else if (gpu && gpu.count !== input.length) {
    gpu.resize(input.length); // New buffers, bind group, and params.count for the new size
  }
  let result = null;
  if (gpu) {
    try {
      result = await gpu.run(input); // runOnGpu() from the previous section
    } catch {
      gpu.device.destroy(); // Release GPU memory, and stop using the GPU path
      gpu = null;
    }
  }
  result ??= computeOnCpu(input); // See "WebGPU fallback"
  self.postMessage({ result }, [result.buffer]);
}
```

## Handle GPU errors and device loss

{{ FEATURE("webgpu", "error-handling") }}

## Verify before finishing

Test the result. Check each of these, and fix and re-test any that fail:

- **No WebGPU:** with WebGPU unavailable, or with `requestAdapter()` resolving to `null`, the calculation still produces results on the CPU.
- **Correctness:** GPU results match the CPU fallback within floating-point tolerance, including for an element count that isn't a multiple of the workgroup size.
- **Repeated runs:** running the calculation several times works, and reuses the device, pipeline, and buffers.
- **Responsiveness:** the page keeps responding to input while the calculation runs.

## Alternative solutions

Some open-source libraries run data-parallel calculations on the GPU with WebGPU, for example Babylon.js and Three.js (compute shaders inside their rendering engines), TensorFlow.js (tensor and matrix operations), and TypeGPU (typed WebGPU in TypeScript). Choose based on what your project already uses:

- If the app already renders with an engine, use that engine's compute support, so compute and rendering share one device and its buffers.
- If the calculation maps to tensor operations, such as matrix multiplication or element-wise math, a tensor library can be used.

When you use a library, apply the same practices as the native path: check for a non-null adapter, run the work in a Worker, reuse resources across runs, and keep a CPU fallback.

## Fallback strategies

### WebGPU fallback

{{ BASELINE_STATUS("webgpu") }}

When `'gpu' in navigator` is false, `requestAdapter()` resolves to `null`, or GPU setup or a run fails, run the same calculation on the CPU in the Worker. The calculation stays available, more slowly for large datasets. For heavy calculations, compile the CPU path to WebAssembly with SIMD. Results are comparable to the GPU results, but not always bit-identical, because the order and precision of floating-point operations can differ.

```js
function computeOnCpu(input) {
  const output = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    let x = input[i];
    let v = 0;
    for (let n = 0; n < 100; n++) {
      v += (-4 * x - 0.5 * v) * 0.01;
      x += v * 0.01;
    }
    output[i] = x;
  }
  return output;
}
```

### Module workers

{{ BASELINE_STATUS("js-modules-workers") }}

If your Baseline target doesn't include module workers, build the worker as a classic script, for example with your bundler's worker output format, and create it without `{ type: 'module' }`. Inside a classic worker, load dependencies with `importScripts()` instead of `import`.

### WebAssembly SIMD

{{ BASELINE_STATUS("wasm-simd") }}

If you compile the CPU fallback to WebAssembly with SIMD and your Baseline target doesn't include it, build a second module without SIMD, and load it when the browser can't validate SIMD instructions:

```js
// A tiny module that uses one SIMD instruction: validation fails without SIMD support.
const simdTest = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
const wasmUrl = WebAssembly.validate(simdTest) ? 'compute-simd.wasm' : 'compute.wasm';
```

The plain JavaScript loop shown in "WebGPU fallback" is also a valid fallback.
