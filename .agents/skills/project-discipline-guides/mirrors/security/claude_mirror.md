# Security Best Practices: Common Knowledge Guide

## 1. Input Validation & Sanitization

### Core Principles
- **Never trust user input** — validate at every trust boundary (client, server, database)
- **Allowlist over denylist** — define what's permitted rather than blocking known-bad patterns
- **Validate type, length, format, and range** for every input
- **Canonicalize before validation** — decode URL encoding, normalize Unicode (NFC/NFKC), resolve paths
- **Reject, don't sanitize** when possible — sanitization is error-prone
- **Validate on the server** — client-side validation is a UX feature, not security

### Common Validation Patterns
```javascript
// Use built-in validators where available
URL.canParse(input)
Number.isInteger(value) && value >= 0 && value <= MAX
Number.isSafeInteger(value)

// Email validation: use type="email" + server validation
// Don't write your own regex — use a library

// Length limits on every string field
if (input.length > MAX_LENGTH) throw new Error('Too long')
```

### Path Traversal Prevention
```javascript
import path from 'node:path'

const safe = path.resolve(BASE_DIR, userInput)
if (!safe.startsWith(BASE_DIR + path.sep)) {
  throw new Error('Path traversal detected')
}
```

## 2. Output Encoding / XSS Prevention

### Context-Aware Encoding
- **HTML body context** — encode `&`, `<`, `>`, `"`, `'`, `/`
- **HTML attribute context** — quote attributes, encode `&`, `<`, `>`, `"`, `'`
- **JavaScript context** — use `JSON.stringify()`, never interpolate into JS
- **URL context** — use `encodeURIComponent()` for path/query components
- **CSS context** — only allow allowlisted property values

### Safe DOM APIs
```javascript
// SAFE — text nodes
element.textContent = userInput
element.innerText = userInput

// DANGEROUS — parses HTML
element.innerHTML = userInput  // XSS risk
element.outerHTML = userInput  // XSS risk
document.write(userInput)      // XSS risk
eval(userInput)                // never use
new Function(userInput)        // never use
setTimeout(userInput, 100)     // string form is eval

// SAFE attribute setting
element.setAttribute('data-x', value)  // safe for data attrs
element.href = url                      // validate scheme first

// Use the Sanitizer API or DOMPurify for HTML
element.setHTML(html)  // built-in sanitizer (newer browsers)
```

### Trusted Types (Chrome/Edge, polyfillable)
```javascript
// CSP: require-trusted-types-for 'script';
const policy = trustedTypes.createPolicy('default', {
  createHTML: (s) => DOMPurify.sanitize(s)
})
element.innerHTML = policy.createHTML(userInput)
```

## 3. Content Security Policy (CSP)

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random}' 'strict-dynamic';
  style-src 'self' 'nonce-{random}';
  img-src 'self' data: https:;
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
  upgrade-insecure-requests;
  require-trusted-types-for 'script';
