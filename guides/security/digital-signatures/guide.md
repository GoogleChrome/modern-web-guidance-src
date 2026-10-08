---
name: digital-signatures
description: Sign and verify messages, tokens, or artifacts in the browser using classical or quantum-resistant (post-quantum) asymmetric keys to ensure data integrity and authenticity.
web-feature-ids:
  - tmp-webcrypto-modern-algos
  - web-cryptography
---

# Sign and verify data with WebCrypto

Use the Web Cryptography API (`crypto.subtle`) to sign and verify messages, tokens, or artifacts in the browser using quantum-resistant (`ML-DSA`) or classical (`Ed25519`, `ECDSA`) asymmetric keys. Digital signatures guarantee data integrity and signer authenticity without requiring shared secret keys. For establishing shared secrets and encrypting confidential payloads, see {{ GUIDE_REF("client-side-encryption") }}.

Modern WebCrypto adds **post-quantum lattice-based digital signatures** (`'ML-DSA-44'`, `'ML-DSA-65'`, `'ML-DSA-87'`), **domain-separated signing via `ContextParams`** (`context`), **explicit raw key formats** (`'raw-public'`, `'raw-seed'`), **`getPublicKey()`**, and static feature detection via **`SubtleCrypto.supports()`**.

## 1. Post-Quantum Digital Signatures (`ML-DSA`)

`ML-DSA` (Module-Lattice-Based Digital Signature Algorithm, standardized in NIST FIPS 204) provides digital signatures resistant to attacks by both classical and quantum computers.

### Supported `ML-DSA` parameter sets

| Algorithm name | Description | Public key (`'raw-public'`) | Private seed (`'raw-seed'`) | Signature size |
|---|---|---|---|---|
| `'ML-DSA-44'` | NIST FIPS 204 Category 2 (~128-bit security level) | 1312 bytes | 32 bytes | 2420 bytes |
| `'ML-DSA-65'` | NIST FIPS 204 Category 3 (~192-bit security level; recommended default) | 1952 bytes | 32 bytes | 3309 bytes |
| `'ML-DSA-87'` | NIST FIPS 204 Category 5 (~256-bit security level) | 2592 bytes | 32 bytes | 4627 bytes |

- Use the exact hyphenated string `'ML-DSA-44'`, `'ML-DSA-65'`, or `'ML-DSA-87'`. Pre-standardization names such as `'Dilithium'` or `'CRYSTALS-Dilithium'` throw `NotSupportedError`.
- Neither `ML-DSA` nor `'Ed25519'` takes a `hash` parameter. Pass `['sign', 'verify']` to `generateKey()`, but pass `['sign']` only when importing a private key and `['verify']` only when importing a public key or calling `getPublicKey()` (passing `['sign', 'verify']` to `importKey()` or `getPublicKey()` throws `SyntaxError`).

### Generating keys, signing, and verifying

Always export the verification public key with `crypto.subtle.exportKey('raw-public', keyPair.publicKey)` (and import verification public keys with `'raw-public'`, or `'raw'` in a classical fallback) so public key bytes can be serialized, displayed, or verified across boundaries:

```javascript
// 1. Signer generates an ML-DSA-65 key pair and exports the public key using 'raw-public'
const signerKeyPair = await crypto.subtle.generateKey(
  'ML-DSA-65',
  false,
  ['sign', 'verify'],
);

// Modern algorithms reject legacy 'raw'; use 'raw-public' for public keys
const publicKeyBytes = await crypto.subtle.exportKey(
  'raw-public',
  signerKeyPair.publicKey,
);

// 2. Signer signs the payload bytes with an optional domain-separation context
const payloadBytes = new TextEncoder().encode('{"artifact":"release-v2.4.0.tar.gz","sha256":"9f86d08..."}');
const contextBytes = new TextEncoder().encode('release-manifest-v1');

const signatureBuffer = await crypto.subtle.sign(
  {
    name: 'ML-DSA-65',
    context: contextBytes,
  },
  signerKeyPair.privateKey,
  payloadBytes,
);

// 3. Verifier imports the public key with 'raw-public' and verifies the signature
const verifierPublicKey = await crypto.subtle.importKey(
  'raw-public',
  publicKeyBytes,
  'ML-DSA-65',
  true,
  ['verify'],
);

const isValid = await crypto.subtle.verify(
  {
    name: 'ML-DSA-65',
    context: contextBytes,
  },
  verifierPublicKey,
  signatureBuffer,
  payloadBytes,
);
```

## 2. Domain Separation with `ContextParams`

When calling `crypto.subtle.sign()` or `crypto.subtle.verify()` with `'ML-DSA-44'`, `'ML-DSA-65'`, or `'ML-DSA-87'`, you can pass either a bare algorithm name string (`'ML-DSA-65'`) or a `ContextParams` dictionary (`{ name: 'ML-DSA-65', context }`):

- **Purpose**: `context` binds a signature to a specific application, protocol version, or message type so a valid signature produced for one purpose cannot be replayed in another context that shares the same key pair.
- **255-byte limit**: `context` accepts any `BufferSource` from `0` to `255` bytes (omitting `context` is equivalent to passing an empty `new Uint8Array(0)`). Passing a `context` longer than `255` bytes rejects with `OperationError`.
- **Exact match required**: `crypto.subtle.verify()` returns `true` only when the verifier passes the exact same `context` bytes used during `crypto.subtle.sign()`.
- **`context` is `ML-DSA`-specific**: Classical WebCrypto algorithms (`'Ed25519'` and `'ECDSA'`) do not read a `context` property from the algorithm dictionary (WebIDL silently ignores unknown dictionary properties on `Algorithm` and `EcdsaParams`). If your application supports a classical fallback alongside `ML-DSA`, bind the context bytes into the signed payload in your fallback path.

## 3. Explicit Raw Key Formats and `getPublicKey()`

`'ML-DSA-44'`, `'ML-DSA-65'`, and `'ML-DSA-87'` **reject the legacy `'raw'` format** in `importKey()` and `exportKey()` with a `NotSupportedError`. Always export or import keys using an explicit modern format:

- **`'raw-public'`**: Public key bytes (`1312`, `1952`, or `2592` bytes for `'ML-DSA-44'`, `'ML-DSA-65'`, and `'ML-DSA-87'`). `'raw-public'` is also accepted on `'Ed25519'` and `'ECDSA'` in browsers that support Modern WebCrypto; keep `'raw'` in fallback paths targeting older browsers.
- **`'raw-seed'`**: 32-byte private key seed (`importKey()` and `exportKey()`). Both `'raw'` and `'raw-private'` throw `NotSupportedError` on `ML-DSA`—store or transmit private keys using the 32-byte `'raw-seed'`, `'pkcs8'` (54 bytes), or `'jwk'` (`kty: 'AKP'`).
- **`'spki'`, `'pkcs8'`, and `'jwk'`**: Supported for all three `ML-DSA` parameter sets.

If you hold a private signing `CryptoKey` (even with `extractable: false`) and need its corresponding public verification `CryptoKey`, call `crypto.subtle.getPublicKey()`:

```javascript
const publicKey = await crypto.subtle.getPublicKey(
  signerKeyPair.privateKey,
  ['verify'],
);
```

## Fallback strategies

{{ BASELINE_STATUS("web-cryptography") }}

If your Baseline target does not yet support `SubtleCrypto.supports()` or `ML-DSA`, detect support using the **static** `SubtleCrypto.supports()` method and fall back to classical `'Ed25519'` (or `'ECDSA'` with `'P-256'` and `'SHA-256'`):

