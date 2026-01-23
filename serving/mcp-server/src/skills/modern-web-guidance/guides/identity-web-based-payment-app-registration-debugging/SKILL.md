---
description: Learn how to register and debug web-based payment apps for seamless customer transactions.
filename: web-based-payment-app-registration-debugging
category: identity
---

# Web-based Payment App Registration and Debugging

Reference docs:
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Payment Request API](https://developer.mozilla.org/en-US/docs/Web/API/PaymentRequest)
- [Payment Handler API](https://developer.mozilla.org/en-US/docs/Web/API/Payment_Handler_API)

## Best Practices

Web-based payment apps, often Progressive Web Apps (PWAs), leverage service workers to capture payment requests, launch the payment app, and communicate with merchants. Configuration is declaratively handled via a web app manifest.

### Registering a web-based payment app

To configure your web-based payment app, you need to register available payment methods and a service worker. This is declaratively managed through your web app manifest. Key manifest properties include:

*   `name`
*   `icons`
*   `serviceworker`
    *   `src`
    *   `scope`
    *   `use_cache`

Ensure your payment method manifest correctly points to your web app manifest.

### Just-in-time (JIT) Service Worker Registration

Service workers can be automatically registered by the browser when a user selects a web-based payment app on a merchant website. This "just-in-time" (JIT) registration requires only serving the web app manifest, with no additional coding needed. If your manifest is already configured and served correctly, the browser will handle the registration.

**CAUTION:** JIT registration only occurs when the payment method manifest points to a single payment app.

## Debugging a web-based payment app

Debugging involves switching between merchant and payment app contexts. The following tips are tailored for Chrome:

### Developing on a local server

Powerful browser features like the Payment Request API and Payment Handler API often require a secure (HTTPS) environment with a valid certificate.

*   **`http://localhost`:** Chrome exempts certificates for `http://localhost` by default.
*   **Other local/internal servers:** To exempt certificate requirements for domains like `http://*.corp.company.com`, launch Chrome with specific flags:
    *   `--ignore-certificate-errors`
    *   `--unsafely-treat-insecure-origin-as-secure=http://*.corp.company.com`

**macOS Example:**
```shell
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --ignore-certificate-errors --unsafely-treat-insecure-origin-as-secure=http://*.corp.company.com
```

**Windows Example:**
```shell
chrome.exe --ignore-certificate-errors --unsafely-treat-insecure-origin-as-secure=http://*.corp.company.com
```

Refer to [Run Chromium with flags](https://www.chromium.org/developers/how-tos/run-chromium-with-flags) for more details.

### Port forwarding a local server

Test your local server on an Android device using Chrome's DevTools. See [Access Local Servers](https://developer.chrome.com/docs/devtools/remote-debugging/local-server) for instructions.

### Remote debugging on Android Chrome

Debug your Android Chrome browser using desktop DevTools. Refer to [Get Started with Remote Debugging Android Devices](https://developer.chrome.com/docs/devtools/remote-debugging).

### Payment Handler Event Logging

Utilize DevTools for logging Payment Handler API events. Open DevTools in the merchant context, navigate to the **Application** pane, and select "Payment Handler." Check "Show events from other domains" and click "Record" to capture events sent to the payment handling service worker.

<figure>
  <img src="image/a-screenshot-payment-han-2353defdf5615.png" alt="A screenshot of Payment Handler event logging." width="800" height="585">
  <figcaption class="wd-caption">
    Payment Handler event logging.
  </figcaption>
</figure>

## Next Steps

Learn how the service worker orchestrates payment transactions at runtime:

*   [Orchestrating payment transactions with a service worker](/articles/orchestrating-payment-transactions)
---