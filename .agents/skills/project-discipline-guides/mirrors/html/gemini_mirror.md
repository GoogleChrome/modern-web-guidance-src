# HTML Standard Best Practices & Modern API Guide (Redundancy Mirror)

This guide represents the baseline of "Common Knowledge" for modern HTML development (HTML5 and beyond). It covers semantic structure, performance, accessibility, and modern Web APIs.

## 1. Document Structure & Metadata

### Baseline Standards
- **DOCTYPE**: Always start with `<!DOCTYPE html>`.
- **Language**: Define the document language using `<html lang="en">` for accessibility and SEO.
- **Character Encoding**: Specify UTF-8 in the first 1024 bytes: `<meta charset="UTF-8">`.
- **Viewport**: Ensure mobile responsiveness: `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- **Title**: Every page must have a unique, descriptive `<title>`.

### Modern Meta & Resource Hints
- **Pre-connect/Pre-load**: Use `<link rel="preconnect">` for critical third-party origins (e.g., fonts, APIs) and `<link rel="preload">` for high-priority assets needed early in the page lifecycle.
- **Resource Hints**: Use `dns-prefetch`, `prefetch`, and `prerender` for speculative loading of future resources.

## 2. Semantic HTML & Landmarks

### Core Semantic Elements
- **Landmarks**: Use `<header>`, `<nav>`, `<main>`, `<footer>`, `<aside>`, and `<section>` to define page structure.
- **Sectioning**: Use `<h1>` through `<h6>` in a strict hierarchical order. Avoid skipping levels.
- **Meaningful Tags**:
    - `<article>` for self-contained content.
    - `<figure>` and `<figcaption>` for annotated images/media.
    - `<time>` for dates and times with the `datetime` attribute.
    - `<address>` for contact information for the nearest `<article>` or `<body>`.

### Text Level Semantics
- Use `<strong>` and `<em>` for emphasis, rather than `<b>` and `<i>` (which are now used for stylistic offsets without implied importance).
- Use `<mark>` for highlighted text.
- Use `<abbr>` with `title` for abbreviations.
- Use `<code>`, `<kbd>`, `<samp>`, and `<var>` for technical content.

## 3. Forms & User Input

### Modern Input Types
- Leverage specialized types for better mobile keyboards and built-in validation: `email`, `tel`, `url`, `number`, `date`, `time`, `datetime-local`, `month`, `week`, `color`, `range`, `search`.

### Validation & UX
- **Built-in Attributes**: `required`, `pattern` (regex), `min`, `max`, `step`, `minlength`, `maxlength`.
- **Labels**: Always associate labels using the `for` attribute matching the input `id`.
- **Placeholders**: Never use `placeholder` as a replacement for a label.
- **Autocomplete**: Use the `autocomplete` attribute to assist password managers and browser autofill (e.g., `current-password`, `new-password`, `cc-number`, `shipping address-line1`).
- **Inputmode**: Use `inputmode` (e.g., `numeric`, `decimal`, `tel`) to provide specific virtual keyboards.

### Advanced Form Elements
- **`<datalist>`**: Provide "suggested" options for an `<input>`.
- **`<output>`**: Display the result of a calculation or user action.
- **`<progress>`** and **`<meter>`**: Represent task progress or scalar measurements.

## 4. Media & Graphics

### Images
- **Responsive Images**: Use `<picture>` with multiple `<source>` elements for different formats (WebP, AVIF) and `srcset` with `sizes` for different resolutions/viewports.
- **Lazy Loading**: Use `loading="lazy"` for all images below the fold.
- **Decoding**: Use `decoding="async"` to reduce main-thread impact of image decoding.
- **Alt Text**: Always provide `alt` attributes. Use `alt=""` for purely decorative images.

### Video & Audio
- Provide multiple sources for compatibility (MP4, WebM).
- Use the `poster` attribute for videos.
- Use `playsinline` for mobile autoplay (where muted).
- Always include `<track>` for captions/subtitles (WebVTT).

### SVG
- Prefer inline SVG for icons to reduce HTTP requests and allow CSS styling.
- Use `aria-hidden="true"` on SVGs that are decorative.
- Provide a `<title>` and `<desc>` inside the SVG for complex graphics.

## 5. Web APIs & Modern Features

### The `<dialog>` Element
- Use `<dialog>` for modals and popovers.
- Use `.showModal()` for backdrop-blocking modals and `.show()` for non-modal dialogs.
- Leverage the `::backdrop` CSS pseudo-element for styling.

### Web Components (Native)
- **`<template>`**: Define HTML fragments that are not rendered until instantiated via JavaScript.
- **`<slot>`**: Placeholders inside a Shadow DOM that users can fill with their own markup.
- **Shadow DOM**: Encapsulate styles and markup for custom elements.

### Advanced HTML Attributes
- **`hidden`**: Hide elements without using CSS (acts like `display: none`).
- **`contenteditable`**: Allow users to edit element content directly.
- **`spellcheck`**: Enable/disable browser spellchecking.
- **`draggble`**: Native drag-and-drop support.
- **`popover`**: (Recent) Use for non-modal overlays without JavaScript (using `popovertarget`).

## 6. Accessibility (A11y) Best Practices

### Fundamental Rules
- **Interactive Elements**: Use `<button>` for actions and `<a>` for navigation. Never use a `<div>` or `<span>` for an action unless strictly necessary (and then apply `role="button"` and `tabindex="0"`).
- **Focus Management**: Ensure a visible focus indicator (`:focus` or `:focus-visible`).
- **Aria Attributes**:
    - `aria-label`: For elements without visible text.
    - `aria-labelledby`: Link to another element for a description.
    - `aria-describedby`: For supplementary information.
    - `aria-expanded`, `aria-hidden`, `aria-current`, `aria-live` (for dynamic updates).
- **Skip Links**: Provide a "Skip to main content" link at the top of the page.

## 7. Performance & Clean Code

### Loading Strategy
- **Script Placement**: Use `async` or `defer` on `<script>` tags. Place `defer` scripts in the `<head>` to start downloading early but execute after parsing.
- **CSS Placement**: Always place `<link rel="stylesheet">` in the `<head>`.

### Syntax & Style
- Use lowercase for all tags and attributes.
- Use double quotes for attribute values.
- Self-close void elements (e.g., `<br>`, `<img>`, `<hr>`) or use the shorter syntax (e.g., `<br />` is valid but `<br>` is standard).
- Order attributes consistently (e.g., `class`, `id`, `name`, `data-*`, `src`/`href`, `alt`).
- Minimize deep nesting; flatten the DOM tree where possible for better performance.

## 8. Progressive Enhancement
- Ensure the core content is accessible without JavaScript.
- Use `<noscript>` for critical fallback messaging if JS is required for the app to function.
- Test against high-contrast modes and screen readers.
