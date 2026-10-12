---
name: progress
description: Build a styled progress bar that communicates completion of a task or process, in both determinate and indeterminate states.
web-feature-ids:
  - accent-color
  - progress
---

# Build a Styled Progress Bar

The `<progress>` element is the semantic way to represent the completion progress of a task, like downloading or uploading information or completing part of a multi-step process. Using the native element helps with accessibility, as screen readers have an implicit `role="progressbar"` and can announce values.

This guide implements a fully styled horizontal progress bar with style customizations.

## Progress bar or progress ring?

- If space is constrained or a square aspect ratio is preferable, consider using a circular progress bar (progress ring): {{ GUIDE_REF("progress-ring") }}
- Prefer spinners for most indeterminate progress scenarios ({{ GUIDE_REF("spinner") }}). Use indeterminate progress bars when the indeterminate state is temporary and will soon be replaced by a determinate progress bar (e.g. waiting for metadata around an upload before a progress % can be shown)

## Markup

1.  **Use a native `<progress>` element**: It provides built-in accessibility and platform-consistent behavior.
2. Use `max` if a scale different from the default 0-1 scale is needed.**
3. For a specific progress value, set a `value` attribute. Omit `value` for an indeterminate state (e.g. before more concrete feedback starts).
4. Use `<label for="...">`, `aria-labelledby`, or `aria-label` to associate the progress element with a label.

## What type of customization is needed?

For limited styling, these properties are sufficient:
- `accent-color` to change the color of the progress bar
- `width` / `inline-size` to change the width of the progress bar
- `height`/`block-size` applies inconsistently — test first
- `writing-mode: vertical-lr` for vertical bars.
- Effects that apply after painting: `opacity`, `filter`, `clip-path`, masks, transforms, `box-shadow`, etc.

If limited styling suffices, skip the next section.

WARNING: Certain properties (e.g. `border-radius`, `background`, `border`) will silently disable the default progress bar styling. If you need styling beyond the properties above, you must implement fully custom styling as described in the next section. Do NOT apply more extensive styling "just in case it works".

## Fully custom styling

1. **Reset browser styles:** For deeper customizations to the progress element that work across browsers, first turn off the default UI styles with `appearance: none`. 

```css
progress {
  /* Reset default browser styles and UA border */
  appearance: none;
  border: 0;
  /* You MUST set overflow to hidden if applying a border radius to the progress element so the inner fill pseudo-element doesn't overflow the rounded corners  */
  overflow: hidden;
}
```

2. **Tint the progress bar:** Use browser targeted pseudo-elements to apply color to the progress bar and track. 

```css
progress {
  --progress-color: var(--accent-color);
  --progress-track-color: lightgrey;
  /* Oversized hard-stop gradient so its movement is visible */
  --indeterminate-bg: linear-gradient(to right,
    transparent 0% 15%,
    var(--progress-color, currentColor) 15% 45%,
    transparent 45% 100%
  ) 0 0 / 200% 100%;
  --indeterminate-animation-duration: 1.5s;
  --_progress-bar-active: var(--progress-bar-active, var(--progress-color));
  --_progress-bar-bg: transparent;
  --_progress-bar-active-animation: var(--progress-bar-active-animation, none);
  /* Apply color for custom progress track (background) */
  background: var(--progress-track-color);
  animation: var(--_progress-bar-active-animation, none);
}

/* Browser prefixed pseudo-elements MUST NOT be grouped. If grouped one of the selectors will be ignored. */
/* Use browser targeted pseudo-elements to make the default progress background transparent */
progress::-webkit-progress-bar {
  /* Transparent in determinate mode and receives the indeterminate background on progress:indeterminate */
  background: var(--_progress-bar-bg);
  animation: var( --_progress-bar-active-animation);
}
/* Apply background for custom progress bar */
/* Webkit, Chrome */
progress::-webkit-progress-value {
  background: var(--_progress-bar-active);
}

/* Firefox */
progress::-moz-progress-bar {
  background: var(--_progress-bar-active);
  animation: var( --_progress-bar-active-animation);
}
```

3. **Add a custom animation for the indeterminate state:** Use the `:indeterminate` pseudo class to target the progress element in its indeterminate state to add a custom animation. 

```css
/* Use the :indeterminate pseudo-class to target the progress element in its indeterminate state */
progress:indeterminate {
  --_progress-bar-bg: var(--indeterminate-bg);
  --progress-bar-active-animation: loading var(--indeterminate-animation-duration) infinite linear;
  --progress-bar-active: var(--indeterminate-bg);
}

@keyframes loading {
  from { background-position: 90% 0; }
  to { background-position: -110% 0; }
}

/* Respect prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  progress {
    --indeterminate-animation-duration: 10s;
  }
}
```

### Additional Accessibility Considerations

In addition to the guidelines mentioned above:
* **Announce completion without stealing focus**: Do not set `tabindex` or call `.focus()` on `<progress>`, as it is non-interactive and moving focus to it disrupts keyboard users. To announce when a background task finishes, update a polite status element (`role="status"` or `aria-live="polite"`).
* Avoid `aria-busy` + `aria-describedby` on an unlabelled generic `<div>`. `aria-busy` has inconsistent screen reader support, and `aria-describedby` on an unnamed `<div>` without a role is ignored by assistive technologies. If a region's content is not ready while loading, hide it with `hidden` or `aria-hidden="true"`.
* **DO** respect `prefers-reduced-motion` if you apply custom animations.
* **DO** ensure proper contrast between the progress bar and track when adding custom styles.
* **Consider alternatives to represent indeterminate state**: Indeterminate progress bar animations displayed in parallel to other content can be considered distracting for some users.

## Fallback strategies

{{ FEATURE_FALLBACKS("accent-color") }}

If `accent-color` property is a progressive enhancement. Browsers that do not support it will use their default system colors, maintaining a functional experience.

If `accent-color` is not supported and styling the progress bar is required, use the customized styling method to apply preferred styling to the progress bar. 
