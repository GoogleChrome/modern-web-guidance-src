Below is my “Redundancy Mirror” for modern web development common knowledge: things I would generally know and apply without needing a project-specific guide. I’m answering from inherent knowledge only, without inspecting files or searching.

**Scope**

This covers browser-native web development: HTML, CSS, JavaScript, TypeScript-adjacent practices, DOM APIs, networking, storage, accessibility, performance, security, forms, progressive enhancement, Web Components, build hygiene, and clean code principles.

It intentionally includes broad, standard guidance so project-specific docs can prune anything that is merely common practice.

---

## Core Philosophy

Modern web development should default to platform features before custom abstractions.

Prefer:

- Semantic HTML over generic `div` trees.
- CSS layout primitives over JavaScript measurement.
- Native form behavior over custom state machines.
- Browser APIs over unnecessary dependencies.
- Progressive enhancement over brittle browser detection.
- Small, composable modules over large framework-specific utilities.
- Clear state ownership over implicit side effects.
- Accessibility built into the structure, not patched on later.
- Feature detection over user-agent sniffing.
- Standards-based APIs over legacy libraries.

A good default web implementation should still work when JavaScript is slow, delayed, partially failed, or unavailable, unless the product is inherently JavaScript-only.

---

# JavaScript Language

## Modern Syntax Defaults

Use modern JavaScript syntax that is widely supported in current evergreen browsers.

Default to:

```js
const value = computeValue();
let count = 0;
```

Use `const` unless reassignment is needed. Use `let` for reassignment. Avoid `var`.

Use arrow functions for short callbacks:

```js
items.map((item) => item.name);
```

Use named functions when stack traces, recursion, hoisting, or readability benefit:

```js
function parseUserInput(input) {
  return input.trim();
}
```

Use template literals for interpolation:

```js
const label = `${user.name} (${user.role})`;
```

Use object shorthand:

```js
const user = { id, name, email };
```

Use destructuring when it improves clarity:

```js
const { id, name } = user;
const [first, second] = items;
```

Do not overuse destructuring when it obscures the source object or creates long function signatures.

Use default parameters:

```js
function createButton(label = 'Submit') {
  return label;
}
```

Use rest parameters instead of `arguments`:

```js
function sum(...numbers) {
  return numbers.reduce((total, n) => total + n, 0);
}
```

Use spread syntax for shallow copies and argument expansion:

```js
const nextItems = [...items, newItem];
const nextUser = { ...user, name: 'Ada' };
```

Remember spread is shallow. Nested objects still share references.

Use optional chaining for nullable paths:

```js
const city = user.address?.city;
```

Use nullish coalescing for fallback only on `null` or `undefined`:

```js
const pageSize = options.pageSize ?? 20;
```

Avoid `||` defaults when `0`, `false`, or `''` are valid values.

Use logical assignment when it is clear:

```js
config.timeout ??= 5000;
cache[key] ||= computeValue();
```

Avoid clever chaining when simple conditionals are easier to read.

Use numeric separators for long literals:

```js
const maxBytes = 10_000_000;
```

Use `for...of` for iterable values when you need sequential control flow:

```js
for (const item of items) {
  process(item);
}
```

Use array methods for transformations:

```js
const activeUsers = users.filter((user) => user.active);
const names = users.map((user) => user.name);
```

Avoid using `map` for side effects.

Use `Object.hasOwn()` instead of `obj.hasOwnProperty()`:

```js
if (Object.hasOwn(record, key)) {
  // ...
}
```

Use `Array.prototype.at()` for relative indexing:

```js
const last = items.at(-1);
```

Use `structuredClone()` for deep cloning structured data when supported and appropriate:

```js
const copy = structuredClone(data);
```

Do not use `JSON.parse(JSON.stringify(value))` as a general-purpose deep clone. It loses dates, maps, sets, `undefined`, special numbers, prototypes, and non-JSON values.

Use `Promise.all()` for independent concurrent work:

```js
const [user, settings] = await Promise.all([
  fetchUser(id),
  fetchSettings(id),
]);
```

Use `Promise.allSettled()` when partial failures are expected:

```js
const results = await Promise.allSettled(tasks);
```

Use `Promise.race()` or `AbortController` for timeout/cancellation patterns.

Use top-level `await` only in modules where startup ordering is intentional.

Use `try`/`catch` around awaited operations that can fail and need local recovery.

```js
try {
  const response = await fetch(url);
} catch (error) {
  showNetworkError(error);
}
```

Do not catch errors only to log and rethrow unless adding useful context.

Use `Error` with meaningful messages:

```js
throw new Error(`Expected user ${id} to exist`);
```

Use `cause` when wrapping errors:

```js
throw new Error('Failed to load profile', { cause: error });
```

Use classes when modeling stateful entities with behavior:

```js
class Store {
  #items = [];

  add(item) {
    this.#items.push(item);
  }

  get items() {
    return [...this.#items];
  }
}
```

Use private class fields for encapsulation when appropriate:

```js
class Counter {
  #value = 0;

  increment() {
    this.#value += 1;
  }
}
```

Prefer plain objects and functions for simple data transformations.

---

# JavaScript Data Structures

Use arrays for ordered lists.

Use objects for records with known string keys.

Use `Map` for dynamic key-value collections, especially when keys are not strings or insertion order matters:

```js
const byId = new Map();
byId.set(user.id, user);
```

Use `Set` for uniqueness:

```js
const selectedIds = new Set();
selectedIds.add(id);
```

Use `WeakMap` for metadata associated with object lifetimes:

```js
const metadata = new WeakMap();
metadata.set(element, { initialized: true });
```

Use `Date` carefully. Native `Date` is mutable and has time zone pitfalls.

For dates:

- Store machine timestamps as ISO 8601 strings or epoch milliseconds.
- Use UTC for persistence when possible.
- Use `Intl.DateTimeFormat` for display.
- Avoid hand-rolled date formatting.
- Be explicit about local time versus absolute time.

Use `URL` and `URLSearchParams` instead of string concatenation:

```js
const url = new URL('/search', location.origin);
url.searchParams.set('q', query);
url.searchParams.set('page', String(page));
```

Use `Intl` APIs for locale-aware formatting:

```js
const currency = new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: 'USD',
}).format(amount);

const date = new Intl.DateTimeFormat(locale, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date());
```

Use `Intl.Collator` for human sorting:

```js
const collator = new Intl.Collator(locale, { sensitivity: 'base' });
items.sort((a, b) => collator.compare(a.name, b.name));
```

---

# Modules

Use ES modules.

```js
export function formatName(user) {
  return `${user.firstName} ${user.lastName}`;
}

import { formatName } from './format-name.js';
```

Prefer named exports for shared utilities because they refactor and tree-shake well.

Use default exports when a module clearly has one primary export, such as a component or class.

Keep modules cohesive. A module should have a clear reason to change.

Avoid circular dependencies. If two modules depend on each other, extract shared behavior into a third module.

Avoid side effects in utility modules. Side effects should be explicit at application boundaries.

Prefer explicit imports over global variables.

Use dynamic `import()` for lazy loading:

