# WebGPU

## Device creation

Request a new adapter each time you create a device, including after device loss: an adapter can create only one device.

- `requestAdapter()` resolves to `null` when no suitable GPU is available. `requestDevice()` can reject, for example when the requested features or limits aren't supported. Treat both cases as "use the fallback".
- Request only the optional features and limits your app uses. A device enforces exactly the limits it was created with, so an app that requests only what it needs gets the same validation errors on every device, instead of depending on the limits of the development machine. Higher limits can also cost performance on some devices.
- Request `shader-f16` only when the app uses `f16` and the adapter supports it. Requesting an unsupported feature makes `requestDevice()` reject.
- The default `maxStorageBufferBindingSize` (128 MiB) and `maxBufferSize` (256 MiB) are enough for most apps. Request larger limits only when your data needs them, and no more than the adapter supports.

```js
const LARGE_BUFFER_BYTES = 1024 * 1024 * 1024; // 1 GiB: set this to the largest buffer your app creates

// Returns null when the GPU path isn't available; use the fallback then.
async function createGpuDevice({ f16 = false, largeBuffers = false } = {}) {
  if (!('gpu' in navigator)) return null;
  try {
    const adapter = await navigator.gpu.requestAdapter(); // New adapter per device
    if (!adapter) return null;
    // Only request what's needed. The device enforces exactly the features and limits it
    // was created with, so exceeding a default limit fails on every device, not only on
    // users' devices with lower limits than the development machine.
    const supportsF16 = f16 && adapter.features.has('shader-f16');
    const requiredLimits = {};
    if (largeBuffers) {
      requiredLimits.maxBufferSize = Math.min(LARGE_BUFFER_BYTES, adapter.limits.maxBufferSize);
      requiredLimits.maxStorageBufferBindingSize =
        Math.min(LARGE_BUFFER_BYTES, adapter.limits.maxStorageBufferBindingSize);
    }
    const device = await adapter.requestDevice({
      requiredFeatures: supportsF16 ? ['shader-f16'] : [],
      requiredLimits,
    });
    return { device, supportsF16 };
  } catch {
    return null;
  }
}
```

If you need more resources, for example to process datasets as large as the GPU allows, request the adapter's maximums instead. Check the resulting `device.limits` before allocating, because the maximums differ between devices:

```js
const device = await adapter.requestDevice({
  requiredLimits: {
    maxBufferSize: adapter.limits.maxBufferSize,
    maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
  },
});
```

## Error handling

GPU setup and execution can fail after detection succeeds. Most WebGPU calls don't throw: `createBuffer()`, `createBindGroup()`, encoder commands such as `dispatchWorkgroups()` or `draw()`, and `submit()` report validation and out-of-memory errors to error scopes, or to the device's `uncapturederror` event, and return objects that are silently invalid. An invalid submit is dropped, and `mapAsync()` can still resolve with stale or zeroed data. One exception: `device.queue.writeBuffer()` throws an `OperationError` when the number of bytes to write isn't a multiple of 4, which is why `f16` data needs padding. In each case, switch to the fallback (a CPU implementation for computations, or another renderer for graphics) instead of using the result:

- **Setup fails:** `createGpuDevice()` returns `null`, `createComputePipelineAsync()` or `createRenderPipelineAsync()` rejects, or an error scope around buffer and bind group creation reports an error.
- **Data exceeds the device limits:** buffers larger than `maxBufferSize`, or bindings larger than `maxStorageBufferBindingSize`, produce a validation error. Check sizes before allocating.
- **The GPU runs out of memory:** allocation failures are reported as a `GPUOutOfMemoryError` through an `'out-of-memory'` error scope.
- **A run fails:** wrap each run's `encoder.finish()` and `submit()` in a `'validation'` error scope, because invalid encoder commands are reported when the encoder finishes. Discard the result if the scope reports an error. `mapAsync()` rejects if the device is lost, and `popErrorScope()` then resolves to `null`.
- **An error escapes every scope:** it's reported to the `uncapturederror` event.
- **The device is lost** (driver reset or GPU process crash): `device.lost` resolves. Switch to the fallback, or create a new device with a new adapter.

```js
// Setup: check limits, then capture allocation and validation errors.
const maxBytes = Math.min(device.limits.maxBufferSize, device.limits.maxStorageBufferBindingSize);
if (data.byteLength > maxBytes) return useFallback();

device.pushErrorScope('out-of-memory');
device.pushErrorScope('validation');
const dataBuffer = device.createBuffer({
  size: data.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
});
const validationError = await device.popErrorScope(); // Scopes pop in reverse order
const oomError = await device.popErrorScope();
if (validationError || oomError) return useFallback();
device.queue.writeBuffer(dataBuffer, 0, data); // Write only to a buffer known to be valid

// Each run: an invalid command buffer is dropped without an exception.
device.pushErrorScope('validation');
device.queue.submit([encoder.finish()]);
if (await device.popErrorScope()) return useFallback();

// Errors outside any error scope, and device loss. One failure can trigger several of
// these (a single invalid pass reports errors from both finish() and submit()), so react
// only while this device is still the active one.
device.addEventListener('uncapturederror', () => {
  if (gpu?.device === device) useFallback();
});
device.lost.then((info) => {
  if (info.reason !== 'destroyed' && gpu?.device === device) useFallback();
});
```

In this snippet, `gpu` holds the active GPU resources after setup succeeds. `useFallback()` switches to the fallback, destroys the device, and sets `gpu` to `null`. Make it safe to call more than once, for example with a flag that records that the fallback is already active.
