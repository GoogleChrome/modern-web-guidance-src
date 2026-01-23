---
description: Enables websites to check if related apps (PWA, Android, or UWP) are installed on a user's device, allowing for customized user experiences.
filename: get-installed-related-apps.md
category: pwa
---

# Check if your app is installed

Reference docs:
- https://wicg.github.io/get-installed-related-apps/spec/
- https://developers.google.com/digital-asset-links/v1/getting-started
- https://docs.microsoft.com/en-us/windows/uwp/launch-resume/web-to-app-linking

## Best Practices

The Get Installed Related Apps API allows you to detect if a user has a related Progressive Web App (PWA), Android app, or Universal Windows Platform (UWP) app installed on their device. This enables several powerful use cases:

*   **Not promoting PWA installation** if another related app is already installed.
*   **Redirecting users** from a marketing website directly into your installed app.
*   **Centralizing functionality** like notifications in another app to prevent duplicates.

To implement this, you need to establish a **verified relationship** between your website and your related apps. This involves configuring both your web app manifest and your native applications (or PWAs packaged as native apps).

### General Workflow

1.  **Tell your app about your website:**
    *   For Android apps: Use the [Digital Asset Links system](https://developers.google.com/digital-asset-links/v1/getting-started) by adding an `asset_statements` entry to your `AndroidManifest.xml` and a corresponding string resource in `strings.xml`. If using Bubblewrap or PWABuilder, this is handled automatically.
    *   For Windows (UWP) apps: Use [URI Handlers](https://docs.microsoft.com/en-us/windows/uwp/launch-resume/web-to-app-linking) by adding the `Windows.appUriHandler` extension to your `Package.appxmanifest`. You'll also need to create a `windows-app-web-link` JSON file on your server.
    *   For PWAs (out of scope): Add an [`assetlinks.json`](https://developers.google.com/digital-asset-links/v1/getting-started) file to the `/.well-known/` directory of the PWA's domain, specifying the website that will perform the check.

2.  **Tell your website about your app:**
    *   Add a `related_applications` property to your website's [web app manifest](https://web.dev/add-manifest). This array should contain objects detailing each related app, including its `platform` (`play` for Android, `windows` for UWP, `webapp` for PWA) and its `id`.
        *   For Android, `id` is the package name (e.g., `com.android.chrome`).
        *   For Windows, `id` is the package family name appended by the Application ID (e.g., `MyApp_9jmtgj1pbbz6e!App`).
        *   For PWAs, `url` is the path to the PWA's manifest, and `id` is the PWA's web app ID.

3.  **Check if your app is installed:**
    *   Call the asynchronous function `navigator.getInstalledRelatedApps()` from your website. This returns a promise that resolves with an array of installed related apps.
    *   A simple check for the presence of any installed related apps can be done with: `const hasInstalledRelatedApps = !!(await navigator.getInstalledRelatedApps?.())?.length;`

### Specific Use Cases and Implementation Details

#### Checking for Android Apps

*   **Supported on:** Android only: Chrome 80 or later.
*   **Note:** This includes PWAs packaged as Android apps using Bubblewrap or PWABuilder.
*   **Manifest `related_applications`:**
    ```json
    {
      "related_applications": [{
        "platform": "play",
        "id": "com.android.chrome"
      }]
    }
    ```

#### Checking for Windows (UWP) Apps

*   **Supported on:** Windows only: Chrome 85 or later, Edge 85 or later.
*   **Note:** This includes PWAs packaged as UWP apps using PWABuilder.
*   **Manifest `related_applications`:**
    ```json
    {
      "related_applications": [{
        "platform": "windows",
        "id": "MyApp_9jmtgj1pbbz6e!App"
      }]
    }
    ```

#### Checking for PWAs (In Scope)

*   **Supported on:**
    *   Android: Chrome 84 or later
    *   Desktop (Windows, macOS, Linux, ChromeOS): Chrome 140 or later, Edge 140 or later
*   **Requirement:** The page making the request must be on the same domain and within the [scope](https://web.dev/add-manifest/#scope) of your PWA.
*   **Manifest `related_applications`:**
    ```json
    {
      "scope": "/",
      "start_url": "/?utm_source=home_screen",
      "related_applications": [{
        "platform": "webapp",
        "url": "/manifest.json",
        "id": "https://example.com/?utm_source=home_screen"
      }]
    }
    ```

#### Checking for PWAs (Out of Scope)

*   **Supported on:** Android only: Chrome 84 or later.
*   **Requirement:** The checking page can be on a different domain or outside the PWA's scope.
*   **Manifest `related_applications`:**
    ```json
    {
      "related_applications": [{
        "platform": "webapp",
        "url": "https://app.example.com/manifest.json"
      }]
    }
    ```

## Fallback Strategies

*   The `navigator.getInstalledRelatedApps()` method is only available over **HTTPS**.
*   Only the first three apps declared in the web app manifest are considered.
*   The `min_version` and `fingerprints` fields in the `related_applications` specification are not currently supported by browsers.

## Further Information

*   For detailed implementation and testing, refer to the [Get Installed Related Apps API spec](https://wicg.github.io/get-installed-related-apps/spec/).
*   For Android app verification, consult the [Digital Asset Links documentation](https://developers.google.com/digital-asset-links/v1/getting-started).
*   For Windows app verification, see [Enable apps for websites using app URI handlers](https://docs.microsoft.com/en-us/windows/uwp/launch-resume/web-to-app-linking).
*   Check [StackOverflow](https://stackoverflow.com/questions/tagged/getinstalledrelatedapps) for community questions and answers.

## Feedback

*   To report bugs with Chrome's implementation, file a bug at [new.crbug.com](https://new.crbug.com), including `Mobile>WebAPKs` in the **Components** box.