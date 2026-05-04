---
name: web-security
description: Preventative security guidelines for web developers (XSS, CSP, Cookies, Cross-Origin Isolation). Use this skill to guide the process of auditing, testing, and deploying security policies safely.
---

# Web Security

Guidelines for implementing preventative security measures on the web safely and incrementally.

**NOTE**: This skill covers standard web platform defenses but does **not** replace comprehensive backend security, authorization models, or server-side input validation.

## Table of Contents

- When to apply this skill
- Phase 1: Quick Wins & Obvious Anti-Patterns
  - 1.1 Avoid Dangerous DOM Sinks
  - 1.2 Secure Cookies
  - 1.3 Clickjacking Protection (Frame-Ancestors & X-Frame-Options)
  - 1.4 Secure Window Messaging (postMessage)
- Phase 2: Discovery & Data Collection (Prerequisites)
  - 2.1 Inspect the Application
  - 2.2 Deploy Report-Only Policies
  - 2.3 Data Hygiene for Reports
  - 2.4 Automated Discovery via Browser APIs and DevTools
- Phase 3: Interpreting Results & Enforcement
  - Core enforcement (data-driven rollouts)
    - 3.1 Analyzing CSP Reports
    - 3.2 Transitioning to CSP Enforcement
    - 3.3 Trusted Types Enforcement
    - 3.4 Cross-Origin Opener Policy (COOP)
    - 3.5 Cross-Origin Resource Policy (CORP)
    - 3.6 Cross-Origin Isolation
    - 3.7 Fetch Metadata (Resource Isolation)
  - Companion policies (deploy in parallel)
    - HTTP Strict Transport Security (HSTS)
    - X-Content-Type-Options
    - Referrer Policy
    - Permissions Policy
    - Subresource Integrity (SRI)
    - Cross-Origin Resource Sharing (CORS)
    - Clear-Site-Data (Logout)

## When to apply this skill

The right starting point depends on the application:

- **Retrofitting an existing app**: Always start at Phase 1. Strict policies applied without discovery will break the app. Treat Phase 2 (report-only) as a prerequisite for any Phase 3 enforcement.
- **Greenfield app or new feature**: You can adopt Phase 3 enforced policies directly, but still wire up reporting from day one.
- **SaaS template / framework defaults**: Ship Phase 1 hygiene and Phase 3 policies enabled by default, with Phase 2 reporting on so downstream users can detect regressions.

If you are unsure which case applies, default to Phase 1 → 2 → 3 in order.

**Focusing on Leverage**: While Phase 1 and 2 establish baseline hygiene and data gathering, Phase 3 core enforcement represents the highest-leverage security work. Specifically, Injection/XSS mitigation through CSP (§3.2) and Trusted Types (§3.3) addresses the largest practical threat, while companion policies and isolation defenses provide important defense-in-depth.

## Phase 1: Quick Wins & Obvious Anti-Patterns

Before attempting to deploy global security policies, focus on code-level hygiene and immediate fixes that do not risk breaking the application.

### 1.1 Avoid Dangerous DOM Sinks
- **DO**: Prefer `textContent` or `innerText` over `innerHTML` when setting text content.
- **DO**: Use `setHTML` (part of the Sanitizer API) when available to safely insert HTML.
- **DO NOT**: Use `innerHTML` or `setHTMLUnsafe` with untrusted or unsanitized input.
- **DO**: Use DOMParser or create elements programmatically (`document.createElement`) instead of concatenating HTML strings.

**Dangerous sinks to grep for**: `innerHTML`, `outerHTML`, `document.write`, `eval`, `setTimeout` with a string argument, `script.src`.

**Code Pattern:**
```javascript
// Unsafe
element.innerHTML = `Hello, ${untrustedName}!`;

// Safe
element.textContent = `Hello, ${untrustedName}!`;
```

Trusted Types can enforce this pattern at runtime by blocking string assignments to dangerous sinks. Deploying it is a CSP enforcement step with real breakage risk — see §3.3.

### 1.2 Secure Cookies
Ensure new cookies are configured securely by default.
- **DO**: Explicitly set `SameSite=Lax` for standard first-party cookies.
- **DO**: Set `SameSite=None; Secure; Partitioned` if your application needs to be embedded as an iframe in third-party contexts.
- **DO**: Use the `__Host-` prefix for cookies scoped to a single origin (requires `Secure`, `Path=/`, and no `Domain` attribute) — the browser rejects writes that don't meet those constraints, preventing subdomain injection.
- **DO**: Use the `__Secure-` prefix for any cookie that must only be set over HTTPS.
- **DO NOT**: Rely on unpartitioned `SameSite=None` — these are being systematically blocked for tracking prevention.

```http
Set-Cookie: __Host-session_id=value; SameSite=Lax; HttpOnly; Secure; Path=/
Set-Cookie: third_party_var=value; SameSite=None; Secure; Partitioned
```

### 1.3 Clickjacking Protection (Frame-Ancestors & X-Frame-Options)
Clickjacking protection is easy to deploy, carries extremely low risk of breaking legitimate functionality, and provides immediate defense against malicious UI redressing.
- **DO**: Set the `X-Frame-Options: SAMEORIGIN` header to prevent other sites from embedding your pages in an iframe (or use `DENY` if you should never be embedded).
- **DO**: For fine-grained control in modern browsers, use `frame-ancestors 'self'` (or specified trusted domains) in your CSP header.
- **DO**: When *you* embed untrusted content, always use the iframe `sandbox` attribute to restrict its capabilities unless explicitly allowed (e.g., `sandbox="allow-scripts"`).

```http
X-Frame-Options: SAMEORIGIN
Content-Security-Policy: frame-ancestors 'self' https://trusted-partner.com;
```

### 1.4 Secure Window Messaging (postMessage)
If your application communicates with other origins using `window.postMessage`, you must strictly validate the sender and receiver.
- **DO**: Always validate the `event.origin` of incoming messages on the receiver side using strict equality against a list of trusted origins. Do **not** trust wildcards (`*`) or unverified payloads.
- **DO**: Always specify a target origin (rather than the wildcard `*`) when calling `postMessage` to send sensitive data, ensuring only the intended origin can receive it.
- **DO**: Parse and sanitize message payloads (e.g., using `JSON.parse` and strict schema validation) before performing operations or writing to DOM sinks.

```javascript
// Receiver (Safe)
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://trusted-origin.com') return;
  try {
    const data = JSON.parse(event.data);
    // Process data safely
  } catch (e) {
    // Handle parsing error
  }
});

// Sender (Safe)
targetWindow.postMessage(JSON.stringify({ action: 'update' }), 'https://trusted-origin.com');
```

## Phase 2: Discovery & Data Collection (Prerequisites)

Do not blindly apply strict policies to an existing application. You must first understand the application's constraints by collecting data.

### 2.1 Inspect the Application
Before turning anything on, gather facts:
- **Grep for existing security headers** in server config, middleware, CDN/edge config, and meta tags: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `Permissions-Policy`, `Cross-Origin-*`, `Reporting-Endpoints`.
- **Enumerate inline scripts and styles** in server-rendered templates and static HTML — these will need nonces, hashes, or refactoring.
- **List third-party script origins** loaded by the app (analytics, ads, tag managers, CDNs). These dictate what `script-src` must allow or whether `'strict-dynamic'` is viable.
- **Identify popup-dependent flows**: OAuth, payment gateways, SSO. These constrain COOP choices.
- **Identify cross-origin embeds and embedders**: iframes the app loads, and sites that embed the app. These constrain COEP/CORP/`frame-ancestors`.
- **Enumerate required browser features**: List any features (camera, geolocation, microphone, fullscreen) used by the app or embedded third-party widgets to inform `Permissions-Policy`.
- **Identify dynamic dependencies**: Check if third-party scripts are versioned or if they receive silent updates, determining if `SRI` can be used.
- **Map cross-site integrations**: List all incoming Webhooks, cross-site APIs, or SSO redirect endpoints so `Fetch Metadata` resource isolation policies don't break them.

### 2.2 Deploy Report-Only Policies
Use "Report-Only" headers to identify potential breakages before they happen.
- **DO**: Use report-only headers to dry-run policies without enforcement. Standard report-only headers include:
  - `Content-Security-Policy-Report-Only` for CSP rules.
  - `Cross-Origin-Opener-Policy-Report-Only` for COOP isolation.
  - `Cross-Origin-Embedder-Policy-Report-Only` for COEP isolation.
  - `Document-Policy-Report-Only` for document features.
- **DO**: Define a `Reporting-Endpoints` header so violations have somewhere to go, and reference its name from `report-to`.
- **DO**: Run report-only for long enough to cover real traffic patterns (typically days to weeks), not just synthetic testing.

**Example headers:**
```http
Reporting-Endpoints: main-endpoint="https://reports.example/main"
Content-Security-Policy-Report-Only: script-src 'nonce-{RANDOM}' 'strict-dynamic' https: 'unsafe-inline'; object-src 'none'; base-uri 'none'; report-to main-endpoint;
```

The `'strict-dynamic'`, `https:`, and `'unsafe-inline'` tokens together form a backwards-compatibility ladder: modern browsers honor `'strict-dynamic'` (nonce-propagating) and ignore the others; older browsers fall back to `https:`; very old browsers fall back to `'unsafe-inline'`. The fallbacks are harmless on any browser that supports a stricter token.

**Managing report false-positives**: Reporting endpoints receive a significant volume of false-positive violation reports caused by aggressive browser extensions, ancient browsers, web crawlers, or antivirus scanners. When analyzing report-only logs, focus on high-frequency patterns from modern user-agents and filter out noise before making deployment decisions.

### 2.3 Data Hygiene for Reports
- **DO NOT**: Include sensitive data (PII, authentication tokens, session identifiers, query strings with secrets) in logs or violation reports. Mask or omit them at the edge before they reach the reporting endpoint.

### 2.4 Automated Discovery via Browser APIs and DevTools
- **Reporting API**: Use `Reporting-Endpoints` in combination with report-only headers (e.g., `Content-Security-Policy-Report-Only`, `Document-Policy-Report-Only`) to have the browser automatically post violations to your server.
- **Browser DevTools**: Use the **Issues Tab** in modern browsers (e.g., Chrome DevTools). It automatically surfaces blocked resources, mixed content, third-party cookie deprecation warnings, and feature policy violations without you having to crawl the codebase manually.

## Phase 3: Interpreting Results & Enforcement

After collecting data, decide how to proceed with enforcement. Phase 3 has two tracks that run in parallel, not in sequence:

- **Core enforcement (data-driven rollouts)** — high-breakage-risk policies that depend on Phase 2 report-only data. These are the rollouts you stage and watch.
- **Companion policies (deploy in parallel)** — lower-risk headers that can be turned on alongside or before the core work, with little or no Phase 2 discovery required.

### Core enforcement (data-driven rollouts)

#### 3.1 Analyzing CSP Reports
- **Scenario**: Many violations for inline scripts.
  - **Condition**: The app uses a framework that relies on inline scripts.
  - **Decision**: Implement Nonces (server-rendered) or Hashes (static) before enforcing.
- **Scenario**: Violations for third-party analytics scripts.
  - **Condition**: The scripts are required.
  - **Decision**: Use `'strict-dynamic'` with a per-request nonce so the analytics loader can attach its dependencies. Do **not** add the analytics origin to a URL allowlist — domain allowlists are bypassable via open redirects, JSONP, and dependency injection on the listed origin.
- **Scenario**: Trusted Types violations on specific sinks.
  - **Condition**: Legacy code paths still write strings to `innerHTML` etc.
  - **Decision**: Refactor those sinks (per §1.1) or route them through a Trusted Types policy (§3.3) before enforcing.

#### 3.2 Transitioning to CSP Enforcement
Only move to enforced mode when:
1. Violations in the report-only logs have dropped to near zero or are accounted for.
2. Reporting remains wired up after the switch — keep `report-to` on the enforced header so regressions are visible.

**Key directives to set:**
- `default-src 'self'` as a fallback for unspecified fetch directives — anchors the policy so any new resource type defaults to a safe value.
- `script-src` with nonces or hashes (avoid URL allowlists; see below).
- `object-src 'none'` and `base-uri 'none'` to block plugin and base-tag injection.
- `form-action 'self'` to prevent form submissions to attacker-controlled origins. `script-src` alone does not close this exfiltration path.
- `upgrade-insecure-requests` to auto-upgrade subresource HTTP loads to HTTPS, closing mixed-content gaps that HSTS does not cover for already-loaded pages.

**Enforced Header Example (CSP with reporting):**
```http
Reporting-Endpoints: main-endpoint="https://reports.example/main"
Content-Security-Policy: default-src 'self'; script-src 'nonce-{RANDOM}' 'strict-dynamic' https: 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'self'; upgrade-insecure-requests; report-to main-endpoint;
```

HTML for nonce-based CSP:
```html
<script nonce="{RANDOM}" src="https://example.com/script.js"></script>
```

For static/cached HTML (SPAs) where a per-response nonce is not possible, use hash-based CSP: hash each inline script and list the hashes in `script-src`.

**Avoid**: URL allowlists like `script-src https://cdn.example.com` — they are easily bypassed by open redirects, JSONP endpoints, and dependency injection on the allowed origin.

#### 3.3 Trusted Types Enforcement
Trusted Types enforces the §1.1 source-level guidance at runtime: once enabled, the browser blocks string assignments to dangerous sinks unless they pass through a named policy.

- **Prerequisite**: Trusted Types requires framework cooperation. If the app's framework (or any third-party widget that writes to DOM sinks) does not produce `TrustedHTML` / `TrustedScript` values, the policy cannot be enforced without breaking that code. Audit framework support before starting the report-only rollout.
- **Prerequisite**: The code-level sink refactor from Phase 1 is a strict prerequisite for Trusted Types enforcement. (Standard CSP `script-src` enforcement, by contrast, does not police DOM sinks and can be deployed without refactoring them.)
- **DO**: Roll out via `Content-Security-Policy-Report-Only: require-trusted-types-for 'script'` first to find every offending sink.
- **DO**: Define a single named policy that performs sanitization (or escaping) and route all sink writes through it.
- **DO**: Move to `Content-Security-Policy: require-trusted-types-for 'script'` only after report-only violations have dropped to near zero.

```javascript
if (window.trustedTypes && trustedTypes.createPolicy) {
  const policy = trustedTypes.createPolicy('escapePolicy', {
    createHTML: str => str.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  });
  el.innerHTML = policy.createHTML(untrustedString);
}
```

#### 3.4 Cross-Origin Opener Policy (COOP)

Lowest-risk of the three. Deploy if the app is **not** an OAuth provider, payment processor, or otherwise expected to be reached from an opener.

- **DO**: Use `Cross-Origin-Opener-Policy: same-origin-allow-popups` — prevents a malicious opener from mounting XS-leaks attacks while still allowing OAuth and payment flows that *the app itself* initiates.
- **DO NOT**: Jump straight to `same-origin` unless you have explicitly verified that no integrations rely on cross-origin `window.opener` access.

#### 3.5 Cross-Origin Resource Policy (CORP)

Set CORP explicitly on each response based on whether it should be embeddable in other contexts. Two core benefits: it protects resources from malicious cross-origin reads, and ensures compatibility when pages request stronger client-side isolation.

- **DO**: Default to `Cross-Origin-Resource-Policy: same-origin` for app-internal resources (authenticated data, user session JSON, restricted internal scripts).
- **DO**: Use `same-site` for endpoints utilized across subdomains of the same eTLD+1.
- **DO**: Provide `cross-origin` exclusively for resources created for generic embedding or widely cached delivery (e.g., static shared assets or public CDNs).

#### 3.6 Cross-Origin Isolation

Highest deployment breakage risk. You only need to deploy this infrastructure if the application requires features relying on `SharedArrayBuffer` (e.g., WebAssembly multi-threading or shared memory architectures). If not required, skip this policy group.

- **Preferred path (Chromium environments)**: Enable `Document-Isolation-Policy: isolate-and-credentialless`. This provides client-side isolation comparable to COEP while instructing the browser to strip cookies and authentication credentials from non-CORS cross-origin resource fetches rather than blocking them outright. Apps that need to *block* cross-origin resources lacking explicit CORP opt-in (rather than load them with credentials stripped) can adopt `isolate-and-require-corp` instead. This is stricter and harder to deploy — it requires the same subresource audit as the cross-browser path below.
- **Cross-browser path (Complex enforcement)**: Require `Cross-Origin-Opener-Policy: same-origin` coupled with `Cross-Origin-Embedder-Policy: require-corp`. Every embedded subresource (images, styles, external media) MUST serve an explicit `Cross-Origin-Resource-Policy` header or the browser will prevent it from loading.

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
```

#### 3.7 Fetch Metadata (Resource Isolation)
Server-side enforcement that uses `Sec-Fetch-*` request headers to reject suspicious cross-site requests. Requires the cross-site integration mapping from §2.1 before enforcing.

- **DO**: Implement a server-side resource isolation policy that checks `Sec-Fetch-*` headers and rejects `cross-site` requests for non-navigational endpoints.
- **DO**: Include `Vary: Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site` to prevent intermediate caches (CDNs) from serving cached responses to attackers.
- **CAUTION**: Misconfiguring these checks will block legitimate API requests coming from cross-site integrations, SSO handlers, or Webhooks. Ensure you log and test your `Sec-Fetch-*` constraints beforehand.

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

  res.status(403).send('Forbidden');
});
```

### Companion policies (deploy in parallel)

These carry significantly lower breakage risk than the core enforcement track. They can be deployed alongside — or before — the CSP and isolation rollouts.

#### HTTP Strict Transport Security (HSTS)
- **DO**: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` to force HTTPS.
- **TIP**: In production rollout, start with a short `max-age` (e.g., 300 seconds) and incrementally increase to 1 year. A misconfigured HSTS with a long max-age can render the site permanently inaccessible until the cache expires in every browser that saw it.

#### X-Content-Type-Options
- **DO**: Set `X-Content-Type-Options: nosniff` to block MIME-type sniffing.

#### Referrer Policy
- **DO**: Use `strict-origin-when-cross-origin` as a safe default.

#### Permissions Policy
- **DO**: Disable unused browser features (camera, geolocation, microphone) for the page and iframes using Structured Fields syntax.
- **DO**: When delegating features to an iframe, use the `allow` attribute in HTML *in addition* to the header.
- **CAUTION**: Unintentionally blocking a delegated feature will cause silent failures in third-party widgets (like embedded video players or payment gateways). Audit third-party dependencies before blocking.

```http
Permissions-Policy: camera=(), geolocation=(), microphone=()
```

```html
<iframe src="https://trusted-video.com/player" allow="fullscreen; camera"></iframe>
```

#### Subresource Integrity (SRI)
- **DO**: Use the `integrity` attribute with a cryptographic hash when loading third-party scripts, combined with `crossorigin="anonymous"`.
- **DO**: Ensure the server/CDN sends an appropriate `Access-Control-Allow-Origin` header so the browser can compute the hash.
- **DO NOT**: Use SRI for dynamic or unversioned assets — silent updates will cause script execution to fail. SRI is strictly for immutable, versioned assets.

```html
<script src="https://cdn.example.com/lib.js" integrity="sha384-H8df...39v" crossorigin="anonymous"></script>
```

#### Cross-Origin Resource Sharing (CORS)
CORS is a permission grant, not a defense — it tells the browser which cross-origin reads to allow. The risk is misconfiguring it as too permissive.

- **DO**: Validate the `Origin` header on the server and set `Access-Control-Allow-Origin` dynamically to specific origins (rather than wildcard `*`).
- **DO NOT**: Use wildcard `*` for `Access-Control-Allow-Origin` if `Access-Control-Allow-Credentials: true` is required — the browser will reject the response.
- **DO**: Handle preflight (`OPTIONS`) requests by returning appropriate headers before processing data.

```http
Access-Control-Allow-Origin: https://trusted-app.com
Access-Control-Allow-Credentials: true
```

#### Clear-Site-Data (Logout)
- **DO**: Use `Clear-Site-Data` on logout endpoints to ensure complete session termination.

```http
Clear-Site-Data: "cookies", "storage", "cache"
```
