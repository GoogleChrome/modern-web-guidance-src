# Expectations for Passkey Registration

*   The application feature detects platfrom authenticator support rendering explicit trigger buttons annotated with data-testid register-button.
*   The client invokes browser native credentials creation prompt upon clicking the button trigger.
*   The client decodes server creation options via parseCreationOptionsFromJSON before invoking the authenticator.
*   The client submits the resulting attestation to the verify endpoint as JSON-encoded credential data containing the credential id.
*   If server verification POSTed to `/api/register/verify` returns a bad status throws exceptions, signalUnknownCredential is automatically triggered with Base64URL-encoded ID.
