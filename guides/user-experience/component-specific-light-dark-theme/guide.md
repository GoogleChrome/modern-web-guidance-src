---
name: component-specific-light-dark-theme
description: Force certain elements to be in light mode or dark mode (e.g. code blocks, media players, etc) independently of the page's color-scheme.
web-feature-ids:
  - color-scheme
  - light-dark
---

# Component-Specific Light/Dark Themes

While more commonly set on the root, the `color-scheme` property can be set on individual elements to force them into a different color scheme from the rest of the page.
This can be useful for components that must always be viewed in a specific color scheme (e.g. always in dark or light mode).

Example use cases include:
- Elements that are often in dark mode even on light mode pages for aesthetic reasons, e.g. code blocks, media players, photo galleries
- Areas that contain media designed for a light background (e.g. images, videos, illustrations, print previews) can be set to light mode even if the rest of the page is in dark mode.
- Elements whose color-scheme is controlled by a user-level setting, such as component previews
- Embeds that don't support both light and dark modes
- Design tools, maps, visualizations, games etc.

## When to Change Colors vs. When to Force `color-scheme`?

Not every element that uses lighter text on darker background needs to be in a different `color-scheme`.
For example, a primary button may be rendered as blue with white text in light mode, but that does not warrant a `color-scheme: dark`.

As a rule of thumb, typically elements using a different `color-scheme` are complex surfaces establishing their own visual context, rather than simple shallow containers.

Ask yourself:

- Should built-in browser UI that is not otherwise customized (e.g. form controls, scrollbars, etc) adapt to the page's color-scheme or be forced into a specific one? -> if the latter, use `color-scheme`
- Should any `light-dark()` colors resolve like they do for the rest of the page or to a specific argument (the 1st or 2nd)? -> if the latter, use `color-scheme`
- What color mode should any descendants be in?

## Basic implementation

While not strictly necessary, this is typically used on pages that also support multiple color schemes via a global `color-scheme`.
For implementing this well, see {{ GUIDE_REF("dark-mode") }}.

Once this is in place, and you are using color tokens sensitive to `color-scheme` (e.g. using `light-dark()`) you can simply use `color-scheme` to override the color-mode for specific components:

```css
pre, code, .dark {
  color-scheme: dark;
}
```

Note that some browsers automatically adapt components to a different color scheme anyway.
To force the specified color scheme in all cases, use `only`, i.e. `color-scheme: only dark;` instead of `color-scheme: dark;`.

## Adapting non-color values

`light-dark()` currently only works for colors.
To adapt other values, for example to make thin font weights bolder in dark mode,

## Best practices

- **Mandatory**: Do not set `color-scheme` on elements without a background, as that risks mixing background and text color pairs from different color-schemes, resulting in unreadable text.
- OPTIONAL: While it is easier to reuse the same color pairs as the page-wide dark mode, we _can_ define different color pairs for these components. For example, we may want a dark mode component used in a light mode page to be a little less dark than when the same dark mode component is used in a page that is overall in dark mode.

### Important gotcha: Inheritance of `light-dark()` colors

`light-dark()` resolves at computed value time.
This means that any inherited `<color>` properties set to a `light-dark()` color will only pass down one of the two colors to their descendants, not the `light-dark()` expression itself.

This includes:
- Built-in properties like `color`, `accent-color`, `fill`, `stroke`
- Any registered inheritable custom properties with a `<color>` syntax and `inherits: true`
- Any other `<color>` property set to `inherit`

This means you should:
- **NOT** register custom properties meant to hold design tokens as `<color>`. If you need to animate a color variable, use a separate property on the element being animated.
- When setting `color-scheme` on an element, respecify any inherited `<color>` properties that may have been set to `light-dark()` values (directly or via design tokens) on any elements with a different `color-scheme` (even if that's to the same design token) otherwise they will still include the inherited value and will not adapt.
- **NOT** use `inherit` on `<color>` properties on elements with a `color-scheme` override (fine to use on their descendants).

Example:
```css
:root {
	--accent-color: light-dark(blue, skyblue);
	--surface-color: light-dark(white, #222);
	--text-color: light-dark(#111, white);

	color-scheme: light dark;
	accent-color: var(--accent-color);
	color: var(--text-color);
}

body {
	/* --surface-color dynamically switches despite being inherited because --surface-color is not registered */
	background: var(--surface-color);
}

pre, code {
	color-scheme: dark;
	background: var(--surface-color);

	/* Without this, accent-color would be blue, not skyblue! */
	accent-color: var(--accent-color);

	/* Without this, text-color would be #111, not white! */
	color: var(--text-color);
}
```

{{ FEATURE_ISSUES("color-scheme")}};

## Fallback strategies

{{ FEATURE_FALLBACKS("color-scheme")}}

{{ FEATURE_FALLBACKS("light-dark")}}
