---
name: swipe-to-remove
description: Let users act on items in a list (remove, archive, mark as read, etc.) with a horizontal swipe gesture, so they can process entries quickly without tapping a separate control.
web-feature-ids:
  - scroll-snap
  - scroll-initial-target
  - overscroll-behavior
  - scrollbar-width
  - intersection-observer
  - web-animations
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll_snap
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overscroll-behavior
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-width
  - https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
  - https://developer.mozilla.org/en-US/docs/Web/API/Element/animate
---

# Swipe to remove

Swipe-to-remove patterns are common in mobile applications but can be challenging to implement cleanly on the web. By using CSS Scroll Snap, you can create a smooth, native-feeling swipe interaction that hooks directly into the browser's scrolling engine. This ensures high performance and physics-based momentum without needing a complex JavaScript gesture library.

The same pattern works for any single-action swipe (remove, archive, mark as read, snooze). The action visuals change; the mechanics do not.

## How to implement

Each swipable list item is structured as: an outer `<li>`, an inner scroll **track** (the scroll container with the snap points), and a **content** element (the visible row). The action's revealed UI (trash icon, archive label, etc.) lives on either side of the content.

### Step 1: Mark up each item with a track and content

```html
<ul>
  <li id="list-item-1" class="SwipeableItem">
    <div class="SwipeableItem-track">
      <div class="SwipeableItem-content">Item One</div>
    </div>
  </li>
  <li id="list-item-2" class="SwipeableItem">
    <div class="SwipeableItem-track">
      <div class="SwipeableItem-content">Item Two</div>
    </div>
  </li>
  <!-- ...more items... -->
</ul>
```

### Step 2: Configure the track as a horizontal snap container with three snap points

The track has three full-width columns: a left spacer (`::before`), the content, and a right spacer (`::after`). Snapping to a spacer means the content is fully off-screen, which is the rest position after a committed swipe.

The track configuration is gated behind an `.is-initialized` class on the list item. Before JS upgrades the row, the item just renders as plain content with no horizontal scroller. The class is added in Step 4 once the JavaScript that detects swipes has been wired up. This ensures the user cannot swipe before the functionality is ready.

```css
.SwipeableItem {
  /* Establishes a containing block for the absolutely positioned action
     icons (Step 3) and clips overflow during the row's removal
     animation (Step 4). */
  contain: content;
}

/* The track only becomes a scroll snap container after JS upgrades
   the row by adding `.is-initialized` (see Step 4). */
.SwipeableItem.is-initialized .SwipeableItem-track {
  /* Three full-width columns: left spacer | content | right spacer.
     Width is 100% of the track, so each column fills the viewport row. */
  display: grid;
  grid-template-columns: 100% 100% 100%;

  /* Horizontal scroll only; vertical overflow is clipped so the
     reveal stays inside the row. */
  overflow: scroll clip;

  /* Prevent the swipe from chaining into the page scroll or browser
     back-gesture on iOS/Android. */
  overscroll-behavior-x: none;

  /* Hide the scrollbar; the gesture is the affordance. */
  scrollbar-width: none;

  /* `mandatory` ensures the track always rests on a snap point
     (spacer or content), never partially scrolled. */
  scroll-snap-type: x mandatory;
}

/* Spacers act as the left and right snap targets, AND carry the action's
   reveal color. As the user swipes, the colored spacer slides into view,
   which is what the user sees behind the content. */
.SwipeableItem.is-initialized .SwipeableItem-track::before,
.SwipeableItem.is-initialized .SwipeableItem-track::after {
  content: '';

  /* `scroll-snap-align` is required to make this a valid snap target,
     but the specific value (`start`/`center`/`end`) doesn't matter here
     because each snap point spans the full width of the scroll
     container, so all alignments resolve to the same resting position. */
  scroll-snap-align: start;

  /* `hsl(0 65% 50%)` is an example value; pick whatever fits your
     design (red here signals "delete"; use a different color for
     archive, mark-as-read, etc.). */
  background-color: hsl(0 65% 50%);
}

.SwipeableItem-content {
  /* The content sits above the action icons (Step 3), so it covers
     them until the user swipes. */
  position: relative;
  z-index: 2;

  /* Required to make the content a valid snap target (its resting
     position). As with the spacers above, the specific value doesn't
     matter because the snap points are full-width. */
  scroll-snap-align: start;

  /* Render the track scrolled to the content on first paint, so the
     left spacer is hidden off-screen without a JS scroll jump. Has no
     effect until the parent gains `.is-initialized` and the track
     becomes a scroll container. */
  scroll-initial-target: nearest;

  /* The content must paint over the revealed spacer color. */
  background: Canvas;

  /* Row separator (example value; customize to taste). */
  border-bottom: 1px solid #eee;
}
```

