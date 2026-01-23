---
description: Securely verify user identity on the web using cryptographically-signed digital credentials, enhancing privacy and reducing the need for sensitive document uploads.
filename: digital-credentials-identity-verification
category: identity
---

# Digital Credentials API: Secure and Private Identity Verification

Reference docs:
- https://www.w3.org/TR/digital-credentials/
- https://digitalcredentials.dev/
- https://openid.net/specs/openid-4-verifiable-presentations-1_0-final.html

## Best Practices

The Digital Credentials API empowers websites to verify user information in a privacy-preserving way. Key best practices revolve around ensuring robust implementation and user trust.

### Feature Detection

Always check for the availability of the Digital Credentials API before attempting to use it. This ensures a graceful degradation of experience for users on unsupported browsers.

```javascript
if (typeof DigitalCredential !== "undefined") {
  // Digital Credentials API is supported, enable verification features.
} else {
  // Digital Credentials API is not supported, provide an alternative or inform the user.
}
```

### Protocol Support Detection

When requesting credentials, it's crucial to detect if the browser supports the specific protocol you intend to use.

```javascript
if (DigitalCredential.userAgentAllowsProtocol("openid4vp-v1-unsigned")) {
  // Create a request with the "openid4vp-v1-unsigned" protocol
} else {
  // Protocol is not supported, inform the user or try an alternative protocol.
}
```

### Requesting Credentials

Use `navigator.credentials.get()` with the `digital` parameter to request verifiable credentials. Structure your request with the `requests` array, specifying the `protocol` and `data` parameters.

```javascript
try {
  const digitalCredential = await navigator.credentials.get({
    digital: {
      requests: [{
        protocol: "openid4vp-v1-unsigned",
        data: {
          response_type: "vp_token",
          nonce: "[some-nonce]",
          client_metadata: {
            // Supported credential formats and public keys for encryption.
          },
          dcql_query: {
            credentials: [
              {
                id: "cred_vc",
                format: "dc+sd-jwt",
                meta: {
                  vct_values: ["urn:eudi:pid:1"] // Example for EUDI PID
                },
                claims: [
                  {
                    path: ["age_equal_or_over", "18"]
                  }
                ]
              }
            ]
          }
        }
      }]
    }
  });

  // Process the received credential data on your backend.
  const response = await fetch("/verify", {
    method: "POST",
    body: JSON.stringify(digitalCredential.data),
    headers: {
      'Content-Type': 'application/json'
    }
  });
} catch (e) {
  console.error("Credential request failed:", e);
  // Handle errors, e.g., user cancellation.
}
```

### Verifying Issuer Trust

While cryptographic signatures ensure credential authenticity, you must also verify that the issuer is trusted for your specific use case. Maintain a list of approved issuers and reject any that do not match.

### Handling Responses

The process of handling the response involves decrypting the payload (if encrypted) and verifying the signatures and issuer. Refer to the documentation for specific protocols (e.g., OpenID4VP, org-iso-mdoc) for detailed decryption and verification steps.

```javascript
// Example of processing a response payload (conceptual)
if (digitalCredential.data.response) {
  // Decrypt the JWE token (for OpenID4VP) using your private key.
  // Verify the Verifiable Presentation within the decrypted payload.
  // Validate issuer and other relevant information.
}
```

## Fallback Strategies

If the user's browser does not support the Digital Credentials API, implement appropriate fallback mechanisms.

### Core API Fallback

-   **DO** use `typeof DigitalCredential !== "undefined"` for JavaScript feature detection.
-   **DO NOT** attempt to use `navigator.credentials.get({ digital: ... })` if the API is not present.
-   **DO** provide alternative methods for identity verification or inform the user about the limitation.

### Protocol-Specific Fallbacks

-   **DO** check `DigitalCredential.userAgentAllowsProtocol()` for each protocol you intend to support.
-   **DO** have a defined strategy for what happens if a required protocol is not supported, such as offering to try another protocol or guiding the user to update their browser or wallet.

## Getting Started

-   **Availability:** Ensure users are running Chrome 141+ or Safari 26.0+.
-   **Prerequisites:** Users need a compatible device with an installed digital wallet application that supports the Digital Credentials API.
-   **Testing:** Utilize the live demo at [https://verifier.multipaz.org](https://verifier.multipaz.org) for an end-to-end testing experience.