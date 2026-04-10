---
name: web-security
description: Preventative security guidelines for web developers (XSS, CSP, Cookies, Cross-Origin Isolation). Use this skill when implementing standard HTTP security headers, configuring secure cookies, or enforcing cross-origin isolation.
---

# Web Security

Guidelines for implementing preventative security measures on the web.

**NOTE**: This skill covers standard web platform defenses (XSS, CSRF, Clickjacking) but does **not** replace comprehensive backend security, authorization models (Access Control), or server-side input validation.

## Content Security Policy (CSP)

Mitigate XSS risks by restricting executable scripts and resources. Prefer **Strict CSP** over allowlists.

- **DO**: Use strict CSP (Nonce-based or Hash-based).
- **DO**: Use Nonce-based for server-rendered HTML. Set the header and matching `nonce` attribute on `<script>` tags.
- **DO**: Use Hash-based for static/cached HTML (SPAs). Inline scripts and hash them.
- **DO**: Include `'strict-dynamic'` to allow trusted scripts to load dependencies automatically.
- **DO**: Restrict `object-src 'none'` (block plugins) and `base-uri 'none'` (block `<base>` hijacking).
- **DO NOT**: Rely on URL allowlists (e.g., `script-src https://cdn.example.com`), as they are easily bypassed.

### Code Pattern (Nonce-based)

Header:
```http
Content-Security-Policy: script-src 'nonce-{RANDOM}' 'strict-dynamic' https: 'unsafe-inline'; object-src 'none'; base-uri 'none';
```

HTML:
```html
<script nonce="{RANDOM}" src="https://example.com/script.js"></script>
```

## Trusted Types

Prevent DOM-based XSS by enforcing sanitization on dangerous sinks.

- **DO**: Enable Trusted Types via CSP.
- **DO**: Use Trusted Types policies to sanitize data before passing to sinks like `innerHTML`, `eval()`, `script.src`.
- **Dangerous Sinks**: `innerHTML`, `outerHTML`, `document.write`, `eval`, `setTimeout` (with string), `script.src`.

### Code Pattern

Header:
```http
Content-Security-Policy: require-trusted-types-for 'script'
```

JS Policy Definition:
```javascript
if (window.trustedTypes && trustedTypes.createPolicy) {
  const policy = trustedTypes.createPolicy('escapePolicy', {
    createHTML: str => str.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  });
  // Usage
  el.innerHTML = policy.createHTML(untrustedString);
}
```

## Cookie Security

Protect user data and sessions.

- **DO**: Explicitly set `SameSite=Lax` for standard first-party cookies.
- **DO**: Set `SameSite=None; Secure; Partitioned` for third-party contexts (iframes) to limit tracking scope.
- **DO NOT**: Rely on unpartitioned `SameSite=None` as they are being systematically blocked for tracking prevention.

### Code Pattern

```http
Set-Cookie: session_id=value; SameSite=Lax; HttpOnly; Secure
Set-Cookie: third_party_var=value; SameSite=None; Secure; Partitioned
```

### Clear-Site-Data (Logout)
- **DO**: Use `Clear-Site-Data: "cache", "cookies", "storage"` on logout endpoints to ensure complete session termination.

```http
Clear-Site-Data: "cookies", "storage", "cache"
```

## Security Headers Quick Guide

### X-Content-Type-Options
- **DO**: Set `X-Content-Type-Options: nosniff` to block MIME-type sniffing.

### X-Frame-Options (Clickjacking)
- **DO**: Use `DENY` or `SAMEORIGIN` to prevent clickjacking.
- **Alternative**: Use `frame-ancestors` in CSP for fine-grained control.

```http
Content-Security-Policy: frame-ancestors 'self' https://trusted-partner.com;
```

### HTTP Strict Transport Security (HSTS)
- **DO**: Use `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` for force-HTTPS.
- **TIP**: In production rollout, start with a short `max-age` (e.g., 300 seconds) and incrementally increase it to 1 year to avoid rendering the site permanently inaccessible due to misconfiguration.

