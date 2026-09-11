---
name: hovercard
description: Build a hovercard component that displays an interactive structured preview of the page a certain type of link (e.g. a user profile) will navigate to when hovered over.
web-feature-ids:
  - popover
  - popover-hint
  - anchor-positioning
  - interest-invokers
  - cross-document-view-transitions
guides:
  - interest-triggered-tooltips
  - consistent-cross-document-transitions
  - cross-document-transitions
---

# Build an interactive hovercard

Hovercards provide an interactive preview of content when a user expresses interest in a link (via hover or focus). This is shown to users before they navigate, and either provides the user with the content they need or helps verify that the link will contain the content they are looking for.

## 1. Triggering the hovercard

Use the **Interest Invokers** API to trigger the hovercard. This ensures the card appears on both hover and focus, and handles accessibility wiring automatically.

- Add the `popover="hint"` attribute to your card container. Use `hint` to avoid closing unrelated popover menus that may be open.
- Add the `interestfor` attribute to the trigger link, pointing to the card's `id`.

```html
<a href="/article" interestfor="article-preview">Article title</a>

<!-- The `id` must match the `interestfor` value on the trigger. -->
<div id="buzz-popover" popover="hint">
  <h2>The buzz on hummingbirds</h2>
  <p class="byline">By Delphi Aguilar</p>
  <div>
    <img src="bird.jpg" alt="A vibrant hummingbird">
    <p>Brief summary of the article...</p>
  </div>
</div>
```

You do not need to include an additional link to the content inside of the hovercard, as it is redundant to the triggering link. 

For more details on triggering and accessibility, see {{ GUIDE_REF("interest-triggered-tooltips") }}.

### Accessibility built in to `interestfor`

When you use `interestfor`, the browser handles the assistive-technology wiring:
- It implicitly associates the source element with the target via `aria-describedby` when the target is plaintext, or via `aria-details` when it contains interactive content.
- **DO NOT** add `aria-describedby` or `aria-details` manually; `interestfor` manages this state dynamically.

## 2. Positioning with Anchor Positioning

Position the hovercard relative to its trigger using **CSS Anchor Positioning**. When using `interestfor`, the trigger becomes an implicit anchor for the popover.

```css
[popover] {
  /* Position the card below the trigger and aligned with the inline end.
     This assumes the trigger is the implicit anchor. */
  position-area: block-end span-inline-end;
}
```

## 3. Animating entry and exit

See the {{ GUIDE_REF("animate-to-from-top-layer")}} guide to see how to use `transition` with `allow-discrete` and `@starting-style` to animate the hovercard's appearance and disappearance from the top layer.

Always respect reduced motion.

```css
/* MANDATORY: Respect user preference for reduced motion by disabling transitions. */
@media (prefers-reduced-motion: reduce) {
  [popover] {
    transition: none;
  }
}
```

## 4. Seamlessly morphing to the next page

You can use **Cross-Document View Transitions** to create a seamless "morph" animation between the hovercard and the destination page. By assigning matching `view-transition-name` values to elements in the hovercard and their counterparts on the next page, the browser will animate them across the navigation.

You can name multiple elements (e.g. titles, images, bylines) to create a complex, multi-element morphing effect. Assign the `view-transition-name` to elements on the open popover using `:popover-open`, to avoid creating duplicate `view-transition-name`s or requiring link-specific `view-transition-name`s.

```css
/* Opt-in to cross-document transitions on both pages */
@view-transition {
  navigation: auto;
}

/* Assign names ONLY when the popover is open to ensure only the correct elements are selected. */
[popover]:popover-open {
  view-transition-name: --hovercard;

  h2 {
    view-transition-name: --title;
  }

  img {
    view-transition-name: --image;
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
    <h1 style="view-transition-name: --title">The buzz on hummingbirds</h1>
    <img style="view-transition-name: --image" src="bird.jpg">
  </main>
</body>
```

## Fallback strategies

This pattern is a progressive enhancement and does not require a fallback. Users with browsers that do not support these patterns will see a standard link that takes them to the next page when they click.

{{ FEATURE_FALLBACKS("popover") }}

{{ FEATURE_FALLBACKS("popover-hint") }}

{{ FEATURE_FALLBACKS("interest-invokers") }}

{{ FEATURE_FALLBACKS("anchor-positioning") }}

{{ FEATURE_FALLBACKS("cross-document-view-transitions") }}
