---
name: accordion
draft: wip
description: "Build an accordion component with animation, optional exclusive (one-open-at-a-time) behavior, and brand-consistent styling."
web-feature-ids:
  - hidden-until-found
  - interpolate-size
  - transition-behavior
  - details-name
  - dir-pseudo
  - details
  - details-content
  - invoker-commands
guides:
  - search-hidden-content
  - animate-to-intrinsic-sizes
---

# Accordion

Build accordions from a set of adjacent `details` elements.

If the accordion is a distinct section of the page, group its items in an element with an accessible name, such as a `section` labeled by the group heading.

```html
<section class="accordion" aria-labelledby="faq-heading">
	<h2 id="faq-heading">Frequently Asked Questions</h2>
	<details>
		<summary>Lorem ipsum dolor sit amet?</summary>
		<!-- answer 1 -->
	</details>
	<details>
		<summary>Consectetur adipiscing elit?</summary>
		<!-- answer 2 -->
	</details>
</section>
```

When each item is a section of the page, put its heading inside the `summary` element so screen reader users can move between items by heading. Keep the group heading outside the `details` elements.

```html
<section class="accordion" aria-labelledby="faq-heading">
	<h2 id="faq-heading">Frequently Asked Questions</h2>
	<details>
		<summary><h3>How do I reset my password?</h3></summary>
		<!-- Answer -->
	</details>
</section>
```

Accessibility notes:
- Do not wrap every small accordion in a landmark or `region`; that adds navigation noise for screen reader users.
- Do not add arrow key navigation, roving `tabindex`, or `Home`/`End` handling.
Accordion contents are often long enough to need scrolling, and arrow keys on a focused trigger are how keyboard users scroll.
- If a heading for the entire accordion is not desirable, use an `aria-label` on the container element to provide an accessible name for the group.

## Exclusive accordions

An exclusive accordion only allows one item to be open at a time.

To make an accordion exclusive, add the same `name` to each `details` element that should be part of the exclusive group.
Ensure that `name` is not used elsewhere on the page unless it is intended to be part of the same exclusive accordion group.

```html
<section class="accordion" aria-labelledby="faq-heading">
	<h2 id="faq-heading">Frequently Asked Questions</h2>
	<details name="faq-question">
		<summary>Lorem ipsum dolor sit amet?</summary>
		<!-- answer 1 -->
	</details>
	<details name="faq-question">
		<summary>Consectetur adipiscing elit?</summary>
		<!-- answer 2 -->
	</details>
</section>
```

Avoid exclusive accordions, as they can produce suboptimal user experience:
- Sometimes users want to reference between the contents of multiple items, which exclusive accordions prevent.
- They also can cause content to shift out of the user’s view which can cause significant problems for those using screen magnifiers.

### Keeping one item always open

To require that one item is always open, stop the open item’s `summary` from closing it and expose it as disabled. Opening another item still closes it through `name`. This compounds the downsides above, since users can never reclaim the space, so only use it when the layout depends on an item being open.

```html
<section class="accordion always-open" aria-labelledby="plans-heading">
	<h2 id="plans-heading">Plans</h2>
	<details name="plan" open>
		<!-- Mirrors the open state; the script keeps it in sync -->
		<summary aria-disabled="true">Basic</summary>
		<!-- Basic plan -->
	</details>
	<details name="plan">
		<summary>Pro</summary>
		<!-- Pro plan -->
	</details>
</section>
```

```javascript
// Enter and Space on a summary also dispatch click, so this covers keyboard too
document.addEventListener("click", event => {
	if (event.target.closest(".accordion.always-open details[open] > summary")) event.preventDefault();
});

// toggle does not bubble, hence capture
document.addEventListener("toggle", event => {
	if (!event.target.matches(".accordion.always-open details")) return;
	event.target.querySelector(":scope > summary").setAttribute("aria-disabled", event.target.open);
}, { capture: true });
```

Keep the disabled `summary` focusable so focus is not lost when the item a user just opened becomes disabled, but exclude it from hover and pointer styles so it does not look clickable:

```css
/* :where() keeps the guard from raising specificity */
summary:where(:not([aria-disabled="true"])) {
	cursor: pointer;

	&:hover {
		background: var(--color-hover);
	}
}
```

## Optional: Expand all and Collapse all buttons

For non-exclusive accordions, Expand all and Collapse all buttons can improve user experience.

