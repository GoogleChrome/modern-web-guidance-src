# `light-dark()` with image values

## Fallbacks

For browsers that do not support `light-dark()` for images, use `image-set()` as a switch:
give each image a resolution from a custom property, and set the inactive one to `0x` so it is never selected.
Browsers pick the smallest resolution that is at least the device pixel ratio, or the largest one if none qualifies, so the `1x` option always wins over `0x`.

Define the switch once on `:root`. Every use site then only needs both images inline, like `light-dark()`.

```css
:root {
  --light-res: 1x;
  --dark-res: 0x;

  /* MANDATORY: Fallback for browsers without light-dark() image support */
  @media (prefers-color-scheme: dark) {
    --light-res: 0x;
    --dark-res: 1x;
  }
}

.hero {
  background-image: image-set(url(hero-light.png) var(--light-res), url(hero-dark.png) var(--dark-res));

  @supports (background-image: light-dark(url("a"), url("b"))) {
    background-image: light-dark(url(hero-light.png), url(hero-dark.png));
  }
}
```

- **DO NOT** use a huge resolution (e.g. `1000x`) for the inactive option. On high-DPI screens no option is at least the device pixel ratio, so the largest one gets picked.
- Only the selected image is downloaded.
- If a manual color-scheme toggle exists, it MUST also flip `--light-res` and `--dark-res`.

### Alternative: one custom property per image

Simpler when only a handful of images vary, but every image needs its own media query branch, and a manual toggle must flip each one.

```css
:root {
  --hero-image: url(hero-light.png);

  @media (prefers-color-scheme: dark) {
    --hero-image: url(hero-dark.png);
  }

  @supports (background-image: light-dark(url("a"), url("b"))) {
    --hero-image: light-dark(url(hero-light.png), url(hero-dark.png));
  }
}

.hero {
  background-image: var(--hero-image);
}
```
