---
name: scoped-component-transitions
description: Animate state changes inside a single component (a card, list, panel, or other subtree) without pausing the rest of the page or conflicting with other transitions running concurrently.
web-feature-ids:
  - view-transitions-element-scoped
  - view-transitions
sources:
  - https://github.com/WICG/view-transitions/blob/main/scoped-transitions.md
  - https://developer.chrome.com/blog/element-scoped-view-transitions
  - https://developer.chrome.com/docs/css-ui/view-transitions/element-scoped-view-transitions
  - https://drafts.csswg.org/css-view-transitions-2/
---

# Scope a view transition to a single component

`Element.prototype.startViewTransition()` runs a view transition that affects only the element's own DOM subtree. The pseudo-element tree (`::view-transition`, `::view-transition-group(...)`, `::view-transition-old(...)`, `::view-transition-new(...)`) is hosted on the element itself, not on `<html>`, so the rest of the page keeps rendering, stays interactive, and can paint on top of the transitioning subtree by normal `z-index` rules.

Use this whenever a state change is *internal* to one component — a list rearranging inside a card, a tab panel swapping content, an accordion expanding — and a full-page `document.startViewTransition()` would be overkill or would freeze unrelated UI (toolbars, modals, other in-flight transitions).

## Implementation

1. **MANDATORY: Call `startViewTransition()` on the scope element, not on `document`.** A document-level transition snapshots the whole page and pauses the entire document's rendering during the callback; calling it for a per-component change defeats the point of scoping and re-introduces every problem element-scoped transitions were designed to solve (overlays getting hidden, fixed-position elements getting captured, concurrent transitions cancelling each other).
2. **MANDATORY: Tag the participants whose old and new positions should be matched.** Give each element you want to morph a unique `view-transition-name` inside the scope. For repeating content where you don't want to invent a name per item, set `view-transition-name: match-element` on the items so the browser derives stable per-element identity automatically. Names only have to be unique *within their scope*; two scopes can reuse the same name without colliding.
3. **DO declare `contain: layout` and `view-transition-scope: all` on the scope element up front.** The browser auto-applies both during a scoped transition (so omitting them does not break the feature), but declaring them explicitly avoids a one-frame reflow when the transition starts and guarantees namespace isolation if a parent ever runs its own transition. Treat them as "required for production polish, optional for a proof of concept."
4. **OPTIONAL: Opt out of self-participation when the scope itself should not cross-fade.** By default the scope behaves as if it had `view-transition-name: root`, which cross-fades the entire scope between old and new states. If you want only the participants inside the scope to animate (and the scope's own border / background to stay live), set `view-transition-name: none` on the scope element.
5. **OPTIONAL: Keep non-transitioning content interactive.** During a transition the pseudo-element tree paints on top of the scope's contents. If you've opted out of self-participation and want elements inside the scope to remain clickable and hoverable while the transition runs, add `pointer-events: none` to the scoped pseudo-element. Qualify the selector to *this* scope (e.g. `.card::view-transition`) — pseudo-trees are hosted per-scope, so an unqualified `::view-transition` rule would also disable interactivity on every other scope's transition.

```html
<!-- Two independent components on the same page. Either can transition
     on its own without affecting the other; both can transition at the
     same time. -->
<section class="card" id="left">
  <button id="left-rotate">Rotate</button>
  <ul id="left-list"><!-- items rendered by JS --></ul>
</section>

<section class="card" id="right">
  <button id="right-rotate">Rotate</button>
  <ul id="right-list"><!-- items rendered by JS --></ul>
</section>
```

```css
/* The scope: contain: layout forces a stacking context so the scope's
   painted output can be captured as an atomic unit. The browser auto-
   applies it during a scoped transition; declaring it up-front prevents
   a one-frame reflow when the transition starts. */
.card {
  contain: layout;

  /* The scope: view-transition-scope: all isolates this subtree's
     view-transition-name namespace from ancestors and siblings. Two
     components can reuse the same view-transition-name (e.g. each set
     of <li>s using `match-element`) without colliding. */
  view-transition-scope: all;
}

/* DO tag participants whose old and new positions should be paired.
   `match-element` derives a stable per-element identifier so you don't
   have to invent names for every list item. The names are scoped to the
   nearest ancestor with view-transition-scope: all, so the same
   `match-element` value on both lists never collides. */
.card li {
  view-transition-name: match-element;
}

/* OPTIONAL: tune the default cross-fade animation that wraps each
   participant. Pseudo-elements live under each scope independently,
   so this rule applies to whichever transition is currently running. */
::view-transition-group(*) {
  animation-duration: 300ms;
  animation-timing-function: ease-in-out;
}

/* DO respect reduced-motion. Element-scoped transitions still produce
   the same pseudo-element tree, just hosted on the scope, so the same
   universal selectors that work for document-level transitions apply. */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

```javascript
// Feature-detect on Element.prototype. The spec defines
// startViewTransition on Element, so SVG and MathML elements that also
// inherit from Element are covered; `HTMLElement.prototype` would be
// strictly narrower than what the API supports.
const supportsScopedTransition =
  'startViewTransition' in Element.prototype;

function applyUpdate(scopeEl, callback) {
  if (!supportsScopedTransition) {
    // Fallback path: apply the change immediately. The result is the
    // same final DOM; only the animation is missing. Do NOT silently
    // fall back to document.startViewTransition here — its full-page
    // render-pause and overlay-capture behaviour is exactly what
    // element-scoped transitions exist to avoid.
    callback();
    return;
  }

  // Call startViewTransition on the scope element, not on document. A
  // document-level call would pause the whole page's rendering and
  // capture every overlay above the component. OPTIONAL hardening:
  // attach `.finished.catch(...)` if you want explicit logging on a
  // thrown callback (otherwise the rejection is silent).
  scopeEl.startViewTransition(callback);
}

document.getElementById('left-rotate').addEventListener('click', () => {
  applyUpdate(
    document.getElementById('left'),
    () => updateList(document.getElementById('left-list')),
  );
});
```

Two scopes can run transitions concurrently — even when one scope is a descendant of the other — because each scope hosts its own pseudo-element tree and pauses rendering only inside its own subtree. Starting a second transition on the *same* scope while one is in progress skips the in-progress transition and runs the new one immediately; rapid repeat clicks are safe and do not need debouncing.

DO NOT call `document.startViewTransition()` for a per-component update and then try to limit the participants with `view-transition-name`. That still pauses rendering for the whole page during the update callback, still captures fixed-position overlays into the snapshot, and still skips any other in-flight document-level transition. Element-scoped transitions exist precisely because those side effects are unavoidable at the document level.

DO NOT animate `transform` or layout offset *of the scope itself* as part of the transition. Those properties move the pseudo-element tree along with the scope, so they appear motionless relative to the participants. Animate them on a wrapping ancestor (or a non-self-participating wrapper) instead.

## Fallback strategies

{{ BASELINE_STATUS("view-transitions-element-scoped") }}

Element-scoped view transitions are a progressive enhancement. In browsers without support, the feature-detection branch above runs the DOM update directly with no animation; the final state is identical to the supported path. If document-level view transitions (`document.startViewTransition`) are available but element-scoped ones are not, do *not* silently fall through to a document-level transition for a per-component change — the behavioural differences (full-page render pause, overlay capture, single-transition-at-a-time) usually make the fallback worse than no animation at all.

DO NOT recommend a polyfill. The pseudo-element tree, render suppression scoped to a subtree, and capture of border/box-shadow/outline are paint-pipeline behaviours; no JavaScript shim can reproduce them faithfully, and substituting an iframe or a clone-and-FLIP approximation loses the integration with `z-index`, fixed-position overlays, and concurrent transitions that the native feature provides.

If a scoped animation is critical and the no-animation fallback (instant DOM update) is unacceptable for one specific component, use a CSS animation or the Web Animations API for that component as a parallel implementation — but prefer the no-animation fallback whenever it is acceptable, so a single source of truth drives the visual output.
