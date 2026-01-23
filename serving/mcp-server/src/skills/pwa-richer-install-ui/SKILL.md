---
description: Enhance web app installation with richer UI elements that provide more context and visual information to users, similar to app store experiences.
filename: richer-install-ui
category: pwa
---

# Richer Install UI for Web Apps

Reference docs:
- [Richer Install UI pattern](https://web.dev/articles/patterns/web-apps/richer-install-ui)

## Best Practices

To enable the Richer Install UI, developers must include at least one screenshot for each form factor (desktop and mobile) within the `screenshots` array of the web app's manifest. The `description` field is optional but highly recommended, as its content, along with the screenshots, forms the richer installation dialog. This provides users with more context about the app at install time, making the experience more akin to installing from a traditional app store.

**DO** use the `description` field to highlight key app features that would incentivize users to install and keep the app.
**DO** use screenshots to showcase the visual appearance and user experience of the web app, emphasizing its standalone nature and ease of access.
**DO** ensure screenshots are relevant to the target form factor (desktop or mobile).

The Richer Install UI is available for mobile from Chrome 94 and for desktop from Chrome 108. While Chrome continues to support simpler install dialogs, the richer UI offers a valuable opportunity for developers to present their web apps more effectively.

**DO NOT** rely solely on the default, minimal install dialog for web apps, as it often lacks sufficient context and can lead to user confusion or uninstalls.

## Enabling Richer Install UI

To implement this feature, add the necessary `screenshots` and descriptive text to your web app's manifest file.

For example, developers can refer to the [Squoosh app manifest file](https://squoosh.app/manifest.json) for a practical implementation. You can experience the richer install dialog live at [https://squoosh.app/](https://squoosh.app/).

## Feedback and Future Considerations

The team is exploring additional features for richer installs, such as categories and app ratings. Developer and user feedback is crucial in shaping these future enhancements.

**DO** provide feedback on the Richer Installs UI through the [feedback form](https://forms.gle/7sXrpQwDbLuaZVzN7) if you encounter unexpected behavior or have specific data requirements.

## Caution

This is an experimental UI and is subject to change based on ongoing feedback. The goal is to improve user expectations and provide better decision-making signals for app installations.