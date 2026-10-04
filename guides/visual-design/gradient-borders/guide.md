---
name: gradient-borders
description: Create continuous gradient borders around an element, with a transparent content area
draft: stub
web-feature-ids:
  - background-clip-border-area
  - background-clip
  - masks
---

# Gradient Borders

## Implementation notes for guide authors

- Core guidance: `background-clip: border-area`
- Resources worth checking:
	- https://web.dev/articles/css-border-animations
	- https://codepen.io/web-dot-dev/pen/BarmdyM?editors=0110
- Fallback:
	- If content bg doesn't have to be transparent, just `linear-gradient(<color>)` with `background-clip: padding-box` over the gradient
	- If content bg has to be transparent, masked pseudo-element (very briefly, agents know this just fine, just reference it)
