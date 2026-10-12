---
name: swipe-to-reveal
description: Let users swipe horizontally on a list item or content pane to reveal contextual action buttons or a side menu without automatically triggering an action.
web-feature-ids:
  - overscroll-behavior
  - scroll-initial-target
  - scroll-snap
  - scrollbar-width
---

# Swipe to reveal

Swipe-to-reveal patterns let users slide a foreground row or content pane horizontally to expose hidden UI—such as contextual action buttons (*Pin*, *Mute*, *Archive*, *Delete*) or a secondary side menu—**without automatically activating any action**. Instead of committing an action during the swipe, the container snaps open to reveal interactive controls that the user can inspect and activate, or swipe back to close.

> For a full-width swipe gesture that immediately commits and dismisses an item past a threshold, see {{ GUIDE_REF("swipe-to-remove") }}. For revealing a hidden header at the top of a vertical scroll container, see {{ GUIDE_REF("pull-to-reveal") }}.

## How to implement

Whether you are revealing action buttons on a list item or a side menu next to a scrollable pane, the mechanics are identical: wrap the foreground content and the hidden panel inside an outer horizontal scroll container configured with **CSS Scroll Snap** (`scroll-snap-type: x mandatory`) and **`overscroll-behavior: chain`**. The browser's native scrolling engine handles momentum, snapping, keyboard focus scrolling, and scroll chaining without JavaScript gesture listeners.

### Step 1: Mark up the swipe wrapper, content, and revealed panel

Place the foreground content first and the revealed controls (action buttons or a side menu) second inside the `.SwipeReveal` scroll container. Because the content is first in DOM order, the scroll container naturally starts at scroll offset `0` with the panel hidden off-screen to the right.

```html
<!-- Example A: List item with revealable action buttons -->
<div class="SwipeReveal">
  <div class="SwipeReveal-content">
    <strong>Design review notes</strong>
    <p>Updated component specs for the Q3 release.</p>
  </div>
  <div class="SwipeReveal-panel" role="group" aria-label="Item actions">
    <button type="button">Pin</button>
    <button type="button">Archive</button>
    <button type="button">Delete</button>
  </div>
</div>

<!-- Example B: Scrollable content pane with a revealable side menu -->
<div class="SwipeReveal" role="region" aria-label="Document preview with swipeable side menu">
  <div class="SwipeReveal-content is-scrollable" tabindex="0">
    <h2>Article Preview</h2>
    <p>Scroll vertically through this pane, or swipe left to reveal the side menu...</p>
  </div>
  <nav class="SwipeReveal-panel" aria-label="Contextual menu">
    <a href="#share">Share</a>
    <a href="#bookmark">Bookmark</a>
    <a href="#export">Export PDF</a>
  </nav>
</div>
```

### Step 2: Configure the horizontal snap container and `overscroll-behavior: chain`

When you wrap an element in an outer scroll container solely to create a swipe-to-reveal effect, that outer wrapper becomes an intermediate scroller inside the document (or another parent scroll container).

The four keywords of `overscroll-behavior` independently control whether excess scroll propagates to an ancestor scroll container (**scroll chaining**) and whether the container displays local overscroll affordances such as elastic rubber-band stretching or edge glow (**local boundary effect**):

| Value | Scroll Chaining (Propagates to Ancestor) | Local Boundary Effect (Rubber-band / Glow) | Role in Swipe-to-Reveal |
| :--- | :--- | :--- | :--- |
| `auto` | Yes | Yes | Default behavior; keep this on inner content scrollers where normal bounce feedback is desired, but avoid on the outer swipe wrapper where it causes the menu to bounce |
| `chain` | **Yes** | **No** | **Use on the outer `.SwipeReveal` scroller so excess scroll chains into the parent scroller (such as the document) without the menu or action strip bouncing** |
| `contain` | No | Yes | Traps scroll inside the container while still bouncing locally |
| `none` | No | No | Blocks both local bounce and scroll chaining to ancestors |

Make `.SwipeReveal` a two-column grid (`grid-template-columns: 100% max-content`) where `.SwipeReveal-content` snaps to `start` and `.SwipeReveal-panel` snaps to `end`:

```css
.SwipeReveal {
  /* Column 1: full-width content. Column 2: auto-sized actions or side menu. */
  display: grid;
  grid-template-columns: 100% max-content;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;

  /* Prevent the swipe wrapper and revealed panel from bouncing locally while
     still chaining excess scroll into the parent scroller (the document). */
  overscroll-behavior: chain;
}

@media (prefers-reduced-motion: no-preference) {
  .SwipeReveal {
    scroll-behavior: smooth;
  }
}

.SwipeReveal-content {
  scroll-snap-align: start;
  scroll-initial-target: nearest;
  background: Canvas;
}

.SwipeReveal-content:focus-visible {
  outline: auto;
  outline-offset: -2px;
}

.SwipeReveal-content.is-scrollable {
  block-size: 20rem;
  overflow: auto;
  /* Keeps default `overscroll-behavior: auto` so the content pane retains
     its normal bounce effect while chaining horizontal swipes to `.SwipeReveal`. */
}

.SwipeReveal-panel {
  /* Snapping a trailing panel to `end` (or a leading panel to `start`) brings
     all controls fully into view while keeping the adjacent edge of the content visible. */
  scroll-snap-align: end;
  display: flex;

  &:first-child {
    scroll-snap-align: start;
  }
}
```

