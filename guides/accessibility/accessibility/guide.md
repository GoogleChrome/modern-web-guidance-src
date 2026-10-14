---
name: accessibility
description: Actionable coding guidelines for building accessible web applications, covering semantic HTML, focus management, forms, media, and testing. Use this skill when auditing or implementing accessibility features, keyboard navigation, or ARIA.
---

# Accessibility Coding Guidelines

This guide provides actionable DOs and DON'Ts for AI coding agents to ensure web applications are accessible to all users, including those using assistive technologies.

Keep these principles in mind throughout:

- **Accessibility is the minimum, not the ceiling.** Conformance to standards is the floor; aim for genuine usability.
- **Patterns are use-case specific.** No checklist replaces real testing — including testing with disabled users — to confirm a given implementation is actually accessible in context.

Contents:

- [1. Content Navigability and Structure](#1-content-navigability-and-structure)
  - [Landmarks](#landmarks)
  - [Headings](#headings)
  - [Lists](#lists)
  - [Tables](#tables)
  - [Skip links](#skip-links)
- [2. Semantic HTML and ARIA](#2-semantic-html-and-aria)
  - [Prefer native HTML](#prefer-native-html)
  - [ARIA roles and states](#aria-roles-and-states)
- [3. Accessible Names and Descriptions](#3-accessible-names-and-descriptions)
  - [Naming mechanisms](#naming-mechanisms)
  - [Choosing the name](#choosing-the-name)
  - [Descriptions](#descriptions)
  - [Code Example: Visually Hidden Utility](#code-example-visually-hidden-utility)
- [4. Document Metadata and Language](#4-document-metadata-and-language)
  - [Language](#language)
  - [Titles](#titles)
  - [Iframes](#iframes)
- [5. Keyboard and Focus Management](#5-keyboard-and-focus-management)
  - [Tab order and focusability](#tab-order-and-focusability)
  - [Keyboard handlers](#keyboard-handlers)
  - [Focus indicators](#focus-indicators)
  - [Touch targets](#touch-targets)
- [6. Alternate Text and Media](#6-alternate-text-and-media)
  - [Images](#images)
  - [Inline SVGs](#inline-svgs)
  - [Complex images and charts](#complex-images-and-charts)
  - [Audio and video](#audio-and-video)
  - [CSS generated content](#css-generated-content)
  - [Content Visibility Decision Matrix](#content-visibility-decision-matrix)
- [7. Forms and Input Controls](#7-forms-and-input-controls)
  - [Labels and hints](#labels-and-hints)
  - [Input assistance and validation](#input-assistance-and-validation)
- [8. Live Regions](#8-live-regions)
  - [Live Region Urgency Table](#live-region-urgency-table)
  - [When to announce](#when-to-announce)
  - [Managing announcements](#managing-announcements)
- [9. Color](#9-color)
- [10. Typography](#10-typography)
- [11. Motion and Preferences](#11-motion-and-preferences)
- [12. Modals and Native Dialogs](#12-modals-and-native-dialogs)
  - [Native `<dialog>`](#native-dialog)
  - [Custom overlays](#custom-overlays)
- [13. Testing Validations](#13-testing-validations)
  - [Automated checks](#automated-checks)
  - [Manual testing](#manual-testing)

## 1. Content Navigability and Structure

Related WCAG Success Criteria:

- WCAG Success Criterion 1.3.1 Info and Relationships (Level A)
- WCAG Success Criterion 1.3.6 Identify Purpose (Level AAA)
- WCAG Success Criterion 2.4.1 Bypass Blocks (Level A)

### Landmarks

- **Place all content within landmarks:** Wrap each relevant part of the page in `<header>`, `<nav>`, `<main>`, `<aside>`, and `<footer>` elements so assistive-tech users can jump between regions.
- **Use the correct landmark:** Use the `<header>` element as a container for introductory content, the `<nav>` element as a container for site-wide or in-page navigation links, the `<main>` element as a container for the main content of the page, the `<aside>` element as a container for container is tangentially related to the main content, and the `<footer>` element as a container for information about the related content, such as the author, copyright information, and links to related documents.
- **Use one `<main>` landmark per page:** Multiple `<main>` elements on a single page can confuse assistive-tech users trying to locate the page's main content section.
- **Provide easily distinguishable accessible names for navigation regions:** If a page contains multiple `<nav>` elements, apply the `aria-label` attribute to each element and set its value to an easily distinguishable accessible name for the region. For example: `<nav aria-label="Primary">`, `<nav aria-label="Secondary">`, and so on.
- **Don't overuse landmarks:** Too many landmarks dilute their value. In particular, avoid labeling a `<section>` (which turns it into a `region` landmark) — `region` should be a last resort when no other landmark fits.

### Headings

- **Structure main content with headings:** Use `<h1>`–`<h6>` elements sequentially so screen reader users get a navigable outline.
- **Avoid "skipped" heading levels:** While not explicitly a WCAG failure, jumping directly from (for example) `<h1>` → `<h4>` breaks the logical hierarchy, which can confuse screen reader users navigating the page via its heading structure who may think they have missed important information.
- **Use one `<h1>` element per page:** Typically, the `<h1>` element is intended for identifying a page's main heading. While not a WCAG failure, having more than one `<h1>` element on a page can make it difficult for screen reader users to identify the actual main heading.
- **Don't use "fake" headings:** Never use / style `<div>` or `<span>` elements alone to act as headings.
- **Avoid nesting headings incorrectly:** If a sub-heading is visually less important than its parent heading, its heading level must be lower in the heading hierarchy.
- **Don't place headings inside the `<summary>` element:** Headings inside the `<summary>` element may be hidden from screen reader heading lists and heading navigation shortcuts.
- **Don't place headings inside the `<details>` element:** Headings inside the `<details>` element are only reachable via heading navigation when the disclosure is open.
  - **Caveat**: If a heading must act as a disclosure trigger, use an accordion or a disclosure implemented with ARIA where the heading element wraps the button, rather than use the `<details>` and `<summary>` elements.

### Lists

- **Use lists for repeated, contiguous content:** `<ul>`/`<ol>` give assistive tech a count up front and let users skip the entire group.
- **Use the correct list element:** Use the `<ul>` element for unordered lists where the order of the items is **not** important (such as a list of related products), and use the `<ol>` element for ordered lists where the order of the content **is** important (such as a list of instructions).
- **Don't use lists for non-list content:** Do not use list markup to mark up separate paragraphs of text, as screen readers will announce list information when they encounter lists, therefore leading to a screen reader hearing potentially confusing and redundant information about the related content.
- **Don't use lists for checkboxes and radio buttons:** When marked up correctly, screen readers will already announce the number of checkboxes or radio buttons, as well as the number of the currently focused checkbox / radio button in the list, even though there is no list markup. Additional list markup will lead to duplication.

### Tables

- **Use the correct table elements:** Use the `<table>` element to identify the table, the `<caption>` element to provide a title and accessible name for the description, the `<tr>` element to identify individual rows in the table, and the `<th>` and `<td>` elements to identify header and data cells respectively.
- **Use the `scope` attribute on `<th>` elements:** The `scope` attribute indicates whether the `<th>` element represents a row header (`<th scope="row">`) or a column header (`<th scope="col">`).
- **Don't use tables for layout:** Screen readers will announce redundant information about the layout, which may be confusing for screen reader users, while the use of tabular markup can have an impact on the reading and keyboard focus order of content. Use CSS Grid/Flexbox for visual layouts instead.
- **Avoid implementing overly-complex tables:** Spanned rows, spanned columns, nested tables, and expandable / collapsible rows can make sense visually and meet the related WCAG success criterion, but the overall structure can be disorienting and difficult to navigate for screen reader users. In such cases, break tables up into smaller tables that are easier and more efficient to navigate.

### Skip links

- **Provide skip links** prior to repeated content like site headers with navigation or long/infinite lists, so that keyboard users can easily bypass them.
  - **Caveat**: Sometimes screen magnifiers do not follow the focus when a skip link’s target is not normally focusable.
    A common workaround is to make the target programmatically focusable, but not a part of the tab order, using `tabindex="-1"`.
    If the target contains focusable elements this can create another usability issue as clicking within the target will always set the **sequential focus navigation start point** to the target rather than at a point between focusable elements as would be expected.
    A solution that can satisfy both user expectations is to make the first meaningful element within the intended target, the actual target of the skip link, for example a heading.
    Beware that any content prior to such an element will be skipped, including other relevant content within the targeted section and this can create usability gaps for other assistive tech users.
- **Avoid using skip links where they are not needed:** A set of pages whose only comment element is a single link to the Home page does not need a skip link.
- **Avoid overusing skip links:** A single skip link, or two skip links to cover the primary and secondary sets of common navigation links, is usually sufficient on a single page. Multiple unnecessary skip links can add to the number of <kbd>Tab</kbd> stops to a page, which can cause frustration for people who use the keyboard alone for navigation

### Code Example: appropriate use of landmarks, headings, lists, tables, and a skip link

```html
<!-- Good: Semantic landmarks, heading hierarchy, skip link -->
<header>
  <a href="#platform-dashboard" class="skip-link visually-hidden">Skip to content</a>
  <nav aria-label="Primary">
    <ul>
      <li><a href="/">Home</a></li>
    </ul>
  </nav>
</header>
<main id="content">
  <h1 id="platform-dashboard">Platform Dashboard</h1>
  <section>
    <h2>User Statistics</h2>
    <table>
      <caption>Monthly active users</caption>
      <thead>
        <tr>
          <th scope="col">Month</th>
          <th scope="col">Users</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>January</td>
          <td>12,000</td>
        </tr>
      </tbody>
    </table>
    <h3>Notes</h3>
    <ul>
      <li>Results do not include users without active subscriptions</li>
      <li>Results are accurate as of 31 December 2025</li>
    </ul>
  </section>
</main>
```

## 2. Semantic HTML and ARIA

Related WCAG Success Criteria:

- WCAG Success Criterion 4.1.2 Name, Role, Value (Level A)

### Prefer native HTML

- **Prefer HTML elements and attributes to ARIA:** Native HTML elements and attributes already have the correct role and behavior, including keyboard support, built-in by default. `<button>` already implies `role="button"`, and `required` already implies `aria-required`, and no additional JavaScript is required to ensure the correct role and behavior is supported.
  - **Caveat:** ARIA is required when the related feature is not available in HTML, for example there are no HTML elements explicitly intended for building a tabbed navigation widget, but ARIA includes appropriate role and state properties for this purpose.
- **Don't use ARIA when native HTML exists:** Avoid `<div role="button">` or `<a role="button">` and use `<button>` instead.
- **Don't add redundant ARIA roles or properties**: Avoid `<ul role="list">`, `<nav role="navigation">`, and `<input required aria-required="true">`.
  - **Caveat:** Safari removes list semantics from `<ul>`/`<ol>` outside `<nav>` when `list-style: none` or `display: flex`/`grid` is applied. In that case `role="list"` is required to restore them.
- **Avoid the unintentional changing of native semantics:** Doing so can lead to unexpected results. For example, use `<li><button>Button in a list</button></li>`, or (if absolutely necessary) `<li><span role="button">Button in a list</span></li>`, not `<li role="button">Button in a list</li>` as this will suppress the container list semantics.
  - **Caveat:** It is acceptable to apply ARIA roles to native HTML elements that have similar semantics, for example a tree view: `<ul role="tree"><li role="treeitem">…</li>…</ul>`

### ARIA roles and states

- **Match ARIA implementations to actual behavior:** When applying `role="tab"` to an element, it must then behave like a tab — including keyboard interactions. Many ARIA patterns can't be implemented in CSS alone and need JavaScript.
- **Manage toggle states:** Utilize `aria-expanded` and `aria-pressed` to communicate toggle states for custom controls.
- **Be deliberate about `disabled` vs `aria-disabled`:** `disabled` removes the element from the focus order entirely (and `tabindex="0"` won't bring it back), which is often wrong for toolbar buttons or links. `aria-disabled="true"` keeps the element focusable so users can land on it and learn it's disabled.
- **Don't hide interactive elements from screen readers:** Do not apply `aria-hidden="true"` to interactive elements that receive focus, or to their parent elements.
- **Don't suppress the roles of interactive elements:** Applying `role="presentation"` or `role="none"` to an interactive element strips its semantics. The element will still be exposed to assistive technologies and announced by screen readers, but its role and any state information will not be, which can result in confusion and potentially unexpected behavior.
- **Don't assume custom elements have no ARIA:** Custom elements can attach ARIA via `ElementInternals`, which some automated test tools can't see — so the absence of `role`/`aria-*` attributes in markup doesn't prove the element has no semantics. Verify with the browser's accessibility-tree inspector.

## 3. Accessible Names and Descriptions

Related WCAG Success Criteria:

- WCAG Success Criterion 2.5.3 Label in Name (Level A)
- WCAG Success Criterion 4.1.2 Name, Role, Value (Level A)

Every interactive element and some landmarks need an accessible name, and many benefit from an accessible description. Names are short and identify the element; descriptions add context.

### Naming mechanisms

- **Prefer native naming mechanisms:** `<label>` for form controls, `<caption>` for `<table>`, `<legend>` for `<fieldset>`, `<figcaption>` for `<figure>`.
- **Explicitly associate `<label>` with its control via `for`/`id`:** As well as ensuring the control is appropriately labelled by the contents of the `<label>` element, it results in a larger target area where people can activate the label <em>or</em> its related control to move focus to the control, which isn't globally supported with other forms of labelling (such as using the `aria-labelledby` attribute). Additionally, some assistive techologies, particular voice recognition software, requires the `for`/`id` relationship to be explicitly set, even if an equivalent accessibility-supported approach (such as nesting an `<input>` inside a `<label>`) is taken.
- **Prefer `aria-labelledby` over `aria-label` when a visible label exists:** This avoids duplication, improves maintainability, and translates better.
- **Don't use `title` as a naming mechanism:** The value of this attribute is only displayed on mouse hover, and cannot be displayed or otherwise accessed using the keyboard in any browser.
  - **Caveat:** `<iframe>` is an exception, as the `title` attribute is the standard way of providing an accessible name for this element.
- **Don't use `placeholder` as a naming mechanism:** While the value of this attribute is initially displayed inside an `<input>` or `<textarea>`, it typically disappears as soon as the user enters text into the field, meaning that there is no longer a visual cue as to what the field represents. The contrast between `placeholder` text and its background in most browsers can also be very low, and therefore can be difficult for people to perceive.
- **Don't put `aria-label`/`aria-labelledby` on elements that shouldn't be named:** Examples include plain `<div>`, `<span>`, and other custom elements without a role. These attributes can only be used to provide accessible names for elements that have explicit or implicit widget (for example, button, link, and tab), landmark, image, or iframe roles.
  - **Caveat:** Custom elements may have an implicit role set via `ElementInternals`, so the absence of a `role` attribute isn't conclusive.

### Choosing the name

- **Avoid inconsistent link text:** If multiple hyperlinks direct users to the same target page, make sure each link has the same accessible name, which should typically be the same as its visible link text. For example, if the target page for a link is `profile.html`, make sure that all links have an accessible name of "My Profile" **or** "Profile"; do not use "My Profile" in one instance, and "Profile" in the other.
- **Disambiguate controls that look visually identical but which perform different actions by their accessible name:** For example, a page may include multiple "Edit" buttons, each of which triggers functionality to perform a different action, such as edit the user's name, edit the user's password, and edit the user's address. While it may be visually obvious from the surrounding content what the purpose of these buttons might be, screen reader users may only hear "Edit, button". Techniques to resolve this include the following:
  - **Use visually hidden text:** The text is included in the DOM but is visually hidden using CSS. For example `<button>Edit <span class="visually-hidden">first name</span></button>`. Refer to the below [code example: visually hidden utility](#code-example-visually-hidden-utility) for the full CSS.
  - **Apply the `aria-label` attribute to the control:** The value of this attribute should then include the visible text as well as important contextual information, for example `<button aria-label="Edit name">Edit</button>`, `<button aria-label="Edit address">Edit</button>`, and so on.
  - **Use the `aria-describedby` attribute to indicate the relationship between the control and the content it relates to:** For example, `<p id="firstName">First name</p> <button aria-describedby="firstName">Edit</button>`.
- **Do include a control's visible text in its accessible name:** Any visible text used to label a control must be included exactly as written in the control's accessible name. The accessible name can include additional information before or after the visible text, but the visible text itself must not differ. For example, the accessible name for a link containing the link phrase "Read more" can be "Read more about [subject]", because the visible text is included without modification. However, the accessible name cannot be "Read some more about [subject]", because the term "some" appears between the words "Read" and "more", which is not reflected in the visible text.
- **Don't reuse an accessible name across controls with different effects in the same view:** Make sure that each accessible name is disambiguated in some way using one of the techniques described above.
  - **Caveat:** Having two separate buttons with the accessible name of "Close" in two separate dialog boxes is fine, because only one dialog box is reachable at a time; however, multiple "Edit" buttons for different effects in the same dialog box is not.
- **Don't reuse an accessible name across hyperlinks that point to different `href` targets:** For example, avoid `<a href="annualreport2025.html">Annual Report</a>` and `<a href="annualreport2026.html">Annual Report</a>`. Use `<a href="annualreport2025.html">Annual Report 2025</a>` and `<a href="annualreport2026.html">Annual Report 2026</a>` (or an equivalent technique for disambiguating controls described above) instead.
- **Don't pack descriptions, error messages, or instructions into the label:** Verbose labels can confuse and frustrate people who use screen readers. Instead, use the `aria-describedby` attribute to programmatically associate any additional content with the field. For example: `<label for="yourComments">Your comments</label><p id="yourCommentsWarning">Please do not include any personal information in this field.</p><textarea id="yourComments" aria-describedby="yourCommentsWarning"></textarea>`. Screen readers will then announce the label first, followed by the control type, and only then announce additional information that a user can skip if they are already aware of it.
- **Don't repeat state information already exposed by ARIA inside the label:** Examples include information exposed via the `aria-expanded`, `aria-checked`, `aria-selected`, `aria-pressed`, and similar attributes. This creates duplication, redundancy, and ambiguity.
- **Don't include the role name in the label**: This will lead to duplication. For example, `<nav aria-label="Primary navigation">` will be read by screen readers as "Primary navigation, navigation".

### Descriptions

- **Identify instructions, error messages, and any other important information explicitly related to a control as a description:** Examples of descriptions include:
  - A list of password requirements when creating an account
  - An error message related to a field in a previously submitted form
  - Additional instructions, such as "You must agree to the terms and conditions before you can submit the form"
- **Make sure the description is available to assistive technologies when the related element receives focus:**
  - If the description is already visible on the page, programmatically associate it with the element using the `aria-describedby` attribute.
  - If the description is not visible on the page and is explicitly for screen reader users (in other words, when providing a visible description is not appropriate or useful), apply the `aria-description` attribute to the element and use it to provide an appropriate description.
- **Don't include a description for every element**: if the primary label already provides sufficient (such as "First name"), any additional description is likely to be redundant.
  - **Caveat:** Inline error messages associated with controls, such as error messages below / above text fields, are an exception.
- **Don't include information in the description that is already provided by attributes applied to the element**: For example, including "This is a required field" as a description for an `<input>` element that already includes the `required` attribute will lead to duplicate announcements
  - **Caveat:** `aria-invalid="true"` is an exception; many screen readers will typically announce "invalid" when they reach an `<input>` that includes this attribute, which indicates that the field is in error but not what the error is. In such cases, a description (the actual human readable error message) is required.
- **Don't include interactive elements in an `aria-describedby` target** unless the content of the element reads sensibly as a description on its own. For example:
  - This is acceptable, as the entire text string makes sense when announced: `<p id="description">I understand the <a href="tandc.html">terms and conditions</a>.`
  - This is not appropriate, as the description will be announced as "Please don't include personal information in this field. Learn more.", where "Learn more" will be announced out of its intended context: `<p id="description">Please don't include personal information in this field. <a href="…">Learn more</a>`. Instead, only include the plain text in the referenced description: `<p><span id="description">Please don't include personal information in this field.</span> <a href="…">Learn more</a>`.

### Code Example: Visually Hidden Utility

A `.visually-hidden` utility provides text for screen readers without rendering it visually. It's commonly used for skip links, additional context on icon-only buttons, and supplementary labels.

```css
/* Hides content visually but keeps it in the accessibility tree.
   :focus-within / :active opt elements out — useful for skip links and
   any focusable content wrapped in this class. */
.visually-hidden:where(:not(:focus-within, :active)) {
  position: absolute !important;
  clip-path: inset(50%) !important;
  overflow: hidden !important;
  width: 1px !important;
  height: 1px !important;
  margin: -1px !important;
  padding: 0 !important;
  border: 0 !important;
  white-space: nowrap !important;
}
```

When the hidden content is focusable (skip links, focus-receiving wrappers), the `:focus-within`/`:active` exception lets it become visible. Style the visible state per situation, e.g. a skip link to the main content typically wants fixed positioning at the top-left of the viewport so the rest of the page doesn't shift.

## 4. Document Metadata and Language

Related WCAG Success Criteria:

- WCAG Success Criterion 2.4.2 Page Titled (Level A)
- WCAG Success Criterion 3.1.1 Language of Page (Level A)
- WCAG Success Criterion 3.1.2 Language of Parts (Level AA)

### Language

- **Do declare the page's human language:** Always apply the `lang` attribute to the page's `<html>` element, and set it to the primary human language of the page's content. For example, `<html lang="en">`.
- **Do declare changes in the page's human language:** If there is a language change on the page, apply the `lang` attribute to the parent/container element for the affected content, and set the value of this attribute to the shortcode for the language of the affected content. For example: `<p>In Germany, you may be greeted by someone saying <span lang="de">Guten Morgen</span>.</p>`.
- **Don't set the value of the `lang` attribute to a value that doesn't match the human language of the content:** This can cause screen readers and other text-to-speech software to announce the content in a non-understandable manner.

### Titles

- **Do include the `<title>` element in the `<head>` section for all pages:** This includes pages embedded into a document using an `<iframe>`
- **Provide unique page titles:**: Front-load the page's `<title>` with unique content that clearly reflects that page's purpose or content, such as `<title>Page Topic | Site Name</title>`.
- **Update single-page application (SPA) titles during page transitions:** For example, if the page title is `<title>Contact Us | My Website</title>` when a contact form is displayed, update the title to `<title>Thank you for contacting us! | My Website</title>` when the form is successfully submitted.
- **Don't include an empty `<title>` element in the `<head>` section of a page**: No matter how short inconsequential a page appears, do not use `<title></title>`. Page titles appear in the browser tab, so pages are more easily distinguishable when users have multiple tabs open, and are typically announced by screen readers when the page is opened.
- **Avoid using the same title for multiple pages, or using ambiguous page titles:** This will make it difficult for all users to quickly distinguish which page they are viewing without reviewing the actual page content itself.

### Iframes

- **Do provide a descriptive `title` for `<iframe>` elements**: All `<iframe>` elements should include a `title` attribute that includes a value that clearly describes the contents of the `<iframe>`.
- **Don't disable iframe scrolling** using `scrolling="no"` (deprecated) or `overflow: hidden` on iframes. Users who zoom in or enlarge text need to scroll to reach content that overflows.

### Code Example: using the `<title>` and `<iframe>` elements

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

## 5. Keyboard and Focus Management

Related WCAG Success Criteria:

- WCAG Success Criterion 2.1.1 Keyboard (Level A)
- WCAG Success Criterion 2.4.3 Focus Order (Level A)
- WCAG Success Criterion 2.4.7 Focus Visible (Level AA)
- WCAG Success Criterion 2.5.8 Target Size (Minimum) (Level AA)

### Tab order and focusability

- **Provide a logical tab order:** Make sure that the order in which elements receive focus follows an appropriate sequence.  
  - **Caveat:** In left-to-right reading languages, the tab order is logical when focus moves from top-to-bottom and left-to-right. However, in right-to-left reading languages, the tab order is logical when focus moves from top-to-bottom and right-to-left.
- **Use `tabindex` only when necessary:** Apply `tabindex="0"` to elements requiring focus where an appropriate interactive role has been applied but the element isn't focusable by default; for example, `<span role="button" tabindex="0">Print</span>`
- **Manage focus correctly to and from updated content:** For example, if a dialog box appears on the page, make sure that focus immediately moves to the dialog box, is restricted to the contents of the dialog box, and (when dismissed) returns to the element that originally triggered the dialog box.
- **Don't apply `tabindex="0"` to interactive elements that are already focusable by default:** Native elements like the `<button>`, `<a>` (only with the associated `href` attribute), and `<input>` elements are already keyboard focusable, and therefore do not require `tabindex="0"`.
- **Don't apply `tabindex="0"` to static, non-interactive, and hidden elements:** only elements that (when activated) perform a specific action should be included in a page's tab order. Static, non-interactive, and elements that are hidden (either temporarily or permanently) must not be focusable.
- **Don't use positive `tabindex` values:** Never apply `tabindex="0"` (or any value >0) to elements, as doing so can impose a tab order on the page that bears no resemblance to the intended or expected tab order.

### Keyboard handlers

- **Attach <kbd>Enter</kbd>/<kbd>Space</kbd> handlers for custom simulated interactive elements:** When implementing a custom keyboard handler for button-like elements, <kbd>Enter</kbd> should be a `keydown` handler and <kbd>Space</kbd> should be a `keyup` handler (matching native `<button>` behavior where <kbd>Enter</kbd> repeats and <kbd>Space</kbd> triggers on release).
- **Don't attach keyboard handlers to native interactive elements:** Native elements such as the `<button>`, `<input>`, and `<a>` (with the required `href` attribute) elements already support the <kbd>Enter</kbd> and (except for the `<a>` element) the <kbd>Space</kbd> keys by default, so adding these keyboard handlers is at best redundant and at worst could lead to unexpected behaviour.
  - **Caveat:** if the `<a>` element is repurposed as a button through the inclusion of `role="button"`, a `keyup` handler is still required to support the <kbd>Space</kbd> key to match native `<button>` behavior.

#### Code Example: Keyboard handlers

```javascript
// Good: Keyboard handlers for complex custom widgets (e.g., Tree items, tabs).
// NOTE: This pattern applies ONLY to non-standard UI where no native HTML tag exists.
// Always prioritize native <button> or <input> elements for standard interactions.
// Elements MUST have the appropriate ARIA role (e.g., role="treeitem" or role="tab").
customWidget.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    toggleWidgetState();
  }
  if (e.key === ' ') {
    e.preventDefault(); // Prevent page scrolling on Spacebar keydown
  }
});

customWidget.addEventListener('keyup', (e) => {
  if (e.key === ' ') {
    toggleWidgetState();
  }
});

function toggleWidgetState() {
  // E.g., Manage toggle/expanded states for custom controls
  const isExpanded = customWidget.getAttribute('aria-expanded') === 'true';
  customWidget.setAttribute('aria-expanded', !isExpanded);
}
```

### Focus indicators

- **Use visible focus indicators:** Always style `:focus-visible` state (not :`focus`) explicitly.
- **Prefer browser native focus indicators over custom focus indicators:** Ideally, leave focus indication to the browser.
- **Don't disable browser native focus indicators without providing a replacement custom focus indicator:** When using `outline: none;` to suppress the browser native focus indicator, provide an equivalent custom focus indicator that has a contrast ratio of at least `3:1` against adjacent content (WCAG Success Criterion 1.4.11 Non-text Contrast).
- **Prefer `outline` over other properties for focus rings:** If you must rely on `box-shadow` for focus rings, provide an `outline`-based fallback for High Contrast Mode using the `forced-colors` media query.
- **Pair custom focus outlines with `outline-offset`:** This visually separates the ring from the element.

#### Code Example: Custom focus indication

```css
/* Good: High contrast focus border */
:where(a:any-link, button):focus-visible {
  outline: 3px solid #ff0055;
  outline-offset: 3px;
}
```

### Touch targets

- **Do size interactive elements to have a target of at least 24x24 CSS pixels:** Enforce the target size of elements using `min-block-size` / `min-inline-size` or through padding rather than `width` / `height` so that content can grow the target but not shrink it.
  - **Caveat:** interactive elements _can_ have a target of less than 24x24 CSS pixels _as long as_ they are positioned in such a way that if a CSS pixel diameter circle is centered on the bounding box of each element, the circles do not intersect nearby targets or circles for other targets that are less than 24x24 CSS pixels
- Bump targets up on coarse points: `@media (pointer: coarse) { … }`.
- **Don't use `touch-action: none;` for custom gestures:** This disables page scrolling through the element. Scope to the axis you actually need - `pan-y` for horizontal swipes (the page still scrolls vertically), and `pan-x` for vertical swipes. Reserve `none` for elements where no native touch behavior makes sense, such as a drawing canvas.

## 6. Alternate Text and Media

Related WCAG Success Criteria:

- WCAG Success Criterion 1.1.1 Non-text Content (Level A)
- WCAG Success Criterion 1.2.1 Audio-only and Video only (Prerecorded) (Level A)
- WCAG Success Criterion 1.2.2 Captions (Prerecorded) (Level A)
- WCAG Success Criterion 1.2.3 Audio Description or Media Alternative (Prerecorded) (Level A)
- WCAG Success Criterion 1.2.4 Captions (Live) (Level AA)
- WCAG Success Criterion 1.2.5 Audio Description (Prerecorded) (Level AA)

### Images

- **Provide informative visual descriptions:** Describe the purpose of the image (for example, "Search", not "Magnifying glass").
- **Apply `alt=""` to decorative visuals:** This prevents screen readers from announcing them.
- **Don't use clichéd prefixes:** Avoid terms like "Image of…" and "Picture of…".
- **Don't use underscores in filenames:** Use dashes if the filename might be announced as fallback.

#### Code Example: Providing a text description for `<img>` elements

```html
<!-- Decorative -->
<img src="divider.png" alt="">

<!-- Informative (Functional) -->
<a href="/search">
  <img src="glass.png" alt="Search the platform">
</a>
```

### Inline SVGs

- **Do apply `role="img"` to the `<svg>` element for non-decorative SVGs:** This is so that they are globally exposed as images.
- **Do provide a text description for non-decorative SVGs:** Use one of the following techniques:
  - Include a nested `<title>` element as a child of the `<svg>` element that includes the text description **or**
  - Apply the `aria-label` attribute to the `<svg>` element and set its value to an appropriate text description
- **Do hide decorative SVGs from assistive technologies:** Apply `aria-hidden="true"` to decorative `<svg>` elements to prevent screen readers from announcing them.

#### Code Example: Providing a text description for non-decorative SVGs using the `<title>` element

```html
<!-- Inline non-decorative SVG: example that uses the <title> element -->
<svg role="img" viewBox="0 0 24 24">
  <title>Home</title>
  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
</svg>
```

#### Code Example: Providing a text description for non-decorative SVGs using the `aria-label` attribute

```html
<!-- Inline non-decorative SVG: example that uses the aria-label attribute -->
<svg role="img" viewBox="0 0 24 24" aria-label="Home">
  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
</svg>
```

#### Code Example: Identifying decorative SVGs

```html
<!-- Inline Decorative SVG (hide from assistive technologies) -->
<svg aria-hidden="true" viewBox="0 0 24 24">
  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
</svg>
```

### Complex images and charts

- **Provide long descriptions for complex images:** Use `<figure>`/`<figcaption>` or `aria-describedby` for charts and infographics.
- **Provide semantic data tables as alternatives:** Provide semantic data tables as accessible alternatives for charts and other complex visualizations.

#### Code Example: Complex graph with figcaption

```html
<!-- Complex graph with figcaption -->
<figure>
  <img src="chart.png" alt="Sales growth graph 2024.">
  <figcaption>Sales grew 20% in Q3 due to new platform launch.</figcaption>
</figure>
```

### Audio and video

- **Do provide a transcript for audio-only content and combined video & audio content:** The transcript should be verbatim, and include all of the dialogue as well as text descriptions of important non-speech sounds such as sound effects.
- **Do provide a text description or an audio track for video-only content:** Examples include text-based instructions for an animation on how to use a particular product, and a separate audio track that includes a description of the action in the video.
- **Do provide synchronous captions for videos:** Supply WebVTT captions for audio tracks within video content. The captions should be verbatim and synchronous with the audio track, and include all of the dialogue as well as meaningful non-speech content such as sound effects and other important information conveyed within the soundtrack (for example, "Ominous music plays").
- **Do provide an audio description for videos:** Include an additional audio track within the video that augments the visual content displayed on-screen. The audio description should convey information about the scene that is not described or spoken in the main audio track, and is typically conveyed during existing pauses in the dialogue.

#### Code Example: Video and audio content with captions and transcript

```html
<!-- Video with Captions tracks -->
<video controls>
  <source src="intro.mp4" type="video/mp4">
  <track src="caps.vtt" kind="captions" srclang="en" label="English">
</video>

<!-- Audio with expandable transcript details -->
<audio controls src="podcast.mp3" aria-details="podcast-transcript"></audio>
<details id="podcast-transcript">
  <summary>View Transcript</summary>
  <div class="transcript-content">
    Welcome to the show...
  </div>
</details>
```

### CSS generated content

- **Alt text for CSS generated content**: Use the alternative text argument of `content` (e.g. `content: url(icon.svg) / "Save";`) and keep meaningful text in the DOM. See {{ GUIDE_REF('accessible-generated-content') }} for more details.

### Content Visibility Decision Matrix

| Intent | Visual | Screen Reader | Focusable | Structural Pattern |
| :--- | :--- | :--- | :--- | :--- |
| **Visible to all** | Yes | Yes | Yes | Standard rendering |
| **Screen Reader only** | No | Yes | Yes (if interactive) | Visually hidden utility (e.g. `.visually-hidden`) |
| **Visual only** | Yes | No | No | `aria-hidden="true"` |
| **Hidden for all** | No | No | No | `hidden` attribute / `display: none` |

**Heuristic Rule**: If an element can receive keyboard focus, it must not be hidden via `aria-hidden="true"`.

## 7. Forms and Input Controls

Related WCAG Success Criteria:

- WCAG Success Criterion 1.3.1 Info and Relationships (Level A)
- WCAG Success Criterion 1.3.5 Identify Input Purpose (Level AA)
- WCAG Success Criterion 3.2.1 On Focus (Level A)
- WCAG Success Criterion 3.2.2 On Input (Level A)
- WCAG Success Criterion 3.3.2 Labels or Instructions (Level A)

### Labels and hints

- **Do provide a label for all form controls:** do not rely on the currently selected input or value as a way of labelling the control.
- **Connect Labels Programmatically**: Use `<label for="id">` linked to `<input id="id">`.
- **Don't use placeholders as labels**: Placeholders are not persistent labels.
- **Link hints to inputs via `aria-describedby`**: Associate help text with inputs, and place the hint above the input so autocomplete popovers don't cover it during editing.

#### Code Example: A labelled form control with a hint for passwords

```html
<!-- Good: Semantic forms with hints for passwords -->
<form>
  <label for="pwd">Password:</label>
  <span id="pwd-hint">Must contain at least 8 characters.</span>
  <input id="pwd" type="password" aria-describedby="pwd-hint" autocomplete="current-password" required>
</form>
```

### Input assistance and validation

- **Do use the `autocomplete` attribute**: Apply the `autocomplete` attribute to `<input>`, `<textarea>`, and `<select>` elements that collect personal information about the user, and set it to the correct value (for example `"email"` or `"given-name"`).
- **Provide form validation constraints**: Use `required` (or `aria-required="true"` only when `required` isn't applicable) to signal mandatory inputs.
- **Don't trigger context shifts on focus changes**: Avoid auto-submitting forms or jumping pages on focus change events alone.

## 8. Live Regions

Live regions let assistive tech announce content updates that aren't tied to navigation or focus changes. They're easy to misuse — too many regions, or noisy ones, quickly become spam for screen-reader users.

Related WCAG Success Criteria:

- WCAG Success Criterion 4.1.3 Status Messages (Level AA)

### Live Region Urgency Table

| Urgency | Visual Analogue | `aria-live` Value | Behavioral Impact | Example |
| :--- | :--- | :--- | :--- | :--- |
| **Critical** | Modal / Alert | `assertive` (or `role="alert"`) | Interrupts immediately, clears speech queue | Session timeout, API failure |
| **Standard**| Toast / Banner | `polite` | Announces at next graceful break | Search results, "Saved" status |
| **Passive**  | Silent text | `off` | Only if user navigates to it | Live character count |

**Heuristic Rule**: Use `assertive` only for critical, time-sensitive updates that require immediate attention or prevent safe continuation (e.g., data loss, session timeouts, or network drops).

### When to announce live regions

- **Announce dynamic errors via live regions**: Use `aria-live` or shift focus to error lists.
- **Don't use live regions for interstitial states** like "Loading…" or "Updating…" unless they're meaningfully informative — they usually just create noise.

```html
<!-- Session Timeout Warning with controls -->
<div role="alert" class="timeout-warning">
  Your session will expire in 2 minutes.
  <button type="button" onclick="extendSession()">Extend Session</button>
</div>
```

### Managing announcements

- **Centralize live regions for non-visible announcements**: A single `polite` region and a single `assertive` region per page (with whatever `aria-atomic` configuration you need) keeps announcements consistent and easier to maintain. Many frameworks ship their own announcer abstraction — use it.
- **Debounce frequently-changing regions**: If a region can update many times per second (e.g. a combobox's result count as the user types), debounce so users aren't spammed.
- **Delay slightly when other announcements may collide**: When the user is typing or focus is being managed, a small delay before announcing keeps live-region updates from overlapping other speech.
- **Don't add live-region updates to inert DOM**: When dialogs open or sections become `inert`, queued or debounced messages can end up unannounced — or announced from DOM the user can't reach. Coordinate live-region updates with dialog/inert state changes.

## 9. Color

See {{ GUIDE_REF('color') }} for accessible color (contrast requirements, light and dark color schemes, Forced Colors Mode, etc).

## 10. Typography

See {{ GUIDE_REF('typography') }} for readable typography.

## 11. Motion and Preferences

See {{ GUIDE_REF('motion') }}.

## 12. Modals and Native Dialogs

Modern browsers provide native solutions for creating modal dialogs which avoid the need for focus traps, managing the accessibility of outside content, ensuring the content is on top, and dimming the background content — all of which can be error prone and require heavy JavaScript event tracking to maintain.

Related WCAG Success Criteria:

- WCAG Success Criterion 1.3.2 Meaningful Sequence (Level A)
- WCAG Success Criterion 2.4.3 Focus Order (Level A)
- WCAG Success Criterion 4.1.2 Name, Role, Value (Level A)

### Native `<dialog>`

- **Use the native `<dialog>` element**: Invoke the dialog using the `.showModal()` method to open it in a modal state. When in a modal state, the browser sets outside content as inert (i.e. the outside content is hidden from the accessibility tree and cannot be interacted with nor be focused).
- **Don't implement focus traps for native modal dialogs**: When a `<dialog>` element is opened in a modal state, browsers set outside content as inert which is sufficient for ensuring only the dialog’s content can be focused.

#### Code Example: HTML & JavaScript: Native `<dialog>` with standard close events

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

### Custom overlays

- **Use the `inert` Attribute for Custom Overlays**: When `<dialog>` cannot be used (e.g., some non-modal overlays, framework constraints, or layouts where `<dialog>`'s top-layer/positioning behavior conflicts with the design), apply `inert` to outside content to ensure it cannot be interacted with by keyboard, pointer, or assistive technology. This requires structuring elements in such a way that the custom overlay is not a descendant of the element with `inert` set on it.

## 13. Testing Validations

### Automated checks

- **Run Automated checks via axe-core or Lighthouse audits**: Catch missing alt texts or low contrasts (e.g., via Lighthouse in Chrome DevTools MCP).
- **Don't rely purely on scores**: A 100% score does not guarantee real usability.

### Manual testing

- **Validate Sequential Navigations using keyboards alone**: Using only keyboard shortcuts, such as Tab/Shift+Tab, arrow keys, Enter, Space, and Esc, confirm every interactive element is reachable and operable, and that focus never gets stuck.
- **Test on Screen Readers with calibrated browsers**: Rely on standard bindings (e.g., JAWS with Chrome, NVDA with Firefox, Narrator with Edge, VoiceOver with Safari on macOS and iOS, TalkBack with Chrome for Android).
