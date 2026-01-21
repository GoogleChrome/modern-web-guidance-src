description: Enhance existing Adobe Experience Manager (AEM) websites into Progressive Web Apps (PWAs) with Workbox for an app-like experience without coding.
filename: enhance-aem-site-to-pwa
category: pwa
---

# Progressive Web Apps on Adobe Experience Manager

Reference docs:
- [Progressive Web Apps Overview](https://developer.chrome.com/docs/progressive-web-apps/)
- [Workbox Documentation](https://developer.chrome.com/docs/workbox/service-worker-overview)
- [Adobe Experience Manager Sites](https://business.adobe.com/products/experience-manager/sites/aem-sites)

## Best Practices

To enhance an AEM site into a Progressive Web App (PWA) with Workbox, focus on configuring the web app manifest and the service worker through the AEM user interface. This approach leverages Workbox behind the scenes to simplify PWA development without requiring custom code.

### Configure the Manifest

The web app manifest defines the look and behavior of your PWA. AEM provides a user-friendly interface to configure its properties, including:

*   **`name` and `short_name`**: The display name of your PWA.
*   **`start_url`**: The entry point for your PWA when launched from the device. This can be different from the default landing page to provide a more app-like experience.
*   **`display`**: Determines how the PWA is displayed (e.g., `standalone` for an app-like window).
*   **`theme_color` and `background_color`**: Control the visual appearance of the PWA's window and splash screen.
*   **`orientation`**: Specifies the preferred screen orientation.
*   **`icons`**: Defines the icons used to represent the PWA on the device. Ensure you use maskable icons for adaptive icon support.

AEM supports localization, allowing you to configure different manifest properties for different locales and synchronize them with linked pages.

You can inspect the generated manifest in browser DevTools under the "Applications" panel.

```json
{
  "name": "WKND Adventures and Travel",
  "short_name": "WKND Adventures and Travel",
  "start_url": "/content/wknd/us/en.html",
  "display": "standalone",
  "theme_color": "#FFDC00",
  "background_color": "#FF851B",
  "orientation": "any",
  "icons": [
    {
      "src": "/content/dam/wknd/pwa-logo.png",
      "type": "image/png",
      "sizes": "512x512",
      "purpose": "any maskable"
    }
  ]
}
```

### Configure the Service Worker

The service worker is responsible for enabling PWA features like offline access and background updates. AEM simplifies service worker configuration by abstracting Workbox's complexities. You can configure:

*   **Caching strategies**: Define how resources are cached (e.g., cache-first, network-first) to ensure reliable performance, even on unreliable connections. AEM implements a "warm cache strategy" to prevent user experience breakage.
*   **Client-side Libraries (`clientlibs`)**: Specify which client-side JavaScript, CSS, and static resources should be cached for offline use.
*   **Third-party resources**: Include external assets like fonts in the offline cache.

When you publish changes to your PWA configuration, the service worker is updated. Users will be prompted to reload the application to get the latest updates.

You can inspect service worker details and cached content in browser DevTools under the "Applications" panel, specifically in the "Service Worker" and "Cache Storage" sections.

```
// Example of how to check for service worker support in JavaScript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/path/to/your/service-worker.js')
    .then(function(registration) {
      console.log('Service worker registered successfully:', registration);
    })
    .catch(function(error) {
      console.error('Service worker registration failed:', error);
    });
}
```

## Fallback Strategies

AEM's integrated Workbox approach inherently provides robust fallback strategies. By configuring caching and pre-caching of essential resources, PWAs built with AEM will:

*   **Load instantly on subsequent visits**: Resources are served from the cache.
*   **Work offline or on unreliable connections**: Essential assets and data are available locally.
*   **Provide a stable user experience**: Fallbacks ensure that the application remains functional even if network requests fail.

The AEM UI for PWA configuration abstracts the underlying Workbox strategies, making it easier to implement these fallbacks without manual coding.

## Results and Auditing

Once configured, your AEM site will function as a PWA, with an installable icon on the user's device. You can verify your PWA compliance using Chrome's Lighthouse audit tool, which provides a score and actionable feedback on PWA implementation.

<figure>
  <img src="image/a-lighthouse-audit-2f67560f69c94.png" alt="A lighthouse audit." width="800" height="694">
</figure>