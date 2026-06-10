update_topic{strategic_intent:Generating the Unified Lowest Common Denominator (LCD) Mirror for HTML best practices.,summary:I have analyzed the three source mirrors (Gemini, Claude, and Codex) to identify the intersection of HTML best practices. I strictly applied the inclusion and exclusion rules, ensuring that only concepts explicitly present in all three documents are included. Notable exclusions due to missing evidence in at least one mirror include: HTML lists (ul, ol, dl), tables, anchor element security (rel="noopener"), and specific meta tags like canonical or description. I am now presenting the unified LCD mirror organized by standard technical headers.,title:Generating HTML LCD Mirror}# HTML Lowest Common Denominator (LCD) Mirror

This document represents the unified intersection of "Common Knowledge" for HTML development, derived from the consensus of multiple models. It contains only the best practices, syntax, and APIs explicitly supported across all source mirrors.

## 1. Document Structure & Metadata

### Mandatory Boilerplate
- **DOCTYPE**: Always start the document with `<!DOCTYPE html>` to trigger standards mode.
- **Language**: Define the primary language of the document using the `lang` attribute on the `<html>` tag (e.g., `<html lang="en">`).
- **Character Encoding**: Specify UTF-8 encoding using `<meta charset="UTF-8">` within the first 1024 bytes of the document.
- **Viewport**: Ensure mobile responsiveness with `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- **Title**: Provide a unique, descriptive `<title>` for every page.

### Resource Hints
- **Performance Optimization**: Use the following `<link>` relationship types to optimize resource loading:
    - `preconnect`: Establish early connections to critical third-party origins.
    - `preload`: Prioritize the download of high-priority assets needed early in the page lifecycle.
    - `dns-prefetch`: Resolve domain names before they are requested.
    - `prefetch`: Speculatively fetch resources for future navigations.

## 2. Semantic HTML & Page Structure

### Landmark & Sectioning Elements
Use specific tags to define the structural regions of a page:
- `<header>`: Introductory content for a page or section.
- `<nav>`: A section intended for navigation links.
- `<main>`: The primary content of the document (use exactly one per page).
- `<section>`: A thematic grouping of content, typically including a heading.
- `<article>`: Self-contained content that can stand independently.
- `<aside>`: Content tangentially related to the main content (e.g., sidebars).
- `<footer>`: The footer for the nearest sectioning ancestor or the page.

### Content Semantics
- **Headings**: Use `<h1>` through `<h6>` in a strict hierarchical order. Do not skip levels for styling purposes.
- **Figures**: Use `<figure>` to wrap images or media, and `<figcaption>` to provide a caption.
- **Time**: Use the `<time>` element for dates and times, employing the `datetime` attribute for machine-readable values.
- **Address**: Use `<address>` for contact information related to the document or an `<article>`.

## 3. Text-Level Semantics

- **Emphasis**: Use `<strong>` for importance and `<em>` for stress emphasis.
- **Stylistic Offsets**: Use `<b>` and `<i>` for stylistic purposes without implied importance.
- **Highlighting**: Use `<mark>` for text highlighted for reference or notation.
- **Abbreviations**: Use `<abbr>` with a `title` attribute to define abbreviations.
- **Technical Text**: Use `<code>` for inline code, `<kbd>` for keyboard input, `<samp>` for sample output, and `<var>` for variables.

## 4. Forms & User Input

### Input Types & Attributes
Leverage specific `type` attributes for better mobile keyboards and built-in validation:
- **Types**: `email`, `tel`, `url`, `number`, `date`, `time`, `datetime-local`, `month`, `week`, `color`, `range`, `search`.
- **Validation**: Use the attributes `required`, `pattern`, `min`, `max`, `step`, `minlength`, and `maxlength`.

### User Experience & Accessibility
- **Labels**: Always associate a `<label>` with its input using the `for` attribute matching the input `id`.
- **Placeholders**: Never use the `placeholder` attribute as a replacement for a visible label.
- **Autofill**: Use the `autocomplete` attribute to assist browser autofill (e.g., `email`, `current-password`, `new-password`).
- **Virtual Keyboards**: Use the `inputmode` attribute (e.g., `numeric`, `decimal`, `tel`) to specify the type of keyboard displayed on mobile devices.

### Functional Elements
- **`<datalist>`**: Provide suggested options for an `<input>`.
- **`<output>`**: Display the results of a calculation or user action.
- **`<progress>` & `<meter>`**: Represent task progress or scalar measurements within a known range.

## 5. Media & Graphics

### Images
- **Alt Text**: Always provide an `alt` attribute. Use `alt=""` (empty) for decorative images so they are ignored by assistive technology.
- **Loading & Performance**: 
    - Use `loading="lazy"` for images below the fold.
    - Use `decoding="async"` to allow the browser to decode the image off the main thread.
- **Responsive Images**: Use `srcset` and `sizes` to provide different image resolutions for various viewports.
- **Art Direction**: Use the `<picture>` element with `<source>` tags for different image formats (e.g., WebP, AVIF) or viewports.

### Video & Audio
- **Fallbacks**: Provide multiple `<source>` elements for different file formats.
- **Accessibility**: Use the `<track>` element for captions or subtitles (WebVTT).
- **Behavior**: 
    - Use the `poster` attribute for video placeholders.
    - Use `muted` and `playsinline` for mobile-compatible autoplay.

### SVG
- **Accessibility**: Use `aria-hidden="true"` for decorative SVGs and provide a `<title>` for meaningful graphics.

## 6. Modern Web APIs

- **`<dialog>` Element**: Use for modals and popovers. Employ `.showModal()` for modal behavior and `.show()` for non-modal views. Style the background using the `::backdrop` pseudo-element.
- **Web Components**: 
    - Use `<template>` for inert HTML fragments.
    - Use `<slot>` as placeholders within a Shadow DOM.
- **Popover API**: Use the `popover` attribute and `popovertarget` for non-modal overlays.
- **`hidden` Attribute**: Use the `hidden` attribute to remove elements from view and the accessibility tree.

## 7. Accessibility (A11y)

- **Native Elements**: Prioritize native elements (e.g., `<button>`, `<a>`) over ARIA roles on generic containers (e.g., `<div role="button">`).
- **Interaction**: Use `<button>` for actions and `<a>` for navigation.
- **Focus**: Ensure a visible focus indicator is maintained for keyboard users.
- **ARIA Attributes**: Use the following for enhanced context:
    - `aria-label`, `aria-labelledby`, `aria-describedby` for naming and descriptions.
    - `aria-expanded`, `aria-hidden`, `aria-current`, `aria-live` for state and dynamic updates.
- **Skip Links**: Provide a link at the top of the page to skip directly to the main content.

## 8. Scripts & Performance

- **Script Loading**: Use `async` or `defer` attributes on `<script>` tags to prevent render-blocking.
- **Resource Placement**: 
    - Place `<link rel="stylesheet">` in the `<head>`.
    - Place `<script>` tags with `defer` in the `<head>` or at the end of the `<body>`.

## 9. Syntax & Best Practices

- **Naming**: Use lowercase for all element and attribute names.
- **Quoting**: Use double quotes for all attribute values.
- **Elements**: 
    - Close all non-void tags.
    - Treat void elements (e.g., `<img>`, `<br>`, `<hr>`, `<meta>`, `<link>`) as self-closing or use the standard short syntax.
- **Nesting**: Avoid deep DOM nesting to maintain performance and readability.
