---
name: swipe-to-reveal
description: Let users swipe horizontally on a list item or content pane to reveal contextual action buttons or a side menu without automatically triggering an action.
web-feature-ids:
  - overscroll-behavior
  - scroll-snap
  - scrollbar-width
---

# Swipe to reveal

Swipe-to-reveal patterns let users slide a foreground row or content pane horizontally to expose hidden UI—such as contextual action buttons (*Pin*, *Mute*, *Archive*, *Delete*) or a secondary side menu—**without automatically activating any action**. Instead of committing an action during the swipe, the container snaps open to reveal interactive controls that the user can inspect and activate, or swipe back to close.

> For a full-width swipe gesture that immediately commits and dismisses an item past a threshold, see {{ GUIDE_REF("swipe-to-remove") }}. For revealing a hidden header at the top of a vertical scroll container, see {{ GUIDE_REF("pull-to-reveal") }}.

## How to implement

A swipe-to-reveal component combines **CSS Scroll Snap** (`scroll-snap-type: x mandatory`) with **`overscroll-behavior`** (`chain` and `none`) so the browser's native scrolling engine handles momentum, snapping, keyboard focus scrolling, and nested scroll handoff without JavaScript gesture listeners.

### Controlling boundary behavior with `overscroll-behavior: chain`

Swipe-to-reveal interfaces frequently nest scroll containers—for example, swipeable rows inside a vertically scrolling feed, or a swipe-to-reveal side menu wrapping a vertically (or horizontally) scrollable content pane.

The four keywords of `overscroll-behavior` independently control whether excess scroll propagates to an ancestor scroll container (**scroll chaining**) and whether the container displays local overscroll affordances such as elastic rubber-band stretching or edge glow (**local boundary effect**):

| Value | Scroll Chaining (Propagates to Ancestor) | Local Boundary Effect (Rubber-band / Glow) | Role in Swipe-to-Reveal |
| :--- | :--- | :--- | :--- |
| `auto` | Yes | Yes | Default behavior; causes inner scroll containers to rubber-band locally before or while chaining to the swipe track or page |
| `chain` | **Yes** | **No** | **Suppresses local rubber-band stretch on an inner scroller or intermediate wrapper while still chaining excess scroll to its ancestor** |
| `contain` | No | Yes | Traps scroll inside the container while still bouncing locally |
| `none` | No | No | Blocks both local bounce and scroll chaining; used on the outermost horizontal swipe axis to prevent browser back/forward navigation and edge peeking |

---

### Pattern 1: Swipe-to-reveal action buttons on a list item

To reveal contextual action buttons beside a row without auto-activating them, make the row's track a two-column horizontal scroll-snap container (`grid-template-columns: 100% max-content`). The foreground content spans `100%` of the row width and snaps to `start`; the action strip sizes to its buttons (`max-content`) and snaps to `end`.

Because the main content is the first column, the track naturally starts at scroll offset `0` with the actions hidden off-screen to the right. Because the buttons are real focusable DOM elements inside the scroll container, swiping left snaps them into view for pointer or touch input, and tabbing into them with a keyboard automatically scrolls the snap track to reveal the focused button.

```html
<ul class="SwipeRevealList">
  <li class="SwipeRevealList-item">
    <div class="SwipeRevealList-track">
      <div class="SwipeRevealList-content">
        <strong>Design review notes</strong>
        <p>Updated component specs for the Q3 release.</p>
      </div>
      <div class="SwipeRevealList-actions" role="group" aria-label="Item actions">
        <button type="button" class="action-pin">Pin</button>
        <button type="button" class="action-archive">Archive</button>
        <button type="button" class="action-delete">Delete</button>
      </div>
    </div>
  </li>
</ul>
```

```css
.SwipeRevealList {
  list-style: none;
  margin: 0;
  padding: 0;
}

.SwipeRevealList-track {
  /* Column 1: full-width row content. Column 2: auto-sized action buttons. */
  display: grid;
  grid-template-columns: 100% max-content;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;

  /* Suppress both browser back/forward gesture chaining and local horizontal
     rubber-banding (which would otherwise pull the row away from the left
     edge and peek at the action strip when swiping right). */
  overscroll-behavior-x: none;

  /* Chain vertical scroll gestures to the parent list or document without
     any local vertical bounce on the track. */
  overscroll-behavior-y: auto;
  overscroll-behavior-y: chain;
}

.SwipeRevealList-content {
  scroll-snap-align: start;
  background: Canvas;
  padding: 1rem;
}

.SwipeRevealList-actions {
  /* Snapping the action group to `end` brings all buttons fully into view
     while keeping the trailing edge of the row content visible on the left. */
  scroll-snap-align: end;
  display: flex;
  align-items: stretch;
}
```

