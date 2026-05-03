# Expectations for Passkey Authentication

*   The HTML form elements safely annotate the username input tags with autocomplete tokens space-separated autocomplete="username webauthn" and autofocus.
*   The application automatically initializes and registers browser autofill Conditional UI passkey suggestions on DOM load with mediation conditional.
*   The explicit sign-in button click triggers the AbortController signal abort to cancel background autofill before explicitly triggering biometrics.
*   The client decodes fetched JSON option parameters calling parseRequestOptionsFromJSON before prompting the user.
*   The application try/catch blocks safely handle and segregate standard user cancels from server-side verify exceptions.
*   If the server verify endpoint returns a pre-authentication unknown credential error, PublicKeyCredential.signalUnknownCredential is triggered passing the Base64URL credential ID.
