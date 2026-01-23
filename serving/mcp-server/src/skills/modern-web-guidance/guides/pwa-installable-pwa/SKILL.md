---
description: Make web apps installable and blend seamlessly with the operating system using PWA features like fullscreen display and window controls overlay.
filename: installable-pwa
category: pwa
---

# Make web apps installable and blend with the OS

Reference docs:
- [Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Introduction)
- [Window Controls Overlay API](https://developer.chrome.com/docs/web-platform/window-controls-overlay/)
- [Ambient Light Sensor API](https://developer.mozilla.org/docs/Web/API/AmbientLightSensor)

## Best Practices

### Make it installable

To make your web app installable, you need to define a Web App Manifest. This JSON file provides information about your app, such as its name, icons, and display mode.

```json
{
  "display": "fullscreen",
  "display_override": ["window-controls-overlay"],
  "name": "Designcember Calculator",
  "short_name": "Calculator",
  "icons": [
    {
      "src": "/image/icon192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/image/icon512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "theme_color": "#385975",
  "background_color": "#385975"
}
```

A service worker is also crucial for PWA functionality, enabling offline support and faster loading times.

```js
// sw.js
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
  event.waitUntil(
    (async () => {
      if ('navigationPreload' in self.registration) {
        await self.registration.navigationPreload.enable();
      }
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    (async () => {
      try {
        const response = await event.preloadResponse;
        if (response) {
          return response;
        }
        return fetch(event.request);
      } catch {
        return new Response('Offline');
      }
    })(),
  );
});
```

### Blend with mobile

On mobile devices, set the `display` property in the Web App Manifest to `fullscreen`. Also, use the viewport meta tag to ensure content covers the entire screen.

```html
<meta name="viewport" content="initial-scale=1, viewport-fit=cover" />
```

### Blend with desktop

Use the `display_override` property in the manifest to enable the `window-controls-overlay` feature on desktop. This allows your web app's content to extend into the title bar area.

```json
{
  "display_override": ["window-controls-overlay"]
}
```

Use CSS environment variables (`env(titlebar-area-x)`, `env(titlebar-area-y)`, etc.) to position elements within the title bar area.

```css
#calc_solar_cell.wco {
  position: fixed;
  left: calc(0.25rem + env(titlebar-area-x, 0));
  top: calc(0.75rem + env(titlebar-area-y, 0));
  width: calc(env(titlebar-area-width, 100%) - 0.5rem);
  height: calc(env(titlebar-area-height, 33px) - 0.5rem);
}

#calc_display_surface.wco {
  margin-top: calc(env(titlebar-area-height, 33px) - 0.5rem);
}
```

Make specific elements draggable using `app-region: drag` and non-draggable using `app-region: no-drag`.

```css
#calc_inside.wco,
#calc_solar_cell.wco {
  -webkit-app-region: drag;
  app-region: drag;
}

button {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}
```

Listen for `navigator.windowControlsOverlay.ongeometrychange` to react to changes in the overlay geometry, such as window resizing. Debounce this event for performance.

```js
const meta = document.querySelector('meta[name="theme-color"]');
const nodes = document.querySelectorAll(
  '#calc_display_surface, #calc_solar_cell, #calc_outside, #calc_inside',
);

const toggleWCO = () => {
  if (!navigator.windowControlsOverlay.visible) {
    meta.content = '';
  } else {
    meta.content = '#385975';
  }
  nodes.forEach((node) => {
    node.classList.toggle('wco', navigator.windowControlsOverlay.visible);
  });
};

const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

navigator.windowControlsOverlay.ongeometrychange = debounce((e) => {
  toggleWCO();
}, 250);

toggleWCO();
```

### Utilize the Ambient Light Sensor

For features that depend on ambient conditions, like a solar calculator, use the `AmbientLightSensor` API. Ensure the necessary flags are enabled (`#enable-generic-sensor-extra-classes` in `about:flags`) and request the `'ambient-light-sensor'` permission.

```js
if ('AmbientLightSensor' in window) {
  // Load sensor-specific code
  const luxToOpacity = (lux) => {
    if (lux > 250) {
      return 1;
    }
    return lux / 250;
  };

  const sensor = new window.AmbientLightSensor();
  sensor.onreading = () => {
    document.documentElement.style.setProperty(
      '--opacity',
      luxToOpacity(sensor.illuminance),
    );
  };
  sensor.onerror = (event) => {
    console.log(event.error.name, event.error.message);
  };

  (async () => {
    const {state} = await navigator.permissions.query({
      name: 'ambient-light-sensor',
    });
    if (state === 'granted') {
      sensor.start();
    }
  })();
}
```

## Fallback strategies

If the user's browser does not support all the features used, implement progressive enhancement and provide fallbacks.

### Installability

- **DO** check for the presence of `window.self.registration` to ensure service worker capabilities.
- **DO** provide a fallback experience for users whose browsers do not support service workers, such as a standard website without offline capabilities.

### Window Controls Overlay

- **DO** use `@supports (position-anchor: --foo)` or `if ('windowControlsOverlay' in navigator)` for feature detection.
- **DO** conditionally load the `wco.js` script only when the feature is supported.
- **DO** ensure the UI remains usable without the Window Controls Overlay, perhaps by hiding related elements or providing alternative controls.

### Ambient Light Sensor

- **DO** check `if ('AmbientLightSensor' in window)` for browser support.
- **DO** conditionally load the `als.js` script only when the API is available.
- **DO** provide a graceful degradation for users without sensor support. For the calculator example, this could mean the solar cell is always "active" or has a default opacity.