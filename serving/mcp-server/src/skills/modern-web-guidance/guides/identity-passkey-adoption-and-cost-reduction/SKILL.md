---
description: Improve user adoption and reduce costs by transitioning to passwordless authentication with passkeys.
filename: passkey-adoption-and-cost-reduction.md
category: identity
---

# Improve Passkey Adoption and Reduce Costs

Reference docs:
- https://fidoalliance.org/ux-guidelines/
- https://developers.google.com/identity/passkeys/ux/user-journeys

## Best Practices

Leverage passkeys to enhance user experience, increase adoption rates, and significantly reduce operational costs associated with traditional authentication methods like SMS OTP.

**Key strategies for increasing passkey adoption:**

*   **Integrate Passkey Prompts Strategically:** Offer passkey registration immediately after a user logs in or signs up. This targets users who are already in the mindset of managing authentication and are more likely to adopt new methods.
*   **Optimize Registration Prompts:** Conduct A/B testing on the wording of passkey registration prompts. Tailor the language to utilize device-specific biometric features (e.g., "Face ID," "Windows Hello") as this is more familiar to users and has shown higher click-through rates.
*   **Support Synced Passkeys:** Transition from device-bound passkeys to synced passkeys to improve user experience when users switch devices. Synced passkeys ensure continuity of authentication across multiple devices, reducing user frustration and churn.
*   **Educate Users:** Clearly communicate the benefits of passkeys through newsletters and information pages. Direct users to passkey management settings from these educational resources.

**Metrics to track success:**

*   Percentage of total logins using passkeys.
*   Percentage of smartphone logins using passkeys.
*   Authentication speed compared to previous methods.
*   Decrease in user inquiries related to forgotten credentials.
*   Passkey registration rates via different flows (login prompt, sign-up prompt, management screen).
*   Ratio of synced passkeys among registered credentials.

## Fallback strategies

While passkeys offer significant advantages, ensure a smooth transition and continued access for users who may not yet adopt them.

### User Onboarding and Education

*   **DO** provide clear and concise explanations of what passkeys are and their benefits.
*   **DO** offer multiple opportunities for users to learn about and register for passkeys (e.g., post-login prompts, dedicated account settings section, newsletters).
*   **DO** use clear, user-friendly language and avoid overly technical jargon.

### Transition from Device-Bound to Synced Passkeys

*   **DO** clearly communicate the benefits of synced passkeys for cross-device usability.
*   **DO** provide a straightforward migration path for users with existing device-bound passkeys to adopt synced passkeys.
*   **DO** monitor and address any user friction points during the transition period.

### Alternative Authentication Methods

*   **DO** maintain support for alternative authentication methods (e.g., SMS OTP, traditional passwords) for users who are not yet ready or able to use passkeys.
*   **DO** continue to optimize these alternative methods to ensure they remain secure and cost-effective where applicable.
*   **DO** aim to reduce reliance on expensive or less secure methods over time as passkey adoption grows.