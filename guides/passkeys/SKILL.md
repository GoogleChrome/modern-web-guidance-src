---
name: passkeys
description: Best practices and full-stack reference architecture for implementing WebAuthn/Passkeys. Use this skill when building highly secure passwordless authentication, biometric login flows (TouchID/FaceID), or passkey synchronization.
---

## 1. Database Schema and Storage Architecture

### Guidelines

- **DO** store all public keys and credential IDs as Base64URL-encoded strings to ensure safe JSON transport.
- **DO** enforce stable User ID mapping (a unique `passkeyUserId` per user account) to tie multiple credentials to a single identity.
- **DO** track the AAGUID to identify the specific authenticator model (e.g., iCloud Keychain vs. Google Password Manager).

### Required Credential Interface

```typescript
export interface SesamePublicKeyCredential {
  id: string; // Base64URL encoded string (Unique Credential ID)
  passkeyUserId: string; // User account identifier
  credentialPublicKey: string; // Base64URL encoded public key
  credentialType: 'public-key';
  credentialDeviceType: 'singleDevice' | 'multiDevice';
  credentialBackedUp: boolean;
  aaguid: string; // 128-bit identifier representing the authenticator model
  providerIcon?: string; // Resolved icon URI (via AAGUID registry)
  name: string; // Resolved display name (e.g., "1Password")
  transports: string[]; // e.g., ["internal", "hybrid"]
  registeredAt: number; // Epoch timestamp
  lastUsedAt?: number; // Epoch timestamp updated on successful authentication
}
```

## 2. Server-Side API Implementation (Express Reference)

### Guidelines

- **DO** store the generated `challenge` in an active server-side session before transmitting it to the client.
- **DO** utilize `excludeCredentials` during registration to prevent creating multiple identical credentials on the same authenticator.
- **DO** enforce `residentKey: "required"` to mandate discoverable credentials.
- **DO** ignore User Presence (UP) and User Verification (UV) flags when verifying silent registrations triggered via Conditional Create flows.

### Registration Endpoints

```javascript
// POST /register/options - Generate registration options
router.post('/register/options', async (req, res) => {
  const user = await Users.findById(req.session.userId);
  const userCredentials = await Credentials.findByUserId(user.id);

  const options = await generateRegistrationOptions({
    rpName: "Modern Web App",
    rpID: "example.com",
    userID: user.id,
    userName: user.email,
    // Prevent registering duplicate passkeys on this specific device
    excludeCredentials: userCredentials.map(cred => ({
      id: cred.id,
      type: 'public-key',
    })),
    authenticatorSelection: {
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: 'preferred',
      // Use "platform" ONLY for inline promotion flows; omit for settings pages
      authenticatorAttachment: req.body.promotion ? 'platform' : undefined,
    }
  });

  // Persist challenge securely in the user session
  req.session.challenge = options.challenge;
  return res.json(options);
});

// POST /register/verify - Verify attestation and resolve AAGUID
router.post('/register/verify', async (req, res) => {
  const { body } = req;
  
  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge: req.session.challenge,
    expectedOrigin: "https://example.com",
    expectedRPID: "example.com",
  });

  if (verification.verified) {
    const { registrationInfo } = verification;
    const credential = {
      id: registrationInfo.credentialID,
      credentialPublicKey: registrationInfo.credentialPublicKey,
      aaguid: registrationInfo.aaguid,
      name: 'Unknown passkey provider',
    };

    // AAGUID Human-Readable Resolution
    if (registrationInfo.aaguid !== '00000000-0000-0000-0000-000000000000') {
      const provider = aaguidsRegistry[registrationInfo.aaguid];
      if (provider) {
        credential.name = provider.name;
        credential.providerIcon = provider.icon_light;
      }
    }

    await Credentials.save(credential);
    return res.json({ success: true });
  }
});
```

### Authentication Endpoints

```javascript
// POST /auth/options - Generate sign-in challenge
router.post('/auth/options', async (req, res) => {
  const options = await generateAuthenticationOptions({
    rpID: "example.com",
    // Empty array permits full discovery (conditional mediation)
    allowCredentials: [], 
    userVerification: 'preferred',
  });

  req.session.challenge = options.challenge;
  return res.json(options);
});
```

## 3. Client-Side Integration and Conditional UI

### Guidelines

- **DO** verify that the client supports platform authenticators before rendering biometric buttons.
- **DO** use `AbortController` to terminate active conditional WebAuthn listeners if the user chooses to sign in via password instead.
- **DO** separate the `navigator.credentials.create()` call from the backend verification `fetch()` into two distinct `try/catch` blocks to accurately isolate failure modes.
- **DO** call `PublicKeyCredential.signalUnknownCredential()` **only** when the backend attestation `fetch()` fails. **DON'T** call it for WebAuthn DOM Exceptions (e.g., when the user aborts the system modal).
- **DO** catch and gracefully ignore silent browser exceptions (`InvalidStateError`, `NotAllowedError`) during background execution.

### Capability Detection Guard

```javascript
if (window.PublicKeyCredential && PublicKeyCredential.getClientCapabilities) {
  const capabilities = await PublicKeyCredential.getClientCapabilities();
  if (!capabilities.passkeyPlatformAuthenticator) {
    // Graceful fallback: Platform authenticators are unavailable
    console.warn('Biometrics unavailable on this platform.');
    return;
  }
}
```

### Autofill Integration (Conditional Mediation)

Annotate standard login fields with `autocomplete="username webauthn"` to activate the native dropdown prompt:

```html
<form id="signin-form">
  <label for="username">Email</label>
  <input type="text" id="username" autocomplete="username webauthn" autofocus>
</form>

<script>
  const abortController = new AbortController();

  // Executed immediately on page load
  async function startConditionalMediation() {
    try {
      const credential = await navigator.credentials.get({
        publicKey: fetchedAuthOptions,
        signal: abortController.signal,
        mediation: 'conditional' // Triggers the autofill UI
      });
      // Transmit to /auth/verify
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Conditional mediation failed:', error);
      }
    }
  }
</script>
```

## 4. Provider Synchronization (Signal API)

### Guidelines

- **DO** execute the Signal API to notify password managers of removed or renamed passkeys to prevent stale autofill suggestions.
- **DO** encode parameters using Base64URL.

### Full Method Integration

```javascript
// Feature detection guard
if (PublicKeyCredential.signalAllAcceptedCredentials) {
  
  // 1. Keep active credentials synchronized (Call on page load or after deletion)
  await PublicKeyCredential.signalAllAcceptedCredentials({
    rpId: "example.com",
    userId: "M2YPl-KGnA8", // Base64URL format
    allAcceptedCredentialIds: ["vI0qOggi...", "bC3qOggi..."],
  });

  // 2. Keep display names updated (Call after profile edits)
  await PublicKeyCredential.signalCurrentUserDetails({
    rpId: "example.com",
    userId: "M2YPl-KGnA8",
    name: "user@example.com",
    displayName: "Jane Doe",
  });

  // 3. Signal dead credentials (Call after backend returns 404 on auth)
  await PublicKeyCredential.signalUnknownCredential({
    rpId: "example.com",
    credentialId: "vI0qOggi...",
  });
}
```
