---
name: progress
description: Build a styled progress bar that communicates completion of a task or process, in both determinate and indeterminate states.
web-feature-ids:
  - accent-color
  - progress
  - tmp-revert-rule
---

# Build a Styled Progress Bar

The `<progress>` element is the semantic way to represent the completion progress of a task, like downloading or uploading information or completing part of a multi-step process. Using the native element helps with accessibility, as screen readers have an implicit `role="progressbar"` and can announce values.

This guide implements a fully styled horizontal progress bar with style customizations.

## Progress bar or progress ring?

- If space is constrained or a square aspect ratio is preferable, consider using a circular progress bar (progress ring): {{ GUIDE_REF("progress-ring") }}
- Prefer spinners for most indeterminate progress scenarios ({{ GUIDE_REF("spinner") }}). Use indeterminate progress bars when the indeterminate state is temporary and will soon be replaced by a determinate progress bar (e.g. waiting for metadata around an upload before a progress % can be shown)

## Markup

1.  **Use a native `<progress>` element**: It provides built-in accessibility and platform-consistent behavior.
2. Use `max` if a scale different from the default 0-1 scale is needed.
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

### 1. Basic setup

- MANDATORY: Use `appearance: none` to enable custom styling.
- Reset UA borders with `border: 0 solid`
- To clip the active bar to the element’s border-radius, use `overflow: clip` OR apply `border-radius: inherit` to the inner bar.

```css
progress {
  /* Reset default browser styles */
  appearance: none;
  border: 0 solid;
  /* Clip bar to element’s border-radius  */
  overflow: clip;
}
```

### 2. Styling

- Style the track on the `progress` element itself.
- Use the appropriate browser-targeted pseudo-element to target the progress bar itself: `::-webkit-progress-value` for WebKit/Blink and `::-moz-progress-bar` for Firefox.
- MANDATORY: Do NOT group `-webkit-` and `-moz-` pseudo-elements in the same rule. The rule will be deemed invalid and will be ignored. `:is()` and `:where()` do not help here, as they don't support pseudo-elements.
- Each browser-targeted pseudo-element should appear exactly once. State-specific customizations (such as the indeterminate segment size and animation) should be routed through custom properties set on the `progress` element itself.

```css
progress {
  /* Apply color for custom progress track (background) */
  background: var(--progress-bar-track, var(--color-neutral-90));
}

/* Let <progress> styling show through */
progress::-webkit-progress-bar {
  background: transparent;
}

/* Webkit, Chrome */
progress::-webkit-progress-value {
  background: var(--progress-bar-fill, var(--accent-color));
}

/* Firefox */
progress::-moz-progress-bar {
  background: var(--progress-bar-fill, var(--accent-color));
}
```

### 3. Indeterminate state styling

**Add a custom animation for the indeterminate state:** Turn the fill pseudo-element into a short segment and slide it along the track.
- Style the fill itself; do NOT recreate it as a background on `progress`.
- The indeterminate fill exists only through its animation: the keyframes set both its position (`margin-inline-start`) and its length (`inline-size`). Animations beat Chromium's UA inline `inline-size`, so no other sizing is needed. Do NOT set `min-inline-size` or `inline-size` on the pseudo-elements; it would clamp keyframes that vary the length.
- Define the public `--progress-bar-indeterminate-*` properties on `progress` (their name already scopes them to the state) so consumers can override them without knowing about `:indeterminate`.
- To vary the segment length (e.g. the leading edge races ahead and the trailing edge catches up), supply different keyframes via `--progress-bar-indeterminate-animation` and animate the two edges independently: `margin-inline-end` for the leading edge, `margin-inline-start` for the trailing edge, with `inline-size: auto` in `from, to`. Per-keyframe `animation-timing-function` gives each edge its own easing.
- `--progress-bar-animation` applies in both states and can be used for effects such as a determinate shimmer. `revert-rule` is used to only override when it is set, to maximize composability.
- Never disable the indeterminate animation (`animation: none` leaves a zero-width fill in Chromium). For reduced motion, slow it down instead.

```css
progress {
  /* Segment length relative to the track */
  --progress-bar-indeterminate-size: 30%;
  --progress-bar-indeterminate-animation-duration: 1.5s;

  /* Respect prefers-reduced-motion */
  @media (prefers-reduced-motion: reduce) {
    --progress-bar-indeterminate-animation-duration: 10s;
  }
}

progress:indeterminate {
  --progress-bar-animation: var(
      --progress-bar-indeterminate-animation,
      progress-bar-indeterminate var(--progress-bar-indeterminate-animation-duration) infinite linear
    );
}

/* Add to the existing pseudo-element rules */
progress::-webkit-progress-value {
  animation: var(--progress-bar-animation, revert-rule);
}

progress::-moz-progress-bar {
  animation: var(--progress-bar-animation, revert-rule);
}

/* Logical property: the segment travels from inline-start to inline-end in both LTR and RTL.
   The keyframes also own the segment length. */
@keyframes progress-bar-indeterminate {
  from, to { inline-size: var(--progress-bar-indeterminate-size); }
  from { margin-inline-start: calc(-1 * var(--progress-bar-indeterminate-size)); }
  to { margin-inline-start: 100%; }
}
```

### Additional Accessibility Considerations

In addition to the guidelines mentioned above:
* **Announce completion without stealing focus**: Do not set `tabindex` or call `.focus()` on `<progress>`, as it is non-interactive and moving focus to it disrupts keyboard users. To announce when a background task finishes, update a polite status element (`role="status"` or `aria-live="polite"`).
* Avoid `aria-busy` + `aria-describedby` on an unlabelled generic `<div>`. `aria-busy` has inconsistent screen reader support, and `aria-describedby` on an unnamed `<div>` without a role is ignored by assistive technologies. If a region's content is not ready while loading, hide it with `hidden` or `aria-hidden="true"`.
* **DO** ensure proper contrast between the progress bar and track when adding custom styles.
* **Consider alternatives to represent indeterminate state**: Indeterminate progress bar animations displayed in parallel to other content can be considered distracting for some users.

## Fallback strategies

{{ FEATURE_FALLBACKS("accent-color") }}

If `accent-color` property is a progressive enhancement. Browsers that do not support it will use their default system colors, maintaining a functional experience.

If `accent-color` is not supported and styling the progress bar is required, use the customized styling method to apply preferred styling to the progress bar.

**Firefox RTL indeterminate:** Gecko positions the indeterminate fill at the physical left and applies only the physical left margin (`nsProgressFrame::ReflowChildFrame`), so in RTL the sliding segment stays still. Determinate bars are unaffected. Until this is fixed in Firefox, there is no logical-property workaround; if RTL motion in Firefox is required, pin the fill to the physical left in Chromium too (`margin-right: auto` on `::-webkit-progress-value`), animate `translate` instead of `margin-inline-start`, and set `animation-direction: reverse` under `progress:indeterminate:dir(rtl)`.

{{ BASELINE_STATUS('tmp-revert-rule') }}

If `revert-rule` is not supported, the declaration becomes IACVT (invalid at computed-value time) and behaves as `unset`. Here `animation` computes to `none`, same as the UA, so no guard is needed.

Do NOT try to store `revert-rule` in a custom property as a fallback (e.g. `--revert-rule: revert-rule`): a CSS-wide keyword as a custom property value applies to the custom property itself, so the property computes to empty and the `var()` falls through to IACVT anyway.
