---
description: Enhance web applications by progressively adding new browser capabilities for an advanced user experience on modern browsers.
filename: progressive-enhancement
category: pwa
---

# Progressive Enhancement

Reference docs:
- https://web.dev/progressive-enhance-your-pwa/
- https://developer.chrome.com/blog/fugu-greetings/
- https://goo.gle/3dEcyH2

## Best Practices

Progressive enhancement in 2020 focuses on leveraging modern browser capabilities to deliver an advanced experience. The core principle is to ensure a baseline experience for all users, and then layer on advanced features for those whose browsers support them. This approach ensures your web application remains useful and accessible to everyone, regardless of their browser's capabilities, while offering a richer experience to those on more capable browsers.

An example use case is a greeting card web application. By using new and upcoming browser capabilities, such as native file system access, system clipboard access, contacts retrieval, periodic background sync, and screen wake lock, you can progressively enhance this application. This means it will function on all modern browsers, but offer a more sophisticated and feature-rich experience on browsers that support these advanced APIs.

Key benefits include:
- **Universality**: The application remains usable on all browsers.
- **Enhanced Experience**: Users with capable browsers get advanced features.
- **No Download Burden**: Users on incompatible browsers are not penalized with extra download weight.
- **Inclusivity**: No user is excluded from using the web application.

**DO** prioritize core content and functionality.
**DO** identify modern browser capabilities that can enhance the user experience.
**DO** implement features in a way that degrades gracefully if the capability is not supported.
**DO** consider features like native file system access, system clipboard access, contacts retrieval, periodic background sync, and screen wake lock for enhanced applications.
**DO** refer to resources like the Fugu API tracker to stay updated on new capabilities and their status.

## Fallback Strategies

For features that might not be widely supported, implement robust fallback strategies.

### Feature Detection

- **DO** use JavaScript for feature detection. For example, check for the existence of specific properties or methods on browser APIs.
- **DO** conditionally load polyfills or alternative implementations only when a feature is not supported.

### Resource Loading

- **DO NOT** assume all users have access to the latest features.
- **DO** provide links to resources that explain new capabilities and their support status.
- **DO** offer alternative methods for users without access to advanced features (e.g., traditional file uploads instead of direct file system access if not supported).

Resources:
- Fugu greetings on GitHub → [https://goo.gle/2VkuwYM](https://goo.gle/2VkuwYM)
- New capabilities status → [https://goo.gle/3dEcyH2](https://goo.gle/3dEcyH2)
- Video write-up → [https://web.dev/progressively-enhance-your-pwa/](https://web.dev/progressively-enhance-your-pwa/)