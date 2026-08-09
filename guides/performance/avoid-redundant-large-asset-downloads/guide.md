---
name: avoid-redundant-large-asset-downloads
description: Avoid re-downloading and re-storing large shared assets, such as AI models, Wasm modules, or fully-bundled JavaScript libraries, that a visitor's browser may already hold from an unrelated site.
web-feature-ids:
  - cross-origin-storage
---

This use case covers the imperative `navigator.crossOriginStorage.requestFileHandle()` API: storing and retrieving large files (AI model weights, Wasm modules, fully-bundled JS libraries, game engine cores) keyed by content hash so that multiple unrelated origins can share one on-device copy instead of each downloading and storing their own.
