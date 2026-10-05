---
name: hovercard
description: Build a hovercard component that displays an interactive structured preview of the page a certain type of link (e.g. a user profile) will navigate to when hovered over.
web-feature-ids:
  - popover
  - popover-hint
  - anchor-positioning
  - interest-invokers
  - cross-document-view-transitions
  - blocking-render
  - link-rel-expect
guides:
  - interest-triggered-tooltips
  - consistent-cross-document-transitions
  - cross-document-transitions
---

# Build an interactive hovercard

Hovercards provide an interactive preview of content when a user expresses interest in a link (via hover or focus). This is shown to users before they navigate, and either provides the user with the content they need or helps verify that the link will contain the content they are looking for.

If you need plain-text, non-interactive tooltips rather than structured link previews, see {{ GUIDE_REF("interest-triggered-tooltips") }}.

## 1. Triggering the hovercard

Use the **Interest Invokers** API to trigger the hovercard. This ensures the card appears on both hover and focus, and handles accessibility wiring automatically.

- Add the `popover="hint"` attribute to your card container. Use `hint` to avoid closing unrelated popover menus that may be open.
- Add the `interestfor` attribute to the trigger link, pointing to the card's `id`.

```html
<a href="/article" interestfor="article-preview">Article title</a>

<!-- The `id` must match the `interestfor` value on the trigger. -->
<div id="article-preview" popover="hint" class="hovercard">
  <h2>The buzz on hummingbirds</h2>
  <p class="byline">By Delphi Aguilar</p>
  <div>
    <img src="bird.jpg" alt="A vibrant hummingbird">
    <p>Brief summary of the article...</p>
  </div>
</div>
```

You do not need to include an additional link to the content inside of the hovercard, as it is redundant to the triggering link. 

### Accessibility built in to `interestfor`

{{ FEATURE("interest-invokers", "accessibility") }}

## 2. Positioning with Anchor Positioning

Position the hovercard relative to its trigger using **CSS Anchor Positioning**. When using `interestfor`, the trigger becomes an implicit anchor for the popover.

```css
[popover].hovercard {
  /* Position the card below the trigger, aligned with its inline-start edge
     and spanning toward the inline-end, flipping if it overflows the viewport. */
  position-area: block-end span-inline-end;
  position-try-fallbacks: flip-block, flip-inline;
}
```

## 3. Animating entry and exit

{{ FEATURE("interest-invokers", "timing") }}

Use `@starting-style` to define the entry animation and `transition-behavior: allow-discrete` (along with `display` and `overlay`) to animate the exit from the top layer, gating the transitions behind `@media (prefers-reduced-motion: no-preference)`.

```css
[popover].hovercard {
  opacity: 0;
  transform-origin: top;
}

[popover].hovercard:popover-open {
  opacity: 1;
  transform: translateY(0) scale(1);
}

@starting-style {
  [popover].hovercard:popover-open {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
  }
}

/* MANDATORY: Respect user preference for reduced motion by selectively applying transitions. */
@media (prefers-reduced-motion: no-preference) {
  [popover].hovercard {
    transition:
      opacity,
      transform,
      display,
      overlay;
    transition-duration: 0.4s;
    transition-behavior: allow-discrete;
  }
}
```

## 4. OPTIONAL: Seamlessly morphing to the next page

You can optionally use **Cross-Document View Transitions** to create a seamless "morph" animation between the hovercard and the destination page. See {{ GUIDE_REF("consistent-cross-document-transitions") }} for guidance on implementation.

By assigning matching `view-transition-name` values to elements in the hovercard and their counterparts on the next page, the browser will animate them across the navigation. You can name multiple elements (e.g. titles, images, bylines) to create a complex, multi-element morphing effect. Assign the `view-transition-name` to elements on the open popover using `:popover-open`, to avoid creating duplicate `view-transition-name`s or requiring link-specific `view-transition-name`s.

```css
/* Opt-in to cross-document transitions on both pages */
@view-transition {
  navigation: auto;
}

/* Don't show transitions when loading this page */
::view-transition-group(*) {
  animation-duration: 0s;
}

/* Assign names ONLY when the popover is open to ensure only the correct elements are selected. */
[popover]:popover-open {
  view-transition-name: --hovercard;
  view-transition-class: morph;

  h2 {
    view-transition-name: --title;
    view-transition-class: morph;
  }

  img {
    view-transition-name: --image;
    view-transition-class: morph;
  }
}
```

**MANDATORY:** To ensure the transition is stable and doesn't flicker, the destination page should use `blocking="render"` and `<link rel="expect">` to wait for critical content to be parsed before rendering the first frame.

```html
<!-- On the destination page: -->
<head>
  <!-- Block rendering until the hero image and title are parsed,
       ensuring the view transition snapshot is taken at the right time. -->
  <link rel="expect" href="#main-content" blocking="render">
</head>
<body>
  <main id="main-content">
    <h1>The buzz on hummingbirds</h1>
    <img src="bird.jpg">
  </main>
</body>
```

```css
/* On the destination page: */
main {
  view-transition-name: --hovercard;
  view-transition-class: morph;
}
h1 {
  view-transition-name: --title;
  view-transition-class: morph;
}
img {
  view-transition-name: --image;
  view-transition-class: morph;
}

/* By default no transition */
::view-transition-group(*) {
  animation-duration: 0s;
}
/* Short transition for morphing elements */
::view-transition-group(.morph) {
  animation-duration: 0.4s;
}
/* Disable transition if no `old` view */
::view-transition-new(.morph):only-child {
  animation-duration: 0s;
}
```

## Fallback strategies

Because the trigger is a standard `<a href="...">` link, browsers without support can still navigate on click if you choose to treat the hovercard as a progressive enhancement. When cross-browser hovercard support is required, conditionally load the polyfills below:

{{ FEATURE_FALLBACKS("popover") }}

{{ FEATURE_FALLBACKS("popover-hint") }}

{{ FEATURE_FALLBACKS("interest-invokers") }}

{{ FEATURE_FALLBACKS("anchor-positioning") }}

{{ FEATURE_FALLBACKS("cross-document-view-transitions") }}
