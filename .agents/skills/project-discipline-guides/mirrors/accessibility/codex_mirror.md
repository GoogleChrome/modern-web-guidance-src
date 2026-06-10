# Accessibility Development Redundancy Mirror

This is the accessibility guidance I would treat as broadly “common knowledge” and apply by default when building modern web interfaces, without needing a project-specific guide.

## Core Mental Model

Accessibility is not a separate feature. It is part of correctness, usability, semantic structure, interaction design, content design, and quality assurance.

A robust accessible implementation usually depends on:

- Semantic HTML first
- Native controls before custom widgets
- Keyboard support equivalent to pointer support
- Clear focus behavior
- Correct names, roles, states, and values
- Sufficient color contrast
- Usable text sizing and spacing
- Predictable navigation
- Error prevention and recovery
- Screen reader compatibility
- Support for reduced motion and other user preferences
- Progressive enhancement
- Testing with automated tools and manual assistive technology checks

Accessibility should be considered during design and implementation, not patched afterward.

## Standards And References

The baseline standards I would assume:

- WCAG 2.2 as the primary success criteria reference
- WCAG Level AA as the default target for most production sites
- WAI-ARIA Authoring Practices for custom widgets
- HTML accessibility mappings as the basis for native semantics
- Accessible Name and Description Computation for naming behavior
- Platform accessibility APIs as the reason semantic HTML matters
- Section 508 / EN 301 549 where legal compliance matters
- User agent and assistive technology behavior can vary, so test real combinations

WCAG is not an implementation manual. Passing automated checks does not prove accessibility. Failing automated checks is usually actionable.

## Prefer Semantic HTML

Use semantic HTML whenever possible.

Prefer:

```html
<header>
<nav>
<main>
<section>
<article>
<aside>
<footer>
<button>
<a>
<label>
input
select
textarea
fieldset
legend
table
caption
th
```

Avoid unnecessary `div` and `span` elements when a semantic element exists.

Semantic HTML gives browsers and assistive technologies built-in information about:

- Role
- Name
- State
- Value
- Keyboard behavior
- Focus behavior
- Form behavior
- Landmark navigation
- Heading navigation
- Table navigation

Do not recreate native HTML behavior with ARIA and JavaScript unless necessary.

## ARIA First Rule

Use native HTML first.

ARIA should be used when:

- Native semantics are insufficient
- A custom widget is genuinely necessary
- You need to expose dynamic state
- You need to connect labels, descriptions, errors, or relationships
- You need live-region announcements
- You need to clarify landmarks or complex regions

Do not use ARIA to change semantics unnecessarily.

Bad:

```html
<div role="button" onclick="submitForm()">Submit</div>
```

Good:

```html
<button type="submit">Submit</button>
```

Bad:

```html
<button role="heading" aria-level="2">Settings</button>
```

Good:

```html
<h2>Settings</h2>
<button>Open settings</button>
```

The five common ARIA rules:

1. Use native HTML instead of ARIA when possible.
2. Do not change native semantics unless necessary.
3. Interactive ARIA widgets must be keyboard accessible.
4. Do not hide focusable elements from assistive technologies.
5. Interactive elements need accessible names.

## Accessible Names

Every interactive element needs an accessible name.

Accessible names can come from:

- Visible text
- `<label>`
- `aria-label`
- `aria-labelledby`
- `alt`
- `title` in limited fallback cases
- Associated table headers
- Button text
- Link text
- SVG title if properly referenced, though visible text is usually better

Prefer visible text or `aria-labelledby` over `aria-label` when possible.

Good:

```html
<button>Save changes</button>
```

Good icon button:

```html
<button type="button" aria-label="Search">
  <svg aria-hidden="true" focusable="false">...</svg>
</button>
```

Good label association:

```html
<label for="email">Email address</label>
<input id="email" name="email" type="email" autocomplete="email">
```

Good `aria-labelledby`:

```html
<h2 id="billing-heading">Billing address</h2>
<section aria-labelledby="billing-heading">
  ...
</section>
```

Avoid redundant names:

```html
<button aria-label="Save">Save</button>
```

This is usually unnecessary and can become stale.

## Accessible Descriptions

Use descriptions for supporting information, not names.

```html
<label for="password">Password</label>
<p id="password-help">Use at least 12 characters.</p>
<input id="password" type="password" aria-describedby="password-help">
```

Use `aria-describedby` for:

- Help text
- Error messages
- Formatting hints
- Constraints
- Supplemental context

Use `aria-errormessage` when marking invalid controls, but ensure support and behavior are tested.

```html
<label for="zip">ZIP code</label>
<input
  id="zip"
  name="zip"
  aria-invalid="true"
  aria-errormessage="zip-error"
>
<p id="zip-error">Enter a valid 5-digit ZIP code.</p>
```

## Buttons And Links

Use links for navigation.

```html
<a href="/account">Account</a>
```

Use buttons for actions.

```html
<button type="button">Open menu</button>
```

Do not use links as buttons unless navigation actually occurs.

Avoid:

```html
<a href="#" onclick="openModal()">Open modal</a>
```

Prefer:

```html
<button type="button">Open modal</button>
```

Links need meaningful `href` values. Placeholder links are not accessible.

Avoid vague link text:

```html
<a href="/report">Click here</a>
```

Prefer:

```html
<a href="/report">Read the annual report</a>
```

Repeated links can share visible text if context makes them distinguishable, but unique text is often better.

## Keyboard Accessibility

All interactive functionality must be operable by keyboard.

Users must be able to:

- Reach controls with `Tab`
- Move backward with `Shift+Tab`
- Activate buttons with `Enter` and `Space`
- Activate links with `Enter`
- Use arrow keys where expected for composite widgets
- Escape dismissible overlays with `Escape`
- Understand current focus
- Avoid keyboard traps

Do not remove focusability from interactive controls.

Do not rely on mouse-only events:

```js
element.addEventListener("mouseover", showTooltip);
```

Also support focus:

```js
element.addEventListener("focus", showTooltip);
element.addEventListener("blur", hideTooltip);
```

Pointer interactions should usually have keyboard equivalents.

Avoid positive `tabindex`.

Bad:

```html
<div tabindex="5">...</div>
```

Use:

```html
<button>...</button>
```

or, only when necessary:

```html
<div tabindex="0">...</div>
```

Use `tabindex="-1"` for programmatic focus targets that should not be in the normal tab order.

```html
<h1 tabindex="-1">Checkout</h1>
```

## Focus Management

Focus must move predictably.

Common focus rules:

- Do not remove the visible focus indicator.
- After opening a modal dialog, move focus into it.
- Trap focus inside modal dialogs while open.
- Return focus to the triggering control when the dialog closes.
- After client-side navigation, move focus to the main heading or main container.
- After validation failure, focus the first invalid field or an error summary.
- Do not unexpectedly move focus during ordinary typing or reading.
- Do not focus disabled or hidden elements.
- Do not leave focus behind inside removed DOM nodes.
- Use `preventScroll` when moving focus would otherwise create disorienting jumps.

```js
heading.focus({ preventScroll: true });
```

Use `:focus-visible` for focus styling.

```css
:focus-visible {
  outline: 2px solid CanvasText;
  outline-offset: 2px;
}
```

Avoid:

```css
*:focus {
  outline: none;
}
```

If replacing outlines, provide a visible alternative with sufficient contrast.

## Focus Styling

Focus indicators should be:

- Clearly visible
- Not dependent on color alone
- At least as visible as the browser default
- Not clipped by overflow
- Present in high contrast / forced color modes
- Consistent across components

Good:

```css
.button:focus-visible {
  outline: 3px solid currentColor;
  outline-offset: 3px;
}
```

For complex components, style the actual focused item, not only a parent.

In Windows forced colors mode, prefer system colors and avoid relying only on box shadows.

```css
@media (forced-colors: active) {
  .button:focus-visible {
    outline: 2px solid Highlight;
  }
}
```

## Landmarks

Use landmarks to help users navigate.

Common landmarks:

```html
<header>
<nav aria-label="Primary">
<main>
<aside>
<footer>
<form>
<section aria-labelledby="...">
```

Every page should usually have one `<main>`.

Use labels when multiple landmarks of the same type exist.

```html
<nav aria-label="Primary">
<nav aria-label="Breadcrumb">
<nav aria-label="Pagination">
```

Avoid excessive landmarks. Too many landmarks reduce usefulness.

## Headings

Use headings to describe document structure.

```html
<h1>Account settings</h1>
<h2>Profile</h2>
<h2>Security</h2>
<h3>Password</h3>
```

Guidance:

- Use one primary `<h1>` for the page or view.
- Do not skip heading levels for styling reasons.
- Use CSS for visual size, not heading rank.
- Do not use headings only to make text large.
- Headings should describe the content that follows.
- Repeated components can use headings if they create meaningful structure.

Heading levels should reflect information architecture, not component nesting alone.

## Page Titles

Each page should have a meaningful `<title>`.

```html
<title>Billing settings | Acme</title>
```

For single-page apps, update `document.title` on route changes.

Titles should identify the current page or state, especially after navigation or errors.

## Language

Set the document language.

```html
<html lang="en">
```

Mark language changes inline when meaningful.

```html
<p>The phrase <span lang="fr">bon voyage</span> means have a good trip.</p>
```

This helps pronunciation, spellchecking, translation, and assistive technology.

## Text Alternatives

Images need appropriate alternatives.

Informative image:

```html
<img src="chart.png" alt="Revenue increased from $4M in 2023 to $6M in 2024.">
```

Decorative image:

```html
<img src="divider.png" alt="">
```

Functional image:

```html
<button>
  <img src="search.svg" alt="">
  Search
</button>
```

If an image is inside a link or button and is the only content, its `alt` should describe the action or destination.

```html
<a href="/home">
  <img src="logo.svg" alt="Acme home">
</a>
```

Avoid:

- `alt="image"`
- `alt="photo"`
- `alt="icon"`
- File names as alt text
- Duplicating nearby text unnecessarily
- Overly verbose alt text when surrounding text already explains the image

Complex images, charts, diagrams, and maps need nearby explanations, data tables, summaries, or long descriptions.

## SVG Accessibility

Decorative SVG:

```html
<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
  ...
</svg>
```

Meaningful inline SVG:

```html
<svg role="img" aria-labelledby="chart-title" viewBox="0 0 100 100">
  <title id="chart-title">Sales by region</title>
  ...
</svg>
```

Icon inside named button:

```html
<button aria-label="Delete item">
  <svg aria-hidden="true" focusable="false">...</svg>
</button>
```

Do not rely on SVG `<title>` alone for consistently accessible button names unless tested. Prefer naming the button.

## Icon Buttons

Icon-only buttons need accessible names.

```html
<button type="button" aria-label="Close">
  <svg aria-hidden="true" focusable="false">...</svg>
</button>
```

The accessible name should describe the action, not the icon.

Good:

```html
aria-label="Delete"
```

Bad:

```html
aria-label="Trash can"
```

If button state changes, include state separately when possible:

```html
<button type="button" aria-pressed="false">
  Bold
</button>
```

Avoid changing the accessible name based only on state unless the UX clearly requires it.

## Forms

Use real form controls.

```html
<form>
  <label for="name">Name</label>
  <input id="name" name="name" autocomplete="name">

  <button type="submit">Save</button>
</form>
```

Every input needs a label.

