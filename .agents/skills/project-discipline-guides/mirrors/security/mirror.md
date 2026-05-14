# Unified Lowest Common Denominator (LCD) Security Mirror

This mirror represents the intersection of standard security practices consistently recognized across multiple technical baselines. It contains only the best practices, APIs, and guidelines explicitly present in all source documentation.

---

### 1. Transport & Connection Security

*   **HTTPS Everywhere:** All application traffic must be served over HTTPS, including internal service communication.
*   **HTTP to HTTPS Redirection:** Redirect all port 80 traffic to 443 at the server level.
*   **Strict-Transport-Security (HSTS):** Use the HSTS header to enforce HTTPS.
    *   *Minimum Requirement:* `Strict-Transport-Security: max-age=31536000; includeSubDomains`
*   **TLS Configuration:** Disable deprecated protocols (SSLv3, TLS 1.0, TLS 1.1). Support and prefer TLS 1.2 or TLS 1.3.

---

### 2. Browser Security Headers

*   **Content Security Policy (CSP):** Implement CSP to mitigate XSS and injection.
    *   **Default Policy:** Use the `default-src` directive.
    *   **Script Safety:** Use nonces or hashes for scripts; avoid `'unsafe-inline'` and `'unsafe-eval'`.
    *   **Frame Control:** Use the `frame-ancestors` directive to prevent clickjacking.
*   **X-Content-Type-Options:** Prevent MIME-sniffing.
    *   *Syntax:* `X-Content-Type-Options: nosniff`
*   **Referrer-Policy:** Restrict referrer information sent to other origins.
    *   *Syntax:* `Referrer-Policy: strict-origin-when-cross-origin`
*   **Permissions-Policy:** Restrict access to browser features.
    *   *Requirement:* Disable `camera`, `microphone`, and `geolocation` by default.
*   **X-Frame-Options:** (Legacy) Use for older browser compatibility to prevent clickjacking.
    *   *Values:* `DENY` or `SAMEORIGIN`
*   **Isolation Headers:** Implement cross-origin isolation.
    *   *COOP:* `Cross-Origin-Opener-Policy: same-origin`
    *   *COEP:* `Cross-Origin-Embedder-Policy: require-corp`

---

### 3. Injection Prevention

*   **Cross-Site Scripting (XSS):**
    *   **Safe DOM APIs:** Prefer `textContent` over `innerHTML` or `outerHTML`.
    *   **Encoding:** Use context-aware encoding for data placed in HTML, attributes, or JavaScript.
    *   **Trusted Types API:** Use policies to govern string sinks like `innerHTML`.
    *   **Sanitizer API:** Use the native `Sanitizer` object for safe HTML parsing where available.
*   **SQL Injection:**
    *   **Parameterized Queries:** Always use prepared statements or parameterized queries; never concatenate strings to build queries.
    *   **ORM Usage:** Ensure ORMs are configured to use prepared statements for all database operations.
*   **Command Injection:**
    *   **Avoid Shell Invocation:** Do not use functions that execute strings in a shell (e.g., `child_process.exec`).
    *   **Safe Execution:** Use `spawn` or `execFile` where arguments are passed as an array, bypassing shell interpretation.

---

### 4. Authentication & Session Management

*   **Password Security:**
    *   **Hashing:** Use slow, salted hashing algorithms: **Argon2**, **bcrypt**, or **scrypt**.
    *   **Salting:** Use unique, cryptographically strong salts for every password.
    *   **Work Factor:** Tune hashing parameters/iterations based on hardware to mitigate brute force.
*   **Cookie Security:**
    *   **Attributes:** Always set `HttpOnly`, `Secure`, and `SameSite` (Lax or Strict).
    *   **Prefixes:** Use `__Host-` or `__Secure-` prefixes for session cookies.
*   **JSON Web Tokens (JWT):**
    *   **Algorithm Safety:** Reject `alg: "none"` or unsigned tokens. Prefer asymmetric signing.
    *   **Validation:** Always validate `exp` (expiration), `iat` (issued at), and `iss` (issuer) claims.
    *   **Storage:** Avoid storing sensitive tokens in `localStorage`; prefer `HttpOnly` cookies.
*   **Multi-Factor Authentication:** Support phishing-resistant authentication via the **WebAuthn** API / Passkeys.

---

### 5. CSRF & CORS Protection

*   **CSRF Mitigation:**
    *   **SameSite:** Use `SameSite=Lax` or `Strict` as the primary defense.
    *   **Anti-CSRF Tokens:** Use unique, server-validated tokens for state-changing requests (POST, PUT, DELETE).
    *   **Custom Headers:** Use custom headers for AJAX requests to trigger CORS preflight.
*   **CORS Configuration:**
    *   **Explicit Whitelisting:** Whitelist trusted origins explicitly; avoid `Access-Control-Allow-Origin: *`.
    *   **Credentials:** Never use `*` when `Access-Control-Allow-Credentials` is set to `true`.

---

### 6. Client-Side Cryptography

*   **Web Crypto API:** Use `window.crypto.subtle` for cryptographic operations (encrypt, sign, digest).
*   **Randomness:** Use `crypto.getRandomValues()` for all cryptographically strong random data.

---

### 7. Dependency & Supply Chain Security

*   **Lockfiles:** Always commit lockfiles to ensure deterministic and reproducible builds.
*   **Auditing:** Perform regular automated vulnerability scans (e.g., `npm audit`).
*   **Minimalism:** Minimize the number of dependencies and audit small helper packages.
*   **Subresource Integrity (SRI):** Use the `integrity` attribute when loading scripts or styles from CDNs.

---

### 8. Data Privacy & Error Handling

*   **Encryption:** Implement encryption at rest for sensitive data and encryption in transit for all communications.
*   **Logging:** Never log secrets, passwords, session IDs, or personally identifiable information (PII).
*   **Error Handling:**
    *   **Generic Messages:** Provide generic error messages to end-users.
    *   **Stack Traces:** Ensure detailed stack traces and internal system details are never exposed in production responses.