### Referrer Policy
- **DO**: Use `strict-origin-when-cross-origin` as a safe default.

### Subresource Integrity (SRI)
- **DO**: Use `integrity` attribute with cryptographic hash when loading third-party scripts.
- **DO**: Combine with `crossorigin="anonymous"`.
- **DO NOT**: Use SRI for dynamic or unversioned assets, as silent updates will cause script execution to fail. It is strictly for immutable, versioned assets.
- **DO**: Ensure the **server/CDN** sends `Access-Control-Allow-Origin: *` or specific origin for the browser to successfully compute the hash.

```html
<script src="https://cdn.example.com/lib.js" integrity="sha384-H8df...39v" crossorigin="anonymous"></script>
```

### Permissions Policy
- **DO**: Disable unused browser features (camera, geolocation) for the page and iframes using Structured Fields syntax.
- **DO**: When delegating features to an iframe, use the `allow` attribute in HTML *in addition* to the header.

```html
<iframe src="https://trusted-video.com/player" allow="fullscreen; camera"></iframe>
```

```http
Permissions-Policy: camera=(), geolocation=(), microphone=()
```

### Cross-Origin Resource Sharing (CORS)
- **DO**: Validate the `Origin` header on the server and set `Access-Control-Allow-Origin` dynamically to specific origins (rather than using wildcard `*`).
- **DO NOT**: Use wildcard `*` for `Access-Control-Allow-Origin` if `Access-Control-Allow-Credentials: true` is required.
- **DO**: Handle Preflight requests (`OPTIONS` method) by returning appropriate headers before processing data.

```http
Access-Control-Allow-Origin: https://trusted-app.com
Access-Control-Allow-Credentials: true
```

## Advanced Cross-Origin Security

### Fetch Metadata
- **DO**: Implement a Resource Isolation Policy on the server check `Sec-Fetch-*` headers.
- **DO**: Reject `cross-site` requests for non-navigational endpoints.
- **DO**: Include `Vary: Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site` to prevent intermediate caches (CDNs) from serving cached responses to attackers.

```javascript
app.use((req, res, next) => {
  const site = req.get('Sec-Fetch-Site');
  const mode = req.get('Sec-Fetch-Mode');
  const dest = req.get('Sec-Fetch-Dest');

  if (!site) return next(); // Fallback for legacy browsers

  if (['same-origin', 'same-site', 'none'].includes(site)) return next();

  // Allow standard navigate GET requests (link clicks)
  if (site === 'cross-site' && mode === 'navigate' && req.method === 'GET' && !['object', 'embed'].includes(dest)) {
    return next();
  }

  res.status(403).send('Forbidden'); // Reject
});
```

### Cross-Origin Isolation (COOP & COEP)
- **DO**: Set `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` to enable `SharedArrayBuffer` and mitigate Spectre.

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### Cross-Origin Resource Policy (CORP)
- **DO**: Set `Cross-Origin-Resource-Policy: same-origin` or `same-site` to prevent resources from being loaded by other origins.
- **DO NOT**: Forget CORP for subresources (images, scripts) when using `COEP: require-corp`; otherwise, they will fail to load.

### Operational Constraints
- **CAUTION**: COOP severs `window.opener` references, which will break standard pop-up OAuth flows and payment gateways relying on `postMessage()`. Use `credentialless` if supported, or isolate OAuth to subdomains.

## Monitoring

### Reporting API
- **DO**: Use `Reporting-Endpoints` header to monitor CSP/COOP violations in production out-of-band.

```http
Reporting-Endpoints: main-endpoint="https://reports.example/main"
Content-Security-Policy: script-src 'self'; report-to main-endpoint;
```

### Data Hygiene
- **DO NOT**: Include Sensitive Data (PII, authentication tokens, session identifiers) in logs or violation reports. Mask or omit them at the edge.
