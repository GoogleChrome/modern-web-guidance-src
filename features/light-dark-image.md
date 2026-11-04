# `light-dark()` with image values

## Fallbacks

For browsers that do not support `light-dark()` for images, use `image-set()` as a switch:
give each option a `type()` from a custom property, and set the inactive one to an unsupported MIME type so the browser discards that option.
The active option gets an empty value, so it is a plain `image-set()` option with no `type()`.

Define the switch once on `:root`. Every use site then only needs both images inline, like `light-dark()`.

```css
:root {
  --light-type: ;
  --dark-type: type("image/do-not-use");

  /* MANDATORY: Fallback for browsers without light-dark() image support */
  @media (prefers-color-scheme: dark) {
    --light-type: type("image/do-not-use");
    --dark-type: ;
  }
}

.hero {
  background-image: image-set(url(hero-light.png) var(--light-type), url(hero-dark.png) var(--dark-type));

  @supports (background-image: light-dark(url("a"), url("b"))) {
    background-image: light-dark(url(hero-light.png), url(hero-dark.png));
  }
}
```

- Only the selected image is downloaded.
- Resolutions still work: `image-set(url(a-1x.png) 1x var(--light-type), url(a-2x.png) 2x var(--light-type), url(b-1x.png) 1x var(--dark-type), url(b-2x.png) 2x var(--dark-type))`.
- **DO NOT** use `type("")` for the active option. Browsers treat the empty string as unsupported and drop every option.
- Unlike `light-dark()`, the switch does not follow `color-scheme` set on a subtree. A manual toggle, or any subtree that sets `color-scheme`, MUST also flip `--light-type` and `--dark-type`.

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