> If you also want to reveal controls on the left (`inline-start`) side using three columns (`grid-template-columns: max-content 100% max-content`) or two columns (`max-content 100%`), place the leading `.SwipeReveal-panel` before `.SwipeReveal-content`. Because `.SwipeReveal-content` has `scroll-initial-target: nearest`, the scroll container initially rests on the content column rather than the leading panel.

### Step 3: Snap focusable content panes back into view on keyboard focus

Because the buttons or links inside `.SwipeReveal-panel` are off-screen at rest, tabbing into them with a keyboard automatically scrolls `.SwipeReveal` to reveal the focused control. However, because `.SwipeReveal-content` spans `100%` of the outer container's width, most of it remains inside the scrollport even while the side panel is open—so pressing `Shift+Tab` to move focus back onto `.SwipeReveal-content` (or onto a focusable element inside it) will not automatically scroll the track back to `0`.

Listen for `focusin` on `.SwipeReveal-content` and check `event.target.matches(':focus-visible')` so keyboard focus on the pane or any descendant snaps `.SwipeReveal-content` back to the start without interfering with pointer clicks or touch drags:

```js
for (const content of document.querySelectorAll('.SwipeReveal-content')) {
  content.addEventListener('focusin', (event) => {
    if (event.target.matches(':focus-visible')) {
      content.scrollIntoView({
        block: 'nearest',
        inline: 'start',
      });
    }
  });
}
```

## Best practices and pitfalls

- **DO** use `scroll-snap-type: x mandatory` rather than `proximity`. With `proximity`, a light swipe can leave the action buttons or side menu partially exposed at rest.
- **DO** set `overscroll-behavior: chain` on the outer horizontal swipe-to-reveal scroller (`.SwipeReveal`) so scroll can chain into the parent scroller without the revealed menu or action strip bouncing.
- **DO** leave `overscroll-behavior: auto` (the default) on inner scrollable content panes (`.SwipeReveal-content.is-scrollable`) where you want normal bounce feedback to happen while still chaining horizontal swipes to the outer swipe scroller.
- **DO** implement revealed actions and side-menu items as real focusable DOM controls (`<button>`, `<a>`). When `.SwipeReveal-content` is focusable or contains focusable controls, pair a `focusin` listener with `event.target.matches(':focus-visible')` to call `scrollIntoView({ block: 'nearest', inline: 'start' })` so tabbing back into the content pane closes the side panel without affecting pointer interactions.
- **DO NOT** intercept `wheel`, `touchmove`, or `pointermove` events in JavaScript to manually translate the content or emulate scroll chaining. Main-thread gesture interception blocks compositor-driven scrolling, breaks native scroll momentum, and degrades responsiveness.

## Fallback

{{ BASELINE_STATUS("scroll-initial-target") }}

When a `.SwipeReveal` container places a `.SwipeReveal-panel` on the left (`inline-start`) side before `.SwipeReveal-content`, browsers that do not support `scroll-initial-target: nearest` will initially render at scroll offset `0` with the leading panel exposed.

If your Baseline target does not support `scroll-initial-target`, detect support with `CSS.supports('scroll-initial-target', 'nearest')` and call `scrollTo()` with `behavior: 'instant'` on `load` so containers with a leading panel jump straight to `.SwipeReveal-content` without scrolling the page:


## Progressive enhancement

{{ BASELINE_STATUS("overscroll-behavior") }}

{{ BASELINE_STATUS("scroll-snap") }}

{{ BASELINE_STATUS("scrollbar-width") }}

Treat `overscroll-behavior: chain` and `scrollbar-width: none` as progressive enhancements without JavaScript fallbacks:

- **Automatic CSS cascade fallback**: The initial value of `overscroll-behavior` is `auto`. Browsers that do not yet recognize the `chain` keyword ignore `overscroll-behavior: chain` at parse time and retain `auto`. Because `auto` already allows scroll chaining to ancestor scroll containers, both the swipe-to-reveal gesture and scroll chaining to the parent work across all browsers out of the box; supporting browsers simply suppress the unwanted rubber-band bounce on the outer swipe wrapper.
- **Overriding `contain` or `none`**: If a base stylesheet or utility class sets `overscroll-behavior: contain` or `none`, declare `overscroll-behavior: auto` immediately before `overscroll-behavior: chain` so browsers that do not yet support `chain` still chain scrolling to the parent rather than trapping it.
- **Scrollbar hiding (`scrollbar-width: none`)**: Hiding the horizontal scrollbar track is purely cosmetic; if an older engine ignores `scrollbar-width: none`, the swipe-to-reveal container remains fully functional with a standard scrollbar.