```js
const { openDialog } = await import('./dialog.js');
openDialog();
```

Use import maps where appropriate in no-build or platform-oriented projects.

---

# TypeScript-Adjacent Common Knowledge

Even in JavaScript projects, code benefits from type-shaped thinking.

Prefer precise data contracts.

Use JSDoc when not using TypeScript:

```js
/**
 * @param {{ id: string, name: string }} user
 */
function renderUser(user) {
  // ...
}
```

If using TypeScript:

- Prefer `unknown` over `any`.
- Narrow external input before use.
- Use discriminated unions for state machines.
- Prefer `type` for unions and object aliases.
- Prefer `interface` when declaration merging or object shape extension is useful.
- Avoid non-null assertions unless the invariant is obvious and enforced.
- Keep public types stable and internal types flexible.
- Do not model everything with classes.
- Validate runtime input even if TypeScript says it is typed.

Example discriminated union:

```ts
type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };
```

External data must be treated as untrusted:

```ts
const data: unknown = await response.json();
```

Use runtime schemas or explicit validation at boundaries.

---

# DOM APIs

Prefer scoped DOM queries:

```js
const form = document.querySelector('form');
const button = form?.querySelector('button[type="submit"]');
```

Use `querySelector` and `querySelectorAll` for selector-based queries.

Remember `querySelectorAll()` returns a static `NodeList`.

Convert to array when needed:

```js
const buttons = [...document.querySelectorAll('button')];
```

Use `closest()` for event delegation and ancestor matching:

```js
const button = event.target.closest('button[data-action]');
```

Use `matches()` to test selectors:

```js
if (element.matches('[aria-expanded="true"]')) {
  // ...
}
```

Use `classList` instead of string manipulation:

```js
element.classList.toggle('is-active', isActive);
```

Use `dataset` for simple custom data attributes:

```html
<button data-user-id="123">Delete</button>
```

```js
const id = button.dataset.userId;
```

Use `textContent` for text insertion:

```js
element.textContent = user.name;
```

Avoid `innerHTML` with untrusted content. If HTML insertion is required, sanitize it with a trusted sanitizer.

Use `insertAdjacentHTML()` only with trusted or sanitized HTML.

Prefer creating DOM nodes for dynamic content:

```js
const item = document.createElement('li');
item.textContent = label;
list.append(item);
```

Use `replaceChildren()` to replace content safely:

```js
list.replaceChildren(...items.map(renderItem));
```

Use `DocumentFragment` for batch insertion when useful:

```js
const fragment = document.createDocumentFragment();
for (const item of items) {
  fragment.append(renderItem(item));
}
list.append(fragment);
```

Use `template` elements for reusable inert markup:

```html
<template id="item-template">
  <li><span></span></li>
</template>
```

Use `HTMLTemplateElement.content.cloneNode(true)` to instantiate.

Use `Element.toggleAttribute()` for boolean attributes:

```js
button.toggleAttribute('disabled', isSaving);
```

Set DOM properties when they represent live state:

```js
input.value = value;
input.checked = checked;
button.disabled = isDisabled;
```

Set attributes when controlling markup semantics:

```js
button.setAttribute('aria-expanded', String(expanded));
```

---

# Events

Use `addEventListener()`.

```js
button.addEventListener('click', handleClick);
```

Prefer named handlers when removal or readability matters.

Use event delegation for repeated dynamic elements:

```js
list.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-id]');
  if (!button || !list.contains(button)) return;

  deleteItem(button.dataset.id);
});
```

Use options:

```js
element.addEventListener('click', handler, { once: true });
window.addEventListener('scroll', onScroll, { passive: true });
```

Use `{ passive: true }` for scroll/touch listeners that do not call `preventDefault()`.

Use `AbortController` to clean up listeners:

```js
const controller = new AbortController();

button.addEventListener('click', onClick, {
  signal: controller.signal,
});

controller.abort();
```

Use custom events for decoupled component communication:

```js
element.dispatchEvent(
  new CustomEvent('itemselect', {
    bubbles: true,
    detail: { id },
  }),
);
```

Use `preventDefault()` only when intentionally replacing native behavior.

Use `stopPropagation()` sparingly. It can break composition.

Do not rely on inline event attributes like `onclick`.

---

# Fetch And Networking

Use `fetch()` for HTTP requests.

```js
const response = await fetch('/api/users');

if (!response.ok) {
  throw new Error(`Request failed: ${response.status}`);
}

const users = await response.json();
```

Remember `fetch()` only rejects on network-level failures, not HTTP error statuses.

Use `AbortController` for cancellation:

```js
const controller = new AbortController();

const response = await fetch(url, {
  signal: controller.signal,
});

controller.abort();
```

Use timeouts explicitly:

```js
function timeoutSignal(ms) {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}
```

Use `URLSearchParams` for query strings:

```js
const params = new URLSearchParams({ q: query, page: String(page) });
const response = await fetch(`/search?${params}`);
```

Set headers intentionally:

```js
await fetch('/api/items', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});
```

Do not manually set `Content-Type` for `FormData`; the browser sets the multipart boundary.

```js
const formData = new FormData(form);

await fetch('/upload', {
  method: 'POST',
  body: formData,
});
```

Use credentials deliberately:

```js
fetch('/api/session', {
  credentials: 'include',
});
```

Be aware of CORS, cookies, SameSite, CSRF, and credentialed requests.

Use `Response` helpers:

```js
await response.text();
await response.json();
await response.blob();
await response.arrayBuffer();
```

Use streaming APIs for large responses when appropriate.

Use `navigator.sendBeacon()` for low-priority analytics during page unload:

```js
navigator.sendBeacon('/analytics', JSON.stringify(event));
```

Use `keepalive: true` on small `fetch()` requests when appropriate during unload, with size constraints.

---

# HTML

Use semantic HTML first.

Prefer:

```html
<header>
  <nav aria-label="Main">
    <a href="/">Home</a>
  </nav>
</header>

<main>
  <h1>Account settings</h1>
</main>

<footer></footer>
```

Avoid building everything from `div` and `span`.

Use headings in a meaningful hierarchy.

Use one primary `h1` for the page or application view.

Use native controls:

- `<button>` for actions.
- `<a href>` for navigation.
- `<input>` for input.
- `<select>` for selection.
- `<textarea>` for multiline text.
- `<details>` / `<summary>` for disclosure when suitable.
- `<dialog>` for modal and non-modal dialogs when appropriate.
- `<form>` for submissions.

Do not use clickable `div`s when a button or link is correct.

Buttons should have `type` inside forms:

```html
<button type="submit">Save</button>
<button type="button">Cancel</button>
```

Use labels for form controls:

```html
<label for="email">Email</label>
<input id="email" name="email" type="email" autocomplete="email">
```

Or wrap the control:

```html
<label>
  Email
  <input name="email" type="email">
</label>
```

Use appropriate input types:

```html
<input type="email">
<input type="url">
<input type="tel">
<input type="number">
<input type="date">
<input type="search">
<input type="password">
```

Use autocomplete tokens:

