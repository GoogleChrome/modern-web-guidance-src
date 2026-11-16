---
name: overflow-safe-masking
description: Mask an element without hiding its focus ring or anything else it paints outside its border box (shadows, badges, ribbons etc).
web-feature-ids:
  - masks
---

# Overflow-Safe Masking

## Overview

Use this whenever the masked element can receive focus (links, buttons, scroll containers, anything with `tabindex`), paints outside its border box (`outline`, `box-shadow`), or when its exact identity and styling is unknown (e.g. in a utility class that can be applied to a variety of elements).
A regular mask hides all of that, so keyboard users lose the focus ring.
The fix is in the mask itself: no wrapper elements and no replacement focus styles.

## Keeping the focus ring visible

A mask hides everything its layers do not cover, and each layer is clipped to the border box by default. The element's own focus outline is painted outside the border box, so a regular mask hides it.

- DO NOT work around this by removing the outline, moving it to a wrapper, or replacing it with an inset indicator. Write the mask so that it leaves the outline alone.
- DO NOT just add `no-clip` to a regular mask. Its layers are either transparent outside the border box, or repeat there and bring a faded edge around to the opposite side. Both hide parts of the outline.
- Make the first mask layer fully opaque, unclipped, and subtract the layers below from it: `linear-gradient(black, black) no-clip subtract`. Everything outside the border box then stays visible.
- The layers below it paint what to *hide*, not what to show: the more opaque a layer is, the more it hides. A fade is a gradient that is `black` at the faded edge and `transparent` where the content is fully visible.
- Give each of those layers `no-repeat`, a position, and a size, so it covers only the area it hides.

## Example

{# Maintainer note: This is separate so that the section above can be transcluded into other guides without random examples getting in the way #}

```css
mask:
  /* Opaque everywhere, including outside the border box, minus the layers below */
  linear-gradient(black, black) no-clip subtract,
  /* What to hide: fades out the bottom 4rem (example value) of the element */
  linear-gradient(to bottom, transparent, black) bottom / 100% 4rem no-repeat;
```

## Existing masks

To keep a mask that paints what to show (e.g. an image), put two layers above it instead of rewriting it. The second layer inverts the mask within the border box, and the first inverts it back while keeping everything outside the border box visible.

```css
mask:
  linear-gradient(black, black) no-clip subtract,
  /* Clipped to the border box (the default), so only the box is inverted */
  linear-gradient(black, black) subtract,
  /* The existing mask, unchanged */
  url("shape.svg") center / contain no-repeat;
```

The outline still follows the border box, not the shape of the mask.

## Fallback strategies

{{ BASELINE_STATUS("masks") }}

{# BWA but included because agents *still* get this wrong. #}

No fallback is needed. DO NOT add `-webkit-mask` declarations: every browser that supports `no-clip` and `subtract` in `mask` supports them unprefixed.
