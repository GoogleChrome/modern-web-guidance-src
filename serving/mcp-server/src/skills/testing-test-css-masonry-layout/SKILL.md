---
description: Enable and test the proposed CSS masonry syntax in Chromium browsers for early developer feedback.
filename: test-css-masonry-layout
category: testing
---

# Test CSS Masonry Layout

Reference docs:
- [CSS Grid Level 3 Specification](https://drafts.csswg.org/css-grid-3)
- [Help us build CSS Masonry (Microsoft Edge Dev)](https://learn.microsoft.com/en-us/microsoft-edge/web-platform-features/experimental-features/css-masonry)
- [Feedback needed: How should we define CSS masonry? (Google Chrome)](https://developer.chrome.com/blog/masonry-syntax)
- [Help us choose the final syntax for Masonry in CSS (WebKit)](https://webkit.org/blog/16026/css-masonry-syntax/)

## Best Practices

To test CSS Masonry in Chromium-based browsers:

1.  Ensure you are using Chrome or Edge version 140 or later.
2.  Navigate to `about:flags` in your browser.
3.  Search for "CSS Masonry Layout".
4.  Enable the flag.
5.  Restart your browser.

Once enabled, you can explore CSS masonry features and provide feedback on the syntax and behavior.

## Enabling CSS Masonry

The CSS Working Group is currently drafting the CSS masonry specification. There are two main proposed syntaxes:

### `display: masonry`

This approach treats CSS masonry as a distinct `display` type. The current Chromium prototype is based on this proposal.

### `display: grid; grid-template-*: masonry;`

In this alternative, masonry is integrated directly into CSS grid layout. The masonry mode is activated by applying the `masonry` keyword to `grid-template-columns` (for row-based layouts) or `grid-template-rows` (for column-based layouts).

## Creating Masonry Layouts

### Column-based Masonry Container

Use `display: masonry` and define column sizes with `grid-template-columns`. `masonry-direction` defaults to `column`.

```css
.masonry {
  display: masonry;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}
```

### Row-based Masonry Container

Use `display: masonry`, define row sizes with `grid-template-rows`, and set `masonry-direction: row`.

```css
.masonry {
 display: masonry;
 masonry-direction: row;
 grid-template-rows: repeat(auto-fit, minmax(160px, 1fr));
 gap: 10px;
}
```

## Advanced Features and Properties

### Default Track Size

The proposed default track size for masonry is `repeat(auto-fill, auto)`, which creates a masonry layout without explicit track definitions.

```css
.masonry {
  display: masonry;
  gap: 10px;
}
```

### `masonry` Shorthand Property

This shorthand property allows defining the masonry direction and track definition in one declaration, avoiding the `grid-` prefix.

```css
.masonry {
 display: masonry;
 masonry: "a a b" 50px 100px 200px row;
}
```

### Custom Track Sizes

Masonry offers flexibility in defining track sizes, allowing for different sizes within the same layout.

```css
.masonry {
 display: masonry;
 masonry: repeat(2, 3rem) repeat(auto-fit, 5rem) 12rem;
}
```

### Spanning Multiple Tracks

Items can span multiple tracks, useful for emphasizing certain content.

```css
.masonry {
  display: masonry;
  masonry: repeat(auto-fill, minmax(12rem, 1fr));
}

.important-item {
  grid-column: span 2;
}
```

### Fine-tuning Item Placement (`item-tolerance`)

The `item-tolerance` property controls how sensitive item placement is to the running position in different tracks.

```css
.masonry {
  display: masonry;
  masonry: 200px 200px;
  gap: 10px;
  item-tolerance: 10px;
}
```

### Other Available Properties

You can utilize standard CSS Grid properties like `grid-row`, `grid-column`, `grid-area`, `grid-template-areas`, and `order` for item placement and sizing within masonry layouts.

## Call for Feedback

Your feedback is crucial in shaping the CSS masonry API. Explore the provided demos, experiment with the feature in Chromium, and share your thoughts on the syntax and behavior.

-   **Comment on GitHub Issue 11243:** [https://github.com/w3c/csswg-drafts/issues/11243](https://github.com/w3c/csswg-drafts/issues/11243)
-   **Share on X (formerly Twitter):** [https://x.com/ChromiumDev](https://x.com/ChromiumDev)
-   **Share on LinkedIn:** [https://www.linkedin.com/showcase/chrome-for-developers](https://www.linkedin.com/showcase/chrome-for-developers)
-   **Report bugs:** [https://issues.chromium.org/issues/new?component=1456721&template=0](https://issues.chromium.org/issues/new?component=1456721&template=0)

Be aware that CSS masonry is still under active development, and you may encounter limitations such as dense packing, reverse placement, subgrid, out-of-flow, baseline, DevTools, fragmentation, and gap decoration support.