```

- **Use nonces or hashes** instead of `'unsafe-inline'`
- **Avoid `'unsafe-eval'`** — refactor code that requires it
- **Use `'strict-dynamic'`** for modern apps with bundlers
- **Set `frame-ancestors 'none'`** to prevent clickjacking (replaces `X-Frame-Options`)
- **Report violations** with `report-to` / `report-uri` directives
- **Test in Report-Only mode** before enforcing

## 4. Authentication

### Password Storage
- **Never store plaintext** or reversibly encrypted passwords
- **Use Argon2id** (preferred), `scrypt`, or `bcrypt` — never MD5, SHA-1, SHA-256 alone
- **Per-password random salt** (≥16 bytes), automatically handled by these algorithms
- **Tune work factors** to take ~250-500ms on your hardware
- **Pepper** (server-side secret) optional for defense-in-depth

```javascript
import argon2 from 'argon2'
const hash = await argon2.hash(password, { type: argon2.argon2id })
const valid = await argon2.verify(hash, password)
```

### Password Policy
- **Minimum length 8-12 chars**, no maximum below 64
- **Allow all printable Unicode**, including spaces and emoji
- **Check against breach lists** (HIBP API with k-anonymity)
- **No forced periodic rotation** unless compromise suspected (NIST SP 800-63B)
- **No composition rules** (e.g., "must contain symbol") — they push users toward predictable patterns

### Session Management
- **Use server-issued session IDs**, not client-generated
- **128+ bits of entropy** from a CSPRNG
- **Regenerate session ID on login** (prevents fixation)
- **Invalidate on logout** server-side, not just clear the cookie
- **Idle timeout** (15-30 min for sensitive apps) and absolute timeout
- **Bind sessions to additional context** (IP family, user agent hash) carefully

### Multi-Factor Authentication
- **Prefer WebAuthn/passkeys** over TOTP over SMS
- **TOTP**: 30-second window, 6 digits, allow ±1 step skew
- **Backup codes**: hashed, single-use, generated client-blind
- **Avoid SMS** where possible (SIM-swap vulnerable)

### WebAuthn / Passkeys
```javascript
const credential = await navigator.credentials.create({
  publicKey: {
    challenge: serverChallenge,
    rp: { name: 'Example', id: 'example.com' },
    user: { id: userId, name: email, displayName: name },
    pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred'
    },
    timeout: 60_000,
    attestation: 'none'
  }
})
```

## 5. Authorization

- **Default deny** — every endpoint requires explicit allow
- **Centralize authorization checks**, don't sprinkle through views
- **Check on every request**, not just on initial navigation
- **Verify object ownership** (IDOR prevention) — `WHERE owner_id = $current_user`
- **Re-check on sensitive operations**, even if recently authenticated
- **Use opaque IDs** (UUIDs) over enumerable integers where appropriate
- **Principle of least privilege** for service accounts and DB users
- **Separate authentication from authorization** logic

## 6. Cookies

```http
Set-Cookie: session=abc123;
  Secure;           # HTTPS only
  HttpOnly;         # No JS access
  SameSite=Lax;     # CSRF protection (Strict for sensitive)
  Path=/;
  Max-Age=3600;
  Domain=example.com;  # omit for host-only (more secure)
```

- **`__Host-` prefix** — requires `Secure`, `Path=/`, no `Domain`
- **`__Secure-` prefix** — requires `Secure`
- **`SameSite=Strict`** for auth cookies; `Lax` is the modern default
- **`SameSite=None`** requires `Secure`
- **Avoid storing tokens in `localStorage`** — accessible to any XSS
- **Partitioned cookies (CHIPS)** for third-party contexts

## 7. CSRF Protection

- **SameSite cookies** are first line of defense
- **Synchronizer token pattern** — server-generated, per-session token in form/header
- **Double-submit cookie pattern** — token in cookie + matching header
- **Origin/Referer header validation** for state-changing requests
- **Require POST for state changes** — never use GET to mutate state
- **Custom request headers** (e.g., `X-Requested-With`) for AJAX — triggers CORS preflight

## 8. CORS

```javascript
// Server response
Access-Control-Allow-Origin: https://trusted.example.com  // not '*' with credentials
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
Vary: Origin
```

- **Never use `*` with credentials**
- **Allowlist origins explicitly** — don't reflect the `Origin` header without validation
- **Set `Vary: Origin`** when reflecting origins
- **Preflight (OPTIONS)** required for non-simple requests
- **Don't rely on CORS for security** — it's a browser policy, not server enforcement

## 9. SQL Injection Prevention

```javascript
// SAFE — parameterized queries
db.query('SELECT * FROM users WHERE id = ?', [userId])
db.query('SELECT * FROM users WHERE email = $1', [email])

// DANGEROUS — string concatenation
db.query(`SELECT * FROM users WHERE id = ${userId}`)
db.query(`SELECT * FROM users WHERE email = '${email}'`)
```

- **Always use prepared statements / parameterized queries**
- **ORMs help** but raw queries within them still need parameters
- **Validate and allowlist** when interpolation is unavoidable (table/column names)
- **Use stored procedures** with parameters where appropriate
- **Least-privilege DB accounts** — separate read/write users
- **Escape LIKE wildcards** (`%`, `_`) in user input when used in LIKE patterns

## 10. Command Injection Prevention

```javascript
import { execFile } from 'node:child_process'

