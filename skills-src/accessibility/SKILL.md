---
name: accessibility
description: Actionable coding guidelines for building accessible web applications, covering semantic HTML, focus management, forms, media, and testing. Use this skill when auditing or implementing accessibility features, keyboard navigation, or ARIA.
---

# Accessibility Coding Guidelines

This guide provides actionable DOs and DON'Ts for AI coding agents to ensure web applications are accessible to all users, including those using assistive technologies.

## 1. Semantic HTML and Landmarks

### Actionable Guidelines

#### DOs
- **Prioritize Native HTML Elements**: Use native tags like `<button>`, `<input>`, and `<nav>` instead of custom `<div>` constructions with ARIA.
- **Use Section Landmarks**: Divide pages into regions using `<header>`, `<nav>`, `<main>`, `<aside>`, and `<footer>`.
- **Maintain Heading Hierarchy**: Use headings sequentially (`<h1>` followed by `<h2>`, not jumping to `<h4>`).
- **Semantic Tables**: Use `<caption>` and `<th scope="col/row">` for data tables.

#### DON'Ts
- **Don't use ARIA when native HTML exists**: Avoid `<a role="button">` if a `<button>` can be used.
- **Don't use tables for layout**: Use CSS Grid/Flexbox for visual layouts.
- **Don't use fake headings**: Never style `<div>` or `<span>` to look like headings without standard `<h1>`-`<h6>` tags.
- **Don't add redundant ARIA roles**: Avoid using `<ul role="list">` or `<nav role="navigation">`.

### Code Examples

```html
<!-- Good: Semantic landmarks and heading hierarchy -->
<header>
  <h1>Platform Dashboard</h1>
  <nav aria-label="Primary">
    <ul>
      <li><a href="/">Home</a></li>
    </ul>
  </nav>
</header>
<main>
  <section>
    <h2>User Statistics</h2>
    <table>
      <caption>Monthly active users</caption>
      <tr>
        <th scope="col">Month</th>
        <th scope="col">Users</th>
      </tr>
      <tr>
        <td>January</td>
        <td>12,000</td>
      </tr>
    </table>
  </section>
</main>
```

## 2. Document Metadata and Language

### Actionable Guidelines

#### DOs
- **Declare Visual Language**: Always set `<html lang="en">` (or appropriate code).
- **Unique Page Titles**: Front-load unique context in `<title>` (e.g., `Page Topic | Site Name`).
- **Inline Language Switches**: Use `lang="..."` for block quotes or text in different languages.
- **IFrame Titles**: Always provide a descriptive `title="..."` for `<iframe>` elements.
- **Update document title on Page Transitions in SPAs**: Shift focus to updated titles.

#### DON'Ts
- **Don't Disable Scrolling**: Never use `scrolling="no"` on iframes to allow standard zoom levels.

### Code Examples

```html
<!-- Good: Distinct title and language declaration -->
<html lang="en">
<head>
  <title>Analytics Reports | Guidance Platform</title>
</head>
<body>
  <p>The motto is <span lang="la">"Carpe diem"</span>.</p>
  <iframe title="Interactive Sales Chart" src="/chart"></iframe>
</body>
</html>
```

## 3. Keyboard and Focus Management

### Actionable Guidelines

#### DOs
- **Logical Tab Order**: Ensure tab order matches visual layouts (top-to-bottom).
- **Visible Focus Indicators**: Always style `:focus` states explicitly. If disabling defaults, provide high-contrast overrides.
- **Skip Navigation Links**: Provide a "Skip to content" link at the top of the page.
- **Lock Modal Focus**: Ensure focus cannot leave open modal dialogs.
- **Custom Trigger Keyboards**: Attach Enter/Space handlers for custom simulated interactive elements.
- **Custom tabindex focus elements usages**: Use `tabindex="0"` for non natively focusable elements.
- **Manage Toggle States**: Utilize `aria-expanded` and `aria-pressed` to communicate toggle states for custom controls.

#### DON'Ts
- **Don't disable outlines without replacements**: Avoid `outline: none` without styling alternatives.
- **Don't use Positive Tabindex values**: Never use `tabindex="1"` or greater.
- **Don't hide interactive elements from screen readers**: Avoid `aria-hidden="true"` or `role="presentation"` on elements that can receive focus.

### Code Examples

```css
/* Good: High contrast focus border */
a:focus, button:focus {
  outline: 3px solid #ff0055;
  outline-offset: 3px;
}
```

```html
<!-- Good: Skip to main content -->
<a href="#main" class="skip-link">Skip to main content</a>
<main id="main">...</main>
```

