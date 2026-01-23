---
description: Allows extensions to declare a value for the Cross-Origin-Opener-Policy response header to enable cross-origin isolation.
filename: cross-origin-opener-policy
category: extensions
---

# Cross-origin opener policy

The `cross_origin_opener_policy` manifest key lets extensions specify a value for the
[Cross-Origin-Opener-Policy][mdn-coop] (COOP) response header for requests to the extension's
origin. This includes the extension's service worker, popup, options page, tabs that are open to an extension resource, etc.

Together with [cross_origin_embedder_policy][doc-coep], this key allows extensions opt into
[cross-origin isolation][doc-coi].

## Manifest declaration

<aside class="note"><b>Note:</b> This key was introduced in Chrome 93.</aside>

The `cross_origin_opener_policy` manifest key contains an object with one
property named `value` that takes a string. Chrome uses this string as the value of the
`Cross-Origin-Opener-Policy` header when serving resources from the extension's origin. For example:

```js
{
    ...
    "cross_origin_opener_policy": {
      "value": "same-origin"
    },
    ...
}
```

See [Cross-origin isolation overview][doc-coi] for more information about this feature.

[doc-coep]: /docs/extensions/reference/manifest/cross-origin-embedder-policy/
[doc-coi]: /docs/extensions/develop/concepts/cross-origin-isolation/
[mdn-coop]: https://developer.mozilla.org/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy