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

An accordion can be implemented with either `details` elements or using a robust custom approach. First determine which is appropriate:

- If the accordion item triggers should also be heading elements, do not use `details` and `summary` elements as the headings can be obscured by `summary` elements. Use the custom implementation specified in this document.
- If the accordion is used for essential content (e.g. within a site nav), prefer the custom implementation whether or not headers are used as it will be more clearly and consistently exposed to screen reader users.

Once an approach is decided on, follow the requirements for all accordions, then follow the guidance for the specific approach. Do not mix guidance from the specific approaches.

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

A mutually exclusive accordion only allows one item to be open at a time. This guide will demonstrate how to do so with both the `details` and custom approach, however, this should not be the default approach as it can be annoying for users. Sometimes users want to reference between the contents of multiple items and this behaviour does not allow for that. They also can cause content to shift out of the user’s view which can cause significant problems for those using screen magnifiers. 

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

## Implementing a custom accordion

Do not use `details` and `summary` elements in a custom accordion implementation.

Each item in the accordion should have:

- A trigger that is a `button` element in the `button` state and sets `aria-expanded` based on the state of its associated content (e.g. `<button type="button" aria-expanded="true">` would be an accordion trigger whose associated contents are expanded).
- Immediately next to the trigger should be an element that wraps the contents controlled by the button.
	- The trigger can set `aria-controls` to reference this element, however, this has no benefit for screen readers. It can be helpful for managing the state of the accordion item.

When an accordion item’s trigger is also a heading, place the `button` element within the heading so that the heading’s semantics are not obscured by the `button` element which can expose its contents as presentational.

```html
<div role="region" aria-labelledby="services">
	<h2 id="services">Services</h2>
	<div>
		<h3>
			<button type="button" commandfor="design" command="--toggle" aria-expanded="true">Design</button>
		</h3>
		<div id="design">
			<!-- Design contents -->
		</div>
	</div>
	<div>
		<h3>
			<button type="button" commandfor="development" command="--toggle" aria-expanded="false">Development</button>
		</h3>
		<div id="development" hidden="until-found">
			<!-- Development contents -->
		</div>
	</div>
</div>
<script>
document.addEventListener("command", event => {
	if (event.command !== "--toggle") return;
	const content = event.target;
	const trigger = event.source;

	content.hidden = content.hidden ? false : "until-found";
	trigger.setAttribute("aria-expanded", !content.hidden);
}, { capture: true });
</script>
```

### Making the accordion contents findable

Use the `hidden` attribute in the `until-found` state to make the contents of an accordion item findable using a browser’s find-in-page feature. Listen for the `beforematch` event to update the accordion trigger accordingly and, if the accordion item is within a mutually exclusive set, to collapse other accordion items that are expanded.

```javascript
document.addEventListener("beforematch", event => {
	const trigger = document.querySelector(`[commandfor="${CSS.escape(event.target.id)}"][command="--toggle"]`);
	if (!trigger) return;

	trigger.setAttribute("aria-expanded", true);
}, { capture: true });
```

### Adding expand all and collapse all buttons to a custom accordion

### Making the custom accordion mutually exclusive

### Excluding an accordion item’s contents from find-in-page

If it’s undesirable for an accordion item’s contents to be included in what’s matched with the browser’s find-in-page feature, use the `hidden` attribute in the `hidden` state (`hidden` with no value) instead of the `until-found` state.