### Step 3: Add the action icons to the list item

The action color lives on the spacers (Step 2). The action **icon** lives on the list item itself, anchored to the row's left and right edges.

> **Note:** Throughout this guide, "left" refers to the *left side of the row* (which is revealed by swiping right), and "right" refers to the *right side of the row* (revealed by swiping left).

The placement, sizing, and motion below are a **starting suggestion**, not a requirement. Adjust the icon size, edge insets, threshold-pop scale, transition duration, and even the choice of pseudo-elements vs. real DOM nodes to match your design. The only mechanical requirement is that the icon sits behind the content (so the content can cover it pre-swipe) and inside the list item (so it doesn't scroll with the spacer). Everything else is taste.

```css
/* Action icons painted on the list item. They're absolutely positioned
   inside the row (which is a containing block thanks to `contain: content`
   on `.SwipeableItem` from Step 2) and sit at z-index 1, so the content
   element (z-index 2) covers them until the user swipes far enough. */
.SwipeableItem.is-initialized::before,
.SwipeableItem.is-initialized::after {
  /* Inline an SVG as the action icon. Replace this with whatever icon
     fits the action (archive, checkmark, clock, etc.). The `fill='white'`
     is baked into the SVG so it contrasts with the red spacer background;
     adjust if your background color is light. */
  --action-icon: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'><path d='M9 3v1H4v2h1v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6h1V4h-5V3H9zm0 5h2v9H9V8zm4 0h2v9h-2V8z'/></svg>");

  content: '';
  position: absolute;
  z-index: 1;

  /* The size (`width`) and insets (`left`/`right` below) are example
     values, tune them to match your row height and visual weight.
     The icon fills its box via `background-size: contain`, so changing
     `width` resizes it. */
  width: 1.5em; /* example value, adjust to taste */
  aspect-ratio: 1;
  top: 50%;
  translate: 0 -50%;

  /* Smooth transitions for the icon's visual states: the activate-point
     pop (`scale`, see `.is-activating` below) and the removal fade
     (`scale` + `opacity`, see `.is-removing` below). 0.2s is an example
     duration. */
  transition: scale 0.2s ease, opacity 0.2s ease;

  background: var(--action-icon) center / contain no-repeat;
}
/* Inset from the row edge (example values; adjust to match your layout). */
.SwipeableItem.is-initialized::before { left: 1.5em; }
.SwipeableItem.is-initialized::after  { right: 1.5em; }

/* Activating pop: scale the icon up when the user is past the visual
   activate point, so the row's affordance feels reactive. Toggled by JS
   in Step 4. */
.SwipeableItem.is-activating::before,
.SwipeableItem.is-activating::after {
  scale: 1.333;
}

/* Removal affordance: fade and shrink the icons as the row collapses.
   Driven by the `is-removing` class added in Step 4 at commit time;
   the existing `transition` on the icons animates the change. */
.SwipeableItem.is-removing::before,
.SwipeableItem.is-removing::after {
  scale: 0.5;
  opacity: 0;
}

/* Only show the icon on the *leading* side of the swipe; hide the
   trailing-side one. `data-swipe-direction` is set by JS in Step 4. */
.SwipeableItem.is-activating[data-swipe-direction="left"]::after,
.SwipeableItem.is-activating[data-swipe-direction="right"]::before {
  visibility: hidden;
}
```

### Step 4: Detect the commit gesture with `IntersectionObserver`

Use `IntersectionObserver` rooted at the track, observing the content. As the user swipes, the content's intersection ratio with the track drops; we use **two thresholds**:

- `activateThreshold`: a high ratio (e.g., 0.8). When the visible portion of the content drops below this, the user is past the visual activate point. Toggle the icon-pop affordance.
- `commitThreshold`: a low ratio (e.g., 0.2). When the visible portion drops below this, the user has committed. Start the remove animation **immediately**, without waiting for the snap gesture to fully settle. The collapsing row blends into the user's continuing swipe momentum, which feels more responsive than waiting for the snap to land before reacting.

```js
function wireUpSwipe(item) {
  const track = item.querySelector('.SwipeableItem-track');
  const content = track.querySelector('.SwipeableItem-content');

  // Upgrade the row into "swipeable" mode. This is the gate for all the
  // CSS from Steps 2 and 3 (the track becomes a snap container, the action
  // icons appear). Done *before* the observer is attached so the snap
  // container exists by the time intersection callbacks can fire.
  item.classList.add('is-initialized');

  // Tunable thresholds. `activateThreshold` is the visual feedback point
  // (icon pops). `commitThreshold` is the point of no return: once the
  // content is past this point of being off-screen, we commit even if the
  // user releases mid-gesture and the track snaps back. A low value
  // (~0.2) commits before the snap settles, so the remove animation can
  // start during the swipe.
  const activateThreshold = 0.8;
  const commitThreshold = 0.2;

  const observer = new IntersectionObserver((entries, obs) => {
    // Most recent entry only; older ones are stale.
    const entry = entries.at(-1);
    const ratio = entry.intersectionRatio;

    // boundingClientRect.x > 0 means the content is offset to the right
    // of the track (the user is swiping right, revealing the left spacer);
    // the leading icon lives on the left in that case.
    const direction = entry.boundingClientRect.x > 0 ? 'left' : 'right';

    if (ratio < commitThreshold) {
      // Pass the rect so `removeItem` can compute both the pre-collapse
      // height and the slide-off translate distance from a single
      // measurement (taken at the IO callback's frame, the last reliable
      // reading before the animation starts).
      removeItem(item, content, direction, entry.boundingClientRect);
      obs.disconnect();
      return;
    }

    if (entry.boundingClientRect.x !== 0) {
      item.dataset.swipeDirection = direction;
      item.classList.toggle('is-activating', ratio < activateThreshold);
    }
  }, {
    // Root the observer at the track so vertical scrolling of the outer
    // list doesn't change the intersection (root and target move together).
    root: track,
    threshold: [commitThreshold, activateThreshold],
  });

  observer.observe(content);
}

async function removeItem(item, content, direction, rect) {
  const opts = { duration: 300, easing: 'ease', fill: 'forwards' };

  // Pixel distance the content needs to travel to be fully out of view.
  const translate = direction === 'left'
    ? rect.width - rect.x
    : -(rect.x + rect.width);

  // Use a combination of CSS transitions (for declarative styles) and
  // WAAPI animations (for computed values) to remove the element,
  // then await the completion of all of them.
  // Note: the content translate animation is important because the
  // height-collapse animation can otherwise finish before the browser's
  // smooth scroll-snap has scrolled the content fully off-screen.
  item.classList.add('is-removing');
  item.animate([{ height: `${rect.height}px` }, { height: '0px' }], opts);
  content.animate([{ translate: `${translate}px` }], opts);
  await Promise.all(
    item.getAnimations({ subtree: true }).map((a) => a.finished),
  );

  // Safari has a scroll-latching bug: removing the node while the swipe
  // gesture's momentum is still resolving causes the next item (which
  // slides up into this one's place) to inherit the scroll and
  // immediately scroll itself off-screen. Detect Safari via
  // `GestureEvent` (a Safari-only API) and defer the actual DOM removal
  // until the gesture has fully settled. The 5s delay is conservative;
  // anything longer than the momentum tail is fine. The row is already
  // collapsed and invisible at this point, so the delay is not visible.
  if (globalThis.GestureEvent) {
    setTimeout(() => item.remove(), 5000);
  } else {
    item.remove();
  }
}

document.querySelectorAll('.SwipeableItem').forEach(wireUpSwipe);
```

### Step 5: Use the action and label that fits your use case

For variants other than removal, only the visuals and the body of the commit handler change:

- **Archive**: green/blue background, archive icon, move the item to an archive list rather than removing it.
- **Mark as read**: subdued background, checkmark icon, update item state and re-render (or just remove a `.unread` class).
- **Snooze**: blue background, clock icon, hide until a chosen time.

The scroll/snap/observation mechanics are unchanged.

#### Different actions per swipe direction

A single row can also expose **two different actions**: one for a left swipe and one for a right swipe (e.g., "archive" on right, "delete" on left), the way many native mail apps do it. The scroll, snap, and commit-detection mechanics don't change at all — the only thing that changes is what happens at commit time.

In Step 4, the commit branch always calls `removeItem(...)`. To support two actions, pick the handler based on `direction`:

```js
if (ratio < commitThreshold) {
  const handler = direction === 'left' ? archiveItem : removeItem;
  handler(item, content, direction, entry.boundingClientRect);
  obs.disconnect();
  return;
}
```

A note on naming: `removeItem` is named for the destructive case, but the function it runs (collapse the row's height, slide the content off-screen, then drop the node) is really a generic "this row is done, animate it away" routine. It works just as well for archive, mark-as-read, or snooze — the row goes away from *this* list either way. If your handlers don't actually remove anything (e.g., both move the item elsewhere), rename it to something neutral like `dismissItem` so the code reads correctly.

To make the two actions visually distinct, hoist a color and icon for each direction onto the list item, then paint the track with a split gradient and the two pseudo-element icons from the same variables.

```css
.SwipeableItem {
  /* Action color + icon per swipe direction. `--left-*` is revealed
     when the user swipes RIGHT (e.g., archive); `--right-*` is revealed
     when the user swipes LEFT (e.g., delete). */
  --left-action-color: hsl(140 50% 40%);
  --left-action-icon: url("…archive svg…");
  --right-action-color: hsl(0 65% 50%);
  --right-action-icon: url("…trash svg…");
}

.SwipeableItem.is-initialized .SwipeableItem-track {
  /* Split reveal: left half of the scrollable area gets the left-action
     color, right half gets the right-action color. `background-attachment:
     local` makes the gradient's positioning area the scrollable area
     (3x the visible width), so the default size fills it and the 50% hard
     stop lines up exactly with the midpoint of the resting content column.
     The track's color also stays continuous behind the content as it
     translates off, so the leading-direction color shows the whole way. */
  background-image: linear-gradient(
    to right,
    var(--left-action-color) 50%,
    var(--right-action-color) 50%
  );
  background-attachment: local;
}

/* Per-side icons read from the same variables. */
.SwipeableItem.is-initialized::before { background-image: var(--left-action-icon); }
.SwipeableItem.is-initialized::after  { background-image: var(--right-action-icon); }
```

With this setup, the spacers no longer need their own background-color (the track's gradient handles the reveal), so you can drop the `background-color` rule on `.SwipeableItem-track::before, ::after` from Step 2 if you're using this dual-action variant.

## Best practices and pitfalls

- **DO** use `mandatory` snap, not `proximity`. With `proximity`, the row can rest partially scrolled, leaving the action background half-visible.
- **DO** set `overscroll-behavior-x: none` on the track. Without it, an over-swipe can trigger the browser's back-navigation gesture on iOS/Android.
- **DO** commit at a threshold *before* the snap settles (e.g., `commitThreshold ≈ 0.2`) rather than waiting for the content to be fully off-screen. This lets the remove animation start during the gesture, which feels significantly more responsive than waiting for the snap to land.
- **DO NOT** rely on `pointerdown`/`pointermove`/`pointerup` to drive a manual transform. You'll lose momentum, snap-back, keyboard accessibility, and reduced-motion handling that the browser gives you for free.
- **DO** confirm destructive actions when appropriate. For "remove", consider showing an undo toast after the swipe completes; the gesture is fast and easy to trigger by accident.

## Fallback strategies

The scroll-snap mechanics that underpin this pattern (`scroll-snap-type`, `scroll-snap-align`), `IntersectionObserver`, and the Web Animations API are all Baseline Widely Available, so the gesture, commit detection, and removal animation work broadly. All newer features that are used are either not core to the experience or have robust fallbacks that can be reliably used now.

### Fallback for `overscroll-behavior`

{{ BASELINE_STATUS("overscroll-behavior") }}

No fallback is needed for this use case. `overscroll-behavior` was Baseline Widely Available but no longer is due to an interop issue that only manifests on containers without scrollable overflow. But the track here is always horizontally scrollable (three full-width columns inside a 100%-width container), so the property behaves consistently across browsers and the swipe gesture is reliably contained.

### Fallback for `scrollbar-width`

{{ BASELINE_STATUS("scrollbar-width") }}

Hidden scrollbars are a visual enhancement, not the mechanism that makes swipe-to-remove work. If your Baseline target does not include `scrollbar-width`, the row still scrolls, snaps, detects commit, and removes correctly; the unsupported experience may simply show a horizontal scrollbar. If your product requires hidden scrollbars in older WebKit-derived browsers, you can add a narrowly scoped `::-webkit-scrollbar { display: none; }` rule for the swipe track.

### Fallback for `scroll-initial-target`

{{ BASELINE_STATUS("scroll-initial-target") }}

If your Baseline target does not include `scroll-initial-target`, scroll the track to the content programmatically. Detect with `CSS.supports`:

```js
async function ensureContentInView(track) {
  if (CSS.supports('scroll-initial-target', 'nearest')) return;

  // Loop until `scrollLeft` actually matches the content column's offset.
  while (track.scrollLeft !== track.clientWidth) {
    track.scrollTo({left: track.clientWidth, top: 0, behavior: 'instant'});
    await new Promise((r) => requestAnimationFrame(r));
  }
}
```

**Call ordering matters.** `ensureContentInView()` MUST run:

1. **AFTER** `.is-initialized` is added to the list item (the class is what turns the track into a scroll container; calling `scrollTo` on a non-scrollable element is a no-op).
2. **BEFORE** the `IntersectionObserver` from Step 4 is attached. Otherwise the initial programmatic scroll past the left spacer will be observed as a "swipe" and immediately fire the commit handler.

Some browsers (notably Safari) reset scroll position on resize, so re-run `ensureContentInView` on `resize` for resilience.

```js
addEventListener('resize', () => {
  document.querySelectorAll('.SwipeableItem-track').forEach((track) => {
    ensureContentInView(track);
  });
});
```
