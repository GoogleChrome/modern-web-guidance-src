---
name: dark-mode-toggle
description: Build a dark mode toggle component that allows users to override their system color scheme preference for the current site.
web-feature-ids:
  - color-scheme
  - prefers-color-scheme
  - light-dark
  - has
---

A dark mode toggle lets users override the system color scheme for one site.
The override is applied by updating `<meta name="color-scheme">`: `light dark` means "follow the system preference", `light` or `dark` pin an explicit scheme.
Colors (`light-dark()`), system colors, and native UI all key off the CSS `color-scheme` property, so the toggle works by keeping that property in sync with the `<meta>` (see [Reflect the override in CSS](#reflect-the-override-in-css)).

## Implementation

First, follow all steps in {{ GUIDE_REF("dark-mode") }} to support both schemes, defaulting to the system preference.

### Reflect the override in CSS

The `<meta>` is only a *presentational hint*: any `color-scheme` declaration in author CSS overrides it.
Since {{ GUIDE_REF("dark-mode") }} sets `color-scheme: light dark` on `:root`, updating the `<meta>` alone is a **no-op** — CSS wins.
Map the `<meta>` back to the property so the cascade follows it:

```css
:root {
  color-scheme: light dark;

  &:has(> head > meta[name="color-scheme"][content="dark"]) {
    color-scheme: dark;
  }
  &:has(> head > meta[name="color-scheme"][content="light"]) {
    color-scheme: light;
  }
}

```

**DO NOT** hardcode `color-scheme: light` or `color-scheme: dark` as the root default; the base declaration MUST stay `light dark`.
CSS MUST NOT depend on JS: if JS never runs, the `<meta>` stays `light dark` and the site follows the system preference — nothing breaks.

### Two states, not three

Three states ("Light", "Dark", "System") are plausible ("Follow system (currently dark)" sounds distinct from "Always dark") but wrong: at the moment of choosing, an override that matches the system preference is indistinguishable from the system default, so users cannot meaningfully express that intent — and selecting it produces no visible feedback.
A manual toggle is a temporary comfort adjustment ("it's too bright right now"), not a long-term policy ("make sure this never changes").

The only two states:

1. **System default** — no stored value, `<meta>` content `light dark`. Displayed as its current resolved value (e.g. a sun icon when light).
2. **Override** — stored literally as `light` or `dark`.

Essentially, it is a tri-state control (`light dark`, `light`, `dark`) where the explicit state matching the current system preference is unreachable.

On each toggle:

1. Target scheme = the opposite of the currently *rendered* scheme (stored value if any, else system preference). The user intent is "select the opposite of what I see right now", NOT "select the inverse of the system default".
2. If the target differs from the current system preference, store it literally.
3. If the target matches the current system preference, the user is undoing their adjustment: remove the stored value. DO NOT store it — that would invisibly pin the scheme against future system changes.
4. Set the `<meta>` content to the stored value, or `light dark` if none.

Divergence is checked only at storage time, never retroactively: a stored value that the system preference later changes to match MUST be kept.
Invariant: a stored value exists if and only if the user has an active override.

Example scenario, starting with the OS set to light:

1. The user toggles. Dark differs from the system preference, so `dark` is stored; the site turns dark.
2. The OS setting changes to dark. The site stays dark (the stored value now matches the system preference, but is kept).
3. The OS setting changes back to light. The site stays dark.
4. The user toggles. The target (light) matches the system preference, so the stored value is removed and the site follows the system again.

### Persistence and FOUC prevention

Persist the override in `localStorage`; remove the entry when returning to the system default.

To avoid a flash of the wrong scheme, apply the stored value in an inline script (NOT `type=module`, NOT `defer`) placed immediately after the `<meta>` element:

```html
<meta name="color-scheme" content="light dark">
<script>
document.querySelector('meta[name="color-scheme"]').content = localStorage.getItem("color-scheme") ?? "light dark";
</script>
```

- This inline script exists **only** for FOUC prevention. Keep it as small as possible; the rest of the component's JS can load later.
- In rare cases `localStorage` access can throw (e.g. site data blocked), but since this script does nothing else, the only side effect would be a console error. Wrap in `try .. catch` if this matters.
- The override can change from another tab: handle `window`'s `storage` event to stay in sync.

## Branching for HTML and non-color values

Colors need no extra work: once the `<meta>` is mapped to `color-scheme` (above), `light-dark()` follows the override.
This section is about adapting other values (e.g. `font-weight`, media sources, etc.).

When the page simply follows the system preference, `(prefers-color-scheme: dark)` can be used for branching, including in `<picture>` or `<video>` sources.
Overriding the color scheme adds an additional complication: the system preference is no longer the source of truth, and for APIs that only accept media queries there is no direct alternative.

Do NOT rely exclusively on JS-applied classes like `.dark` for branching, as they will be incorrect if JS doesn't load and the OS default is dark.

You can combine the media query with a `:root:has(> head > meta[name="color-scheme"][content="dark"])` (or `light`) selector to branch.
See {{ GUIDE_REF("selector-atrule-intersection") }} for details on how to implement this elegantly.

The control's own options are non-color branches too: include both states in the markup (icon plus visually hidden action text, e.g. "Switch to dark theme") and hide the inactive one via these selectors.
`display: none` also removes the redundant option from the AT so the control needs no JS to stay current when the system preference changes.

For in-HTML media, the only way right now is to include both versions as separate elements and toggle visibility appropriately.
Hiding `<source>` elements with `display: none` does not work.