```javascript
// Good: Enter/Space keyboard handlers for custom buttons
element.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    // Toggle state for screen readers
    const pressed = element.getAttribute('aria-pressed') === 'true';
    element.setAttribute('aria-pressed', !pressed);
    performAction();
  }
});
```

## 4. Alternate Text and Media

### Actionable Guidelines

#### DOs
- **Informative Visual Descriptions**: Describe the purpose of the image (e.g., "Search", not "Magnifying glass").
- **Empty Alt properties for decorative visuals**: Use `alt=""` or `role="presentation"` to hide decorative images.
- **Synchronous Captions for videos**: Supply WebVTT captions for video tracks.
- **Transcripts for audio**: Provide text transcripts for purely audio podcasts.
- **Informative View Descriptions for inline SVGs**: Apply `role="img"` and a nested `<title>` tag for informative visuals.
- **Decorative SVGs removal**: Apply `tabindex="-1"` and `aria-hidden="true"` to remove decorative SVGs from focus and reading flows.
- **Long descriptions for complex images**: Use `<figure>`/`<figcaption>` or `aria-describedby` for charts and infographics.

#### DON'Ts
- **Don't use clichéd prefixes**: Avoid "Image of..." or "Picture of...".
- **Don't use underscores in filenames**: Use dashes if the filename might be announced as fallback.

### Code Examples

```html
<!-- Decorative -->
<img src="divider.png" alt="" role="presentation">

<!-- Inline Decorative SVG (remove from tab flow) -->
<svg aria-hidden="true" tabindex="-1" viewBox="0 0 24 24">
  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
</svg>

<!-- Informative (Functional) -->
<a href="/search">
  <img src="glass.png" alt="Search the platform">
</a>

<!-- Video with Captions tracks -->
<video controls>
  <source src="intro.mp4" type="video/mp4">
  <track src="caps.vtt" kind="captions" srclang="en" label="English">
</video>

```html
<!-- Complex graph with figcaption -->
<figure>
  <img src="chart.png" alt="Sales growth graph 2024.">
  <figcaption>Sales grew 20% in Q3 due to new platform launch.</figcaption>
</figure>

<!-- Audio with expandable transcript details -->
<audio controls src="podcast.mp3"></audio>
<details>
  <summary>View Transcript</summary>
  <div class="transcript-content">
    Welcome to the show...
  </div>
</details>
```

### Content Visibility Decision Matrix

| Intent | Visual | Screen Reader | Focusable | Structural Pattern |
| :--- | :--- | :--- | :--- | :--- |
| **Visible to all** | Yes | Yes | Yes | Standard rendering |
| **Screen Reader only** | No | Yes | Yes (if interactive) | `.visually-hidden` (`clip-path`) |
| **Visual only** | Yes | No | No | `aria-hidden="true"` / `role="presentation"` |
| **Hidden for all** | No | No | No | `hidden` attribute / `display: none` |

**Heuristic Rule**: If an element can receive keyboard focus, it must not be hidden via `aria-hidden="true"`.

## 5. Forms and Inputs Controls

### Actionable Guidelines

#### DOs
- **Connect Labels Programmatically**: Use `<label for="id">` linked to `<input id="id">`.
- **Use Autocomplete**: Set `autocomplete="email/name"` for user profiles.
- **Link hints to inputs via aria-describedby**: Associate help text with inputs.
- **Announce dynamic errors via live regions**: Use `aria-live` or shift focus to error lists.
- **Provide form validation constraints**: Use `required` or `aria-required="true"` to signal mandatory inputs.

#### DON'Ts
- **Don't rely on placeholders alone**: Placeholders are not persistent labels.
- **Don't trigger context shifts on focus changes**: Avoid auto-submitting forms or jumping pages on focus change events alone.

### Code Examples

```html
<!-- Good: Semantic forms with hints for passwords -->
<form>
  <label for="pwd">Password:</label>
  <input id="pwd" type="password" aria-describedby="pwd-hint" autocomplete="current-password" required aria-required="true">
  <span id="pwd-hint">Must contain at least 8 characters.</span>
</form>
```

### Live Region Urgency Table

| Urgency | Visual Analogue | `aria-live` Value | Behavioral Impact | Example |
| :--- | :--- | :--- | :--- | :--- |
| **Critical** | Modal / Alert | `assertive` (or `role="alert"`) | Interrupts immediately, clears speech queue | Session timeout, API failure |
| **Standard**| Toast / Banner | `polite` | Announces at next graceful break | Search results, "Saved" status |
| **Passive**  | Silent text | `off` | Only if user navigates to it | Live character count |

**Heuristic Rule**: Only interrupt the user with `assertive` if ignoring the notice would result in immediate data loss.

## 6. Color, Contrast, and Typography

### Actionable Guidelines

#### DOs
- **Minimum contrast standards**: Maintain 4.5:1 for normal text and 3:1 for large text or icons.
- **Use multiple state indicators**: Do not denote success/errors ONLY with color. Use icons or text.
- **Relative font size units**: Use `rem` or `em` for font sizes instead of `px`.
- **Left text alignment**: Cap paragraph blocks to a maximum of 80 characters width.
- **Support user preference media queries**: Implement `@media (prefers-color-scheme: dark)` and `@media (prefers-contrast: high)`.

#### DON'Ts
- **Don't use Justified Text Alignment**: Avoid `text-align: justify`.
- **Don't use Ornate fonts**: Omit cursive typefaces for main reading content.
- **Don't rely on italics or all-caps for emphasis**: Use bolding sparingly as it is generally more readable for dense text.

### Code Examples

```css
/* Good: Relative sizing and line caps */
body {
  font-size: 1rem;
  line-height: 1.5;
  text-align: left;
}
article {
  max-width: 65ch; /* Caps character lengths */
}
```

```html
<!-- Good: Denotes state without colors alone -->
<div class="error-msg">
  <span aria-hidden="true">❌</span>
  <span>The password entered was invalid.</span>
</div>
```

```css
/* Dark Mode support variables */
:root {
  --bg-color: #ffffff;
  --text-color: #212529;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg-color: #121212;
    --text-color: #f8f9fa;
  }
}
```

## 7. Motions and Preferences

### Actionable Guidelines

#### DOs
- **Support Reduced Motion media queries**: Support `@media (prefers-reduced-motion: reduce)` media queries.
- **Provide Pause mechanism**: Allow users to stop auto-running carousels banners.
- **Default to static views**: Consider defaulting to static states and allowing users to opt-in to motion.

#### DON'Ts
- **Don't exceed flash limits (three per second)**: Avoid rapid light-to-dark flashing to prevent seizures.

### Code Examples

```css
/* Good: Dampen spin states for reduced motion queries */
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
    opacity: 0.5;
  }
}
```

```html
<!-- Session Timeout Warning with controls -->
<div role="alert" aria-live="assertive" class="timeout-warning">
  Your session will expire in 2 minutes. 
  <button onclick="extendSession()">Extend Session</button>
</div>
```

## 8. Testing Validations

### Actionable Guidelines

#### DOs
- **Run Automated checks via axe-core audits**: Catch missing alt texts or low contrasts.
- **Validate Sequential Navigations using keyboards alone**: Disconnect mouse traps to verify logic.
- **Use Screen Readers with calibrated browsers**: Rely on standard bindings (e.g., VoiceOver with Safari).

#### DON'Ts
- **Don't rely purely on scores**: A 100% score does not guarantee real usability.

## 9. Modals and Native Dialogs

Modern browsers provide native mechanisms for focus trapping and modal overlays that bypass the need for heavy manual JavaScript event tracking.

### Actionable Guidelines

#### DOs
- **Use the Native `<dialog>` Element**: Invoke the dialog using the `.showModal()` method to automatically lock focus into the popup and dim the background.
- **Use the `inert` Attribute for Custom Overlays**: Apply the `inert` attribute to background app-shells if you must build a custom viewport container to isolate focus.
- **Provide a Standard Visually Hidden Utility Class**: Utilize standard `clip-path` CSS properties to hide secondary text from view but retain it in the accessibility tree (the `.sr-only` pattern).

#### DON'Ts
- **Don't rely on complex manual JS focus traps**: Avoid using manual `keydown` listeners for focus loops if the native `<dialog>` element is available.

### Code Examples

**HTML & JS: Native `<dialog>` with standard close events**
```html
<!-- Dialog opens natively with showModal() and locks focus -->
<button id="open-btn">Open Dialog</button>

<dialog id="accessible-modal" aria-labelledby="title-id">
  <h2 id="title-id">Account Settings</h2>
  <p>Update your details here.</p>
  <button onclick="this.closest('dialog').close()">Close Dialog</button>
</dialog>

<script>
  document.getElementById('open-btn').addEventListener('click', () => {
    document.getElementById('accessible-modal').showModal();
  });
</script>
```

**CSS: Standard Visually Hidden for secondary text**
```css
.visually-hidden {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip-path: inset(50%) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

/* Reverse visually hidden on focus for interactive elements */
.visually-hidden-focusable:focus,
.visually-hidden-focusable:active {
  position: static !important;
  width: auto !important;
  height: auto !important;
  overflow: visible !important;
  clip: auto !important;
  clip-path: none !important;
  white-space: normal !important;
}
```