- **Call `SubtleCrypto.supports()` on the `SubtleCrypto` constructor, not on `crypto.subtle`**: `globalThis.SubtleCrypto?.supports?.('sign', 'ML-DSA-65')` is a synchronous static method returning a boolean (`crypto.subtle.supports` is `undefined`). Probe `'sign'`, `'verify'`, `'generateKey'`, `'importKey'`, or `'getPublicKey'` (or pass a `ContextParams` dictionary such as `SubtleCrypto.supports('sign', { name: 'ML-DSA-65', context })`); do not probe `'exportKey'`, which is not a supported operation name in `SubtleCrypto.supports()`.
- **Classical fallback (`'Ed25519'`)**: When `SubtleCrypto.supports('sign', 'ML-DSA-65')` is unavailable or returns `false`, generate an `'Ed25519'` key pair with `['sign', 'verify']` usages, export the public key using `'raw'`, and prepend a length-prefixed `context` header before signing and verifying so domain separation behaves consistently across both suites.

```javascript
const ML_DSA_PUBLIC_KEY_ALGORITHMS = {
  1312: 'ML-DSA-44',
  1952: 'ML-DSA-65',
  2592: 'ML-DSA-87',
};

export function supportsPostQuantumSignatures() {
  return (
    typeof globalThis.SubtleCrypto?.supports === 'function' &&
    SubtleCrypto.supports('sign', 'ML-DSA-65')
  );
}

export async function generateSigningKeyPair() {
  if (supportsPostQuantumSignatures()) {
    const keyPair = await crypto.subtle.generateKey('ML-DSA-65', false, ['sign', 'verify']);
    const publicKeyBytes = new Uint8Array(
      await crypto.subtle.exportKey('raw-public', keyPair.publicKey),
    );
    return {
      suite: 'ML-DSA-65',
      keyFormat: 'raw-public',
      keyPair,
      publicKeyBytes,
    };
  }

  // Classical fallback: Ed25519
  const keyPair = await crypto.subtle.generateKey('Ed25519', false, ['sign', 'verify']);
  const publicKeyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
  return {
    suite: 'Ed25519',
    keyFormat: 'raw',
    keyPair,
    publicKeyBytes,
  };
}

function frameFallbackInput(payloadBytes, contextBytes) {
  if (contextBytes.byteLength > 255) {
    throw new DOMException('Context must not exceed 255 bytes', 'OperationError');
  }
  const framed = new Uint8Array(1 + contextBytes.byteLength + payloadBytes.byteLength);
  framed[0] = contextBytes.byteLength;
  framed.set(contextBytes, 1);
  framed.set(payloadBytes, 1 + contextBytes.byteLength);
  return framed;
}

export async function signPayload(
  privateKey,
  payloadBytes,
  contextBytes = new Uint8Array(0),
) {
  if (privateKey.algorithm.name.startsWith('ML-DSA')) {
    const sig = await crypto.subtle.sign(
      { name: privateKey.algorithm.name, context: contextBytes },
      privateKey,
      payloadBytes,
    );
    return new Uint8Array(sig);
  }

  const framed = frameFallbackInput(payloadBytes, contextBytes);
  const sig = await crypto.subtle.sign('Ed25519', privateKey, framed);
  return new Uint8Array(sig);
}

export async function verifyPayload(
  publicKeyOrBytes,
  signatureBytes,
  payloadBytes,
  contextBytes = new Uint8Array(0),
) {
  const publicKey =
    publicKeyOrBytes instanceof CryptoKey
      ? publicKeyOrBytes
      : await (() => {
          const bytes =
            publicKeyOrBytes instanceof Uint8Array
              ? publicKeyOrBytes
              : new Uint8Array(publicKeyOrBytes);
          const mlDsaName = ML_DSA_PUBLIC_KEY_ALGORITHMS[bytes.byteLength];
          return mlDsaName
            ? crypto.subtle.importKey('raw-public', bytes, mlDsaName, true, ['verify'])
            : crypto.subtle.importKey('raw', bytes, 'Ed25519', true, ['verify']);
        })();

  if (publicKey.algorithm.name.startsWith('ML-DSA')) {
    return crypto.subtle.verify(
      { name: publicKey.algorithm.name, context: contextBytes },
      publicKey,
      signatureBytes,
      payloadBytes,
    );
  }

  const framed = frameFallbackInput(payloadBytes, contextBytes);
  return crypto.subtle.verify('Ed25519', publicKey, signatureBytes, framed);
}
```
