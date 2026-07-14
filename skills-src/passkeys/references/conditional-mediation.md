Conditional Mediation is also known as Conditional UI or Conditional Get. This allows users to sign in using their passkeys directly from the browser's autofill suggestions, providing a seamless transition from passwords to passkeys.

Passkey form autofill leverages the `mediation: 'conditional'` property in the WebAuthn `navigator.credentials.get()` call. When implemented, the browser doesn't show a modal immediately. Instead, it waits until the user focuses on an input field annotated with `autocomplete="username webauthn"`.

## Implementation Steps

### 1. Annotate the Sign-in Form
Add `autocomplete="username webauthn"` to your username input field, or `autocomplete="password webauthn"` to your password input field. Also add `autofocus` to the same `input` tag to trigger the autofill prompt immediately on page load.

```html
<form id="signin-form">
  <input type="text" name="username" autocomplete="username webauthn" autofocus>
  <input type="password" name="password" autocomplete="current-password">
  <button type="submit">Sign in</button>
</form>
```

### 2. Feature Detection
Check if the browser supports Conditional Get with `PublicKeyCredential.getClientCapabilities()` and check if `conditionalGet` is supported before making the call.

```javascript
if (window.PublicKeyCredential && PublicKeyCredential.getClientCapabilities) {
  const capabilities = await PublicKeyCredential.getClientCapabilities();
  if (capabilities.conditionalGet === true) {
    // The browser supports passkeys and the conditional mediation.
  }
}
```

### 3. Call WebAuthn with Conditional Mediation
Invoke `navigator.credentials.get()` with `mediation: 'conditional'` to activate form autofill.

```javascript
const abortController = new AbortController();

try {
  const credential = await navigator.credentials.get({
    publicKey: options,
    signal: abortController.signal,
    mediation: 'conditional'
  });
  ...
```

