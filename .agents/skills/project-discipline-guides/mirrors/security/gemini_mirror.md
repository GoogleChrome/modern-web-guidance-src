# Comprehensive Web Security Redundancy Mirror

This guide outlines the standard security best practices, syntax, and APIs for modern web development. It represents the "Common Knowledge" baseline for security implementations in frontend and backend (Node.js) environments.

---

## 1. Transport & Connection Security

### HTTPS and HSTS
*   **Mandatory Encryption:** All traffic must be served over HTTPS.
*   **Strict-Transport-Security (HSTS):** Use the `Strict-Transport-Security` header to force browsers to use HTTPS for all future requests.
    *   *Syntax:* `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
*   **TLS Configuration:** Disable deprecated protocols (SSLv2, SSLv3, TLS 1.0, TLS 1.1). Prefer TLS 1.3 or high-security TLS 1.2 ciphers.

### Secure Redirects
*   **HTTP to HTTPS:** Redirect all port 80 traffic to 443 at the server level (Nginx/Apache/Cloudflare) before the application logic.

---

## 2. Browser Security Headers

### Content Security Policy (CSP)
CSP is a primary defense against XSS and data injection.
*   **Default Deny:** Start with `default-src 'none';`.
*   **Script Safety:** Use `script-src 'self'` or nonces/hashes for inline scripts. Avoid `'unsafe-inline'` and `'unsafe-eval'`.
*   **Connect Source:** Limit `connect-src` to trusted API endpoints.
*   **Frame Control:** Use `frame-ancestors 'self'` to prevent Clickjacking.

### Other Essential Headers
*   **X-Content-Type-Options:** Prevent MIME-sniffing.
    *   *Syntax:* `X-Content-Type-Options: nosniff`
*   **X-Frame-Options:** (Legacy) Prevent Clickjacking if CSP `frame-ancestors` isn't used.
    *   *Syntax:* `X-Frame-Options: DENY` or `SAMEORIGIN`
*   **Referrer-Policy:** Control how much referrer information is sent.
    *   *Syntax:* `Referrer-Policy: strict-origin-when-cross-origin`
*   **Permissions-Policy:** Restrict browser features like camera, microphone, or geolocation.
    *   *Syntax:* `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`

---

## 3. Injection Prevention

### Cross-Site Scripting (XSS)
*   **Data Binding:** Prefer `textContent` over `innerHTML` or `outerHTML`.
*   **Context-Aware Encoding:** Encode data based on where it is placed (HTML body, attribute, JavaScript variable, CSS).
*   **Trusted Types API (Modern):** Enforce policies that require strings to be sanitized before being passed to "sink" APIs like `innerHTML`.
    *   *Example:* `window.trustedTypes.createPolicy(...)`
*   **Sanitizer API (Cutting Edge):** Use the native `Sanitizer` object for safe HTML parsing.
    *   *Example:* `const clean = new Sanitizer().sanitizeFor('div', dirtyHTML);`

### SQL Injection
*   **Parameterized Queries:** Never concatenate strings to build queries. Use placeholders.
    *   *Example (Node.js/pg):* `db.query('SELECT * FROM users WHERE id = $1', [userId])`
*   **ORM Usage:** Use reputable ORMs (Sequelize, TypeORM, Prisma) but verify they use prepared statements for all operations.

### OS Command Injection
*   **Avoid Shell Execution:** Do not use `eval()`, `new Function()`, or `child_process.exec(untrustedInput)`.
*   **Safe Alternatives:** Use `child_process.execFile` or `child_process.spawn` where arguments are passed as an array, bypassing the shell.

---

## 4. Authentication & Session Management

### Password Security
*   **Hashing:** Never store passwords in plain text or using unsalted MD5/SHA1. Use **Argon2** (preferred), **bcrypt**, or **scrypt**.
*   **Salting:** Use unique, cryptographically strong salts for every password.
*   **Work Factor:** Adjust the cost factor/iterations to ensure hashing takes ~100-500ms to mitigate brute force.

### Cookie Security
*   **HttpOnly:** Prevent client-side scripts from accessing cookies.
*   **Secure:** Ensure cookies are only sent over HTTPS.
*   **SameSite:** Prevent CSRF by restricting cross-site cookie transmission.
    *   `SameSite=Lax`: Default, safe for most cases.
    *   `SameSite=Strict`: Most secure, only sent for first-party requests.
*   **Prefixes:** Use `__Host-` or `__Secure-` prefixes for extra browser-level protection.

### JSON Web Tokens (JWT)
*   **Algorithm:** Prefer asymmetric signing (RS256, ES256) over symmetric (HS256). **Never** accept `alg: "none"`.
*   **Validation:** Always validate `exp` (expiration), `iat` (issued at), and `iss` (issuer).
*   **Storage:** Avoid storing sensitive JWTs in `localStorage`. Prefer HttpOnly, Secure cookies.

### Modern Auth (Passkeys/WebAuthn)
*   **WebAuthn API:** Support hardware-backed, phishing-resistant authentication using `navigator.credentials.create` and `navigator.credentials.get`.

---

## 5. Cross-Site Request Forgery (CSRF) protection

*   **SameSite Cookies:** Use `SameSite=Lax` or `Strict` as the first line of defense.
*   **Anti-CSRF Tokens:** For state-changing requests (POST, PUT, DELETE), use a unique, unpredictable token validated on the server.
*   **Double Submit Cookie:** For stateless architectures, compare a value in a cookie with a value in the request header.
*   **Custom Headers:** Requests with custom headers (e.g., `X-Requested-With`) trigger CORS preflight, providing implicit protection for APIs.

---

## 6. Client-Side Cryptography

### Web Crypto API (`window.crypto.subtle`)
*   Use for high-performance, secure cryptographic operations in the browser.
*   **Operations:** `encrypt`, `decrypt`, `sign`, `verify`, `digest`, `generateKey`.
*   **Best Practice:** Always use cryptographically strong random values via `crypto.getRandomValues()`.

---

## 7. Dependency & Supply Chain Security

*   **Auditing:** Run `npm audit` or `yarn audit` regularly.
*   **Lockfiles:** Always commit `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml` to ensure deterministic builds.
*   **Minimalism:** Minimize the number of dependencies. Audit small "helper" packages for maintenance and security history.
*   **Automated Updates:** Use tools like Dependabot or Renovate to stay current with security patches.

---

## 8. Data Privacy & Handling

*   **Encryption at Rest:** Encrypt sensitive data (PII, credentials) in the database.
*   **Encryption in Transit:** Ensure all internal service communication uses TLS.
*   **Logging:** Never log PII, passwords, or secrets. Implement log masking/filtering.
*   **Error Messages:** Provide generic error messages to users. Detailed stack traces should only be available in internal logs.

---

## 9. Cross-Origin Resource Sharing (CORS)

*   **Strict Origin Check:** Avoid `Access-Control-Allow-Origin: *`. Explicitly whitelist trusted origins.
*   **Credential Control:** Only set `Access-Control-Allow-Credentials: true` if absolutely necessary and when the origin is not `*`.
*   **Methods & Headers:** Explicitly whitelist permitted `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers`.

---

## 10. Modern Browser Isolation (Cutting Edge)

*   **Cross-Origin-Opener-Policy (COOP):** Isolate your window from cross-origin documents.
    *   *Syntax:* `Cross-Origin-Opener-Policy: same-origin`
*   **Cross-Origin-Embedder-Policy (COEP):** Prevent loading cross-origin resources that don't explicitly allow it.
    *   *Syntax:* `Cross-Origin-Embedder-Policy: require-corp`
*   **Subresource Integrity (SRI):** Use the `integrity` attribute on `<script>` and `<link>` tags to ensure external files haven't been tampered with.
    *   *Example:* `<script src="..." integrity="sha384-..." crossorigin="anonymous"></script>`
