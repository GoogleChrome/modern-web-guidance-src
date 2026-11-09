---
name: navigation-drawer
description: Create a navigation drawer component that, when triggered from a menu button, slides in from the side overlaid on top of existing page content, and slides out when dismissed (by swiping away, tapping outside, or pressing escape).
web-feature-ids:
  - dialog
  - inert
  - intersection-observer
  - popover
  - registered-custom-properties
  - scroll-driven-animations
  - scroll-initial-target
  - scroll-snap
---

# Navigation Drawer

## Overview

A navigation drawer is a panel that slides in from the edge of the viewport over the page content, dimming everything behind it. It is opened from a trigger button and dismissed by swiping the panel off-screen, tapping the dimmed backdrop, activating an explicit Close button inside the panel, or pressing Escape.

This guide implements the drawer as:

- A top-layer element (a modal `<dialog>` or a `popover="manual"` element, see [Choose the drawer element](#choose-the-drawer-element)), so the panel and its `::backdrop` overlay every other element on the page, regardless of stacking context.
- A horizontally scrolling container with two CSS scroll-snap stops — one for "open", one for "closed" — so the swipe gesture is handled natively by the browser. This delivers momentum, velocity, and interruption tracking for free, with no JavaScript pointer-event code.
- A scroll-driven animation that ties the backdrop's opacity to the scroll position, so the dim fades in and out smoothly as the user drags the panel.
- An `IntersectionObserver` on the panel that detects when it has fully entered or fully left the viewport, and uses those moments to close the drawer and update its state.

This approach is preferred over JavaScript-driven `transform` animations because the scroll mechanism gives the user direct control of the panel's position (their finger drives it, not a tween) and it much more closely matches the interaction patterns that users are accustomed to in native mobile apps.

### Choose the drawer element

First, decide whether the drawer is only ever a drawer, or whether the same element also becomes a regular, always-visible sidebar under certain conditions (e.g. on wide screens). If the request does not say, assume it is only ever a drawer.

- **Only ever a drawer**: use a `<dialog>` element opened with `showModal()`. The browser makes the rest of the page inert, exposes the drawer as a modal dialog to assistive technologies, handles Escape, and restores focus on close. See [Implementation with `<dialog>`](#implementation-with-dialog).
- **Also a sidebar**: use a regular element with `role="dialog"` and `popover="manual"`, and remove the `role` while it acts as a sidebar. A `<dialog>` element does not work here, since it is always exposed as a dialog, but a sidebar is not one. Because a popover is not modal, the code must handle modality manually. See [Implementation for a drawer that also acts as a sidebar](#implementation-for-a-drawer-that-also-acts-as-a-sidebar).

## Implementation with `<dialog>`

### 1. Markup

The drawer is a single `<dialog>` containing a horizontal scroller, which contains the visible "sheet". The trigger button lives in the page content. The drawer's close button has an `autofocus` attribute so that this control receives focus when the drawer is opened.

```html
<!-- MANDATORY: Provide an accessible name for the dialog with aria-label or,
     if there is already text within the drawer that can act as its accessible name,
     with aria-labelledby. -->
<dialog class="Drawer" id="drawer" aria-label="Navigation drawer">
  <div class="Drawer-scroller">
    <nav class="Drawer-sheet">
      <!-- Close button that can be used to dismiss the drawer -->
      <button id="drawer-close" aria-label="Close menu" autofocus>
        <!-- close icon or blank if icon inserted via CSS -->
      </button>
      <ul>
        <li><a href="/page-1">Page 1</a></li>
        <li><a href="/page-2">Page 2</a></li>
        <!-- ... -->
      </ul>
    </nav>
  </div>
</dialog>

<main>
  <header>
    <!-- aria-controls links the trigger to the drawer; aria-expanded
         reflects the current state for assistive tech. -->
    <button id="drawer-open"
            aria-label="Menu"
            aria-expanded="false"
            aria-controls="drawer">
      <!-- open icon or blank if icon inserted via CSS -->
    </button>
  </header>
  <!-- Page content. -->
</main>
```

See {{ GUIDE_REF('icons') }} for maintaining accessibility when using icons.

### 2. Styles

#### Reset the dialog and fill the viewport

The dialog must cover the whole viewport so that the swipe surface extends edge-to-edge. The default user-agent dialog styles (centered, size-capped, padded, bordered) get in the way and must be reset.

```css
.Drawer {
  /* min() caps the sheet width on large screens but on a phone leaves
     a 20% peek of page content visible, which is the affordance that
     tells the user they can tap outside to dismiss. */
  --drawer-width: min(20em, 80dvw, 100dvw - 24px);

  /* Custom property driven by the scroll-driven animation below.
     0 = drawer fully closed (transparent backdrop).
     1 = drawer fully open (visible backdrop). */
  --drawer-backdrop: 0;

  /* Reset UA dialog styles that would constrain the element. */
  inset: 0;
  width: auto;
  height: auto;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  background: transparent;
  border: 0;
  overflow: visible;
}

/* Style the dialog's ::backdrop to achieve the overlay effect and
   provide visual affordances indicating that the rest of the page is inert */
.Drawer::backdrop {
  background: #000;
  /* Use calc() to limit the opacity range so the content beneath is visible */
  opacity: calc(var(--drawer-backdrop) / 2);
}
```

#### Build the swipe surface with scroll snap

The scroller is a horizontal grid wider than the viewport: column 1 holds the sheet (width `--drawer-width`), column 2 is an empty pseudo-element spacer the width of the viewport. Snapping between the two columns is what opens and closes the drawer.

```css
.Drawer-scroller {
  position: relative;
  display: grid;
  /* Sheet on the left, full-viewport spacer on the right. The user
     scrolls between the two snap stops to open and close. */
  grid-template-columns: var(--drawer-width) 100%;

  overflow-x: scroll;
  /* Stop the swipe from chaining into the page's vertical scroll
     when the user reaches either snap edge. */
  overscroll-behavior: none;
  scrollbar-width: none;
  /* `mandatory` guarantees the drawer always settles fully open or
     fully closed — never half-open after a partial swipe. */
  scroll-snap-type: x mandatory;
}

/* Enable smooth scrolling natively, but only if the user has not
   requested reduced motion. */
@media (prefers-reduced-motion: no-preference) {
  .Drawer-scroller {
    scroll-behavior: smooth;
  }
}

/* The empty spacer that creates the "closed" snap stop. */
.Drawer-scroller::after {
  content: '';
  scroll-snap-align: end;
  /* Open the drawer already scrolled to this stop (drawer off-screen),
     so the JS only needs to scroll to the open position to
     animate it in. */
  scroll-initial-target: nearest;
}

.Drawer-sheet {
  display: grid;
  grid-template-rows: auto 1fr;
  /* Use `svh` (small viewport height) — not `vh` or `dvh` — so the
     sheet height does not jump when the iOS Safari address bar
     resizes mid-swipe. */
  height: 100svh;

  background: #333;
  color: #fff;
  overflow-y: auto;
  scroll-snap-align: start;
  scrollbar-width: none;
}
```

#### Tie the backdrop opacity to the scroll position

A scroll-driven animation maps `--drawer-backdrop` from 1 (open) to 0 (closed) across the scroller's range, so the backdrop fades in and out perfectly synced with the drag.

```css
/* MANDATORY: Wrap this entire block in @supports. Browsers that don't
   support animation-timeline still parse the @keyframes and would
   apply the animation's `0%` value (--drawer-backdrop: 1) at all
   times, leaving the backdrop permanently opaque. The @supports gate
   ensures the animation is only registered where it actually works. */
@supports (animation-timeline: scroll()) {
  .Drawer {
    /* timeline-scope lets .Drawer reference a scroll-timeline that
       is defined on its descendant (the scroller). Without this, the
       timeline name is not visible to the .Drawer element. */
    timeline-scope: --drawer-fade;
    animation: fade-drawer-backdrop linear both;
    animation-timeline: --drawer-fade;
  }

  .Drawer-scroller {
    /* The horizontal scroll position of this element drives the
       timeline named `--drawer-fade`. */
    scroll-timeline: --drawer-fade x;
  }

  /* @property is REQUIRED. Without registering --drawer-backdrop with
     a `<number>` syntax, the browser treats it as a string and cannot
     interpolate it — the backdrop would jump from 0 to 1 with no
     fade. */
  @property --drawer-backdrop {
    syntax: '<number>';
    inherits: true;
    initial-value: 0;
  }

  @keyframes fade-drawer-backdrop {
    /* Scroll position 0 = drawer fully open = backdrop visible. */
    0% { --drawer-backdrop: 1 }
    /* Scroll position 100% = drawer fully closed = backdrop hidden. */
    100% { --drawer-backdrop: 0 }
  }
}
```

### 3. Open and close the drawer

Opening is two steps: show the dialog as modal, then scroll the sheet into view. Closing is one step: scroll back to the spacer; an observer (step 4) closes the dialog once the sheet is fully off-screen.

```js
const drawer = document.getElementById('drawer');
const openBtn = document.getElementById('drawer-open');
const scroller = drawer.querySelector('.Drawer-scroller');
const sheet = drawer.querySelector('.Drawer-sheet');
const closeBtn = document.getElementById('drawer-close');

function openDrawer() {
  // Show the dialog first so the element is in the top layer before
  // we trigger any scrolling. `scroll-initial-target` (set on the
  // ::after spacer) places the initial scroll position at the closed
  // stop, so the drawer enters the top layer already off-screen.
  drawer.showModal();

  // Scroll the sheet into view. The `behavior: 'auto'` option defers
  // to the CSS `scroll-behavior` property, which will be smooth unless
  // the user prefers reduced motion. Snap takes over at the end and
  // locks the drawer fully open.
  scroller.scrollTo({left: 0, behavior: 'auto'});
}

function closeDrawer() {
  // Scroll back to the spacer. Do NOT call close() here —
  // doing so would remove the element from the top layer mid-animation
  // and the close animation would not be visible. The
  // IntersectionObserver in step 4 closes the dialog once the sheet
  // has actually left the viewport.
  scroller.scrollTo({left: scroller.offsetWidth, behavior: 'auto'});
}
```

### 4. Detect open and closed state

Use an `IntersectionObserver` on the sheet — not the scroll position — as the source of truth for the drawer's state. The observer fires regardless of how the sheet moved (user swipe, programmatic scroll, snap settle), so all dismissal paths converge in the same callback.

Because the drawer is a modal `<dialog>`, the browser makes the rest of the page inert while it is open and moves focus back to the trigger button when it closes, so these callbacks only need to close the dialog and keep `aria-expanded` in sync.

```js
function onDrawerOpened() {
  openBtn.setAttribute('aria-expanded', 'true');
}

function onDrawerClosed() {
  // Close the dialog only after the close animation completes,
  // so the slide-out is visible to the user.
  drawer.close();
  openBtn.setAttribute('aria-expanded', 'false');
}

// Treat "any pixel of the sheet visible inside the dialog" as
// "open enough to count as not closed". This threshold is intentionally
// tiny so the closed callback only fires once the sheet is truly gone.
const visibleThreshold = 1 / window.innerWidth;

const observer = new IntersectionObserver(
  (entries) => {
    // During programmatic scrolling the observer can deliver multiple
    // entries in one batch. Only the most recent describes the
    // current state; earlier entries are intermediate positions.
    const entry = entries.at(-1);
    if (entry.intersectionRatio < visibleThreshold) onDrawerClosed();
    if (entry.intersectionRatio === 1) onDrawerOpened();
  },
  // root: drawer makes the dialog element the intersection root,
  // so the ratio reflects the sheet's visibility within the dialog
  // (i.e. how much of it has been swiped on-screen).
  {root: drawer, threshold: [visibleThreshold, 1]},
);
observer.observe(sheet);
```

### 5. Wire up the trigger and dismissal handlers

```js
// Open trigger.
openBtn.addEventListener('click', openDrawer);

// Close trigger.
closeBtn.addEventListener('click', closeDrawer);

// Light-dismiss: a tap on the dimmed area (anywhere inside the
// dialog but outside the sheet) closes the drawer. Do not use
// closedby="any": the dialog fills the viewport, so taps land on the
// dialog rather than its ::backdrop, and it would close without the
// slide-out animation.
drawer.addEventListener('click', (event) => {
  if (!sheet.contains(event.target)) closeDrawer();
});

// Escape key. A modal dialog fires `cancel` on Escape; prevent the
// instant close and slide the drawer out instead.
// NOTE: Browsers may make `cancel` non-cancelable on repeated Escape
// presses without user activation in between, in which case the dialog
// closes instantly and `aria-expanded` is not reset.
drawer.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeDrawer();
});
```

## Implementation for a drawer that also acts as a sidebar

Use this implementation when the same element also becomes a regular, always-visible sidebar under certain conditions (see [Choose the drawer element](#choose-the-drawer-element)). Toggle `role` from the same media query that switches the layout (e.g. with `matchMedia()`): remove it while the element acts as a sidebar, and restore `role="dialog"` when it becomes a drawer again. This guide does not cover the sidebar layout itself.

Follow the [`<dialog>` implementation](#implementation-with-dialog), with these changes:

- **Markup**: `<div class="Drawer" id="drawer" popover="manual" role="dialog" aria-label="Navigation drawer">`. `popover="manual"` is REQUIRED; do not use `popover="auto"` or `"hint"`, as their built-in light-dismiss would also fire mid-swipe.
- **Open and close**: call `showPopover()` instead of `showModal()` and `hidePopover()` instead of `close()`. The rest of the CSS and JS is unchanged.
- **Modality**: a popover is not modal, so the code must do what a modal dialog does natively:
  - Mark the rest of the page `inert` while the drawer is open.
  - Apply `aria-modal="true"` while the drawer is open, and remove it when it closes.
  - Move focus back to the trigger button after the drawer closes.
  - Handle Escape with a `keydown` listener on `document`, since popovers do not fire `cancel`.

```js
const main = document.querySelector('main');

function onDrawerOpened() {
  // Mark the rest of the page inert so keyboard and screen-reader
  // users cannot tab into content hidden behind the drawer.
  main.inert = true;
  drawer.setAttribute('aria-modal', 'true');
  openBtn.setAttribute('aria-expanded', 'true');
}

function onDrawerClosed() {
  drawer.hidePopover();
  main.inert = false;
  openBtn.setAttribute('aria-expanded', 'false');
  // The observer also reports "closed" on page load, so only restore
  // focus if the drawer was actually open.
  if (drawer.hasAttribute('aria-modal')) {
    drawer.removeAttribute('aria-modal');
    openBtn.focus();
  }
}

// Escape key. Listen on document because focus may be inside the
// drawer when the user presses Escape.
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDrawer();
});
```

## Fallback strategies

{{ BASELINE_STATUS("scroll-snap") }}

{{ BASELINE_STATUS("intersection-observer") }}

The scroll-driven animation that fades the backdrop and `scroll-initial-target` are progressive enhancements with simple fallbacks that can be easily implemented if wide browser support is required.

### Backdrop fade fallback (no `animation-timeline` support):

{{ BASELINE_STATUS("scroll-driven-animations") }}

Detect with `CSS.supports('animation-timeline: scroll()')` and write `--drawer-backdrop` from a `scroll` event listener if not supported. The CSS `@supports` block in step 2 ensures the keyframes never apply in unsupported browsers, so the JavaScript value is the only writer.

```js
if (!CSS.supports('animation-timeline: scroll()')) {
  scroller.addEventListener('scroll', () => {
    // Same mapping as the @keyframes: 0 scroll = 1 (open),
    // sheet-width scroll = 0 (closed).
    const ratio = 1 - scroller.scrollLeft / sheet.offsetWidth;
    drawer.style.setProperty('--drawer-backdrop', ratio);
  });
}
```

### Initial scroll position fallback (no `scroll-initial-target` support):

{{ BASELINE_STATUS("scroll-initial-target") }}

Detect with `CSS.supports('scroll-initial-target', 'nearest')` and inside `openDrawer()`, jump-scroll the scroller to the closed position immediately after showing the drawer (`showModal()`, or `showPopover()` when it [also acts as a sidebar](#implementation-for-a-drawer-that-also-acts-as-a-sidebar)). Without this, the drawer would appear instantly in the open position with no slide-in animation.

```js
async function openDrawer() {
  drawer.showModal(); // or drawer.showPopover() for the sidebar variant

  if (!CSS.supports('scroll-initial-target', 'nearest')) {
    // Jump-scroll to the closed stop so the scroll below
    // animates the drawer in from off-screen.
    scroller.scrollTo({left: scroller.offsetWidth, behavior: 'instant'});
    // Wait two animation frames for the jump-scroll to commit.
    // A single rAF is not enough — the second `scrollTo` would
    // cancel the first before the browser has a chance to apply it.
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r))
    );
  }

  scroller.scrollTo({left: 0, behavior: 'auto'});
}
```

### `@property` fallback (no registered custom properties):

{{ BASELINE_STATUS("registered-custom-properties") }}

`@property` is only needed because the scroll-driven animation interpolates `--drawer-backdrop` between keyframes — without registration, the property would be treated as a string and would jump between 0 and 1 with no fade. If the scroll-driven animation fallback above is in place, that JavaScript writes a fresh numeric string to `--drawer-backdrop` on every scroll frame and never interpolates, so no separate `@property` fallback is needed since all browsers that support scroll-driven animations also support `@property`.


### Popover API fallback (sidebar variant only):

{{ BASELINE_STATUS("popover", "api.HTMLElement.showPopover") }}

{{ BASELINE_STATUS("inert") }}

When the drawer [also acts as a sidebar](#implementation-for-a-drawer-that-also-acts-as-a-sidebar), it uses `popover="manual"` and implements dismissal entirely from JavaScript, so it does not depend on the popover API's defining behaviors — light-dismiss, the `popovertarget` attribute, top-layer-managed Escape handling, or focus management. The only popover features it actually uses are top-layer promotion (via `showPopover()`) and the `::backdrop` pseudo-element.

If wider browser support is needed, do not branch on feature detection — simply do not use popover at all. Drop the `popover="manual"` attribute, replace top-layer promotion with `position: fixed` and a high `z-index`, replace `::backdrop` with a sibling element styled identically (using the same `--drawer-backdrop` custom property), and toggle visibility from a class instead of `showPopover()`/`hidePopover()`. The rest of the component (scroll snap, the scroll-driven backdrop animation, the `IntersectionObserver`, and the dismissal handlers) is unchanged.
