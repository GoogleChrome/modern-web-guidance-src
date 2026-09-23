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

## Naming

- **DO NOT** confuse the HTML `crossoriginstorage` attribute with the unrelated `crossorigin` attribute. `crossorigin` sets the CORS request mode, and both can coexist on the same element.
- **DO NOT** confuse the CSS `cross-origin-storage()` modifier with the unrelated CSS `cross-origin()` modifier, which also sets the CORS request mode.
