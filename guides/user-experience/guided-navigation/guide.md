---
name: guided-navigation
description: Guide users between pages and views with transitions that show where they're going, and keep their place when they come back.
web-feature-ids:
  - view-transitions
  - cross-document-view-transitions
  - active-view-transition
  - navigation
  - speculation-rules
  - prefers-reduced-motion
  - history
  - localstorage
---

# Provide guided navigation

Eliminate disorienting page reloads with smooth, state-preserving transitions between views.

Choose the approach by architecture:

- **Single-page apps:** handle navigations with the Navigation API and update the DOM inside a same-document view transition.
- **Multi-page sites:** prerender likely next pages with speculation rules and add cross-document view transitions. DO NOT convert a multi-page site to client-side routing just for this.

## Implementation

### Slide views in the direction of travel

Animate `transform` so incoming views enter from the direction of travel and Back mirrors the motion, using the forward and backward types from {{ GUIDE_REF("directional-navigation-transitions") }}. Fades alone don't show direction.

```css
@media (prefers-reduced-motion: no-preference) {
  html:active-view-transition-type(forward)::view-transition-old(root) { animation: 300ms ease both slide-to-left; }
  html:active-view-transition-type(forward)::view-transition-new(root) { animation: 300ms ease both slide-from-right; }
  html:active-view-transition-type(backward)::view-transition-old(root) { animation: 300ms ease both slide-to-right; }
  html:active-view-transition-type(backward)::view-transition-new(root) { animation: 300ms ease both slide-from-left; }
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*) { animation-name: none; } /* named elements don't move; views still crossfade */
}

@keyframes slide-to-left { to { transform: translateX(-100%); } }
@keyframes slide-from-right { from { transform: translateX(100%); } }
@keyframes slide-to-right { to { transform: translateX(100%); } }
@keyframes slide-from-left { from { transform: translateX(-100%); } }
```

- Give a sticky header its own `view-transition-name` in CSS so it stays put. MANDATORY: each name must be unique.
- To morph an element into its counterpart on the next view (such as a card into a hero image), give both the same `view-transition-name`; see {{ GUIDE_REF("same-document-transitions") }}.

### Single-page apps: handle navigations with the Navigation API

The `navigate` event fires for link clicks, Back, Forward, and your own `history` calls. Intercept the navigations your router handles and render them inside a view transition:

```js
window.navigation?.addEventListener('navigate', (event) => {
  if (!event.canIntercept || event.hashChange || event.downloadRequest !== null || event.formData) return;
  // Skip your own history.pushState() and replaceState() calls, such as tab state.
  if (event.destination.sameDocument && event.navigationType !== 'traverse') return;
  const url = new URL(event.destination.url);
  const back = event.navigationType === 'traverse' && event.destination.index < navigation.currentEntry.index;
  event.intercept({
    scroll: 'manual',
    focusReset: 'manual',
    async handler() {
      const data = await loadData(url, event.signal); // your app's data loading; pass the signal to fetch() to cancel stale loads
      await go(async () => {
        await renderView(url, data); // your app's renderer; resolve once the DOM is updated
        event.scroll(); // Back and Forward restore the old position; other navigations go to the top
        const heading = document.querySelector('main h1');
        heading?.setAttribute('tabindex', '-1');
        heading?.focus({ preventScroll: true }); // don't undo the restored scroll position
      }, back ? 'backward' : 'forward');
    },
  });
});

function go(update, direction) {
  if (!document.startViewTransition) return update();
  const transition = 'types' in ViewTransition.prototype
    ? document.startViewTransition({ update, types: [direction] })
    : document.startViewTransition(update);
  transition.ready.catch(() => {}); // the next navigation can skip this transition, which rejects ready
  return transition.updateCallbackDone;
}
```

- Update `document.title` when rendering. Moving focus to the new heading lets keyboard and screen reader users start from the new content.
- For slow loads, set `aria-busy="true"` on the view container and show a visible indicator, such as `<progress>`, while loading. To keep views instead of re-rendering them on Back, see {{ GUIDE_REF("faster-spa-view-transitions") }}.
- If your app uses a router library, don't add this listener as well; wrap the router's view updates in `go()` instead.

### Multi-page sites: prerender and transition

Prerender same-origin pages on link hover:

```html
<script type="speculationrules">
{
  "prerender": [{
    "where": { "and": [
      { "href_matches": "/*" },
      { "not": { "selector_matches": "[data-no-prerender]" } }
    ]},
    "eagerness": "moderate"
  }]
}
</script>
```

- Exclude links with side effects (sign out, cart) using `data-no-prerender`. For rule sets, see {{ GUIDE_REF("improve-next-page-load-performance") }}.
- Opt in to cross-document transitions in CSS with `@view-transition { navigation: auto; }`.
- For direction, use a `pagereveal` listener in a classic `<script>` in `<head>`: if `e.viewTransition` and `window.navigation?.activation` exist, add `'backward'` to `e.viewTransition.types` when the activation's `entry.index` is lower than its `from?.index`, and `'forward'` otherwise; see {{ GUIDE_REF("cross-document-transitions") }}.

### Preserve state across Back and Forward

- Keep tab and filter choices in the URL (`?tab=reviews`) with `history.replaceState()` and read them on render, so Back, reload, and shared links restore them. Use `history.state` for choices that shouldn't be shared.
- Reserve space for images and embeds so the view doesn't shift after rendering on Back.
- Keep pages eligible for bfcache: DO NOT add `unload` handlers or send `Cache-Control: no-store` on HTML pages.
- DO NOT set `autocomplete="off"` on fields people expect to get back; it can stop the browser from restoring them on Back.
- Single-page apps re-render on Back, so save in-progress inputs in `sessionStorage` and restore them on mount:

```js
form.addEventListener('input', () => sessionStorage.setItem('draft:search', form.q.value)); // for checkboxes and radios, save .checked
form.q.value = sessionStorage.getItem('draft:search') ?? form.q.value;
```

- DO NOT block navigation with `alert()`, `confirm()`, or `beforeunload` dialogs. Save drafts instead.

## Fallback strategies

### Navigation API

{{ BASELINE_STATUS("navigation") }}

If your Baseline target includes browsers without the Navigation API, navigation there degrades gracefully to full page loads, because the listener above doesn't run. Serve your app at every route URL, and keep pages eligible for bfcache so Back restores them. Optionally, add `@view-transition { navigation: auto; }` to animate those loads where supported.

### View transitions

{{ BASELINE_STATUS("view-transitions") }}
{{ BASELINE_STATUS("active-view-transition") }}

View transitions are a progressive enhancement. `go()` updates the DOM directly when `document.startViewTransition` is missing, and runs an untyped crossfade when transition types aren't supported.

### Cross-document view transitions

{{ BASELINE_STATUS("cross-document-view-transitions") }}

Browsers without support ignore `@view-transition` and navigate normally without animation. No fallback code is needed.

### Speculation rules

{{ BASELINE_STATUS("speculation-rules") }}

Browsers without support ignore the script, and pages load on click as usual. No fallback code is needed.