```html
<section class="accordion" id="support-accordion" aria-labelledby="support">
	<h2 id="support">Support</h2>
	<button type="button" commandfor="support-accordion" command="--expand-all">Expand all</button>
	<button type="button" commandfor="support-accordion" command="--collapse-all">Collapse all</button>
	<!-- Accordion items -->
</section>
```

```javascript
document.addEventListener("command", event => {
	if (event.command !== "--expand-all" && event.command !== "--collapse-all") return;

	// Command events fire on the commandfor target
	for (const details of event.target.querySelectorAll(":scope > details")) {
		details.open = event.command === "--expand-all";
	}
}, { capture: true }); // Command events do not bubble, hence capture
```

To improve user experience, disable the Expand All button when all items are already expanded, and the Collapse All button when all items are already collapsed.

## Styling

The disclosed content lives in the `::details-content` pseudo-element. While closed it is hidden with `content-visibility: hidden`, not `display: none`, which is what keeps it findable and lets its size animate. Style the item on `details`, the trigger on `summary`, and the content on `details::details-content`.

### Customizing the marker

`summary` renders as a list item, so its disclosure triangle is a `::marker`. Remove it with `list-style: none` and draw your own with `::before`, which unlike `::marker` can be sized, positioned, and animated.
Render the icon as a mask so it follows the text color, and rotate it for the closed state so one icon serves both states and both writing directions.
See {{ GUIDE_REF("icons") }} for more details on including and customizing icons via CSS.

Prefer keeping the marker directly next to the label text, not pushed to the opposite edge of the summary, especially for accordions that can get wide.
A marker far from its label makes it harder for users to associate with the correct label, and falls outside the field of view of users with low vision or screen magnification.
Right before the label text is preferable to right after, as it facilitates vertical scanning.

```css
summary {
	/* Removes the default triangle */
	list-style: none;
	display: flex;
	align-items: center;
	gap: 0.5ch;

	&::before {
		content: "";
		inline-size: 1em;
		block-size: 1em;
		flex-shrink: 0;
		background-color: currentColor;
		/* Example chevron pointing down, the open state; any single-color SVG works */
		mask: url("icons/chevron-down.svg") no-repeat center / contain;
		/* Closed: point toward the inline end */
		rotate: -90deg;
	}

	&:dir(rtl)::before {
		rotate: 90deg;
	}

	/* Rotate rather than swap icons, so the change can animate */
	details[open] > &::before {
		rotate: 0deg;
	}

	@media (prefers-reduced-motion: no-preference) {
		&::before {
			transition: rotate 0.2s;
		}
	}
}
```

### Slide up/down animation

To animate opening and closing, transition `block-size` between `0` and its intrinsic size, and transition `content-visibility` discretely so the content stays rendered until the collapse finishes.

```css
details::details-content {
	/* Lets block-size transition to and from its intrinsic auto size */
	interpolate-size: allow-keywords;
	overflow: clip;
	/* Keeps layout containment constant across states; otherwise content-visibility toggling it
	   makes the transition jitter when the content has outward margins (e.g. a nested p) */
	contain: layout;
}

details:not([open])::details-content {
	block-size: 0;
}

/* Only animate for users who have not asked for reduced motion */
@media (prefers-reduced-motion: no-preference) {
	details::details-content {
		transition: block-size, content-visibility, display;
		/* Example duration; match the surrounding motion design */
		transition-duration: 0.3s;
		transition-timing-function: ease-in-out;
		/* Defers content-visibility: hidden until the collapse ends */
		transition-behavior: allow-discrete;
	}
}
```

See {{ GUIDE_REF("animate-to-intrinsic-sizes") }} for more details.

## Excluding a `details` element’s contents from find-in-page

If it’s undesirable for a `details` element’s contents to be included in what’s matched with the browser’s find-in-page feature, hide the closed contents with `display: none`. To keep the slide animation, set the collapsed size in `@starting-style`. See {{ GUIDE_REF("animate-element-entry-exit") }} for more details.

```css
.accordion.unsearchable > details {
	/* Excludes the contents from find-in-page */
	&:not([open])::details-content {
		display: none;
	}

	/* Where the opening transition starts from, since display: none has no size */
	&[open]::details-content {
		@starting-style {
			block-size: 0;
		}
	}
}
```

## Fallback strategies

### Mutually exclusive `details`

{{ BASELINE_STATUS("details-name") }}

In browsers that don't support `name` on `details`, several items stay open, which is still a working (non-exclusive) accordion.
If the exclusivity is crucial to the user experience, you can implement a fallback. It also keeps always-open accordions working, since the open item still closes when another opens:

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

{{ BASELINE_STATUS("details-content") }}

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