Do not use placeholders as labels.

Bad:

```html
<input placeholder="Email">
```

Good:

```html
<label for="email">Email</label>
<input id="email" name="email" type="email" autocomplete="email">
```

Use correct input types:

```html
<input type="email">
<input type="tel">
<input type="url">
<input type="number">
<input type="search">
<input type="date">
<input type="time">
<input type="password">
```

Use `autocomplete` tokens where appropriate:

```html
<input autocomplete="name">
<input autocomplete="email">
<input autocomplete="username">
<input autocomplete="current-password">
<input autocomplete="new-password">
<input autocomplete="street-address">
<input autocomplete="postal-code">
<input autocomplete="cc-number">
```

Group related controls with `fieldset` and `legend`.

```html
<fieldset>
  <legend>Notification preferences</legend>

  <label>
    <input type="checkbox" name="notify" value="email">
    Email
  </label>

  <label>
    <input type="checkbox" name="notify" value="sms">
    SMS
  </label>
</fieldset>
```

For required fields, use `required`.

```html
<input id="email" required>
```

If indicating required visually, expose it programmatically or include it in text.

```html
<label for="email">Email <span aria-hidden="true">*</span></label>
```

Better:

```html
<label for="email">Email required</label>
```

## Form Validation

Validation should be:

- Programmatically exposed
- Visible
- Specific
- Timely but not disruptive
- Associated with the relevant control
- Summarized for larger forms
- Not dependent on color alone

Example:

```html
<label for="email">Email</label>
<input
  id="email"
  name="email"
  type="email"
  required
  aria-invalid="true"
  aria-describedby="email-error"
>
<p id="email-error">Enter an email address in the format name@example.com.</p>
```

After submit failure, an error summary can help.

```html
<div role="alert" tabindex="-1" id="error-summary">
  <h2>There is a problem</h2>
  <ul>
    <li><a href="#email">Enter a valid email address.</a></li>
  </ul>
</div>
```

Then move focus to the summary or first invalid field depending on context.

Do not clear user-entered values after errors.

Do not validate only on blur if it creates noisy interruptions. Avoid announcing errors while the user is still typing unless necessary.

## Required, Disabled, And Readonly

Use native attributes.

```html
<input required>
<input disabled>
<input readonly>
```

`disabled` controls:

- Are not focusable
- Are not submitted
- Are announced as disabled
- May be skipped by assistive tech navigation

Use `aria-disabled="true"` only when an element must remain focusable while unavailable, and prevent activation manually.

```html
<button aria-disabled="true">Continue</button>
```

With `aria-disabled`, JavaScript must block activation.

Readonly controls can still be focusable and submitted.

## Placeholder Text

Placeholders are not labels.

Problems with placeholders:

- They disappear during input
- They often have low contrast
- They are not consistently announced as labels
- They make review harder
- They can be mistaken for entered values

Use placeholders only for supplemental examples, not essential instructions.

```html
<label for="phone">Phone number</label>
<input id="phone" autocomplete="tel" placeholder="555-123-4567">
```

## Custom Controls

Prefer native controls. If custom controls are necessary, implement:

- Correct role
- Accessible name
- Keyboard interaction
- Focus management
- State attributes
- Value attributes
- Disabled behavior
- High contrast styling
- Pointer, touch, keyboard, and screen reader behavior
- Form integration if relevant

A custom checkbox needs:

```html
<div
  role="checkbox"
  tabindex="0"
  aria-checked="false"
>
  Subscribe
</div>
```

But native is better:

```html
<label>
  <input type="checkbox">
  Subscribe
</label>
```

Custom widgets should follow expected keyboard conventions from ARIA Authoring Practices.

## `role` Usage

Common roles:

```html
role="button"
role="checkbox"
role="radio"
role="switch"
role="tablist"
role="tab"
role="tabpanel"
role="dialog"
role="alertdialog"
role="menu"
role="menuitem"
role="listbox"
role="option"
role="combobox"
role="grid"
role="row"
role="cell"
role="status"
role="alert"
role="region"
role="img"
```

Use roles only when the semantic meaning is correct.

Do not use `role="menu"` for ordinary site navigation. ARIA menus are application-style widgets with specific keyboard behavior. Use `<nav>` and links for navigation.

Do not use `role="application"` unless there is a strong reason. It changes screen reader interaction expectations and is often harmful.

Use `role="presentation"` or `role="none"` only to remove semantics from non-interactive elements.

Never hide or neutralize semantics of focusable/interacting elements.

## ARIA States And Properties

Common ARIA attributes:

```html
aria-label
aria-labelledby
aria-describedby
aria-controls
aria-expanded
aria-current
aria-selected
aria-checked
aria-pressed
aria-disabled
aria-hidden
aria-invalid
aria-required
aria-live
aria-atomic
aria-busy
aria-modal
aria-haspopup
aria-activedescendant
aria-owns
```

Use ARIA state accurately.

Disclosure button:

```html
<button
  type="button"
  aria-expanded="false"
  aria-controls="filters"
>
  Filters
</button>

<div id="filters" hidden>
  ...
</div>
```

Current page:

```html
<a href="/pricing" aria-current="page">Pricing</a>
```

Pressed toggle:

```html
<button type="button" aria-pressed="true">Bold</button>
```

Selected tab:

```html
<button role="tab" aria-selected="true" aria-controls="panel-1">
  Details
</button>
```

Do not use ARIA attributes as styling-only state if the exposed state is not true.

## `aria-hidden`

`aria-hidden="true"` hides content from assistive technologies.

Use it for:

- Decorative icons
- Duplicated visual text
- Offscreen visual-only decorations
- Background content made inert by a modal, if not using `inert`

Do not put `aria-hidden="true"` on focusable elements or ancestors of focusable elements.

Bad:

```html
<div aria-hidden="true">
  <button>Still focusable</button>
</div>
```

Use `hidden`, `display: none`, `inert`, or remove from DOM when content should be unavailable.

## `hidden`, CSS Hiding, And Visually Hidden Text

`hidden` removes content from visual display and accessibility tree.

```html
<div hidden>...</div>
```

`display: none` and `visibility: hidden` also hide from assistive technologies.

Visually hidden text should remain available to screen readers.

```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
```

Use visually hidden text for:

- Extra context for icon buttons
- Table captions when visual design omits them
- Skip link text
- Clarifying repeated controls

Do not use visually hidden content to dump excessive instructions for screen reader users only. Equivalent information should generally be available to everyone.

## `inert`

Use `inert` to make background content unavailable while a modal or blocking overlay is active.

```html
<main inert>
  ...
</main>
```

`inert` removes descendants from sequential focus navigation and the accessibility tree, and blocks interaction.

Use it for:

- Modal background content
- Temporarily disabled page regions
- Hidden offcanvas UI that remains in the DOM

Still manage focus explicitly for modals and restore focus when closing.

If supporting older browsers, use a polyfill or fallback with focus trapping and `aria-hidden`.

## Dialogs And Modals

Prefer the native `<dialog>` element when appropriate and tested.

```html
<dialog id="settings-dialog" aria-labelledby="settings-title">
  <h2 id="settings-title">Settings</h2>
  <form method="dialog">
    <button>Close</button>
  </form>
</dialog>
```

Open modal dialogs with:

```js
dialog.showModal();
```

Close with:

```js
dialog.close();
```

Modal requirements:

- Accessible name via heading, `aria-label`, or `aria-labelledby`
- Focus moves into the dialog when opened
- Focus stays inside while modal
- `Escape` closes unless there is a good reason
- Focus returns to the invoker after close
- Background is inert/unavailable
- Dialog is not announced without context
- Close button is available and named
- Large dialogs remain scrollable and usable
- Initial focus is chosen intentionally

Use `role="dialog"` and `aria-modal="true"` for custom dialogs.

```html
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
>
  <h2 id="dialog-title">Delete item</h2>
  ...
</div>
```

Use `role="alertdialog"` for urgent confirmation or destructive decisions requiring immediate attention.

## Popovers

Use the Popover API as progressive enhancement for non-modal overlays where supported.

```html
<button popovertarget="menu">Options</button>

<div id="menu" popover>
  ...
</div>
```

Popover is useful for:

- Lightweight menus
- Teaching UI
- Non-modal flyouts
- Small overlays
- Dismissible panels

A popover is not automatically a full accessible menu, dialog, tooltip, or combobox. You still need the correct semantics and keyboard behavior for the pattern.

For modal workflows, use `<dialog>` rather than popover.

For custom widgets, ensure focus, dismissal, and state are handled.

## Tooltips

Tooltips should not contain essential information.

Accessible tooltip guidance:

- Trigger on hover and focus
- Dismiss on blur, mouseout, and `Escape`
- Do not require pointer precision
- Do not contain interactive content
- Keep content short
- Associate with the trigger using `aria-describedby` when appropriate
- Ensure tooltip content is available to keyboard and assistive technology users

If the content is essential, place it visibly in the UI instead of hiding it in a tooltip.

## Menus

Use ARIA menus only for application-style command menus, not ordinary navigation.

For site navigation:

```html
<nav aria-label="Primary">
  <ul>
    <li><a href="/products">Products</a></li>
    <li><a href="/pricing">Pricing</a></li>
  </ul>
</nav>
```

For real menu buttons:

```html
<button
  type="button"
  aria-haspopup="menu"
  aria-expanded="false"
  aria-controls="actions-menu"
>
  Actions
</button>

<ul id="actions-menu" role="menu" hidden>
  <li role="none"><button role="menuitem">Rename</button></li>
  <li role="none"><button role="menuitem">Delete</button></li>
</ul>
```

Expected menu keyboard behavior usually includes:

- `Enter` / `Space` opens or activates
- Arrow keys move through items
- `Home` / `End` move to first/last
- `Escape` closes and returns focus
- Typeahead may be supported

Do not use `role="menuitem"` for regular navigation links unless implementing full menu behavior.

## Tabs

Tabs need coordinated roles, states, and focus behavior.

```html
<div role="tablist" aria-label="Account sections">
  <button
    role="tab"
    id="tab-profile"
    aria-selected="true"
    aria-controls="panel-profile"
  >
    Profile
  </button>
  <button
    role="tab"
    id="tab-security"
    aria-selected="false"
    aria-controls="panel-security"
    tabindex="-1"
  >
    Security
  </button>
</div>

<section
  role="tabpanel"
  id="panel-profile"
  aria-labelledby="tab-profile"
>
  ...
</section>

<section
  role="tabpanel"
  id="panel-security"
  aria-labelledby="tab-security"
  hidden
>
  ...
</section>
```

Expected behavior:

- Only active tab is usually in the tab order
- Arrow keys move focus between tabs
- `Home` and `End` move to first/last tab
- `Enter` or `Space` activates if activation is manual
- Active tab has `aria-selected="true"`
- Inactive panels are hidden

Automatic activation is acceptable when panels load instantly. Manual activation is better if loading is slow.

## Accordions And Disclosures

Use buttons for expandable section headers.

```html
<h2>
  <button
    type="button"
    aria-expanded="false"
    aria-controls="section-1"
  >
    Shipping address
  </button>
</h2>

<div id="section-1" hidden>
  ...
</div>
```

Use `aria-expanded` on the button that controls the content.

Keep heading structure meaningful.

Do not make non-button headings clickable without keyboard support.

## Carousels