```html
<input autocomplete="given-name">
<input autocomplete="family-name">
<input autocomplete="email">
<input autocomplete="current-password">
<input autocomplete="new-password">
```

Use built-in validation attributes:

```html
<input required minlength="2" maxlength="64">
<input type="email" required>
<input pattern="[0-9]{5}">
```

Use `fieldset` and `legend` for grouped controls:

```html
<fieldset>
  <legend>Notification preferences</legend>
  <label><input type="checkbox" name="email"> Email</label>
</fieldset>
```

Use `output` for calculated results:

```html
<output name="total" for="quantity price"></output>
```

Use `time` for dates/times:

```html
<time datetime="2026-05-13">May 13, 2026</time>
```

Use `picture` for art direction:

```html
<picture>
  <source media="(min-width: 800px)" srcset="large.webp">
  <img src="small.webp" alt="Description">
</picture>
```

Use responsive images:

```html
<img
  src="image-800.jpg"
  srcset="image-400.jpg 400w, image-800.jpg 800w, image-1200.jpg 1200w"
  sizes="(min-width: 800px) 50vw, 100vw"
  alt="Description"
>
```

Use `loading="lazy"` for below-the-fold images:

```html
<img src="photo.jpg" alt="..." loading="lazy">
```

Use `decoding="async"` for non-critical images:

```html
<img src="photo.jpg" alt="..." decoding="async">
```

Set explicit dimensions or aspect ratio for media to reduce layout shift:

```html
<img src="photo.jpg" width="800" height="600" alt="...">
```

Use `iframe` titles:

```html
<iframe title="Map of store location" src="..."></iframe>
```

Use `sandbox` on iframes when embedding untrusted content:

```html
<iframe sandbox="allow-scripts allow-same-origin" src="..."></iframe>
```

Use `meta viewport`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

Use `charset`:

```html
<meta charset="utf-8">
```

Use `lang`:

```html
<html lang="en">
```

---

# Accessibility

Accessibility is standard web quality, not an optional layer.

Start with semantic HTML. Native elements provide keyboard support, roles, names, states, and platform behavior.

Use ARIA only when native HTML cannot express the needed semantics.

First rule of ARIA: prefer no ARIA when semantic HTML works.

Use accessible names for controls:

```html
<button aria-label="Close">
  <svg aria-hidden="true">...</svg>
</button>
```

Do not use icon-only buttons without labels.

Use `aria-hidden="true"` for decorative icons.

Do not put focusable elements inside `aria-hidden` containers.

Use `alt` text for meaningful images:

```html
<img src="chart.png" alt="Sales increased from January to March">
```

Use empty alt for decorative images:

```html
<img src="divider.png" alt="">
```

Do not include “image of” or “picture of” unless context requires it.

Use visible focus states. Do not remove outlines without replacement.

Prefer `:focus-visible`:

```css
button:focus-visible {
  outline: 2px solid CanvasText;
  outline-offset: 2px;
}
```

Ensure keyboard access:

- Tab reaches interactive controls.
- Shift+Tab moves backward.
- Enter/Space activate buttons.
- Escape closes modals/popovers where expected.
- Focus is managed after opening/closing dialogs.
- No keyboard traps.

Use `dialog.showModal()` for modal dialogs when appropriate:

```js
dialog.showModal();
dialog.close();
```

When building custom dialogs, manage:

- Initial focus.
- Focus containment.
- Escape behavior.
- Return focus to opener.
- Background inertness.
- Accessible name.

Use `inert` to make inactive regions unfocusable when supported:

```html
<main inert></main>
```

Use live regions for dynamic status updates:

```html
<div role="status" aria-live="polite"></div>
```

Use `aria-live="assertive"` sparingly.

Use `aria-expanded` for disclosure triggers:

```html
<button aria-expanded="false" aria-controls="menu">Menu</button>
```

Use `aria-current` for current navigation item:

```html
<a href="/settings" aria-current="page">Settings</a>
```

Use `aria-describedby` for help and error text:

```html
<input id="email" aria-describedby="email-error">
<p id="email-error">Enter a valid email address.</p>
```

Do not use placeholder text as the only label.

Ensure color contrast:

- Normal text should meet WCAG contrast expectations.
- Important graphical indicators should not rely only on color.
- Focus indicators must be visible.

Respect user preferences:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    scroll-behavior: auto;
  }
}
```

Do not disable zoom.

Use logical reading order. Visual order should not contradict DOM order.

Use skip links for complex pages:

```html
<a class="skip-link" href="#main">Skip to content</a>
```

---

# CSS Modern Defaults

Use modern layout primitives.

Prefer Flexbox for one-dimensional layout:

```css
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
```

Prefer Grid for two-dimensional layout:

```css
.layout {
  display: grid;
  grid-template-columns: 16rem 1fr;
  gap: 1rem;
}
```

Use `gap` instead of margins between flex/grid children where possible.

Use logical properties for internationalization:

```css
.card {
  padding-block: 1rem;
  padding-inline: 1.25rem;
  margin-block-end: 1rem;
}
```

Use `inline-size` / `block-size` where appropriate instead of `width` / `height`.

Use modern viewport units carefully:

```css
.hero {
  min-block-size: 100dvh;
}
```

Prefer `dvh`, `svh`, or `lvh` when mobile browser UI behavior matters.

Use `min()`, `max()`, and `clamp()`:

```css
.container {
  inline-size: min(100% - 2rem, 72rem);
  margin-inline: auto;
}

.title {
  font-size: clamp(2rem, 4vw, 4rem);
}
```

Avoid viewport-based font scaling when it harms readability or causes layout instability. Use restrained `clamp()` if needed.

Use custom properties for design tokens and theming:

```css
:root {
  --color-bg: #fff;
  --color-text: #111;
  --space-2: 0.5rem;
}

.card {
  background: var(--color-bg);
  color: var(--color-text);
  padding: var(--space-2);
}
```

Use cascade layers to manage CSS ordering when appropriate:

```css
@layer reset, base, components, utilities;

@layer base {
  body {
    margin: 0;
  }
}
```

Use `@supports` for progressive enhancement:

```css
@supports (container-type: inline-size) {
  .card-grid {
    container-type: inline-size;
  }
}
```

Use container queries for component-responsive layouts:

```css
.card-list {
  container-type: inline-size;
}