// SAFE — argument array, no shell
execFile('git', ['log', '--oneline', branch], callback)

// DANGEROUS
exec(`git log ${branch}`)        // shell interpretation
exec(`ls ${userPath}`)           // injection via ;, &&, |, $()
```

- **Never invoke a shell** with user input
- **Use `execFile`/`spawn` with argument arrays**, not `exec` or `system`
- **Allowlist commands and arguments**
- **Validate file paths** against expected patterns

## 11. Cryptography

### General Rules
- **Don't roll your own crypto** — use vetted libraries
- **Use high-level APIs** (libsodium, `WebCrypto`) over primitives
- **Key derivation** with HKDF or PBKDF2/Argon2 for passwords
- **Constant-time comparison** for secrets (`crypto.timingSafeEqual`)
- **Authenticated encryption** (AES-GCM, ChaCha20-Poly1305) — never raw AES-CBC
- **Random IV/nonce per encryption**, never reuse
- **CSPRNG only** — `crypto.randomBytes`, `crypto.getRandomValues`, never `Math.random`

### WebCrypto Examples
```javascript
// Random bytes
const bytes = crypto.getRandomValues(new Uint8Array(32))

// UUID v4
const id = crypto.randomUUID()

// SHA-256 hash
const digest = await crypto.subtle.digest('SHA-256', data)

// AES-GCM encrypt
const key = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  true,
  ['encrypt', 'decrypt']
)
const iv = crypto.getRandomValues(new Uint8Array(12))
const ciphertext = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  plaintext
)
```

### Algorithm Choices (current)
- **Symmetric**: AES-256-GCM, ChaCha20-Poly1305
- **Asymmetric**: Ed25519 (signatures), X25519 (key exchange), RSA-OAEP-SHA256 (≥2048-bit, prefer 3072+)
- **Hashing**: SHA-256, SHA-384, SHA-512, BLAKE2/3
- **Password hashing**: Argon2id, scrypt, bcrypt
- **MAC**: HMAC-SHA256+
- **Avoid**: MD5, SHA-1, DES, 3DES, RC4, ECB mode, RSA-PKCS1v1.5

## 12. TLS / HTTPS

- **HTTPS everywhere** — including internal services
- **HSTS** with long max-age and `includeSubDomains; preload`
- **TLS 1.2 minimum**, prefer TLS 1.3
- **Disable old protocols** (SSLv3, TLS 1.0/1.1)
- **Strong cipher suites only** — forward secrecy required
- **Validate certificates** in clients, including hostname
- **Certificate transparency** monitoring
- **OCSP stapling** for performance
- **Use Let's Encrypt or managed certs** with auto-renewal

```http
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

## 13. Security Headers

```http
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: ...
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
Cache-Control: no-store  # for sensitive responses
```

- **`X-Frame-Options`** is superseded by CSP `frame-ancestors`
- **`X-XSS-Protection`** is deprecated — rely on CSP
- **COOP/COEP/CORP** enable cross-origin isolation (required for SharedArrayBuffer)

## 14. JWT / Token Handling

- **Short-lived access tokens** (5-15 min); separate refresh tokens
- **Validate signature, issuer, audience, expiration, not-before**
- **Use asymmetric (RS256/EdDSA)** for distributed verification
- **Reject `alg: none`** explicitly
- **Don't store sensitive data** in JWT payload — it's only base64
- **Store securely** — `HttpOnly` cookies for browser apps; avoid `localStorage`
- **Implement revocation** via short TTLs + denylist or stateful sessions
- **Rotate signing keys** with `kid` header
- **Prefer opaque session tokens** for first-party browser apps

## 15. Secrets Management

- **Never commit secrets** to source control
- **Use environment variables** or a secrets manager (Vault, AWS Secrets Manager)
- **`.env` files** in `.gitignore`, with `.env.example` template
- **Pre-commit hooks** to scan for secrets (gitleaks, trufflehog)
- **Rotate compromised secrets immediately** and audit usage
- **Different secrets per environment** (dev/staging/prod)
- **Limit secret access** with IAM/RBAC
- **Audit secret access** logs

