---
name: breadcrumbs
description: Build a breadcrumb trail that shows the user's location within a site hierarchy and lets them navigate to ancestor pages, and optionally sibling pages via a dropdown menu.
web-feature-ids:
  - border-shape
  - corner-shape
  - popover
  - anchor-positioning
  - container-queries
guides:
  - menu
---

# Build breadcrumbs

Breadcrumbs show where the user is in a site hierarchy and link to each ancestor page. Optionally, each ancestor can expose a dropdown of sibling pages, and long trails can collapse on narrow containers.

This is not for switching between views of the same page (tabs) or for site-wide navigation (a navbar). For the dropdown's menu mechanics, see {{ GUIDE_REF("menu") }}.

{# Maintainer note: the tabs, navbar, element-shape, overflow-popup and responsive-disclosure guides are still empty shells, so they are not linked. When they are written, link tabs and navbar from the first sentence, element-shape from "Shaped segments" and "Corner treatments", and overflow-popup and responsive-disclosure from "Collapsing long trails". #}

## 1. Semantics (MANDATORY)

- Wrap the trail in `<nav aria-label="Breadcrumbs">` containing an ordered list (`<ol>`) of `<li>` items, each holding an `<a>`. Order conveys hierarchy, so use `ol`, not `ul`.
- Give each `<nav>` a unique label if a page has several landmarks (e.g. "Breadcrumbs").
- Mark the current page, the last item, as a link with `aria-current="page"`. Keep it a link (not plain text) so the trail structure stays consistent.
- Dividers are decorative. Do not put them in the markup as text. Generate them in CSS with an empty alt so they stay out of the accessibility tree:

```css
/* The empty alt text after the slash hides the divider from screen readers; li + li skips the first item */
.breadcrumb > ol > li + li::before { content: "/" / ""; }
```

- For an icon divider (e.g. a chevron), use an empty `content: ""` with a `mask` (SVG data URI) on `background: currentColor` so the divider follows text color and forced-colors mode.

## 2. Styling

- Lay out with `display: flex; flex-wrap: wrap; align-items: center; gap` on the `<ol>`; reset list styles.
- Choose a visual variant:
  - **Plain (slash, chevron, text only):** use when the trail should stay visually quiet. For text-only (no divider), keep links underlined so they don't rely on color alone.
  - **Bar:** one bordered, segmented container with `overflow: clip`; use when segments need large, clear touch targets. For a joined pill, round the container (`border-radius: 999px`, or `corner-shape: squircle` with a smaller radius) and separate segments with a 1px `border-inline-start` and no gap. Round the container, not the individual links, so the clip handles the end caps.
  - **Pills / tags:** use rounded or shaped links when the trail is a prominent control. Show backgrounds only on hover for tags.
- Style the current page distinctly (weight, color) and non-current links with a hover state.
- Custom palettes must meet WCAG AA contrast (4.5:1 for text) for links, hover, and the current page against their actual backgrounds (e.g. dark red on light gray). Keep a non-color cue on the current page, such as font weight.
- Provide a clear `:focus-visible` outline. For shaped or clipped segments use a negative `outline-offset` or a background/color change, since outlines get clipped.
- In `forced-colors: active`, restore borders and an underline on `[aria-current="page"]` since backgrounds are removed.

### Shaped segments (slant or arrow)

Pick **one** shape per trail: slant or arrow. The snippets below are alternatives, not meant to be combined.

- Define each segment's polygon in a custom property (`--shape`) and apply it with `border-shape` so borders and focus outlines follow the shape.
- Selectors are illustrative; use your own hook (`.breadcrumb` here). Scope to `> ol > li > a` so dropdown menu links aren't shaped. Only add per-variant classes if one page really shows several variants.
- Make the slant or point size responsive with `clamp()` and container units (`cqi`).
- Pair state colors with the shape: hover and current-page styles must use background or text color, not border color, so they still show under the `clip-path` fallback. Keep the focus style visually distinct from hover.
- Polygons are physically directional and logical properties don't flip `polygon()` coordinates, so each shape needs an explicit `:dir(rtl)` mirror, included in the snippets.

#### Slant (`/`)

Every segment, including the first and last, gets the same parallelogram. Reuse the slant size for the polygon offsets, the horizontal padding (so text clears the angled edges), and the negative margin (so neighbors interlock):

```css
/* SLANT ONLY. --slant is an example size; keep it small relative to the segment height */
.breadcrumb { --slant: clamp(.4rem, 2cqi, .75rem); }
.breadcrumb > ol, .breadcrumb > ol > li { gap: 0; }
.breadcrumb > ol > li > a {
  display: block;
  /* Top edge shifted right, bottom edge shifted left: leans like "/" */
  --shape: polygon(var(--slant) 0, 100% 0, calc(100% - var(--slant)) 100%, 0 100%);
  /* Extra inline padding equal to the slant keeps text out of the angled corners */
  padding: .55rem calc(var(--slant) + .8rem);
  border-shape: var(--shape);
}
/* Overlap by the slant, minus a small visible gap (example .25rem), so the angled edges run parallel */
.breadcrumb > ol > li + li { margin-inline-start: calc(.25rem - var(--slant)); }
/* RTL mirror: leans like "\" */
.breadcrumb:dir(rtl) > ol > li > a {
  --shape: polygon(0 0, calc(100% - var(--slant)) 0, 100% 100%, var(--slant) 100%);
}
```

#### Arrow (`>`)

Each segment points forward; the first item has a flat leading edge. Overlap neighbors by slightly less than `--point` (no gap), and use the same padding and margin approach as the slant.

```css
/* ARROW ONLY. */
.breadcrumb > ol > li > a {
  --shape: polygon(0 0, calc(100% - var(--point)) 0, 100% 50%, calc(100% - var(--point)) 100%, 0 100%, var(--point) 50%);
}
/* First item: drop the inner notch vertex so its leading edge stays flat */
.breadcrumb > ol > li:first-child > a {
  --shape: polygon(0 0, calc(100% - var(--point)) 0, 100% 50%, calc(100% - var(--point)) 100%, 0 100%);
}
/* RTL mirror: swap 0 with 100% and calc(100% - var(--point)) with var(--point) in each x coordinate */
.breadcrumb:dir(rtl) > ol > li > a {
  --shape: polygon(100% 0, var(--point) 0, 0 50%, var(--point) 100%, 100% 100%, calc(100% - var(--point)) 50%);
}
.breadcrumb:dir(rtl) > ol > li:first-child > a {
  --shape: polygon(100% 0, var(--point) 0, 0 50%, var(--point) 100%, 100% 100%);
}
```

### Corner treatments (pills, tags)

- Use `corner-shape` (`squircle`, `bevel`, `scoop`, `notch`) together with `border-radius`; the radius controls the size and `corner-shape` the form.

## 3. Sibling dropdowns (optional)

Add when ancestors have meaningful siblings (e.g. docs sections); skip for simple trails.

- Keep the ancestor link navigating. Add a **separate** `<button type="button" popovertarget>` right after it in the same `<li>`; never put the toggle inside the `<a>`.
- Give the button an `aria-label` naming its purpose (e.g. "Pages at the same level as Components") and hide its chevron icon with `aria-hidden="true"`.
- The menu is a `[popover]` `<ul>` of links, labeled with `aria-label`. Mark the sibling matching the current ancestor with `aria-current="true"` and visually label it.
- Position the popover below the trigger with anchor positioning (`position-area: block-end span-inline-end`, `position-try-fallbacks: flip-block, flip-inline`). Reset the UA `inset: auto` and `margin`.
- Rotate the trigger chevron while open: `.trigger:has(+ :popover-open)`.
- Wrap entry/exit fades in `prefers-reduced-motion: no-preference`.
- For pills, join link and trigger into one shape by squaring the touching corners (`border-start-end-radius: 0` etc., using logical properties).

## 4. Collapsing long trails (optional)

Use for trails with more than ~4 items.

- Make the `<nav>` a size container (`container-type: inline-size`) so it responds to its own width, not the viewport.
- Keep first item, last two items; mark the middle items with a class and hide them in a container query. Add a "…" `<li>` containing a `[popover]` button that lists the hidden links (copy the middle links into the popover). Give the button `aria-label="Show N more breadcrumbs"`.
- Show the "…" item only when the middle is hidden (`display: none` by default, shown inside the container query).
- Optional, for very narrow containers: show only the parent link with a leading "‹" (decorative, empty alt text) by hiding every `<li>` except `:nth-last-child(2)`.
- Hidden items must be removed with `display: none` so that they leave the tab order and accessibility tree.

## Fallback strategy

### `border-shape`

{{ BASELINE_STATUS("border-shape") }}

- Use `clip-path: var(--shape)` with the same polygon as the base style, and enhance inside `@supports (border-shape: polygon(0 0, 100% 0, 100% 100%))` by setting `clip-path: none` and applying `border-shape`.
- `clip-path` clips borders and outlines, so under the fallback use a color/background change plus negative `outline-offset` for focus instead of an outside outline.
- The trail remains fully functional; only borders and outlines differ.

### `corner-shape`

{{ BASELINE_STATUS("corner-shape") }}

- Graceful degradation: unsupported browsers keep the plain `border-radius` corners. Wrap `corner-shape` in `@supports (corner-shape: squircle)` and tune the radius there.

{{ FEATURE_FALLBACKS("popover") }}

### Anchor positioning

{{ BASELINE_STATUS("anchor-positioning") }}

- Wrap anchor-based placement in `@supports (position-area: block-end)`. Otherwise, on the popover's `toggle` event (`newState === "open"`), set `position: fixed` and compute `inset-block-start`/`inset-inline-start` from the trigger's `getBoundingClientRect()`, clamped to the viewport.
