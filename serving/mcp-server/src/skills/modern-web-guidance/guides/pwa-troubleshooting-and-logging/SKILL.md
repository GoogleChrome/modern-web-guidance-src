---
description: Simplify service worker debugging and troubleshooting with Workbox's informative logging and built-in tools.
filename: troubleshooting-and-logging
category: pwa
---

# Troubleshooting and Logging

Debugging a service worker can be challenging due to its complex lifecycle and interactions. Workbox simplifies this process by providing informative logging and integrating with browser developer tools.

## Available Troubleshooting Tools

Modern browsers offer robust developer tools to aid in service worker debugging.

### Chrome and Edge

Chrome and recent versions of Edge provide comprehensive developer tools. Beyond the general tools mentioned previously, consider these resources:

-   [Debug Progressive Web Apps](/docs/devtools/progressive-web-apps)
-   [Inspect Network Activity in Chrome DevTools](/docs/devtools/network)
-   Video: [Debugging Service Workers in Chrome](https://www.youtube.com/watch?v=tuRPSaSiK_c)
-   Codelab: [Debugging Service Workers](https://codelabs.developers.google.com/codelabs/debugging-service-workers/index.html)

### Firefox

For Firefox users, the following resources are recommended:

-   [Debugging service workers using the Firefox Devtools Application Panel](https://developer.mozilla.org/docs/Tools/Application/Service_workers)
-   Video: [Debugging Service Workers in Firefox](https://www.youtube.com/watch?v=ranU2qe1JVA)

### Safari

Safari's developer tools for service worker debugging are more limited. Consult these resources for guidance:

-   [Workers at Your Service](https://webkit.org/blog/8090/workers-at-your-service/#post-8090:%7E:text=Web%20Inspector%20supports%20debugging%20service%20workers.)
-   Video: [Debugging Service Workers in Safari](https://www.youtube.com/watch?v=87RU7v6Y-bk).

## Workbox Logging

Workbox enhances the developer experience with detailed logging. When enabled, Workbox logs its activities in a distinct and helpful manner, often with a Workbox badge in the browser console.

![A screenshot of Workbox logging messages in the console of Chrome's DevTools. The logging messages are distinguished from normal console logs with a Workbox badge. Each message can be expanded to get further debugging information.](image/a-screenshot-workbox-log-0e5e83dfad044.png "Workbox Logging Example")

Development builds of Workbox enable logging by default, while production builds disable it. The method for switching between these builds depends on your workflow.

### With or Without a Bundler

Bundlers combine modules into browser-ready JavaScript. If you use a bundler like webpack or Rollup with Workbox plugins, logging is typically controlled by the bundler's production mode setting:

-   **webpack**: The `mode` configuration option (set to `'production'` or `'development'`) influences `workbox-webpack-plugin`'s logging behavior.
-   **Rollup**: The `mode` option in `rollup-plugin-workbox` controls logging. If using Rollup without this specific plugin, configure `@rollup/plugin-replace` to substitute `process.env.NODE_ENV` with `'development'` or `'production'`.

To override default logging behavior in development, Workbox plugins often allow hardcoding a preference in their configuration. For instance, `workbox-webpack-plugin`'s `GenerateSW` method has a `mode` option.

### Without a Bundler

For projects not using a bundler, the `workbox-sw` module is the recommended approach. It simplifies loading Workbox modules from a CDN. By default, `workbox-sw` loads the development version when running on `http://localhost` and the production version otherwise.

You can force development logging by calling `workbox.setConfig({ debug: true });` before using other Workbox methods:

```js
// Load workbox-sw from a CDN
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.2.0/workbox-sw.js');

// This must come before any other workbox.* methods.
workbox.setConfig({
  debug: true
});

// Now use workbox.routing.*, workbox.precaching.*, etc.
```

### Turn Off Logging in Development Builds (Any Workflow)

Regardless of your build setup, you can disable all development logs by setting `self.__WB_DISABLE_DEV_LOGS = true;` in your service worker:

```js
//
self.__WB_DISABLE_DEV_LOGS = true;

// The rest of your Workbox service worker code goes here
```

This method is independent of bundler configurations and works universally.

## Further Information

If you encounter persistent issues, seek help on [Stack Overflow with the `workbox` tag](https://stackoverflow.com/questions/ask?tags=workbox) or [file a GitHub issue](https://github.com/GoogleChrome/workbox/issues) after reviewing the [contributing guidelines](https://github.com/GoogleChrome/workbox/blob/v6/CONTRIBUTING.md). Sharing your problem can benefit other developers facing similar challenges.