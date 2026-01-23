---
description: Protect web resources from cross-origin attacks like CSRF and XSSI using Fetch Metadata request headers to implement a Resource Isolation Policy.
filename: fetch-metadata-resource-isolation
category: security
---

# Protect your resources from web attacks with Fetch Metadata

Prevent CSRF, XSSI, and cross-origin information leaks by implementing a Resource Isolation Policy using Fetch Metadata request headers.

## Background

Many cross-site attacks are possible because the web is open by default, and servers cannot easily protect themselves from communication originating from external applications. Common attacks include cross-site request forgery (CSRF), cross-site script inclusion (XSSI), timing attacks, and cross-origin information leaks. These attacks exploit the fact that servers cannot easily distinguish trusted requests from untrusted ones when the browser automatically attaches cookies to cross-site requests.

## Introducing Fetch Metadata

Fetch Metadata request headers provide information about the context of an HTTP request through a set of `Sec-Fetch-*` headers. This allows servers to apply security policies before processing requests, enabling them to accept or reject requests based on their origin and context.

### `Sec-Fetch-Site`

This header indicates the site that initiated the request. Possible values include:
- `same-origin`: The request was made by your own application.
- `same-site`: The request was made by a subdomain of your site.
- `none`: The request was caused by a user's direct interaction with the user agent (e.g., clicking a bookmark).
- `cross-site`: The request was sent by another website.

### `Sec-Fetch-Mode`

This header indicates the mode of the request, differentiating resource loads from navigation requests (e.g., `navigate` for top-level navigation, `no-cors` for resource requests like images).

### `Sec-Fetch-Dest`

This header exposes the destination of the request, indicating what caused the resource to be requested by the browser (e.g., `script`, `img`).

**Important:** For these protections to take effect on GET requests, your server must include `Sec-Fetch-Dest`, `Sec-Fetch-Mode`, and `Sec-Fetch-Site` in its `Vary` header.

## How to use Fetch Metadata to protect against cross-origin attacks

By implementing a Resource Isolation Policy, you can prevent your resources from being requested by external websites, thereby mitigating common cross-site web vulnerabilities.

### Implementing a Resource Isolation Policy

A Resource Isolation Policy can be enabled for all endpoints of your application, allowing requests from your own application and direct navigations, while blocking malicious cross-site requests.

#### Step 1: Allow requests from browsers which don't send Fetch Metadata

Check for the presence of `sec-fetch-site` to allow requests from older browsers.

```python
if not req['sec-fetch-site']:
  return True  # Allow this request
```

#### Step 2: Allow same-site and browser-initiated requests

Allow requests that do not originate from a cross-origin context.

```python
if req['sec-fetch-site'] in ('same-origin', 'same-site', 'none'):
  return True  # Allow this request
```

**Tip:** To make the policy stricter, remove `'same-site'` if your subdomains are not fully trusted.

#### Step 3: Allow simple top-level navigation and iframing

Allow simple (`HTTP GET`) top-level navigation requests to ensure your site can still be linked from other sites.

```python
if req['sec-fetch-mode'] == 'navigate' and req.method == 'GET'
  and req['sec-fetch-dest'] not in ('object', 'embed'):
    return True  # Allow this request
```

#### Step 4: Opt out endpoints that are meant to serve cross-site traffic (Optional)

Exempt endpoints that are intended to be loaded cross-site, such as CORS-enabled endpoints or public resources.

```python
if req.path in ('/my_CORS_endpoint', '/favicon.png'):
  return True
```

**Caution:** Ensure that opted-out endpoints are static and do not contain sensitive user information.

#### Step 5: Reject all other requests that are cross-site and not navigational

Reject any other **cross-site** request that doesn't fall into the allowed categories.

**Tip:** By default, violations should be rejected with an `HTTP 403` response. Consider logging violations during testing or redirecting requests in specific scenarios.

**Example Implementation:**

```python
# Reject cross-origin requests to protect from CSRF, XSSI, and other bugs
def allow_request(req):
  # Allow requests from browsers which don't send Fetch Metadata
  if not req['sec-fetch-site']:
    return True

  # Allow same-site and browser-initiated requests
  if req['sec-fetch-site'] in ('same-origin', 'same-site', 'none'):
    return True

  # Allow simple top-level navigations except <object> and <embed>
  if req['sec-fetch-mode'] == 'navigate' and req.method == 'GET'
    and req['sec-fetch-dest'] not in ('object', 'embed'):
      return True

  # [OPTIONAL] Exempt paths/endpoints meant to be served cross-origin.
  if req.path in ('/my_CORS_endpoint', '/favicon.png'):
    return True

  # Reject all other requests that are cross-site and not navigational
  return False
```

### Deploying a Resource Isolation Policy

1.  **Monitor:** Install a module to log and monitor how your site behaves with the policy enabled to ensure no legitimate traffic is affected.
2.  **Fix:** Exempt legitimate cross-origin endpoints if violations are found.
3.  **Enforce:** Fully enforce the policy by dropping non-compliant requests.

### Identifying and fixing policy violations

Test your policy in a reporting mode first to identify potential violations. This can be done in server-side code, middleware, or a reverse proxy. Most applications are compatible with Fetch Metadata policies with minimal need for exemptions.

### Enforcing a Resource Isolation Policy

After testing, enforce the restrictions to prevent other sites from requesting your resources and protect your users from cross-site attacks.

**Caution:** Reject invalid requests before running authentication checks or other request processing to avoid revealing sensitive timing information.

## Further reading

- [W3C Fetch Metadata Request Headers specification](https://www.w3.org/TR/fetch-metadata/)
- [Fetch Metadata Playground](https://secmetadata.appspot.com/)
- [Google I/O talk: Securing Web Apps with Modern Platform Features](https://webappsec.dev/assets/pub/Google_IO-Securing_Web_Apps_with_Modern_Platform_Features.pdf) (Slides)