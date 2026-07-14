---
name: privacy
description: Action-oriented guidelines for privacy by design, data minimization, third-party audits, and modern browser privacy APIs. Use this skill when dealing with user data, cookies, tracking, third-party scripts, or browser privacy APIs.
---

# Privacy

Web application architects and developers must treat privacy not as an compliance afterthought, but as a foundational architectural design requirement. Modern web platforms are shifting away from implicit tracking toward explicit, user-consented, browser-mediated identity and permission exchanges.

## 1. Privacy by Design and Data Minimization

Reducing the digital footprint to limit breach exposure and foster user trust.

### DOs:
- **DO** collect only adequate, relevant, and strictly necessary data for a stated purpose.
- **DO** use lower granularity ("fuzzing") where precise data is not required (e.g., age brackets vs. exact birthdates).
- **DO** offer guest checkouts to avoid forced account creation.
- **DO** explain *why* data is collected inline, using `aria-describedby` to link inputs to their explanations.
- **DO** use the `Clear-Site-Data` HTTP header upon logout to wipe client-side cookie caches and local storage.

### DON'Ts:
- **DON'T** collect data speculatively "just in case" it becomes useful.
- **DON'T** rely on dark patterns or pre-checked opt-ins to force consent.

### Code Examples:

#### Clear-Site-Data (HTTP)
Send this header on the page *after* logout confirmation.
```http
Clear-Site-Data: "cache", "cookies", "storage"
```

#### Inline Transparency (HTML)
```html
<div>
  <label for="email">Email address*</label>
  <input id="email" type="email" name="email" required aria-describedby="whyemail">
  <a href="#whyemail">Why do we need this?</a>
  
  <aside id="whyemail">
    We need this email to send password resets. We will not use it for marketing unless you opt-in.
  </aside>
</div>
```

## 2. Third-Party Audits and Mitigations

Limiting leakage introduced by external scripts, embeds, and tracking pixels.

### DOs:
- **DO** audit third parties technically using DevTools (Network panel) and HAR logs.
- **DO** use the **Façade Pattern (Lazy Loading)** to load static thumbnails first, only loading heavy widget iframes upon user click.
- **DO** replace third-party social buttons with static HTML sharing links (e.g., zero tracking SDKs).
- **DO** set strict HTTP Referrer policies (`strict-origin-when-cross-origin` or `no-referrer`) to prevent leaking sensitive URL query parameters.
- **DO** use rigid `Permissions-Policy` to lock down powerful APIs (geolocation, camera) globally or for subframes.
- **DO** use `Content-Security-Policy-Report-Only` for continuous automated audits of where third-party scripts are attempting to send data.

### DON'Ts:
- **DON'T** use default tracking SDKs if a static hyperlink suffices.

### Code Examples:

#### Referrer-Policy and Permissions-Policy (HTTP)
```http
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: accelerometer=(), camera=(), fullscreen=*
```

## 3. Cookie Deprecation and Partitioned Storage

Architecting for a web without unpartitioned third-party cookies.

### DOs:
- **DO** use **CHIPS (Cookies Having Independent Partitioned State)** by appending the `Partitioned` attribute for 1:1 embeds that do not share state across top-level sites.
- **DO** use the **Storage Access API (SAA)** when cross-site state sharing is functionally critical (such as SSO portals).
- **DO** trigger SAA permission requests (`requestStorageAccess()`) via direct user interaction (click/keypress).

### DON'Ts:
- **DON'T** rely on unpartitioned `SameSite=None` cookies as they are being systematically blocked by modern browser engines.

### Code Examples:

#### CHIPS `Set-Cookie` (HTTP)
```http
Set-Cookie: session_id=abc123; SameSite=None; Secure; Path=/; Partitioned; HttpOnly
```

#### Storage Access API (JavaScript)
```javascript
document.getElementById('login-btn').addEventListener('click', async () => {
  try {
    const hasAccess = await document.hasStorageAccess();
    if (!hasAccess) {
      await document.requestStorageAccess();
    }
    // Access granted: unpartitioned cookies are now attached to fetch()
  } catch (err) {
    console.error('Storage access denied', err);
  }
});
```

### Third-Party State Matrix

