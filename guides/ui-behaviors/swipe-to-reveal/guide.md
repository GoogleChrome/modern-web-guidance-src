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

A swipe-to-reveal component wraps the foreground content and the hidden panel inside an outer horizontal scroll container configured with **CSS Scroll Snap** (`scroll-snap-type: x mandatory`) and **`overscroll-behavior: chain`**. The browser's native scrolling engine handles momentum, snapping, keyboard focus scrolling, and scroll chaining without JavaScript gesture listeners.

### Preventing menu bounce while chaining scroll with `overscroll-behavior: chain`

When you wrap an element in an outer scroll container solely to create a swipe-to-reveal effect, that outer wrapper is an intermediate scroller inside the document (or another parent scroll container).

The four keywords of `overscroll-behavior` independently control whether excess scroll propagates to an ancestor scroll container (**scroll chaining**) and whether the container displays local overscroll affordances such as elastic rubber-band stretching or edge glow (**local boundary effect**):

| Value | Scroll Chaining (Propagates to Ancestor) | Local Boundary Effect (Rubber-band / Glow) | Role in Swipe-to-Reveal |
| :--- | :--- | :--- | :--- |
| `auto` | Yes | Yes | Default behavior; keep this on inner content scrollers where normal bounce feedback is desired, but avoid on the swipe wrapper where it causes the menu to bounce |
| `chain` | **Yes** | **No** | **Use on the outer swipe-to-reveal scroller so excess scroll chains into the parent scroller (such as the document) without the menu or action strip bouncing** |
| `contain` | No | Yes | Traps scroll inside the container while still bouncing locally |
| `none` | No | No | Blocks both local bounce and scroll chaining to ancestors |

---

### Pattern 1: Swipe-to-reveal action buttons on a list item

To reveal contextual action buttons beside a row without auto-activating them, make the row's track a two-column horizontal scroll-snap container (`grid-template-columns: 100% max-content`). The foreground content spans `100%` of the row width and snaps to `start`; the action strip sizes to its buttons (`max-content`) and snaps to `end`.

Because the main content is the first column, the track naturally starts at scroll offset `0` with the actions hidden off-screen to the right. Setting `overscroll-behavior: chain` on `.SwipeRevealList-track` suppresses local rubber-band bounce on the swipe track (so the action strip does not bounce at its edges) while still allowing excess scroll to chain into the parent scroller.

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

  /* Chain excess scroll to the parent scroller without local rubber-band
     bounce on the swipe track or action strip. */
  overscroll-behavior: chain;
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

When wrapping a scrollable content container (`.MenuReveal-content`) inside an outer horizontal scroll-snap container (`.MenuReveal`) that reveals a side menu, the two scroll containers have distinct roles:

1. **Outer horizontal swipe wrapper (`.MenuReveal`)**: Uses `overscroll-behavior: chain`.
   - Because `.MenuReveal` only exists to provide the horizontal swipe-to-reveal effect, you do not want the menu wrapper itself to rubber-band when reaching its horizontal boundary. Setting `overscroll-behavior: chain` prevents the menu from bouncing while still allowing horizontal and vertical scroll gestures to chain into the parent scroller (such as the document).
2. **Inner scrollable content (`.MenuReveal-content`)**: Keeps the default `overscroll-behavior: auto`.
   - Because `.MenuReveal-content` is a true content scroller, keeping `auto` preserves its natural vertical bounce feedback while still chaining horizontal swipes out to `.MenuReveal` (to reveal the side menu) and vertical scrolls through `.MenuReveal` to the document.

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

  /* Prevent the menu wrapper from bouncing locally while still chaining
     scroll into the parent scroller (the document). */
  overscroll-behavior: chain;
}

.MenuReveal-content {
  scroll-snap-align: start;
  block-size: 20rem;
  overflow: auto;
  /* Keeps default `overscroll-behavior: auto` so the content pane retains
     its normal bounce effect while chaining horizontal swipes to `.MenuReveal`. */
}

.MenuReveal-menu {
  scroll-snap-align: end;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 1rem 1.5rem;
}
```

Because `.MenuReveal-content` spans `100%` of the outer container's width, most of it remains visible inside the scrollport even when the side menu is snapped open. Consequently, tabbing into `.MenuReveal-menu` automatically scrolls the menu into view, but pressing `Shift+Tab` to move focus back onto `.MenuReveal-content` will not automatically scroll the track back to `0`.

To snap `.MenuReveal-content` fully back into view on keyboard focus—without interfering with pointer clicks or touch drags that also focus the element—listen for `focus` and gate `scrollIntoView()` with `.matches(':focus-visible')`:

```js
for (const content of document.querySelectorAll('.MenuReveal-content')) {
  content.addEventListener('focus', () => {
    if (content.matches(':focus-visible')) {
      content.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'start',
      });
    }
  });
}
```

## Best practices and pitfalls

- **DO** use `scroll-snap-type: x mandatory` rather than `proximity`. With `proximity`, a light swipe can leave the action buttons or side menu partially exposed at rest.
- **DO** set `overscroll-behavior: chain` on the outer horizontal swipe-to-reveal scroller (`.MenuReveal`, `.SwipeRevealList-track`) so scroll can chain into the parent scroller without the revealed menu or action strip bouncing.
- **DO** leave `overscroll-behavior: auto` (the default) on inner scrollable content panes (`.MenuReveal-content`) where you want normal bounce feedback to happen while still chaining horizontal swipes to the outer menu scroller.
- **DO** implement revealed actions and side-menu items as real focusable DOM controls (`<button>`, `<a>`). When a focusable full-width content pane precedes the focusable DOM controls, pair a `focus` listener with `.matches(':focus-visible')` to call `scrollIntoView({ block: 'nearest', inline: 'start' })` so tabbing back onto the content pane closes the side panel without affecting pointer interactions.
- **DO NOT** intercept `wheel`, `touchmove`, or `pointermove` events in JavaScript to manually translate the content or emulate scroll chaining. Main-thread gesture interception blocks compositor-driven scrolling, breaks native scroll momentum, and degrades responsiveness.

## Progressive enhancement

{{ BASELINE_STATUS("overscroll-behavior") }}

{{ BASELINE_STATUS("scroll-snap") }}

{{ BASELINE_STATUS("scrollbar-width") }}

Treat `overscroll-behavior: chain` strictly as a progressive enhancement without fallbacks:

- **Automatic CSS cascade fallback**: The initial value of `overscroll-behavior` is `auto`. Browsers that do not yet recognize the `chain` keyword ignore `overscroll-behavior: chain` at parse time and retain `auto`. Because `auto` already allows scroll chaining to ancestor scroll containers, both the swipe-to-reveal gesture and scroll chaining to the parent work across all browsers out of the box; supporting browsers simply suppress the unwanted rubber-band bounce on the outer swipe wrapper.
- **Overriding `contain` or `none`**: If a base stylesheet or utility class sets `overscroll-behavior: contain` or `none`, declare `overscroll-behavior: auto` immediately before `overscroll-behavior: chain` so browsers that do not yet support `chain` still chain scrolling to the parent rather than trapping it.
