# Passkey Reauthentication Implementation

Rely on a Passkey/WebAuthn/FIDO2 library that suit your server language.

## 1. Server-Side

### Generate Options Endpoint

- Pass the list of `PublicKeyCredentialDescriptor` objects containing user credential IDs to `allowCredentials` so authentication is constrained to associated passkeys.

### Verify Response Endpoint

- Perform common logic as the regular authentication.
- Verify that the assertion belongs to the user who is signing in.

## 2. Client-Side

Depending on the reauthentication page, choose from one of two reauthentication methods:
- If there is no sign-in form: use a button flow
- If there is a sign-in form: use conditional mediation

### Button flow

- Follow the flow described in [[./authentication]] except `allowCredentials` contain credential IDs.

### Conditional mediation

- Follow [[./references/conditional-mediation]].


