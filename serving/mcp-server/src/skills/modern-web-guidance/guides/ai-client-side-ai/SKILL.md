---
description: Implement client-side AI for improved performance, privacy, and offline capabilities by optimizing model delivery and inference.
filename: client-side-ai
category: ai
---

# Client-Side AI

This document outlines best practices for implementing client-side AI, focusing on optimizing model downloads, preparation, and inference to ensure a smooth and performant user experience.

## Before model download

### Mind library and model size

*   **Assess library and model size:** Like any other tool, evaluate the size of the AI library and the model itself. A rule of thumb for model size is around 5MB, though acceptable limits can extend to 10MB depending on the context.
*   **Consider task-specific models:** Many AI tasks can be accomplished with surprisingly small models. For example, BudouX for character breaking is 9.4KB GZipped, and MediaPipe's language detection model is 315KB.
*   **Vision models can be reasonable:** The Handpose model is about 13.4MB, comparable to the median web page size.
*   **Gen AI models can be large:** Models like DistilBERT (67MB) and even small LLMs like Gemma 2B (1.3GB) can far exceed typical web resource sizes. Refer to [Understand LLM sizes](/articles/llm-sizes) for more details on LLM sizes.
*   **Use browser developer tools:** Utilize the Network panel in browser developer tools to check the exact download size of your models.

### Optimize model size

*   **Compare quality vs. size:** Smaller models may offer sufficient accuracy for your use case. Explore fine-tuning and model shrinking techniques to reduce size while preserving accuracy.
*   **Choose specialized models:** Opt for models tailored to specific tasks (e.g., sentiment analysis, toxicity detection) over generic LLMs, as they are generally smaller.

### Check if the model can run

*   **Hardware limitations:** Not all devices can run AI models efficiently. Resource-intensive background processes can also impact performance.
*   **No pre-download check:** Currently, there's no direct way to determine ahead of download if a model will run on a user's device. Support discussions for this feature in [MediaPipe Gen AI](https://github.com/google-ai-edge/mediapipe/issues/5468) and [Transformers.js](https://github.com/microsoft/onnxruntime/issues/20998).
*   **Check for WebGPU support:** Libraries like Transformers.js (v3) and MediaPipe utilize WebGPU. Implement a WebGPU feature detection check and consider a fallback to WebAssembly (Wasm) if necessary.
*   **Estimate device capabilities:** Use `Navigator.hardwareConcurrency`, `Navigator.deviceMemory`, and the Compute Pressure API to estimate device power. Be aware these APIs are imprecise and not universally supported.

### Signal large downloads

*   **Warn users:** Inform users before downloading large models, especially on mobile devices. Use the User-Agent Client Hints API (`navigator.userAgentData.mobile`) or the User-Agent string for mobile detection.
*   **Consider network conditions:** The `Save-Data` HTTP Header or `navigator.connection.effectiveType` can offer clues about user willingness for large downloads, though they have limitations regarding privacy and support.

### Limit large downloads

*   **Download on demand:** Only download models when there's a high certainty the AI features will be used (e.g., after a user starts typing for type-ahead suggestions).
*   **Explicitly cache models:** Use the Cache API to store models locally, avoiding repeated downloads on each visit. Do not rely solely on the implicit HTTP browser cache.
*   **Chunk model downloads:** Utilize libraries like `fetch-in-chunks` to split large downloads into smaller, more manageable parts.

## Model download and preparation

### Don't block the user

*   **Prioritize core functionality:** Ensure key features remain usable even while the AI model is downloading or preparing in the background.

### Indicate progress

*   **Use library status:** If your AI library provides download progress, display it to the user. Consider opening an issue or contributing if this feature is missing.
*   **Custom progress handling:** If you manage downloads, use libraries like `fetch-in-chunks` to get progress callbacks and display them.
*   **Refer to best practices:** Consult resources on animated progress indicators and designing for long waits and interruptions for effective UI design.

### Handle network interruptions gracefully

*   **Inform users:** Notify users of connection issues and resume downloads when connectivity is restored.
*   **Chunking is key:** Downloading in chunks helps manage flaky network connections.
*   **Background Fetch API:** For long-running downloads, consider the Background Fetch API (Chrome only) for robust interruption handling.

### Offload expensive tasks to a web worker

*   **Prevent main thread blocking:** Move resource-intensive tasks like model preparation after download to a web worker to keep the UI responsive.
*   **WebGPU in workers:** Note that WebGPU support in Firefox workers may require a flag.
*   **See examples:** Refer to provided links for `script.js` and `worker.js` implementations.

## During inference

### Move inference to a web worker

*   **GPU-based inference:** WebGL, WebGPU, and WebNN leverage the GPU, running in a separate process that doesn't block the UI.
*   **CPU-based inference:** For CPU-bound implementations (like Wasm fallbacks), move inference to a web worker to maintain page responsiveness.
*   **Simplified implementation:** Consolidating all AI-related code (fetch, preparation, inference) in a single web worker can simplify development.

### Handle errors

*   **General inference errors:** Wrap inference calls in `try`/`catch` blocks to handle runtime errors gracefully.
*   **WebGPU errors:** Handle both unexpected errors and `GPUDevice.lost` errors, which occur when the GPU resets due to device strain.

### Indicate inference status

*   **Visual feedback:** If inference takes noticeable time, use animations to indicate that the model is processing and reassure the user.

### Make inference cancellable

*   **User refinement:** Allow users to cancel or refine their query mid-inference, preventing wasted resources on generating unseen responses.