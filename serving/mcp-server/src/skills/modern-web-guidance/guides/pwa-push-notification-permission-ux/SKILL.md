---
description: Guides developers on implementing effective user permission requests for web push notifications to improve user experience and reduce blocking.
filename: push-notification-permission-ux
category: pwa
---

# Push Notification Permission UX

Reference docs:
- [Web Permissions Best Practices](/articles/permissions-best-practices)
- [How Google Meet improved their permission flow](/case-studies/google-meet-permissions-best-practices)
- [Web Push Notification Overview](/articles/push-notifications-overview)

## Best Practices

When asking users for permission to send push notifications, prioritize a positive user experience by providing context and value.

### Value Proposition

Ask users to subscribe to push notifications at a time when the benefit is obvious and directly related to their current action or interest.

For example:
- Offering updates on an item's availability after a purchase.
- Providing notifications for breaking news updates on a story a user is following.
- Alerting a user if they are outbid on an auction.

**DO** present the value proposition before showing the browser's permission prompt.
**DO** consider using a custom UI to explain the benefits before triggering the native prompt.
**DO NOT** ask for permission as soon as a user lands on your site without any context.

Owen Campbell-Moore's airline website mock demonstrates a good approach by asking for flight delay notifications *after* a flight has been booked.

**DO** highlight the permission prompt to draw user attention, for example, by using a semi-transparent overlay.

### Double Permission Pattern

For applications where immediate notifications are crucial (e.g., instant messaging, email clients), consider a "double permission" pattern.

1.  **DO** display a custom dialog first, explaining the specific value and use case for push notifications within your application.
2.  **DO** offer clear buttons within this custom dialog to either enable or forego the permission request.
3.  **DO** trigger the browser's native permission prompt only if the user positively signals their intent in your custom dialog.
4.  **DO** respect the user's choice if they decline in your custom UI by hiding the dialog and not proceeding to the native prompt. This prevents the user from being permanently blocked due to annoyance.

### Settings Panel

**DO** provide a dedicated settings panel where users can easily manage their notification preferences, including enabling and disabling push messages.

The Google I/O site is a good example:
- Users are not prompted upon initial load, allowing them to explore.
- A settings panel, accessible via a menu item, allows users to manage notifications.
- Clicking a checkbox in the settings panel triggers the permission prompt, making it transparent and controlled.

**DO** ensure that users can enable and disable notifications from a single, easily discoverable location.

### Passive Approach

For sites with a mix of regular and drive-by visitors (e.g., blogs), a passive approach can be effective.

**DO** place a toggle switch or button in a consistent, accessible location (e.g., footer) for users to opt-in or out of push messages.
**DO** ensure this passive approach does not interrupt the user's primary flow or annoy casual visitors.
**DO** maintain the state of the toggle switch across the site once a user makes a choice.

On gauntface.com, a toggle switch in the footer allows users to subscribe to updates without being intrusive to one-time visitors.

### The Bad UX

The worst approach is to request permission as soon as a user lands on your site.

**DO NOT** show the permission dialog immediately upon page load.
**DO NOT** ask for permission without providing any context about your site or the benefits of push notifications.
**DO NOT** block the user from their intended task with an unsolicited permission prompt.

Remember, if a user *blocks* the permission request, your web app cannot ask again without the user manually changing browser settings, which is difficult and not user-friendly.

### Offer a Way Out

**ALWAYS** provide clear instructions and a user interface for unsubscribing or opting out of push notifications.

**DO NOT** assume users will want to remain subscribed permanently after initially granting permission.
**DO** clearly explain how users can disable push notifications. Failure to do so may lead users to permanently block permissions as a last resort.

## Fallback Strategies

While not explicitly detailed in the provided text, consider that users may have push notifications disabled or managed at the browser or OS level.

- **DO** inform users if push notifications are not supported or enabled in their current environment.
- **DO** provide alternative methods for users to receive important updates if push notifications are not an option.