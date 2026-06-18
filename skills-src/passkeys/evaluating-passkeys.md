# Passkey Skills Evaluation

Evaluate the current codebase against the passkey best practices from the `passkeys-web` and `simplewebauthn` skills. For each check, search the codebase for evidence and report **PASS**, **FAIL**, or **N/A** (if the feature area is not yet implemented).

## Instructions

1. Read all relevant source files (server-side auth routes, database layer, client-side HTML/JS).
2. Evaluate each item below by searching the code for the specified pattern or behavior.
3. Report results in a markdown table with columns: `#`, `Check`, `Status`, `Evidence` (file + line or brief note).
4. Summarize totals at the end: PASS / FAIL / N/A counts.

---

## Registration

Source: `passkeys-web/registration.md`, `simplewebauthn/SKILL.md`

### Database Schema

| #   | Check                                          | What to look for                              |
| --- | ---------------------------------------------- | --------------------------------------------- |
| R1  | `id` (Base64URLString) stored                  | Credential ID stored as string                |
| R2  | `passkeyUserId` stored                         | User ID associated with credential            |
| R3  | `credentialPublicKey` (Base64URLString) stored | Public key stored (Base64URL encoded)         |
| R4  | `credentialType` stored                        | e.g. `'public-key'`                           |
| R5  | `credentialDeviceType` stored                  | `'singleDevice'` or `'multiDevice'`           |
| R6  | `credentialBackedUp` stored                    | Boolean backup state                          |
| R7  | `aaguid` stored                                | AAGUID string                                 |
| R8  | `name` stored (AAGUID-derived)                 | Provider name is derived from AAGUID registry |
| R9  | `providerIcon` stored                          | Provider icon is derived from AAGUID registry |
| R11 | `transports` stored                            | Array of transports                           |
| R12 | `lastUsedAt` stored                            | Optional last used epoch time                 |
| R13 | `registeredAt` stored                          | Registration timestamp                        |

### Server — Generate Options Endpoint

| #   | Check                                           | What to look for                                         |
| --- | ----------------------------------------------- | -------------------------------------------------------- |
| R14 | Challenge stored in session                     | `req.session.challenge = options.challenge` or similar   |
| R15 | `excludeCredentials` uses existing credentials  | Existing user credentials mapped to `excludeCredentials` |
| R16 | `authenticatorAttachment: 'platform'`           | Specified for passkey promotion                          |
| R17 | `authenticatorAttachment` not specified         | Not specified for dedicated passkey management page      |
| R18 | `residentKey: 'required'`                       | In `authenticatorSelection`                              |
| R19 | `requireResidentKey: true`                      | In `authenticatorSelection`                              |
| R20 | `userVerification: 'preferred'` or `'required'` | In `authenticatorSelection`                              |
| R21 | `userID` passed as binary (SimpleWebAuthn)      | Pass `credential.id` obtained from                       |

### Server — Verify Response Endpoint

| #   | Check                                             | What to look for                                        |
| --- | ------------------------------------------------- | ------------------------------------------------------- |
| R22 | Challenge verified                                | `expectedChallenge` from session passed to verification |
| R23 | `requireUserVerification: false` (if `preferred`) | Accepts UV=false                                        |
| R24 | AAGUID lookup from registry                       | `aaguids[aaguid]` or similar lookup                     |
| R25 | HTTP 404 on missing public key                    | Returns 404 if matching public key isn't found in DB    |

### Client — Registration Flow

| #   | Check                                         | What to look for                                    |
| --- | --------------------------------------------- | --------------------------------------------------- |
| R26 | Feature detection: `getClientCapabilities()`  | Check for `passkeyPlatformAuthenticator` capability |
| R27 | `parseCreationOptionsFromJSON()` used         | Decodes server options to WebAuthn format           |
| R28 | `InvalidStateError` handled                   | Specific catch for duplicate passkey                |
| R29 | `SecurityError` handled                       | HTTPS / RP ID mismatch error handled                |
| R30 | `NotAllowedError` handled                     | User cancellation handled gracefully                |
| R31 | `AbortError` handled                          | Operation aborted handled                           |
| R32 | `toJSON()` encoding                           | `credential.toJSON()` before sending to server      |
| R33 | `signalUnknownCredential()` on server failure | Called ONLY when server `fetch` verification fails  |

### Conditional Create

Source: `passkeys-web/references/conditional-create.md`

| #   | Check                                      | What to look for                                                                                            |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| CC1 | Trigger moment                             | Invoked immediately after a successful, full sign-in that involved a password (e.g., after 2FA is complete) |
| CC2 | Feature detection                          | `capabilities.conditionalCreate` checked                                                                    |
| CC3 | Ongoing Conditional Get aborted            | `abortController.abort()` called before create                                                              |
| CC4 | Conditional mediation                      | `mediation: 'conditional'` used in `navigator.credentials.create()`                                         |
| CC5 | Silent exceptions handled                  | Specific catch and ignore for `InvalidStateError`, `NotAllowedError`, `AbortError`                          |
| CC6 | Server ignores User Presence conditionally | `requireUserPresence: false` in `verifyRegistrationResponse()` ONLY when triggered from conditional create  |
| CC7 | Session check enforced                     | User session is validated (e.g. `sessionCheck` middleware) before conditional registration                  |

---

## Authentication

Source: `passkeys-web/authentication.md`

### Server — Generate Options Endpoint

| #   | Check                                        | What to look for                            |
| --- | -------------------------------------------- | ------------------------------------------- |
| A1  | `generateAuthenticationOptions` imported     | From `@simplewebauthn/server`               |
| A2  | Challenge stored in session                  | `req.session.challenge = options.challenge` |
| A3  | `allowCredentials: []` (empty, discoverable) | Empty array for passkey authentication      |
| A4  | `userVerification: 'preferred'`              | In options (unless required by user)        |

### Server — Verify Response Endpoint

| #   | Check                                    | What to look for                                  |
| --- | ---------------------------------------- | ------------------------------------------------- |
| A5  | `verifyAuthenticationResponse` imported  | From `@simplewebauthn/server`                     |
| A6  | Challenge verified                       | `expectedChallenge` from session passed           |
| A7  | UV flag not verified                     | Unless `'required'` is passed at frontend         |
| A8  | HTTP 404 on missing public key           | Returns 404 if matching public key isn't found    |
| A9  | `credentialPublicKey` passed (as buffer) | Public key converted from stored format           |
| A10 | Counter passed to verification           | `authenticator.counter` from DB                   |
| A11 | Counter updated after verification       | `authenticationInfo.newCounter` saved to DB       |
| A12 | User signed in after success             | Session updated (e.g. `req.session['signed-in']`) |

### Client — Authentication Flow

| #   | Check                                | What to look for                                              |
| --- | ------------------------------------ | ------------------------------------------------------------- |
| A13 | Authentication function exists       | Client-side code that calls signin endpoint                   |
| A14 | Feature detection                    | `getClientCapabilities()` checks passkeyPlatformAuthenticator |
| A15 | Conditional UI (autofill) support    | `mediation: 'conditional'` property parameter                 |
| A16 | `parseRequestOptionsFromJSON()` used | Decodes server options to WebAuthn format                     |
| A17 | `AbortController` attached           | Used in `navigator.credentials.get({ signal })`               |
| A18 | `NotAllowedError` handled            | Specific catch                                                |
| A19 | `AbortError` handled                 | Specific catch                                                |
| A20 | `toJSON()` encoding                  | Response encoded with `toJSON()`                              |
| A21 | `signalUnknownCredential()` handled  | Called ONLY when server explicitly responds with HTTP 404     |
| A22 | Form annotated for autofill          | `autocomplete="username webauthn"` or `password webauthn`     |
| A23 | Autofill triggers automatically      | `autofocus` attribute present on annotated input              |
| A24 | Autofill feature detection           | `capabilities.conditionalGet` checked before starting         |

---

## Management

Source: `passkeys-web/management.md`

