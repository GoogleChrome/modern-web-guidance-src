---
name: client-side-routing
description: Route link clicks, Back, and Forward in a single-page app without full page reloads, with animated transitions between views and correct scroll position, focus, and loading feedback.
web-feature-ids:
  - navigation
  - view-transitions
  - active-view-transition
---

# Navigate between views in a single-page app

Route link clicks, Back, and Forward navigations without full page reloads, with animated transitions between views and correct scroll positions, keyboard focus, and loading indicators.

Choose the appropriate architecture before implementing:

- **Single-page apps (SPAs):** Intercept navigations with the Navigation API and update the DOM inside a same-document view transition.
- **Multi-page architectures (MPAs):** Use native document navigations with cross-document view transitions; do not convert a multi-page site to client-side routing just for smoother navigation. See {{ GUIDE_REF("cross-document-transitions") }}.
- **Shared element morphs:** To smoothly morph persistent elements across views, see {{ GUIDE_REF("same-document-transitions") }}.
- **Directional slide animations:** To slide views in the direction of travel using transition types, see {{ GUIDE_REF("directional-navigation-transitions") }}.
- **Persistent DOM state:** To keep views in the DOM across navigations, see {{ GUIDE_REF("faster-spa-view-transitions") }}.
{# PENDING_GUIDE_REF: - **Complete navigation UX:** For how routing fits with motion, state preservation, and multi-page navigation, see {{ GUIDE_REF("guided-navigation") }}. #}

## Implementation

### Intercept navigations with the Navigation API

The `navigate` event fires for link clicks, Back, Forward, and programmatic navigations. Intercept same-origin navigations that change the view, skip your own same-document `history.pushState()` and `replaceState()` calls (such as tab state), and let downloads, POST form submissions (`event.formData`), and same-page `#hash` jumps proceed natively. GET form submissions are intercepted like link clicks:

```javascript
let latestNavigation;
window.navigation?.addEventListener('navigate', (event) => {
  const { canIntercept, hashChange, downloadRequest, formData, destination } = event;
  if (!canIntercept || hashChange || downloadRequest !== null || formData) return;
  if (destination.sameDocument && event.navigationType !== 'traverse') return;
  latestNavigation = event;
  const url = new URL(destination.url);
  const from = navigation.currentEntry.url; // Read before intercepting: still the view being left
  const dir = event.navigationType === 'traverse' &&
    destination.index < navigation.currentEntry.index ? 'backward' : 'forward';
  event.intercept({
    scroll: 'manual',
    focusReset: 'manual',
    async handler() {
      const main = document.querySelector('main');
      main?.setAttribute('aria-busy', 'true');
      try {
        const data = await loadData(url, event.signal);
        await go(async () => {
          await renderView(url, data);
          event.scroll(); // Restores position on traverse; otherwise #hash or top
          focusView(event.navigationType, url, from);
        }, dir);
      } catch (err) {
        if (event.signal.aborted || err?.name === 'AbortError') return; // Canceled: no error view
        await go(async () => {
          await renderError(url, err);
          window.scrollTo(0, 0);
          focusView();
        }, dir);
      } finally {
        if (latestNavigation === event) main?.removeAttribute('aria-busy'); // Unless superseded
      }
    },
  });
});
```

- **Scroll and focus timing:** `scroll: 'manual'` and `focusReset: 'manual'` stop the browser from scrolling and resetting focus to `<body>` after the handler settles. Scroll and focus inside the view transition update instead, so the new snapshot is captured at the final position.
- **Scroll position:** After the new view is in the DOM, call `event.scroll()`. It restores the saved position on Back/Forward and otherwise scrolls to the `#hash` target or the top of the page.
- **Accessible focus:** Move focus after rendering and scrolling without resetting the scroll position (`preventScroll: true`) so keyboard and screen reader users start in context (WCAG 2.4.3 Focus Order): on Back or Forward (`traverse`), focus the link in the restored view whose `href` matches the URL being left, or if none matches (usually Forward), wait one animation frame for the restored scroll position and focus the first heading or link inside the viewport; for a `#hash` URL, focus its target element (guarding `decodeURIComponent` against malformed fragments); otherwise focus the new view's `<h1>`. If the target does not take focus, add `tabindex="-1"` and focus it again.
- **Loading feedback:** While data loads, set `aria-busy="true"` on the view container (such as `<main>`) and show a visible indicator with an accessible name, such as `<progress aria-label="Loading">`, positioned without shifting layout or scroll position — a fixed indicator must not cover the focused element (WCAG 4.1.2 Name, Role, Value; 4.1.3 Status Messages; 2.4.11 Focus Not Obscured). Clear both in `finally` only when `latestNavigation === event` so a newer navigation keeps the loading state while a cancellation without replacement (Stop, a skipped `pushState`, or a same-page hash link) still clears it.
- **Cancel stale fetches:** Pass `event.signal` to `fetch()` calls so in-flight requests are automatically aborted when the user navigates again before loading finishes.
- **Update page title:** Update `document.title` during view rendering so browser history and screen readers reflect the current page (WCAG 2.4.2 Page Titled).
- **Handle failed loads:** Treat network rejections and non-OK HTTP responses (`!response.ok`) as failures, while letting aborted navigations (`event.signal.aborted` or `AbortError`) cancel quietly. When loading fails, render an error view with its own `<h1>` and `document.title` (WCAG 2.4.2 Page Titled), scroll to the top, and move focus to that heading (WCAG 2.4.3 Focus Order) so users can tell the navigation did not complete.

Resolve the post-navigation focus target in a helper called after `event.scroll()`:

```javascript
function focusView(navigationType, url, from) {
  const focus = (el) => {
    el?.focus({ preventScroll: true });
    if (el && document.activeElement !== el) { // Not natively focusable
      el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    }
  };
  const main = document.querySelector('main');
  if (navigationType === 'traverse') {
    const link = [...main.querySelectorAll('a[href]')].find((a) => a.href === from);
    if (link) return focus(link);
    // No link that led away (usually Forward): the restored scroll lands one frame later
    return requestAnimationFrame(() => focus([...main.querySelectorAll('h1, h2, h3, a[href]')]
      .find((el) => el.getBoundingClientRect().bottom > 0)));
  }
  let target = null;
  if (url?.hash) {
    try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch {}
  }
  focus(target ?? main.querySelector('h1'));
}
```

### Transition views with the View Transition API

Wrap DOM updates in a view transition helper that specifies the navigation direction using transition types:

```javascript
function go(update, direction) {
  const transition = document.startViewTransition({ update, types: [direction] });
  transition.ready.catch(() => {}); // Subsequent navigations can skip this transition
  transition.finished.catch(() => {}); // Prevent an unhandled rejection if update() throws
  return transition.updateCallbackDone;
}
```

- When using a client-side router library, do not duplicate the `navigate` event listener; wrap the router's view rendering callbacks in `go()` instead.

## Fallback strategies

### Navigation API

{{ BASELINE_STATUS("navigation") }}

If your Baseline target includes browsers without the Navigation API, navigation degrades gracefully to native full-page loads because the `navigate` event listener does not register. Ensure the server delivers the application shell or page at every route URL. Keep pages eligible for the back/forward cache (bfcache) by avoiding `unload` event listeners and not sending `Cache-Control: no-store` on HTML responses unless they contain private data, so Back navigations restore previous scroll and state instantly.

### View transitions

{{ BASELINE_STATUS("view-transitions") }}
{{ BASELINE_STATUS("active-view-transition") }}

View transitions are a progressive enhancement. If `document.startViewTransition` is unsupported, make `go()` run `update()` directly and return its promise. If transition types are unsupported (`!('types' in ViewTransition.prototype)`), call `document.startViewTransition(update)` without types to get an untyped crossfade. Keep the `ready` and `finished` catches.
