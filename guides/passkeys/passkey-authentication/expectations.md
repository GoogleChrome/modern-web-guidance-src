# Expectations for Passkey Authentication

*   The HTML form annotates the username input element with autocomplete="username webauthn" and autofocus.
*   The client feature detects capabilities using PublicKeyCredential.getClientCapabilities before initializing Conditional UI.
*   The application registers Conditional UI suggestions automatically on load with mediation="conditional".
*   The explicit biometrics button click aborts pending Conditional UI autofill suggestions prior to prompting users.
*   If the server verification endpoint returns an explicit HTTP 404 status, PublicKeyCredential.signalUnknownCredential is invoked passing the Base64URL credential ID.
*   A successful credential verification updates the UI status to indicate successful authentication and session establishment.
