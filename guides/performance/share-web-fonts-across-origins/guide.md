---
name: share-web-fonts-across-origins
description: Serve large, popular web fonts from a shared cross-origin cache instead of re-downloading them from a font CDN on every site that references them.
web-feature-ids:
  - cross-origin-storage
---

<!--This use case covers the `cross-origin-storage()` CSS `<request-url-modifier>`, used alongside the existing `integrity()` modifier in an `@font-face` `src: url(...)` descriptor. It is the recommended path for large icon, emoji, or Unicode-heavy web fonts, since the imperative JavaScript API isn't a natural fit for resources referenced from CSS.-->