@container (min-width: 40rem) {
  .card {
    grid-template-columns: auto 1fr;
  }
}
```

Use style queries only as progressive enhancement where supported.

Use `:is()` to simplify selector lists:

```css
:is(h1, h2, h3) {
  line-height: 1.1;
}
```

Use `:where()` for zero-specificity defaults:

```css
:where(ul, ol) {
  padding-inline-start: 1.5rem;
}
```

Use `:has()` for parent-aware styling where supported:

```css
.field:has(input:invalid) {
  border-color: red;
}
```

Use `:focus-visible` for keyboard focus styling.

Use `accent-color` for native controls:

```css
input[type='checkbox'] {
  accent-color: rebeccapurple;
}
```

Use `color-scheme` for native dark/light integration:

```css
:root {
  color-scheme: light dark;
}
```

Use `light-dark()` as progressive enhancement where available:

```css
:root {
  color: light-dark(#111, #eee);
  background: light-dark(#fff, #111);
}
```

Use `@media (prefers-color-scheme: dark)` for dark mode:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #111;
    --color-text: #eee;
  }
}
```

Use `@media (prefers-reduced-motion: reduce)` to reduce motion.

Use `@media (forced-colors: active)` to support high-contrast modes:

```css
@media (forced-colors: active) {
  button {
    border: 1px solid ButtonText;
  }
}
```

Use `scroll-margin` for anchored content under sticky headers:

```css
section {
  scroll-margin-block-start: 5rem;
}
```

Use `overscroll-behavior` where scroll chaining should be controlled:

```css
.modal {
  overscroll-behavior: contain;
}
```

Use `aspect-ratio` for stable media boxes:

```css
.video {
  aspect-ratio: 16 / 9;
}
```

Use `object-fit` for replaced elements:

```css
img {
  object-fit: cover;
}
```

Use `text-wrap: balance` for headings as progressive enhancement:

```css
h1 {
  text-wrap: balance;
}
```

Use `overflow-wrap: anywhere` for untrusted long text:

```css
.card {
  overflow-wrap: anywhere;
}
```

Use `line-clamp` carefully as progressive enhancement:

```css
.summary {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

Use CSS nesting if supported by the target browsers/build pipeline:

```css
.card {
  padding: 1rem;

  & h2 {
    margin-block-start: 0;
  }
}
```

Avoid excessive selector specificity.

Avoid styling by brittle DOM depth:

```css
/* Brittle */
.sidebar > div > ul > li > a {}
```

Prefer class-based component selectors.

Use `box-sizing: border-box` globally:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}
```

Use a minimal reset instead of aggressive resets that remove useful native behavior.

Avoid `!important` except for deliberate utility overrides or external integration boundaries.

Avoid layout shifts by reserving space for dynamic content.

Avoid animating layout properties like `width`, `height`, `top`, `left` when transform/opacity can work.

Animate:

```css
transform
opacity
filter
```

Be careful with `will-change`; use it sparingly and remove it when no longer needed.

---

# Forms

Use native forms whenever data submission or validation is involved.

```html
<form method="post" action="/account">
  <label for="name">Name</label>
  <input id="name" name="name" required>
  <button type="submit">Save</button>
</form>
```

Use `FormData` to collect form values:

```js
const formData = new FormData(form);
const name = formData.get('name');
```

Use `requestSubmit()` instead of programmatically clicking submit buttons:

```js
form.requestSubmit();
```

Use constraint validation APIs:

```js
if (!form.reportValidity()) {
  return;
}
```

Set custom validation messages carefully:

```js
input.setCustomValidity('Choose a username.');
input.reportValidity();
input.setCustomValidity('');
```

Use `inputmode` for mobile keyboard hints:

```html
<input inputmode="numeric">
<input inputmode="decimal">
<input inputmode="email">
```

Use `autocomplete` for better UX.

Use `name` attributes for successful controls.

Do not rely only on client-side validation. Server validation is required.

Avoid blocking paste in fields.

Avoid hostile password rules and arbitrary restrictions.

Use accessible error messages connected to controls.

Preserve user input on validation errors.

Disable submit buttons only when necessary, and ensure users receive feedback.

---

# Web Components

Use Web Components when native encapsulation, framework independence, or reusable browser-level components are valuable.

Define custom elements with hyphenated names:

```js
customElements.define('user-card', UserCard);
```

Use `HTMLElement` subclasses:

```js
class UserCard extends HTMLElement {
  connectedCallback() {
    this.textContent = 'User';
  }
}
```

Use lifecycle callbacks:

```js
class MyElement extends HTMLElement {
  connectedCallback() {}
  disconnectedCallback() {}
  attributeChangedCallback(name, oldValue, newValue) {}

  static get observedAttributes() {
    return ['open'];
  }
}
```

Use Shadow DOM for style/DOM encapsulation:

```js
class MyElement extends HTMLElement {
  constructor() {
    super();

    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<slot></slot>`;
  }
}
```

Prefer templates for larger component markup.

Use slots for composition:

```html
<my-card>
  <h2 slot="title">Title</h2>
  <p>Body</p>
</my-card>
```

Expose styling hooks through CSS custom properties and `part`:

```html
<button part="button">Save</button>
```

```css
my-element::part(button) {
  font-weight: bold;
}
```

Reflect simple boolean/string state to attributes when it affects styling, accessibility, or declarative usage.

Avoid putting complex objects in attributes. Use properties for object values.

Clean up timers, observers, and listeners in `disconnectedCallback`.

Do not overuse Shadow DOM when global styling, accessibility relationships, or simple markup composition would be easier without it.

Be aware that form-associated custom elements exist but require careful implementation.

---

# Browser Storage

Use `localStorage` only for small, non-sensitive, synchronous key-value data.

```js
localStorage.setItem('theme', 'dark');
const theme = localStorage.getItem('theme');
```

Avoid storing secrets in `localStorage`.

Remember `localStorage` is synchronous and can block.

Use `sessionStorage` for tab-scoped data.

Use IndexedDB for larger structured client-side storage.

Use Cache Storage through service workers for offline resources and request/response caching.

Use cookies for server-readable session state, with secure attributes:

```http
Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax
```

Use `HttpOnly` cookies for sensitive session tokens so JavaScript cannot read them.

Use `Secure` in production.

Use `SameSite=Lax` or `Strict` unless cross-site usage is required.

Do not store sensitive data in client-accessible storage.

Version stored schemas. Handle migrations and corrupted data gracefully.

---

# Service Workers And PWAs

Use service workers for offline support, caching strategies, background sync-like behavior where available, and app shell caching.

Register carefully:

```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js');
}
```

Use HTTPS, except localhost.

Understand lifecycle:

- install
- activate
- fetch
- update
- waiting worker
- clients claiming
- cache cleanup

Use cache versioning:

```js
const CACHE_NAME = 'app-v1';
```

Clean old caches during activation.

Use appropriate caching strategies:

- Cache first for immutable static assets.
- Network first for frequently changing content.
- Stale-while-revalidate for content where fast cached responses are acceptable.
- Network only for sensitive or non-cacheable requests.

Do not cache authenticated private data unless the product explicitly requires it and handles security implications.

Handle offline fallbacks deliberately.

Be careful with service worker bugs because they persist across reloads.

Provide update UX when users need the newest code.

Use the Web App Manifest for installable apps:

```html
<link rel="manifest" href="/manifest.webmanifest">
```

Include icons, name, short_name, start_url, display, background_color, and theme_color as needed.

---

# Security

Treat all external input as untrusted.

Avoid XSS:

- Use `textContent` for text.
- Avoid `innerHTML` with untrusted input.
- Sanitize user-generated HTML with a robust sanitizer.
- Use strict Content Security Policy where feasible.
- Avoid inline scripts.
- Escape data in the correct context.

Use CSP:

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'
```

Use nonces or hashes if inline scripts are unavoidable.

