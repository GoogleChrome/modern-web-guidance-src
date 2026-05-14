# HTML Redundancy Mirror: Common Knowledge Guide

This is the HTML guidance I would treat as common, default knowledge when building modern web pages and applications. It reflects broadly shipped platform features and a few progressive-enhancement features that are reasonable to use with fallbacks.

## Document Foundation

Use standards mode with a minimal modern document shell:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Meaningful Page Title</title>
</head>
<body>
  <main>
    <!-- page content -->
  </main>
</body>
</html>
```

Always include `<!doctype html>`.

Set the document language with `html[lang]`.

Use UTF-8 with `<meta charset="utf-8">`.

Use the responsive viewport meta tag.

Put meaningful, unique text in `<title>`.

Use valid nesting and close elements where required.

Avoid obsolete presentational markup such as `<font>`, `<center>`, `bgcolor`, `border`, and layout tables.

Prefer semantic HTML over generic `<div>` and `<span>` elements.

Use lowercase tag and attribute names by convention.

Quote attribute values consistently.

Avoid duplicate `id` values.

Use `class` for reusable styling hooks and `id` for unique anchors or relationships.

Keep HTML responsible for structure and meaning, CSS for presentation, and JavaScript for behavior.

## Semantic Structure

Use landmark elements to describe page structure:

```html
<header>
<nav aria-label="Primary">
<main>
<section>
<article>
<aside>
<footer>
```

Use exactly one primary `<main>` per page or view.

Use `<header>` and `<footer>` relative to the page or a sectioning element.

Use `<article>` for self-contained content that could stand alone.

Use `<section>` for thematically grouped content, usually with a heading.

Use `<aside>` for tangential or complementary content.

Use `<nav>` only for major navigation groups.

Avoid wrapping everything in anonymous `<div>`s when a semantic element exists.

Do not use headings for visual sizing only.

Maintain logical heading order:

```html
<h1>Page Topic</h1>
<h2>Section</h2>
<h3>Subsection</h3>
```

Use one clear page-level `<h1>` in typical documents.

Do not skip heading levels merely for styling.

Use lists for lists:

```html
<ul>
  <li>Item</li>
</ul>

<ol>
  <li>Step</li>
</ol>

<dl>
  <dt>Term</dt>
  <dd>Description</dd>
</dl>
```

Use `<p>` for paragraphs, not line breaks.

Use `<br>` only for meaningful line breaks, such as addresses or poetry.

Use `<hr>` for thematic breaks, not decorative lines.

Use `<blockquote>` for extended quotations and `<q>` for inline quotations where appropriate.

Use `<cite>` for the title of a cited work, not the quoted person’s name unless that is the cited work.

Use `<address>` for contact information related to the nearest article or page.

## Text-Level Semantics

Use semantic inline elements:

```html
<strong>important</strong>
<em>emphasized</em>
<small>side comment</small>
<mark>highlighted</mark>
<code>inlineCode()</code>
<kbd>Ctrl</kbd>
<samp>program output</samp>
<var>x</var>
<abbr title="HyperText Markup Language">HTML</abbr>
<time datetime="2026-05-13">May 13, 2026</time>
```

Use `<strong>` for importance, not just bold styling.

Use `<em>` for stress emphasis, not just italics.

Use `<b>` and `<i>` only when their non-emphasis HTML meanings fit, such as keywords, product names, idiomatic terms, or alternate voice.

Use `<s>` for no-longer-accurate text.

Use `<del>` and `<ins>` for document edits.

Use `<sub>` and `<sup>` only for true subscript/superscript semantics.

Use machine-readable dates with `<time datetime="">`.

## Links

Use real links for navigation:

```html
<a href="/account">Account</a>
```

Use buttons for actions:

```html
<button type="button">Save</button>
```

Do not use `<a href="#">` as a button.

Do not use clickable `<div>`s when `<button>` or `<a>` is correct.

Use descriptive link text. Avoid “click here”.

Use same-page anchors with valid target IDs:

```html
<a href="#settings">Settings</a>
<section id="settings">...</section>
```

For external links that open a new tab:

```html
<a href="https://example.com" target="_blank" rel="noopener noreferrer">
  External site
