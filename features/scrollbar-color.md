# scrollbar-color

## Usage

When using `scrollbar-color`, use CSS variables to keep thumb and track colors separate, for readability and maintainability (especially when using fallbacks).

```css
.scroller {
  --scrollbar-thumb: var(--color-neutral-70);
  --scrollbar-track: var(--color-neutral-90);

  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
}
```

## Issues

- Do NOT animate or transition `scrollbar-color`. A [WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=311752) causes the scrollbar to flicker every time `scrollbar-color` changes.
- Any computed `scrollbar-width` other than `auto` (`thin` or `none`) or computed `scrollbar-color` other than `auto` (including an inherited `scrollbar-color`) disables legacy `::-webkit-scrollbar` pseudo-elements on that element.
- With overlay scrollbars (such as the macOS default), `scrollbar-color` styles the thumb while scrolling, whereas the track may remain transparent. Ensure the thumb color has sufficient contrast against both the track color and the scrollable container's background rather than relying on the track to frame the thumb.

## Fallbacks

This feature is progressive enhancement and does not always require fallbacks.

If the styling is important and the user's Baseline target is "Baseline Widely Available" or earlier, you SHOULD include the non-standard `::-webkit-scrollbar` pseudo-elements as fallbacks.

Place legacy fallbacks after the base rule inside an `@supports not (scrollbar-color: auto)` block to prevent conflicts between standard properties and legacy WebKit selectors in browsers that support both natively. If you also set `scrollbar-width: thin` on the scrollable container, reset `scrollbar-width: auto` on the same selector inside `@supports not (scrollbar-color: auto)` so browsers that support `scrollbar-width` without `scrollbar-color` {# such as Safari 18.2–26.1 #} do not suppress `::-webkit-scrollbar` styling.

If you are using custom properties to define colors, these will cascade to the legacy WebKit selectors automatically. You do NOT need to duplicate them.

```css
/* Legacy fallback for WebKit/Blink browsers */
@supports not (scrollbar-color: auto) {
  .scroller {
    /* Reset scrollbar-width: thin (if set) so it does not disable
       ::-webkit-scrollbar in browsers without scrollbar-color */
    scrollbar-width: auto;
  }

  .scroller::-webkit-scrollbar {
    /* Must define a base size (e.g., 8px for thin or 12px for default) for custom colors to render in WebKit */
    width: 12px;
    height: 12px;
  }

  .scroller::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
  }

  .scroller::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }
}
```