| Mechanism | Scope | Requires Interaction | Use Case |
| :--- | :--- | :--- | :--- |
| **CHIPS** | 1:1 Partitioned | No | Embeds (Maps, Widgets) |
| **Storage Access API (SAA)** | Cross-site | Yes | SSO Portals, Analytics |
| **FedCM** | Identity Federation | Yes | "Sign In with..." |

**Heuristic Rule**: Use CHIPS for isolated widgets (un-shared state), and SAA for shared identity state requiring explicit user consent.

## 4. Privacy-Preserving Identity (FedCM)

Moving from opaque navigational redirects to explicit native UI-mediated federation.

### DOs:
- **DO** use the **Federated Credential Management API (FedCM)** to mediate "Sign-In" flows natively, preventing IdP tracking of Relying Parties prior to user consent.
- **DO** verify the FedCM-returned un-falsifiable token on your backend.

### DON'Ts:
- **DON'T** bounce users through opaque redirect URL chains if FedCM can fulfill the use-case natively.

### Code Examples:

#### FedCM Sign-In (JavaScript)
```javascript
try {
  const credential = await navigator.credentials.get({
    identity: {
      providers: [{
        configURL: "https://idp.example/fedcm.json",
        clientId: "rp-client-id-123"
      }]
    }
  });
  authenticateWithBackend(credential.token);
} catch (error) {
  console.error("FedCM login failed", error);
}
```

## 5. Fingerprinting & User-Agent Reduction

Shifting from passive device broadcasting to explicit feature inspection.

### DOs:
- **DO** use **Feature Detection** (e.g., `'createImageBitmap' in window`) over User-Agent string parsing.
- **DO** use **User-Agent Client Hints (UA-CH)** if you must differentiate environments.
- **DO** explicitly request only the minimum required high-entropy hints using the `Accept-CH` header.
- **DO** use the `Vary` header (e.g., `Vary: Sec-CH-UA-Platform`) if your server caches vary based on UA-CH.

### DON'Ts:
- **DON'T** parse `navigator.userAgent` for non-critical logic.
- **DON'T** request a high volume of high-entropy hints simultaneously (interpretable as malicious fingerprinting).

### Code Examples:

#### Feature Detection vs Sniffing (JavaScript)
```javascript
// AVOID: if (navigator.userAgent.includes("Chrome")) ...
if ('createImageBitmap' in window) {
  // Use modern API
}
```

## 6. Contextual Request Defenses with Fetch Metadata

Using unforgeable headers to reject unauthorized cross-origin requests server-side.

### DOs:
- **DO** inspect `Sec-Fetch-Site`, `Sec-Fetch-Mode`, and `Sec-Fetch-Dest` headers before processing state-changing requests.
- **DO** implement a **Resource Isolation Policy** (middleware) to automatically reject cross-site calls not intended as simple navigations.

### DON'Ts:
- **DON'T** process state-changing requests if the origin relationship (`Sec-Fetch-Site`) is `cross-site` and the mode is not `navigate`.

### Code Examples:

#### Resource Isolation Middleware (Express / Node.js)
```javascript
app.use((req, res, next) => {
  const site = req.get('Sec-Fetch-Site');
  const mode = req.get('Sec-Fetch-Mode');

  if (!site) return next(); // Fallback for legacy browsers

  if (site === 'same-origin' || site === 'same-site') return next();

  // Allow standard outside user navigations (GET link clicks)
  if (site === 'cross-site' && mode === 'navigate' && req.method === 'GET') {
    return next();
  }

  res.status(403).json({ error: 'Cross-origin request forbidden' });
});
```

## 7. Fine-Grained Capability Control (Permissions API)

Querying capabilities before hitting users with automatic prompts.

### DOs:
- **DO** query `navigator.permissions.query()` before requesting access to powerful APIs (geolocation, camera).
- **DO** present polite explanations in UI explaining *why* the prompt exists before triggering the browser's native blocking prompt.

### DON'Ts:
- **DON'T** trigger browser native prompts automatically on page load without context.

### Code Examples:

#### Query Permission Status (JavaScript)
```javascript
navigator.permissions.query({ name: 'geolocation' }).then((result) => {
  if (result.state === 'granted') {
    loadMap();
  } else if (result.state === 'prompt') {
    showPolitePermissionExplanation(); // trigger requestStorageAccess upon button click
  }
});
```