## 16. Logging & Monitoring

### What to Log
- Authentication events (success and failure)
- Authorization failures
- Input validation failures
- Session lifecycle (create, destroy, timeout)
- Privilege changes
- Data access for sensitive resources
- System errors and exceptions

### What NOT to Log
- Passwords, API keys, tokens, session IDs
- Full credit card numbers, SSNs, PII (mask appropriately)
- Encryption keys
- Personal health information

### Log Hygiene
- **Structured logging** (JSON) for parsing
- **Sanitize log inputs** — prevent log injection / forging
- **Centralized log aggregation** with retention policies
- **Alerting on anomalies** (auth failure spikes, unusual access patterns)
- **Tamper-evident logs** for security-relevant events

## 17. Error Handling

- **Generic error messages to users** — "Invalid credentials," not "User not found"
- **Detailed errors to logs**, with correlation IDs
- **Don't leak stack traces** in production responses
- **Don't expose internal paths, versions, framework names**
- **Fail closed/secure** — default to denying access on error
- **Consistent timing** for sensitive comparisons (login, token check)

## 18. Rate Limiting & Abuse Prevention

- **Rate limit by IP, account, and endpoint**
- **Stricter limits on auth endpoints** (login, signup, password reset)
- **Account lockout with care** — DoS risk; prefer exponential backoff or CAPTCHA
- **CAPTCHA** for high-value or repeated suspicious actions
- **Bot detection** for scraping, credential stuffing
- **Distributed rate limiting** for horizontally scaled services

## 19. Dependency Management

- **Pin dependency versions** with lockfiles (`package-lock.json`, `pnpm-lock.yaml`)
- **Automated vulnerability scanning** (`npm audit`, Dependabot, Snyk)
- **Update regularly** — patch security vulnerabilities promptly
- **Minimize dependencies** — each one is attack surface
- **Verify package integrity** with subresource integrity (SRI) for CDNs
- **Audit transitive dependencies**, not just direct ones
- **Avoid abandoned packages** — check last update, maintainers

```html
<script src="https://cdn.example.com/lib.js"
        integrity="sha384-..."
        crossorigin="anonymous"></script>
```

## 20. File Upload Security

- **Validate file type** by magic bytes, not extension or `Content-Type`
- **Limit file size** at server and proxy levels
- **Scan uploads** for malware
- **Store outside web root** or in object storage
- **Generate new filenames** — never trust user-provided names
- **Set restrictive `Content-Type`** and `Content-Disposition: attachment` for downloads
- **Serve from a separate, cookieless domain** to limit cookie theft via XSS
- **Strip metadata** (EXIF) from images if privacy-sensitive
- **Avoid serving uploads as HTML/SVG** which can contain scripts

## 21. SSRF (Server-Side Request Forgery)

- **Allowlist outbound destinations** when fetching user-supplied URLs
- **Block private IP ranges** (RFC1918, link-local, loopback, IMDS endpoints like 169.254.169.254)
- **Resolve DNS once and pin** — defeat DNS rebinding
- **Disable redirects** or validate each hop
- **Use a forward proxy** with policy enforcement
- **Run with limited network access** (egress firewall rules)

## 22. Deserialization

- **Don't deserialize untrusted data** with formats that allow code execution (Python `pickle`, Java `ObjectInputStream`, PHP `unserialize`, Node `vm`)
- **Use safe formats** (JSON, MessagePack, Protobuf) with schema validation
- **Validate after parsing** — JSON.parse won't validate structure
- **Use schema validators** (Zod, Ajv, Joi)

## 23. XML / XXE

- **Disable external entities** (`DOCTYPE`, `ENTITY`) in XML parsers
- **Disable DTD processing** entirely if possible
- **Prefer JSON** when format is your choice
- **Validate against schema** when XML is required

## 24. Open Redirects

