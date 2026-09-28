## Browser support

Cross-Origin Storage (COS) is being implemented in Chromium and is not yet natively supported by any major browser. Until it ships, the Cross-Origin Storage browser extension adds it to Chrome and other Chromium-based browsers (from the Chrome Web Store), Firefox on desktop and Android (from Firefox Add-ons), and Safari on macOS, iOS, and iPadOS (from the App Store). The extension supports the literal syntax of the `navigator.crossOriginStorage` API, the HTML `crossoriginstorage` attribute, and the CSS `cross-origin-storage()` modifier. It does not support the literal `crossOriginStorage` import attribute, since import attribute syntax can't be polyfilled.

## Sharing scope

Every Cross-Origin Storage (COS) surface takes a sharing scope that controls which origins can later retrieve the stored file. Pick the scope that matches the resource's real distribution:

- **Same-site only (default):** for resources that only your own site uses.
- **Explicit origin list:** for a small, trusted set of origins, for example proprietary assets shared between your own properties.
- **Global (`*`):** **MANDATORY:** only for genuinely popular, non-proprietary resources, such as open-weight AI models or widely used open-source libraries.

| Surface | Same-site only | Origin list | Global |
|---|---|---|---|
| `requestFileHandle()` `origins` option | Omit `origins` | Array of origin strings | `'*'` |
| HTML `crossoriginstorage` attribute | Valueless attribute | Space-separated origins | `"*"` |
| `crossOriginStorage` import attribute | Empty string (`''`) | Space-separated origins | `'*'` |
| CSS `cross-origin-storage()` modifier | No arguments | Comma-separated origin strings | `*` |

**MANDATORY:** An origin list only takes effect for origins that a `Cross-Origin-Storage-Allow-Origin` response header also names, for example `Cross-Origin-Storage-Allow-Origin: https://a.example, https://b.example`. The header comes from whoever supplies the bytes: the response of the page that calls `requestFileHandle()`, or the response of the fetched resource itself (the script, stylesheet, module, or font) for the HTML, import attribute, and CSS forms. Origins the header doesn't name are dropped, and if none remain, the file is stored with the same-site default. The same-site default and `*` need no header.

## Naming

- **DO NOT** confuse the HTML `crossoriginstorage` attribute with the unrelated `crossorigin` attribute. `crossorigin` sets the CORS request mode, and both can coexist on the same element.
- **DO NOT** confuse the CSS `cross-origin-storage()` modifier with the unrelated CSS `cross-origin()` modifier, which also sets the CORS request mode.
