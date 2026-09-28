---
name: validate-origins
description: Compare and validate web origins and sites safely across cross-document messages and URLs without error-prone string parsing.
web-feature-ids:
  - origin
---

# Compare and validate web origins and sites

While comparing `event.origin` against a fixed, port-normalized string literal (such as `event.origin === 'https://trusted.example.com'`) works for simple allowlists, manual string comparisons and regular expressions break down when validating arbitrary URLs, DOM link elements, cross-subdomain relationships, or sandboxed messages:

- **Prefix and substring spoofing:** Checking `url.startsWith('https://trusted.example.com')` is bypassed by `'https://trusted.example.com.attacker.example'`.
- **Unnormalized URLs:** Full URLs with paths, query strings, or explicit default ports (`'https://trusted.example.com:443/path'`) do not match `'https://trusted.example.com'` under string equality without first parsing and normalizing.
- **Public Suffix List mistakes:** Splitting hostnames on `.` to check same-site relationships fails on multi-label public suffixes (such as `.co.uk` or shared hosting domains like `.github.io`) and ignores scheme mismatches (`http:` vs. `https:`).
- **Opaque `"null"` origin collisions:** Sandboxed iframes (`<iframe sandbox="allow-scripts">`) and `data:` URLs serialize `event.origin` to the literal string `"null"`. Comparing two serialized runtime origins with `originA === originB` falsely equates two unrelated opaque contexts (`"null" === "null"`).

The **`Origin` API** (`Origin.from()`, `isSameOrigin()`, `isSameSite()`, and `opaque`) provides structured, spec-compliant origin and schemeful same-site comparisons backed by the browser's URL parser and Public Suffix List.

## 1. Extract and Compare Exact Origins (`Origin.from()` and `isSameOrigin()`)

Use `Origin.from()` to extract an `Origin` object and compare it against another `Origin` using `isSameOrigin()`:

- **Both sides must be `Origin` instances:** `isSameOrigin(other)` and `isSameSite(other)` only accept an `Origin` object—passing a raw string throws a `TypeError`.
- **Supported `Origin.from()` inputs:**
  - Serialized URL strings (for example, `'https://trusted.example.com:443/path'`). Note that the literal string `'null'` is not a valid URL and causes `Origin.from('null')` to throw a `TypeError`.
  - Platform objects that define origin-extraction steps in the HTML specification: `Origin`, `URL`, `HTMLAnchorElement` (`<a>`), `HTMLAreaElement` (`<area>`), same-origin `Window` or `WorkerGlobalScope` (`Origin.from(self)`), and browser-dispatched `MessageEvent` instances (`Origin.from(event)`).
  - Objects such as `Location`, `WorkerLocation`, `Document`, `Request`, and `Response` do **not** define origin-extraction steps and throw a `TypeError` if passed directly to `Origin.from()`—pass `self` (for the current context) or `request.url` / `response.url` instead.
- **Wrap `Origin.from()` in `try...catch` for untrusted inputs:** Malformed URL strings, cross-origin `Window` references, or unsupported objects throw a `TypeError`.

```javascript
// Replace with your application's trusted origin(s)
const TRUSTED_ORIGIN = Origin.from('https://app.example.com');

export function isTrustedSameOrigin(candidate) {
  try {
    // candidate can be a browser-dispatched MessageEvent, URL string,
    // URL instance, <a>/<area> element, same-origin Window, or Origin.
    const candidateOrigin = Origin.from(candidate);
    return candidateOrigin.isSameOrigin(TRUSTED_ORIGIN);
  } catch {
    // Rejects malformed URLs, "null" strings, or unsupported objects
    return false;
  }
}

window.addEventListener('message', (event) => {
  // Pass the browser-dispatched MessageEvent directly to Origin.from()
  if (!isTrustedSameOrigin(event)) return;

  // Safe to process event.data from the verified origin
});
```

## 2. Validate Schemeful Same-Site Relationships (`isSameSite()`)

When you need to allow any subdomain or port belonging to the same registrable domain over the same scheme (for example, validating redirect URLs or cross-subdomain links across `https://app.example.co.uk` and `https://auth.example.co.uk:8443`), use `isSameSite()`:

- `isSameSite()` performs a **schemeful same-site** comparison: `https://sub.example.com` and `http://sub.example.com` are **not** same-site because their schemes differ.
- `isSameSite()` uses the browser's built-in **Public Suffix List**, so distinct tenants on shared public suffixes (such as `https://tenant-a.github.io` and `https://tenant-b.github.io`, or `https://a.co.uk` and `https://b.co.uk`) correctly evaluate to `false`.

```javascript
// Replace with your application's primary origin
const APP_ORIGIN = Origin.from('https://app.example.co.uk');

export function isAllowedSameSiteUrl(candidateUrlOrElement) {
  try {
    const candidateOrigin = Origin.from(candidateUrlOrElement);
    return candidateOrigin.isSameSite(APP_ORIGIN);
  } catch {
    return false;
  }
}

// true: same scheme (https) and same registrable domain (example.co.uk)
isAllowedSameSiteUrl('https://billing.example.co.uk:8443/checkout');

// false: scheme downgrade (http vs. https) is rejected by schemeful same-site
isAllowedSameSiteUrl('http://billing.example.co.uk/checkout');
```

