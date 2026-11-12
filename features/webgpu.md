# WebGPU

## Device creation

Request a new adapter each time you create a device, including after device loss: an adapter can create only one device.

- `requestAdapter()` resolves to `null` when no suitable GPU is available. `requestDevice()` can reject, for example when the requested features or limits aren't supported. Treat both cases as "use the fallback".
- Request `shader-f16` only when the adapter supports it. Requesting an unsupported feature makes `requestDevice()` reject.
- Request only the optional features and limits your app uses. For example, the default `maxStorageBufferBindingSize` (128 MiB) and `maxBufferSize` (256 MiB) are too small for many large datasets, so request the adapter's maximums when you work with large storage buffers.

```js
// Returns null when the GPU path isn't available; use the fallback then.
async function createGpuDevice() {
  if (!('gpu' in navigator)) return null;
  try {
    const adapter = await navigator.gpu.requestAdapter(); // New adapter per device
    if (!adapter) return null;
    const supportsF16 = adapter.features.has('shader-f16');
    const device = await adapter.requestDevice({
      requiredFeatures: supportsF16 ? ['shader-f16'] : [],
      requiredLimits: {
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        maxBufferSize: adapter.limits.maxBufferSize,
      },
    });
    return { device, supportsF16 };
  } catch {
    return null;
  }
}
```

## Error handling

GPU setup and execution can fail after detection succeeds. Most WebGPU calls don't throw: `createBuffer()`, `createBindGroup()`, encoder commands such as `dispatchWorkgroups()` or `draw()`, and `submit()` report validation and out-of-memory errors to error scopes, or to the device's `uncapturederror` event, and return objects that are silently invalid. An invalid submit is dropped, and `mapAsync()` can still resolve with stale or zeroed data. In each case, switch to the fallback (a CPU implementation for computations, or another renderer for graphics) instead of using the result:

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

// Errors outside any error scope, and device loss.
device.addEventListener('uncapturederror', () => useFallback());
device.lost.then((info) => {
  if (info.reason !== 'destroyed') useFallback();
});
```
