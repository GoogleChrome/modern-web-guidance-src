---
name: share-web-fonts-across-origins
description: Serve large, popular web fonts from a shared cross-origin cache instead of re-downloading them from a font CDN on every site that references them.
web-feature-ids:
  - tmp-cross-origin-storage
---

# Share web fonts across origins

Large icon fonts, emoji fonts, and fonts with extensive Unicode coverage are downloaded across an enormous number of unrelated sites every day, even though most visitors already hold an identical copy from some other site that referenced the same font. The Cross-Origin Storage (COS) API reaches CSS through a new `cross-origin-storage()` request-url-modifier, used alongside the existing `integrity()` modifier inside an `@font-face` `src: url(...)` descriptor. This is the recommended path for shared web fonts, since the imperative JavaScript API is not a natural fit for resources referenced purely from CSS.

## How to implement

1. **Get the font's integrity hash.** `cross-origin-storage()` always pairs with `integrity()`; the integrity hash is what identifies the font file in COS.
2. **Add `cross-origin-storage()` to the `url()`.** Place it alongside `integrity()` inside the same `url()` function in the `src` descriptor.
3. **Choose the sharing scope.** No arguments means same-site-only. `cross-origin-storage(*)` means globally available. A comma-separated list of origin strings restricts sharing to a specific trusted set, matching the font's real distribution.
4. **List the COS-enhanced source first, with a plain fallback after it.** `src` is a prioritized list; a browser uses the first alternative it can parse and load. Putting the plain `url()` first would mean it is always used and the COS-enhanced source is never tried.

## Example code

```css
@font-face {
  font-family: 'Shared Emoji Font';
  src:
    url('/fonts/shared-emoji.woff2' integrity('sha256-WYtoZ9R5VKyrRu3WqXc9c0uETSIdOpWDTadELV32T5g=') cross-origin-storage(*)) format('woff2'),
    url('/fonts/shared-emoji.woff2') format('woff2');
}
```

## Best practices

- **DO** pair `cross-origin-storage()` with `integrity()` on the same `url()`; the two are designed to work together and the integrity hash is what makes the COS lookup possible.
- **DO** choose the argument that matches the font's real distribution: no arguments for same-site-only, `*` for genuinely popular fonts, or an explicit origin list for a specific trusted set.
- **DO** list the COS-enhanced `url()` first in the comma-separated `src` list, with a plain `url()` for the same file as a later fallback, since a browser stops at the first source it can use.
- **DO** keep the plain fallback `url()` pointing at the font's real, working network location, since a COS lookup that doesn't succeed falls back to fetching from that URL exactly like ordinary `integrity`-checked font loads do.
- **DO NOT** confuse `cross-origin-storage()` with the unrelated CSS `cross-origin()` modifier, which controls CORS request mode rather than shared-cache participation.
- **DO NOT** use `cross-origin-storage()` without `integrity()` on the same `url()`.

## Fallback strategy

{{ BASELINE_STATUS("tmp-cross-origin-storage") }}

CSS's forgiving handling of comma-separated values means a browser that doesn't recognize `cross-origin-storage()`/`integrity()` drops only that one list item, not the whole declaration, so a plain fallback `url()` listed afterward still applies. No extra feature detection is required in CSS; the fallback source is always present as a later item in the same `src` list.
