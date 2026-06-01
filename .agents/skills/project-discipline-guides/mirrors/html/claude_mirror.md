# HTML Best Practices, Syntax, and APIs — Common Knowledge Guide

## 1. Document Structure & Boilerplate

### Minimal valid HTML5 document
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page Title</title>
</head>
<body>
  <!-- content -->
</body>
</html>
```

### Required / strongly recommended elements
- `<!DOCTYPE html>` — must be the very first line; triggers standards mode.
- `<html lang="...">` — always set `lang` (and `dir` when relevant) for accessibility, screen readers, hyphenation, and translation tools.
- `<meta charset="UTF-8">` — must be in the first 1024 bytes; place as the first child of `<head>`.
- `<meta name="viewport" content="width=device-width, initial-scale=1">` — required for responsive design on mobile.
- `<title>` — required; unique per page; describes the page concisely (~50–60 chars).

### Optional but conventional `<head>` content
- `<meta name="description" content="...">` — used for SEO snippets.
- `<link rel="canonical" href="...">` — canonicalize URL variants.
- `<link rel="icon" href="/favicon.ico">` and `<link rel="apple-touch-icon" href="...">`
- Open Graph / Twitter Card meta tags for social previews.
- `<meta name="theme-color" content="#...">` — affects browser UI.
- `<link rel="manifest" href="/manifest.webmanifest">` — for PWAs.

## 2. Semantic HTML

Use semantic elements over generic `<div>`/`<span>` whenever they convey meaning.

### Sectioning & landmark elements
- `<header>` — introductory content for a page or section.
- `<nav>` — primary navigation links.
- `<main>` — primary content of the page; only one per page; should not be nested inside `<article>`, `<aside>`, `<header>`, `<footer>`, or `<nav>`.
- `<article>` — self-contained, independently distributable content (blog post, comment).
- `<section>` — thematic grouping; should typically have a heading.
- `<aside>` — tangentially related content (sidebar, pull quote).
- `<footer>` — footer for nearest sectioning ancestor.
- `<address>` — contact info for the nearest `<article>`/`<body>`.

### Headings
- One `<h1>` per page (or per top-level sectioning context).
- Don't skip heading levels (`<h1>` → `<h3>` is wrong); they form an outline.
- Don't choose heading level for visual size — use CSS for that.

### Text-level semantics
- `<strong>` (importance) vs `<b>` (stylistic offset, e.g., keywords).
- `<em>` (stress emphasis) vs `<i>` (alternate voice/mood, e.g., foreign term).
- `<mark>` — highlighted/marked text relevant to current context.
- `<small>` — side comments, fine print.
- `<code>`, `<kbd>`, `<samp>`, `<var>` — for code, keyboard input, sample output, variables.
- `<abbr title="...">` — abbreviations with expansion in `title`.
- `<cite>` — title of a referenced work.
- `<q>` — short inline quote (browsers add quote marks); `<blockquote cite="...">` for longer quotes.
- `<time datetime="2026-05-13">May 13, 2026</time>` — machine-readable time/date.
- `<dfn>` — defining instance of a term.
- `<s>` — no longer accurate or relevant; `<del>`/`<ins>` — removed/added in an edited document.
- `<ruby>`, `<rt>`, `<rp>` — East Asian ruby annotations.

### Lists
- `<ul>`, `<ol>`, `<li>` — unordered/ordered lists.
- `<ol reversed start="N" type="A|a|I|i|1">` — attributes for ordered lists.
- `<dl>`/`<dt>`/`<dd>` — description lists (term/definition pairs).

### Figures
```html
<figure>
  <img src="chart.png" alt="Quarterly revenue chart">
  <figcaption>Q1 2026 revenue grew 12%.</figcaption>
</figure>
```

### Details / disclosure widget
```html
<details>
  <summary>More info</summary>
  <p>Hidden content revealed on toggle.</p>
</details>
```
- Native disclosure widget; supports `open` attribute and `toggle` event.
- `name` attribute (newer) groups `<details>` to behave like an accordion (only one open at a time).

### Dialog
```html
<dialog id="d">
  <form method="dialog">
    <p>Modal content</p>
    <button>Close</button>
  </form>
</dialog>
<script>
  document.getElementById('d').showModal(); // or .show() for non-modal
