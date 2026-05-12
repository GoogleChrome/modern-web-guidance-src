---
name: optimize-scroll-stability
description: Keep the page layout, scroll bar, and scroll position as stable as possible as users scroll through content-heavy pages (feeds, dashboards, long lists) where elements transition from hidden to visible.
web-feature-ids:
  - contain-intrinsic-size
  - content-visibility
sources:
  - https://web.dev/articles/content-visibility#specify_the_natural_size_of_an_element_with_contain-intrinsic-size
  - https://12daysofweb.dev/2024/css-content-visibility/#pairing-with-contain-intrinsic-size
  - https://developer.mozilla.org/docs/Web/CSS/Reference/Properties/contain-intrinsic-size
  - https://developer.mozilla.org/docs/Web/CSS/Guides/Containment/Using#size_containment
---
`content-visibility: auto` is a useful tool for improving rendering performance as irrelevant content can be skipped for rendering.

Since `content-visibility: auto` applies size containment to an element when its contents are being skipped, the dimensions of the element will be as if it did not have any content: only its padding and border size will contribute. This can have undesirable effects on an element’s surrounding context: when an element becomes relevant it can cause reflow, within a scrollport it can cause the scrollbar to grow or even jitter, or it can cause the scroll position to be unstable.

## `contain-intrinsic-size`

The `contain-intrinsic-size` property, as well as its longhand and logical variants, can be used to help mitigate these issues.

- `contain-intrinsic-size` is a shorthand for `contain-intrinsic-width` and `contain-intrinsic-height`.
- `contain-intrinsic-block-size` and `contain-intrinsic-inline-size` are logical variants of the longhand properties.

The value syntax for the longhand properties is as follows:

- `none` means the element has no intrinsic size for the respective dimension.
- A `<length>` value can be provided to set the intrinsic size.
- `auto <length>` can be provided to set the intrinsic size when it is unknown, otherwise, it will use the last known size of the contents while skipped for rendering.

The default value is `auto none` which means initially there will be no intrinsic size for the contents, but it will use the last known size once that becomes available.

### Determining an intrinsic size

While in some scenarios the size of the content can vary significantly, in others where the size of the content is consistent, it can become possible to provide values that are accurate even across browsers or at different zoom levels. CSS provides numerous units that can be useful for this, such as the `lh` unit or `cap` units.

For example, if we know that the contents will only be 2 lines of text, then we can use a value like `2lh`:

```css
contain-intrinsic-block-size: auto 2lh;
```

For scenarios that use different layouts, we can add the sizes of the elements as well as any spacing between them.

```css
--label--block-size: 1lh;
--description-block-size: 0.8lh;
--gap: 8px;
/* Intrinsic size adds all the values together */
contain-intrinsic-block-size: auto calc(
  var(--label-block-size) + var(--gap) + var(--description-block-size)
);
```

When content size varies, one can use an average value or make a guess at what the could be. This won’t totally prevent a scrollbar from growing or shrinking, but it can reduce the negative effect.

## Fallback strategies

{{ BASELINE_STATUS("content-visibility") }}
{{ BASELINE_STATUS("contain-intrinsic-size") }}

`content-visibility` can be applied as a progressive enhancement, so there is no fallback strategy necessary. Consequently, this means there is no fallback necessary for `contain-intrinsic-size` as the element will not have size containment applied to them.
