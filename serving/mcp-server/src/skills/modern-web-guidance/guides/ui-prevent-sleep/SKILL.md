---
description: Prevent system sleep and display dimming for uninterrupted user experiences.
filename: prevent-sleep
category: ui
---

# Prevent Sleep

Reference docs:
- https://developer.chrome.com/docs/extensions/reference/api/power

## Best Practices

Use the `chrome.power` API to override the system's power management features, preventing the system from sleeping or the display from turning off.

### Requesting Power Management Override

To prevent the system from sleeping or the display from turning off, use `chrome.power.requestKeepAwake()`. This method takes a `level` parameter which can be either `"system"` or `"display"`.

- `"system"`: Prevents the system from sleeping in response to user inactivity.
- `"display"`: Prevents the display from being turned off or dimmed, or the system from sleeping in response to user inactivity.

```javascript
// Prevent the system from sleeping
chrome.power.requestKeepAwake({level: "system"});

// Prevent the display from turning off and the system from sleeping
chrome.power.requestKeepAwake({level: "display"});
```

### Releasing Power Management Override

It is crucial to release the power management override when it's no longer needed to allow the system to enter its normal power-saving states. Use `chrome.power.releaseKeepAwake()` for this purpose.

```javascript
// Release the power management override
chrome.power.releaseKeepAwake();
```

### Reporting User Activity (ChromeOS only)

For ChromeOS, you can use `chrome.power.reportActivity()` to report user activity. This can wake the screen from a dimmed or turned-off state, or exit the screensaver.

```javascript
// Report user activity (ChromeOS only)
chrome.power.reportActivity();
```

**Important:** Always pair `requestKeepAwake()` with `releaseKeepAwake()` to ensure proper power management.

## Permissions

To use the `chrome.power` API, you must declare the `power` permission in your extension's manifest file:

```json
{
  "permissions": ["power"]
}
```

## Feature Detection

While `chrome.power` is a standard Chrome Extension API, if you need to check for its availability (e.g., in different browser contexts), you can do so:

```javascript
if (chrome.power) {
  console.log("Chrome Power API is available.");
  // Use chrome.power here
} else {
  console.log("Chrome Power API is not available.");
}