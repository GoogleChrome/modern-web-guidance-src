---
description: Simplify phone number verification for users by automatically filling SMS OTPs on desktop and mobile.
filename: webotp-api-phone-verification
category: identity
---

# Verify a phone number on desktop using WebOTP API

Starting from Chrome 93, websites can verify phone numbers from desktop Chrome.

## Best Practices

### Obtain OTP via SMS

The WebOTP API allows websites to programmatically obtain a one-time password (OTP) from an SMS message. This enables users to verify their phone number with a single tap, eliminating the need to switch between apps and manually enter the code. The SMS must be formatted with origin-bound one-time codes for security.

```javascript
const otp = await navigator.credentials.get({
  otp: { transport:['sms'] }
});
if (otp.code) input.value = otp.code;
```

The SMS should follow this format:

```text
Your OTP is: 123456.

@web-otp-demo.glitch.me #123456
```

### Cross-Platform Compatibility

The WebOTP API on desktop works identically to its mobile counterpart. This means websites can deploy the same code across both desktop and mobile platforms for a consistent user experience.

## Fallback Strategies

While the WebOTP API is powerful, consider the following for broader compatibility and graceful degradation:

### SMS Format Adherence

*   **DO** ensure SMS messages strictly adhere to the origin-bound one-time code format, including the `@origin #OTP` at the end. This is crucial for the browser to recognize and process the OTP.
*   **DO** be aware that if the sender's phone number is in the receiver's contact list, the SMS may not trigger the WebOTP dialog due to design choices by certain platforms. Provide alternative verification methods or guide users on how to test with different numbers.

### Browser Support

*   **DO** acknowledge that the WebOTP API is currently a Chrome-only feature, relying on Chrome Sync for cross-device functionality.
*   **DO** inform users that receiving and transmitting SMS on iOS or iPadOS in Chrome is not supported.
*   **DO** leverage Safari's `input[autocomplete="one-time-code"]` support as a potential fallback. When an SMS with the correct format arrives on iOS/iPadOS and iMessage auto-sync is enabled, the message can be forwarded to macOS, and Safari will suggest the OTP if the user focuses on the input field.