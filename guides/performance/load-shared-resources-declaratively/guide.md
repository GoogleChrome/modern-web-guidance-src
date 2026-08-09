---
name: load-shared-resources-declaratively
description: Serve popular, unmodified scripts, stylesheets, and JavaScript modules from a shared cross-origin cache using markup or import syntax alone, without writing custom caching logic.
web-feature-ids:
  - cross-origin-storage
---

> **Status: blocked on upstream feature definition.** [Cross-Origin Storage (COS)](https://github.com/WICG/cross-origin-storage/) is a WICG proposal with no shipping browser implementation yet — only a community [browser extension](https://github.com/web-ai-community/cross-origin-storage-extension) polyfills the surface for experimentation. Per this repo's [origin trial support policy](../../../CONTRIBUTING.md#origin-trial-ot-support-policy), guides for features with this much API and syntax volatility are deferred until the feature has landed in the [`web-features`](https://github.com/web-platform-dx/web-features) package, which is what `web-feature-ids` here is checked against.
>
> Tracking issue for the `web-features` entry: https://github.com/web-platform-dx/web-features/issues/4029. The `cross-origin-storage` value above is a placeholder name and will be corrected to match whatever ID is ultimately registered.
>
> Reference material: [explainer, "Declarative integrations"](https://github.com/WICG/cross-origin-storage/#declarative-integrations) · [spec](https://wicg.github.io/cross-origin-storage/).

This use case covers COS's declarative HTML and JavaScript integrations: the `crossoriginstorage` attribute on `<link>`/`<script>` elements that already carry `integrity`, and the `crossOriginStorage` import attribute on static and dynamic module imports. Both let markup or import syntax opt a resource into the shared cross-origin cache without any imperative `navigator.crossOriginStorage` calls. Full guidance content, a working demo, and evaluation criteria will be authored once the upstream feature definition unblocks this guide (see status note above).
