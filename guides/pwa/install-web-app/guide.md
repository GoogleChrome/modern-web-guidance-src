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

Use the declarative `<install>` element when the browser-provided install control
fits the page. Use `navigator.install()` when the application needs a custom
button or needs to respond to the result.

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

## Use the declarative install control

The `<install>` element renders a user-agent-controlled button. Prefer it when
the browser's standard label and presentation are appropriate, because the
browser-owned control gives users a trustworthy installation affordance.

```html
<!-- No attributes installs the current document's linked web app. -->
<install></install>
```

To offer another web app, provide its manifest URL. If that manifest does not
declare an `id`, also provide its computed manifest ID.

```html
<install
  manifest="https://app.example/manifest.webmanifest"
  manifestid="https://app.example/"
></install>
```

Do not imitate, overlay, or transform the browser-controlled element. Its presentation and
activation restrictions protect users from deceptive installation prompts.

## Use a custom install control

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
        installStatus.textContent = "Installation canceled.";
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
linked app and requires the manifest to declare an `id`. To offer another app,
pass its manifest URL. Pass `manifestId` only when the target manifest does not
declare an `id`.

```js
await navigator.install({
  manifest: "https://app.example/manifest.webmanifest",
  manifestId: "https://app.example/",
});
```

Handle `AbortError` as normal cancellation. Treat `DataError` and `TypeError` as
developer errors in the manifest or arguments. `NotAllowedError` usually means
the call lost user activation, while `InvalidStateError` can indicate an invalid
frame or document context. Do not repeatedly prompt after cancellation.

## Fallback strategies

The Web Install API is a progressive enhancement. Browsers without either modern
entry point still provide their own installation UI when they support installing
web apps.

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

For Chromium browsers without the Web Install API, use the
`beforeinstallprompt` event as a fallback for installing the current app. This
fallback cannot install a different app and is not supported by Firefox or
Safari.

{{ BASELINE_STATUS("beforeinstallprompt") }}

Capture the event, prevent its automatic prompt, and reveal the custom install
button only after the browser confirms that prompting is possible. The event is
single-use, so clear it and hide the button after prompting.

```js
let deferredInstallPrompt;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;

  // The captured event cannot be reused, regardless of the user's choice.
  deferredInstallPrompt = undefined;
  installButton.hidden = true;
});
```

Do not show a non-functional install button in browsers that support neither
mechanism. Hiding the button is graceful degradation: users can still use any
installation affordance provided by their browser. Do not replace the hidden
button with browser-specific step-by-step instructions unless the product has a
tested, maintained onboarding flow for those browsers.