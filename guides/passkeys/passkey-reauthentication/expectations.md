# Expectations for Passkey Reauthentication

*   The UI renders an explicit step-up biometrics button annotated with data-testid reauth-button.
*   The client invokes biometric re-verification by calling the credentials get API upon clicking the button.
*   The fetched options populate allowCredentials with pre-registered credentials descriptors list.
*   The options enforce user biometrics by explicitly commanding userVerification required.
*   The client decodes fetched reauth option parameters securely calling parseRequestOptionsFromJSON before prompting the user.
*   The client passes an AbortSignal to navigator.credentials.get so any in-flight conditional get can be cancelled before the step-up dialog opens.
*   The client submits the resulting assertion to the verify endpoint as JSON-encoded credential data containing the credential id.