Carousels are often accessibility risks.

If used:

- Provide pause/stop controls
- Do not auto-advance indefinitely
- Pause on focus and hover
- Do not move focus unexpectedly
- Announce slide changes only when user initiated
- Use real buttons for previous/next
- Expose current slide and total count
- Ensure all slide content is reachable
- Hide inactive slides appropriately if they are not meant to be read
- Make controls large enough for touch
- Avoid motion that conflicts with reduced-motion preferences

Prefer static content when carousel behavior is not essential.

## Tables

Use tables for tabular data, not layout.

Simple table:

```html
<table>
  <caption>Monthly expenses</caption>
  <thead>
    <tr>
      <th scope="col">Month</th>
      <th scope="col">Rent</th>
      <th scope="col">Utilities</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">January</th>
      <td>$1,500</td>
      <td>$180</td>
    </tr>
  </tbody>
</table>
```

Use:

- `<caption>` for table title/summary
- `<th>` for headers
- `scope="col"` and `scope="row"` for simple tables
- `headers` / `id` for complex tables when necessary

Avoid:

- Empty header cells
- Layout tables
- Div-based data tables without semantics
- Breaking table display semantics with CSS in ways that harm accessibility
- Overly complex responsive transformations that destroy relationships

For responsive tables, preserve header/data relationships.

## Lists

Use lists for list-like content.

```html
<ul>
  <li>Apples</li>
  <li>Oranges</li>
</ul>
```

Use ordered lists when sequence matters.

```html
<ol>
  <li>Create account</li>
  <li>Verify email</li>
  <li>Set password</li>
</ol>
```

Do not remove list semantics when the content is still a list.

Be careful with CSS resets that strip list markers and semantics.

## Navigation

Navigation should be consistent and predictable.

Use:

```html
<nav aria-label="Primary">
```

Current page:

```html
<a href="/settings" aria-current="page">Settings</a>
```

Breadcrumbs:

```html
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/account">Account</a></li>
    <li aria-current="page">Settings</li>
  </ol>
</nav>
```

Pagination:

```html
<nav aria-label="Pagination">
  <a href="?page=1">Previous</a>
  <a href="?page=3" aria-current="page">Page 3</a>
  <a href="?page=4">Next</a>
</nav>
```

Avoid navigation that changes on focus or hover unexpectedly.

## Skip Links

Provide a skip link for pages with repeated navigation.

```html
<a class="skip-link" href="#main">Skip to main content</a>

<main id="main">
  ...
</main>
```

CSS:

```css
.skip-link {
  position: absolute;
  left: 1rem;
  top: 1rem;
  transform: translateY(-200%);
}

.skip-link:focus {
  transform: translateY(0);
}
```

Ensure the target can receive focus if needed.

```html
<main id="main" tabindex="-1">
```

## Single Page Apps

For client-side routing:

- Update document title
- Move focus to the new page heading or main region
- Announce route changes when appropriate
- Preserve expected browser history
- Ensure back/forward works
- Avoid scroll jumps unless intentional
- Restore scroll thoughtfully
- Do not leave focus on removed controls
- Ensure landmarks and headings represent the current view

Example route focus target:

```html
<main id="main" tabindex="-1">
  <h1>Orders</h1>
</main>
```

```js
document.title = "Orders | Acme";
document.querySelector("#main")?.focus();
```

## Live Regions

Use live regions for dynamic updates that are not focused.

Polite status:

```html
<div role="status" aria-live="polite"></div>
```

Assertive alert:

```html
<div role="alert"></div>
```

Guidance:

- Use `polite` for non-urgent updates.
- Use `assertive` only for urgent interruptions.
- Keep announcements short.
- Do not announce every keystroke unless necessary.
- Insert or update text after the live region exists in the DOM.
- Avoid duplicate announcements.
- Use `aria-atomic="true"` when the whole message should be read.
- Use `aria-busy="true"` while a region is loading.

Example:

```html
<p id="save-status" role="status" aria-live="polite"></p>
```

```js
status.textContent = "Changes saved.";
```

Use live regions for:

- Save success
- Async errors
- Search result counts
- Cart updates
- Background process completion
- Form submission status

Do not use live regions as a replacement for visible feedback.

## Loading States

Loading states should be communicated visually and programmatically.

```html
<section aria-busy="true" aria-labelledby="results-title">
  <h2 id="results-title">Search results</h2>
  ...
</section>
```

For buttons:

```html
<button type="submit" disabled>
  Saving...
</button>
```

Consider whether disabled is appropriate. If disabling prevents double submit, it is often fine. If the user needs to understand why an action is unavailable, provide explanation.

For spinners, include text.

```html
<div role="status">
  <span class="spinner" aria-hidden="true"></span>
  Loading orders...
</div>
```

Avoid spinner-only loading indicators.

## Motion And Animation

Respect reduced motion.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms;
    animation-iteration-count: 1;
    scroll-behavior: auto;
    transition-duration: 0.01ms;
  }
}
```

Better when possible: selectively remove non-essential motion rather than globally flattening everything.

Avoid:

- Parallax that cannot be disabled
- Auto-playing motion
- Flashing content
- Large unexpected zoom/pan
- Scroll-jacking
- Motion required to understand content

Use `prefers-reduced-motion` in JavaScript:

```js
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
```

Do not animate focus movement in a way that delays usability.

## Flashing And Seizure Safety

Avoid content that flashes more than three times per second.

Avoid high-contrast flashing, especially red flashes.

Provide controls for animated content.

Do not use strobe effects.

## Color And Contrast

Text contrast default target:

- 4.5:1 for normal text
- 3:1 for large text
- 3:1 for graphical objects and UI components
- Disabled controls are exempt but should still be understandable where possible

Do not use color alone to convey meaning.

Bad:

```html
<p class="red">Required</p>
```

Good:

```html
<p>
  <span aria-hidden="true">*</span>
  Required fields are marked with an asterisk.
</p>
```

For charts, use:

- Labels
- Patterns
- Shapes
- Direct annotations
- Legends with text
- Tooltips that are keyboard accessible if essential

Ensure contrast in:

- Text
- Placeholder text
- Borders that indicate state
- Focus indicators
- Icons
- Disabled controls where useful
- Hover states
- Selection states
- Error states
- High contrast mode

## Forced Colors And High Contrast

Support forced colors.

```css
@media (forced-colors: active) {
  .button {
    border: 1px solid ButtonText;
  }

  .button:focus-visible {
    outline: 2px solid Highlight;
  }
}
```

Avoid relying only on:

- Box shadow
- Background gradients
- Low-contrast borders
- Background images
- Color-only state

Use system colors when appropriate:

```css
color: CanvasText;
background: Canvas;
border-color: ButtonText;
```

Avoid disabling forced color adjustments unless absolutely necessary.

```css
forced-color-adjust: none;
```

Use it sparingly.

## User Preferences Media Queries

Modern accessibility-related media queries include:

```css
@media (prefers-reduced-motion: reduce) {}
@media (prefers-reduced-transparency: reduce) {}
@media (prefers-contrast: more) {}
@media (prefers-color-scheme: dark) {}
@media (forced-colors: active) {}
```

Use them as progressive enhancement.

`prefers-reduced-transparency` and `prefers-contrast` may not be uniformly supported everywhere, so design should remain usable without them.

## Text Sizing And Zoom

Interfaces should work at:

- 200% browser zoom
- Large default font sizes
- Mobile text scaling
- Narrow viewports
- Reflow without horizontal scrolling for normal content

Use relative units for text:

```css
font-size: 1rem;
line-height: 1.5;
```

Avoid fixed pixel heights for text containers.

Avoid clipping text:

```css
overflow: hidden;
white-space: nowrap;
```

unless truncation is intentional and full content is available.

Support WCAG text spacing expectations:

- Increased line height
- Paragraph spacing
- Letter spacing
- Word spacing

Do not break when users override spacing.

Avoid disabling zoom.

Bad:

```html
<meta name="viewport" content="user-scalable=no">
```

Good:

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

## Responsive Accessibility

Responsive design must preserve accessibility.

Check:

- Content order matches visual order
- Keyboard order is logical
- Focus is visible
- Controls remain large enough
- No content is clipped
- No horizontal scrolling for ordinary text
- Landmarks and headings remain meaningful
- Menus are keyboard accessible
- Touch targets are large enough
- Modals fit small screens
- Sticky headers do not cover focused content

Avoid CSS `order` or grid placement that creates a mismatch between visual order and DOM/focus order.

## Touch And Pointer Accessibility

Touch targets should be large enough and spaced well.

Common target guidance:

- At least 24 CSS px for WCAG 2.2 minimum target size in many contexts
- 44 by 44 CSS px remains a strong practical target
- Provide spacing between adjacent controls
- Avoid tiny close buttons
- Do not require drag gestures without alternatives
- Do not require multi-pointer gestures without alternatives
- Support keyboard and single-pointer alternatives

Pointer cancellation:

- Avoid triggering destructive actions on pointer down
- Prefer activation on pointer up/click
- Allow users to cancel by moving away before release
- Confirm destructive actions where appropriate

## Drag And Drop

Drag-and-drop must have accessible alternatives.

Provide:

- Keyboard controls
- Buttons for move up/down
- Select menus for destination
- Clear instructions
- Status announcements
- Focus preservation
- Undo where possible

Example alternatives:

```html
<button type="button">Move item up</button>
<button type="button">Move item down</button>
```

Do not make drag the only way to reorder or move content.

## Gestures

Do not require complex gestures as the only way to complete a task.

If supporting:

- Swipe
- Pinch
- Drag
- Long press
- Multi-touch

Provide alternatives using buttons or other simple controls.

## Target Size

Interactive targets should be easy to activate.

Consider:

- Actual clickable area, not just visual icon
- Spacing between controls
- Touch input
- Motor impairments
- Zoomed layouts
- Dense toolbars
- Mobile devices

Icon buttons should have adequate padding.

```css
.icon-button {
  inline-size: 2.75rem;
  block-size: 2.75rem;
}
```

## Content Order

DOM order should match reading and focus order.

Avoid using CSS to visually rearrange content in ways that make screen reader or keyboard order confusing.

Bad pattern:

```css
.sidebar {
  order: -1;
}
```

This may visually move content before main content while keyboard order remains later.

Use source order as the accessibility order.

## Reading Level And Content Clarity

Accessible content is clear content.

Use:

- Plain language
- Specific headings
- Descriptive button text
- Descriptive link text
- Short paragraphs
- Lists where appropriate
- Clear error messages
- Consistent terminology
- Defined abbreviations
- Helpful page titles

Avoid:

- Jargon without explanation
- Instructions based only on sensory characteristics
- “Click the green button”
- “Use the menu on the right”
- Ambiguous labels like “Submit” when more specific text would help

Better:

```html
<button>Save billing address</button>
```

instead of:

```html
<button>Submit</button>
```

## Sensory Characteristics

Do not rely only on:

- Color
- Shape
- Size
- Position
- Sound
- Motion

Bad:

```text
Press the green button to continue.
```

Good:

```text
Press Continue to continue.
```

## Audio And Video

Media accessibility includes:

- Captions for prerecorded video with audio
- Captions for live video when required
- Transcripts for audio
- Audio descriptions or equivalent alternatives for important visual-only content
- Keyboard-accessible media controls
- No autoplaying audio
- Pause/stop controls
- Visible focus indicators on controls
- Sufficient contrast in custom controls

Use native media controls when possible.

```html
<video controls>
  <source src="demo.mp4" type="video/mp4">
  <track kind="captions" src="captions.vtt" srclang="en" label="English">