</script>
```
- Native modal/non-modal dialog. Supports `::backdrop` styling, focus trapping, `Esc` to close (modal), and `closedby` attribute (newer).
- Forms with `method="dialog"` close the dialog and return value via `returnValue`.

## 3. Links & Navigation

### Anchor element
```html
<a href="https://example.com" target="_blank" rel="noopener noreferrer">External</a>
<a href="/docs/page#section">Internal</a>
<a href="mailto:hello@example.com?subject=Hi">Email</a>
<a href="tel:+15551234567">Call</a>
<a href="#main-content">Skip to main</a>
```

- Always use `rel="noopener"` (and historically `noreferrer`) with `target="_blank"` to prevent reverse-tabnabbing — modern browsers default to `noopener` but include explicitly for safety.
- Link text should be descriptive — avoid "click here", "read more"; the link text alone should make sense out of context.
- `download` attribute hints to the browser to download rather than navigate; can specify filename.
- `ping` for tracking pings on activation.
- `referrerpolicy` controls Referer header on outbound navigation.
- Skip-to-content links improve keyboard navigation accessibility.

## 4. Images & Media

### `<img>`
```html
<img src="hero.jpg" alt="A description of the image"
     width="800" height="600"
     loading="lazy" decoding="async" fetchpriority="high">
```

- **Always** include `alt`. Empty `alt=""` for decorative images (screen readers skip).
- Set `width` and `height` (or aspect-ratio CSS) to prevent layout shift (CLS).
- `loading="lazy"` — defer offscreen images.
- `decoding="async"` — non-blocking image decode.
- `fetchpriority="high|low|auto"` — prioritization hint.

### Responsive images
```html
<img src="small.jpg"
     srcset="small.jpg 480w, medium.jpg 1024w, large.jpg 2000w"
     sizes="(max-width: 600px) 100vw, 50vw"
     alt="...">
```

### `<picture>` for art direction / format fallbacks
```html
<picture>
  <source type="image/avif" srcset="img.avif">
  <source type="image/webp" srcset="img.webp">
  <img src="img.jpg" alt="..." width="800" height="600">
</picture>
```

### `<video>` / `<audio>`
```html
<video controls preload="metadata" poster="poster.jpg" width="640" height="360"
       playsinline muted>
  <source src="video.webm" type="video/webm">
  <source src="video.mp4" type="video/mp4">
  <track kind="captions" src="captions.vtt" srclang="en" label="English" default>
  Your browser does not support video.
</video>
```
- Provide multiple `<source>` for format fallbacks.
- Always provide captions/subtitles via `<track>` for accessibility.
- `playsinline` for iOS inline playback; `muted` required for autoplay in most browsers.
- `preload="none|metadata|auto"` — controls preload strategy.

## 5. Forms

### Basic form structure
```html
<form action="/submit" method="post" enctype="multipart/form-data" novalidate>
  <fieldset>
    <legend>Account info</legend>
    <label for="email">Email</label>
    <input id="email" name="email" type="email" required autocomplete="email">
  </fieldset>
  <button type="submit">Submit</button>
</form>
```

### Input types (use appropriate ones for mobile keyboards & validation)
`text`, `email`, `password`, `tel`, `url`, `search`, `number`, `range`, `date`, `time`, `datetime-local`, `month`, `week`, `color`, `file`, `checkbox`, `radio`, `hidden`, `submit`, `reset`, `button`.

### Important attributes
- `required`, `disabled`, `readonly`, `multiple`.
- `min`, `max`, `step`, `minlength`, `maxlength`, `pattern`.
- `placeholder` — hint only; **never** a substitute for `<label>`.
- `autocomplete` — use specific tokens (`email`, `current-password`, `new-password`, `one-time-code`, `cc-number`, `street-address`, etc.) to enable browser/password-manager autofill.
- `inputmode` — controls on-screen keyboard (`numeric`, `decimal`, `tel`, `email`, `url`, `search`).
- `enterkeyhint` — virtual keyboard's Enter key label (`go`, `done`, `next`, `search`, `send`).
- `name` — required for form submission inclusion.
- `form` attribute — associate input with form by ID, even outside it.
- `formaction`, `formmethod`, `formenctype`, `formnovalidate`, `formtarget` on submit buttons override the form's.

### Labels — always associate
```html
<label for="username">Username</label>
<input id="username" name="username">
<!-- or wrapping -->
<label>Username <input name="username"></label>
```

### Other form controls
- `<select>` with `<option>`, `<optgroup>`. `multiple`, `size` for list select.
- `<textarea rows="..." cols="..." wrap="hard|soft">`
- `<datalist id="x">` paired with `<input list="x">` for autocomplete suggestions.
- `<output for="a b" name="result">` for form computation results.
- `<progress value="" max="">` and `<meter min max low high optimum value>` — progress and gauge.
- `<button type="button|submit|reset">` — **always** specify `type` to avoid accidental form submissions.

### Validation
- Use built-in constraints (`required`, `pattern`, `min/max`, `type=email|url`).
- `:valid`, `:invalid`, `:user-invalid`, `:user-valid`, `:required`, `:optional` CSS pseudo-classes.
- Constraint Validation API: `element.checkValidity()`, `reportValidity()`, `setCustomValidity()`, `validity` property.

## 6. Tables

```html
<table>
  <caption>Quarterly Revenue</caption>
  <colgroup>
    <col span="1" style="background:#f6f6f6">
    <col span="2">
  </colgroup>
  <thead>
    <tr><th scope="col">Quarter</th><th scope="col">Revenue</th><th scope="col">Growth</th></tr>
  </thead>
  <tbody>
    <tr><th scope="row">Q1</th><td>$1M</td><td>12%</td></tr>
  </tbody>
  <tfoot>
    <tr><th scope="row">Total</th><td>$4M</td><td>—</td></tr>
  </tfoot>