</a>
```

Prefer not to force new tabs unless there is a strong product reason.

Use `download` only for same-origin or intentionally downloadable resources.

Use `mailto:` and `tel:` links where appropriate.

## Images and Media

Use images with meaningful `alt` text:

```html
<img src="/chart.png" alt="Quarterly revenue increased from $2M to $3M">
```

Use empty alt text for decorative images:

```html
<img src="/ornament.svg" alt="">
```

Do not repeat nearby captions verbatim in `alt`.

Use `<figure>` and `<figcaption>` for captioned media:

```html
<figure>
  <img src="/diagram.png" alt="System architecture diagram">
  <figcaption>Data flow between services.</figcaption>
</figure>
```

Set image dimensions to reduce layout shift:

```html
<img src="/photo.jpg" width="800" height="600" alt="...">
```

Use responsive images:

```html
<img
  src="small.jpg"
  srcset="small.jpg 480w, medium.jpg 960w, large.jpg 1440w"
  sizes="(max-width: 600px) 100vw, 600px"
  alt="...">
```

Use `<picture>` for art direction or format selection:

```html
<picture>
  <source srcset="image.avif" type="image/avif">
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="...">
</picture>
```

Use lazy loading for non-critical below-the-fold images:

```html
<img src="/gallery.jpg" loading="lazy" alt="...">
```

Use `decoding="async"` for images that do not need synchronous decoding.

Use `fetchpriority="high"` sparingly for the likely LCP image.

Use SVG directly when it needs styling, scripting, or accessibility integration.

Use external SVG/image files for cacheable static assets.

For icons, ensure accessible names when interactive and hide decorative icons from assistive tech.

Use `<video>` and `<audio>` with controls unless custom controls are fully accessible:

```html
<video controls width="640" poster="/poster.jpg">
  <source src="/movie.webm" type="video/webm">
  <source src="/movie.mp4" type="video/mp4">
  <track kind="captions" src="/captions.vtt" srclang="en" label="English">
</video>
```

Provide captions for meaningful video with audio.

Avoid autoplaying media with sound.

Use `muted playsinline` for mobile-friendly silent autoplay where appropriate.

## Forms

Use native form controls first.

Associate every input with a label:

```html
<label for="email">Email</label>
<input id="email" name="email" type="email" autocomplete="email">
```

Implicit labels are also valid:

```html
<label>
  Email
  <input name="email" type="email">
</label>
```

Use correct input types:

```html
<input type="text">
<input type="email">
<input type="url">
<input type="tel">
<input type="search">
<input type="password">
<input type="number">
<input type="date">
<input type="time">
<input type="datetime-local">
<input type="month">
<input type="week">
<input type="color">
<input type="file">
<input type="checkbox">
<input type="radio">
<input type="range">
```

Use `textarea` for multiline text.

Use `select` for constrained choices when native dropdown behavior is acceptable.

Use radio buttons for one-of-many choices.

Use checkboxes for independent boolean choices.

Group related controls with `<fieldset>` and `<legend>`:

```html
<fieldset>
  <legend>Notification preferences</legend>
  <label><input type="checkbox" name="email_updates"> Email updates</label>
