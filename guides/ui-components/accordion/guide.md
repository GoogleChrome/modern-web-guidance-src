---
name: accordion
draft: wip
description: "Build an accordion component with animation, optional exclusive (one-open-at-a-time) behavior, and brand-consistent styling."
web-feature-ids:
  - hidden-until-found
  - interpolate-size
  - transition-behavior
  - details-name
  - details
  - invoker-commands
guides:
  - search-hidden-content
  - animate-to-intrinsic-sizes
---

# Accordion

Build accordions from a set of adjacent `details` elements.

## Requirements for all accordions

### Grouping the accordion items

If the accordion is a distinct section of the page, group its items in an element with an accessible name, such as a `section` labeled by the group heading. Do not wrap every small accordion in a landmark or `region`; that adds navigation noise for screen reader users.

```html
<section aria-label="Frequently Asked Questions">
	<!-- Accordion implementation -->
</section>
```

### Do not add custom keyboard navigation

Do not add arrow key navigation, roving `tabindex`, or `Home`/`End` handling.
Accordion contents are often long enough to need scrolling, and arrow keys on a focused trigger are how keyboard users scroll.

### Choosing whether to make the accordion mutually exclusive

The default should be to not use an exclusive accordion variation.

A mutually exclusive accordion only allows one item to be open at a time. This should not be the default approach as it can be annoying for users. Sometimes users want to reference between the contents of multiple items and this behavior does not allow for that. They also can cause content to shift out of the user’s view which can cause significant problems for those using screen magnifiers.

A further variation is a single mutually exclusive accordion which requires at least one accordion item be open at a given time. Like mutually exclusive accordions these can be frustrating to users for the same reasons, but also do not allow the user to completely reduce the amount of space the entire accordion structure is using.

### When to offer expand all and collapse all

Expand all and collapse all buttons can be very helpful for users, since they provide a quick way to show and hide all of the disclosed contents. They should not be added to mutually exclusive accordion variations as the “expand all” button would not work and the “collapse all” button would provide little benefit (i.e. it only saves closing a single item).

```html
<section id="support-accordion" aria-labelledby="support">
	<h2 id="support">Support</h2>
	<button type="button" commandfor="support-accordion" command="--expand-all">Expand all</button>
	<button type="button" commandfor="support-accordion" command="--collapse-all">Collapse all</button>
	<!-- Accordion items -->
</section>
```

## Implementing an accordion using `details` and `summary` elements

A set of adjacent `details` elements can be used to create an accordion.

```html
<section aria-labelledby="topics">
	<h2 id="topics">Topics</h2>
	<details>
		<summary>Development</summary>
		<!-- Development contents -->
	</details>
	<details>
		<summary>Design</summary>
		<!-- Design contents -->
	</details>
</section>
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
	if (event.command !== "--expand-all" && event.command !== "--collapse-all") return;

	// Command events fire on the commandfor target
	for (const details of event.target.querySelectorAll(":scope > details")) {
		details.open = event.command === "--expand-all";
	}
}, { capture: true }); // Command events do not bubble, hence capture
```

### Making the `details` accordion mutually exclusive

A group of `details` elements that share the same `name` attribute value work as an accordion that is mutually exclusive. When creating a mutually exclusive accordion with `details` elements, use a globally unique `name`, or other `details` elements that are not meant to be included in the accordion will participate in the mutually exclusive behavior.

### Excluding a `details` element’s contents from find-in-page

If it’s undesirable for a `details` element’s contents to be included in what’s matched with the browser’s find-in-page feature, set the `::details-content` pseudo-element’s `display` property to `none`. This also disables the open and close animation below, since `display: none` cannot transition.

```css
/* Excludes the contents from find-in-page */
details:not([open])::details-content {
	display: none;
}
```

### Styling and animating `details` and `summary`

The disclosed content lives in the `::details-content` pseudo-element. While closed it is hidden with `content-visibility: hidden`, not `display: none`, which is what keeps it findable and lets its size animate. Style the item on `details`, the trigger on `summary`, and the content on `details::details-content`.

To animate opening and closing, transition `block-size` between `0` and its intrinsic size, and transition `content-visibility` discretely so the content stays rendered until the collapse finishes.