> If you also want to reveal actions on the left (`inline-start`) side of a row using three columns (`grid-template-columns: max-content 100% max-content`), apply `scroll-initial-target: nearest` to `.SwipeRevealList-content` so the scroll container initially rests on the middle content column rather than the leading action strip.

---

### Pattern 2: Swipe-to-reveal side menu around a scrollable container

When wrapping a scrollable content container inside a horizontal scroll-snap container that reveals a side menu, both the outer menu wrapper and the inner content pane are scroll containers:

1. **Inner scrollable content (`.MenuReveal-content`)**: Uses `overscroll-behavior: chain`.
   - When the user scrolls vertically to the top or bottom of the inner content, excess vertical scroll chains directly to the parent page without triggering a local rubber-band bounce inside the pane.
   - When the user swipes horizontally inside the content pane, excess horizontal scroll chains directly to the outer `.MenuReveal` scroller to slide the side menu into view—again without locally stretching the inner container.
2. **Outer horizontal swipe wrapper (`.MenuReveal`)**: Uses `overscroll-behavior-x: none` and `overscroll-behavior-y: chain`.
   - On the horizontal axis, `none` stops overswipes from chaining into browser back/forward history navigation and prevents local elastic stretch at the outer edges.
   - On the vertical axis, `chain` ensures vertical scroll gestures pass cleanly up to the document without local bounce.

```html
<div class="MenuReveal" role="region" aria-label="Document preview with swipeable side menu">
  <div class="MenuReveal-content" tabindex="0">
    <h2>Article Preview</h2>
    <p>Scroll vertically through this pane, or swipe left to reveal the side menu...</p>
    <!-- Long scrollable content -->
  </div>
  <nav class="MenuReveal-menu" aria-label="Contextual menu">
    <a href="#share">Share</a>
    <a href="#bookmark">Bookmark</a>
    <a href="#export">Export PDF</a>
  </nav>
</div>
```

```css
.MenuReveal {
  display: grid;
  grid-template-columns: 100% max-content;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  overscroll-behavior-x: none;
  overscroll-behavior-y: auto;
  overscroll-behavior-y: chain;
}

.MenuReveal-content {
  scroll-snap-align: start;
  block-size: 20rem;
  overflow: auto;

  /* Fallback to `auto` if `chain` is overriding an inherited `contain`/`none` rule */
  overscroll-behavior: auto;
  /* Suppress local rubber-band bounce on both axes while chaining horizontal
     swipes to `.MenuReveal` and vertical scrolls to the document */
  overscroll-behavior: chain;
}

.MenuReveal-menu {
  scroll-snap-align: end;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 1rem 1.5rem;
}
```

## Best practices and pitfalls

- **DO** use `scroll-snap-type: x mandatory` rather than `proximity`. With `proximity`, a light swipe can leave the action buttons or side menu partially exposed at rest.
- **DO** set `overscroll-behavior: chain` on nested scroll containers inside a swipe-to-reveal wrapper so excess scroll hands off cleanly to the swipe track or page without a local rubber-band bounce.
- **DO** set `overscroll-behavior-x: none` on the outermost horizontal swipe container so horizontal overswipes do not trigger browser back/forward navigation or elastic edge peeking.
- **DO** implement revealed actions and side-menu items as real focusable DOM controls (`<button>`, `<a>`). Native scroll containers automatically scroll focused descendants into view when users navigate via `Tab`.
- **DO NOT** intercept `wheel`, `touchmove`, or `pointermove` events in JavaScript to manually translate the content or emulate scroll chaining. Main-thread gesture interception blocks compositor-driven scrolling, breaks native scroll momentum, and degrades responsiveness.

## Progressive enhancement

{{ BASELINE_STATUS("overscroll-behavior") }}

{{ BASELINE_STATUS("scroll-snap") }}

{{ BASELINE_STATUS("scrollbar-width") }}

Treat `overscroll-behavior: chain` strictly as a progressive enhancement without fallbacks:

- **Automatic CSS cascade fallback**: The initial value of `overscroll-behavior` is `auto`. Browsers that do not yet recognize the `chain` keyword ignore `overscroll-behavior: chain` at parse time and retain `auto`. Because `auto` already allows scroll chaining to ancestor scroll containers, both the swipe-to-reveal gesture and nested scroll handoff work across all browsers out of the box; supporting browsers simply remove the redundant local rubber-band bounce at the inner scroll boundary.
- **Overriding `contain` or `none`**: If a base stylesheet or utility class sets `overscroll-behavior: contain` or `none`, declare `overscroll-behavior: auto` immediately before `overscroll-behavior: chain` so browsers that do not yet support `chain` still chain scrolling to the parent rather than trapping it.