</video>
```

Do not autoplay audio without user initiation.

If video autoplays silently, provide controls and respect reduced motion.

## Autoplaying Content

Avoid autoplay.

If content moves, blinks, scrolls, or updates automatically for more than a short duration, provide controls to pause, stop, or hide it.

Examples:

- Carousels
- Tickers
- Animated ads
- Auto-updating feeds
- Background videos

Do not reset pause state unexpectedly.

## Time Limits

Avoid time limits when possible.

If a time limit exists:

- Warn users
- Allow extension
- Allow disabling when feasible
- Preserve work
- Provide accessible countdowns only when useful
- Avoid overly frequent live announcements

For security sessions, warn before expiration and provide a way to extend.

## Authentication

Authentication should not rely only on cognitive function tests.

Avoid making users solve inaccessible puzzles.

CAPTCHA alternatives:

- Passkeys
- Email verification
- SMS with accessible fallback
- Server-side risk detection
- Accessible CAPTCHA alternatives
- Human support path for critical services

One-time code inputs should support autocomplete:

```html
<input
  inputmode="numeric"
  autocomplete="one-time-code"
>
```

Password fields should support password managers:

```html
<input
  type="password"
  autocomplete="current-password"
>
```

Do not block paste into password or code fields.

## Cognitive Accessibility

Support users with cognitive, memory, language, and attention differences.

Good practices:

- Keep workflows predictable
- Use consistent navigation
- Make important actions clear
- Avoid unnecessary time pressure
- Provide confirmation for destructive actions
- Provide undo where possible
- Break complex tasks into steps
- Show progress in multi-step flows
- Preserve entered data
- Avoid surprise context changes
- Use clear labels and instructions
- Provide examples for complex formats
- Avoid distracting motion
- Avoid dense unexplained interfaces

## Errors And Recovery

Good error messages:

- Identify the field
- Explain the problem
- Explain how to fix it
- Are programmatically associated
- Are visible
- Are not color-only
- Preserve user input

Bad:

```text
Invalid input.
```

Good:

```text
Enter an expiration date in MM/YY format.
```

For destructive actions:

- Use clear names
- Confirm where appropriate
- Explain consequences
- Provide undo if possible

## Status Messages

Status messages should be visible and announced when relevant.

Examples:

```html
<div role="status">File uploaded.</div>
```

Use for non-focus-changing updates.

Do not steal focus for routine status updates.

Use alerts sparingly:

```html
<div role="alert">Payment failed. Check your card details.</div>
```

## Search

Search forms should be semantic.

```html
<form role="search">
  <label for="site-search">Search</label>
  <input id="site-search" name="q" type="search">
  <button type="submit">Search</button>
</form>
```

For dynamic results:

- Announce result counts
- Keep keyboard focus predictable
- Do not update results so aggressively that screen readers are interrupted
- Provide loading status
- Preserve query text

## Comboboxes And Autocomplete

Comboboxes are complex. Prefer native controls when possible.

Native alternatives:

```html
<select>
```

```html
<input list="cities">
<datalist id="cities">
  <option value="New York">
  <option value="Los Angeles">
</datalist>
```

If implementing a custom combobox, handle:

- `role="combobox"`
- Accessible name
- Expanded/collapsed state
- Popup relationship
- Options
- Active descendant or roving focus
- Keyboard navigation
- Escape behavior
- Enter selection
- Typing behavior
- Screen reader announcements
- Mobile behavior
- Form submission
- Loading state
- No results state

ARIA combobox behavior is easy to get wrong. Use a well-tested component when possible.

## Selects, Listboxes, And Radios

Use native controls unless custom behavior is required.

Radio group:

```html
<fieldset>
  <legend>Shipping speed</legend>

  <label>
    <input type="radio" name="shipping" value="standard">
    Standard
  </label>

  <label>
    <input type="radio" name="shipping" value="express">
    Express
  </label>
</fieldset>
```

Select:

```html
<label for="country">Country</label>
<select id="country" name="country">
  <option value="">Select a country</option>
  <option value="us">United States</option>
</select>
```

Do not replace select controls for styling alone unless the custom replacement is fully accessible.

## Switches

Use a checkbox for binary settings, or `role="switch"` when the on/off metaphor is important.

Native checkbox:

```html
<label>
  <input type="checkbox" name="marketing">
  Receive marketing emails
</label>
```

Switch:

```html
<button type="button" role="switch" aria-checked="false">
  Email notifications
</button>
```

The label should not change between on and off if state is exposed through `aria-checked`.

## Toggle Buttons

Use `aria-pressed` for toggle buttons.

```html
<button type="button" aria-pressed="false">
  Bold
</button>
```

Do not use `aria-checked` on buttons unless the role supports it.

Keep labels stable where possible.

## Progress Indicators

Use native progress when appropriate.

```html
<label for="upload-progress">Upload progress</label>
<progress id="upload-progress" max="100" value="70">70%</progress>
```

For indeterminate progress:

```html
<progress>Loading...</progress>
```

For custom progress bars:

```html
<div
  role="progressbar"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow="70"
  aria-label="Upload progress"
></div>
```

## Sliders

Prefer native range inputs.

```html
<label for="volume">Volume</label>
<input id="volume" type="range" min="0" max="100" value="50">
```

Custom sliders need:

- `role="slider"`
- Name
- `aria-valuemin`
- `aria-valuemax`
- `aria-valuenow`
- `aria-valuetext` when numeric value is not meaningful
- Keyboard support for arrow keys, Home, End, Page Up, Page Down where appropriate
- Touch and pointer support

## Disclosure Navigation

For mobile nav menus:

```html
<button
  type="button"
  aria-expanded="false"
  aria-controls="primary-navigation"
>
  Menu
</button>

<nav id="primary-navigation" aria-label="Primary" hidden>
  ...
</nav>
```

When opened:

- Update `aria-expanded`
- Reveal menu
- Ensure focus order is logical
- Allow Escape to close
- Return focus when closing where appropriate

Do not use hover-only navigation.

## Hover And Focus Content

Content that appears on hover or focus should be:

- Dismissible
- Hoverable if pointer-triggered
- Persistent long enough to use
- Triggered by focus as well as hover
- Not obscure important content unless dismissible

This applies to:

- Tooltips
- Popovers
- Menus
- Preview cards
- Help bubbles

## Modality-Aware Focus

Use `:focus-visible` to show focus mainly for keyboard modality while preserving accessibility.

```css
:focus-visible {
  outline: 2px solid currentColor;
}
```

Do not hide focus for mouse users if doing so harms discoverability or forced-colors behavior.

## CSS Generated Content

Do not put essential text only in CSS generated content.

Bad:

```css
.required::after {
  content: "required";
}
```

Generated content may not be reliably exposed across assistive technologies.

Essential content should exist in the DOM.

## Visual Reordering

Be careful with:

```css
order
grid-area
flex-direction: row-reverse
```

These can create mismatches between visual order and DOM/focus order.

Use DOM order as the meaningful order.

## Offscreen Content

Do not place focusable content offscreen unless it is intentionally reachable, such as a skip link.

Bad:

```css
.panel {
  position: absolute;
  left: -9999px;
}
```

If hidden, use `hidden`, `display: none`, or `inert` depending on intent.

## Responsive Hidden Content

When hiding content visually at breakpoints, ensure accessibility state matches.

If content should be unavailable:

```html
<div hidden>
```

or CSS `display: none`.

If content is visually hidden but should remain announced, use a visually hidden utility.

Do not leave duplicate navigation exposed twice to screen readers unless both are needed and clearly labeled.

## Canvas Accessibility

Canvas content is not inherently accessible.

Provide:

- Fallback content inside `<canvas>`
- DOM equivalents for interactive elements
- Text alternatives
- Keyboard controls
- ARIA where appropriate
- Data tables for charts
- Separate accessible controls

```html
<canvas aria-label="Sales chart from January to June">
  Sales increased steadily from January to June.
</canvas>
```

For complex or interactive canvas apps, maintain an accessible DOM representation.

## WebGL And 3D

WebGL/3D scenes need accessible alternatives.

Provide:

- Text descriptions
- Keyboard controls
- Reduced motion mode
- Non-visual alternatives for essential information
- UI controls outside the canvas using semantic HTML
- Avoid color-only distinctions
- Avoid motion-triggering camera behavior where possible

Do not make critical information available only through 3D visual inspection.

## Maps

Maps need accessible alternatives.

Provide:

- Searchable list of locations
- Addresses in text
- Directions in text
- Keyboard-accessible controls
- Accessible marker names
- Sufficient contrast
- Zoom controls
- Avoid keyboard traps inside map widgets

For store locators, a list is usually as important as the map.

## Charts And Data Visualization

Charts need:

- Text summary
- Accessible data table or downloadable data
- Labels
- Legends
- Non-color encodings
- Keyboard-accessible interactive points if interactive
- Announcements for selected data
- Good contrast
- Responsive readability

Do not rely on hover-only tooltips for essential values.

## Internationalization And Accessibility

Accessibility and i18n overlap.

Use:

- Correct `lang`
- Logical DOM order
- Native form controls
- Text that can expand
- Direction support with `dir`
- Avoid hard-coded visual positions in instructions
- Avoid concatenated strings that break grammar
- Support translated labels and errors

For RTL:

```html
<html lang="ar" dir="rtl">
```

Prefer logical CSS properties:

```css
margin-inline-start
padding-inline-end
border-start-start-radius
```

## Accessible Layout

Good layout accessibility includes:

- Clear hierarchy
- Predictable grouping
- Adequate spacing
- No content overlap
- No text clipping
- Logical source order
- Landmarks
- Meaningful headings
- Persistent context in complex flows
- Avoiding sticky elements that obscure focused content

When using sticky headers, account for focus and anchor offsets.

```css
:target {
  scroll-margin-block-start: 5rem;
}
```

Also useful:

```css
.focus-target {
  scroll-margin-block-start: 5rem;
}
```

## Tables Versus Cards

Cards are not a replacement for data tables when users need to compare structured values.

If using cards for responsive data:

- Preserve labels for values
- Provide headings for each card
- Keep actions named clearly
- Maintain logical focus order
- Avoid making the entire card clickable if it contains nested controls

If the whole card is clickable, avoid nested interactive controls or use a different interaction design.

## Nested Interactive Elements

Do not nest interactive controls.

Bad:

```html
<button>
  View order
  <a href="/order/1">Details</a>
</button>
```

Bad:

```html
<a href="/product">
  Product
  <button>Add to cart</button>
</a>
```

Use separate controls.

## Clickable Cards

Avoid making large cards clickable when they contain other controls.

Better:

```html
<article>
  <h2><a href="/product/1">Product name</a></h2>
  <button>Add to cart</button>
</article>
```

If making the card visually clickable, ensure:

- One actual link receives focus
- Focus styling covers the card if desired
- No nested interactive elements conflict
- Link text is meaningful

## Disabled Buttons And Discoverability

Disabled buttons can hide information from keyboard and screen reader users.

If users need to understand why an action is unavailable:

- Keep the control focusable with `aria-disabled`
- Provide explanation
- Or show requirements nearby

```html
<button type="button" aria-disabled="true" aria-describedby="save-help">
  Save
