# Expectations for Passkey Reauthentication

*   The UI renders an explicit step-up passkey sign-in button.
*   Clicking the step-up button fetches reauthentication options from `/api/reauth/options` and passes the parsed `publicKey` options (preserving `allowCredentials`) to `navigator.credentials.get`.
*   The client decodes fetched reauth option parameters securely calling `parseRequestOptionsFromJSON` before prompting the user.
*   The client passes an `AbortSignal` to `navigator.credentials.get` so any in-flight conditional get can be canceled before the step-up dialog opens.
*   The client submits the resulting assertion to the verify endpoint as JSON-encoded credential data containing the credential id.
