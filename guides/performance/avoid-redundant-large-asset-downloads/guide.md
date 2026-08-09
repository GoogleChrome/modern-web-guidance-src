---
name: avoid-redundant-large-asset-downloads
description: Avoid re-downloading and re-storing large shared assets, such as AI models, Wasm modules, or fully-bundled JavaScript libraries, that a visitor's browser may already hold from an unrelated site.
web-feature-ids:
  - cross-origin-storage
---

> **Status: blocked on upstream feature definition.** [Cross-Origin Storage (COS)](https://github.com/WICG/cross-origin-storage/) is a WICG proposal with no shipping browser implementation yet — only a community [browser extension](https://github.com/web-ai-community/cross-origin-storage-extension) polyfills the surface for experimentation. Per this repo's [origin trial support policy](../../../CONTRIBUTING.md#origin-trial-ot-support-policy), guides for features with this much API and syntax volatility are deferred until the feature has landed in the [`web-features`](https://github.com/web-platform-dx/web-features) package, which is what `web-feature-ids` here is checked against.
>
> Tracking issue for the `web-features` entry: https://github.com/web-platform-dx/web-features/issues/4029. The `cross-origin-storage` value above is a placeholder name and will be corrected to match whatever ID is ultimately registered.
>
> Reference material: [explainer](https://github.com/WICG/cross-origin-storage/) · [spec](https://wicg.github.io/cross-origin-storage/).

This use case covers the imperative `navigator.crossOriginStorage.requestFileHandle()` API: storing and retrieving large files (AI model weights, Wasm modules, fully-bundled JS libraries, game engine cores) keyed by content hash so that multiple unrelated origins can share one on-device copy instead of each downloading and storing their own. Full guidance content, a working demo, and evaluation criteria will be authored once the upstream feature definition unblocks this guide (see status note above).
