---
name: stack-drill-down
description: Build full-screen hierarchical navigation that lets users drill down into nested views and swipe or navigate back to return, with browser history kept in sync.
web-feature-ids:
  - inert
  - intersection-observer
  - scroll-driven-animations
  - scroll-snap
  - scroll-snap-events
---

# Stack Drill Down

A stack drill-down component arranges hierarchical views side by side in a horizontal scroll-snap container. Tapping an item appends a detail view and scrolls it into place; swiping back, clicking the UI back button, or pressing the browser back button returns to the parent view and prunes deeper views from the DOM.

## HTML structure

Each view uses a two-element structure: an outer `.Stack-view` scroll-snap target, and an inner `.Stack-viewContent` that handles vertical scrolling, opaque background styling, and parallax transforms without affecting snap geometry. Root views omit the back button, while drill-down views include `<button class="back">` inside `<header>`.

```html
<div class="Stack">
  <div class="Stack-view">
    <div class="Stack-viewContent">
      <header>Menu</header>
      <main>
        <a href="/menu/seasonal">Seasonal Specials</a>
      </main>
    </div>
  </div>
</div>
```

## CSS layout and scroll-driven parallax

Use a single-row horizontal CSS Grid with `scroll-snap-type: x mandatory` and `overscroll-behavior-x: none` so swipe gestures snap cleanly between views without triggering browser back navigation. Gate `scroll-behavior: smooth` behind `prefers-reduced-motion: no-preference`, and enhance the parallax and edge shadow with `animation-timeline: view(inline)`.

```css
.Stack {
  height: 100dvh;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 100%;
  grid-template-rows: 100%;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  overscroll-behavior-x: none;
  scrollbar-width: none;
}

.Stack::-webkit-scrollbar {
  display: none;
}

@media (prefers-reduced-motion: no-preference) {
  .Stack {
    scroll-behavior: smooth;
  }
}

.Stack-view {
  scroll-snap-align: start;
  scroll-snap-stop: always;
}

/* Keep transforms and vertical scrolling on the inner element so
   the outer .Stack-view snap target geometry never shifts mid-gesture. */
.Stack-viewContent {
  width: 100%;
  height: 100%;
  background-color: Canvas;
  color: CanvasText;
  overflow-y: auto;
}

.Stack-view:not(:first-child) .Stack-viewContent {
  box-shadow: 0 0 1.5rem #0004;
}

@supports (animation-timeline: view()) {
  .Stack-viewContent {
    animation: parallax linear both;
    animation-timeline: view(inline);
    animation-range: exit 0% exit 100%;
  }

  .Stack-view:not(:first-child) .Stack-viewContent {
    animation: parallax linear both, shadow-fade linear both;
    animation-timeline: view(inline), view(inline);
    animation-range: exit 0% exit 100%, entry 0% exit 100%;
  }

  @keyframes parallax {
    to {
      transform: translateX(75%);
      filter: brightness(0.8);
    }
  }

  @keyframes shadow-fade {
    0%, 100% { box-shadow: 0 0 1.5rem #0000; }
    25%, 75% { box-shadow: 0 0 1.5rem #0004; }
  }
}
```

## JavaScript navigation and History API integration

Centralize view cleanup in `onActiveViewChanged(currentView)`, triggered by `scrollsnapchange` (with an `IntersectionObserver` fallback). When a view snaps into place, remove deeper views from the DOM, set `inert` on remaining inactive views, reconcile manual swipe-backs via `history.go()`, and restore focus via a `WeakMap` (`{ preventScroll: true }`) or focus `.back` on newly opened views.

```js
const stack = document.querySelector('.Stack');
const returnFocus = new WeakMap();
const getUrlPath = (u = location) => u.hash || u.pathname;
let currentDepth = 0;

function onActiveViewChanged(currentView) {
  const activeIdx = [...stack.children].indexOf(currentView);
  if (activeIdx === -1) return;

  [...stack.children].forEach((view, idx) => {
    if (idx > activeIdx) {
      view.remove();
    } else {
      view.toggleAttribute('inert', idx !== activeIdx);
    }
  });

  if (activeIdx !== currentDepth) {
    const delta = activeIdx - currentDepth;
    currentDepth = activeIdx;
    history.go(delta);
  }

  const trigger = returnFocus.get(currentView);
  if (trigger?.isConnected) {
    trigger.focus({ preventScroll: true });
    returnFocus.delete(currentView);
  } else if (activeIdx > 0) {
    currentView.querySelector('.back')?.focus({ preventScroll: true });
  }
}

stack.addEventListener('scrollsnapchange', (event) => {
  onActiveViewChanged(event.snapTargetInline);
});

if (!('onscrollsnapchange' in HTMLElement.prototype)) {
  const viewObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.intersectionRatio === 1) onActiveViewChanged(entry.target);
    }
  }, { root: stack, threshold: 1 });

  new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.classList?.contains('Stack-view')) viewObserver.observe(node);
      }
      for (const node of m.removedNodes) {
        if (node.classList?.contains('Stack-view')) viewObserver.unobserve(node);
      }
    }
  }).observe(stack, { childList: true });

  for (const view of stack.children) viewObserver.observe(view);
}

function drillDown(urlPath, behavior = 'auto') {
  const routeData = resolveUrl(urlPath);
  if (!routeData) return;

  currentDepth += 1;
  history.pushState({ depth: currentDepth, url: urlPath }, '', urlPath);
  stack.appendChild(createDrillDownView(routeData));
  stack.scrollBy({ left: stack.clientWidth, top: 0, behavior });
}

stack.addEventListener('click', (e) => {
  if (e.target.closest('.back')) {
    history.back();
    return;
  }

  const link = e.target.closest('a[href]');
  if (!link || !stack.contains(link)) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

  const url = new URL(link.href, location.href);
  const urlPath = getUrlPath(url);
  const parentView = link.closest('.Stack-view');
  if (url.origin !== location.origin || !resolveUrl(urlPath) || !parentView) return;

  e.preventDefault();
  returnFocus.set(parentView, link);
  drillDown(urlPath);
});

window.addEventListener('popstate', (event) => {
  const targetDepth = event.state?.depth ?? 0;

  if (targetDepth >= stack.children.length) {
    const routeData = resolveUrl(event.state?.url ?? getUrlPath());
    if (routeData) stack.appendChild(createDrillDownView(routeData));
  }

  const fromIdx = Math.round(stack.scrollLeft / stack.clientWidth);
  currentDepth = targetDepth;
  if (fromIdx === targetDepth) return;

  const behavior = targetDepth > fromIdx || Math.abs(targetDepth - fromIdx) > 1 ? 'instant' : 'auto';
  stack.scrollTo({ left: targetDepth * stack.clientWidth, top: 0, behavior });
});

const initialPath = getUrlPath();
stack.appendChild(createRootView());
history.replaceState({ depth: 0, url: '/' }, '', '/');

if (resolveUrl(initialPath)) {
  requestAnimationFrame(() => requestAnimationFrame(() => drillDown(initialPath, 'instant')));
}
```

## Fallback strategies

### Inert

{{ BASELINE_STATUS("inert") }}

### Scroll snap events

{{ BASELINE_STATUS("scroll-snap-events") }}

Detect support via `'onscrollsnapchange' in HTMLElement.prototype` and fall back to an `IntersectionObserver` (`{ root: stack, threshold: 1 }`) paired with a `MutationObserver` on `stack` to observe added `.Stack-view` nodes.

### Scroll-driven animations

{{ BASELINE_STATUS("scroll-driven-animations") }}

Wrap `animation-timeline: view(inline)` rules in `@supports (animation-timeline: view())`.