</table>
```

- Use `<table>` for **tabular data only** — never for layout.
- Always use `<caption>` for tables.
- Use `scope="col|row"` on `<th>` for accessibility.
- Use `<thead>`, `<tbody>`, `<tfoot>` to structure rows semantically.
- Use `headers="id1 id2"` for complex tables to associate cells with headers explicitly.

## 7. Accessibility (a11y)

### Core principles
- Prefer native HTML elements over ARIA (`<button>` vs `<div role="button">`).
- "No ARIA is better than bad ARIA."
- Maintain a logical DOM order; don't rely on `tabindex` for ordering.
- Visible focus indicators are required (don't `outline: none` without a replacement).

### ARIA basics
- `role="..."` — only when no semantic element exists.
- `aria-label`, `aria-labelledby`, `aria-describedby` — accessible names/descriptions.
- `aria-hidden="true"` — hide from assistive tech (don't apply to focusable elements).
- `aria-expanded`, `aria-controls`, `aria-current`, `aria-pressed`, `aria-selected`, `aria-checked` — widget state.
- `aria-live="polite|assertive"` and `role="status|alert"` — live region announcements.
- `aria-busy`, `aria-disabled`, `aria-invalid`, `aria-required` — state.
- Landmark roles: `banner`, `navigation`, `main`, `complementary`, `contentinfo`, `search`, `form` (largely covered by HTML5 sectioning elements).

### Focus management
- `tabindex="0"` — include in tab order.
- `tabindex="-1"` — focusable programmatically but not in tab order.
- Avoid `tabindex` > 0 (overrides natural order, hard to maintain).
- Use `inert` attribute to make a subtree non-interactive and hidden from a11y tree (great for modal backgrounds).
- Use `:focus-visible` in CSS for keyboard-only focus rings.

### Other a11y attributes
- `autofocus` — sparingly, only when expected.
- `lang` on subtree elements when language differs from page.
- `hidden` attribute — fully hides element (equivalent to `display: none`); also `hidden="until-found"` allows in-page search to reveal it.
- Provide text alternatives for all non-text content.
- Sufficient color contrast (WCAG AA: 4.5:1 normal text, 3:1 large text).
- Don't rely on color alone to convey information.
- Respect `prefers-reduced-motion` for animations.

## 8. Scripts & Stylesheets

### Loading order
```html
<link rel="stylesheet" href="styles.css">
<script src="app.js" defer></script>
<script src="module.js" type="module"></script>
```

- `defer` — download in parallel, execute in order after HTML parsing, before `DOMContentLoaded`.
- `async` — download in parallel, execute as soon as available (order not guaranteed).
- `type="module"` — implicitly deferred, supports `import`/`export`, runs in strict mode.
- `nomodule` — fallback for legacy browsers.
- Place `<script>` in `<head>` with `defer`/`module`, or at end of `<body>` for legacy scripts.

### Resource hints
- `<link rel="preload" as="font|script|style|image" href="..." crossorigin>`
- `<link rel="prefetch" href="...">` — low-priority fetch for future navigation.
- `<link rel="preconnect" href="https://...">` — early DNS/TCP/TLS handshake.
- `<link rel="dns-prefetch" href="https://...">` — DNS only.
- `<link rel="modulepreload" href="...">` — for ES modules.

### CSP & security
- `<meta http-equiv="Content-Security-Policy" content="...">` (prefer HTTP header).
- `integrity="sha384-..."` and `crossorigin` on `<script>`/`<link>` for SRI on third-party assets.

## 9. Embedded Content

### `<iframe>`
```html
<iframe src="https://example.com" title="Description"
        sandbox="allow-scripts allow-same-origin"
        loading="lazy" referrerpolicy="no-referrer"
        allow="camera; microphone; fullscreen"
        width="600" height="400"></iframe>
