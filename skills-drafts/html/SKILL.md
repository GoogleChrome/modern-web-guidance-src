---
name: html
description: Action-oriented guidelines for modern HTML architecture, semantics, native interactive APIs (Dialog, Popover, Details), focus management, and resource prioritization. Use this skill when structuring web documents, implementing native overlays, or optimizing resource loading order.
---

## 1. Fundamental Semantics and Validation

### Guidelines

- **DO** use the standard HTML5 doctype `<!DOCTYPE html>` to prevent quirky rendering modes.
- **DO** set the `lang` attribute on the `<html>` element for screen reader pronunciation and translation tools.
- **DO** use a single `<h1>` per page representing the main topic. Maintain a sequential, non-skipping heading hierarchy (`<h2>` to `<h3>`).
- **DO** use semantic landmarks (`<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`) to create regional navigation for assistive technologies.
- **DO** use `<search>` to enclose search and filtering mechanisms (eliminates the need for `role="search"`).
- **DO** use `<button>` for triggered actions (JS, Modals, Forms) and `<a>` strictly for URL navigation. Set `type="button"` for non-submit buttons in forms to prevent unintended submission.

- **DON'T** use generic `<div>` or `<span>` for interactive elements or headings.
- **DON'T** use boolean attributes with redundant values (e.g., use `disabled`, not `disabled="disabled"`).
- **DON'T** use inline styles; they violate CSP and bloat page weight.

### Code Example

```html
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dashboard | Platform</title>
</head>
<body>
  <header>
    <h1>Analytics</h1>
    <nav>...</nav>
  </header>
  <main>
    <search>
      <form action="/filter" method="GET">
        <label for="search-input">Scan items:</label>
        <input type="search" id="search-input" name="q">
      </form>
    </search>
  </main>
</body>
</html>
```

## 2. Resource Prioritization and Performance

### Guidelines

- **DO** use `fetchpriority="high"` for the Largest Contentful Paint (LCP) element (e.g., hero image) to elevate network priority.
- **DO** use `<link rel="preload" as="image">` with `fetchpriority="high"` for LCP background images defined in CSS.
- **DO** apply `loading="lazy"` to off-screen images and iframes to defer bandwidth.
- **DO** specify `width` and `height` on all `<img>` tags to preserve aspect ratio and prevent Layout Shifts (CLS).

- **DON'T** apply `loading="lazy"` to above-the-fold or hero images. This delays LCP.
- **DON'T** overuse `fetchpriority="high"`; prioritization is a zero-sum mechanism. Use `fetchpriority="low"` to demote non-critical trackers or carousel items.

### Code Example

```html
<!-- High-priority hero image -->
<img 
  src="hero.webp" 
  alt="Main product view" 
  fetchpriority="high" 
  width="1200" 
  height="600"
>

<!-- Low-priority decorative footer image -->
<img 
  src="footer-art.png" 
  alt="" 
  loading="lazy" 
  width="200" 
  height="100"
>
```

## 3. Native Overlays: Dialogs and Popovers

### Guidelines

- **DO** use `<dialog>` for modal overlays (requires JS `.showModal()`) to automatically trap focus, dim backgrounds, and support dismissing via `Esc`.
- **DO** utilize the Popover API (`popover` attribute) command for non-modal UI (menus, tooltips) that do not require focus traps.
- **DO** use `::backdrop` to style modal backgrounds.
- **DO** use `<form method="dialog">` to dismiss dialogs without manual JS handlers. Combined button `formmethod="dialog"` yields the button's value to the dialog `.returnValue`.

- **DON'T** use `show()` for modals where keyboard traps are expected (use `showModal()`).
- **DON'T** call `showModal()` on elements possessing a `popover` attribute (they are mutually exclusive programmatic states). However, `<dialog popover="auto">` is a valid declarative architecture to combine dialog semantics with light-dismiss mechanics.

### Code Example

```html
<!-- Popover (No JS required for toggle) -->
<button popovertarget="help-menu">Info</button>
<div id="help-menu" popover="auto">
  <p>Standard help text.</p>
</div>

<!-- Modal Dialog -->
<dialog id="fav-modal">
  <form method="dialog">
    <p>Confirm action?</p>
    <button value="cancel">Cancel</button>
    <button value="confirm">Confirm</button>
  </form>
</dialog>

<script>
  // Open modal
  btn.addEventListener('click', () => dialog.showModal());
  
  // Handle close
  dialog.addEventListener('close', () => {
    console.log(dialog.returnValue); // "confirm" or "cancel"
  });
</script>
```

### Native UI Overlay & Disclosure Matrix

| Feature | Modality | Focus | Dismiss Mechanism | Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **`<dialog>`** | Modal / Non-modal | Automatic trap (Modal) | Esc Key / Form submit | Critical Actions, Settings |
| **`[popover]`** | Non-modal | Standard Tab flow | Light-dismiss (Click outside) | Menus, Tooltips, Toasts |
| **`<details>`** | Inline Disclosure | Standard Tab flow | Toggle summary | Accordions, FAQs |