</button>
<p id="save-help">Add a billing address before saving.</p>
```

Then prevent activation in JavaScript.

## Notifications And Toasts

Toasts should be accessible.

Use:

- Visible text
- Live region announcement
- Reasonable duration
- Manual dismiss if persistent
- No essential information disappearing too quickly
- Focus movement only for urgent/action-required messages
- Accessible close button
- Pause on hover/focus if auto-dismissed

Example:

```html
<div role="status">Settings saved.</div>
```

For undo:

```html
<div role="status">
  Message archived.
  <button type="button">Undo</button>
</div>
```

If the toast contains an interactive control, do not rely only on a passive live region. Ensure keyboard users can reach it.

## Banners And Cookie Notices

Cookie banners and consent dialogs should:

- Be keyboard accessible
- Not trap focus unless modal
- Have clear buttons
- Avoid deceptive patterns
- Expose dialog semantics if modal
- Preserve focus
- Not block zoom or scrolling unnecessarily
- Be dismissible where legally allowed
- Avoid covering focused content

## Infinite Scroll

Infinite scroll can harm accessibility.

If used:

- Provide pagination or “Load more” alternative
- Preserve focus after loading
- Announce newly loaded content
- Do not move focus unexpectedly
- Allow users to reach the footer
- Update URL/history where appropriate
- Avoid endless automatic loading

Prefer explicit “Load more” buttons.

```html
<button type="button">Load more results</button>
```

## Virtualized Lists

Virtualization can break assistive tech expectations.

Consider:

- Accurate item counts
- Stable focus
- Proper announcements
- Avoiding removal of focused items
- Preserving find-in-page where important
- Screen reader access to list contents
- Correct `aria-rowcount`, `aria-posinset`, `aria-setsize` only when needed and accurate

Do not add ARIA metadata that lies about what is actually navigable.

## Sortable Tables

Sortable table headers should use buttons.

```html
<th scope="col">
  <button type="button" aria-sort="ascending">
    Name
  </button>
</th>
```

Actually, `aria-sort` belongs on the header cell, not the button.

Better:

```html
<th scope="col" aria-sort="ascending">
  <button type="button">Name</button>
</th>
```

Indicate sort direction visually and programmatically.

Only one column should usually have `aria-sort` active.

## Tree Views

Tree views are complex and should follow ARIA patterns.

Requirements include:

- `role="tree"`
- `role="treeitem"`
- `role="group"`
- `aria-expanded`
- Roving tabindex or active descendant
- Arrow key behavior
- Typeahead
- Selection state if selectable
- Clear labeling

Use a tested component where possible.

Do not use tree views for ordinary nested navigation unless the interaction pattern is truly needed.

## Grids

ARIA grids are application widgets, not layout grids.

Use native tables for tabular data unless spreadsheet-like interaction is needed.

ARIA grid requires:

- Cell focus model
- Arrow key navigation
- Row/column semantics
- Selection semantics if relevant
- Editing behavior if editable
- Screen reader testing

Do not apply `role="grid"` to CSS grid layouts.

## Searchable Selects

For custom searchable selects:

- Prefer combobox pattern
- Keep input labeled
- Announce expanded state
- Announce result count when helpful
- Support keyboard navigation
- Support escape to close
- Support clear selection
- Handle no results
- Do not trap screen reader virtual cursor unnecessarily
- Ensure selected value is submitted with form

## Date Pickers

Date pickers are difficult to make accessible.

Prefer:

```html
<input type="date">
```

when acceptable.

If custom:

- Provide direct text input alternative
- Use clear date format hints
- Support keyboard navigation
- Expose month/year
- Expose selected date
- Expose today’s date if relevant
- Avoid relying only on visual calendar position
- Allow typing
- Validate clearly
- Support localization

## File Inputs

Use native file input when possible.

```html
<label for="resume">Resume</label>
<input id="resume" type="file" accept=".pdf,.doc,.docx">
```

For custom styling, keep the native input accessible.

Expose:

- Accepted formats
- Size limits
- Upload status
- Errors
- File removal controls
- Progress
- Success state

Do not use drag-and-drop as the only upload method.

## Captcha

Avoid inaccessible CAPTCHA.

If used:

- Provide accessible alternatives
- Do not rely only on images or audio
- Do not create time pressure
- Ensure keyboard access
- Preserve form data after failure
- Consider privacy and usability impacts

Prefer risk-based detection and non-interactive approaches.

## Security And Accessibility

Security controls should remain accessible.

Do not:

- Block paste in password fields
- Break password managers
- Use inaccessible CAPTCHA
- Hide errors
- Force short session timeouts without warning
- Make MFA impossible for assistive tech users

Use:

```html
autocomplete="current-password"
autocomplete="new-password"
autocomplete="one-time-code"
```

## Printing And Accessibility

Print styles should preserve readable content.

For accessibility:

- Do not hide essential content in print
- Expand URLs where useful
- Preserve sufficient contrast
- Avoid printing interactive-only instructions
- Ensure form summaries are readable

## Accessibility In CSS

CSS can help or harm accessibility.

Good:

```css
:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .animated {
    animation: none;
  }
}
```

Avoid:

```css
outline: none;
```

Avoid text hiding hacks unless intentional and tested.

Avoid fixed heights with dynamic text.

Avoid low-contrast placeholder text.

Avoid `cursor: pointer` on non-interactive elements as a substitute for real semantics.

Use logical properties for better writing-mode support.

## Accessibility In JavaScript

JavaScript should enhance accessibility, not replace native behavior unnecessarily.

Principles:

- Listen to both pointer and keyboard events when needed
- Use `click` for activation where possible because keyboard activation of native controls fires click
- Avoid keypress; use `keydown` or `keyup`
- Do not override browser shortcuts unnecessarily
- Do not trap focus except in true modals
- Clean up event listeners
- Restore focus after DOM changes
- Keep ARIA state synchronized with visual state
- Avoid fake disabled states
- Avoid fake links/buttons
- Handle async loading with status updates
- Preserve user input
- Avoid unexpected context changes

Example disclosure:

```js
const button = document.querySelector("[aria-controls='filters']");
const panel = document.getElementById(button.getAttribute("aria-controls"));

button.addEventListener("click", () => {
  const expanded = button.getAttribute("aria-expanded") === "true";

  button.setAttribute("aria-expanded", String(!expanded));
  panel.hidden = expanded;
});
```

## Keyboard Event Handling

Use standard keys.

```js
element.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    close();
  }
});
```

Use `event.key`, not deprecated keyCode.

Common keys:

```js
"Enter"
" "
"Escape"
"ArrowUp"
"ArrowDown"
"ArrowLeft"
"ArrowRight"
"Home"
"End"
"PageUp"
"PageDown"
"Tab"
```

Do not prevent default unless necessary.

If implementing custom button behavior, both `Enter` and `Space` should work. But prefer native `<button>`.

## Roving Tabindex

Composite widgets often use roving tabindex.

Pattern:

```html
<div role="toolbar" aria-label="Text formatting">
  <button tabindex="0">Bold</button>
  <button tabindex="-1">Italic</button>
  <button tabindex="-1">Underline</button>
</div>
```

Arrow keys move focus and update tabindex.

Use for:

- Tabs
- Toolbars
- Menus
- Radio-like custom groups
- Grids
- Listboxes in some patterns

Only one item in the composite is in the tab order.

## `aria-activedescendant`

`aria-activedescendant` lets focus remain on a container or input while indicating an active child.

Common for:

- Comboboxes
- Listboxes
- Grids
- Autocomplete

Requirements:

- Container has DOM focus
- Active child has an `id`
- `aria-activedescendant` references that `id`
- Visual active state matches ARIA state
- The active item is scrolled into view

```html
<input
  role="combobox"
  aria-expanded="true"
  aria-controls="results"
  aria-activedescendant="option-2"
>

<ul id="results" role="listbox">
  <li id="option-1" role="option">Alpha</li>
  <li id="option-2" role="option">Beta</li>
</ul>
```

## Announcing Dynamic Counts

For dynamic results:

```html
<p role="status" aria-live="polite">
  12 results found.
</p>
```

Avoid announcing huge content updates. Announce summaries.

## Accessible State Synchronization

Whenever UI state changes, synchronize:

- DOM visibility
- ARIA state
- CSS state
- Focusability
- Keyboard behavior
- Screen reader exposure

Example:

- `aria-expanded="true"`
- Panel is visible
- Panel is focusable if needed
- Trigger styling shows open state

Do not let visual state and ARIA state diverge.

## Progressive Enhancement

Build baseline functionality with HTML.

Then enhance with CSS and JS.

Good baseline:

```html
<form action="/search" method="get">
  <label for="q">Search</label>
  <input id="q" name="q">
  <button>Search</button>
</form>
```

Enhanced behavior can add autocomplete, dynamic results, and live announcements.

If JavaScript fails, critical tasks should still work when practical.

## Graceful Degradation

When using newer APIs:

- Provide fallback behavior
- Feature-detect
- Avoid user-agent sniffing
- Keep semantics valid without enhancement
- Do not require unsupported APIs for critical flows

Example:

```js
if ("showModal" in HTMLDialogElement.prototype) {
  dialog.showModal();
} else {
  openFallbackDialog();
}
```

## Modern APIs Useful For Accessibility

Modern browser features I would consider useful:

- `<dialog>`
- `inert`
- Popover API
- `:focus-visible`
- `:has()` for styling state without extra JS
- `prefers-reduced-motion`
- `prefers-color-scheme`
- `prefers-contrast`
- `forced-colors`
- CSS logical properties
- `accent-color`
- `color-scheme`
- `scroll-margin`
- `scroll-padding`
- `text-wrap`
- `ResizeObserver`
- `IntersectionObserver`
- `MutationObserver`
- `AbortController` for listener cleanup
- Form validation APIs
- Constraint validation
- Custom elements with careful semantic design
- ElementInternals for form-associated custom elements where appropriate
- `ariaNotify` if/where available as progressive enhancement only
- View Transitions API only with reduced-motion safeguards

Use cutting-edge APIs only when fallback preserves accessibility.

## Constraint Validation API

Native validation can help but often needs custom messaging for usability.

```js
const input = document.querySelector("#email");

if (!input.validity.valid) {
  input.setCustomValidity("Enter a valid email address.");
} else {
  input.setCustomValidity("");
}
```

Methods/properties:

```js
input.validity
input.validationMessage
input.checkValidity()
input.reportValidity()
input.setCustomValidity()
form.requestSubmit()
```

Use `requestSubmit()` rather than manually dispatching submit when you want native submit behavior.

```js
form.requestSubmit();
```

## Custom Elements

Custom elements need extra care.

Default custom elements have no useful semantics.

For accessible custom elements:

- Prefer wrapping native elements internally
- Expose labels
- Forward focus appropriately
- Reflect state to ARIA where needed
- Support keyboard interaction
- Support forms if form-associated
- Test with screen readers
- Avoid closed shadow roots when accessibility/testing requires inspection
- Use `delegatesFocus` carefully
- Ensure accessible names cross shadow boundaries as expected

Form-associated custom elements can use `ElementInternals`.

```js
class MyInput extends HTMLElement {
  static formAssociated = true;

