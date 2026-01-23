---
description: Securely confirm payments on the web using phishing-resistant passkeys with Secure Payment Confirmation.
filename: secure-payment-confirmation
category: security
---

# Secure Payment Confirmation

Reference docs:
- [Secure Payment Confirmation - Chrome Developers](/articles/secure-payment-confirmation)
- [Register a Secure Payment Confirmation - Chrome Developers](/articles/register-secure-payment-confirmation)
- [Authenticate with Secure Payment Confirmation - Chrome Developers](/articles/authenticate-secure-payment-confirmation)
- [EMV 3-D Secure v2.3 spec](https://www.emvco.com/emv_insights_post/what-is-new-with-emv-3ds-v2-3/)
- [W3C Secure Payment Confirmation](https://www.w3.org/TR/secure-payment-confirmation/)

## Overview

Secure Payment Confirmation (SPC) is a proposed web standard that allows customers to authenticate with their credit card issuer, bank, or other payment service provider using a platform authenticator—typically activated with a device's screen unlock feature such as a fingerprint sensor. This usually happens during a payments authentication protocol such as EMV 3-D Secure or Open Banking.

SPC builds on top of Web Authentication (WebAuthn) to bring strong authentication to payment transactions, using _platform authenticators_ that are built into users' devices. The authenticating party (known as the relying party in WebAuthn), such as the issuing bank or a payment service provider, registers the user in a one-time process either on their website or during a traditionally-authenticated transaction. They may then use the registration to authenticate the user in subsequent payment flows.

## Best Practices

### Strong authentication for payments

*   **DO** leverage SPC to provide a phishing-resistant payment confirmation using passkeys.
*   **DO** use SPC to reduce cart abandonment caused by friction in existing authentication methods like SMS OTP.
*   **DO NOT** expose biometric data outside of the user's device; user verification should happen locally.
*   As long as the relying party is the same (e.g., the same issuing bank), the user should be able to use one registration for all future payments with that relying party across any merchant that integrates SPC.

### API Usage

*   **DO** follow the existing implementation guide for desktop integration to learn how the API works.
*   **DO** use the `payment: { isPayment: true }` extension to indicate an SPC credential during creation.
*   **DO** set `authenticatorSelection.residentKey` to `'preferred'` or `'required'` for SPC. Note that the SPC specification does not allow passing `'discouraged'` for the `residentKey` parameter.
*   Currently, non-discoverable credentials work for SPC. Once discoverable credentials are supported by SPC for Google Chrome on Android, the code will automatically switch to creating discoverable credentials instead.

## Resources

*   [Demo website](https://spc-merchant.glitch.me/)
*   [SPC specification](https://w3.github.io/secure-payment-confirmation/)

Photo by [Franck](https://unsplash.com/es/@franckinjapan?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText) on [Unsplash](https://unsplash.com/?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText)