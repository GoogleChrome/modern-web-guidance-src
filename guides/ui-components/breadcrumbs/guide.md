---
name: breadcrumbs
description: Build a breadcrumb trail that shows the user's location within a site hierarchy and lets them navigate to ancestor pages, and optionally sibling pages via a dropdown menu.
web-feature-ids:
  - border-shape
  - corner-shape
  - popover
  - anchor-positioning
  - container-queries
  - has
  - forced-colors
  - focus-visible
  - prefers-reduced-motion
  - clip-path
  - logical-properties
guides:
  - menu
  - icons
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

- A styled character (`/`, `›`, `>`) generated as above is the simplest divider. For an icon divider such as a chevron, render it the way the codebase renders icons and keep it decorative; see {{ GUIDE_REF("icons") }}.

## 2. Styling

- Lay out with `display: flex; flex-wrap: wrap; align-items: center; gap` on the `<ol>`; reset list styles.
- Whatever the visual style, the trail must read as a path: each step visibly follows the previous one through a separator (slash or chevron) or an arrow or slant shape. Plain links with a separator are the default and the safest choice.
- **DO NOT** drop the separator in chip-like styles. Pills, tags and a segmented bar without one look like tabs or filters (items on the same level), not a hierarchy. Plain text with no divider is also weak, since order is then the only cue; avoid it.
- Choose a visual variant:
  - **Plain (slash or chevron):** use when the trail should stay visually quiet. Underline links at rest, or at least on hover and focus, so they never rely on color alone.
  - **Bar:** one bordered, segmented container with `overflow: clip`; use when segments need large, clear touch targets. Keep a separator in each segment after the first. A bar must not wrap: when its segments no longer fit on one row, stack it in a column in a container query set just above the bar's natural width (measure it and round up, so it stacks only when it would not fit), with compact rows (smaller block padding), separated by a 1px `border-block-start` and the chevron turned to point down and use a fixed `border-radius` for a joined pill, since `999px` becomes an oval once it grows tall. For a joined pill, round the container (`border-radius: 999px`, or `corner-shape: squircle` with a smaller radius) and separate segments with a 1px `border-inline-start` and no gap. Give the current page's `<li>` the same background as its link, so the chevron outside the link does not sit on the bar's background. Round the container, not the individual links, so the clip handles the end caps, and give the end links the same end radius so an inset focus ring follows the rounded ends instead of being cut off.
  - **Pills / tags:** use rounded or shaped links when the trail is a prominent control, with a separator between them. Show backgrounds only on hover for tags.
- Style the current page distinctly (weight, color) and non-current links with a hover state.
- Custom palettes must meet WCAG AA contrast (4.5:1 for text) for links, hover, and the current page against their actual backgrounds (e.g. dark red on light gray). Keep a non-color cue on the current page, such as font weight.
- Provide a clear `:focus-visible` outline. For shaped or clipped segments use a negative `outline-offset` or a background/color change, since outlines get clipped.
- Lift the focused control above its neighbors (`position: relative; z-index: 1` on `a:focus-visible, button:focus-visible`). Neighbors that overlap it (shaped segments) or touch it (a joined dropdown trigger) are painted later and cover an outside ring.
- In `forced-colors: active`, restore borders and an underline on `[aria-current="page"]` since backgrounds are removed. An icon divider drawn as a masked background also needs `forced-color-adjust: none` and a system color such as `CanvasText`, since forced colors replaces the background.

### Shaped segments (slant or arrow)

Pick **one** shape per trail: slant or arrow. The snippets below are alternatives, not meant to be combined.

- Define each segment's polygon in a custom property (`--shape`) and apply it with `border-shape` so borders and focus outlines follow the shape.
- Selectors are illustrative; use your own hook (`.breadcrumb` here). Scope to `> ol > li > a` so dropdown menu links aren't shaped. Only add per-variant classes if one page really shows several variants.
- Make the slant or point size responsive with `clamp()` and container units (`cqi`).
- Pair state colors with the shape: hover and current-page styles must use background or text color, not border color, so they still show under the `clip-path` fallback. Keep the focus style visually distinct from hover.
- The overlap margin applies to shaped segments only. A collapsed trail's "…" item is a plain button, so give it and the item after it a normal gap, or they overlap the button and cover its focus ring.
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
- Position the popover below the trigger with anchor positioning (`position-area: block-end span-inline-end`, `position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline`). Reset the UA `inset: auto` and `margin`.
- Keep the combined `flip-block flip-inline` fallback last. On a narrow screen near the bottom, the menu is too wide for the inline-end side and too tall for below, so each single flip fixes only one axis and the browser keeps the base placement, covering the trigger or running off screen.
- Rotate the trigger chevron while open: `.trigger:has(+ :popover-open)`.
- Wrap entry/exit fades in `prefers-reduced-motion: no-preference`.
- For pills, join link and trigger into one shape by squaring the touching corners (`border-start-end-radius: 0` etc., using logical properties).
- Close an open menu when keyboard focus leaves it. `popover` light dismiss covers clicks outside and `Esc`, but not `Tab`, and a menu left open can cover the next focused control. This also applies to the "…" list in section 4. Scope it to the breadcrumb's own menus so it never closes unrelated popovers, such as a toast or tooltip.

```js
// Close an open breadcrumb menu once focus lands outside it and its own trigger (the trigger is excluded so toggling it still works).
// Scope to the breadcrumb <nav> (use your own selector) so unrelated popovers stay open.
const trail = document.querySelector('nav[aria-label="Breadcrumbs"]');
document.addEventListener('focusin', ({ target }) => {
  for (const menu of trail.querySelectorAll('[popover]:popover-open')) {
    if (!menu.contains(target) && !target.closest(`[popovertarget="${menu.id}"]`)) menu.hidePopover();
  }
});
```

## 4. Collapsing long trails

Collapse any trail with more than 3 items on narrow containers instead of letting it wrap; wrapped trails take 2-3 rows on a phone.

- Make the `<nav>` a size container (`container-type: inline-size`, in the snippet below) so it responds to its own width, not the viewport.
- Keep the first item and the last two. Add a "…" `<li>` after the first item, containing a `[popover]` button that lists the hidden links. Give the button `aria-label="Show N more breadcrumbs"`.
- Show the "…" item only when collapsed (`display: none` by default, `display: flex` in a container query). The container query is the single source of truth for when the trail is collapsed; no rule hides the middle items.
- Move the real middle `<li>` links into the popover's list when the "…" item is visible, and back into the trail when it is not. Don't duplicate them. A `ResizeObserver` on the `<nav>` re-checks on resize, and the check reads `getComputedStyle(overflow).display`. The "…" item's `display` depends only on the container's width, so moving items cannot cause a resize loop. Without script, the full trail stays visible and the "…" item stays hidden.
- Moving a link drops focus if it had it, so restore focus afterwards. Close the popover when expanding back to the full trail.

```css
.breadcrumb { container-type: inline-size; }
.breadcrumb .overflow { display: none; }
/* 40rem is an example breakpoint */
@container (inline-size < 40rem) {
  .breadcrumb .overflow { display: flex; }
}
```

```js
const nav = document.querySelector('nav[aria-label="Breadcrumbs"]');
const trail = nav.querySelector('ol');
const overflow = trail.querySelector('.overflow');
const menu = overflow.querySelector('[popover] ul');

function sync() {
  const collapsed = getComputedStyle(overflow).display !== 'none';
  // Middle items: everything except the first, the last two and the "…" item
  const items = [...trail.children].filter((li, i, all) =>
    li !== overflow && i !== 0 && i < all.length - 2);
  const focused = document.activeElement;
  if (collapsed) menu.append(...items);
  else if (menu.children.length) {
    overflow.querySelector('[popover]').hidePopover();
    overflow.after(...menu.children);
  }
  focused?.isConnected && focused.focus();
}
new ResizeObserver(sync).observe(nav);
```

- Optional, for very narrow containers: show only the parent link with a leading "‹" (decorative, empty alt text) by hiding every `<li>` except `:nth-last-child(2)`.
- Hidden items must be removed with `display: none` so that they leave the tab order and accessibility tree.

## Fallback strategy

### `border-shape`

{{ BASELINE_STATUS("border-shape") }}

- Use `clip-path: var(--shape)` with the same polygon as the base style, and enhance inside `@supports (border-shape: polygon(0 0, 100% 0, 100% 100%))` by setting `clip-path: none` and applying `border-shape`.
- `clip-path` clips borders and outlines, so under the fallback use a color/background change plus negative `outline-offset` for focus instead of an outside outline.
- `clip-path` also cuts the slanted sides off a border, and `forced-colors: active` removes the background that draws the shape, so a clipped segment loses its outline. Under forced colors, drop the clip and use plain bordered segments with a text separator so the trail still reads as a path:

```css
@media (forced-colors: active) {
  /* Only without border-shape: with it, the border follows the shape and needs no change */
  @supports not (border-shape: polygon(0 0, 100% 0, 100% 100%)) {
    .breadcrumb > ol > li > a { clip-path: none; border: 2px solid LinkText; }
    .breadcrumb > ol > li + li { margin-inline-start: 0; } /* undo the shape overlap */
    .breadcrumb > ol > li + li::before { content: "›" / ""; } /* the shape no longer shows direction */
  }
}
```

- The trail remains fully functional; only borders and outlines differ.

### `corner-shape`

{{ BASELINE_STATUS("corner-shape") }}

- Graceful degradation: unsupported browsers keep the plain `border-radius` corners. Wrap `corner-shape` in `@supports (corner-shape: squircle)` and tune the radius there.

{{ FEATURE_FALLBACKS("popover") }}

### Anchor positioning

{{ BASELINE_STATUS("anchor-positioning") }}

- Wrap anchor-based placement in `@supports (position-area: block-end)`. Otherwise, on the popover's `toggle` event (`newState === "open"`), set `position: fixed` and compute `inset-block-start`/`inset-inline-start` from the trigger's `getBoundingClientRect()`, clamped to the viewport.