  constructor() {
    super();
    this.internals = this.attachInternals();
  }
}
```

Use only when necessary; native form controls are usually better.

## Shadow DOM

Shadow DOM can complicate accessibility.

Consider:

- Label association
- Form participation
- Focus delegation
- Accessible names
- ARIA relationships across shadow boundaries
- Testing support
- Exposing parts for focus styles
- Slot content semantics

Prefer native controls inside shadow DOM and test thoroughly.

Do not assume ARIA references always work across shadow boundaries.

## Web Components

Accessible web components should:

- Have documented keyboard behavior
- Use semantic internal markup
- Expose accessible names
- Reflect important states
- Support disabled/readonly where applicable
- Support forms when relevant
- Provide focus methods when useful
- Avoid surprising tab order
- Work with screen readers
- Support high contrast and reduced motion
- Avoid trapping users inside shadow DOM

## Native Form APIs

Use modern form APIs:

```js
const data = new FormData(form);
```

```js
form.requestSubmit();
```

```js
submitter = event.submitter;
```

```js
button.form
button.formAction
button.formMethod
```

These preserve native form behavior and accessibility better than custom submission plumbing.

## FormData

Use `FormData` for form serialization.

```js
form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
});
```

This respects native controls and names.

## Labels And Programmatic Relationships

Use explicit labels when possible.

```html
<label for="first-name">First name</label>
<input id="first-name" name="firstName">
```

Implicit labels are valid:

```html
<label>
  First name
  <input name="firstName">
</label>
```

Explicit labels are often easier for layout and testing.

Multiple labels can reference the same control, but keep names clear.

## Group Labels

Use `fieldset` and `legend` for grouped form controls.

```html
<fieldset>
  <legend>Payment method</legend>
  ...
</fieldset>
```

Use `role="group"` with `aria-labelledby` only when native grouping is unsuitable.

```html
<div role="group" aria-labelledby="filters-heading">
  <h2 id="filters-heading">Filters</h2>
  ...
</div>
```

## Autocomplete

Use correct autocomplete attributes.

Examples:

```html
autocomplete="name"
autocomplete="given-name"
autocomplete="family-name"
autocomplete="email"
autocomplete="username"
autocomplete="current-password"
autocomplete="new-password"
autocomplete="one-time-code"
autocomplete="organization"
autocomplete="street-address"
autocomplete="address-line1"
autocomplete="address-level2"
autocomplete="address-level1"
autocomplete="postal-code"
autocomplete="country"
autocomplete="tel"
autocomplete="cc-name"
autocomplete="cc-number"
autocomplete="cc-exp"
autocomplete="cc-csc"
```

Autocomplete improves usability for many users, including users with motor, cognitive, and memory-related disabilities.

## Input Modes

Use `inputmode` to improve virtual keyboards.

```html
<input inputmode="numeric">
<input inputmode="decimal">
<input inputmode="tel">
<input inputmode="email">
<input inputmode="url">
<input inputmode="search">
```

Do not use `type="number"` for values that are not numeric quantities, such as ZIP codes or credit card numbers.

For numeric-looking strings:

```html
<input inputmode="numeric" autocomplete="postal-code">
```

## Pattern Attribute

Use `pattern` carefully.

Provide visible format instructions and clear errors.

```html
<label for="code">Security code</label>
<p id="code-help">Enter 3 digits.</p>
<input
  id="code"
  name="code"
  inputmode="numeric"
  pattern="[0-9]{3}"
  aria-describedby="code-help"
>
```

Do not rely on pattern alone for explanation.

## Native Inputs

Use the right input for the job.

But be careful:

- `type="number"` has spinbutton semantics and may be bad for credit cards, ZIP codes, account numbers
- `type="date"` support and localization vary but is often acceptable
- `type="search"` provides useful semantics and platform behavior
- `type="email"` and `type="url"` provide validation and keyboards
- `type="tel"` is good for phone-like input but does not validate phone numbers

## Editable Content

Avoid `contenteditable` for form-like input unless necessary.

If used:

- Provide role and label
- Ensure keyboard support
- Announce formatting state
- Preserve focus
- Sanitize content
- Support paste
- Provide alternatives for toolbar commands
- Test with screen readers

Example:

```html
<div
  contenteditable="true"
  role="textbox"
  aria-multiline="true"
  aria-label="Message"
></div>
```

Native `<textarea>` is usually better.

## Rich Text Editors

Rich text editors require substantial accessibility support.

Needed:

- Labeled editing area
- Keyboard shortcuts with discoverable alternatives
- Toolbar buttons with names and pressed states
- Semantic output
- Formatting state announcements
- Focus management between toolbar and editor
- Screen reader testing
- Paste handling
- Undo/redo
- Accessible help

Use mature editor libraries with accessibility support rather than building from scratch.

## Focus Traps

Use focus traps only for modal contexts.

Requirements:

- Initial focus enters modal
- `Tab` wraps within modal
- `Shift+Tab` wraps backward
- `Escape` closes if allowed
- Focus returns to invoker
- Background is inert
- Trap deactivates on close
- Dynamic content is handled

Do not trap focus in non-modal sidebars, dropdowns, or pages.

## Scroll Management

Avoid scroll behavior that disorients users.

Use:

```css
html {
  scroll-behavior: smooth;
}
```

only if respecting reduced motion.

```css
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
```

For focus targets under sticky headers:

```css
:target {
  scroll-margin-block-start: 5rem;
}
```

Do not hijack scrolling.

## Anchors And Fragment Navigation

Anchor targets should not be obscured by sticky headers.

Use `scroll-margin`.

```css
[id] {
  scroll-margin-block-start: 5rem;
}
```

If moving focus to a heading after navigation, make it programmatically focusable:

```html
<h1 tabindex="-1">Results</h1>
```

## Keyboard Shortcuts

Keyboard shortcuts should:

- Not conflict with browser or assistive tech shortcuts
- Be documented
- Be customizable or disableable if extensive
- Not require single-character shortcuts without modifier unless appropriate
- Not be the only way to perform an action
- Respect focused form fields

Use `aria-keyshortcuts` only when helpful and accurate.

```html
<button aria-keyshortcuts="Control+S">Save</button>
```

## Accessible Names For Repeated Controls

Repeated controls need distinguishable names.

Bad:

```html
<button>Edit</button>
<button>Edit</button>
<button>Edit</button>
```

Better:

```html
<button aria-label="Edit billing address">Edit</button>
<button aria-label="Edit shipping address">Edit</button>
```

Or include visible context:

```html
<h2>Billing address</h2>
<button>Edit billing address</button>
```

## Images Of Text

Avoid images of text.

Use real text so users can:

- Zoom
- Select
- Translate
- Use custom styles
- Get proper contrast
- Have it read by screen readers

Exceptions include logos, but provide text alternatives.

## Typography

Accessible typography practices:

- Use readable font sizes
- Use adequate line height
- Avoid very thin fonts
- Avoid justified text for long passages
- Avoid all caps for long passages
- Keep line length reasonable
- Ensure text can resize
- Avoid text over busy images unless contrast is guaranteed
- Do not encode meaning only with font style or color

## Contrast Over Images

Text over images needs reliable contrast.

Use:

- Solid overlays
- Scrims
- Text shadows only as supplemental
- Responsive testing
- Avoid placing text over visually complex areas

Do not assume a gradient overlay always preserves contrast across image crops.

## Dark Mode

Dark mode must maintain contrast and state clarity.

Use:

```css
:root {
  color-scheme: light dark;
}
```

Test:

- Text contrast
- Focus indicators
- Borders
- Disabled states
- Error colors
- Charts
- Images/icons
- Form controls

Do not invert images blindly.

## `accent-color`

Use `accent-color` to style native controls accessibly.

```css
:root {
  accent-color: #005fcc;
}
```

Ensure chosen accent has sufficient contrast in relevant states.

## `color-scheme`

Use `color-scheme` to let browsers render native controls appropriately.

```css
:root {
  color-scheme: light dark;
}
```

Or:

```css
:root {
  color-scheme: light;
}
```

Use carefully with custom themes.

## Reduced Transparency

If using blur/transparency, support reduced transparency where available.

```css
@media (prefers-reduced-transparency: reduce) {
  .frosted {
    backdrop-filter: none;
    background: Canvas;
  }
}
```

Also ensure fallback without this media query is still readable.

## ARIA Live Versus Focus

Use live regions for passive updates.

Move focus for:

- New route/page
- Opened modal
- Error summary after failed submit
- Newly inserted content requiring immediate interaction
- Destructive confirmation

Do not move focus for:

- Routine save success
- Result count updates
- Background polling
- Toasts that do not need action

## Hiding Decorative Content

For decorative icons:

```html
<svg aria-hidden="true" focusable="false">...</svg>
```

For decorative images:

```html
<img src="decorative.jpg" alt="">
```

For CSS background images, no alt is needed; ensure they are decorative or duplicated by text.

## Accessible Cards And Articles

Use semantic grouping.

```html
<article>
  <h2><a href="/posts/1">Post title</a></h2>
  <p>Summary...</p>
</article>
```

For repeated items:

- Use headings
- Make primary action clear
- Avoid too many tab stops if not needed
- Keep action labels specific
- Preserve logical reading order

## Regions

Use `role="region"` sparingly.

A region should have an accessible name.

```html
<section aria-labelledby="activity-title">
  <h2 id="activity-title">Recent activity</h2>
  ...
</section>
```

Too many named regions clutter landmark navigation.

## Forms In Modals

Forms inside modals need:

- Dialog label
- Initial focus
- Form labels
- Error handling inside dialog
- Focus to errors
- Non-destructive cancel
- Submit button
- Escape behavior considered carefully
- Focus restoration on close

If submit succeeds and dialog closes, announce success outside or restore focus to meaningful location.

## Destructive Actions

For destructive actions:

- Use specific labels
- Avoid ambiguous “OK”
- Confirm when consequence is serious
- Provide undo where possible
- Make danger visually and textually clear
- Do not rely on red alone
- Ensure confirmation dialog is accessible

```html
<button type="button">Delete invoice</button>
```

Not:

```html
<button type="button">Yes</button>
```

unless context is very clear.

## Undo

Undo is often better than confirmation for low-risk actions.

Accessible undo:

- Announce action
- Provide reachable Undo button
- Keep undo available long enough
- Do not auto-dismiss too quickly
- Make status visible

```html
<div role="status">
  Item archived.
  <button type="button">Undo</button>
</div>
```

## Breadcrumbs

Use nav and ordered list.

```html
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/docs">Docs</a></li>
    <li aria-current="page">Accessibility</li>
  </ol>
</nav>
```

Do not make current page a link unless useful.

## Pagination

Pagination should have a nav label and current page.

```html
<nav aria-label="Pagination">
  <a href="?page=1">Page 1</a>
  <a href="?page=2" aria-current="page">Page 2</a>
  <a href="?page=3">Page 3</a>
</nav>
```

Icon-only previous/next buttons need names.

```html
<a href="?page=1" aria-label="Previous page">...</a>
```

## Steppers And Multi-Step Forms

Use:

- Clear step title
- Progress indication
- Current step state
- Back/next buttons
- Error summary per step
- Preserve data
- Allow review before submit
- Avoid timeouts
- Focus management on step changes

Example:

```html
<nav aria-label="Checkout progress">
  <ol>
    <li><a href="/cart">Cart</a></li>
    <li aria-current="step">Shipping</li>
    <li>Payment</li>
  </ol>