Avoid `eval`, `new Function`, string-based `setTimeout`, and string-based `setInterval`.

Use Trusted Types where appropriate for larger apps:

```http
Content-Security-Policy: require-trusted-types-for 'script'
```

Avoid DOM clobbering assumptions. Do not rely on global IDs becoming global variables.

Protect against CSRF when using cookies for authentication:

- SameSite cookies.
- CSRF tokens for unsafe methods when needed.
- Validate Origin/Referer where appropriate.

Use HTTPS.

Use secure cookie attributes.

Do not expose secrets in frontend code.

Do not trust hidden inputs or client-side checks.

Validate and authorize on the server.

Use Subresource Integrity for third-party static scripts when applicable:

```html
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-..."
  crossorigin="anonymous"
></script>
```

Prefer self-hosting critical dependencies.

Use `rel="noopener noreferrer"` for external new-tab links:

```html
<a href="https://example.com" target="_blank" rel="noopener noreferrer">
  Example
</a>
```

Use iframe sandboxing for untrusted embeds.

Use Permissions Policy to restrict powerful features:

```http
Permissions-Policy: geolocation=(), camera=(), microphone=()
```

Ask for permissions only in response to user intent.

Never log sensitive tokens, passwords, personal data, or authorization headers.

---

# Performance

Measure before optimizing.

Core concerns:

- Load less JavaScript.
- Avoid blocking rendering.
- Avoid layout shifts.
- Keep interaction latency low.
- Optimize images.
- Cache effectively.
- Avoid unnecessary re-renders.
- Reduce main-thread work.

Use semantic HTML and CSS for rendering instead of JavaScript where possible.

Keep bundles small.

Prefer route-level and interaction-level code splitting.

Lazy-load non-critical modules:

```js
button.addEventListener('click', async () => {
  const { openPicker } = await import('./picker.js');
  openPicker();
});
```

Use `defer` for scripts that do not need to block parsing:

```html
<script src="/app.js" defer></script>
```

Use `type="module"` for module scripts, which are deferred by default:

```html
<script type="module" src="/app.js"></script>
```

Avoid synchronous long tasks.

Break up heavy work:

```js
await new Promise((resolve) => setTimeout(resolve, 0));
```

Use `requestIdleCallback` for low-priority work where supported, with fallbacks.

Use Web Workers for CPU-heavy work.

Use `requestAnimationFrame` for visual updates:

```js
requestAnimationFrame(() => {
  element.style.transform = `translateX(${x}px)`;
});
```

Batch DOM reads and writes to avoid layout thrashing.

Bad:

```js
for (const item of items) {
  const height = item.offsetHeight;
  item.style.height = `${height + 10}px`;
}
```

Better: read first, write later.

Use `ResizeObserver` instead of polling size:

```js
const observer = new ResizeObserver((entries) => {
  for (const entry of entries) {
    // ...
  }
});
observer.observe(element);
```

Use `IntersectionObserver` for visibility/lazy work:

```js
const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      loadContent(entry.target);
    }
  }
});
```

Use `MutationObserver` for DOM change observation instead of repeated scanning.

Use CSS containment when appropriate:

```css
.widget {
  contain: layout paint;
}
```

Use `content-visibility` for large offscreen sections when suitable:

```css
.section {
  content-visibility: auto;
  contain-intrinsic-size: 600px;
}
```

Optimize images:

- Use modern formats like WebP and AVIF where appropriate.
- Provide responsive `srcset` and `sizes`.
- Use correct intrinsic dimensions.
- Lazy-load below-the-fold images.
- Avoid shipping huge images resized by CSS.
- Compress assets.

Preload critical resources carefully:

```html
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
```

Use `font-display: swap` or similar to avoid invisible text:

```css
@font-face {
  font-family: Inter;
  src: url('/fonts/inter.woff2') format('woff2');
  font-display: swap;
}
```

Use `fetchpriority` where appropriate:

```html
<img src="hero.jpg" alt="..." fetchpriority="high">
```

Avoid overusing preload and high priority. Incorrect priority hints can harm performance.

Use HTTP caching headers correctly.

Use immutable caching for fingerprinted assets:

```http
Cache-Control: public, max-age=31536000, immutable
```

Use short or validated caching for HTML.

Avoid layout shift:

- Set image/video dimensions.
- Reserve ad/embed space.
- Avoid injecting content above existing content.
- Use stable fonts or font metric overrides.
- Avoid late-loading banners that push content.

Use the Performance APIs:

```js
performance.mark('start');
// work
performance.mark('end');
performance.measure('work', 'start', 'end');
```

Use `PerformanceObserver` for metrics where appropriate.

---

# CSS And Rendering Performance

Prefer compositor-friendly animations:

```css
.modal {
  transition: opacity 150ms ease, transform 150ms ease;
}
```

Avoid animating:

- `height`
- `width`
- `top`
- `left`
- `margin`
- `padding`
- properties that trigger layout or paint heavily

Use transforms:

```css
.panel {
  transform: translateY(0);
}
```

Avoid huge box shadows and filters over large areas.

Avoid deeply nested selectors in large documents.

Avoid massive DOMs when virtualization or pagination is more appropriate.

Use `visibility`, `opacity`, `display`, and `hidden` intentionally.

`display: none` removes from layout and accessibility tree.

`visibility: hidden` preserves layout but hides visual content.

`opacity: 0` keeps layout and can still allow interaction unless disabled.

Use `hidden` for content that should not be displayed:

```html
<div hidden>...</div>
```

---

# Progressive Enhancement

Start with a working baseline.

Enhance when features exist:

```js
if ('showPopover' in HTMLElement.prototype) {
  // use popover
}
```

Use CSS feature queries:

```css
@supports (selector(:has(*))) {
  // enhanced styles
}
```

Avoid browser sniffing:

```js
// Prefer this
if ('IntersectionObserver' in window) {}
```

Use polyfills selectively.

A good progressive enhancement:

- Preserves core functionality.
- Uses feature detection.
- Has an acceptable fallback.
- Does not punish unsupported browsers with broken UI.

Cutting-edge features can be appropriate when:

- They are progressive enhancement.
- They have a fallback.
- They improve UX without controlling core access.
- They are isolated behind feature detection.
- The code remains understandable.

Examples of progressive enhancement candidates:

- Popover API.
- View Transitions API.
- CSS anchor positioning.
- Container/style queries.
- `:has()`.
- `content-visibility`.
- `text-wrap: balance`.
- Declarative Shadow DOM.
- Compression Streams.
- WebGPU, for specialized use cases with fallback to WebGL/Canvas.

---

# Dialog, Popover, And Overlays

Use native `<dialog>` for dialogs when it matches the desired behavior.

```html
<dialog id="settings-dialog">
  <form method="dialog">
    <button value="cancel">Cancel</button>
    <button value="confirm">Confirm</button>
  </form>
</dialog>
```

```js
dialog.showModal();
dialog.close();
```

Use `::backdrop` for modal backdrop styling:

```css
dialog::backdrop {
  background: rgb(0 0 0 / 0.4);
}
```

Use the Popover API for non-modal overlays where supported:

```html
<button popovertarget="menu">Menu</button>
<div id="menu" popover>...</div>
```

Use `showPopover()`, `hidePopover()`, and `togglePopover()` where appropriate.

Use popover as progressive enhancement when unsupported browsers need fallback behavior.

Do not use dialogs for simple dropdown menus if popover or a normal disclosure is more appropriate.

Manage focus and dismissal behavior carefully.

---

# Routing And Navigation

Use normal links for navigation.

```html
<a href="/settings">Settings</a>
```

Use the History API for client-side navigation:

```js
history.pushState({ page: 'settings' }, '', '/settings');
```

Handle `popstate`:

```js
window.addEventListener('popstate', () => {
  renderRoute(location.pathname);
});
```

Prefer server-compatible routes so reloads and deep links work.

Use URL as state for shareable, restorable state:

- current route
- filters
- search query
- pagination
- selected tab when useful

Use `URLSearchParams` for query state.

Do not hide important app state only in memory.

Handle scroll restoration deliberately:

```js
history.scrollRestoration = 'manual';
```

Use hash navigation for intra-page anchors when appropriate.

---

# State Management

Keep state minimal and explicit.

Prefer deriving values instead of duplicating state.

Bad:

```js
let items = [];
let itemCount = 0;
```

Better:

```js
const itemCount = items.length;
```

Keep state close to where it is used unless shared ownership is clear.

Separate:

- Server state.
- URL state.
- Form state.
- UI-only ephemeral state.
- Cached derived state.

Avoid global mutable state unless it is intentional and constrained.

Use immutable updates when it improves predictability:

```js
const nextItems = items.map((item) =>
  item.id === id ? { ...item, done: true } : item,
);
```

Avoid deep mutation across module boundaries.

Design state transitions explicitly for complex flows.

Use finite-state modeling for workflows with clear statuses.

Avoid boolean explosions:

```js
// Hard to reason about
isLoading
isSaving
hasError
isComplete
```

Prefer a single status where appropriate:

```js
status: 'idle' | 'loading' | 'success' | 'error'
```

---

# Error Handling

Handle errors at the appropriate boundary.

User-facing errors should be:

- Clear.
- Specific enough to act on.
- Non-technical unless the user is technical.
- Accessible.
- Recoverable where possible.

Developer logs should include context.

Do not swallow errors silently.

Do not expose sensitive implementation details to users.

Use retries only for operations that are safe to retry.

Use exponential backoff for repeated network retries.

Distinguish:

- Validation errors.
- Network errors.
- Permission errors.
- Not found errors.
- Server errors.
- Unexpected bugs.

Use fallback UI for failed async content.

Clean up loading state in `finally`:

```js
isLoading = true;

try {
  await save();
} finally {
  isLoading = false;
}
```

---

# Web APIs

## URL

Use `URL` for parsing and constructing URLs.

```js
const url = new URL(requestUrl);
const id = url.searchParams.get('id');
```

## Clipboard

Use the async Clipboard API in response to user action:

```js
await navigator.clipboard.writeText(text);
```

Handle permission and failure.

## File APIs

Use file inputs for user-selected files:

```html
<input type="file" accept="image/*">
```

Use `FileReader` or newer Blob methods:

```js
const text = await file.text();
const buffer = await file.arrayBuffer();
```

Use object URLs for local previews:

```js
const url = URL.createObjectURL(file);
image.src = url;
URL.revokeObjectURL(url);
```

Revoke object URLs when no longer needed.

## Drag And Drop

Use drag/drop APIs carefully and accessibly.

Always provide a non-drag alternative, such as file input or buttons.

## Canvas

Use `<canvas>` for immediate-mode graphics.

Account for device pixel ratio:

```js
const dpr = window.devicePixelRatio || 1;
canvas.width = Math.floor(width * dpr);
canvas.height = Math.floor(height * dpr);
context.scale(dpr, dpr);
```

Use OffscreenCanvas in workers for heavy rendering where supported.

## Web Workers

Use workers for CPU-heavy tasks:

```js
const worker = new Worker('/worker.js', { type: 'module' });
worker.postMessage(data);
```

Use transferable objects for large binary data:

```js
worker.postMessage(buffer, [buffer]);
```

## BroadcastChannel

Use `BroadcastChannel` for same-origin tab communication:

```js
const channel = new BroadcastChannel('app');
channel.postMessage({ type: 'logout' });
```

## Storage Events

Use `storage` events for cross-tab localStorage updates.

## WebSocket

Use WebSocket for bidirectional real-time communication.

Handle:

- reconnects
- backoff
- heartbeats
- duplicate messages
- ordering
- authentication
- graceful close

## Server-Sent Events

Use EventSource for one-way server-to-client streams:

```js
const events = new EventSource('/events');
events.addEventListener('message', (event) => {
  console.log(event.data);
});
```

## Streams

Use Streams for large or incremental data.

```js
const reader = response.body.getReader();
```

Use streams when avoiding full buffering matters.

## Encoding

Use `TextEncoder` and `TextDecoder`:

```js
const bytes = new TextEncoder().encode(text);
const text = new TextDecoder().decode(bytes);
```

## Crypto

Use Web Crypto API for cryptographic operations.

```js
const id = crypto.randomUUID();
const bytes = crypto.getRandomValues(new Uint8Array(16));
```

Use `crypto.randomUUID()` for UUIDs.

Do not implement your own cryptography.

Do not use `Math.random()` for security-sensitive randomness.

---

# Animation

Use CSS transitions/animations for simple UI animation.

Use Web Animations API for dynamic animation control:

```js
const animation = element.animate(
  [
    { opacity: 0, transform: 'translateY(8px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ],
  {
    duration: 150,
    easing: 'ease-out',
  },
);
```

Respect reduced motion:

```js
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
```

Avoid unnecessary motion.

Do not animate essential content in ways that block use.

Use View Transitions API as progressive enhancement for route/page transitions where supported.

---

# Responsive Design

Design fluid layouts.

Use:

- Flexible grids.
- Relative units.
- Container queries.
- Media queries where page-level breakpoints are needed.
- Intrinsic sizing.
- `minmax()`, `auto-fit`, and `auto-fill`.

