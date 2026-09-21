---
name: verify-email-ownership
description: Verify that a user owns an email address during account creation, sign-in, or recovery without sending a one-time passcode or magic link email.
web-feature-ids:
  - tmp-email-verification
---

# Verify email address ownership

When collecting an email address during sign-up, sign-in, checkout, or account recovery, verifying ownership traditionally requires sending an out-of-band one-time passcode (OTP) or magic link. This forces users to leave your page, wait for email delivery, and copy codes—introducing friction, drop-off, and phishing risk, while also revealing to the email provider which relying party (RP) the user is visiting.

The **Email Verification API** (client-side HTML extension) and **Email Verification Protocol (EVP)** (backend cryptographic protocol) enable a relying party to verify that a user controls an email address without sending a verification email. The browser intermediates between the relying party and the user's email provider (the issuer):

1. The relying party includes a hidden `<input>` with `autocomplete="email-verification-token"` and a single-use cryptographic `nonce` in the same `<form>` as the email input.
2. When the user selects or enters an email address, the browser looks up the domain's `_email-verification.<domain>` DNS `TXT` record, verifies the user has an active session with the authoritative issuer, and requests an **Email Verification Token (EVT)** without disclosing the relying party's identity to the issuer.
3. The browser binds the EVT to the relying party's origin and session `nonce` in a **Key Binding JWT (KB-JWT)** signed with an ephemeral browser key pair (`EVT + KB-JWT`), populates the hidden input, and submits the form.
4. The relying party's backend verifies the 6-step cryptographic chain and, if valid, skips the email OTP or magic link step.

## 1. Enable the Origin Trial and Render the Verification Form

To participate as a verifying site (relying party):

1. **Provide the Origin Trial token** on the page hosting the form using either the `Origin-Trial` HTTP response header or a `<meta http-equiv="origin-trial">` element.
   - **Third-party origin trials (Chrome 154+):** Embedded identity SDKs can inject a third-party trial token, provided the Origin Trial registrant origin matches the issuer domain (same-site with the issuer, such as `https://issuer.example`).
2. **Generate a cryptographically random nonce per form render** (at least 128 bits of entropy, such as `crypto.randomUUID()`), store it in an `HttpOnly`, `Secure`, `SameSite=Lax` session cookie, and render it into the hidden token input's `nonce` attribute. Serve the page with `Cache-Control: no-store` so back/forward navigation does not reuse an already-consumed nonce.
3. **Add the hidden token input** (`autocomplete="email-verification-token"`) inside the same `<form>` as the email input (`autocomplete="email"`).

```html
<!-- Serve with:
     Origin-Trial: <YOUR_ORIGIN_TRIAL_TOKEN>
     Cache-Control: no-store -->
<form method="POST" action="/api/verify-email" id="verify-form">
  <label for="email">Email address:</label>
  <input
    type="email"
    id="email"
    name="email"
    autocomplete="email"
    required
  />

  <!-- MANDATORY: Must be in the same <form> as the email input.
       The nonce value must be freshly generated on the server per form render. -->
  <input
    type="hidden"
    name="token"
    nonce="SERVER_GENERATED_PER_FORM_NONCE"
    autocomplete="email-verification-token"
  />

  <button type="submit" id="submit-btn">Continue</button>
</form>

<script type="module">
  const form = document.getElementById('verify-form');
  const submitBtn = document.getElementById('submit-btn');

  if (form && submitBtn) {
    form.addEventListener('submit', () => {
      submitBtn.setAttribute('disabled', 'true');
    });
  }
</script>
```

## 2. Verify the Submitted Token on the Server

When the form is submitted, treat the `token` field as untrusted input. If the `token` field is empty (for example, in browsers that do not support EVP or when the user is signed out of their email provider), fall back immediately to your standard email OTP or magic link flow.

Always use established SD-JWT and JOSE/JWT libraries for your backend platform (such as `@sd-jwt/core` and `jose` in Node.js, `sd-jwt-python` / `jwcrypto` in Python, or `sd-jwt-java` / Nimbus JOSE+JWT on the JVM) to parse and validate the `EVT~KB-JWT` presentation rather than hand-rolling custom JWT or SD-JWT parsing code.

### Step 1: Consume the session nonce and parse the SD-JWT claims