</fieldset>
```

Use `name` attributes for submitted form data.

Use `value` intentionally, especially for radios, checkboxes, and submit buttons.

Use `button`, not clickable text, for form actions:

```html
<button type="submit">Create account</button>
<button type="button">Cancel</button>
<button type="reset">Reset</button>
```

Set button `type` explicitly, especially inside forms.

Use native validation attributes:

```html
<input required minlength="8" maxlength="64">
<input type="email" required>
<input type="number" min="1" max="10" step="1">
<input pattern="[0-9]{5}" inputmode="numeric">
```

Use `autocomplete` tokens for better UX and password manager support:

```html
<input autocomplete="name">
<input autocomplete="email">
<input autocomplete="username">
<input autocomplete="current-password">
<input autocomplete="new-password">
<input autocomplete="one-time-code">
<input autocomplete="street-address">
<input autocomplete="postal-code">
```

Use `inputmode` to hint mobile keyboards.

Use `enterkeyhint` to hint virtual keyboard action labels.

Use `placeholder` only as an example or hint, not as a replacement for labels.

Use `aria-describedby` to connect help or error text:

```html
<label for="password">Password</label>
<input id="password" aria-describedby="password-help">
<p id="password-help">Use at least 12 characters.</p>
```

Expose validation errors clearly in text near the field.

Use `disabled` when a control should not be interactive or submitted.

Use `readonly` when a value should be visible and submitted but not editable.

Use `hidden` inputs only for non-sensitive data; never trust hidden input values on the server.

Use `form`, `formaction`, `formenctype`, `formmethod`, `formnovalidate`, and `formtarget` when a submit button needs to override form behavior.

Use `enctype="multipart/form-data"` for file uploads.

Use `accept` and `multiple` on file inputs where appropriate.

Use `capture` cautiously for camera/microphone capture hints on mobile.

## Tables

Use tables for tabular data, not layout.

Use proper table structure:

```html
<table>
  <caption>Monthly revenue</caption>
  <thead>
    <tr>
      <th scope="col">Month</th>
      <th scope="col">Revenue</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">January</th>
      <td>$10,000</td>
    </tr>
  </tbody>
</table>
```

Use `<caption>` for table title or summary.

Use `<th>` for headers and `scope` for simple relationships.

Use `headers` and `id` for complex tables when needed.

Use `<thead>`, `<tbody>`, and `<tfoot>` to clarify structure.

Avoid empty cells when a clear value such as “Not applicable” is better.

## Accessibility Defaults

Prefer native semantic elements because they carry built-in roles, states, keyboard behavior, and accessibility mappings.

Use ARIA only when native HTML cannot express the semantics.

Do not add redundant roles:

```html
<!-- unnecessary -->
<button role="button">
```

Do not override native semantics incorrectly.

Ensure all interactive elements are keyboard accessible.

Preserve visible focus indicators.

Use logical DOM order that matches reading and tab order.

Avoid positive `tabindex` values.

Use `tabindex="0"` only to add normally non-focusable custom elements into the tab order when truly needed.

Use `tabindex="-1"` for programmatic focus targets.

Use `aria-label`, `aria-labelledby`, or visible text to provide accessible names for controls.

Prefer visible labels over invisible labels.

Use `aria-hidden="true"` only for content that should be ignored by assistive technology.

Never put focusable content inside an `aria-hidden` subtree.

Use `hidden`, `display: none`, or `inert` for content that should not be reachable.

Use `inert` for disabled page regions, such as background content behind a modal dialog.

Use live regions sparingly:

```html
<div aria-live="polite"></div>
<div role="alert"></div>
```

Use `aria-current="page"` for the current navigation item.

Use `aria-expanded` and `aria-controls` for disclosure buttons.

Use `aria-pressed` for toggle buttons.

Use `aria-selected` only in widgets where that state is appropriate, such as tabs or listboxes.

Use `aria-invalid` for invalid form fields when errors are shown.

Use sufficient text alternatives for images, icons, media, and controls.

Do not rely on color alone to convey meaning.

Ensure text content is selectable and zoomable.

Use skip links for pages with repeated navigation:

```html
<a href="#main" class="skip-link">Skip to content</a>
<main id="main">...</main>
```

## Dialogs, Popovers, and Disclosure

Use native `<dialog>` for modal or non-modal dialogs where appropriate:

```html
<dialog id="confirm-dialog">
  <form method="dialog">
    <p>Delete this item?</p>
    <button value="cancel">Cancel</button>
    <button value="confirm">Delete</button>
  </form>
</dialog>
```

Use `showModal()` for modal dialogs and `close()` to close.

Ensure dialogs have a clear accessible name.

Return focus sensibly after closing dialogs.

Use `method="dialog"` for simple dialog form submission.

Use the Popover API as progressive enhancement for lightweight overlays where supported:

```html
<button popovertarget="menu">Menu</button>
<div id="menu" popover>
  ...
