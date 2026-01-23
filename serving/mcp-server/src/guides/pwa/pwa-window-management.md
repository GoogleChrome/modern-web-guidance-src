---
description: Manage the lifecycle and appearance of PWA windows to provide a seamless desktop-like experience.
filename: pwa-window-management
category: pwa
---

# PWA Window Management

Reference docs:
- [MDN Window API](https://developer.mozilla.org/en-US/docs/Web/API/Window)
- [MDN Window Management API](https://developer.mozilla.org/docs/Web/API/Window_Management_API)
- [MDN Screen Wake Lock API](https://developer.mozilla.org/docs/Web/API/Screen_Wake_Lock_API)
- [MDN VirtualKeyboard API](https://developer.mozilla.org/docs/Web/API/VirtualKeyboard)

## Best Practices

### Controlling Window Size and Position

*   **DO** use `window.moveTo(x, y)` and `window.resizeTo(x, y)` to programmatically control the PWA window's position and dimensions.
*   **DO** use `window.moveBy(x, y)` and `window.resizeBy(x, y)` for relative movements and resizes.
*   **DO** check `matchMedia("(display-mode: browser)").matches` to ensure you are not attempting to move or resize the window when it's running in a browser tab.
*   **DO NOT** expect window movement or resizing to have an effect on mobile devices.
*   **DO** use `window.screen` to query current screen dimensions.
*   **DO** listen to the `resize` event on the `window` object to detect when the window is resized. Note that there is no direct event for window moves; frequent polling of position might be necessary if real-time tracking is critical.

### Handling External Navigation

*   **DO** use standard `<a>` elements with `href` attributes to navigate to external sites.
*   **DO** expect an in-app browser to open when navigating to URLs outside the PWA's scope, displaying the address bar and providing options to close or open in the main browser.
*   **DO** use `window.open(url, "_blank")` on desktop PWAs to force a URL to open in the user's default external browser.
*   **DO NOT** rely on `window.open(url, "_blank")` to open an external browser on mobile devices, as this functionality is not supported.

### Opening New Windows

*   **DO** use `window.open(url, windowName, [windowFeatures])` to open new PWA windows on desktop.
*   **CAUTION:** To ensure a new window is always opened, use unique string values for the `windowName` argument each time `window.open()` is called.
*   **DO NOT** expect `window.open()` to create a new window on iOS or iPadOS; it will return `null`.
*   **DO** be aware that on Android, `window.open()` might open a new in-app browser even for URLs within the PWA's scope.

### Managing Window Title

*   **DO** set the PWA's window title using the `<title>` element in your HTML or by dynamically updating `document.title`.
*   **DO** update the window title on route changes in single-page applications to provide clear navigation context.
*   **DO** be aware that some browsers might add prefixes to your PWA's name to the title for security reasons (anti-phishing) or briefly display the current origin.

### Advanced Window Features (Experimental)

*   **DO** explore `Tabbed mode` for PWA's that benefit from a tab-based interface within a single OS window.
*   **DO** investigate `Window Controls Overlay` for custom UI design in the title bar area of desktop PWAs. Note that these require specific manifest `display` modes.

### Utilizing the Window Management API

*   **DO** use `window.getScreenDetails()` to access information about connected screens.
*   **DO** request user permission if prompted when calling `window.getScreenDetails()`.
*   **DO** listen for `screenschange` events on the `screenDetails` object for changes in the screen configuration and `change` events on individual screens for attribute updates.
*   **DO** listen for `currentscreenchange` events to detect when the PWA's window moves between screens.
*   **DO** consider using the [Presentation API](https://developer.mozilla.org/docs/Web/API/Presentation_API) for displaying content on external devices like projectors.

### Preventing Screen Sleep

*   **DO** use `navigator.wakeLock.request()` to acquire a screen wake lock, preventing the screen from dimming, sleeping, or locking.
*   **DO** listen for the `release` event on the wake lock object to know when it has been released.
*   **DO** call `wakeLock.release()` to manually release the wake lock when it's no longer needed.

### Virtual Keyboard Control

*   **DO** use `navigator.virtualKeyboard.show()` and `navigator.virtualKeyboard.hide()` to programmatically control the virtual keyboard.
*   **DO** set `navigator.virtualKeyboard.overlaysContent = true` to inform the browser that your PWA is managing the keyboard's visibility.
*   **DO** use the `geometrychange` event to detect keyboard appearance and disappearance.
*   **DO** utilize the `virtualkeyboardpolicy` attribute on `contenteditable` elements, setting it to `auto` for browser-managed behavior or `manual` for script-controlled behavior.
*   **DO** use CSS environment variables like `keyboard-inset-height` and `keyboard-inset-top` for responsive layout adjustments.