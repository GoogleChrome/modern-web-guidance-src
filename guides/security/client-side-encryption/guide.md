---
name: client-side-encryption
description: Establish shared secrets using public-key encapsulation or key agreement—including hybrid and post-quantum protection—and encrypt sensitive data in the browser with authenticated encryption.
web-feature-ids:
  - tmp-webcrypto-modern-algos
  - web-cryptography
---

# Encrypt data client-side with WebCrypto

Use the Web Cryptography API (`crypto.subtle`) to establish shared secrets over untrusted networks and encrypt sensitive data in the browser using Authenticated Encryption with Associated Data (AEAD). For signing and verifying messages or artifacts without encrypting them, see {{ GUIDE_REF("digital-signatures") }}.

Modern WebCrypto adds **Key Encapsulation Mechanisms (KEMs)** (`encapsulateKey()`, `decapsulateKey()`, `encapsulateBits()`, `decapsulateBits()`), the **`ChaCha20-Poly1305`** AEAD cipher, **explicit raw key formats** (`'raw-public'`, `'raw-seed'`, `'raw-secret'`), **`getPublicKey()`**, and static feature detection via **`SubtleCrypto.supports()`**.

## 1. Key Encapsulation (`MLKEM768-X25519` and `ML-KEM`)

Unlike Diffie-Hellman key agreement (`deriveKey()`), where both parties combine their keys, a Key Encapsulation Mechanism (KEM) uses the recipient's public key to generate both a random shared secret and a ciphertext capsule in a single `encapsulateKey()` call. The recipient recovers the same shared key from the ciphertext capsule using `decapsulateKey()`.

### Supported KEM algorithms

| Algorithm name | Description | Public key (`'raw-public'`) | Private seed (`'raw-seed'`) | Ciphertext size |
|---|---|---|---|---|
| `'MLKEM768-X25519'` | Hybrid post-quantum + classical KEM (recommended default; combines `ML-KEM-768` and `X25519`) | 1216 bytes | 32 bytes | 1120 bytes |
| `'ML-KEM-768'` | NIST FIPS 203 post-quantum KEM (192-bit security category) | 1184 bytes | 64 bytes | 1088 bytes |
| `'ML-KEM-1024'` | NIST FIPS 203 post-quantum KEM (256-bit security category) | 1568 bytes | 64 bytes | 1568 bytes |

- Use the exact string `'MLKEM768-X25519'` for the hybrid KEM. Non-standard aliases such as `'X-Wing'` or `'X25519MLKEM768'`, as well as `'ML-KEM-512'`, throw `NotSupportedError`.
- KEM public keys only accept `'encapsulateKey'` and `'encapsulateBits'` usages; KEM private keys only accept `'decapsulateKey'` and `'decapsulateBits'`.

### Encapsulating and decapsulating a shared key

`encapsulateKey()` and `decapsulateKey()` interpret their `sharedKeyAlgorithm` parameter using `importKey()` rules, importing the 32-byte (256-bit) KEM shared secret with format `'raw-secret'`. You can pass `'ChaCha20-Poly1305'`, `'AES-GCM'`, or `'HKDF'` directly:

```javascript
// 1. Recipient generates a key pair and exports the public key using 'raw-public'
const recipientKeyPair = await crypto.subtle.generateKey(
  'MLKEM768-X25519',
  false,
  ['encapsulateKey', 'decapsulateKey'],
);

// Modern algorithms reject legacy 'raw'; use 'raw-public' for public keys
const recipientPublicKeyBytes = await crypto.subtle.exportKey(
  'raw-public',
  recipientKeyPair.publicKey,
);

// 2. Sender imports the recipient's public key and encapsulates a 256-bit AEAD key
const importedPublicKey = await crypto.subtle.importKey(
  'raw-public',
  recipientPublicKeyBytes,
  'MLKEM768-X25519',
  true,
  ['encapsulateKey'],
);

const { sharedKey: senderKey, ciphertext: encapsulatedCiphertext } =
  await crypto.subtle.encapsulateKey(
    'MLKEM768-X25519',
    importedPublicKey,
    'ChaCha20-Poly1305', // Or 'AES-GCM'
    false,
    ['encrypt', 'decrypt'],
  );

// 3. Recipient decapsulates the ciphertext capsule to recover the identical AEAD key
const recipientKey = await crypto.subtle.decapsulateKey(
  'MLKEM768-X25519',
  recipientKeyPair.privateKey,
  encapsulatedCiphertext,
  'ChaCha20-Poly1305',
  false,
  ['encrypt', 'decrypt'],
);
```

When you need domain separation (`info` and `salt`) or multiple derived subkeys from a single encapsulation, pass `'HKDF'` as `sharedKeyAlgorithm` with `['deriveKey']` usage, then call `crypto.subtle.deriveKey()`:

```javascript
const { sharedKey: hkdfBaseKey, ciphertext } = await crypto.subtle.encapsulateKey(
  'MLKEM768-X25519',
  importedPublicKey,
  'HKDF',
  false,
  ['deriveKey'],
);

const aeadKey = await crypto.subtle.deriveKey(
  {
    name: 'HKDF',
    hash: 'SHA-256',
    salt: new Uint8Array(32),
    info: new TextEncoder().encode('envelope-v1'),
  },
  hkdfBaseKey,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt', 'decrypt'],
);
```

## 2. Explicit Raw Key Formats and `getPublicKey()`

Modern WebCrypto algorithms (`'MLKEM768-X25519'`, `'ML-KEM-768'`, `'ML-KEM-1024'`, and `'ChaCha20-Poly1305'`) **reject the legacy `'raw'` format** in `importKey()` and `exportKey()` with a `NotSupportedError`. Always specify the exact key role format:

- **`'raw-public'`**: Public key bytes (also accepted on `'X25519'` and `'ECDH'` in browsers that support Modern WebCrypto; keep `'raw'` in fallback paths targeting older browsers).
- **`'raw-seed'`**: Private key seed bytes (`'MLKEM768-X25519'`, `'ML-KEM-768'`, `'ML-KEM-1024'`). Note that `'MLKEM768-X25519'` only supports `'raw-public'`, `'raw-seed'`, and `'jwk'`—it does **not** support `'spki'` or `'pkcs8'`.
- **`'raw-secret'`**: Symmetric secret key bytes (`'ChaCha20-Poly1305'`, and accepted on `'AES-GCM'` and `'HKDF'`).

If you hold a private `CryptoKey` (even with `extractable: false`) and need its corresponding public `CryptoKey`, call `crypto.subtle.getPublicKey()`:

```javascript
const publicKey = await crypto.subtle.getPublicKey(
  recipientKeyPair.privateKey,
  ['encapsulateKey'],
);
```

## 3. Authenticated Encryption (`ChaCha20-Poly1305` and `AES-GCM`)

Always encrypt payload data with an AEAD algorithm (`'ChaCha20-Poly1305'` or `'AES-GCM'`) using a fresh, cryptographically random **12-byte (96-bit) initialization vector (`iv`)** for every encryption operation. Never reuse an `(iv, key)` pair.

- **`'ChaCha20-Poly1305'`**: Uses a fixed 256-bit (32-byte) key (`generateKey('ChaCha20-Poly1305', extractable, ['encrypt', 'decrypt'])` takes a string or `{ name: 'ChaCha20-Poly1305' }` with **no `length` property**). The `iv` must be exactly 12 bytes, and the 128-bit Poly1305 authentication tag is appended to the ciphertext.
- **`'AES-GCM'`**: Pass `{ name: 'AES-GCM', length: 256 }` when calling `generateKey()` or `deriveKey()`, and a 12-byte `iv` when calling `encrypt()` and `decrypt()`.
- **`additionalData` (AAD)**: Bind unencrypted metadata (such as a record ID, sender ID, or protocol version) to the authentication tag via `additionalData` so tampering with the metadata causes `decrypt()` to reject with `OperationError`.

```javascript
/**
 * Encrypts UTF-8 text with an AEAD CryptoKey ('ChaCha20-Poly1305' or 'AES-GCM').
 * @param {CryptoKey} key
 * @param {string} plaintext
 * @param {Uint8Array} [additionalData]
 */
export async function encryptMessage(key, plaintext, additionalData = new Uint8Array(0)) {
  // Always generate a fresh 12-byte (96-bit) IV per message
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: key.algorithm.name,
      iv,
      additionalData,
    },
    key,
    encoded,
  );

  return { iv, ciphertext: new Uint8Array(ciphertextBuffer) };
}

/**
 * Decrypts and authenticates an AEAD payload. Throws OperationError if tampered.
 * @param {CryptoKey} key
 * @param {Uint8Array} iv
 * @param {Uint8Array} ciphertext
 * @param {Uint8Array} [additionalData]
 */
export async function decryptMessage(key, iv, ciphertext, additionalData = new Uint8Array(0)) {
  const plaintextBuffer = await crypto.subtle.decrypt(
    {
      name: key.algorithm.name,
      iv,
      additionalData,
    },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plaintextBuffer);
}
```

## Fallback strategies

{{ BASELINE_STATUS("web-cryptography") }}

If your Baseline target does not yet support `SubtleCrypto.supports()`, `encapsulateKey()`, or `ChaCha20-Poly1305`, detect support using the **static** `SubtleCrypto.supports()` method and fall back to ephemeral-static Diffie-Hellman key agreement (`X25519` + `HKDF` + `AES-GCM`):

- **Call `SubtleCrypto.supports()` on the `SubtleCrypto` constructor, not on `crypto.subtle`**: `globalThis.SubtleCrypto?.supports?.('encapsulateKey', 'MLKEM768-X25519', 'ChaCha20-Poly1305')` is a synchronous static method returning a boolean (`crypto.subtle.supports` is `undefined`). Note that `SubtleCrypto.supports()` validates operation-specific parameters: bare algorithm strings work for `'encapsulateKey'`, `'decapsulateKey'`, `'generateKey'`, and `'importKey'`, whereas probing `'encrypt'` or `'decrypt'` directly requires an `iv` (for example, `SubtleCrypto.supports('encrypt', { name: 'ChaCha20-Poly1305', iv: new Uint8Array(12) })`).
- **Classical fallback (`X25519` + `HKDF` + `AES-GCM`)**: When `SubtleCrypto.supports()` is unavailable or returns `false`, generate an ephemeral `'X25519'` key pair for the sender, export the ephemeral public key as the capsule bytes, derive 256 bits via `deriveBits({ name: 'X25519', public: peerPublicKey }, privateKey, 256)`, and pass those bits through `HKDF` (`SHA-256`) to derive a 256-bit `'AES-GCM'` key.

```javascript
export function supportsPostQuantumEnvelope() {
  return (
    typeof globalThis.SubtleCrypto?.supports === 'function' &&
    SubtleCrypto.supports('encapsulateKey', 'MLKEM768-X25519', 'ChaCha20-Poly1305')
  );
}

export async function generateRecipientKeys() {
  if (supportsPostQuantumEnvelope()) {
    const keyPair = await crypto.subtle.generateKey(
      'MLKEM768-X25519',
      false,
      ['encapsulateKey', 'decapsulateKey'],
    );
    const publicKeyBytes = new Uint8Array(
      await crypto.subtle.exportKey('raw-public', keyPair.publicKey),
    );
    return { suite: 'MLKEM768-X25519+ChaCha20-Poly1305', keyPair, publicKeyBytes };
  }

  // Classical fallback: X25519 key agreement + HKDF + AES-GCM
  const keyPair = await crypto.subtle.generateKey('X25519', false, ['deriveBits']);
  const publicKeyBytes = new Uint8Array(
    await crypto.subtle.exportKey('raw', keyPair.publicKey),
  );
  return { suite: 'X25519+HKDF+AES-GCM', keyPair, publicKeyBytes };
}

async function deriveFallbackAesKey(privateKey, peerPublicKey, infoBytes = new Uint8Array(0)) {
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'X25519', public: peerPublicKey },
    privateKey,
    256,
  );
  const hkdfKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32),
      info: infoBytes,
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encapsulateEnvelopeKey(
  recipientPublicKeyBytes,
  infoBytes = new Uint8Array(0),
) {
  if (supportsPostQuantumEnvelope()) {
    const pubKey = await crypto.subtle.importKey(
      'raw-public',
      recipientPublicKeyBytes,
      'MLKEM768-X25519',
      true,
      ['encapsulateKey'],
    );
    const { sharedKey, ciphertext } = await crypto.subtle.encapsulateKey(
      'MLKEM768-X25519',
      pubKey,
      'ChaCha20-Poly1305',
      false,
      ['encrypt', 'decrypt'],
    );
    return { sharedKey, capsuleBytes: new Uint8Array(ciphertext) };
  }

  // Classical fallback: generate ephemeral X25519 key pair and send ephemeral public key as capsule
  const recipientPubKey = await crypto.subtle.importKey(
    'raw',
    recipientPublicKeyBytes,
    'X25519',
    true,
    [],
  );
  const ephemeral = await crypto.subtle.generateKey('X25519', false, ['deriveBits']);
  const capsuleBytes = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));
  const sharedKey = await deriveFallbackAesKey(ephemeral.privateKey, recipientPubKey, infoBytes);
  return { sharedKey, capsuleBytes };
}

export async function decapsulateEnvelopeKey(
  recipientPrivateKey,
  capsuleBytes,
  infoBytes = new Uint8Array(0),
) {
  if (supportsPostQuantumEnvelope()) {
    return crypto.subtle.decapsulateKey(
      'MLKEM768-X25519',
      recipientPrivateKey,
      capsuleBytes,
      'ChaCha20-Poly1305',
      false,
      ['encrypt', 'decrypt'],
    );
  }

  const ephemeralPubKey = await crypto.subtle.importKey('raw', capsuleBytes, 'X25519', true, []);
  return deriveFallbackAesKey(recipientPrivateKey, ephemeralPubKey, infoBytes);
}
```
