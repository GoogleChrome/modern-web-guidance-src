# Expectations for Passkey Authentication

*   The implementation MUST load a webauthn-polyfills library. 
*   The HTML form annotates the username input element with autocomplete="username webauthn" and autofocus.
*   The client feature detects capabilities using PublicKeyCredential.getClientCapabilities and skips initializing Conditional UI when conditionalGet is not available.
*   The client decodes fetched credential options via parseRequestOptionsFromJSON before invoking navigator.credentials.get.
*   The application registers Conditional UI suggestions automatically on load with mediation="conditional".
*   The explicit passkey sign-in button click aborts pending Conditional UI autofill suggestions prior to prompting users.
*   If the server verification endpoint returns an explicit HTTP 404 status, PublicKeyCredential.signalUnknownCredential is invoked.
*   A successful credential verification updates the UI status to indicate successful authentication and session establishment.