**Heuristic Rule**: Use `<dialog>` for interruptions requiring user action, `popover` for transient info, and `<details>` for inline content expansion.

## 4. Disclosures: Details and Summary

### Guidelines

- **DO** use `<details>` and `<summary>` for native accordions or revealable content without JS.
- **DO** place `<summary>` as the *first* child of `<details>`.
- **DO** use `details[open]` attribute for styling expanded states.
- **DO** use the `name` attribute on multiple `<details>` elements to create exclusive accordions (opening one closes others).

- **DON'T** nest other interactive elements (links, buttons) directly inside `<summary>` text as it acts as a button and breaks focus.
- **DON'T** hide visible triangles via `list-style: none` without providing explicit directional cues (via `::before`/`::after` pseudo-elements).

### Code Example

```html
<!-- Exclusive Accordion Set -->
<details name="faq">
  <summary>Item 1</summary>
  <p>Contents...</p>
</details>
<details name="faq">
  <summary>Item 2</summary>
  <p>Contents...</p>
</details>
```

## 5. Focus Boundaries and Visibility

- **DO** use the global `inert` attribute for entire hidden sections (off-screen menus, background while custom modal is open) to remove them from tab flows and accessibility trees.
- **DO** pair `[inert]` with CSS (`pointer-events: none; opacity: 0.5`) to visually signify inactivity.
- **DO** rely on natural DOM order for sequential navigation. 

- **DON'T** use positive `tabindex` values (e.g., `1`, `2`). Use `0` to add element to tab flow, or `-1` for JS program focus.
- **DON'T** alter focus flow using CSS properties (`flex-flow: row-reverse`, `order`) without aligning the DOM structure.
- **DON'T** use `node.focus({ preventScroll: true })` without usability validation; it can hide the focused element off-screen.

### Code Example

```html
<!-- De-tabbing a background app shell while custom drawer is open -->
<main id="app-shell" inert>
  <a href="/">Dashboard</a>
</main>
<aside id="drawer">
  <button>Close</button>
</aside>
```

## 6. HTML APIs and Forms Grouping



### Guidelines

- **DO** group subsets of related fields using `<fieldset>` and `<legend>`.
- **DO** utilize the `form="form-id"` attribute to decouple inputs from the physical `<form>` tree.
- **DO** use `<datalist>` coupled with `<input list="id">` for lightweight auto-suggestions (note: visually unstylable and has screen-reader quirks).
- **DO** distinguish between `autocomplete="current-password"` and `autocomplete="new-password"`.

- **DON'T** use `autocomplete="off"` unless handling highly sensitive tracking tokens (violates standard password manager overrides). Use standard inputs `type="email"`, `type="tel"`.

### Code Example

```html
<form>
  <fieldset>
    <legend>Address Information</legend>
    <label for="city">City:</label>
    <input type="text" id="city" list="cities" autocomplete="address-level2">
    <datalist id="cities">
      <option value="New York">
      <option value="London">
    </datalist>
  </fieldset>
</form>
```

## 7. Templates and Progressive Custom Elements

### Guidelines

- **DO** ensure Custom Element names contain a dash (e.g., `<fancy-card>`).
- **DO** use `<template>` to hold inactive content that is cloned via JS (`node.cloneNode(true)`).
- **DO** use Declarative Shadow DOM (`<template shadowrootmode="open">`) inside Web Components to enable style scoping without blocking during Server Side Rendering.
- **DO** use `<slot>` inside templates to declare placeholders mapping to light DOM content.

- **DON'T** style light DOM content from inside the shadow boundary without `::slotted(selector)`. Use `part="name"` to expose internal nodes for custom external styling (`::part(name)`).

### Code Example

```html
<fancy-card>
  <template shadowrootmode="open">
    <style>
      :host { display: block; border: 1px solid #ccc; }
      ::slotted(span) { font-weight: bold; }
    </style>
    <div part="container">
      <slot name="title"></slot>
      <slot></slot>
    </div>
  </template>
  <span slot="title">Headline</span>
  <p>Body copy</p>
</fancy-card>
```

## 8. Native Media Elements

### Guidelines

- **DO** set `width` and `height` to prevent layout shifts (CLS) on `<video>` and `<audio>`.
- **DO** provide a `poster` image fallback for videos.
- **DO** include `<track>` for accessibility (subtitles/captions).
- **DO** ensure background videos are `muted`, `autoplay`, `loop`, and use `role="none"` or `aria-hidden="true"`.

- **DON'T** rely on JS for basic video controls if native `controls` attribute is sufficient.

### Code Example

```html
<video 
  controls 
  width="800" 
  height="450" 
  poster="poster.webp"
>
  <source src="intro.webm" type="video/webm">
  <source src="intro.mp4" type="video/mp4">
  <track src="caps.vtt" kind="captions" srclang="en" label="English">
</video>
```
```
