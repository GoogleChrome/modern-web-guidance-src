---
name: install-web-app
description: Install web applications from a page using browser-controlled consent UI.
web-feature-ids:
  - install
  - navigator-install
  - beforeinstallprompt
  - manifest
---

# Installing web applications

Use the Web Install API to give users an explicit, in-page way to install a web
application. Installation is always completed through browser-controlled consent
UI; websites cannot silently install an app.

Use either the HTML `<install>` element or the JavaScript
`navigator.install()` method.

## Choose which install approach to use: HTML element or JavaScript method

Decide to use either the HTML `<install>` element or the JavaScript
`navigator.install()` method based on the following considerations.

* `<install>` element:

  * Pros:
    * The browser provides the install control, ensuring a consistent and
      trustworthy installation experience.
    * Installing another app does not trigger a separate permission prompt
      before the installation confirmation dialog.
    * The label in the `<install>` element changes to "Launch" if the target
      app is already installed.
    * No JavaScript is required to trigger the installation.
  * Cons:
    * Visual customization of the button is restricted.
    * The number of `<install>` elements on a page is limited by the browser.

* JavaScript `navigator.install()` method:

  * Pros:
    * The installation UI can be fully customized to match the look and feel of
      the website.
    * The number of installation UI elements is not limited by the browser.
  * Cons:
    * Requires JavaScript to trigger the installation.
    * Installing another app triggers an initial `web-app-installation`
      permission prompt before the installation confirmation dialog.

## Prepare the web app

The app being installed must have a web app manifest. Give the manifest a stable
`id` so the browser can keep the app's identity separate from its launch URL.
For installation of the current app, link the manifest from the document.

```html
<!-- The current document's manifest is used by the no-argument install APIs. -->
<link rel="manifest" href="/manifest.webmanifest">
```

```json
{
  "id": "/",
  "name": "Example application",
  "short_name": "Example",
  "start_url": "/",
  "display": "standalone",
  "icons": [
    {
      "src": "/icons/app-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/app-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

Keep the manifest URL stable. When offering a different app for installation,
the manifest must be fetchable without credentials and must be served from the
same origin as that app's `start_url`.

## Use the HTML `<install>` element

The `<install>` element renders a user-agent-controlled button. Prefer it when
the browser's standard label and presentation are appropriate, because the
browser-owned control gives users a trustworthy installation affordance.

```html
<!-- No attributes installs the current document's linked web app. -->
<install></install>
```

To offer another web app, provide its manifest URL:

```html
<install manifest="https://app.example/manifest.webmanifest"></install>
```

The target manifest must explicitly declare an `id`. If that manifest does not
declare an `id`, also provide the target web app's computed manifest ID:

```html
<install
  manifest="https://app.example/manifest.webmanifest"
  manifestid="https://app.example/"
></install>
```

The `manifestId` attribute can either be absolute or relative. Relative values
are resolved against the document's base URL. The resulting URL must match the
processed manifest ID.

Do not imitate, overlay, or transform the browser-controlled element. Its
presentation and activation restrictions protect users from deceptive
installation prompts.

### Handle installation success and errors

Listen for the `installresult` event to handle installation success and errors
and use the `event.result` property to determine the outcome:

* `success`: the app was installed successfully.
* `aborted`: the user canceled the installation or a browser condition
  prevented the installation from completing.
* `invalid_data`: the `manifest` or `manifestId` attribute values are invalid.

```html
<install></install>
<p id="install-status" role="status"></p>

<script type="module">
  const installButton = document.querySelector("install");
  const installStatus = document.querySelector("#install-status");

  installButton.addEventListener("installresult", (event) => {
    switch (event.result) {
      case "success":
        installStatus.textContent = "The app was installed.";
        break;
      case "aborted":
        installStatus.textContent =
          "Installation was canceled or could not complete.";
        break;
      case "invalid_data":
        installStatus.textContent =
          "Installation could not start because the app data is invalid.";
        break;
    }
  });
</script>
```

## Use the JavaScript `navigator.install()` method

Use `navigator.install()` when custom page UI is necessary. Keep the button
hidden until a supported installation mechanism is available. Call
`navigator.install()` directly from the click handler so the call retains the
required transient user activation.

```html
<button id="install-app" type="button" hidden>Install app</button>
<p id="install-status" role="status"></p>

<script type="module">
  const installButton = document.querySelector("#install-app");
  const installStatus = document.querySelector("#install-status");
  const supportsWebInstall =
    typeof Navigator.prototype.install === "function";

  if (supportsWebInstall) {
    installButton.hidden = false;
  }

  installButton.addEventListener("click", async () => {
    installButton.disabled = true;

    try {
      // MANDATORY: Call during the click handler; delayed calls lose user activation.
      await navigator.install();
      installStatus.textContent = "The app was installed.";
      installButton.hidden = true;
    } catch (error) {
      if (error.name === "AbortError") {
        // Cancellation is an expected user choice, not an application error.
        installStatus.textContent = "Installation was canceled or could not complete.";
        installButton.hidden = true;
      } else {
        installStatus.textContent = "Installation could not start.";
        // Surface invalid manifests and unexpected platform failures to developers.
        console.error(error);
      }
    } finally {
      installButton.disabled = false;
    }
  });