</div>
```

Use popovers for menus, teaching UI, lightweight panels, and non-modal overlays, not for complex modal workflows.

Use `<details>` and `<summary>` for native disclosure widgets:

```html
<details>
  <summary>Advanced settings</summary>
  ...
</details>
```

Keep `<summary>` concise and descriptive.

Do not use `<details>` for accordions if you need strict one-open-at-a-time behavior without additional scripting.

## Metadata, SEO, and Social Sharing

Use meaningful document titles.

Use a concise meta description when the page is indexable:

```html
<meta name="description" content="...">
```

Use canonical URLs where duplicate URLs may exist:

```html
<link rel="canonical" href="https://example.com/page">
```

Use robots metadata intentionally:

```html
<meta name="robots" content="noindex">
```

Use Open Graph metadata for rich sharing:

```html
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:image" content="https://example.com/image.jpg">
<meta property="og:url" content="https://example.com/page">
<meta property="og:type" content="website">
```

Use Twitter/X card metadata when needed:

```html
<meta name="twitter:card" content="summary_large_image">
```

Use structured data such as JSON-LD when it accurately represents page content:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "..."
}
</script>
```

Do not add misleading structured data.

Set favicons and app icons:

```html
<link rel="icon" href="/favicon.ico">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

Use `theme-color` where appropriate:

```html
<meta name="theme-color" content="#ffffff">
```

## Scripts

Prefer external scripts for maintainability and caching:

```html
<script src="/app.js" type="module"></script>
```

Use `type="module"` for modern JavaScript. Module scripts are deferred by default.

Use `defer` for classic scripts that should run after parsing:

```html
<script src="/legacy.js" defer></script>
```

Use `async` only for independent scripts where execution order does not matter.

Place critical blocking scripts only when absolutely necessary.

Avoid inline event handlers:

```html
<!-- avoid -->
<button onclick="save()">
```

Prefer unobtrusive JavaScript:

```js
document.querySelector("button").addEventListener("click", save);
```

Use `nomodule` only when serving legacy fallbacks:

```html
<script type="module" src="/modern.js"></script>
<script nomodule src="/legacy.js"></script>
```

Use import maps as progressive enhancement where appropriate:

```html
<script type="importmap">
{
  "imports": {
    "lib": "/vendor/lib.js"
  }
}
</script>
```

Use Subresource Integrity for third-party scripts and styles:

```html
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-..."
  crossorigin="anonymous"></script>
```

Avoid third-party scripts unless necessary.

Load analytics, ads, and embeds with care because they affect performance, privacy, and security.

## Stylesheets and CSS Hooks

Use external stylesheets:

```html
<link rel="stylesheet" href="/styles.css">
```

Keep class names meaningful and stable.

Avoid styling by fragile DOM depth selectors when reusable classes would be clearer.

Use `data-*` attributes for private application metadata:

```html
<button data-action="delete" data-id="123">Delete</button>
```

Do not encode large or sensitive data in HTML attributes.

Use custom elements only when component encapsulation or interoperability justifies them.

Use `part` and `exportparts` when exposing shadow DOM styling hooks.

Use `slot` for declarative composition in web components.

## Resource Loading and Performance

Keep HTML small and meaningful.

Prioritize critical content in the initial document.

Avoid excessive DOM size and deeply nested structures.

Use preload for critical assets discovered too late:

```html
<link rel="preload" href="/font.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/hero.avif" as="image">
```

Use preconnect for critical cross-origin connections:

```html
<link rel="preconnect" href="https://fonts.example.com" crossorigin>
```

Use DNS prefetch for lower-priority early resolution:

```html
<link rel="dns-prefetch" href="//cdn.example.com">
```

Use modulepreload for important module graphs:

```html
<link rel="modulepreload" href="/app.js">
```

Do not overuse preload; it can compete with more important resources.

Use native lazy loading for below-the-fold images and iframes:

```html
<iframe src="..." loading="lazy"></iframe>
```

Set dimensions or aspect-ratio for images, videos, iframes, and embeds to reduce layout shift.

Use modern image formats such as AVIF and WebP with fallbacks.

Compress and cache static assets.

Avoid render-blocking resources where possible.

Inline only truly critical CSS, and avoid large inline payloads.

Avoid large hydration payloads when static HTML would work.

Prefer server-rendered or static semantic HTML for content-heavy pages.

## Security

Escape untrusted text before inserting it into HTML.

Do not concatenate untrusted strings into HTML.

Avoid `innerHTML` with untrusted content.

Use DOM APIs such as `textContent`, `setAttribute`, and element creation for untrusted values.

Sanitize trusted-rich HTML with a well-maintained sanitizer.

Use Content Security Policy:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'">
```

