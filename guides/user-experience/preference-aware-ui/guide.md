---
name: preference-aware-ui
description: Respect the user's color theme, reduced motion, locale, and data-saving preferences.
web-feature-ids:
  - prefers-color-scheme
  - color-scheme
  - light-dark
  - prefers-reduced-motion
  - intl
  - network-information
  - savedata
  - view-transitions
  - cross-document-view-transitions
  - nesting
---

# Respect user preferences

Users set their color scheme, motion, language, and data-saving preferences once, in the OS or browser. Read these signals at runtime instead of shipping one fixed experience.

For the operating system's text-size preference, see {{ GUIDE_REF("respect-os-text-scale") }}.

## Implementation

### Follow the system color scheme

Declare light and dark theme support in HTML with `<meta name="color-scheme" content="light dark">` in `<head>` so the browser themes default canvas backgrounds, form controls, and scrollbars before CSS parses.

Define color tokens with `light-dark()`, which picks a value based on the computed `color-scheme`. For dark-mode images, accent colors, and scrollbars, see {{ GUIDE_REF("dark-mode") }}.

```css
:root {
  color-scheme: light dark;
  /* example values */
  --surface: light-dark(#ffffff, #121212);
  --text: light-dark(#1f1f1f, #e8e8e8);
}
body {
  background-color: var(--surface);
  color: var(--text);
}
```

- In dark mode, keep backgrounds dark enough that white text has more contrast on them than black text, and make sure body text has at least a 4.5:1 contrast ratio against its background in both modes.
- For subtrees requiring a fixed scheme regardless of the page default, see {{ GUIDE_REF("component-specific-light-dark-theme") }}.
- Most sites should follow the system preference by default. If you add an in-page toggle, always include a way back to following the system, and restore a saved choice before first paint with an early inline `<script>` in `<head>` to avoid a flash of the wrong theme; see {{ GUIDE_REF("dark-mode-toggle") }}.

### Reduce motion on request

Tone down movement when the user requests reduced motion; see the discipline guide {{ GUIDE_REF("motion") }}. Remove decorative movement, but slow down indicators that must keep showing activity, such as spinners and indeterminate progress bars, instead of stopping them. Start with gentle feedback by default (such as a fade), and opt in to spatial motion only when the user expresses no preference:

```css
.toast {
  animation: fade-in 250ms ease-out;
  @media (prefers-reduced-motion: no-preference) {
    animation-name: toast-in;
  }
}
@keyframes fade-in { from { opacity: 0; } }
@keyframes toast-in { from { opacity: 0; transform: translateY(1rem); } }
```

- DO NOT use a universal reset such as `* { animation-duration: 0.01ms !important; }`, which breaks state transitions and can make changes more abrupt. Handle motion per component.
- For view transitions, opt in only when motion is allowed: wrap `@view-transition` in `@media (prefers-reduced-motion: no-preference)` (see {{ GUIDE_REF("cross-document-transitions") }}) and skip `document.startViewTransition()` when `reduce` matches.
- For JavaScript animations and videos with `autoplay`, react to runtime preference changes and pause playback when reduced motion is preferred:

```js
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function syncMotionPreference() {
  for (const video of document.querySelectorAll('video[autoplay]')) {
    if (reduceMotion.matches) video.pause();
    else video.play().catch(() => {});
  }
}
reduceMotion.addEventListener('change', syncMotionPreference);
syncMotionPreference();
```

Provide a visible pause control for autoplaying videos (the `controls` attribute is enough) and persistent animations like carousels or canvas loops.

### Format for the user's locale

Format numbers, currencies, and dates with `Intl`. Pass `navigator.languages`, the user's preferred languages in order, as the locale. DO NOT hardcode a locale like `'en-US'` or build date strings by hand:

```js
// The currency comes from your data, not from the user's locale.
const price = new Intl.NumberFormat(navigator.languages, { style: 'currency', currency: 'EUR' }).format(1234.5);
const date = new Intl.DateTimeFormat(navigator.languages, { dateStyle: 'medium' }).format(new Date());
```

### Save data when asked

When data saving is requested, avoid loading heavy, optional media:

- On the server, when the request has `Save-Data: on`, omit autoplaying videos, high-resolution imagery, and third-party embeds. Send `Vary: Save-Data` on responses that change with the header, so caches don't serve the lighter page to everyone.
- In the browser, do not insert optional media when `navigator.connection.saveData` is true; feature detection is covered in Fallback strategies below.
- Set `preload="none"` and omit `autoplay` on optional `<video>` elements.

## Fallback strategies

{{ FEATURE_FALLBACKS("light-dark") }}

### Save-Data

{{ BASELINE_STATUS("savedata") }}
{{ BASELINE_STATUS("network-information", "api.Navigator.connection") }}

Detect the property before reading it, and treat missing support as "data saving off":

```js
const saveData = Boolean(navigator.connection?.saveData);
```

Browsers without support send neither signal, so they get the full page. To let those users save data too, optionally offer an in-page "lite mode" setting.

### View transitions

{{ BASELINE_STATUS("view-transitions") }}
{{ BASELINE_STATUS("cross-document-view-transitions") }}

Browsers without support ignore `@view-transition` and navigate without an animation. Call `document.startViewTransition()` only if it exists; otherwise run the DOM update directly.

### CSS nesting

{{ BASELINE_STATUS("nesting") }}
