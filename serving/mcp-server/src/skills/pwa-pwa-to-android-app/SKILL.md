---
description: Learn how to package your Progressive Web App as an Android app using Trusted Web Activity and Bubblewrap.
filename: pwa-to-android-app
category: pwa
---

# Progressive Web Apps to Android Apps

Reference docs:
- Create a Play Developer account → http://goo.gle/30xuHm3
- Learn more about Bubblewrap → http://goo.gle/3l5A05z
- Receive payments with the Digital Goods API, Payment Request API and Google Play Billing → http://goo.gle/3taYe13

## Best Practices

To transform your Progressive Web App (PWA) into an Android package, you can leverage Trusted Web Activity (TWA) and the Bubblewrap tool. This process allows you to provide your web application experience to Android users through the Google Play Store.

### Trusted Web Activity (TWA)

TWA enables your PWA to run within an Android app container, offering a native-like experience while still relying on the web for content and functionality. Key considerations for TWA include:

- **Digital Asset Links (DAL):** Ensure your web app and Android app are properly associated using DAL to establish trust. This is crucial for the TWA to function correctly and for your app to be considered "trusted."
- **User Experience:** Design your PWA with a mobile-first approach, considering performance, navigation, and offline capabilities, as these will directly impact the user experience within the Android app.
- **Splash Screen and Icons:** Provide appropriate splash screens and app icons for your Android app to maintain brand consistency and provide a familiar entry point for users.

### Bubblewrap

Bubblewrap is a command-line tool that simplifies the creation of Android App packages (APKs or AABs) for PWAs using TWA. It automates much of the boilerplate configuration needed.

- **Project Setup:** Use Bubblewrap to initialize your project, which involves configuring essential Android project files.
- **Asset Generation:** Bubblewrap can help generate necessary Android assets based on your PWA's web app manifest.
- **Building the App:** Follow Bubblewrap's instructions to build your Android application package, which can then be uploaded to the Google Play Store.

### Monetization and Payments

If your PWA involves transactions, integrate with Google Play's payment services:

- **Digital Goods API:** For in-app purchases of digital content.
- **Payment Request API:** A web standard for handling payments, which can be integrated with various payment methods.
- **Google Play Billing:** The primary system for managing in-app purchases and subscriptions on Google Play.

## Fallback Strategies

While TWA offers a streamlined way to bring PWAs to Android, it's essential to consider scenarios where a user might not be able to install or run the Android app. In such cases, providing a direct link to the PWA on the web remains a viable fallback. Ensure your PWA is discoverable and accessible via a URL.

## Further Exploration

- **International Mother Language Day Series:** Read more about the series this video is a part of → http://goo.gle/mother-language-day-2021
- **Supercharged Micro Tips:** Discover more helpful tips → http://goo.gle/3uchv3C
- **Subscribe to Chrome Developers:** Stay updated with the latest from the Chrome team → https://goo.gle/ChromeDevs