Prefer HTTP headers for CSP over meta tags when possible.

Avoid inline scripts and styles when using strict CSP.

Use nonces or hashes for necessary inline scripts.

Use `rel="noopener noreferrer"` for untrusted `target="_blank"` links.

Use sandboxed iframes for untrusted embedded content:

```html
<iframe src="..." sandbox></iframe>
```

Add only the sandbox permissions actually needed.

Use `allow` on iframes to grant specific features:

```html
<iframe src="..." allow="fullscreen; clipboard-write"></iframe>
```

Never put secrets in HTML, data attributes, comments, or hidden inputs.

Treat client-side validation as UX only; validate again on the server.

Use HTTPS for production.

Avoid mixed content.

## Iframes and Embeds

Use `<iframe>` only when isolation or external embedding is required.

Always provide a `title` for iframes:

```html
<iframe title="Map of office location" src="..."></iframe>
```

Use `loading="lazy"` for non-critical iframes.

Set explicit dimensions or responsive containers.

Use `sandbox` for untrusted content.

Use `allowfullscreen` or `allow="fullscreen"` where needed.

Avoid embedding heavy third-party widgets on critical pages unless necessary.

## Internationalization

Set the correct document language.

Use `lang` on specific passages in another language:

```html
<p lang="fr">Bonjour</p>
```

Use `dir="rtl"` for right-to-left content where needed.

Prefer logical document order over visual order.

Use Unicode text directly with UTF-8.

Use `<bdi>` for isolated bidirectional text such as usernames:

```html
<bdi>username</bdi>
```

Use `<bdo>` only when intentionally overriding text direction.

Use locale-appropriate date, number, and currency formatting in displayed content.

Avoid hardcoded assumptions about name order, address shape, phone format, and text length.

## Custom Data and Declarative Hooks

Use `data-*` attributes for simple, non-sensitive metadata:

```html
<li data-user-id="42"></li>
```

Access via `element.dataset`.

Use ARIA attributes for accessibility state, not as generic state storage.

Use classes for styling state when CSS needs them.

Use custom attributes only when defining custom elements or when there is a clear convention.

## Web Components

Use custom elements for reusable browser-native components:

```js
customElements.define("user-card", class extends HTMLElement {
  connectedCallback() {
    this.textContent = "User";
  }
});
```

Use hyphenated names for custom elements.

Use shadow DOM for encapsulation when appropriate.

Use slots for light DOM composition:

```html
<template id="card-template">
  <article>
    <slot name="title"></slot>
    <slot></slot>
  </article>
</template>
```

Use `<template>` for inert reusable markup.

Use declarative shadow DOM as progressive enhancement where server-rendered shadow roots are useful:

```html
<template shadowrootmode="open">
  ...
</template>
```

Provide fallbacks or light DOM content when needed.

Do not use web components where a simple semantic element is enough.

## Progressive Enhancement

Start with functional HTML.

Layer CSS for presentation.

Layer JavaScript for richer behavior.

Ensure core content and critical actions remain understandable when JavaScript fails, unless the product is inherently JavaScript-only.

Use feature detection instead of browser sniffing.

Use cutting-edge features when unsupported browsers still get a usable fallback.

Good progressive-enhancement candidates include:

```html
<dialog>
<div popover>
<details>
<input type="date">
<input type="color">
loading="lazy"
fetchpriority
inert
```

For new form controls, expect inconsistent UI and provide validation or alternate input paths when necessary.

## Clean Code Principles for HTML

Make the DOM reflect the content model.

