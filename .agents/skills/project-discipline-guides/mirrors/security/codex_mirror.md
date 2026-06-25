# Security Development Redundancy Mirror

This is the security guidance I would apply by default from general engineering knowledge, without needing project-specific instructions.

## Core Security Principles

### Default stance

- Treat all external input as untrusted.
- Validate data at trust boundaries.
- Encode output for the context where it is used.
- Prefer deny-by-default access control.
- Prefer allowlists over blocklists.
- Minimize privilege for users, services, tokens, files, processes, and browser APIs.
- Assume client-side controls are advisory only.
- Enforce all important security decisions on the server.
- Fail closed when authorization, validation, or policy checks cannot complete.
- Avoid leaking whether a user, account, token, resource, or permission exists unless that disclosure is intentional.
- Make security properties explicit in code instead of relying on convention.
- Use well-maintained platform APIs and mature libraries instead of custom cryptography, parsers, sanitizers, auth schemes, or policy engines.
- Keep attack surface small: fewer dependencies, fewer exposed endpoints, fewer permissions, fewer ambient capabilities.
- Design for defense in depth: authentication, authorization, input validation, output encoding, rate limiting, logging, monitoring, isolation, and recovery all matter.

### Threat modeling defaults

For any feature, consider:

- Who can call this?
- What identity is associated with the request?
- What resource is being accessed?
- Who owns that resource?
- What trust boundary is crossed?
- What happens if the input is malicious?
- What happens if this endpoint is called directly, out of order, or repeatedly?
- What happens if the user is authenticated but not authorized?
- What data could be leaked through errors, timing, logs, caches, URLs, browser history, analytics, or third-party scripts?
- What happens if the dependency, webhook sender, queue message, file upload, or callback is forged?
- What happens if the request is replayed?
- What happens if the operation partially succeeds?

## Authentication

### General

- Use a proven identity provider or framework whenever possible.
- Store passwords only with a slow password hashing algorithm such as Argon2id, bcrypt, or scrypt.
- Never store plaintext passwords.
- Never encrypt passwords reversibly.
- Use unique per-password salts.
- Use parameters appropriate for current hardware and operational latency.
- Support password reset through single-use, time-limited tokens.
- Invalidate password reset tokens after use.
- Avoid revealing whether an email address exists during login, signup, and reset flows.
- Require re-authentication for sensitive changes such as password changes, MFA changes, email changes, account deletion, and payment changes.
- Use MFA for privileged users and sensitive applications.
- Prefer phishing-resistant MFA such as WebAuthn/passkeys where practical.
- Protect login, reset, and MFA endpoints with rate limits and abuse detection.
- Do not log passwords, reset tokens, OTP codes, session IDs, bearer tokens, or authorization headers.

### Password handling

- Enforce reasonable minimum length.
- Allow long passwords.
- Do not impose arbitrary low maximum lengths.
- Do not require composition rules that reduce usability without improving security much.
- Check new passwords against known-compromised password lists where feasible.
- Allow paste into password fields.
- Use `autocomplete="current-password"` for login password fields.
- Use `autocomplete="new-password"` for new password fields.
- Use `autocomplete="username"` for username/email fields.
- Use `<input type="password">` for password entry.
- Avoid sending passwords through URLs, query strings, analytics, or logs.

### Session management

- Use secure, random, high-entropy session identifiers.
- Generate tokens with a cryptographically secure random source.
- Rotate session IDs after login and privilege changes.
- Invalidate sessions on logout.
- Provide server-side revocation where possible.
- Expire sessions after inactivity and absolute lifetime.
- Store web session cookies with:
  - `HttpOnly`
  - `Secure`
  - `SameSite=Lax` or `SameSite=Strict` where compatible with product needs
  - a narrow `Path`
  - a narrow `Domain` or no `Domain` when host-only is preferred
- Avoid storing long-lived bearer tokens in `localStorage`.
- Prefer `HttpOnly` cookies for browser sessions.
- Treat JWTs as bearer credentials.
- Keep JWT lifetimes short when they cannot be revoked.
- Validate JWT signature, issuer, audience, expiration, not-before, algorithm, and key ID.
- Do not accept unsigned JWTs.
- Do not let clients choose JWT algorithms.
- Avoid putting sensitive or mutable authorization state in long-lived JWT claims.
- Use refresh-token rotation where refresh tokens are used.
- Detect refresh-token reuse.

## Authorization

### Access control

- Authenticate the user, then authorize the specific action on the specific resource.
- Do not rely on hidden UI, disabled buttons, or client-side route guards for authorization.
- Check authorization on every server endpoint, mutation, file download, API call, websocket action, background job trigger, and admin action.
- Use object-level authorization checks to prevent IDOR/BOLA bugs.
- Use function-level authorization checks to prevent users from invoking privileged operations directly.
- Treat resource IDs from the client as untrusted.
- Verify ownership, membership, tenant, role, scope, and policy for each requested resource.
- Avoid broad “admin” checks when the operation needs narrower permission semantics.
- Prefer centralized authorization helpers or policy objects over scattered inline conditions.
- Make authorization failures indistinguishable where appropriate:
  - `404` for resources the caller should not know exist.
  - `403` when the caller is known but lacks permission and disclosure is acceptable.
  - `401` when authentication is required or invalid.

### Multi-tenancy

- Include tenant checks in every query that accesses tenant-scoped data.
- Do not trust tenant IDs from client input without verifying membership.
- Avoid global IDs that allow enumeration unless access checks are robust.
- Prefer database constraints, row-level security, or scoped repositories where practical.
- Ensure background jobs, exports, analytics, and admin tools preserve tenant isolation.
- Test cross-tenant access explicitly.

### API scopes

- Use least-privilege OAuth scopes.
- Validate scopes on the resource server.
- Validate token audience.
- Avoid overloading scopes with business permissions when more precise checks are needed.
- Avoid broad, long-lived API tokens.
- Show token creation time, last-used time, scope, and expiration to users.
- Allow token revocation.

## Input Validation

### General

- Validate all data crossing a trust boundary:
  - HTTP request bodies
  - query strings
  - route parameters
  - headers
  - cookies
  - uploaded files
  - webhook payloads
  - queue messages
  - imported CSV/JSON/XML
  - third-party API responses
  - browser storage
  - postMessage events
  - WebSocket messages
- Validate type, shape, size, format, range, encoding, and semantic constraints.
- Reject unexpected fields when strict schemas are appropriate.
- Normalize before validation when canonical form matters.
- Avoid regex-only validation for complex structured formats when parsers exist.
- Use schema validation libraries for structured input.
- Keep validation close to trust boundaries.
- Revalidate on the server even if the client validates.
- Use typed domain objects after validation to avoid passing raw input deeply through the system.

### Web form validation

- Use semantic HTML input types for baseline validation and UX:
  - `type="email"`
  - `type="url"`
  - `type="number"`
  - `type="date"`
  - `type="tel"`
  - `type="password"`
- Use `required`, `minlength`, `maxlength`, `min`, `max`, `step`, and `pattern` where appropriate.
- Do not rely on browser validation for security.
- Treat client validation as convenience only.
- Give generic error messages for sensitive flows.

### Size limits

- Enforce maximum request body size.
- Enforce maximum file size.
- Enforce maximum number of uploaded files.
- Enforce maximum string length.
- Enforce maximum array length.
- Enforce pagination limits.
- Enforce recursion/depth limits for nested input.
- Enforce timeouts for parsing and processing.
- Avoid unbounded memory allocation from user input.

## Output Encoding and Injection Prevention

## Cross-Site Scripting

### General XSS prevention

- Treat HTML, SVG, MathML, CSS, JavaScript, URLs, markdown, and rich text as separate output contexts.
- Use framework escaping by default.
- Avoid raw HTML rendering APIs unless absolutely necessary.
- Sanitize user-authored rich HTML with a proven sanitizer.
- Sanitize on the server for stored rich content where possible.
- Encode untrusted data for the exact output context.
- Never concatenate untrusted input into HTML strings.
- Never concatenate untrusted input into JavaScript source.
- Never concatenate untrusted input into CSS.
- Never put untrusted input into event-handler attributes.
- Never put untrusted input into `javascript:` URLs.
- Validate and normalize URLs before rendering them as links.
- Use Content Security Policy as defense in depth, not as the only XSS control.

### Dangerous browser APIs

Avoid or tightly control:

```js
element.innerHTML = userInput;
element.outerHTML = userInput;
element.insertAdjacentHTML("beforeend", userInput);
document.write(userInput);
eval(userInput);
new Function(userInput);
setTimeout(userInput);
setInterval(userInput);
```

Prefer:

```js
element.textContent = userInput;
element.setAttribute("title", userInput);
const node = document.createTextNode(userInput);
```

For URLs:

```js
const url = new URL(input, location.origin);

if (!["https:", "http:"].includes(url.protocol)) {
  throw new Error("Unsupported URL scheme");
}

link.href = url.href;
```

For templates, rely on framework escaping:

```jsx
<p>{displayName}</p>
```

Avoid:

```jsx
<div dangerouslySetInnerHTML={{ __html: userContent }} />
```

If rich HTML is required, sanitize first with a mature sanitizer and still apply CSP.

### Trusted Types

- Use Trusted Types where available to reduce DOM XSS risk.
- Enforce `require-trusted-types-for 'script'` in CSP where practical.
- Create narrow Trusted Types policies.
- Do not create a permissive policy that simply returns arbitrary strings.

Example conceptually:

```js
const policy = trustedTypes.createPolicy("app-html", {
  createHTML(input) {
    return sanitizeHtml(input);
  },
});

element.innerHTML = policy.createHTML(userHtml);
```

### DOM clobbering

- Do not rely on global variables implicitly created from element IDs or names.
- Use scoped DOM queries.
- Avoid user-controlled `id` and `name` attributes in sensitive DOM areas.
- Avoid reading security-sensitive values from ambiguous DOM properties.

### Link security

For links opening a new tab:

```html
<a href="https://example.com" target="_blank" rel="noopener noreferrer">
  Example
</a>
```

- Use `rel="noopener"` to prevent tabnabbing.
- Use `rel="noreferrer"` when referrer leakage is undesirable.
- Validate user-provided links.
- Consider adding `rel="nofollow ugc"` for user-generated external links.

### Markdown

- Treat markdown as untrusted input.
- Disable raw HTML unless explicitly needed.
- Sanitize rendered HTML.
- Validate link protocols.
- Validate image sources.
- Avoid allowing arbitrary embedded iframes, scripts, styles, or event handlers.

## SQL and Database Security

### SQL injection prevention

- Use parameterized queries or ORM query binding.
- Never concatenate user input into SQL.
- Never interpolate user input into raw SQL strings.
- Use query builder APIs carefully; raw fragments still need parameterization.
- Validate dynamic identifiers such as column names, table names, and sort directions with allowlists.
- Avoid exposing arbitrary filters that map directly to SQL without validation.
- Use least-privilege database accounts.
- Separate read and write privileges where useful.
- Avoid database superuser credentials in application code.

Example:

```js
await db.query("SELECT * FROM users WHERE id = ?", [userId]);
```

Avoid:

```js
await db.query(`SELECT * FROM users WHERE id = ${userId}`);
```

Dynamic sort allowlist:

```js
const allowedSorts = new Set(["created_at", "name", "email"]);
const sort = allowedSorts.has(input.sort) ? input.sort : "created_at";
const direction = input.direction === "asc" ? "asc" : "desc";
```

### ORM usage

- Do not assume ORM use automatically prevents all injection.
- Treat raw queries as dangerous.
- Check generated query semantics for authorization and tenant scoping.
- Avoid mass assignment by explicitly selecting allowed fields.
- Avoid leaking sensitive columns through default model serialization.
- Use transactions for multi-step mutations that must be atomic.

### NoSQL injection

- Validate JSON query objects.
- Do not pass request bodies directly into database query APIs.
- Prevent operator injection such as `$ne`, `$gt`, `$where`, or equivalent query operators where user data should be scalar.
- Use schema validation to ensure expected primitive values.

Example:

```js
const email = String(req.body.email);
await users.findOne({ email });
```

Avoid:

```js
await users.findOne(req.body);
```

## Command Injection and Process Execution

- Avoid shell execution with user input.
- Prefer native APIs over shell commands.
- If process execution is required, use argument arrays instead of shell strings.
- Do not pass untrusted input to a shell.
- Validate executable names and subcommands with allowlists.
- Set timeouts.
- Limit output size.
- Run with least privilege.
- Use controlled working directories.
- Avoid inheriting sensitive environment variables.
- Avoid logging full command lines if they include secrets.

Prefer:

```js
spawn("git", ["status", "--short"], { shell: false });
```

Avoid:

```js
exec(`git ${userArg}`);
```

## Path Traversal and Filesystem Security

- Treat filenames, paths, archive entries, and MIME types as untrusted.
- Do not concatenate user input into filesystem paths without normalization and containment checks.
- Resolve paths against an allowed base directory.
- Verify the resolved path remains inside the allowed base.
- Reject absolute paths where not expected.
- Reject `..` traversal where not expected.
- Use generated storage names instead of user-supplied filenames.
- Store original filenames only as metadata after sanitization.
- Avoid serving uploaded files from executable locations.
- Avoid following symlinks unless intentional.
- Set restrictive file permissions.
- Use temporary directories safely.
- Clean up temporary files.

Example:

```js
const base = path.resolve(uploadRoot);
const target = path.resolve(base, userPath);

if (!target.startsWith(base + path.sep)) {
  throw new Error("Invalid path");
}
```

Also account for case-insensitive filesystems and platform path separators where relevant.

## File Uploads

- Require authentication for sensitive uploads.
- Enforce file size limits.
- Enforce file count limits.
- Validate file extension and content type.
- Do not trust the browser-provided MIME type.
- Inspect file signatures where appropriate.
- Store files outside the web root where possible.
- Generate server-side filenames.
- Scan high-risk uploads for malware where appropriate.
- Strip metadata from images or documents where privacy matters.
- Re-encode images when possible to neutralize embedded payloads.
- Serve user-uploaded files with safe headers:
  - `Content-Type`
  - `Content-Disposition: attachment` where appropriate
  - `X-Content-Type-Options: nosniff`
  - restrictive CSP for user-content domains
- Use a separate domain or origin for untrusted user content where possible.
- Prevent SVG uploads from executing scripts unless sanitized or served as attachment.
- Be careful with HTML, SVG, PDF, Office documents, archives, and media files.

### Archive extraction

- Defend against Zip Slip path traversal.
- Limit extracted size.
- Limit file count.
- Limit nesting depth.
- Reject absolute paths and traversal paths.
- Handle symlinks carefully.
- Detect compression bombs.
- Extract in isolated temporary directories.

## Cross-Site Request Forgery

- Use `SameSite=Lax` or `SameSite=Strict` cookies where possible.
- Use CSRF tokens for state-changing requests authenticated by cookies.
- Validate CSRF tokens server-side.
- Bind CSRF tokens to the user session.
- Use custom headers for AJAX requests as an additional barrier.
- Do not use GET for state-changing operations.
- Check `Origin` and `Referer` headers for sensitive state-changing requests, especially where CSRF tokens are difficult.
- Do not rely only on CORS for CSRF protection.
- Bearer-token APIs that do not use ambient cookies are less exposed to classic CSRF, but still need XSS protection.

## CORS

- Do not use `Access-Control-Allow-Origin: *` with credentials.
- Avoid reflecting arbitrary `Origin` values.
- Use an allowlist of trusted origins.
- Validate scheme, host, and port exactly.
- Keep allowed methods minimal.
- Keep allowed headers minimal.
- Understand that CORS is a browser access control, not server-side authorization.
- Non-browser clients can ignore CORS.
- Preflight success must not imply authorization.
- Avoid exposing sensitive headers unless needed.

Example:

```http
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Credentials: true
Vary: Origin
```

## Content Security Policy

- Use CSP to reduce XSS impact.
- Prefer nonce- or hash-based scripts over broad host allowlists.
- Avoid `'unsafe-inline'`.
- Avoid `'unsafe-eval'`.
- Use `object-src 'none'`.
- Use `base-uri 'none'` or a narrow value.
- Use `frame-ancestors` to control embedding.
- Use `form-action` to restrict form submission targets.
- Use `upgrade-insecure-requests` where appropriate.
- Use `report-uri` or `report-to` for monitoring during rollout.
- Apply CSP carefully to avoid breaking legitimate scripts.
- Use report-only mode before enforcement for complex apps.

Example:

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-random-value';
  style-src 'self';
  img-src 'self' https: data:;
  connect-src 'self' https://api.example.com;
  font-src 'self';
  object-src 'none';
  base-uri 'none';
  frame-ancestors 'none';
  form-action 'self';
```

## Security Headers

Use appropriate headers:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Content-Security-Policy: ...
```

Notes:

- Use HSTS only over HTTPS.
- Consider HSTS preload only when all subdomains are HTTPS-ready.
- `X-Frame-Options` is older; `frame-ancestors` in CSP is more expressive. Using both may be acceptable for legacy compatibility.
- `X-XSS-Protection` is obsolete and should generally not be relied on.
- `Permissions-Policy` should disable powerful browser features by default.
- COOP/COEP/CORP can help with cross-origin isolation but may require resource changes.

## HTTPS and Transport Security

- Use HTTPS everywhere.
- Redirect HTTP to HTTPS.
- Use secure TLS configuration.
- Keep certificates renewed.
- Use HSTS.
- Do not load active mixed content.
- Use secure websocket URLs: `wss://`.
- Do not send secrets over plaintext HTTP.
- Avoid disabling certificate validation in production.
- Pinning is risky operationally and should be used only with strong justification.

## Browser Storage

- Treat browser storage as attacker-readable if XSS occurs.
- Avoid storing sensitive long-lived secrets in:
  - `localStorage`
  - `sessionStorage`
  - IndexedDB
  - Cache Storage
  - non-HttpOnly cookies
- Prefer `HttpOnly`, `Secure`, `SameSite` cookies for sessions.
- Clear sensitive local state on logout.
- Do not store passwords, recovery codes, private keys, or high-value tokens in browser storage unless the design explicitly accounts for compromise.
- Be careful with service worker caches and authenticated responses.
- Avoid caching sensitive pages unless intended.

## Fetch and Network APIs

### Fetch

- Check response status explicitly.
- Use `credentials` intentionally.
- Avoid sending credentials cross-origin unless required.
- Include CSRF tokens where needed.
- Set appropriate `Content-Type`.
- Use `AbortController` for timeouts and cancellation.
- Avoid logging full request or response bodies if they may contain secrets.

Example:

```js
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000);

try {
  const response = await fetch("/api/profile", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "CSRF-Token": csrfToken,
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return await response.json();
} finally {
  clearTimeout(timeout);
}
```

### URL construction

- Use `URL` and `URLSearchParams` instead of string concatenation.

```js
const url = new URL("/search", location.origin);
url.searchParams.set("q", query);
url.searchParams.set("page", String(page));
```

### postMessage

- Always validate `event.origin`.
- Validate `event.source` when relevant.
- Validate message shape.
- Do not use `targetOrigin: "*"` when sending sensitive data.
- Avoid sending secrets through `postMessage`.

```js
window.addEventListener("message", (event) => {
  if (event.origin !== "https://trusted.example.com") return;

  if (!isExpectedMessage(event.data)) return;

  handleMessage(event.data);
});
```

## Web Workers, Service Workers, and Cache

### Web workers

- Validate messages sent to workers.
- Avoid passing secrets unnecessarily.
- Use structured clone safely.
- Be careful with object URLs and imported scripts.
- Restrict worker sources through CSP.

### Service workers

- Treat service workers as powerful persistent code.
- Keep service worker scope narrow.
- Avoid caching authenticated or sensitive responses unintentionally.
- Version caches.
- Clear old caches.
- Validate cached response freshness.
- Avoid serving stale security-sensitive shell HTML after logout.
- Be careful with offline behavior for private data.

### Cache API

- Do not cache responses containing secrets unless explicitly designed.
- Respect `Cache-Control`.
- Use `Vary` correctly for authenticated or localized content.
- Avoid mixing users in shared caches.
- Include authorization state in cache keys only with care.

## Cookies

- Use `HttpOnly` for cookies that JavaScript does not need.
- Use `Secure` for all session cookies.
- Use `SameSite=Lax` or `Strict` where possible.
- Use `SameSite=None; Secure` only when cross-site cookies are truly required.
- Use the `__Host-` prefix for strong host-only secure cookies where possible:
  - must be `Secure`
  - must have `Path=/`
  - must not have `Domain`
- Use the `__Secure-` prefix for secure cookies where appropriate.
- Keep cookie values small.
- Avoid storing sensitive data directly in cookies unless encrypted and integrity-protected.
- Sign cookies that carry trusted data.
- Prefer opaque session IDs over large client-side session payloads.
- Rotate session cookies after authentication changes.

## Cryptography

### General

- Do not design custom cryptographic algorithms.
- Do not implement crypto primitives manually.
- Use platform crypto APIs or audited libraries.
- Use authenticated encryption.
- Use secure random number generation.
- Separate keys by purpose.
- Rotate keys when needed.
- Protect keys in a key management system where possible.
- Avoid hardcoded keys.
- Avoid reusing nonces/IVs with algorithms that require uniqueness.
- Avoid obsolete algorithms:
  - MD5
  - SHA-1 for collision-resistant uses
  - DES
  - 3DES
  - RC4
  - ECB mode
- Use constant-time comparison for secrets where timing attacks matter.

### Browser crypto

Use Web Crypto API:

```js
const bytes = new Uint8Array(32);
crypto.getRandomValues(bytes);
```

For UUIDs:

```js
const id = crypto.randomUUID();
```

Prefer Web Crypto for hashing, signing, key derivation, and encryption in browser contexts when needed:

```js
const data = new TextEncoder().encode("message");
const digest = await crypto.subtle.digest("SHA-256", data);
```

Notes:

- `btoa` and `atob` are encoding helpers, not encryption.
- Base64 is not encryption.
- Hashing is not encryption.
- Encryption without authentication is usually insufficient.
- Client-side encryption does not protect data from malicious client code running in the same origin.

### Randomness

- Use `crypto.getRandomValues()` in browsers.
- Use `crypto.randomUUID()` for UUIDs where appropriate.
- Use server-side cryptographic randomness for tokens.
- Do not use `Math.random()` for security-sensitive values.

Avoid:

```js
const token = Math.random().toString(36).slice(2);
```

Prefer:

```js
const token = crypto.randomUUID();
```

or random bytes from a cryptographic RNG.

## Secrets Management

- Do not commit secrets to source control.
- Do not hardcode API keys, passwords, private keys, or tokens.
- Use environment variables, secret managers, or platform secret stores.
- Keep secrets out of logs, stack traces, metrics, URLs, analytics, and error reports.
- Rotate leaked secrets immediately.
- Scope secrets narrowly.
- Use separate secrets per environment.
- Avoid sharing production secrets with development or CI unnecessarily.
- Audit access to secrets.
- Use short-lived credentials where possible.
- Prefer workload identity or managed credentials over static keys where available.
- Add secret scanning in CI and repository hosting where possible.

## Error Handling

- Return generic errors to users for sensitive flows.
- Log enough detail server-side to diagnose issues.
- Do not expose stack traces in production responses.
- Do not expose internal paths, SQL, config, environment variables, dependency versions, or secrets.
- Avoid reflecting raw user input in error pages.
- Normalize authentication errors:
  - “Invalid email or password”
  - not “No account found”
- Use structured errors internally.
- Map internal errors to safe external responses.
- Preserve causal information in logs without leaking it to clients.

## Logging and Monitoring

- Log security-relevant events:
  - login success/failure
  - logout
  - password reset requested/completed
  - MFA changes
  - email changes
  - permission changes
  - admin actions
  - token creation/revocation
  - suspicious rate-limit activity
  - access denied events
  - webhook validation failures
- Avoid logging secrets or raw sensitive payloads.
- Redact:
  - passwords
  - tokens
  - authorization headers
  - cookies
  - API keys
  - reset links
  - private keys
  - payment data
  - sensitive personal data
- Use structured logs.
- Include request IDs or correlation IDs.
- Protect logs with access control.
- Define retention periods.
- Monitor anomalies.
- Alert on high-risk events.
- Avoid making logs a secondary data leak.

## Rate Limiting and Abuse Protection

- Rate limit authentication endpoints.
- Rate limit password reset and email verification.
- Rate limit token creation.
- Rate limit expensive endpoints.
- Rate limit by user, IP, account, tenant, API key, and device where appropriate.
- Use progressive delays or lockouts carefully to avoid account lockout abuse.
- Add bot defenses where needed.
- Avoid disclosing which part of authentication failed.
- Add quotas for resource creation, export, uploads, and invitations.
- Protect search endpoints from enumeration and scraping.
- Protect webhook receivers from replay and flooding.

## Webhooks

- Verify webhook signatures.
- Verify timestamp freshness.
- Prevent replay attacks.
- Use raw request body for signature verification when required by provider.
- Use constant-time comparison for signatures.
- Validate event type and payload schema.
- Make webhook processing idempotent.
- Store processed event IDs.
- Return success only after durable acceptance or clear processing semantics.
- Do not trust webhook payloads solely because they come from a known URL.
- Fetch authoritative state from provider APIs for high-risk actions when appropriate.

## SSRF

- Treat user-provided URLs as dangerous.
- Parse URLs with a real URL parser.
- Allowlist schemes, hosts, and ports.
- Block private, loopback, link-local, multicast, and metadata IP ranges.
- Resolve DNS carefully and defend against DNS rebinding.
- Re-check IP after redirects.
- Limit redirects.
- Set request timeouts.
- Limit response size.
- Avoid sending internal credentials to fetched URLs.
- Do not allow arbitrary headers.
- Disable access to cloud metadata endpoints.
- Use egress firewalling where possible.

Dangerous examples:

```text
http://localhost
http://127.0.0.1
http://169.254.169.254
http://[::1]
file:///etc/passwd
```

## Open Redirects

- Avoid redirecting to arbitrary user-provided URLs.
- Use relative redirects where possible.
- Use allowlists for external redirects.
- Parse and normalize URLs before checking.
- Reject protocol-relative URLs such as `//evil.example`.
- Do not trust URLs just because they start with a substring.

Prefer:

```js
const allowed = new Set(["/dashboard", "/settings"]);
const next = allowed.has(inputNext) ? inputNext : "/dashboard";
```

## Clickjacking and Framing

- Prevent unwanted framing with CSP:

```http
Content-Security-Policy: frame-ancestors 'none'
```

or allow specific parents:

```http
Content-Security-Policy: frame-ancestors 'self' https://partner.example
```

- Use `X-Frame-Options: DENY` or `SAMEORIGIN` for older compatibility where appropriate.
- For embeddable apps, design explicit framing policy.
- Use frame-busting scripts only as weak defense in depth.

## HTML and Form Security

- Use proper form methods.
- Do not use GET for sensitive or state-changing submissions.
- Avoid putting secrets in hidden fields unless integrity-protected and non-sensitive.
- Server-side validate all hidden fields.
- Protect state-changing forms with CSRF defenses.
- Set `autocomplete` intentionally.
- Use `inputmode` for UX, not security.
- Use `readonly`/`disabled` only for UX, not trust.
- Do not trust client-side calculated totals, prices, roles, or permissions.

## Iframes and Embedding

- Use `sandbox` for untrusted iframe content.
- Add only the permissions required.
- Use `allow` for specific capabilities.
- Use a separate origin for untrusted embedded content.
- Avoid allowing both `allow-scripts` and `allow-same-origin` for untrusted content unless fully understood.
- Validate `postMessage` communication.

Example:

```html
<iframe
  src="https://usercontent.example.com/document/123"
  sandbox="allow-scripts"
  referrerpolicy="no-referrer"
></iframe>
```

## Permissions and Powerful Browser APIs

- Request browser permissions only when needed.
- Explain permission use in product UX.
- Handle denied permissions gracefully.
- Avoid requesting permissions on page load.
- Use `Permissions-Policy` to disable unused capabilities.
- Be careful with:
  - geolocation
  - camera
  - microphone
  - clipboard
  - notifications
  - USB
  - Bluetooth
  - serial
  - file system access
  - payment APIs
  - idle detection
- Do not collect more data than necessary.
- Do not keep permission-derived data longer than needed.

## Clipboard

- Treat clipboard content as untrusted input.
- Avoid writing sensitive data to the clipboard without user action.
- Avoid reading clipboard without clear user intent.
- Sanitize pasted rich text.
- Prefer plain text paste in sensitive fields where appropriate.

## File System Access API

- Use only in secure contexts.
- Require explicit user gestures.
- Treat file contents as untrusted.
- Validate file type, size, and content.
- Do not assume a previously granted handle remains valid.
- Avoid writing files without clear user intent.
- Handle permission denial.

## Subresource Integrity

- Use SRI for third-party scripts and styles when loading from CDNs.

```html
<script
  src="https://cdn.example.com/library.js"
  integrity="sha384-..."
  crossorigin="anonymous"
></script>
```

- Pin exact versions.
- Avoid loading critical code from third-party CDNs when self-hosting is practical.
- Combine SRI with CSP.

## Dependency Security

- Keep dependencies updated.
- Remove unused dependencies.
- Prefer widely used, maintained libraries.
- Review dependency health:
  - maintenance activity
  - known vulnerabilities
  - transitive dependencies
  - install scripts
  - package ownership changes
- Pin versions or use lockfiles.
- Use automated vulnerability scanning.
- Use software composition analysis where appropriate.
- Avoid running untrusted package scripts in sensitive environments.
- Review major upgrades.
- Avoid libraries for trivial functionality.
- Watch for dependency confusion and typosquatting.
- Use private package scopes and registry configuration carefully.

## Supply Chain and Build Security

- Use lockfiles.
- Build from clean environments.
- Protect CI secrets.
- Do not expose secrets to untrusted pull requests.
- Use least-privilege CI tokens.
- Pin GitHub Actions or third-party CI actions to trusted versions or SHAs where appropriate.
- Separate build, test, release, and deployment permissions.
- Sign artifacts where appropriate.
- Generate SBOMs where useful.
- Verify provenance for high-assurance systems.
- Do not run production deployments from unreviewed branches.
- Protect release branches.
- Require reviews for sensitive code paths.
- Use reproducible builds where practical.

## Environment Configuration

- Use secure defaults.
- Make development-only features impossible to enable accidentally in production.
- Validate required environment variables at startup.
- Fail startup if critical security config is missing.
- Separate dev, staging, and production environments.
- Use different databases and credentials per environment.
- Disable debug mode in production.
- Disable verbose error pages in production.
- Do not expose admin/debug endpoints publicly.
- Protect health and metrics endpoints if they disclose sensitive information.

## API Design Security

- Use consistent authentication and authorization middleware.
- Use schema validation for requests and responses.
- Use explicit response DTOs.
- Avoid returning whole database objects.
- Avoid exposing internal IDs if enumeration risk matters.
- Use pagination on list endpoints.
- Put maximum page sizes in place.
- Use idempotency keys for retryable mutations such as payments or order creation.
- Validate content type.
- Reject unknown content types.
- Use consistent error shapes.
- Use appropriate HTTP status codes.
- Avoid overly detailed errors for sensitive actions.
- Version APIs deliberately.
- Document security semantics.

## GraphQL Security

- Authorize at resolver or data-access level.
- Prevent cross-tenant object access.
- Limit query depth.
- Limit query complexity.
- Limit aliases and batching.
- Disable introspection in production if schema secrecy is required, though authorization remains essential.
- Avoid exposing sensitive fields by default.
- Prevent N+1 queries that can become DoS vectors.
- Use persisted queries for public APIs where appropriate.
- Validate file uploads carefully if supported.

## WebSocket and Realtime Security

- Authenticate websocket connections.
- Authorize each subscription, channel, room, and action.
- Revalidate permissions on reconnect.
- Do not trust client-supplied room IDs.
- Validate message schemas.
- Rate limit messages.
- Limit message size.
- Handle backpressure.
- Do not broadcast sensitive data to unauthorized subscribers.
- Clean up subscriptions on disconnect.
- Use `wss://` in production.
- Check `Origin` where browser websocket CSRF-like risks matter.

## Server-Sent Events

- Authenticate streams.
- Authorize stream resources.
- Avoid leaking cross-tenant events.
- Handle disconnects.
- Avoid unbounded buffering.
- Use correct cache headers.
- Consider token/session expiry behavior for long-lived connections.

## Data Protection and Privacy

- Collect only necessary data.
- Store only necessary data.
- Retain data only as long as needed.
- Classify sensitive data.
- Encrypt sensitive data at rest where appropriate.
- Use field-level encryption for especially sensitive values where appropriate.
- Avoid putting sensitive data in URLs.
- Avoid putting sensitive data in browser history.
- Avoid sending sensitive data to third-party analytics.
- Mask sensitive values in UI where appropriate.
- Provide secure deletion semantics where required.
- Use access logs and audit logs for sensitive data access.
- Separate operational logs from sensitive data stores.
- Consider privacy laws and consent requirements.

## Payment and Financial Data

- Use hosted payment pages or tokenized payment providers where possible.
- Avoid handling raw card data unless necessary and compliant.
- Never log card numbers, CVV, bank credentials, or payment tokens.
- Use idempotency keys for payment operations.
- Verify webhook signatures.
- Reconcile payment status from provider APIs.
- Treat client-reported payment success as untrusted.
- Enforce server-side price, currency, discount, tax, and ownership checks.
- Avoid trusting cart totals from the client.

## Email Security

- Do not put sensitive secrets in email when avoidable.
- Make reset and verification links single-use and time-limited.
- Avoid account enumeration.
- Use generic copy for sensitive flows.
- Sign outbound mail with SPF, DKIM, and DMARC at the domain level.
- Avoid user-controlled HTML injection in emails.
- Sanitize or escape user-provided email content.
- Avoid open redirects in email links.
- Make unsubscribe links unguessable and scoped.

## OAuth and OIDC

- Use Authorization Code flow with PKCE for browser/mobile clients.
- Validate `state` to prevent CSRF.
- Validate `nonce` for ID tokens.
- Validate issuer, audience, expiration, signature, and algorithm.
- Do not use implicit flow for new applications.
- Store OAuth client secrets only on confidential clients.
- Never expose client secrets in browser code.
- Use exact redirect URI matching.
- Avoid wildcard redirect URIs.
- Keep scopes minimal.
- Treat provider profile data as untrusted until mapped and validated.
- Handle account linking carefully to prevent account takeover.
- Reconfirm sensitive account linking operations.

## Passkeys and WebAuthn

- Prefer WebAuthn/passkeys for phishing-resistant authentication.
- Validate challenge, origin, RP ID, user presence, and user verification requirements.
- Use server-generated challenges.
- Expire challenges.
- Prevent challenge replay.
- Store credential public keys and counters.
- Handle backup eligible credentials and synced passkeys according to product risk.
- Allow multiple credentials per account.
- Provide secure recovery flows.

## Frontend Framework Security

### General

- Rely on framework escaping.
- Avoid raw HTML escape hatches:
  - React `dangerouslySetInnerHTML`
  - Vue `v-html`
  - Angular `bypassSecurityTrust...`
  - Svelte `{@html ...}`
- Sanitize any user-controlled HTML before using escape hatches.
- Avoid template injection from user-controlled template strings.
- Avoid dynamic component loading from untrusted names.
- Avoid rendering untrusted JSON directly into inline scripts without safe escaping.
- Avoid hydration data XSS by escaping `<`, `>`, `&`, U+2028, and U+2029 where relevant.
- Keep framework and build tooling updated.

### React

- JSX escapes text by default.
- Avoid `dangerouslySetInnerHTML`.
- Validate URLs used in `href`, `src`, and navigation APIs.
- Avoid putting secrets in client-side bundles.
- Do not rely on client-side route guards.
- Be careful with server components and server actions: validate and authorize server-side.

### Vue

- Mustaches escape by default.
- Avoid `v-html` with untrusted content.
- Validate dynamic arguments and URLs.
- Do not mount Vue on DOM that contains user-provided server-rendered HTML.

### Angular

- Angular sanitizes many contexts by default.
- Avoid bypass APIs unless absolutely necessary.
- Treat `DomSanitizer.bypassSecurityTrust...` as security-sensitive.
- Validate route guards server-side too.

### Svelte

- Text interpolation escapes by default.
- Avoid `{@html}` with untrusted content.
- Validate URLs and dynamic attributes.

## Server Rendering and Hydration

- Escape serialized data embedded in HTML.
- Do not embed raw JSON with unescaped `</script>`.
- Use safe serialization libraries or framework helpers.
- Avoid exposing server-only environment variables to the client.
- Distinguish public build-time config from private server config.
- Do not leak stack traces or server internals through SSR error pages.
- Validate and authorize server actions, loaders, and mutations.
- Avoid caching private SSR pages as public content.

## HTTP Caching

- Use `Cache-Control: no-store` for highly sensitive responses.
- Use `private` for user-specific cacheable responses.
- Use `Vary: Authorization` or avoid shared caching for authenticated content.
- Avoid caching pages with CSRF tokens in shared caches.
- Avoid exposing one user’s data to another through CDN or proxy caches.
- Use cache keys that include tenant, locale, auth state, and other relevant variants.
- Be careful with stale responses after permission changes or logout.

Example:

```http
Cache-Control: no-store
```

For user-specific but browser-cacheable data:

```http
Cache-Control: private, max-age=60
```

## XML Security

- Avoid XML when JSON is sufficient.
- Disable external entity resolution.
- Disable DTDs where possible.
- Protect against XXE.
- Limit document size and nesting.
- Use safe XML parsers.
- Avoid XPath injection by parameterizing or validating expressions.
- Be careful with XML signatures and canonicalization.

## JSON Security

- Validate schema.
- Limit body size.
- Avoid parsing untrusted JSON with custom evaluators.
- Use `JSON.parse`, not `eval`.
- Avoid JSONP for modern apps.
- Set correct content type:

```http
Content-Type: application/json
```

- Avoid serving sensitive JSON to unauthenticated contexts.
- Consider JSON hijacking only for legacy browser threat models; modern mitigations generally include proper auth, content type, and no JSONP.

## Deserialization

- Avoid deserializing untrusted data into executable objects.
- Avoid formats that can instantiate arbitrary classes from untrusted input.
- Prefer JSON with schema validation.
- Disable polymorphic deserialization unless tightly controlled.
- Avoid `pickle`, native object serialization, or equivalent unsafe mechanisms with untrusted input.
- Sign and validate serialized tokens if they carry trusted state.
- Encrypt only if confidentiality is needed; still authenticate/integrity-protect.

## Template Injection

- Do not compile templates from user input.
- Do not pass untrusted values as template source.
- Use template variables, not string concatenation.
- Avoid exposing powerful helpers or global objects to templates.
- Sandbox user-authored templates if the product requires them.
- Prefer restricted expression languages.

## Regex Security

- Avoid vulnerable regexes with catastrophic backtracking.
- Limit input length before regex matching.
- Prefer simple regexes.
- Use parser libraries for complex languages.
- Consider regex engines with guaranteed linear time where available.
- Avoid using user-provided regexes directly.
- Time-limit expensive matching if user-provided patterns are a feature.

## Prototype Pollution

In JavaScript:

- Treat object keys from untrusted input carefully.
- Reject keys such as:
  - `__proto__`
  - `prototype`
  - `constructor`
- Prefer `Object.create(null)` for dictionaries when appropriate.
- Use `Map` for arbitrary key-value maps.
- Avoid unsafe deep merge of untrusted objects.
- Keep libraries updated.

Example:

```js
const data = new Map();
data.set(userKey, value);
```

## JavaScript Language and API Practices

### Safer modern syntax

- Use `const` by default.
- Use `let` when reassignment is required.
- Avoid `var`.
- Use strict equality `===` and `!==`.
- Use optional chaining deliberately:

```js
const city = user.profile?.address?.city;
```

- Use nullish coalescing for defaulting only on `null` or `undefined`:

```js
const limit = input.limit ?? 20;
```

- Avoid `||` defaults when `0`, `false`, or `""` are valid.
- Use destructuring carefully and validate before destructuring untrusted nested data.
- Use modules instead of globals.
- Avoid implicit globals.
- Avoid monkey-patching built-ins.
- Prefer pure functions for validation and authorization checks.
- Keep security-sensitive branches explicit.

### Type checks

```js
if (typeof value !== "string") {
  throw new Error("Expected string");
}

if (!Array.isArray(items)) {
  throw new Error("Expected array");
}
```

- Remember `typeof null === "object"`.
- Validate dates with care.
- Avoid trusting TypeScript types at runtime.
- Use runtime validation at external boundaries.

### Objects

- Use `Object.hasOwn()` instead of direct `obj.hasOwnProperty()` where available:

```js
if (Object.hasOwn(record, key)) {
  // ...
}
```

- Avoid iterating inherited properties accidentally.
- Use `Object.freeze()` for immutable constants when useful.
- Use `Map` for dynamic keys.

### Arrays

- Use `Array.prototype.at()` for readable relative indexing:

```js
const last = items.at(-1);
```

- Avoid mutating arrays unexpectedly in shared state.
- Be aware of newer non-mutating methods where supported:
  - `toSorted()`
  - `toReversed()`
  - `toSpliced()`
  - `with()`

```js
const sorted = items.toSorted((a, b) => a.name.localeCompare(b.name));
```

### Promises and async

- Always handle rejected promises.
- Use `try`/`catch` around awaited operations.
- Avoid floating promises unless intentionally detached and observed.
- Use `Promise.all` for independent operations.
- Use `Promise.allSettled` when partial failure is expected.
- Use `AbortController` for cancellation.
- Avoid swallowing errors silently.
- Avoid exposing raw errors to clients.

### Dates and time

- Store timestamps in UTC.
- Use ISO 8601 strings for interchange.
- Do not trust client clocks for security decisions.
- Use server time for expiration, token validity, and audit events.
- Be careful with time zones, DST, and date-only values.
- Use mature date/time libraries when requirements are complex.
- The Temporal API is desirable where available or polyfilled, but compatibility must be considered.

## TypeScript Security and Clean Code

- Use `strict` mode.
- Avoid `any` for external input.
- Represent untrusted input as `unknown` until validated.
- Use discriminated unions for state machines and variants.
- Use branded types for validated IDs, tenant IDs, or sanitized HTML where helpful.
- Avoid type assertions that skip validation.
- Avoid non-null assertions in security-sensitive code.
- Keep DTOs separate from database models.
- Do not expose sensitive fields through broad types.
- Use exhaustive checks.

Example:

```ts
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
```

Use runtime validation:

```ts
function parseUserId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error("Invalid user ID");
  }

  return value;
}
```

## Clean Code for Security

- Make trust boundaries obvious.
- Name variables to indicate trust level:
  - `rawInput`
  - `validatedInput`
  - `sanitizedHtml`
  - `currentUser`
  - `targetResource`
- Keep validation, authorization, and mutation steps clear.
- Avoid mixing parsing, authorization, and side effects in one large function.
- Use small, testable policy functions.
- Centralize repeated security checks.
- Avoid clever control flow in security-sensitive code.
- Prefer explicit conditions over implicit truthiness when security matters.
- Avoid boolean parameter traps for permission-sensitive behavior.
- Avoid global mutable state.
- Keep dependencies injectable for tests, but avoid exposing security-critical internals unnecessarily.
- Write tests for negative cases, not just successful paths.
- Use clear errors internally and safe errors externally.
- Document non-obvious security decisions.

## Testing Security Behavior

### Unit and integration tests

Test:

- unauthenticated access
- authenticated but unauthorized access
- cross-tenant access
- resource ownership checks
- invalid IDs
- malformed input
- extra fields
- missing fields
- boundary values
- oversized payloads
- expired tokens
- revoked tokens
- replayed webhooks
- CSRF failures
- rate limit behavior
- open redirect attempts
- path traversal attempts
- upload rejection
- XSS payload rendering
- SQL/NoSQL injection attempts where relevant

### Example negative tests

- User A cannot access User B’s resource.
- Tenant A cannot access Tenant B’s data.
- Non-admin cannot call admin mutation.
- Disabled account cannot authenticate.
- Expired reset token fails.
- Used reset token fails.
- Invalid webhook signature fails.
- `../secret.txt` file path fails.
- `javascript:alert(1)` link is rejected.
- Unknown JSON fields are rejected where strict schemas are expected.

### Security regression testing

- Add regression tests for every fixed vulnerability.
- Test both UI route and direct API access.
- Test authorization at the lowest meaningful layer.
- Include abuse cases in automated tests where feasible.
- Use static analysis and dependency scanning as support, not replacement for review.

## Secure Defaults in UI

- Hide controls the user cannot use, but still enforce server authorization.
- Avoid exposing sensitive identifiers or internal state in DOM attributes.
- Avoid embedding secrets in HTML.
- Avoid storing privileged flags in client state as trusted values.
- Disable autocomplete only where there is a clear reason; use correct autocomplete tokens otherwise.
- Prevent accidental destructive actions with confirmation or undo where appropriate.
- Re-authenticate for sensitive operations.
- Show last login/session/device information where useful.
- Provide logout from all sessions where appropriate.

## Admin Interfaces

- Require strong authentication and MFA.
- Use explicit authorization for each admin action.
- Audit all admin actions.
- Protect against CSRF.
- Do not expose admin interfaces publicly unless necessary.
- Use network restrictions where appropriate.
- Avoid bulk dangerous actions without confirmation and auditability.
- Separate read-only support access from mutating admin access.
- Mask sensitive user data by default.
- Require justification for sensitive access where appropriate.

## Internationalization and Unicode Security

- Normalize strings where identity comparison matters.
- Be careful with Unicode confusables in usernames, domains, slugs, and identifiers.
- Avoid case-folding bugs.
- Validate email and domain names with appropriate libraries.
- Do not assume one character equals one code unit.
- Limit identifier character sets when simplicity is more important than full Unicode flexibility.
- Be careful with bidirectional text in logs, filenames, and rendered content.
- Escape rendered text regardless of language.

## URL and Domain Handling

- Use the `URL` API.
- Normalize before comparison.
- Compare hostnames carefully.
- Account for punycode/internationalized domains.
- Validate schemes.
- Reject dangerous schemes:
  - `javascript:`
  - `data:` unless explicitly allowed
  - `file:`
  - `blob:` unless explicitly allowed
- Be careful with username/password components in URLs.
- Be careful with trailing dots, mixed case, encoded characters, and redirects.
- Avoid substring checks for domain validation.

Bad:

```js
if (url.includes("example.com")) {
  redirect(url);
}
```

Better:

```js
const parsed = new URL(url);
if (parsed.origin !== "https://example.com") {
  throw new Error("Invalid redirect target");
}
```

## Regular Web Platform APIs

### Sanitizer API

- A native Sanitizer API has been discussed and partially implemented in some environments, but compatibility is limited.
- Use it only as progressive enhancement if available and backed by a reliable fallback.
- For production rich-text sanitization, use a mature sanitizer library until native support is universal.

### URLPattern

- `URLPattern` can make route and URL matching clearer where available.
- Use feature detection or fallback if targeting environments without it.

```js
if ("URLPattern" in globalThis) {
  const pattern = new URLPattern({ pathname: "/users/:id" });
}
```

### AbortSignal timeout

Where supported:

```js
const response = await fetch(url, {
  signal: AbortSignal.timeout(10_000),
});
```

Fallback with `AbortController` when unavailable.

### Structured clone

- Use `structuredClone()` for cloning structured data where supported.
- Do not use JSON stringify/parse as a general clone for data with dates, maps, sets, undefined, or special values.
- Cloning does not validate trust.

```js
const copy = structuredClone(value);
```

## Secure Data Serialization in HTML

When embedding JSON in HTML, avoid raw injection:

Bad:

```html
<script>
  window.__DATA__ = JSON.parse("...");
</script>
```

Risky if not escaped correctly.

Prefer framework helpers or safe serialization that escapes HTML-significant characters.

Important characters/sequences to handle include:

- `<`
- `>`
- `&`
- `</script`
- U+2028
- U+2029

## Memory and Resource Exhaustion

- Limit request sizes.
- Limit response sizes.
- Limit concurrency.
- Limit expensive operations.
- Add timeouts.
- Add pagination.
- Add quotas.
- Avoid loading entire large files into memory.
- Stream where appropriate.
- Bound queues.
- Use backpressure.
- Protect regex, compression, image processing, PDF processing, and archive extraction.
- Avoid unbounded recursion.

## Image and Media Processing

- Treat media files as untrusted.
- Use maintained libraries.
- Keep codecs and processing libraries updated.
- Limit dimensions, duration, frame count, and file size.
- Re-encode images where feasible.
- Strip metadata where privacy matters.
- Avoid processing untrusted media in privileged processes.
- Consider sandboxing for high-risk formats.

## PDF and Document Handling

- Treat PDFs and office documents as active content.
- Avoid rendering untrusted documents inline unless needed.
- Serve as attachments where appropriate.
- Use separate origins for inline previews.
- Scan or sandbox high-risk document processing.
- Avoid trusting metadata.
- Limit conversion resources.

## Business Logic Security

- Never trust client-side prices, discounts, roles, quotas, balances, or ownership.
- Recompute sensitive business values server-side.
- Use transactions for financial or inventory updates.
- Use idempotency keys for retryable operations.
- Prevent race conditions.
- Enforce state transitions server-side.
- Ensure users cannot skip workflow steps by calling APIs directly.
- Protect invitation, approval, refund, cancellation, and role-change flows.
- Audit sensitive business actions.

## Race Conditions

- Use database transactions.
- Use unique constraints.
- Use optimistic locking or version checks.
- Use row-level locks where appropriate.
- Make operations idempotent.
- Avoid check-then-act without atomic enforcement.
- Protect one-time token use atomically.
- Protect inventory, quota, balance, and permission updates.

## Security Review Checklist

For code review, I would check:

- Are all inputs validated?
- Are all outputs encoded or sanitized for their context?
- Are authn/authz checks server-side?
- Are object-level permissions enforced?
- Is tenant isolation preserved?
- Are secrets kept out of code, logs, URLs, and client bundles?
- Are dangerous APIs avoided?
- Are database queries parameterized?
- Are redirects constrained?
- Are file paths contained?
- Are uploads constrained and safely served?
- Are requests rate-limited where abuse-prone?
- Are errors safe externally?
- Are logs useful but redacted?
- Are dependencies reasonable and current?
- Are tests covering failure and abuse cases?
- Does the code fail closed?
- Are security-sensitive assumptions documented?

## Common Vulnerability Patterns I Would Flag

- Client-only authorization.
- Missing tenant filter.
- Direct object access without ownership check.
- Raw HTML rendering.
- User-controlled redirect.
- SQL query string interpolation.
- Shell command string interpolation.
- Unsafe file path join.
- Unrestricted file upload.
- Storing tokens in `localStorage`.
- Missing CSRF protection for cookie-authenticated mutation.
- CORS reflection.
- Overly broad CSP or no CSP.
- Detailed auth errors.
- Logging credentials.
- Long-lived unrevocable tokens.
- Trusting webhook payloads without signature verification.
- Missing replay protection.
- Using `Math.random()` for tokens.
- Custom crypto.
- Unsafe deserialization.
- Unbounded request size.
- Unbounded pagination.
- Missing rate limits on auth endpoints.
- Exposing stack traces in production.
- Committing secrets.
- Debug mode in production.
- Admin endpoints with weak controls.
- User-controlled templates.
- Unsafe deep merge causing prototype pollution.
- Insecure dependency or abandoned package.

## Recommended Modern Browser/API Defaults

- Use `fetch` with explicit `credentials`, headers, status handling, and abort signals.
- Use `URL` and `URLSearchParams`.
- Use `crypto.randomUUID()` for random UUIDs.
- Use `crypto.getRandomValues()` for random bytes.
- Use `crypto.subtle` for browser cryptography when needed.
- Use `textContent` instead of `innerHTML`.
- Use `structuredClone()` for structured cloning.
- Use `Object.hasOwn()` for own-property checks.
- Use `Map` for arbitrary key dictionaries.
- Use `Set` for membership checks.
- Use `AbortController`.
- Use `FormData` for multipart form submissions.
- Use `input` attributes for UX validation, backed by server validation.
- Use `navigator.clipboard` only with user intent.
- Use `postMessage` with exact origin checks.
- Use `sandbox` on iframes with minimal capabilities.
- Use `rel="noopener noreferrer"` on external new-tab links.
- Use `Referrer-Policy`.
- Use `Permissions-Policy`.
- Use CSP with nonces/hashes where possible.
- Use feature detection for cutting-edge APIs.
- Use progressive enhancement for APIs with uneven support.

## Progressive Enhancement Guidance

For newer or unevenly supported web features:

- Feature-detect before use.
- Provide a fallback.
- Avoid making security depend solely on unsupported client features.
- Use server-side enforcement as the real control.
- Treat new browser security APIs as defense in depth unless support is universal enough for the target audience.

Examples:

```js
if ("randomUUID" in crypto) {
  id = crypto.randomUUID();
} else {
  id = fallbackUuidFromCryptoRandomValues();
}
```

```js
if ("trustedTypes" in window) {
  // Install Trusted Types policy.
}
```

```js
if ("URLPattern" in globalThis) {
  // Use URLPattern route matching.
} else {
  // Use existing router or parser.
}
```

## Clean Architecture Defaults for Secure Systems

- Put authentication state in a clear request context.
- Put authorization in named policies or guards.
- Keep raw request parsing at the edge.
- Convert raw input into validated command/query objects.
- Keep domain logic independent from transport details where practical.
- Keep database access behind functions that require tenant/user context.
- Avoid repositories that can accidentally query globally when tenant scoping is required.
- Use explicit serialization for API responses.
- Keep sensitive fields private by default.
- Use centralized error mapping.
- Use centralized logging redaction.
- Use config validation at startup.
- Keep security middleware order clear and tested.

## Example Secure Request Flow

A robust state-changing endpoint generally does this:

1. Require HTTPS.
2. Authenticate the caller.
3. Parse and validate request body.
4. Enforce CSRF if using cookie authentication.
5. Load the target resource scoped by tenant/user.
6. Authorize the specific action.
7. Enforce business invariants.
8. Perform mutation in a transaction if needed.
9. Emit audit/security event if sensitive.
10. Return an explicit safe response DTO.
11. Avoid leaking internal details on failure.

## Example Safe Mutation Shape

```ts
async function updateProjectName(request: RequestContext, rawInput: unknown) {
  const input = parseUpdateProjectNameInput(rawInput);

  const project = await projects.findByIdForTenant({
    projectId: input.projectId,
    tenantId: request.tenantId,
  });

  if (!project) {
    throw new NotFoundError();
  }

  if (!canUpdateProject(request.user, project)) {
    throw new NotFoundError();
  }

  const updated = await projects.updateName({
    projectId: project.id,
    name: input.name,
  });

  auditLog.record({
    actorId: request.user.id,
    action: "project.name_updated",
    resourceId: project.id,
  });

  return {
    id: updated.id,
    name: updated.name,
  };
}
```

## Things I Would Not Consider Project-Specific

The following are broad common knowledge and usually do not need to be repeated in a local project guide unless the project has a special nuance:

- Validate untrusted input.
- Escape output.
- Do not trust the client.
- Check authorization server-side.
- Use parameterized SQL.
- Avoid `eval`.
- Avoid raw `innerHTML`.
- Use HTTPS.
- Use secure cookies.
- Do not commit secrets.
- Do not log passwords or tokens.
- Use proven crypto libraries.
- Do not use `Math.random()` for tokens.
- Add rate limits to login/reset endpoints.
- Use CSRF protection with cookie-authenticated mutations.
- Validate webhook signatures.
- Do not expose stack traces in production.
- Keep dependencies updated.
- Use least privilege.
- Add tests for negative authorization cases.
- Use `URL` instead of string parsing URLs.
- Use `textContent` for untrusted text.
- Use `rel="noopener"` for new-tab links.
- Use CSP as defense in depth.
- Use `SameSite`, `Secure`, and `HttpOnly` cookies.
- Use server-side enforcement for business rules.