Immediately read and delete the expected `nonce` from the user's session cookie upon receiving the `POST` request so an intercepted token cannot be replayed. Then decode the SD-JWT presentation (`EVT + KB-JWT`) and verify that:
- Both the issuer JWT (`jwt`) and Key Binding JWT (`kbJwt`) are present, along with the issuer claim (`iss`).
- `evtPayload.email_verified === true`.
- `evtPayload.email` matches the submitted form email using a **case-insensitive comparison** (`toLowerCase()`).

```javascript
import { createHash } from 'node:crypto';
import { decodeSdJwtSync } from '@sd-jwt/core';

const hasher = (data, alg) =>
  createHash(alg === 'sha-256' ? 'sha256' : alg).update(data).digest();

// Consume and delete the single-use session nonce before verifying
const decoded = decodeSdJwtSync(rawToken, hasher);
const evtPayload = decoded.jwt.payload;
const iss = evtPayload.iss;

if (!expectedNonce || !decoded.kbJwt || !iss || evtPayload.email_verified !== true) {
  throw new Error('Missing nonce, KB-JWT, issuer, or email_verified !== true.');
}
// MANDATORY: Compare email addresses case-insensitively
if (evtPayload.email?.toLowerCase() !== submittedEmail.toLowerCase()) {
  throw new Error('Submitted email does not match the EVT email claim.');
}
```

### Step 2: Validate DNS TXT delegation and load the issuer JWKS

Before making any network request to `iss`, verify that the submitted email's domain delegates authority to that exact issuer via a `_email-verification.<domain>` DNS `TXT` record (`iss=<issuer-host>` -> `https://<issuer-host>` with no port, path, or trailing slash). Once DNS delegation matches `iss` byte-for-byte, fetch `${iss}/.well-known/email-verification` over HTTPS and load the issuer's JSON Web Key Set (JWKS).

> **Note on `kid` handling:** Some major email providers (such as Gmail) omit `kid` from the EVT header. When `kid` is absent and the JWKS contains multiple keys, `jose` throws `ERR_JWKS_MULTIPLE_MATCHING_KEYS` (an `AsyncIterable` of matching `CryptoKey`s)—iterate `for await (const publicKey of err)` to trial-verify each key, as shown in Step 3.

```javascript
import dns from 'node:dns/promises';
import { createRemoteJWKSet } from 'jose';

const domain = submittedEmail.split('@')[1];
const txtRecords = (await dns.resolveTxt(`_email-verification.${domain}`)).map((r) => r.join(''));
if (!txtRecords.some((txt) => txt.startsWith('iss=') && `https://${txt.slice(4).trim()}` === iss)) {
  throw new Error(`Issuer "${iss}" is not delegated via DNS for "${domain}".`);
}

const discoveryUrl = new URL('/.well-known/email-verification', iss);
if (discoveryUrl.protocol !== 'https:') throw new Error('Issuer must use HTTPS.');
const metadata = await (await fetch(discoveryUrl)).json();
if ((metadata.issuer && metadata.issuer !== iss) || !metadata.jwks_uri?.startsWith('https://')) {
  throw new Error('Invalid issuer metadata or non-HTTPS jwks_uri.');
}
const issuerJwks = createRemoteJWKSet(new URL(metadata.jwks_uri));
```

### Step 3: Verify the EVT signature and Key Binding JWT (`KB-JWT`)

Finally, verify both signatures and the cryptographic binding between the two tokens using an explicit asymmetric algorithm allowlist (`['Ed25519', 'EdDSA', 'ES256']`):
1. **EVT signature (`verifier`):** Verify against `issuerJwks` (catching `ERR_JWKS_MULTIPLE_MATCHING_KEYS` to iterate candidate keys when `kid` is omitted), enforcing `iss` and a tight freshness window (`maxTokenAge: '5m'`, `clockTolerance: '1m'`).
2. **Holder binding (`kbVerifier`):** Verify the `KB-JWT` signature using the browser's ephemeral public key in `evtPayload.cnf.jwk`, confirm `aud` matches your relying party origin (`expectedAudience`), confirm `nonce === expectedNonce`, and let `SDJwtInstance.verify()` validate the `sd_hash` digest over the EVT.

```javascript
import { SDJwtInstance } from '@sd-jwt/core';
import { importJWK, jwtVerify } from 'jose';

const ALLOWED_ALGS = ['Ed25519', 'EdDSA', 'ES256'];
const evtOptions = { issuer: iss, algorithms: ALLOWED_ALGS, maxTokenAge: '5m', clockTolerance: '1m' };

