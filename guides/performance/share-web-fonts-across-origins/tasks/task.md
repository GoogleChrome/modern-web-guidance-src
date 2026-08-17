---
base_app: empty-app
---
- Create an extremely minimal web page that declares an `@font-face` for a large, popular emoji font served from '/fonts/shared-emoji.woff2' with a known integrity hash. Opt the font into a shared cross-origin cache so any site that already has the identical font bytes stored can reuse them instead of re-downloading from the CDN, while still keeping a plain network fallback for browsers that don't support the shared cache. Show a sample line of text using the font in a paragraph with class "sample". Write the page to index.html.
- Add CSS for a corporate icon font that should only be shared between a small, specific set of related origins rather than made available to the entire web, referenced from '/fonts/corp-icons.woff2' with a known integrity hash.
- I want a demo page with an `@font-face` rule for a font that's popular enough that most visitors' browsers probably already have it cached from another site, so it should be opted into global sharing rather than restricted to this site only.
