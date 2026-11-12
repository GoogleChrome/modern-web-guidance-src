---
name: large-scene-rendering
description: Render scenes with thousands of different objects, such as CAD assemblies, multi-layer design canvases, or large 3D worlds whose visible objects change as the camera moves, at high frame rates.
web-feature-ids:
  - webgpu
  - webgl2
  - webgl-multi-draw
  - offscreen-canvas
  - canvas-2d
  - prefers-reduced-motion
---

# Rendering scenes with thousands of different objects

CAD viewers, design tools, and map renderers often draw thousands of objects that differ in mesh, material, or style. Large 3D worlds, such as cities or terrain, also need to decide on every frame which of their objects the camera can see. When each object is a separate draw call, issuing thousands of `setPipeline()`, `setBindGroup()`, `setVertexBuffer()`, and `draw()` calls from JavaScript on every `requestAnimationFrame` keeps the main thread busy, even when the GPU can easily draw the geometry.

WebGPU reduces this work in two ways that WebGL 2 doesn't support:

- **Render bundles** (`GPURenderBundle`, recorded with a `GPURenderBundleEncoder`) record and validate a sequence of draw commands once. Each frame, `renderPass.executeBundles([bundle])` replays the whole sequence with one call, so the per-frame JavaScript, browser-to-GPU-process communication, and WebGPU validation costs no longer grow with the number of draw calls.
- **Compute shaders and indirect draws** decide on the GPU which objects to draw and how many, so JavaScript doesn't loop over the objects on every frame.

The GPU still executes every draw, and the browser still translates each draw into native GPU API commands. The actual savings depend on the scene, the browser, and the device, so measure frame times before and after.

> [!NOTE]
> For calculations that don't draw to the screen, see {{ GUIDE_REF("data-parallel-computation") }}.

## Choose when WebGPU is faster

WebGPU can be faster than WebGL 2 for scenes that need something WebGL 2 can't do. Measure with realistic scenes to confirm:

- **Thousands of different objects that stay the same between frames** (WebGPU render bundles): CAD assemblies with many parts and materials, design tools with many layers, or maps with differently styled tiles. In WebGL 2, every object is a separate draw call that JavaScript issues and the browser validates again on every frame. A WebGPU render bundle records and validates these draws once, and replays them with one call per frame. Transforms, colors, and camera data can still change every frame.
- **Visibility that changes every frame across many objects** (WebGPU compute shaders and indirect draws, see "Cull objects on the GPU"): large cities, terrain, or point clouds where the camera moves. A compute shader tests every object on the GPU and writes the number of visible objects into a buffer, and `drawIndexedIndirect()` reads the count from that buffer, so JavaScript doesn't loop over the objects. Indirect draws can be recorded in a render bundle. WebGL 2 has no compute shaders or indirect draws, so the CPU has to decide what to draw.
- **Instances that change on the GPU every frame** (WebGPU compute shaders): particle simulations or animated crowds. A compute shader updates each instance's data in a storage buffer, and the instanced draw reads it directly. WebGL 2 needs workarounds, such as transform feedback or copying data between textures, or updates the data in JavaScript and uploads it every frame.

For **many copies of the same mesh whose data is static or updated by JavaScript**, such as map markers or grid tiles, WebGPU isn't faster: an instanced draw is one call in both APIs, and the GPU does the same work. In a WebGPU renderer, draw identical meshes with one `draw(vertexCount, instanceCount)` call that reads each instance's data through `@builtin(instance_index)`, and record it inside the bundle.

Draw calls that change every frame, such as a selection highlight, can be recorded as regular draw calls in the same render pass as a bundle.

## Create the GPU device

{{ FEATURE("webgpu", "device-creation") }}

This guide doesn't need `supportsF16` or the larger storage buffer limits. Use only the device:

```js
const gpu = await createGpuDevice();
if (!gpu) return useFallbackRenderer();
const { device } = gpu;
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
```