Example:

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));
  gap: 1rem;
}
```

Avoid fixed pixel widths for major layouts.

Use `max-inline-size` for readable text:

```css
.article {
  max-inline-size: 70ch;
}
```

Use `rem` for spacing and typography that should respect user settings.

Use touch-friendly targets. Interactive controls should be large enough to tap.

Avoid hover-only interactions.

Use pointer/hover media queries:

```css
@media (hover: hover) and (pointer: fine) {
  .button:hover {
    background: var(--hover-bg);
  }
}
```

Make content work in narrow, wide, zoomed, and high-density environments.

Test at 200% zoom.

Avoid horizontal scrolling unless it is the intended interaction.

---

# Internationalization

Use `lang`.

Use logical CSS properties.

Avoid hard-coded assumptions about:

- Text length.
- Word boundaries.
- Date format.
- Time format.
- Number format.
- Currency format.
- Name format.
- Address format.
- Text direction.
- Plurals.

Use `Intl`:

```js
new Intl.NumberFormat(locale).format(number);
new Intl.DateTimeFormat(locale).format(date);
new Intl.RelativeTimeFormat(locale).format(value, unit);
new Intl.ListFormat(locale).format(items);
new Intl.PluralRules(locale).select(count);
```

Support RTL by avoiding left/right where inline-start/inline-end works.

Do not concatenate translated sentence fragments when grammar may vary.

---

# Clean Code Principles

Write code for readers.

Prefer clarity over cleverness.

Use descriptive names:

```js
const pendingInvitations = invitations.filter((invitation) => !invitation.accepted);
```

Avoid vague names:

```js
data
thing
stuff
obj
tmp
```

Except in tiny local contexts where obvious.

Functions should generally do one thing.

Keep functions small enough to understand, but do not fragment code into meaningless wrappers.

Prefer early returns to deep nesting:

```js
function getDisplayName(user) {
  if (!user) return 'Guest';
  if (user.displayName) return user.displayName;
  return user.email;
}
```

Avoid hidden side effects.

Separate pure transformations from I/O.

Make invalid states hard to represent.

Avoid boolean parameters that obscure intent:

```js
// Less clear
setModal(true);

// Clearer
openModal();
closeModal();
```

Use guard clauses for invalid input.

Avoid mutation unless ownership is clear.

Avoid premature abstraction.

Abstract after a real pattern appears, not before.

Keep module boundaries meaningful.

Avoid dependency cycles.

Prefer composition over inheritance for app code.

Keep public APIs small.

Use comments to explain why, not what.

Good:

```js
// The API returns local dates without a timezone, so parse as local time.
```

Bad:

```js
// Increment i by one.
```

Delete dead code.

Avoid commented-out code.

Use formatting tools.

Use linting for consistency and bug prevention.

Use tests for behavior, not implementation details.

---

# API Design

Design APIs around use cases, not internal implementation.

Prefer explicit parameter objects when there are several options:

```js
createUser({
  name,
  email,
  role,
});
```

Avoid positional boolean arguments:

```js
// Bad
createUser(name, true, false);
```

Return consistent shapes.

Use errors for exceptional failure and result objects for expected domain outcomes when appropriate.

Example:

```js
return { ok: true, value };
return { ok: false, error };
```

Keep async APIs consistently async.

Avoid functions that sometimes return a promise and sometimes do not.

Document units:

```js
timeoutMs
sizeBytes
```

Be explicit about ownership and mutation:

```js
function sortUsers(users) {
  return [...users].sort(compareUsers);
}
```

Avoid surprising global behavior.

---

# Testing

Use automated tests for important behavior.

Test public behavior, not private implementation.

Use unit tests for pure logic.

Use integration tests for component interactions.

Use end-to-end tests for critical user flows.

Test accessibility basics:

- Keyboard navigation.
- Accessible names.
- Focus management.
- Form labels.
- Error announcements.
- Color contrast where tooling supports it.

Test failure states:

- Network failure.
- Empty data.
- Loading state.
- Permission denied.
- Validation errors.
- Slow responses.
- Partial data.

Use deterministic tests.

Avoid real timers when fake timers are appropriate.

Avoid arbitrary sleeps in tests. Wait for observable conditions.

Mock network boundaries, not internal implementation details, unless there is a strong reason.

---

# Build And Dependency Hygiene

Prefer minimal dependencies.

Before adding a dependency, consider:

- Is there a native API?
- Is the package actively maintained?
- Is the bundle cost justified?
- Does it support ESM/tree-shaking?
- Does it introduce security or supply-chain risk?
- Can the problem be solved with a small local function?

Use lockfiles.

Keep dependencies updated.

Avoid depending on large libraries for tiny utilities.

Prefer modern ESM packages.

Avoid shipping development-only code to production.

Use code splitting thoughtfully.

Use source maps appropriately. Be careful exposing source maps for sensitive code, though frontend code is never truly secret.

Use environment variables only for non-secret frontend configuration. Anything shipped to the browser is public.

---

# Browser Compatibility

Target evergreen browsers unless product requirements say otherwise.

Use feature detection:

```js
if ('ResizeObserver' in window) {
  // ...
}
```

Use `@supports` for CSS.

Use transpilation/polyfills based on actual support targets.

Do not blindly transpile everything to very old JavaScript if the target browsers are modern; it can increase bundle size.

Understand that polyfills cannot fully emulate every platform feature, especially layout, security, permissions, and performance APIs.

Use progressive enhancement for newer features.

---

# Common Modern Features I Would Treat As Standard Or Near-Standard

Broadly standard in modern web work:

- ES modules.
- `async` / `await`.
- `fetch`.
- `Promise`.
- `URL`.
- `URLSearchParams`.
- `AbortController`.
- `CustomEvent`.
- `classList`.
- `dataset`.
- `closest`.
- `matches`.
- `template`.
- Shadow DOM and Custom Elements when needed.
- CSS Grid.
- Flexbox.
- CSS custom properties.
- CSS logical properties.
- `gap`.
- `aspect-ratio`.
- `:focus-visible`.
- `:is()`.
- `:where()`.
- `@supports`.
- `prefers-reduced-motion`.
- `prefers-color-scheme`.
- `Intl`.
- `crypto.randomUUID`.
- `structuredClone`.
- `ResizeObserver`.
- `IntersectionObserver`.
- `MutationObserver`.
- `localStorage`, `sessionStorage`, IndexedDB.
- Service workers where appropriate.
- Web Workers where appropriate.

Modern features I would use with feature detection or fallback depending on project requirements:

- `:has()`.
- Container queries.
- CSS nesting.
- Cascade layers.
- `content-visibility`.
- `text-wrap: balance`.
- Popover API.
- Native `<dialog>`.
- View Transitions API.
- Anchor positioning.
- `inert`.
- Declarative Shadow DOM.
- WebGPU.
- Compression Streams.
- File System Access API.
- Web Share API.
- Async Clipboard API.
- Navigation API.

---

# HTML/CSS/JS Integration

Use classes for styling hooks.

Use `data-*` for behavior hooks when useful.

Avoid binding JavaScript behavior to purely presentational class names if those names are likely to change.

Example:

```html
<button class="button button--danger" data-action="delete">
  Delete
</button>
```

Use attributes for state that CSS and accessibility need:

```html
<button aria-expanded="false" data-menu-button>
  Menu
</button>
```

Keep CSS, behavior, and semantics aligned.

Do not put business logic in HTML attributes.

Avoid inline styles except for dynamic values that are genuinely instance-specific, often via custom properties:

```js
element.style.setProperty('--progress', `${progress}%`);
```

```css
.progress {
  inline-size: var(--progress);
}
```

---

# Accessibility Patterns

## Disclosure

```html
<button aria-expanded="false" aria-controls="panel">
  Details
</button>
<div id="panel" hidden>
  ...