</nav>
```

## Current Item State

Use `aria-current` for current item in a set.

Values include:

```html
aria-current="page"
aria-current="step"
aria-current="location"
aria-current="date"
aria-current="time"
aria-current="true"
```

Use for navigation, breadcrumbs, calendars, steppers.

Do not use `aria-selected` unless the widget pattern supports selection.

## Selection Versus Current Versus Pressed

Use the right state:

- `aria-current`: current item in navigation or set
- `aria-selected`: selected option/tab/gridcell in selectable widget
- `aria-pressed`: toggle button pressed state
- `aria-checked`: checkbox/radio/switch checked state
- `aria-expanded`: disclosure expanded state

Do not interchange them casually.

## Status In Buttons

Loading button:

```html
<button type="submit" disabled>
  Saving...
</button>
```

If using spinner:

```html
<button type="submit" disabled>
  <span aria-hidden="true" class="spinner"></span>
  Saving...
</button>
```

Do not use spinner alone.

## Naming Close Buttons

Close buttons should be specific when context is ambiguous.

```html
<button type="button" aria-label="Close dialog">
  <svg aria-hidden="true">...</svg>
</button>
```

For multiple dismiss buttons:

```html
aria-label="Dismiss notification"
aria-label="Close filters panel"
```

## Accessible Notifications Count

For badges:

```html
<a href="/messages">
  Messages
  <span aria-label="3 unread">3</span>
</a>
```

Or:

```html
<a href="/messages" aria-label="Messages, 3 unread">
  Messages <span aria-hidden="true">3</span>
</a>
```

Avoid unlabeled numeric badges.

## Abbreviations

Expand abbreviations where needed.

```html
<abbr title="World Wide Web Consortium">W3C</abbr>
```

Do not overuse `abbr`. Plain text explanations are often clearer.

## Data Formats

Provide format hints before input.

```html
<label for="dob">Date of birth</label>
<p id="dob-help">Use MM/DD/YYYY.</p>
<input id="dob" aria-describedby="dob-help" inputmode="numeric">
```

Do not reveal format requirements only after an error.

## Currency And Numbers

Use clear visible formatting and accessible text when needed.

Avoid ambiguous numbers.

For screen readers, normal text is usually fine:

```html
<p>Total: $1,234.56</p>
```

For charts or compact UI, ensure labels explain units.

## Time And Dates

Use `<time>`.

```html
<time datetime="2026-05-13">May 13, 2026</time>
```

Use machine-readable datetime for parsing and assistive tech compatibility.

Avoid ambiguous dates like `05/06/26` when audience may vary.

## Tables With Actions

For rows with repeated actions, names should include row context.

```html
<button aria-label="Edit order 1234">Edit</button>
```

Or use visible text:

```html
<button>Edit order 1234</button>
```

Avoid repeated unlabeled “Edit” buttons in tables.

## ARIA Describedby Chaining

Multiple descriptions can be referenced.

```html
<input aria-describedby="password-help password-error">
```

Keep order meaningful.

Do not overload descriptions with too much content.

## Error Summary Links

Error summary links should point to fields.

```html
<a href="#email">Enter a valid email address.</a>
```

When clicked, focus should reach the relevant input. Native anchor behavior may be enough if the input has the ID and is focusable.

## CSS `display: contents`

Be cautious with `display: contents`.

It can affect accessibility semantics in some browser/assistive technology combinations, especially on semantic elements.

Avoid using it on elements whose semantics matter unless tested.

## CSS `visibility`

`visibility: hidden` hides from users and accessibility tree but preserves layout space.

Use intentionally.

Do not hide focusable content with `visibility: hidden`.

## `opacity: 0`

`opacity: 0` visually hides but does not remove from accessibility tree or focus order.

This can create invisible focusable controls.

If hiding content from everyone, use `hidden` or `display: none`.

If visually hiding but keeping accessible, use a tested visually-hidden pattern.

## Pointer Events

`pointer-events: none` does not remove elements from keyboard focus or accessibility tree.

Do not use it as a disabled state by itself.

If disabled, also handle semantics and keyboard behavior.

## ARIA Controls

`aria-controls` indicates a relationship but does not create behavior.

```html
<button aria-controls="panel" aria-expanded="false">Details</button>
```

You still need JavaScript to show/hide the panel and update state.

## ARIA Owns

Avoid `aria-owns` unless necessary.

It can reorder the accessibility tree and create confusing behavior.

Prefer DOM order.

## ARIA Role Conflicts

Do not put conflicting roles on native elements.

Bad:

```html
<a href="/home" role="button">Home</a>
```

If it navigates, it is a link. If it acts, use button.

## Accessible Name From Content

Buttons and links derive names from content.

This is best:

```html
<button>Continue to payment</button>
```

Avoid overriding visible text with a different `aria-label`, because speech input users may say the visible text.

## Speech Recognition

Accessible names should match visible labels where possible.

Bad:

```html
<button aria-label="Submit order">Buy now</button>
```

A speech recognition user may say “Click Buy now” but the accessible name is “Submit order.”

Prefer:

```html
<button>Buy now</button>
```

or:

```html
<button>Submit order</button>
```

## Voice Control

Voice control benefits from:

- Visible labels matching accessible names
- Real buttons and links
- Unique control names
- Avoiding custom controls without semantics
- Avoiding hidden names that differ from visible names

## Screen Magnification

Screen magnifier users benefit from:

- Visible focus
- No unexpected focus movement
- Consistent layout
- Responsive design
- Avoiding content that appears far from trigger
- Avoiding hover-only content
- Keeping errors near fields
- Scroll-margin for focused content

## Screen Reader Considerations

Screen reader users benefit from:

- Semantic structure
- Headings
- Landmarks
- Labels
- Meaningful links
- Proper form errors
- Table headers
- Live region restraint
- Predictable focus
- Avoiding redundant verbosity
- Avoiding ARIA misuse

Do not assume all screen reader users are blind. Do not make “screen reader only” UX diverge from visible UX unnecessarily.

## Automated Testing

Use automated accessibility testing as a baseline.

Common tools:

- axe
- Lighthouse
- Pa11y
- jest-axe
- Testing Library accessibility queries
- Playwright accessibility-oriented checks
- eslint-plugin-jsx-a11y for React
- Storybook accessibility add-ons

Automated tools catch many issues, such as:

- Missing labels
- Missing alt text
- Color contrast in many cases
- Invalid ARIA
- Missing button names
- Duplicate IDs
- Landmark issues
- Heading problems

Automated tools do not fully catch:

- Keyboard traps
- Incorrect focus management
- Bad screen reader UX
- Meaningful alt quality
- Logical reading order
- Cognitive complexity
- Custom widget correctness
- All color contrast situations
- Zoom/reflow problems
- Motion sensitivity
- Usability of flows

## Manual Testing

Manual checks should include:

- Keyboard-only navigation
- Screen reader smoke testing
- Browser zoom to 200%
- Mobile viewport
- Touch interaction
- High contrast / forced colors
- Reduced motion
- Form errors
- Modal behavior
- Route changes
- Dynamic updates
- Landmark/headings navigation
- Color contrast
- Focus visibility

Keyboard checklist:

- Can I reach every interactive element?
- Can I see focus?
- Is focus order logical?
- Can I activate controls?
- Can I escape overlays?
- Is there any trap?
- Does focus return after closing modals?
- Are hidden controls skipped?

## Screen Reader Testing

Common combinations:

- NVDA with Firefox or Chrome on Windows
- JAWS with Chrome or Edge on Windows
- VoiceOver with Safari on macOS
- VoiceOver with Safari on iOS
- TalkBack with Chrome on Android

Test at least one realistic combination when working on complex interactions.

Screen reader checks:

- Page title is useful
- Headings are meaningful
- Landmarks are present
- Controls have names
- States are announced
- Errors are announced
- Dynamic updates are reasonable
- Custom widgets follow expected behavior
- Reading order matches visual order

## Testing Library Practices

Prefer queries that reflect accessibility.

Good:

```js
screen.getByRole("button", { name: /save/i });
screen.getByLabelText(/email/i);
screen.getByRole("heading", { name: /settings/i });
```

Avoid relying only on test IDs for interactive controls.

Testing by role and name encourages accessible markup.

## React Accessibility

React accessibility defaults:

- Use `htmlFor` instead of `for`
- Use `className`
- Use semantic components
- Keep stable IDs with `useId`
- Do not create inaccessible custom buttons
- Manage focus after conditional rendering
- Clean up effects
- Keep ARIA state in sync with component state
- Avoid rendering invalid DOM nesting
- Use fragments carefully to preserve semantics

Example:

```jsx
const id = useId();

return (
  <>
    <label htmlFor={id}>Email</label>
    <input id={id} type="email" autoComplete="email" />
  </>
);
```

React event handlers should not make non-interactive elements interactive without adding semantics and keyboard support.

Bad:

```jsx
<div onClick={onClose}>Close</div>
```

Good:

```jsx
<button type="button" onClick={onClose}>Close</button>
```

## Vue Accessibility

Vue accessibility defaults:

- Use native elements
- Bind ARIA state accurately
- Preserve labels and IDs
- Avoid clickable divs
- Manage focus after conditional rendering
- Be careful with `v-if` removing focused content
- Use `nextTick` before focusing newly rendered elements
- Ensure components pass attributes to accessible elements

Example:

```vue
<label :for="id">Email</label>
<input :id="id" type="email" autocomplete="email">
```

## Angular Accessibility

Angular accessibility defaults:

- Use native controls
- Use Angular CDK a11y utilities where useful
- Use `cdkTrapFocus` for modals when appropriate
- Manage focus with CDK FocusMonitor when useful
- Bind ARIA states accurately
- Preserve form labels and validation messages
- Avoid custom controls unless implementing ControlValueAccessor accessibly

Angular Material components generally handle many accessibility concerns but still need correct labels and usage.

## Svelte Accessibility

Svelte accessibility defaults:

- Pay attention to compiler a11y warnings
- Use native controls
- Avoid click handlers on non-interactive elements
- Manage focus after conditional rendering
- Bind ARIA state accurately
- Ensure component abstractions preserve semantic markup

## Component Libraries

Component libraries do not guarantee accessibility.

Still verify:

- Correct usage
- Labels provided
- Keyboard behavior
- Focus management
- Color contrast after theming
- Screen reader behavior
- Error messages
- Responsive behavior
- Disabled states
- High contrast mode
- Reduced motion

A library can provide accessible primitives, but product implementation can still break them.

## Design Systems

Design systems should define:

- Accessible color tokens
- Focus styles
- Form field patterns
- Error patterns
- Modal behavior
- Keyboard conventions
- Component semantics
- Reduced motion behavior
- Touch target sizes
- Testing expectations
- Documentation for accessible names and labels

A component API should make accessible usage easy and inaccessible usage hard.

## API Design For Components

Accessible component APIs should require or infer names.

Good:

```jsx
<IconButton aria-label="Close" icon={<CloseIcon />} />
```

Better when visible label exists:

```jsx
<Button icon={<SaveIcon />}>Save</Button>
```

Avoid APIs that hide semantics:

```jsx
<Box clickable onClick={...}>
```

Prefer components that render the correct element:

```jsx
<Button>
<Link>
<Heading>
<Field>
<Dialog>
```

Allow polymorphism carefully. If using `as`, ensure semantics still match behavior.

## Accessibility And Type Systems

Type systems can enforce accessibility.

Examples:

- Require `aria-label` for icon-only button components
- Require labels for fields
- Restrict heading levels
- Model button vs link props separately
- Prevent `href` and `onClick` ambiguity
- Require dialog title
- Require alt text for image components, with explicit decorative handling

Example idea:

```ts
type IconButtonProps =
  | { children: string; "aria-label"?: never }
  | { children?: never; "aria-label": string };
