---
description: Enables web applications to detect and utilize gamepad input for enhanced interactivity in games and other interactive experiences.
filename: gamepad-api-integration
category: ui
---

# Using the Gamepad API for Enhanced Web Interactions

## Best Practices

### Feature Detection
The Gamepad API is not universally supported across all browsers. Before attempting to use it, it's crucial to detect its availability. Modernizr is a recommended tool for this:

```js
var gamepadSupportAvailable = Modernizr.gamepads;

if (gamepadSupportAvailable) {
  // Proceed with Gamepad API usage
} else {
  // Provide alternative input methods or inform the user
}
```

### Connecting and Disconnecting Gamepads

Gamepads are not immediately recognized by the browser. The user must press a button on the gamepad for it to be detected. Firefox implements this with `MozGamepadConnected` and `MozGamepadDisconnected` events.

```js
// For Firefox
window.addEventListener('MozGamepadConnected', gamepadSupport.onGamepadConnect, false);
window.addEventListener('MozGamepadDisconnected', gamepadSupport.onGamepadDisconnect, false);

// For Chrome (polling)
if (!!navigator.webkitGamepads || !!navigator.webkitGetGamepads) {
    gamepadSupport.startPolling();
}
```

### Polling vs. Events

The Gamepad API specification allows for both polling and event-based detection of gamepad states.

-   **Polling:** Chrome primarily uses polling, where you continuously check the state of connected gamepads using `navigator.webkitGetGamepads()`. This is often done efficiently using `requestAnimationFrame`.
-   **Events:** Firefox utilizes `MozGamepadConnected` and `MozGamepadDisconnected` events for initial connection and disconnection, and then you'd typically poll for state changes.

For broader compatibility, you might implement both.

```js
/**
 * Starts a polling loop to check for gamepad state.
 */
startPolling: function() {
    if (!gamepadSupport.ticking) {
        gamepadSupport.ticking = true;
        gamepadSupport.tick();
    }
},

/**
 * A function called with each requestAnimationFrame(). Polls the gamepad
 * status and schedules another poll.
 */
tick: function() {
    gamepadSupport.pollStatus();
    gamepadSupport.scheduleNextTick();
},

scheduleNextTick: function() {
    if (gamepadSupport.ticking) {
        if (window.requestAnimationFrame) {
            window.requestAnimationFrame(gamepadSupport.tick);
        } else {
            // Fallback for older browsers if needed
            setTimeout(gamepadSupport.tick, 16);
        }
    }
},

/**
 * Checks for the gamepad status.
 */
pollStatus: function() {
    // Implementation to get gamepad data and compare states
},
```

### Understanding Gamepad Input

A gamepad is represented by an object with `id`, `index`, `timestamp`, `buttons`, and `axes`.

-   **`buttons`**: An array representing discrete and analogue buttons. Values range from 0.0 (not pressed) to 1.0 (fully pressed).
-   **`axes`**: An array representing analogue sticks. Values range from -1.0 (fully left/up) through 0.0 (center) to 1.0 (fully right/down).

It's recommended to use thresholds for analogue inputs to account for variations and potential inaccuracies.

```js
gamepad.ANALOGUE_BUTTON_THRESHOLD = .5;

gamepad.buttonPressed_ = function(pad, buttonId) {
    return pad.buttons[buttonId] && (pad.buttons[buttonId] > gamepad.ANALOGUE_BUTTON_THRESHOLD);
};

gamepad.AXIS_THRESHOLD = .75;

gamepad.stickMoved_ = function(pad, axisId, negativeDirection) {
    if (typeof pad.axes[axisId] == 'undefined') {
        return false;
    } else if (negativeDirection) {
        return pad.axes[axisId] < -gamepad.AXIS_THRESHOLD;
    } else {
        return pad.axes[axisId] > gamepad.AXIS_THRESHOLD;
    }
};
```

### Mapping Inputs

Map gamepad buttons and axes to logical actions within your application. You may need to provide flexibility in mapping due to different gamepad layouts.

```js
// Example mapping for movement
newState[gamepad.STATES.LEFT] =
    gamepad.buttonPressed_(pad, gamepad.BUTTONS.PAD_LEFT) ||
    gamepad.stickMoved_(pad, gamepad.AXES.LEFT_ANALOGUE_HOR, true) ||
    gamepad.stickMoved_(pad, gamepad.AXES.RIGHT_ANALOGUE_HOR, true);
```

### Emulating Keyboard Events

For applications primarily designed for keyboard input, you can synthesize keyboard events from gamepad inputs.

```js
// Create and dispatch a corresponding key event.
var event = document.createEvent('Event');
var eventName = down ? 'keydown' : 'keyup';
event.initEvent(eventName, true, true);
event.keyCode = gamepad.stateToKeyCodeMap_[state];
gamepad.containerElement_.dispatchEvent(event);
```

## Fallback Strategies

If the Gamepad API is not supported, ensure users can still interact with your application. This could involve:

*   Providing clear instructions on how to use alternative input methods.
*   Offering a simplified experience that doesn't rely on gamepad input.
*   Informing users about browsers that do support the Gamepad API and suggesting they update or switch.

## Tips and Tricks

*   **Visibility:** Gamepads are only detected after a button press. Inform users of this.
*   **Exclusive Access:** Only one browser tab can typically sense a gamepad at a time. Advise users to close other pages that might be using the gamepad.
*   **Browser Versions:** Test with the latest stable and development (e.g., Chrome Canary) versions of browsers to ensure the best support.
*   **Debugging:** Use the provided `gamepad-tester` example or similar tools to verify gamepad functionality and mapping.

## The Future

The Gamepad API is evolving. Future developments may include:

*   Event-based input handling for more immediate feedback.
*   Broader browser support.
*   Advanced features like rumble control and gyroscope access.
*   Improved support for a wider variety of gamepad types.