```css
details::details-content {
	/* Lets block-size transition to and from its intrinsic auto size */
	interpolate-size: allow-keywords;
	overflow: clip;
}

details:not([open])::details-content {
	block-size: 0;
}

/* Only animate for users who have not asked for reduced motion */
@media (prefers-reduced-motion: no-preference) {
	details::details-content {
		transition: block-size, content-visibility;
		/* Example duration; match the surrounding motion design */
		transition-duration: 0.3s;
		transition-timing-function: ease-in-out;
		/* Defers content-visibility: hidden until the collapse ends */
		transition-behavior: allow-discrete;
	}
}
```

See {{ GUIDE_REF("animate-to-intrinsic-sizes") }} for more details.

## Fallback strategies

### Mutually exclusive `details`

{{ BASELINE_STATUS("details-name") }}

In browsers that don't support `name` on `details`, several items stay open, which is still a working (non-exclusive) accordion.
If the exclusivity is crucial to the user experience, you can implement a fallback:

```javascript
// Only needed where the name attribute is unsupported
if (!Object.hasOwn(HTMLDetailsElement.prototype, "name")) {
	document.addEventListener("toggle", event => {
		const details = event.target;
		if (!(details instanceof HTMLDetailsElement) || !details.open || !details.hasAttribute("name")) return;

		const name = CSS.escape(details.getAttribute("name"));
		for (const other of document.querySelectorAll(`details[name="${name}"]`)) {
			if (other !== details) other.open = false;
		}
	}, { capture: true }); // toggle does not bubble, hence capture
}
```

### Expand all and collapse all buttons

{{ BASELINE_STATUS("invoker-commands") }}

If your Baseline target does not support invoker commands, the buttons do nothing. Feature-detect with `Object.hasOwn(HTMLButtonElement.prototype, "commandForElement")` and fall back to `click` listeners that run the same loop. See {{ GUIDE_REF("custom-button-actions") }} for more details.

### Open and close animation

{{ BASELINE_STATUS("interpolate-size") }}

{{ BASELINE_STATUS("transition-behavior") }}

The animation is a progressive enhancement and needs no fallback. Without `interpolate-size`, items open and close instantly. Without `transition-behavior`, the content hides at the start of the collapse and the height animates empty, while opening still animates.

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

{{ BASELINE_STATUS("hidden-until-found") }}

Where `until-found` is unsupported, the attribute behaves as plain `hidden`: the content is hidden but not findable, and the accordion still works.

The `--toggle` handler sets `hidden` to `"until-found"` or removes it and mirrors the result into `aria-expanded`.
See {{ GUIDE_REF("custom-button-actions") }} for handling custom commands and {{ GUIDE_REF("search-hidden-content") }} for keeping `aria-expanded` in sync when find-in-page reveals the content.

{#
A custom `<h#><button aria-expanded>` + `hidden="until-found"` approach was removed:
- "Headings inside `summary` are obscured": the HTML content model explicitly permits heading content in `summary`, and every current browser keeps the heading in its accessibility tree (verified 2026-11 via the macOS accessibility API for Safari 26 and Firefox 159, and Chrome's engine tree; Safari was the last to fix it, in 26.6, per TetraLogical's compatibility notes of 2026-10-10: https://tetralogical.com/resources/accessible-components-library/compatibility/). Only JAWS (https://github.com/FreedomScientific/VFO-standards-support/issues/105, closed unfixed 2023-08) and TalkBack still drop it. That is a fallback-section caveat, not a reason to drop the native element.
- "Essential content such as site nav needs the custom approach": the actual objections to `details` for navigation (Roselli: https://adrianroselli.com/2019/04/details-summary-are-not-insert-control-here.html, O'Hara: https://www.scottohara.me/blog/2022/09/12/details-summary.html) are find-in-page auto-expansion, which `::details-content { display: none }` handles, and the HTML spec's rule that menu/tab widgets are not disclosure widgets, which applies equally to the custom pattern. Modern browser/AT pairings all announce the expanded/collapsed state. The guide's own example was a `details` accordion inside `nav`.
The custom path also loses no-JS operation, native `name` exclusivity, native find-in-page reveal, and `::details-content` animation. It survives only as the fallback for the JAWS/TalkBack heading case below.
#}