```

## Linting

Use accessibility linting.

Common checks:

- Alt text
- Label association
- Valid ARIA roles
- Valid ARIA attributes
- No autofocus
- No positive tabindex
- Click handlers need keyboard handlers
- Interactive elements must be focusable
- No redundant roles
- Media captions
- Iframe title

Do not silence lint rules without understanding the accessibility consequence.

## Iframes

Iframes need titles.

```html
<iframe
  title="Payment form"
  src="..."
></iframe>
```

The title should describe the iframe’s purpose.

Ensure embedded content itself is accessible.

Avoid keyboard traps between host page and iframe.

## Third-Party Widgets

Third-party widgets can create accessibility problems.

Check:

- Keyboard access
- Focus traps
- Screen reader labels
- Color contrast
- Resize/zoom behavior
- Captcha accessibility
- Cookie banners
- Chat widgets
- Payment forms
- Maps
- Analytics overlays
- Ads

Load third-party widgets in a way that does not block core tasks.

## Chat Widgets

Chat widgets should:

- Be keyboard accessible
- Have named controls
- Not steal focus on load
- Not spam live regions
- Not cover important controls
- Respect reduced motion
- Be dismissible
- Preserve focus
- Work at zoom
- Have accessible unread indicators

## Ads And Injected Content

Ads should not:

- Trap focus
- Autoplay audio
- Flash
- Obscure content
- Break reading order
- Insert unexpected focusable elements
- Hijack keyboard shortcuts

## Consent And Privacy UI

Consent UI should avoid deceptive or inaccessible patterns.

Controls must be:

- Keyboard reachable
- Clearly labeled
- Equally accessible for accept/reject/customize
- Focus visible
- Screen reader understandable
- Not dependent on color alone

## Mobile Accessibility

Mobile accessibility considerations:

- Touch target size
- Screen reader gestures
- Orientation changes
- Zoom support
- Dynamic type/text scaling
- Focus order
- Keyboard support for external keyboards
- Proper input types
- Avoid fixed overlays that obscure content
- Avoid hover-only interactions
- Support reduced motion
- Use native controls where possible

Test with VoiceOver iOS and TalkBack Android for complex flows.

## Orientation

Do not lock orientation unless essential.

Layouts should work in portrait and landscape.

If orientation is essential, provide an explanation or alternative.

## Device Sensors

Do not require device motion as the only input.

If using shake, tilt, or motion:

- Provide controls
- Ask permission where required
- Respect reduced motion
- Avoid motion sickness triggers

## Haptics And Sound

Do not rely only on sound or haptics.

Provide visual and programmatic feedback.

Allow users to mute or disable non-essential sound.

## Offline And Network Errors

Network errors should be accessible.

Use:

- Clear visible messages
- Retry buttons
- Status announcements
- Preserve user data
- Avoid infinite spinners
- Focus management for blocking errors

```html
<div role="alert">
  Could not save changes. Check your connection and try again.
</div>
```

## Progressive Web Apps

PWAs should ensure:

- Install prompts are accessible
- Offline states are clear
- App shell has landmarks
- Route changes manage focus
- Push notifications are understandable
- Badges have accessible equivalents
- Splash/loading screens do not trap users

## Notifications API

Browser notifications should:

- Be opt-in
- Have clear permission context
- Not be required for core functionality
- Have meaningful titles and bodies
- Avoid excessive frequency
- Provide in-app accessible equivalents for important notifications

## Permissions

Permission prompts need context.

Before requesting:

- Explain why permission is needed
- Trigger from user action
- Provide fallback if denied
- Do not repeatedly nag

Relevant permissions:

- Camera
- Microphone
- Location
- Notifications
- Clipboard
- Sensors

## Clipboard

Clipboard interactions should be accessible.

```html
<button type="button">Copy invite link</button>
```

After copy:

```html
<div role="status">Invite link copied.</div>
```

Do not copy automatically without user action.

## Camera And Microphone

Media capture flows need:

- Labeled controls
- Permission explanation
- Keyboard-accessible recording controls
- Visible and announced recording state
- Captions/transcripts where relevant
- Alternatives to camera-only workflows

## Location

Location-based features should:

- Explain why location is needed
- Provide manual entry alternative
- Handle denial clearly
- Avoid making location mandatory unless essential

## Download Links

Indicate file type and size when useful.

```html
<a href="/report.pdf">Download annual report PDF, 2 MB</a>
```

Ensure PDFs or downloaded documents are accessible.

## PDFs And Documents

Linked documents should be accessible.

Accessible PDFs need:

- Tags
- Reading order
- Headings
- Alt text
- Table headers
- Document language
- Title
- Form labels if forms

Where possible, provide HTML alternatives.

## Email Accessibility

HTML emails should:

- Use semantic structure where supported
- Include alt text
- Maintain contrast
- Work with zoom
- Avoid image-only content
- Use meaningful link text
- Support dark mode carefully
- Use accessible buttons as links
- Keep layout readable

## Performance And Accessibility

Performance affects accessibility.

Slow interfaces can harm users with:

- Cognitive disabilities
- Motor disabilities
- Screen readers
- Magnification
- Older devices
- Limited networks

Good practices:

- Avoid long main-thread blocking
- Show accessible loading states
- Preserve input during async work
- Avoid layout shifts
- Use skeletons carefully
- Do not remove focused elements unexpectedly
- Optimize images and scripts

## Layout Shift

Unexpected layout shift can cause users to lose place or activate wrong controls.

Prevent with:

- Reserved space for images/media
- Stable button positions
- Avoid inserting content above current focus
- Avoid late-loading banners that push content
- Proper dimensions
- Careful font loading

## Font Loading

Font loading should not make text invisible for too long.

Use sensible `font-display`, commonly:

```css
@font-face {
  font-family: "Inter";
  src: url("/inter.woff2") format("woff2");
  font-display: swap;
}
```

Ensure fallback fonts do not break layout.

## Skeleton Screens

Skeletons should:

- Not be announced as real content
- Not trap focus
- Be replaced cleanly
- Respect reduced motion
- Have actual loading text/status where needed

Use:

```html
<div role="status">Loading profile...</div>
```

## Disabled Loading States

When loading disables a form:

- Announce loading
- Keep users informed
- Avoid clearing data
- Restore focus if needed
- Prevent duplicate submission
- Allow cancellation for long operations where possible

## Accessibility In Design Review

Review designs for:

- Heading structure
- Labels
- Error states
- Focus states
- Keyboard flows
- Modal behavior
- Touch target sizes
- Contrast
- Motion
- Text scaling
- Empty/loading/error states
- Responsive behavior
- Screen reader names for icon-only controls
- Destructive action recovery
- Non-color indicators

Design files often omit focus and error states; implementation should not.

## Common Anti-Patterns

Avoid:

- Clickable `div`s
- Placeholder-only labels
- Removing focus outlines
- Positive tabindex
- `aria-hidden` on focusable content
- `role="button"` on non-keyboard elements
- Color-only errors
- Icon-only buttons without names
- Links without `href`
- Buttons used for navigation
- Links used for actions
- Modal without focus management
- Hover-only menus
- Auto-advancing carousels without pause
- Custom selects without keyboard support
- Inaccessible drag-and-drop
- Empty alt on meaningful images
- Redundant verbose alt on decorative images
- Invalid ARIA attributes
- Mismatched ARIA state and visual state
- Screen-reader-only instructions that sighted users also need
- Unlabeled iframes
- Autoplay audio
- Low contrast text
- Tiny touch targets
- Layouts that break at 200% zoom
- Keyboard traps
- Focus lost after DOM updates
- Infinite scroll without alternatives
- Toasts that disappear too quickly
- Captcha without accessible alternative

## Common Clean Code Principles For Accessibility

Accessibility code should be simple, explicit, and maintainable.

Principles:

- Prefer native platform behavior.
- Keep semantics close to the rendered element.
- Do not hide accessibility behavior in unrelated abstractions.
- Use component APIs that require labels.
- Keep ARIA state derived from the same source of truth as visual state.
- Avoid duplicated state where possible.
- Test behavior through roles and names.
- Do not over-abstract one-off accessibility logic.
- Encapsulate complex widget behavior in tested primitives.
- Document keyboard behavior for custom widgets.
- Treat accessibility bugs as functional bugs.
- Avoid CSS/JS tricks that create hidden focus or reading-order issues.
- Make inaccessible states hard to represent.
- Keep error message logic close to validation logic.
- Avoid “magic” aria props passed blindly through components.
- Prefer explicit accessible names over implicit guesses in reusable components.
- Use types/tests/lints to enforce required accessibility props.
- Keep focus management localized and predictable.
- Clean up timers, observers, and listeners that affect announcements or focus.
- Do not create global keyboard handlers without strong reason.

## Accessible Component Checklist

For any component, ask:

- What semantic element should this be?
- What is its accessible name?
- Is it keyboard reachable?
- Is it keyboard operable?
- Is focus visible?
- What role, state, and value are exposed?
- Does it work with screen readers?
- Does it work at 200% zoom?
- Does it work in forced colors?
- Does it respect reduced motion?
- Does it support touch?
- Does it preserve logical reading order?
- Are errors/statuses announced?
- Is any information conveyed only by color, shape, position, sound, or motion?
- Does it remain usable when text is longer?
- Does it remain usable with translated content?
- Does it degrade gracefully without JavaScript where reasonable?

## Accessible Page Checklist

For each page/view:

- Unique document title
- One main landmark
- Logical headings
- Skip link where useful
- Meaningful navigation labels
- Current page indicated
- All controls labeled
- All images have appropriate alternatives
- Forms have labels, hints, and errors
- Keyboard order is logical
- Focus is visible
- No keyboard traps
- Modals manage focus
- Dynamic updates are announced when needed
- Color contrast passes
- Text resizes/reflows
- Motion is controllable
- Media has captions/transcripts
- Touch targets are usable
- Works with screen reader smoke test

## Accessibility Bugs Are Often State Bugs

Many accessibility failures happen because state is inconsistent:

- Visual menu open, `aria-expanded=false`
- Panel hidden visually but still focusable
- Button disabled visually but still activatable
- Modal shown but background still focusable
- Error visible but not associated with input
- Toast visible but not announced
- Route changed but focus stayed on old nav item
- Selected item styled but not programmatically selected
- Loading spinner shown without status text

The fix is usually to make state explicit and synchronized.

## Default Implementation Bias

My default implementation bias would be:

- Use real HTML elements.
- Use browser-native behavior.
- Add ARIA only when necessary.
- Keep focus behavior boring and predictable.
- Make labels visible.
- Make errors specific.
- Make dynamic updates restrained.
- Respect user preferences.
- Test with keyboard before considering a component done.
- Use automated checks as a floor, not a ceiling.
- Treat accessibility as part of the component contract.