Create the pipelines, buffers, and bind groups first, and get the WebGPU canvas context only after they succeed. A canvas that already has a WebGPU context returns `null` from `getContext('webgl2')` and `getContext('2d')`, so the fallback renderer can't use it:

```js
const context = canvas.getContext('webgpu');
context.configure({ device, format: presentationFormat });
```

## Record the render bundle

Record the bundle once, outside the animation loop:

- **Match the render pass:** the encoder's `colorFormats`, `depthStencilFormat`, and `sampleCount` must match the render pass that executes the bundle. If the pass makes its depth or stencil attachment read-only, record the bundle with `depthReadOnly` or `stencilReadOnly` set to `true` as well. Otherwise `executeBundles()` produces a validation error.
- **Set all state inside the bundle:** a bundle doesn't inherit the pipeline, bind groups, or vertex and index buffers set on the render pass, so set them inside the bundle. Viewport, scissor rectangle, blend constant, and stencil reference can't be recorded in a bundle; the bundle uses the values set on the render pass.
- **Share bind groups across pipelines:** with `layout: 'auto'`, each pipeline gets its own bind group layouts, and a bind group created for one pipeline can't be used with another. To bind shared camera data once for every pipeline in the bundle, create the pipelines with one explicit `GPUPipelineLayout`.
- **Check for errors:** `finish()` doesn't throw. An invalid bundle reports a validation error, so record it inside an error scope.

This example binds the shared camera uniforms once at `@group(0)` and each object's uniforms at `@group(1)`. Sort the objects by pipeline and mesh, so that the bundle changes state only when it needs to:

```js
async function recordSceneBundle(device, format, cameraBindGroup, objects) {
  device.pushErrorScope('validation');
  const encoder = device.createRenderBundleEncoder({
    colorFormats: [format],
    // Add depthStencilFormat and sampleCount if the render pass uses them.
  });
  encoder.setBindGroup(0, cameraBindGroup); // Shared camera uniforms

  let pipeline = null;
  let mesh = null;
  for (const object of objects) { // Sorted by pipeline, then mesh
    if (object.pipeline !== pipeline) {
      pipeline = object.pipeline;
      encoder.setPipeline(pipeline);
    }
    if (object.mesh !== mesh) {
      mesh = object.mesh;
      encoder.setVertexBuffer(0, mesh.vertexBuffer);
    }
    encoder.setBindGroup(1, object.bindGroup); // Per-object uniforms
    encoder.draw(mesh.vertexCount);
  }

  const bundle = encoder.finish();
  if (await device.popErrorScope()) return null; // Use the fallback renderer
  return bundle;
}
```

## Draw the bundle every frame

Each frame, write the data that changed into the buffers the bundle already uses, then replay the bundle. `executeBundles()` clears the render pass's pipeline, bind groups, and vertex and index buffers, so set them again before any regular draw call that follows it in the same pass:

```js
function renderFrame() {
  // Changing buffer contents doesn't require re-recording the bundle.
  device.queue.writeBuffer(cameraUniformBuffer, 0, cameraMatrixData);

  const commandEncoder = device.createCommandEncoder();
  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: { r: 0.05, g: 0.08, b: 0.14, a: 1 },
      loadOp: 'clear',
      storeOp: 'store',
    }],
  });

  renderPass.executeBundles([sceneBundle]); // Replays every recorded draw call

  // A regular draw call after the bundle must set its state again.
  renderPass.setPipeline(highlightPipeline);
  renderPass.setBindGroup(0, cameraBindGroup);
  renderPass.setBindGroup(1, selectionBindGroup);
  renderPass.setVertexBuffer(0, selectionMesh.vertexBuffer);
  renderPass.draw(selectionMesh.vertexCount);

  renderPass.end();
  device.queue.submit([commandEncoder.finish()]);
}
```

## Update the scene without re-recording every frame

Creating a bundle encoder on every frame removes the benefit of bundles. Re-record a bundle only when the recorded commands or the resources they reference change:

- Objects are added, removed, or reordered, or an object switches to another mesh, pipeline, or bind group.
- A buffer, texture, or bind group used by the bundle is replaced or destroyed.
- The color format, depth-stencil format, or sample count of the render pass changes.
- The device is lost, and you create a new one.

These changes don't need a new bundle:

- New transforms, colors, or camera matrices written with `device.queue.writeBuffer()` into buffers the bundle already uses.
- A canvas resize, because the viewport and scissor rectangle come from the render pass. Recreate depth or multisampled textures at the new size, keeping the same format and sample count.

## Cull objects on the GPU

When the camera moves through a large scene, a compute shader can test every object against the camera's view frustum and build the list of visible objects on the GPU. An indirect draw then reads its instance count from a GPU buffer, so the draw commands stay the same on every frame and can be recorded in a render bundle:

- Create the draw arguments buffer with `GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST`, and fill in the mesh's index count once.
- Reset the instance count to 0 before the compute pass on every frame.
- Use one indirect draw, with its own arguments, for each mesh. Core WebGPU has no multi-draw-indirect call.
- Keep `firstInstance` at 0, because a non-zero value requires the optional `indirect-first-instance` feature. Look up each object through the visible list instead.

```wgsl
struct Bounds { center: vec3f, radius: f32 };
struct DrawArgs { // Layout read by drawIndexedIndirect()
  indexCount: u32,
  instanceCount: atomic<u32>,
  firstIndex: u32,
  baseVertex: i32,
  firstInstance: u32,
};

@group(0) @binding(0) var<storage, read> bounds: array<Bounds>;
@group(0) @binding(1) var<uniform> planes: array<vec4f, 6>; // Camera frustum planes
@group(0) @binding(2) var<storage, read_write> visible: array<u32>;
@group(0) @binding(3) var<storage, read_write> args: DrawArgs;

@compute @workgroup_size(64)
fn cull(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&bounds)) { return; }
  for (var p = 0u; p < 6u; p++) {
    if (dot(planes[p].xyz, bounds[i].center) + planes[p].w < -bounds[i].radius) { return; }
  }
  visible[atomicAdd(&args.instanceCount, 1u)] = i;
}
```

The vertex shader reads the object's index from the visible list with `visible[instanceIndex]`, where `instanceIndex` is `@builtin(instance_index)`. Each frame, JavaScript writes the new frustum planes, runs the compute pass, and replays the bundle that contains `drawIndexedIndirect(argsBuffer, 0)`:

```js
device.queue.writeBuffer(planesBuffer, 0, frustumPlanes);
device.queue.writeBuffer(argsBuffer, 4, new Uint32Array([0])); // Reset instanceCount

const commandEncoder = device.createCommandEncoder();
const cullPass = commandEncoder.beginComputePass();
cullPass.setPipeline(cullPipeline);
cullPass.setBindGroup(0, cullBindGroup);
cullPass.dispatchWorkgroups(Math.ceil(objectCount / 64));
cullPass.end();

const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
renderPass.executeBundles([sceneBundle]); // Draws only the visible objects
renderPass.end();
device.queue.submit([commandEncoder.finish()]);
```

## Handle GPU errors and device loss

{{ FEATURE("webgpu", "error-handling") }}

A render bundle can only be used with the device that recorded it. When you create a new device after device loss, recreate the pipelines, buffers, and bind groups, and record the bundles again. To switch a canvas that already has a WebGPU context to the fallback renderer, replace it with a new `<canvas>` element.

## Verify before finishing

Test the result. Check each of these, and fix and re-test any that fail:

- **No WebGPU:** with WebGPU unavailable, or with `requestAdapter()` resolving to `null`, the scene renders with the fallback renderer.
- **Setup failure:** when `requestDevice()` or pipeline creation fails, the page shows the fallback renderer instead of staying in a loading state.
- **Data updates:** changing object positions or colors with `writeBuffer()` shows up on screen without re-recording the bundle.
- **Scene changes:** adding or removing objects re-records the bundle once, not on every frame.
- **GPU culling:** if the scene culls on the GPU, objects outside the view aren't drawn, objects inside it are, and the result follows the camera without any JavaScript loop over the objects.
- **Frame time:** the JavaScript time per frame, measured with realistic object counts, is lower than with regular draw calls.
- **Accessibility:** the canvas has a text alternative, such as `role="img"` with an `aria-label`, and continuous animation stops when `prefers-reduced-motion: reduce` matches.

## Alternative solutions

Some open-source rendering engines use these WebGPU features for you, and render with WebGL 2 when WebGPU isn't available:

- **Babylon.js** (3D): snapshot rendering records the scene into render bundles, and compute shaders can update or cull instances.
- **PixiJS** (2D): its WebGPU renderer can record static parts of the scene into render bundles.
- **PlayCanvas** (3D): indirect draws whose arguments a compute shader writes, for GPU culling and GPU-updated instances.
- **Three.js** (3D): `BundleGroup` in its WebGPU renderer records the objects it contains into a render bundle, and compute shaders can write the arguments of indirect draws.

If the app already uses one of these engines, use its support for these features instead of recording bundles or writing culling shaders yourself. Apply the same practices as the native path: keep the recorded objects stable between frames, update their data instead of re-recording, and keep a fallback.

{#
Maintainer notes (engine features, checked 2026-11; verify in each engine's API docs before
updating): Babylon.js `engine.snapshotRendering`; PixiJS v8 `GpuEncoderSystem`
(`beginBundle`/`executeBundle`); PlayCanvas engine v2.9+ `MeshInstance#setIndirect`;
Three.js `BundleGroup` and `geometry.setIndirect()` in `three/webgpu`.
#}

## Fallback strategies

### WebGPU fallback

{{ BASELINE_STATUS("webgpu") }}

When `'gpu' in navigator` is false, `requestAdapter()` resolves to `null`, or GPU setup or rendering fails, draw the scene with WebGL 2. What the fallback loses depends on the scene:

- **Many copies of the same mesh:** nothing. Draw them with `gl.drawArraysInstanced()` or `gl.drawElementsInstanced()`.
- **Thousands of different objects:** WebGL 2 has no render bundles, so JavaScript issues every draw call on every frame. Reduce the number of calls: sort objects by material, merge static meshes that share a material into one buffer, and use instancing where meshes repeat. The `WEBGL_multi_draw` extension, where available, draws several ranges with one call.
- **Instances updated on the GPU:** update the instance data in JavaScript and upload it with `gl.bufferSubData()` every frame, or compute it on the GPU with transform feedback.
- **GPU culling:** WebGL 2 has no compute shaders or indirect draws, so cull on the CPU, for example against a bounding-volume hierarchy, and draw only the visible objects. To keep the main thread free, render from a worker with `OffscreenCanvas`.

For static 2D layers, and as a last resort when WebGL 2 isn't available either, use the 2D canvas with a cached layer: draw the layer once to an offscreen canvas (`OffscreenCanvas` or a `<canvas>` that isn't in the page), and copy it to the visible canvas with one `drawImage()` call. Redraw the cache only when the layer changes. This doesn't work for layers that change every frame.

The scene stays visible in the fallback, with a lower frame rate for large scenes.

```js
function createLayerCache(width, height, drawLayer) {
  const cache = new OffscreenCanvas(width, height);
  drawLayer(cache.getContext('2d')); // Draw thousands of shapes once
  return cache;
}

// Redraw the visible canvas only when the scene or the layer changes.
function drawFromCache(ctx, cache) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(cache, 0, 0);
}
```

### `WEBGL_multi_draw` fallback

{{ BASELINE_STATUS("webgl-multi-draw") }}

When `gl.getExtension('WEBGL_multi_draw')` returns `null`, issue the draws one by one with `gl.drawElements()`, or `gl.drawElementsInstanced()` for repeated meshes.
