---
name: content-first-noise-reduction
description: Maximize content and reduce noise by removing blocking popups, keeping persistent navigation compact, and moving secondary content behind on-demand disclosure.
web-feature-ids:
  - popover
  - details
  - invoker-commands
  - container-scroll-state-queries
---

# Maximize content and reduce noise

Users come for the content. Keep the page frame small, move it out of the way while users read, and show secondary content only when asked.

## Implementation

### Don't block or interrupt the user

- DO NOT open newsletter modals, interstitials, or full-screen promos when the page loads. Where possible, remove banners and unrelated content that compete with the main content.
- If a notice is legally required (for example, cookie consent), show it as a small, non-modal bar that covers well under 15% of the viewport, with a visible dismiss button labeled with text such as "Accept" or "Close".
- Match the interruption to the stakes: use a blocking dialog only for consequential actions, such as deleting an account, paying, or editing personal data. Use non-blocking messages for everything else.
- Don't move content while the user reads. Reserve space for images, ads, and embeds before they load (for example, with `width` and `height` attributes), don't insert content above what's on screen, and don't open popovers the user didn't ask for.

### Keep persistent bars compact

Keep every fixed or sticky bar under 12% of the viewport height. Use a single row, and don't stack several sticky bars (announcement, header, and sub-navigation). Move extra items into a popover menu or drawer instead (see below). Optional: blend the browser toolbar with your page; see {{ GUIDE_REF("browser-ui-theming") }}.

### Hide persistent bars while the user scrolls down

Hide the top bar (the site header or navigation bar) while the user scrolls down and bring it back as soon as they scroll up, so it's out of the way while reading but one flick away. A scroll-state container query tracks the scroll direction in CSS, with no script. Hide bottom bars, such as a tab bar, the same way, sliding them down instead of up.

```css
/* The root scroller remembers the direction of the most recent scroll. */
html {
  container-type: scroll-state;
}
.top-bar {
  position: sticky;
  top: 0;
  z-index: 1; /* Example value: keeps positioned content from painting over the bar. */
}
/* Scrolling down: move the bar out of view. transform doesn't change layout, so content doesn't jump.
   (scrollable: top) shows the bar at the very top, even after jumps such as the Home key, which don't update "scrolled". */
@container scroll-state((scrolled: bottom) and (scrollable: top)) {
  .top-bar {
    transform: translateY(-100%);
  }
}
/* Keep the bar visible while it contains keyboard focus. */
.top-bar:focus-within {
  transform: none;
}
/* Example value: at least the bar's height, so in-page link targets don't land under the bar. */
:target {
  scroll-margin-top: 4rem;
}
```

Alternatively, shrink the bar to under 80% of its height as the user scrolls; see {{ GUIDE_REF("shrinking-header-on-scroll") }}.

### Put secondary UI in popovers and drawers

Use the `popover` attribute for menus, overflow actions, tooltips, hover cards, and onboarding tips instead of permanent toolbars or custom JavaScript overlays. A button with `popovertarget` opens and closes the popover on click, <kbd>Enter</kbd>, or <kbd>Space</kbd>. The default `popover="auto"` also closes it on <kbd>Esc</kbd> or a click outside.

```html
<button popovertarget="more-links">More</button>
<!-- Rendered in the top layer, so no z-index management is needed. -->
<nav id="more-links" popover aria-label="More links">
  <a href="/about">About</a>
  <a href="/contact">Contact</a>
</nav>
```

- Popovers open in the center of the screen by default. To place a popover next to its button, see {{ GUIDE_REF("viewport-aware-dropdowns") }}.
- Buttons can also open popovers with `commandfor` and `command="toggle-popover"`; see {{ GUIDE_REF("declarative-dialog-popover-control") }}.
- For larger sets of options, use an off-canvas drawer: a `popover` panel pinned to one side of the screen that slides in over the page (see {{ GUIDE_REF("navigation-drawer") }} for swipe-to-close and animation). Show rows of related items as a horizontally scrolling carousel instead of a long stacked list.

### Collapse secondary content with `details`

Put long or rarely needed content (specs, FAQs, fine print) in a `details` element. It starts closed, and its `summary` works with the keyboard and screen readers without JavaScript.

```html
<details>
  <summary>Shipping and returns</summary>
  <p>Free returns within 30 days.</p>
</details>
```

## Fallback strategies

### Scroll-state queries

{{ BASELINE_STATUS("container-scroll-state-queries") }}
{# BASELINE_STATUS reflects stuck/snapped/scrollable (Chrome 133). scrolled needs Chrome 144 (BCD css.at-rules.container.scroll-state_queries.scrolled); switch to the BCD-key form once web-features includes that key. #}

Without scroll-state queries, the bar never hides, but it stays compact and usable. If your Baseline target includes those browsers, add a small script so the bar hides there too. Browsers that support other scroll-state queries but not `scrolled` also keep the bar visible.

```css
/* Don't hide the bar while it contains keyboard focus. */
.top-bar.is-hidden:not(:focus-within) {
  transform: translateY(-100%);
}
```

```js
// Runs only where scroll-state queries aren't supported. Run it after .top-bar is parsed (for example, in a module script).
if (!CSS.supports('container-type', 'scroll-state')) {
  const bar = document.querySelector('.top-bar');
  let lastY = scrollY;
  addEventListener('scroll', () => {
    // Clamp so the iOS bounce at the bottom of the page doesn't count as scrolling up.
    const y = Math.min(scrollY, document.documentElement.scrollHeight - innerHeight);
    // Hide only after scrolling down past the bar's own height, so it doesn't flicker near the top.
    bar?.classList.toggle('is-hidden', y > lastY && y > bar.offsetHeight);
    lastY = y;
  }, { passive: true });
}
```

{{ FEATURE_FALLBACKS("popover") }}

### Invoker commands

{{ BASELINE_STATUS("invoker-commands") }}

Browsers without invoker commands ignore `commandfor`, so the button does nothing there. Prefer `popovertarget`, which works wherever popovers do. If you use `commandfor`, dynamically import `invokers-polyfill` (through your bundler, or from a CDN if you don't use one) only when `'commandForElement' in HTMLButtonElement.prototype` is false.
