---
name: share-web-fonts-across-origins
description: Serve large, popular web fonts from a shared cross-origin cache instead of re-downloading them from a font CDN on every site that references them.
web-feature-ids:
  - cross-origin-storage
---

> **Status: blocked on upstream feature definition.** [Cross-Origin Storage (COS)](https://github.com/WICG/cross-origin-storage/) is a WICG proposal with no shipping browser implementation yet — only a community [browser extension](https://github.com/web-ai-community/cross-origin-storage-extension) polyfills the surface for experimentation. Per this repo's [origin trial support policy](../../../CONTRIBUTING.md#origin-trial-ot-support-policy), guides for features with this much API and syntax volatility are deferred until the feature has landed in the [`web-features`](https://github.com/web-platform-dx/web-features) package, which is what `web-feature-ids` here is checked against.
>
> Tracking issue for the `web-features` entry: https://github.com/web-platform-dx/web-features/issues/4029. The `cross-origin-storage` value above is a placeholder name and will be corrected to match whatever ID is ultimately registered.
>
> Reference material: [explainer, "Declarative CSS integration"](https://github.com/WICG/cross-origin-storage/#declarative-css-integration) · [spec](https://wicg.github.io/cross-origin-storage/) · [CSSWG proposal for `cross-origin-storage()`](https://github.com/w3c/csswg-drafts/issues/14056).

This use case covers the `cross-origin-storage()` CSS `<request-url-modifier>`, used alongside the existing `integrity()` modifier in an `@font-face` `src: url(...)` descriptor. It is the recommended path for large icon, emoji, or Unicode-heavy web fonts, since the imperative JavaScript API isn't a natural fit for resources referenced from CSS. Full guidance content, a working demo, and evaluation criteria will be authored once the upstream feature definition unblocks this guide (see status note above).
