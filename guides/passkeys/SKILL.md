---
name: passkeys
description: Comprehensive orientation and cross-cutting principles for implementing WebAuthn and Passkeys in web applications. Use this skill when handling passkey registration, authentication, management, or reauthentication.
---

# Passkeys Orientation Guide

This category skill provides high-density, action-oriented orientation for implementing secure, framework-agnostic passkey authentication and credential management in modern web applications.

## 1. Core Prerequisites for Passkeys

Passkeys rely on the Web Authentication API (WebAuthn), which imposes strict cross-cutting security constraints that must be satisfied before any implementation attempt:
*   **Secure Contexts**: WebAuthn methods (`navigator.credentials.create` and `navigator.credentials.get`) are strictly gated behind Secure Contexts. Applications MUST run on `https://` in production, or `http://localhost` for local development.
*   **Relying Party (RP) ID**: Every credential is tied to an RP ID (essentially the domain name of the application). The RP ID passed in the server-side options MUST match or be a valid suffix of the current origin's domain name (e.g., `example.com` is valid for `login.example.com`). Mismatches result in `SecurityError` exceptions on the client side.

## 2. The AAGUID UX Caveat

The Authenticator Attestation Globally Unique Identifier (AAGUID) is a 128-bit identifier returned in the registration attestation data that represents the model/provider of the authenticator (e.g., Google Password Manager, iCloud Keychain, 1Password).
*   **UX Hinting Only**: Relying Parties MUST use the AAGUID exclusively for UX hints (such as rendering the passkey provider name and icon in a management list to help the user).
*   **No Security Dependencies**: applications MUST NOT use AAGUID for cryptographic security or access decisions. Platform passkeys do not currently provide cryptographic attestation for their AAGUIDs, meaning it can be altered or simulated by user agents.

## 3. Decoupled Library Recommendations

For backend FIDO2/WebAuthn options generation and signature verification, developers MUST rely on vetted open source libraries per language instead of hand-rolling cryptography:
*   **JavaScript/TypeScript**: SimpleWebAuthn (github.com/MasterKale/SimpleWebAuthn)
*   **Python**: py_webauthn (github.com/duo-labs/py_webauthn)
*   **Java**: Java WebAuthn Server (github.com/Yubico/java-webauthn-server), WebAuthn4J (github.com/webauthn4j/webauthn4j)
*   **.NET**: .NET library for FIDO2 (github.com/abergs/fido2-net-lib)
*   **Go**: WebAuthn Go Library (github.com/go-webauthn/webauthn)
*   **Ruby**: WebAuthn Ruby (github.com/cedarcode/webauthn-ruby)
*   **PHP**: WebAuthn Framework (github.com/web-auth/webauthn-framework)

## 4. Use Case Reference Matrix

Specific passkey and WebAuthn implementation details are mapped to the following guides under `guides/passkeys/`:
*   **[Passkey Registration](./passkey-registration/guide.md)**: Offering new passkey registration and promotions.
*   **[Passkey Authentication](./passkey-authentication/guide.md)**: Discoverable-autofill and button sign-ins.
*   **[Passkey Management](./passkey-management/guide.md)**: Syncing lists, renames, and deletions with password managers.
*   **[Passkey Reauthentication](./passkey-reauthentication/guide.md)**: Re-verifying returning signed-in users for sensitive steps.