### Server

| #   | Check                                   | What to look for                                      |
| --- | --------------------------------------- | ----------------------------------------------------- |
| M1  | Endpoint: list all credentials for user | GET/POST route returning user's credentials           |
| M2  | Endpoint: rename credential             | Route accepting credential ID + new name, updating DB |
| M3  | Endpoint: delete credential             | Route accepting credential ID, removing from DB       |

### Client — UI

| #   | Check                         | What to look for                       |
| --- | ----------------------------- | -------------------------------------- |
| M4  | Passkey list rendered         | Credentials displayed in a list        |
| M5  | Each item shows provider icon | AAGUID-derived icon displayed          |
| M6  | Each item shows passkey name  | AAGUID-derived name or custom name     |
| M7  | Each item shows date          | `registeredAt` formatted and displayed |
| M8  | Rename button per passkey     | UI element to trigger rename           |
| M9  | Delete button per passkey     | UI element to trigger delete           |
| M10 | Create passkey button         | Button to register a new passkey       |
| M11 | Empty state message           | Helpful text when no passkeys exist    |

### Client — Signal API

| #   | Check                                         | What to look for                                 |
| --- | --------------------------------------------- | ------------------------------------------------ |
| M12 | Method feature detection check                | e.g. `if (PublicKeyCredential.signalMethodName)` |
| M13 | `signalAllAcceptedCredentials()` on page load | Called when management page loads                |
| M14 | `signalAllAcceptedCredentials()` after delete | Called after a passkey is deleted                |
| M15 | `signalCurrentUserDetails()` after rename     | Called after display name or passkey name change |
| M16 | Base64URL-encoded parameters used             | Parameters are string, not BufferSource          |

---

## Reauthentication

Source: `passkeys-web/reauthentication.md`

### Server — Generate Options Endpoint

| #   | Check                           | What to look for                                                             |
| --- | ------------------------------- | ---------------------------------------------------------------------------- |
| RA1 | `allowCredentials` contains IDs | List of `PublicKeyCredentialDescriptor` objects mapped to `allowCredentials` |

### Server — Verify Response Endpoint

| #   | Check                               | What to look for                                                       |
| --- | ----------------------------------- | ---------------------------------------------------------------------- |
| RA2 | Assertion belongs to signed-in user | Server explicitly verifies the assertion belongs to the signed-in user |

### Client — Reauthentication Flow

| #   | Check                 | What to look for                                                 |
| --- | --------------------- | ---------------------------------------------------------------- |
| RA3 | Appropriate flow used | Uses button flow (if no form) or conditional mediation (if form) |

---

## Signal API

Source: `passkeys-web/references/signal-api.md`

| #   | Check                                       | What to look for                                                                |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| S1  | Feature detection                           | `if (PublicKeyCredential.signalMethodName)` guard                               |
| S2  | `signalAllAcceptedCredentials()` parameters | passes `rpId`, `userId`, `allAcceptedCredentialIds` (Base64URL-encoded strings) |
| S3  | `signalCurrentUserDetails()` parameters     | passes `rpId`, `userId`, `name`, `displayName`                                  |
| S4  | `signalUnknownCredential()` parameters      | passes `rpId`, `credentialId` (Base64URL-encoded strings)                       |

---

## AAGUID Handling

Source: `passkeys-web/references/determine-passkey-provider-from-aaguid.md`

| #   | Check                                 | What to look for                                             |
| --- | ------------------------------------- | ------------------------------------------------------------ |
| G1  | AAGUID registry JSON present          | `aaguids.json` or similar file with AAGUID mappings          |
| G2  | AAGUID lookup after registration      | `registrationInfo.aaguid` used to look up provider           |
| G3  | Provider name populated from registry | `provider?.name` or fallback to `'Unknown passkey provider'` |
| G4  | Provider icon populated from registry | `provider?.icon_dark` or `provider?.icon_light`              |
| G5  | Zeroed AAGUID handled                 | Fallback for `00000000-0000-0000-0000-000000000000`          |
