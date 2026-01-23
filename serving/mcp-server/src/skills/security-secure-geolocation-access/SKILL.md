---
description: Securely access user location data by serving pages over HTTPS, preventing interception and protecting user privacy.
filename: secure-geolocation-access
category: security
---

# Secure Geolocation Access

## Best Practices

To ensure that your application can reliably access the user's location using the HTML5 Geolocation API, it is essential to serve the pages making these requests from a secure context. This primarily means migrating your site to HTTPS.

- **DO** ensure that any page using the `navigator.geolocation` API is served over HTTPS.
- **DO** understand that `localhost` is considered a "potentially secure" context and will continue to work for geolocation requests.
- **DO NOT** rely on the Geolocation API for pages served over HTTP, as it will be blocked in Chrome 50 and later.
- **DO NOT** assume that an HTTPS iframe embedded in an HTTP page can access geolocation; the top-level origin must be secure.

## Fallback strategies

If you encounter situations where the Geolocation API is blocked due to a non-secure context, consider the following alternatives:

### Runtime Detection

You can detect if the geolocation was blocked due to a secure context issue by checking the `PositionError` object passed to the failure callback.

- **DO** check the `failure.code` property for a value of `1` ("Permission Denied Error").
- **DO** inspect the `failure.message` for the string "Only secure origins are allowed" to confirm the specific cause.

```js
navigator.geolocation.getCurrentPosition(
  success => {
    // Handle successful location retrieval
  },
  failure => {
    if (failure.code === 1 && failure.message.startsWith("Only secure origins are allowed")) {
      console.warn("Geolocation blocked: Page is not served over a secure context.");
      // Implement fallback strategy here
    } else {
      console.error("Geolocation error:", failure);
    }
  }
);
```

### Alternative Location Services

If migrating to HTTPS is not immediately feasible, or as a supplementary method, consider these alternatives:

- **CONSIDER** using the Google Maps Geolocation API.
- **CONSIDER** implementing GeoIP services to approximate location.
- **CONSIDER** allowing users to manually enter their location, such as a zip code.

However, the **STRONGEST RECOMMENDATION** is to migrate to HTTPS to ensure ongoing and reliable access to the Geolocation API.