```
- `title` is required for accessibility.
- Use `sandbox` to restrict iframe capabilities.
- `loading="lazy"` for offscreen iframes.
- `allow` for Permissions Policy.

### `<canvas>` / `<svg>` / `<math>` — inline graphics
- `<canvas>` — bitmap drawing surface (2D, WebGL, WebGPU contexts via JS).
- `<svg>` — scalable vector graphics, fully part of DOM, styleable with CSS.
- `<math>` — MathML for mathematical notation.

## 10. Microdata, Metadata & SEO

- Use semantic HTML first; supplement with structured data (`<script type="application/ld+json">` is the modern preferred form).
- `<meta name="robots" content="index,follow|noindex|nofollow">`
- `<link rel="alternate" hreflang="es" href="...">` for internationalization.
- `<link rel="alternate" type="application/rss+xml" href="...">` for feeds.

## 11. New / Modern Features (Shipping Across Browsers)

### Popover API (shipped across all major browsers)
```html
<button popovertarget="menu">Menu</button>
<div id="menu" popover>Popover content</div>
```
- Built-in light dismiss, focus management, top-layer rendering.
- `popover="auto"` (default; light-dismiss) vs `popover="manual"`.
- Pair with `::backdrop`, `:popover-open` pseudo-class.

### Anchor positioning (newer; progressive enhancement)
- `anchor-name` and `position-anchor` CSS for tethering popovers/tooltips.

### Lazy loading
- `loading="lazy"` on `<img>` and `<iframe>`.

### `<input type="search">` — `search` events, clear button.

### `inputmode` & `enterkeyhint` for mobile UX (shipped widely).

### `decoding="async"` and `fetchpriority="high|low|auto"` on `<img>`/`<link>`/`<script>`.

### `<dialog>` and `showModal()` (shipped everywhere).

### `<details name="group">` — exclusive accordion behavior (newer, broadly shipped).

### Customizable `<select>` (`<selectedcontent>`, in-page popover) — newer, progressive enhancement.

## 12. Web Components / Custom Elements

- Custom element names must contain a hyphen: `<my-component>`.
- `<template>` — inert HTML fragment, not rendered until cloned.
- `<slot>` — placeholder in shadow DOM for distributing children.
- Declarative shadow DOM with `<template shadowrootmode="open|closed">`.

## 13. Common Clean-Code Principles

### Markup quality
- Always close non-void tags. Self-close optional but consistent.
- Quote attribute values consistently (double quotes are conventional).
- Use lowercase element and attribute names.
- Use `kebab-case` for `data-*` attributes and `id`/`class` names.
- Use `data-*` attributes for app-specific data (`element.dataset.key`).
- Indent nested content for readability (2 spaces is common).
- Validate markup (W3C validator or build-time linters like html-validate).
- Prefer external CSS/JS over inline (separation of concerns).
- Minimize `<div>` soup — use semantic elements or restructure.
- Avoid deep nesting; flat structures are easier to style and reason about.

### IDs and classes
- IDs must be unique per document.
- Classes are reusable; use BEM or similar conventions for clarity.
- Don't style on IDs (low specificity discipline); use classes for styling.
- `id` values can have any character but conventionally `kebab-case`.

### Boolean attributes
- Presence implies true: `<input disabled>` or `<input disabled="">` — both equivalent.
- Don't write `disabled="false"` (still truthy).

### Self-closing void elements
- `<img>`, `<br>`, `<hr>`, `<input>`, `<meta>`, `<link>`, `<source>`, `<track>`, `<wbr>`, `<col>`, `<area>`, `<base>`, `<embed>`, `<param>` (deprecated).
- Trailing slash optional in HTML5 (`<img />` valid but unnecessary).

### Don't
- Don't use `<table>` for layout.
- Don't use `<br>` for spacing — use CSS margins.
- Don't use `&nbsp;` for indentation.
- Don't put block elements inside inline elements (some exceptions like `<a>` wrapping block in HTML5).
- Don't omit `alt` on `<img>`.
- Don't omit `<label>` association on form controls.
- Don't rely on `placeholder` as a label.
- Don't use `autoplay` for video/audio without `muted`.
- Don't use `<i>`/`<b>` purely for italic/bold styling — use `<em>`/`<strong>` for emphasis or CSS for styling.
- Don't use deprecated elements: `<font>`, `<center>`, `<marquee>`, `<frame>`, `<frameset>`, `<acronym>`, `<applet>`, `<big>`, `<tt>`, `<strike>`.
- Don't use deprecated presentational attributes (`align`, `bgcolor`, `border`, etc. — use CSS).

### Character entities
- Use UTF-8 for the document so most characters can be written literally.
- Required entities: `&amp;` (`&`), `&lt;` (`<`), `&gt;` (`>`), `&quot;` (`"`), `&#39;` (`'`).
- Use named or numeric entities for special chars (`&copy;`, `&mdash;`, `&hellip;`).