</div>
```

Update both `hidden` and `aria-expanded`.

## Tabs

Use native links if tabs are actually navigation.

For true in-page tabs, implement:

- `role="tablist"`
- `role="tab"`
- `role="tabpanel"`
- Arrow-key navigation
- Selected state
- Focus behavior

Do not build custom tabs unless needed.

## Menu Buttons

Use menu semantics only for application-style command menus.

For site navigation, normal links are usually better.

## Toasts

Use `role="status"` or an aria-live region.

Do not move focus to passive toast messages.

Provide persistent access to important messages.

## Modals

Use native dialog where possible.

Ensure:

- Accessible name.
- Initial focus.
- Escape closes unless destructive flow requires otherwise.
- Return focus.
- Background is inert.
- Scrolling is controlled.

---

# Data Fetching And UI States

Every async UI should consider:

- Idle state.
- Loading state.
- Success state.
- Empty state.
- Error state.
- Retry.
- Cancellation.
- Race conditions.

Avoid stale responses overwriting newer ones.

Example:

```js
let requestId = 0;

async function load(query) {
  const id = ++requestId;

  const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
  const results = await response.json();

  if (id !== requestId) return;

  render(results);
}
```

Use `AbortController` to cancel obsolete requests.

```js
let controller;

async function load(query) {
  controller?.abort();
  controller = new AbortController();

  const response = await fetch(`/search?q=${encodeURIComponent(query)}`, {
    signal: controller.signal,
  });

  render(await response.json());
}
```

---

# Time, Timers, And Scheduling

Use `setTimeout` for delayed work.

Use `setInterval` carefully; clear it when no longer needed.

Prefer recursive `setTimeout` for polling to avoid overlapping calls:

```js
async function poll() {
  await update();
  setTimeout(poll, 5000);
}
```

Use `requestAnimationFrame` for frame-aligned visual updates.

Use `queueMicrotask` for microtask scheduling when needed:

```js
queueMicrotask(() => {
  // runs after current task, before next render opportunity
});
```

Do not use microtasks for heavy work.

Use `scheduler.postTask` only as progressive enhancement where supported.

---

# Observers

Use `IntersectionObserver` for visibility.

Use `ResizeObserver` for element size.

Use `MutationObserver` for DOM mutations.

Disconnect observers when no longer needed:

```js
observer.disconnect();
```

Avoid observing huge subtrees unnecessarily.

Debounce or batch expensive observer callbacks.

---

# Input And Interaction

Use pointer events for unified mouse/touch/pen handling:

```js
element.addEventListener('pointerdown', onPointerDown);
```

Use pointer capture for dragging:

```js
element.setPointerCapture(event.pointerId);
```

Support keyboard equivalents for pointer interactions.

Do not rely on hover for essential actions.

Use `touch-action` for custom gestures:

```css
.slider {
  touch-action: pan-y;
}
```

Prevent default only when necessary.

---

# Clipboard, Share, Permissions

Use permission-gated APIs only after user intent.

Bad:

```js
navigator.geolocation.getCurrentPosition(...); // immediately on load
```

Better:

```js
button.addEventListener('click', requestLocation);
```

Handle denial and unsupported cases.

Use Web Share API progressively:

```js
if (navigator.share) {
  await navigator.share({ title, url });
}
```

Fallback to copying or showing the URL.

---

# Media

Use native media elements:

```html
<video controls playsinline preload="metadata">
  <source src="video.webm" type="video/webm">
  <source src="video.mp4" type="video/mp4">
</video>
```

Use captions:

```html
<track kind="captions" src="captions.vtt" srclang="en" label="English">
```

Avoid autoplay with sound.

Use `playsinline` for mobile video.

Respect reduced motion and data usage where relevant.

---

# SEO And Metadata

Use semantic HTML and meaningful document structure.

Set page titles:

```html
<title>Account settings</title>
```

Use meta description where appropriate:

```html
<meta name="description" content="Manage your account settings.">
```

Use canonical URLs when needed:

```html
<link rel="canonical" href="https://example.com/page">
```

Use structured data only when accurate.

Use server-rendered or statically rendered content for public SEO-critical pages when possible.

Ensure links are crawlable with real `href` values.

Do not rely on click handlers for navigation on public pages.

---

# Privacy

Collect the minimum data needed.

Avoid third-party scripts unless justified.

Disclose tracking and analytics where required.

Respect browser privacy features.

Avoid fingerprinting.

Do not store sensitive personal data unnecessarily.

Give users control over permissions and data where appropriate.

---

# Common Anti-Patterns

Avoid:

```js
document.body.innerHTML = userContent;
```

Avoid:

```html
<div onclick="save()">Save</div>
```

Avoid:

```css
* {
  outline: none;
}
```

Avoid:

```js
JSON.parse(JSON.stringify(complexObject));
```

Avoid:

```js
setTimeout(() => {
  assumeThingIsReady();
}, 1000);
```

Avoid:

```js
if (navigator.userAgent.includes('Chrome')) {
  // ...
}
```

Avoid:

```js
catch (error) {}
```

Avoid shipping large dependencies for trivial utilities.

Avoid using ARIA to fake native controls when native controls work.

Avoid absolute positioning as a primary layout system.

Avoid fixed heights for text containers unless overflow is handled.

Avoid relying on color alone.

Avoid storing JWTs or long-lived secrets in `localStorage`.

Avoid blocking the main thread with large synchronous loops.

Avoid making every component globally stateful.

Avoid abstractions that hide simple platform behavior.

---

# Code Style Defaults

Use consistent formatting.

Prefer single responsibility per file/module.

Sort imports consistently.

Group related code.

Keep public API at the top or clearly exposed.

Avoid large files with unrelated concerns.

Use explicit return values.

Prefer positive conditions:

```js
if (isValid) {
  submit();
}
```

Instead of hard-to-read negated branches.

Use constants for repeated magic values:

```js
const MAX_UPLOAD_BYTES = 10_000_000;
```

Use enums or string unions for known statuses when using TypeScript.

Keep configuration centralized when values are shared.

Avoid mixing units.

Use names that encode units:

```js
delayMs
widthPx
sizeBytes
```

---

# Practical Defaults

For a modern browser-native feature, I would usually default to this checklist:

- Semantic HTML first.
- Native controls first.
- CSS Grid/Flexbox for layout.
- CSS custom properties for reusable values.
- Logical properties for spacing.
- `fetch` with explicit error handling.
- `AbortController` for cancelable async work.
- `URL`/`URLSearchParams` for URL manipulation.
- `Intl` for formatting.
- `textContent` for untrusted text.
- Event delegation for repeated elements.
- `addEventListener` with cleanup.
- `ResizeObserver`/`IntersectionObserver` instead of polling.
- `FormData` and constraint validation for forms.
- `dialog`/popover where appropriate, progressively enhanced.
- Accessibility through native semantics, labels, focus, keyboard support.
- Feature detection for newer APIs.
- Progressive enhancement for cutting-edge APIs.
- Minimal dependencies.
- Small cohesive modules.
- Explicit state and error states.
- Tests around behavior and critical flows.

This is the baseline “common knowledge” I would bring to modern web development before reading any local guide.