Use the simplest element that accurately describes the content or control.

Prefer native behavior over custom reimplementation.

Keep markup readable and consistently indented.

Avoid excessive wrapper elements.

Avoid deeply nested layouts.

Avoid mixing unrelated responsibilities in one element.

Avoid magic data attributes without clear naming.

Use consistent naming conventions for classes, IDs, and data attributes.

Keep components small enough that their structure is understandable.

Remove dead markup, unused attributes, and commented-out blocks.

Do not duplicate large chunks of markup if a template, component, or server partial is available.

Do not prematurely abstract one-off markup.

Make repeated structures consistent.

Keep accessible names, visible labels, and test selectors stable.

Prefer content-driven markup over layout-driven markup.

Do not encode visual order in a way that breaks reading order.

Validate assumptions with browser dev tools, accessibility tooling, and HTML validators when appropriate.

## Common HTML APIs and DOM Usage

Use DOM selection APIs:

```js
document.querySelector(".item");
document.querySelectorAll(".item");
document.getElementById("main");
```

Use element creation APIs:

```js
const button = document.createElement("button");
button.type = "button";
button.textContent = "Save";
```

Use `textContent` for text.

Use `classList` for classes:

```js
element.classList.add("is-active");
element.classList.toggle("is-open", open);
```

Use `dataset` for `data-*` values:

```js
const id = element.dataset.id;
```

Use event listeners:

```js
element.addEventListener("click", event => {});
```

Use event delegation for repeated dynamic elements:

```js
list.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
});
```

Use `closest()` for ancestor matching.

Use `matches()` for selector checks.

Use `append`, `prepend`, `before`, `after`, `replaceWith`, and `remove`.

Use `template.content.cloneNode(true)` for template cloning.

Use `DocumentFragment` for batching DOM creation when useful.

Use `hidden` for simple visibility state that should also affect accessibility tree exposure.

Use `focus()` intentionally after navigation, modal open/close, validation errors, or dynamic content changes.

Use `requestSubmit()` to submit forms through normal validation and submit handling.

Use `FormData` for form serialization:

```js
const data = new FormData(form);
```

Use the Constraint Validation API where useful:

```js
input.validity.valid;
input.setCustomValidity("Custom error");
form.reportValidity();
```

Use `URL` and `URLSearchParams` for URL manipulation.

Use `MutationObserver`, `ResizeObserver`, and `IntersectionObserver` when observation is genuinely needed.

Use `IntersectionObserver` for visibility-triggered behavior rather than scroll polling.

## Validation and Testing Expectations

Run HTML through validation for content-heavy or reusable templates.

Check keyboard navigation.

Check screen reader names and roles with accessibility inspection tools.

Check responsive behavior at common viewport widths.

Check that images have appropriate alt text.

Check that forms are labeled and errors are announced or discoverable.

Check that links go somewhere and buttons do something.

Check that no interactive control is unreachable by keyboard.

Check that dialogs trap or manage focus appropriately when modal.

Check that page title, landmarks, headings, and language are correct.

Check performance basics: image dimensions, lazy loading, blocking resources, and third-party payloads.

## Default Anti-Patterns

Avoid layout tables.

Avoid clickable non-interactive elements.

Avoid missing labels on inputs.

Avoid placeholder-only form labels.

Avoid empty links and buttons.

Avoid `href="javascript:void(0)"`.

Avoid positive `tabindex`.

Avoid removing focus outlines without replacement.

Avoid inaccessible custom selects, menus, tabs, and modals.

Avoid unlabeled icon buttons.

Avoid images of text when real text can be used.

Avoid putting important text only in CSS background images.

Avoid autoplaying audio or video with sound.

Avoid massive DOM trees for simple interfaces.

Avoid untrusted `innerHTML`.

Avoid relying on client-side validation for security.

Avoid excessive ARIA.

Avoid presentational markup in HTML.

Avoid forcing new tabs unnecessarily.

Avoid using headings out of order for visual style.

Avoid using `<section>` without a meaningful section concept.

Avoid leaving generated or framework boilerplate titles and metadata in production.
