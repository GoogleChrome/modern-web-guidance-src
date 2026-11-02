---
name: accordion
draft: wip
description: "Build an accordion component with animation, optional exclusive (one-open-at-a-time) behavior, and brand-consistent styling."
web-feature-ids:
  - hidden-until-found
  - interpolate-size
  - transition-behavior
  - starting-style
  - details-name
  - details
  - invoker-commands
guides:
  - search-hidden-content
  - animate-to-intrinsic-sizes
  - interactive-content-reveal
---

# Accordion

Build accordions from a set of adjacent `details` elements.

## Requirements for all accordions

### Grouping the accordion items

Use an element with an appropriate role for grouping all of the accordion items. This might be a landmark such as a `nav` element or it could be an element with a `region` role and an accessible name.

```html
<section aria-label="Frequently Asked Questions">
	<!-- Accordion implementation -->
</section>
```

### Do not add custom keyboard navigation

An accordion must not have custom keyboard navigation: no arrow key navigation, roving `tabindex`, or `Home`/`End`. The contents of an accordion can often be long enough that a user needs to scroll, and adding custom keyboard navigation can prevent them from doing so.

### Choosing whether to make the accordion mutually exclusive

The default should be to not use an exclusive accordion variation.

A mutually exclusive accordion only allows one item to be open at a time. This should not be the default approach as it can be annoying for users. Sometimes users want to reference between the contents of multiple items and this behaviour does not allow for that. They also can cause content to shift out of the user’s view which can cause significant problems for those using screen magnifiers.

A further variation is a single mutually exlcusive accordion which requires at least one accordion item be open at a given time. Like mutually exlcusive accordions these can be frustrating to users for the same reasons, but also do not allow the user to completely reduce the amount of space the entire accordion structure is using.

### When to offer expand all and collapse all

Expand all and collapse all buttons can be very helpful for users, since they provide a quick way to show and hide all of the disclosed contents. They should not be added to mutually exclusive accordion variations as the “expand all” button would not work and the “collapse all” button would provide little benefit (i.e. it only saves closing a single item).

```html
<section id="support-accordion" aria-labelledby="support" data-accordion>
	<h2 id="support">Support</h2>
	<button type="button" commandfor="support-accordion" command="--expand-all">Expand all</button>
	<button type="button" commandfor="support-accordion" command="--collapse-all">Collapse all</button>
	<!-- Accordion items -->
</section>
```

## Implementing an accordion using `details` and `summary` elements

A set of adjacent `details` elements can be used to create an accordion.

```html
<nav aria-labelledby="topics">
	<h2 id="topics">Topics</h2>
	<details>
		<summary>Development</summary>
		<!-- Development contents -->
	</details>
	<details>
		<summary>Design</summary>
		<!-- Design contents -->
	</details>
</nav>
```

### Headings in accordion items

When each item is a section of the page, put its heading inside the `summary` element so screen reader users can move between items by heading. Keep the group heading outside the `details` elements.

```html
<details>
	<summary><h3>How do I reset my password?</h3></summary>
	<!-- Answer -->
</details>
```

### Adding expand all and collapse all buttons to a `details` accordion

```javascript
document.addEventListener("command", event => {
	if (!event.target.matches("[data-accordion]")) return;

	for (const details of event.target.querySelector(":scope > details")) {
		if (event.command === "--expand-all") details.open = true;
		else if (event.command === "--collapse-all") details.open = false;
	}
}, { capture: true });
```

### Making the `details` accordion mutually exclusive

A group of `details` elements that share the same `name` attribute value work as an accordion that is mutually exclusive. When creating a mutually exclusive accordion with `details` elements, use a globally unique `name`, or other `details` elements that are not meant to be included in the accordion will participate in the mutually exclusive behavior.

### Excluding a `details` element’s contents from find-in-page

If it’s undesirable for a `details` element’s contents to be included in what’s matched with the browser’s find-in-page feature, set the `::details-content` pseudo-element’s `display` property to `none`.

```css
/* Excludes the contents from find-in-page */
details:not([open])::details-content {
	display: none;
}
```

### Styling `details` and `summary`

Within the `details` element’s user-agent shadow root, there is a part-like pseudo-element called `::details-content` that contains the disclosed contents. By default, the element does not use `display: none` to hide the contents, but rather `content-visibility: hidden`.

## Fallback strategies

### Headings inside `summary` with JAWS and TalkBack

JAWS and TalkBack announce a `summary` only as a button and drop a heading nested inside it, so their users cannot move between accordion items by heading.
All browsers and other screen readers expose the heading.

If per-item heading navigation is a hard requirement for those users, give up `details` for those items: wrap a `button` with `aria-expanded` in the heading, and hide the content with `hidden="until-found"` so it stays findable.
This loses the no-JavaScript behavior and native exclusivity of `details`, so do not use it by default.

```html
<h3>
	<button type="button" aria-expanded="false" commandfor="answer-1" command="--toggle">How do I reset my password?</button>
</h3>
<div id="answer-1" hidden="until-found"><!-- Answer --></div>
```

The `--toggle` handler sets `hidden` to `"until-found"` or removes it and mirrors the result into `aria-expanded`.
See {{ GUIDE_REF("custom-button-actions") }} for handling custom commands and {{ GUIDE_REF("search-hidden-content") }} for keeping `aria-expanded` in sync when find-in-page reveals the content.

{#
A custom `<h#><button aria-expanded>` + `hidden="until-found"` approach was removed:
- "Headings inside `summary` are obscured": the HTML content model explicitly permits heading content in `summary`, and every current browser keeps the heading in its accessibility tree (verified 2026-11 via the macOS accessibility API for Safari 26 and Firefox 159, and Chrome's engine tree; Safari was the last to fix it, in 26.6, per TetraLogical's compatibility notes of 2026-10-10: https://tetralogical.com/resources/accessible-components-library/compatibility/). Only JAWS (https://github.com/FreedomScientific/VFO-standards-support/issues/105, closed unfixed 2023-08) and TalkBack still drop it. That is a fallback-section caveat, not a reason to drop the native element.
- "Essential content such as site nav needs the custom approach": the actual objections to `details` for navigation (Roselli: https://adrianroselli.com/2019/04/details-summary-are-not-insert-control-here.html, O'Hara: https://www.scottohara.me/blog/2022/09/12/details-summary.html) are find-in-page auto-expansion, which `::details-content { display: none }` handles, and the HTML spec's rule that menu/tab widgets are not disclosure widgets, which applies equally to the custom pattern. Modern browser/AT pairings all announce the expanded/collapsed state. The guide's own example was a `details` accordion inside `nav`.
The custom path also loses no-JS operation, native `name` exclusivity, native find-in-page reveal, and `::details-content` animation. It survives only as the fallback for the JAWS/TalkBack heading case below.
#}
