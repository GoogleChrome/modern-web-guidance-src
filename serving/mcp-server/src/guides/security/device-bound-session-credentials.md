---
description: Protect web applications against session hijacking by integrating Device Bound Session Credentials (DBSC) to bind sessions to specific devices.
filename: device-bound-session-credentials
category: security
---

# Device Bound Session Credentials (DBSC)

Device Bound Session Credentials (DBSC) strengthen authentication by adding
hardware-backed session security.

## Best Practices

To integrate DBSC into your application, you need to make the following
changes:

-   Modify your login flow to include a `Secure-Session-Registration` header.
-   Add a session registration endpoint that:
    -   Associates a public key with the user's session.
    -   Serves session configuration.
    -   Transitions to short-lived cookies.
-   Add a refresh endpoint to handle cookie renewal and key possession
    validation.

Most of your existing endpoints don't require any changes. DBSC is designed to
be additive and non-disruptive.

When a required short-lived cookie is missing or expired, Chrome pauses the
request and tries to refresh the cookie. This lets your app keep using its usual
session cookie checks to confirm the user is signed in. Since this matches
typical authentication flows, DBSC works with minimal changes to your login
logic.

The implementation steps follow the common flow a signed-in user would
experience when DBSC is active: registration at login, followed by regular
short-lived cookie refreshes. You can test and implement each step
independently, depending on your app's level of session sensitivity.

### 1. Modify login flow

After the user logs in, respond with a long-lived cookie and a
`Secure-Session-Registration` header. For example:

The following HTTP response header is returned after successful session
registration:

```http
HTTP/1.1 200 OK
Secure-Session-Registration: (ES256 RS256); path="/StartSession"
Set-Cookie: auth_cookie=session_id; max-age=2592000; Domain=example.com; Secure; SameSite=Lax
```

If the device supports secure key storage, Chrome contacts the `/StartSession`
endpoint with a public key in a JSON Web Token (JWT).

The `auth_cookie` in this example represents your session token. You can name
this cookie whatever you like, as long as it matches the `name` field in your
session configuration and is used consistently throughout your application.

### 2. Implement the session registration endpoint

At `/StartSession`, your server should:

-   Associate the received public key with the user's session.
-   Respond with a session configuration.
-   Replace the long-lived cookie with a short-lived one.

In the following example, the short-lived cookie is configured to expire after
10 minutes:

```http
HTTP/1.1 200 OK
Set-Cookie: auth_cookie=short_lived_grant; Max-Age=600; # Expires after 10 minutes Set-Cookie: Domain=example.com; Secure; SameSite=Lax

{
  "session_identifier": "session_id",
  "refresh_url": "/RefreshEndpoint",
  "scope": {
    "origin": "https://example.com",
    "include_site": true,
    "scope_specification": [
      { "type": "exclude", "domain": "*.example.com", "path": "/static" }
    ]
  },
  "credentials": [{
    "type": "cookie",
    "name": "auth_cookie",
    "attributes": "Domain=example.com; Secure; SameSite=Lax"
  }]
}
```

Note: DBSC only applies to HTTPS pages. It does not support Partitioned cookies.
While DBSC does not require the `Secure` attribute on cookies, HTTP requests are
not protected by DBSC.

### 3. Implement the refresh endpoint

When the short-lived cookie expires, Chrome initiates a refresh flow to prove
possession of the private key. This process involves coordinated actions by both
Chrome and your server:

1.  Chrome defers the user's request to your application and sends a
    refresh request to `/RefreshEndpoint`:

  ```http
  POST /RefreshEndpoint HTTP/1.1
  Sec-Secure-Session-Id: session_id
  ```

1.  Your server responds with a challenge:

  ```http
  HTTP/1.1 403 Forbidden
  Secure-Session-Challenge: "challenge_value"
  ```

1.  Chrome signs the challenge using the stored private key and retries the
    request:

  ```http
  POST /RefreshEndpoint HTTP/1.1
  Sec-Secure-Session-Id: session_id
  Secure-Session-Response: <JWT proof>
  ```

1.  Your server validates the signed proof and issues a refreshed
    short-lived cookie:

  ```http
  HTTP/1.1 200 OK

  Set-Cookie: auth_cookie=short_lived_grant; Max-Age=600; Domain=example.com; Secure; SameSite=Lax
  ```

1.  Chrome receives the refreshed cookie and resumes the original deferred
    request.

## Alternative integration pattern

To improve resilience, sites can add a second, non-DBSC cookie alongside the
short-lived cookie. This long-lived cookie is used only to issue new short-lived
tokens and helps distinguish between truly unauthenticated requests and
temporary DBSC failures.

-   The long-lived cookie persists even if DBSC fails.
-   The short-lived cookie is refreshed using DBSC and required for sensitive
    operations.

This pattern gives sites more control over how to handle edge cases.

## Fallback strategies

Chrome may skip DBSC operations and send requests without the DBSC-managed
short-lived cookie in the following scenarios:

-   The refresh endpoint is unreachable due to network errors or server
    issues.
-   The TPM is busy or encounters signing errors. Because the TPM is shared
    across system processes, excessive refreshes may exceed its rate limits.
-   The DBSC-managed short-lived cookie is a third-party cookie, and the
    user has blocked third-party cookies in their browser settings.

In these situations, Chrome falls back to using the long-lived cookie if one is
still present. This fallback only works if your implementation includes both a
long-lived and a short-lived cookie. If not, Chrome sends the request without a
cookie.

Caution: If malware is present on the device during session registration, it may
    be able to extract the private key. This could enable session hijacking
    similar to other styles of cookie theft. However, attacks involving malware
    during registration or TPM driver modification are considered significantly
    more complex and detectable than standard attacks.