### Comments
```html
<!-- Comment -->
```
- Don't nest `<!-- -->`; HTML comments don't nest.
- Don't include conditional comments (`<!--[if IE]>`) — IE is gone.

## 14. Performance Best Practices

- Set `width`/`height` on images and embeds to prevent layout shift.
- Use `loading="lazy"` for offscreen images/iframes.
- Use modern image formats (`AVIF`, `WebP`) with fallbacks.
- Use `srcset`/`sizes` for responsive images.
- Use `<link rel="preload">` for critical above-the-fold resources.
- Use `<link rel="preconnect">` for cross-origin fetches.
- Defer non-critical JS with `defer` or `async`.
- Inline critical CSS, defer the rest.
- Minimize DOM size and depth.
- Use `content-visibility: auto` (CSS) for offscreen sections.
- Use HTTP caching headers (server-side) and SRI for third-party assets.

## 15. Internationalization

- `<html lang="en">` is mandatory.
- Use `<html dir="rtl">` or `dir="auto"` on individual elements with mixed content.
- Use `lang` attribute on subtree elements when content language differs.
- Use `<bdi>` for user-generated text of unknown directionality (e.g., usernames).
- Use `<bdo dir="rtl">` to override directionality of a span.
- Use Unicode characters directly; avoid HTML entities for non-ASCII.
- Provide `hreflang` on alternate language links.

## 16. Privacy & Security Attributes

- `rel="noopener"` (default for `target="_blank"` in modern browsers).
- `rel="noreferrer"` to suppress Referer header.
- `referrerpolicy="no-referrer|same-origin|strict-origin-when-cross-origin|...">` on `<a>`, `<area>`, `<img>`, `<iframe>`, `<link>`, `<script>`.
- `crossorigin="anonymous|use-credentials"` for CORS-enabled resources.
- `integrity="sha384-..."` for Subresource Integrity on third-party scripts/styles.
- `sandbox="..."` on `<iframe>` to restrict capabilities.
- `allow="..."` on `<iframe>` for Permissions Policy.

## 17. Progressive Enhancement

- Build a baseline that works without JS, then enhance.
- Use `<noscript>` to provide a fallback message or alternative UI.
- Use feature detection (`@supports` in CSS, `'feature' in element` in JS) rather than user-agent sniffing.
- Provide fallbacks inside `<picture>`, `<video>`, `<audio>`, `<canvas>`.
- Use semantic forms that submit without JS, then enhance with `fetch()`.

## 18. Common Patterns

### Skip link
```html
<a class="skip-link" href="#main">Skip to main content</a>
<main id="main">...</main>
```

### Accessible icon button
```html
<button type="button" aria-label="Close">
  <svg aria-hidden="true" focusable="false">...</svg>
</button>
```

### External link
```html
<a href="https://example.com" target="_blank" rel="noopener">
  Example <span class="visually-hidden">(opens in new tab)</span>
</a>
```

### Visually hidden but accessible to screen readers
```html
<span class="visually-hidden">Description for screen readers</span>
```
```css
.visually-hidden {
  position: absolute; width: 1px; height: 1px; padding: 0;
  margin: -1px; overflow: hidden; clip: rect(0,0,0,0);
  white-space: nowrap; border: 0;
}
```

### Print-friendly
- Use `<link rel="stylesheet" media="print" href="print.css">` or `@media print`.

---

This is the baseline I would assume any modern HTML developer knows and applies by default — anything in your project skill that overlaps this is a candidate for pruning.