const sdJwt = new SDJwtInstance({
  hasher,
  verifier: async (data, sig) => {
    const compactEvt = `${data}.${sig}`;
    try {
      await jwtVerify(compactEvt, issuerJwks, evtOptions);
    } catch (err) {
      // When `kid` is omitted (e.g. Gmail) and multiple keys match in the JWKS,
      // jose throws JWKSMultipleMatchingKeys, which yields each matching CryptoKey.
      if (err?.code !== 'ERR_JWKS_MULTIPLE_MATCHING_KEYS') throw err;
      let matched = false;
      for await (const publicKey of err) {
        try {
          await jwtVerify(compactEvt, publicKey, evtOptions);
          matched = true;
          break;
        } catch {}
      }
      if (!matched) throw err;
    }
    return true;
  },
  kbVerifier: async (data, sig) => {
    const holderKey = await importJWK(evtPayload.cnf.jwk, decoded.kbJwt.header.alg);
    const { payload } = await jwtVerify(`${data}.${sig}`, holderKey, {
      audience: expectedAudience,
      algorithms: ALLOWED_ALGS,
      maxTokenAge: '5m',
      clockTolerance: '1m',
    });
    return payload.nonce === expectedNonce;
  },
});

const verified = await sdJwt.verify(rawToken, {
  requiredClaimKeys: ['email', 'email_verified'],
  kb: { required: true },
});
```

## Best practices

- **DO** perform all token verification strictly on the server. **DO NOT** validate tokens in client-side JavaScript or trust any client-side verification state—client-side checks can be trivially bypassed or forged and provide zero trust guarantee to the relying party.
- **DO** use established SD-JWT and JOSE/JWT libraries for your backend platform (for example, `@sd-jwt/core` and `jose` in Node.js) to parse and validate the `EVT~KB-JWT` presentation. **DO NOT** hand-roll custom JWT, SD-JWT, or `sd_hash` parsing and signature verification routines.
- **DO** generate a fresh cryptographic `nonce` on the server for each form render and serve the form page with `Cache-Control: no-store`. **DO NOT** simply re-enable a submit button on `pageshow` after back/forward navigation—once a form is submitted, its `nonce` has already been consumed on the server, so navigating back must load a fresh form and `nonce`.
- **DO** consume and invalidate the session `nonce` immediately when the `POST` request arrives so an intercepted token cannot be replayed.
- **DO** perform a **case-insensitive comparison** between `evtPayload.email` and the submitted form email address (`email.toLowerCase()`), while preserving the submitted email string.
- **DO** trial-verify all keys in the issuer's JWKS when `kid` is absent from the EVT header (providers such as Gmail omit `kid`).
- **DO** verify DNS delegation (`_email-verification.<domain>`) before trusting any `iss` claim in an EVT; never fetch `.well-known/email-verification` from an unverified `iss` origin without first confirming DNS delegation for the submitted email's domain.
- **DO NOT** treat email ownership verification as proof of inbox deliverability. EVP proves that the user controls the email account with the authoritative provider; still send transactional welcome emails and handle bounces normally.
- **DO NOT** block account creation or sign-in when `token` is empty or when verification fails—always degrade gracefully to your standard email OTP or magic link flow.

## Fallback strategy

The Email Verification API (`autocomplete="email-verification-token"`) is currently in origin trial in Chrome (desktop from Chrome 145, Android from Chrome 154) and is not yet supported across all browsers.

Email Verification is designed as a **progressive enhancement** over traditional out-of-band email verification (OTP codes or magic links). Browsers that do not support `autocomplete="email-verification-token"` simply ignore the hidden input and submit the form with an empty `token` value.

```javascript
export async function handleSignupSubmission(request) {
  const formData = await request.formData();
  const submittedEmail = String(formData.get('email') || '').trim();
  const rawToken = String(formData.get('token') || '').trim();
  const expectedNonce = consumeSessionNonce(request);

  if (rawToken && expectedNonce) {
    try {
      await verifyEmailVerificationToken({
        rawToken,
        submittedEmail,
        expectedNonce,
        expectedAudience: new URL(request.url).origin,
      });
      // Fast path: email ownership is cryptographically verified; skip OTP email.
      return completeAccountCreation(submittedEmail);
    } catch {
      // Verification failed or expired; fall through to standard OTP/magic link flow.
    }
  }

  // Fallback path: send standard OTP code or magic link email to submittedEmail.
  return sendTraditionalVerificationEmail(submittedEmail);
}
```