## 3. Distinguish Opaque Origins (`origin.opaque` and `Origin.from(event)`)

Sandboxed iframes (`<iframe sandbox="allow-scripts">`), `data:` URLs, and `new Origin()` produce **opaque origins** (`origin.opaque === true`). While their string serialization is always `"null"`, `Origin.from(event)` extracts the sender's actual underlying opaque origin from a browser-dispatched `MessageEvent`:

- Two messages sent from the **same** sandboxed iframe yield `Origin` objects that are `isSameOrigin()` with each other (`true`).
- Messages sent from **different** sandboxed iframes—or separate `Origin.from('data:...')` / `new Origin()` calls—yield distinct opaque origins that evaluate `isSameOrigin()` to `false`, preventing `"null" === "null"` spoofing across unrelated opaque contexts.
- `new Origin()` creates a fresh, unique opaque origin that matches nothing except itself, which is useful as a default deny-all sentinel before an expected peer origin is established.

```javascript
// Initialize with a unique opaque sentinel that matches no other origin
let pinnedSandboxOrigin = new Origin();

export function handleSandboxedWidgetMessage(event, expectedWidgetWindow) {
  const senderOrigin = Origin.from(event);

  // Pin the opaque origin on initialization from the expected sandboxed iframe
  if (event.source === expectedWidgetWindow && event.data?.type === 'init') {
    pinnedSandboxOrigin = senderOrigin;
  }

  // Subsequent messages from the SAME sandboxed iframe match pinnedSandboxOrigin;
  // messages from any other sandboxed iframe (also event.origin === "null") return false.
  return senderOrigin.isSameOrigin(pinnedSandboxOrigin);
}
```

## Best practices

- **DO** convert both sides of a comparison to `Origin` instances via `Origin.from()` before calling `isSameOrigin(other)` or `isSameSite(other)`.
- **DO** pass a browser-dispatched `MessageEvent` directly to `Origin.from(event)` when you need to preserve opaque origin identity, and use `Origin.from(self)` (rather than `Location` or `Document`, which throw `TypeError`) to obtain the current execution context's `Origin`.
- **DO** wrap `Origin.from()` calls on untrusted or runtime inputs in a `try...catch` block so malformed URLs, `"null"` strings, or synthetic `new MessageEvent()` objects (which lack an internal browser origin) safely return `false` instead of throwing an uncaught `TypeError`.
- **DO NOT** compare two runtime `event.origin` or `url.origin` strings directly without first rejecting `"null"` (`origin !== 'null'`), as two unrelated opaque origins both serialize to `"null"`.
- **DO NOT** validate origins or sites with `startsWith()`, `includes()`, `endsWith()`, or naive `.split('.')` hostname slicing.

## Fallback strategy

{{ FEATURE_FALLBACKS("origin") }}

If your Baseline target includes browsers that do not yet support the `Origin` interface, feature-detect `'Origin' in globalThis` and fall back to parsing URLs with `new URL()`:

- **Same-origin fallback (robust for tuple origins):** Extract the URL string (using `event.origin` for `MessageEvent` objects or `candidate.href` for link elements), parse both the candidate and trusted URLs with `new URL()`, reject `"null"` opaque origins (`candidateUrl.origin !== 'null'`), and compare `candidateUrl.origin === trustedUrl.origin`. Because `new URL()` normalizes default ports (such as `:443` for `https:`), this provides an exact same-origin check for non-opaque origins in all browsers.
- **Same-site fallback (caveat):** The `URL` interface does not expose the browser's Public Suffix List. In browsers without `Origin`, only perform suffix matching against an explicit, known private registrable domain that you control (verifying both `protocol` and an exact or dot-prefixed `hostname` match), or use a maintained Public Suffix List library.

```javascript
// Replace with your trusted reference URL and known registrable domain
const TRUSTED_URL = 'https://app.example.com';
const TRUSTED_SITE_DOMAIN = 'example.com';

function extractUrlString(candidate) {
  if (typeof candidate === 'string') return candidate;
  if (typeof MessageEvent !== 'undefined' && candidate instanceof MessageEvent) {
    return candidate.origin;
  }
  return candidate?.href ?? '';
}

export function checkSameOriginWithFallback(candidate) {
  try {
    if ('Origin' in globalThis) {
      return Origin.from(candidate).isSameOrigin(Origin.from(TRUSTED_URL));
    }
    const candidateUrl = new URL(extractUrlString(candidate));
    const trustedUrl = new URL(TRUSTED_URL);
    return candidateUrl.origin !== 'null' && candidateUrl.origin === trustedUrl.origin;
  } catch {
    return false;
  }
}

export function checkSameSiteWithFallback(candidate) {
  try {
    if ('Origin' in globalThis) {
      return Origin.from(candidate).isSameSite(Origin.from(TRUSTED_URL));
    }
    const candidateUrl = new URL(extractUrlString(candidate));
    const trustedUrl = new URL(TRUSTED_URL);
    return (
      candidateUrl.origin !== 'null' &&
      candidateUrl.protocol === trustedUrl.protocol &&
      (candidateUrl.hostname === TRUSTED_SITE_DOMAIN ||
        candidateUrl.hostname.endsWith(`.${TRUSTED_SITE_DOMAIN}`))
    );
  } catch {
    return false;
  }
}
```