```javascript
// SAFE — validate against allowlist
const ALLOWED = ['/dashboard', '/profile', '/settings']
if (!ALLOWED.includes(target)) target = '/dashboard'

// SAFE — same-origin only
const url = new URL(target, location.origin)
if (url.origin !== location.origin) target = '/'
```

- **Validate redirect targets** against an allowlist
- **Use relative paths** when possible
- **Reject protocol-relative URLs** (`//evil.com`)

## 25. Clickjacking

- **`Content-Security-Policy: frame-ancestors 'none'`** (or specific origins)
- **Frame-busting JavaScript** as backup (limited reliability)
- **Sensitive UI** (payments, settings) should not be embeddable

## 26. Same-Origin Policy & Window Communication

```javascript
// Open links safely
<a href="..." target="_blank" rel="noopener noreferrer">

// postMessage — always check origin
window.addEventListener('message', (e) => {
  if (e.origin !== 'https://trusted.example.com') return
  // ... handle message
})

// Send to specific origin, not '*'
target.postMessage(data, 'https://trusted.example.com')
```

- **`rel="noopener"`** prevents `window.opener` access (default since 2021 for `_blank`)
- **`rel="noreferrer"`** also strips Referer
- **Validate `event.origin`** in postMessage handlers
- **Never use `*`** as targetOrigin with sensitive data

## 27. iframe Sandboxing

```html
<iframe sandbox="allow-scripts allow-same-origin"
        src="..."
        loading="lazy"
        referrerpolicy="no-referrer"></iframe>
```

- **Empty `sandbox`** is most restrictive
- **Don't combine `allow-scripts` and `allow-same-origin`** for untrusted content (escapes sandbox)
- **Use `allow` attribute** to restrict Permissions Policy features

## 28. Modern JavaScript Security Practices

```javascript
'use strict'  // implicit in modules

// Object freezing for constants
const CONFIG = Object.freeze({ apiUrl: '...' })

// Avoid prototype pollution
const obj = Object.create(null)        // no prototype
const safe = { __proto__: null }        // same effect
Object.hasOwn(obj, key)                // safer than `in` or `hasOwnProperty`

// Use `Map` over plain object for user-keyed data
const userMap = new Map()

// Structured clone for deep copy
const copy = structuredClone(original)

// AbortController for cancellation
const controller = new AbortController()
fetch(url, { signal: controller.signal })
```

### Prototype Pollution Prevention
- **Avoid recursive merge** of untrusted objects into existing objects
- **Reject `__proto__`, `constructor`, `prototype`** keys when parsing
- **Use `Object.create(null)`** for lookup tables
- **Use `Map`** for dynamic key-value storage

## 29. Browser Storage Choices

| Storage | Persistence | XSS Accessible | Use For |
|---------|-------------|----------------|---------|
| `HttpOnly` cookie | Per-cookie expiry | No | Session tokens |
| `localStorage` | Until cleared | Yes | Non-sensitive UI state |
| `sessionStorage` | Tab session | Yes | Per-tab UI state |
| IndexedDB | Until cleared | Yes | Large structured data |
| `Cache` API | Until cleared | Yes | Service worker caches |

- **Don't store secrets in any client-side storage** accessible to JavaScript
- **Encrypt at rest** if sensitive data must be cached client-side (with caveats — keys are also exposed)

## 30. Service Workers & PWA

- **HTTPS required** (except localhost)
- **Scope is path-based** — narrow scope to limit risk
- **Validate cached responses** before returning
- **Cache busting strategy** for security updates
- **Be cautious with `fetch` interception** — full request control

## 31. PII & Privacy

- **Data minimization** — collect only what you need
- **Encrypt at rest and in transit**
- **Right to deletion** — design for it (GDPR, CCPA)
- **Consent for tracking** (cookies, analytics)
- **Privacy by default** — opt-in, not opt-out
- **Pseudonymization** where possible
- **Data residency** considerations
- **Privacy policy** must reflect actual practice

## 32. Subresource Integrity & Supply Chain

```html
<script src="https://cdn.example.com/lib.js"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
        crossorigin="anonymous"></script>
```

- **SRI for all third-party scripts/styles**
- **Self-host critical dependencies** when possible
- **Lock files committed** for reproducibility
- **Verify package signatures** where supported
- **Audit npm install scripts** — disable with `--ignore-scripts` where feasible

## 33. Security Testing

- **Static analysis (SAST)** in CI (ESLint security rules, Semgrep, CodeQL)
- **Dependency scanning (SCA)** (Dependabot, Snyk, npm audit)
- **Dynamic analysis (DAST)** (OWASP ZAP, Burp Suite)
- **Secret scanning** (gitleaks, trufflehog)
- **Penetration testing** for critical applications
- **Threat modeling** during design (STRIDE)
- **Security code review** for sensitive changes
- **Bug bounty / responsible disclosure** program

## 34. Incident Response

- **Documented response plan** with roles and contacts
- **Audit logs** retained per compliance needs
- **Backup and recovery** tested regularly
- **Tabletop exercises** for common scenarios
- **Post-mortem** for every incident, blameless

## 35. Common Code Quality Principles

- **Single responsibility** — functions/modules do one thing
- **Pure functions** when possible — easier to reason about and test
- **Immutability** by default (`const`, `Object.freeze`, persistent data structures)
- **Fail fast** — assert preconditions, throw on invalid state
- **Make invalid states unrepresentable** through types
- **Separation of concerns** — keep business logic out of presentation
- **DRY, but only for true duplication** — avoid premature abstraction
- **YAGNI** — don't add what you don't need
- **Composition over inheritance**
- **Dependency injection** for testability
- **Clear naming** over comments
- **Small functions** with single levels of abstraction
- **Avoid global mutable state**

## 36. Modern Browser APIs Worth Knowing (Security-Adjacent)

- **`crypto.subtle`** — WebCrypto for hashing, encryption, signing
- **`crypto.randomUUID()`** — RFC 4122 v4 UUIDs
- **`crypto.getRandomValues()`** — CSPRNG random bytes
- **`URL` / `URLPattern`** — safe parsing/matching
- **`Sanitizer` / `Element.setHTML()`** — built-in HTML sanitization
- **`Trusted Types`** — sink protection
- **`Permissions API`** — query/request permissions
- **`Credential Management API`** — passkeys, federated auth
- **`Web Authentication API`** — WebAuthn
- **`Storage Access API`** — third-party cookie access
- **`Reporting API`** — CSP/COEP/deprecation reports
- **`AbortController`** — cancellation for fetch and other async ops
- **`structuredClone()`** — safe deep cloning

## 37. HTTP Methods & Idempotency

- **GET** — safe, idempotent, no side effects, cacheable
- **HEAD/OPTIONS** — safe, idempotent
- **PUT/DELETE** — idempotent, can have side effects
- **POST/PATCH** — non-idempotent
- **Never mutate state via GET** — CSRF, prefetching, caching, logging risks
- **Idempotency keys** for retry-safe POSTs

## 38. Defense in Depth

- **Layered controls** — assume each layer can fail
- **Network segmentation** — separate trust zones
- **Least privilege** at every layer (users, services, processes)
- **Sandboxing** — containers, VMs, browser sandboxes
- **WAF** as an additional layer, not primary defense
- **Monitoring and alerting** to detect bypasses

## 39. Secure Defaults

- **Secure by default** — opt out of security, never opt in
- **Deny by default** for permissions and access
- **Minimum permissions** for service accounts, OAuth scopes
- **Disable unused features**, ports, services
- **Latest stable versions** of runtimes and frameworks
- **HTTPS by default**, HTTP redirects to HTTPS

## 40. OWASP Top 10 Awareness (Current)

1. **Broken Access Control**
2. **Cryptographic Failures**
3. **Injection**
4. **Insecure Design**
5. **Security Misconfiguration**
6. **Vulnerable and Outdated Components**
7. **Identification and Authentication Failures**
8. **Software and Data Integrity Failures**
9. **Security Logging and Monitoring Failures**
10. **Server-Side Request Forgery (SSRF)**

Familiarity with the Top 10 (and CWE Top 25) is baseline knowledge for security review.