</script>
```

Calling `navigator.install()` with no arguments installs the current document's
linked app and requires the manifest to declare an `id`.

To offer another app, pass its manifest URL:

```js
await navigator.install({
  manifest: "https://app.example/manifest.webmanifest"
});
```

The target manifest must explicitly declare an `id`. If that manifest does not
declare an `id`, also provide the target web app's computed manifest ID:

```js
await navigator.install({
  manifest: "https://app.example/manifest.webmanifest",
  manifestId: "https://app.example/",
});
```

The `manifestId` option can either be absolute or relative. Relative values are
resolved against the document's base URL. The resulting URL must match the
processed manifest ID.

### Handle installation success and errors

The `navigator.install()` method returns a promise that resolves when the
installation completes successfully.

The promise rejects with the following errors if the installation fails or is
canceled:

* `AbortError`:
  * The user aborted the installation.
  * The permission was denied.
  * The environment doesn't support installation.
  * Multiple concurrent installation attempts.
  * A page navigation occurred during the installation process.
* `DataError`:
  * Invalid manifest URL.
  * Missing `manifestId` and no computed manifest ID provided.
  * The `manifestId` does not match the computed manifest ID.
* `NotAllowedError`:
  * Missing user activation.
* `TypeError`:
  * The provided arguments are invalid.
* `InvalidStateError`:
  * The API was called outside of the main frame.

## Fallback strategies

The Web Install API is a progressive enhancement. Browsers without either modern
entry point still provide their own installation UI when they support installing
web apps.

### Web app manifest fallback

{{ BASELINE_STATUS("manifest") }}

Browsers that do not use web app manifests can still present the application as
a normal website. Treat installation and standalone display as enhancements; do
not block access to core functionality when manifest-based installation is
unavailable.

### `<install>` fallback

{{ BASELINE_STATUS("install") }}

The `<install>` element supports fallback child content for browsers that do not
render the browser-controlled install button. Use fallback content to link to a
maintained installation help page when the product provides one.

```html
<install>
  <!-- Rendered only when the browser does not provide the install control. -->
  <a href="/install-help">How to install this app</a>
</install>
```

If browser-specific instructions would be inaccurate or difficult to maintain,
leave the element empty. It then renders no non-functional replacement in an
unsupported browser.

For a custom install button, render it separately with `hidden` and reveal it
only when `navigator.install()` is supported or a `beforeinstallprompt` event
has been captured. Do not put an always-visible imitation of the
browser-controlled install button inside the fallback content.

### `navigator.install()` fallback

{{ BASELINE_STATUS("navigator-install") }}

{{ BASELINE_STATUS("beforeinstallprompt") }}

When `navigator.install()` is unavailable, use the `beforeinstallprompt` event
as a fallback for installing the current app. Unlike `navigator.install()`, this
event cannot install a different app.

Capture the event, prevent its automatic prompt, and reveal the custom install
button only after the browser confirms that prompting is possible. Use one click
handler that selects `navigator.install()` when available and otherwise uses the
captured event. The event is single-use, so discard it before awaiting the
user's choice and hide the button after prompting.

```js
const installButton = document.querySelector("#install-app");
const installStatus = document.querySelector("#install-status");
const supportsWebInstall =
  typeof Navigator.prototype.install === "function";
let deferredInstallPrompt;

if (supportsWebInstall) {
  installButton.hidden = false;
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;

  // Prefer navigator.install() when both mechanisms are available.
  if (!supportsWebInstall) {
    installButton.hidden = false;
  }
});

installButton.addEventListener("click", async () => {
  installButton.disabled = true;

  try {
    if (supportsWebInstall) {
      // Call directly from this handler to preserve transient user activation.
      await navigator.install();
      installStatus.textContent = "The app was installed.";
      installButton.hidden = true;
    } else if (deferredInstallPrompt) {
      // Save and clear the single-use event before awaiting the user's choice.
      const promptEvent = deferredInstallPrompt;
      deferredInstallPrompt = undefined;
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;

      installStatus.textContent =
        outcome === "accepted"
          ? "The app was installed."
          : "Installation canceled.";
      installButton.hidden = true;
    }
  } catch (error) {
    if (error.name === "AbortError") {
      // Cancellation is an expected user choice, not an application error.
      installStatus.textContent = "Installation was canceled or could not complete.";
      installButton.hidden = true;
    } else {
      installStatus.textContent = "Installation could not start.";
      console.error(error);
    }
  } finally {
    installButton.disabled = false;
  }
});
```

Do not show a non-functional install button in browsers that support neither
mechanism. Hiding the button is graceful degradation: users can still use any
installation affordance provided by their browser. Do not replace the hidden
button with browser-specific step-by-step instructions unless the product has a
tested, maintained onboarding flow for those browsers.