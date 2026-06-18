Below is a redundancy mirror of JavaScript knowledge I would treat as broadly standard, default, and generally “common knowledge” when writing modern JavaScript.

# JavaScript Redundancy Mirror

## Baseline Assumptions

Modern JavaScript should generally mean:

- ECMAScript modules by default.
- `let` and `const`, not `var`.
- Strict-mode semantics via modules.
- Promises and `async` / `await`.
- Modern collection types: `Map`, `Set`, `WeakMap`, `WeakSet`.
- Modern object and array APIs.
- Browser-native DOM APIs rather than legacy libraries for basic DOM work.
- Feature detection for APIs that may not exist everywhere.
- Progressive enhancement for newer platform features.
- Avoiding transpilation unless project constraints require older browser support.
- Avoiding polyfills unless they are necessary and intentionally scoped.

JavaScript code should be clear, predictable, side-effect-conscious, and written for maintainability rather than cleverness.

## Language Basics

Use `const` by default.

```js
const value = computeValue();
```

Use `let` when reassignment is required.

```js
let count = 0;
count += 1;
```

Avoid `var`.

Use semicolons consistently if the project uses them. If not, understand ASI hazards and avoid ambiguous leading tokens like `(`, `[`, `/`, `+`, and `-` at statement boundaries.

Use strict equality by default.

```js
if (id === selectedId) {}
if (value !== null) {}
```

Avoid `==` and `!=` except for the deliberate `value == null` pattern when checking both `null` and `undefined`.

```js
if (value == null) {
  // null or undefined
}
```

Prefer explicit boolean logic over truthiness when empty string, `0`, or `false` are valid values.

```js
if (name !== "") {}
if (count > 0) {}
if (enabled === true) {}
```

Use template literals for interpolation and multiline strings.

```js
const message = `Hello, ${name}`;
```

Use numeric separators for readability.

```js
const timeout = 10_000;
const maxBytes = 5_242_880;
```

Use `BigInt` only when integer precision beyond `Number.MAX_SAFE_INTEGER` is required.

```js
const id = 9007199254740993n;
```

Do not mix `BigInt` and `Number` without explicit conversion.

## Variables And Scope

Prefer the narrowest possible scope.

```js
if (shouldRun) {
  const result = run();
}
```

Avoid mutable shared state.

Avoid reusing variables for different meanings.

```js
const user = getUser();
const profile = getProfile(user.id);
```

Avoid assigning to undeclared variables.

Avoid global variables. If global state is necessary, isolate it behind a module or explicit API.

Prefer named constants for meaningful magic values.

```js
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 250;
```

## Functions

Prefer small, single-purpose functions.

```js
function formatUserName(user) {
  return `${user.firstName} ${user.lastName}`;
}
```

Use function declarations for top-level named functions when hoisting is useful.

```js
function parseConfig(input) {
  return JSON.parse(input);
}
```

Use arrow functions for callbacks and small expressions.

```js
items.map((item) => item.id);
```

Do not use arrow functions when dynamic `this`, `arguments`, or constructor behavior is needed.

Use default parameters instead of manual fallback logic.

```js
function createUser({ role = "user" } = {}) {}
```

Be careful with default values: they only apply to `undefined`, not `null`.

```js
function greet(name = "Guest") {}
greet(null); // name is null
```

Prefer object parameters for functions with multiple optional values.

```js
function createRequest({ method = "GET", headers = {}, body } = {}) {}
```

Avoid boolean parameter flags when they make call sites unclear.

```js
// Less clear
renderUser(user, true);

// Clearer
renderUser(user, { compact: true });
```

Return early to reduce nesting.

```js
function getLabel(value) {
  if (value == null) return "";
  if (value === "") return "Empty";
  return String(value);
}
```

Prefer pure functions where practical.

Avoid functions that both compute a value and mutate external state unless that is clearly their purpose.

Use rest parameters instead of `arguments`.

```js
function sum(...values) {
  return values.reduce((total, value) => total + value, 0);
}
```

Use spread syntax for argument expansion.

```js
Math.max(...values);
```

## Objects

Use object literals for plain objects.

```js
const user = {
  id,
  name,
  active: true,
};
```

Use property shorthand.

```js
const id = "123";
const name = "Ada";
const user = { id, name };
```

Use method shorthand.

```js
const service = {
  start() {},
  stop() {},
};
```

Use computed property names when needed.

```js
const field = "email";
const data = {
  [field]: value,
};
```

Use destructuring for clear extraction.

```js
const { id, name } = user;
```

Use defaults with destructuring.

```js
const { role = "user" } = user;
```

Use renaming when names conflict.

```js
const { id: userId } = user;
```

Avoid destructuring so deeply that readability suffers.

Prefer optional chaining for safe property access.

```js
const city = user.address?.city;
```

Prefer nullish coalescing for defaults where `0`, `false`, or `""` are valid.

```js
const limit = options.limit ?? 20;
```

Avoid using `||` for defaults unless all falsy values should trigger the fallback.

```js
const label = input || "Untitled";
```

Use object spread for shallow copies and updates.

```js
const nextUser = {
  ...user,
  name: "Grace",
};
```

Remember object spread is shallow.

Avoid mutating input objects unless mutation is explicit and documented.

Use `Object.freeze()` for shallow immutability when appropriate.

Use `Object.assign()` when that is clearer or needed for target mutation.

```js
Object.assign(target, source);
```

Use `Object.keys()`, `Object.values()`, and `Object.entries()` for object iteration.

```js
for (const [key, value] of Object.entries(record)) {}
```

Use `Object.fromEntries()` to build objects from key-value pairs.

```js
const byId = Object.fromEntries(users.map((user) => [user.id, user]));
```

Use `Object.hasOwn()` instead of `obj.hasOwnProperty()`.

```js
if (Object.hasOwn(config, "timeout")) {}
```

Avoid relying on property enumeration order unless the behavior is specifically defined and appropriate.

Use `structuredClone()` for deep cloning supported data types.

```js
const copy = structuredClone(value);
```

Do not use `JSON.parse(JSON.stringify(value))` as a general deep clone because it loses types and fails on unsupported values.

## Arrays

Use array literals.

```js
const items = [];
```

Use `Array.from()` to create arrays from iterables or array-like values.

```js
const nodes = Array.from(document.querySelectorAll(".item"));
```

Use spread for shallow copies.

```js
const copy = [...items];
```

Use `map()` for one-to-one transformations.

```js
const ids = users.map((user) => user.id);
```

Use `filter()` for selection.

```js
const activeUsers = users.filter((user) => user.active);
```

Use `find()` for the first matching item.

```js
const selected = users.find((user) => user.id === id);
```

Use `some()` and `every()` for predicates.

```js
const hasErrors = fields.some((field) => field.error);
const allValid = fields.every((field) => field.valid);
```

Use `reduce()` when it genuinely expresses accumulation, but avoid overly clever reducers.

```js
const total = items.reduce((sum, item) => sum + item.price, 0);
```

Prefer simple loops when they are clearer.

```js
const results = [];

for (const item of items) {
  if (!item.active) continue;
  results.push(transform(item));
}
```

Use `flat()` and `flatMap()` for flattening.

```js
const tags = posts.flatMap((post) => post.tags);
```

Use `includes()` instead of `indexOf(...) !== -1`.

```js
if (allowedRoles.includes(role)) {}
```

Use `at()` for relative indexing.

```js
const last = items.at(-1);
```

Use modern non-mutating array methods where available:

```js
const sorted = items.toSorted((a, b) => a.name.localeCompare(b.name));
const reversed = items.toReversed();
const next = items.with(index, updatedItem);
const trimmed = items.toSpliced(index, 1);
```

Use mutating methods intentionally:

```js
items.push(item);
items.sort(compare);
items.splice(index, 1);
```

Do not mutate arrays passed into functions unless mutation is the explicit contract.

Always provide a comparator for numeric sorting.

```js
numbers.toSorted((a, b) => a - b);
```

Do not rely on default sort for numbers.

```js
[10, 2, 1].sort(); // lexical, not numeric
```

Use stable identifiers as keys when rendering lists in UI frameworks; do not use indexes when order can change.

Use `Array.isArray()` instead of `instanceof Array`.

```js
if (Array.isArray(value)) {}
```

## Strings

Use `trim()`, `trimStart()`, and `trimEnd()` for whitespace cleanup.

```js
const normalized = input.trim();
```

Use `startsWith()`, `endsWith()`, and `includes()`.

```js
if (path.startsWith("/api/")) {}
```

Use `replaceAll()` for simple global replacement.

```js
const slug = title.toLowerCase().replaceAll(" ", "-");
```

Use regular expressions for pattern-based replacement.

```js
const slug = title.toLowerCase().replace(/\s+/g, "-");
```

Use `padStart()` and `padEnd()` for formatting.

```js
const minutes = String(date.getMinutes()).padStart(2, "0");
```

Use `Intl.Collator` or `localeCompare()` for human-facing sorting.

```js
const collator = new Intl.Collator(undefined, { sensitivity: "base" });
names.toSorted((a, b) => collator.compare(a, b));
```

Use Unicode-aware approaches when user-facing text matters. Avoid assuming `.length` equals visual character count.

## Numbers And Math

Use `Number.isNaN()` instead of global `isNaN()`.

```js
if (Number.isNaN(value)) {}
```

Use `Number.isFinite()` instead of global `isFinite()`.

```js
if (Number.isFinite(value)) {}
```

Use `Number.isInteger()` and `Number.isSafeInteger()` when appropriate.

```js
if (!Number.isSafeInteger(id)) {}
```

Use `Number.parseInt()` and `Number.parseFloat()`.

```js
const count = Number.parseInt(input, 10);
```

Always pass radix to `parseInt`.

Use `Math.trunc()`, `Math.round()`, `Math.floor()`, and `Math.ceil()` intentionally.

Use `Math.min()` and `Math.max()` with spread for reasonable array sizes.

```js
const max = Math.max(...values);
```

Avoid floating-point equality for decimal calculations.

```js
Math.abs(a - b) < Number.EPSILON;
```

Do not use JavaScript floating-point arithmetic for exact money math without a deliberate integer, decimal, or library strategy.

## Dates And Time

Use `Date` for basic timestamps and interoperability.

```js
const now = new Date();
```

Use ISO 8601 strings for serialization.

```js
const value = new Date().toISOString();
```

Use epoch milliseconds for simple comparisons.

```js
if (end.getTime() > start.getTime()) {}
```

Avoid parsing ambiguous date strings.

```js
new Date("2026-05-12T12:00:00Z");
```

Prefer explicit time zones for user-facing date/time behavior.

Use `Intl.DateTimeFormat` for localized formatting.

```js
const formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});
```

Be careful with `Date` month indexes: months are zero-based in constructor overloads.

Avoid manual date math where time zones and daylight saving time matter.

Use `Temporal` when available or via polyfill for robust date/time modeling, especially as a progressive enhancement or in environments where it is supported.

## Regular Expressions

Use regex literals for static patterns.

```js
const emailLike = /\S+@\S+\.\S+/;
```

Use `RegExp` constructor for dynamic patterns and escape user input before interpolation.

Use named capture groups for clarity.

```js
const match = input.match(/^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/);
```

Use the `u` flag for Unicode-aware matching when appropriate.

```js
const pattern = /\p{Letter}+/gu;
```

Use `matchAll()` for repeated captures.

```js
for (const match of text.matchAll(/#(\w+)/g)) {}
```

Avoid complex regexes when parsing would be clearer and safer.

## Modules

Use ECMAScript modules.

```js
export function parse() {}
export const VERSION = "1.0.0";
```

```js
import { parse } from "./parse.js";
```

Prefer named exports for most shared utilities.

Use default exports when a module has one primary concept.

Avoid circular dependencies.

Keep module boundaries clear.

Avoid modules with large hidden side effects.

Use dynamic `import()` for lazy loading.

```js
const { renderChart } = await import("./chart.js");
```

Use import assertions/attributes where required by the runtime for JSON or other module types, subject to support.

Use top-level `await` in modules only when it is appropriate and does not unnecessarily block loading.

## Classes And Prototypes

Use classes when modeling stateful entities with behavior.

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

Use private fields for internal state.

```js
class Counter {
  #count = 0;

  increment() {
    this.#count += 1;
  }
}
```

Use static methods for class-level helpers.

```js
class User {
  static fromJSON(value) {
    return new User(value);
  }
}
```

Avoid deep inheritance hierarchies.

Prefer composition over inheritance.

Use `extends` for real subtype relationships.

Avoid modifying built-in prototypes.

Avoid relying on `this` in callbacks unless intentionally bound.

```js
button.addEventListener("click", this.handleClick.bind(this));
```

or:

```js
handleClick = () => {};
```

where class field syntax is supported by the project toolchain/runtime.

## Error Handling

Throw `Error` objects, not strings.

```js
throw new Error("Invalid user ID");
```

Use custom error classes when callers need to distinguish error types.

```js
class ValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}
```

Preserve causes with `cause`.

```js
throw new Error("Failed to load config", { cause: error });
```

Use `try` / `catch` around operations that can fail and that you can meaningfully handle.

```js
try {
  return await loadUser(id);
} catch (error) {
  logger.error(error);
  return null;
}
```

Do not swallow errors silently.

Avoid catching errors only to rethrow them unchanged.

Use `finally` for cleanup.

```js
try {
  await lock.acquire();
} finally {
  lock.release();
}
```

Validate external inputs at boundaries.

Fail early when required invariants are missing.

Make error messages actionable.

Do not expose sensitive details in user-facing errors.

## Promises And Async

Use `async` / `await` for asynchronous control flow.

```js
async function loadData() {
  const response = await fetch("/api/data");
  return response.json();
}
```

Always handle promise rejections.

```js
loadData().catch(reportError);
```

Use `Promise.all()` for independent concurrent work where all must succeed.

```js
const [user, posts] = await Promise.all([
  fetchUser(id),
  fetchPosts(id),
]);
```

Use `Promise.allSettled()` when all outcomes matter.

```js
const results = await Promise.allSettled(tasks);
```

Use `Promise.race()` for first-settled behavior.

Use `Promise.any()` for first-fulfilled behavior.

Avoid `await` in a loop when operations can run concurrently.

```js
const results = await Promise.all(items.map(processItem));
```

Use sequential `await` in loops when order, rate limits, or dependencies matter.

```js
for (const item of items) {
  await processItem(item);
}
```

Do not use `Array.prototype.forEach()` with async callbacks when awaiting completion is needed.

```js
// Avoid
items.forEach(async (item) => {
  await processItem(item);
});
```

Use `for...of` or `Promise.all`.

Use `AbortController` for cancellable async operations.

```js
const controller = new AbortController();

fetch(url, { signal: controller.signal });

controller.abort();
```

Use timeout helpers carefully.

```js
function timeout(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Timed out")), ms);
  });
}
```

Prefer APIs with built-in cancellation where available.

## Iteration And Iterables

Use `for...of` for iterable values.

```js
for (const item of items) {}
```

Use `for...in` only for object property names, and usually prefer `Object.keys()` or `Object.entries()`.

Use generators for lazy sequences.

```js
function* range(start, end) {
  for (let value = start; value < end; value += 1) {
    yield value;
  }
}
```

Use async iterators for streaming async data.

```js
for await (const chunk of stream) {}
```

Understand that arrays, strings, maps, sets, NodeLists in modern browsers, and many platform objects are iterable.

## Maps, Sets, WeakMaps, WeakSets

Use `Map` when keys are not naturally strings or when insertion order and frequent additions/removals matter.

```js
const usersById = new Map();
usersById.set(user.id, user);
```

Use `Set` for uniqueness.

```js
const uniqueIds = new Set(ids);
```

Use `WeakMap` for metadata keyed by objects without preventing garbage collection.

```js
const metadata = new WeakMap();
metadata.set(element, { initialized: true });
```

Use `WeakSet` for object membership tracking without retaining objects.

Prefer `map.has(key)` over checking `map.get(key) !== undefined` when `undefined` can be a stored value.

```js
if (cache.has(key)) {}
```

Convert maps and sets when needed.

```js
const entries = [...map.entries()];
const values = [...set];
```

## JSON And Structured Data

Use `JSON.stringify()` and `JSON.parse()` for JSON.

```js
const json = JSON.stringify(data);
const data = JSON.parse(json);
```

Wrap `JSON.parse()` for untrusted input.

```js
function parseJSON(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
```

Use replacer and reviver when needed.

```js
JSON.stringify(value, null, 2);
```

Remember JSON does not support `undefined`, functions, symbols, `BigInt`, cyclic references, `Map`, `Set`, or rich object prototypes.

Use `structuredClone()` for platform-supported structured cloning.

Use `FormData`, `URLSearchParams`, `Blob`, `File`, `ArrayBuffer`, and typed arrays for browser-native data handling where appropriate.

## DOM Selection And Manipulation

Use `querySelector()` and `querySelectorAll()` for CSS selector-based queries.

```js
const button = document.querySelector("[data-submit]");
const items = document.querySelectorAll(".item");
```

Check for `null` when an element may not exist.

```js
const button = document.querySelector("button");

if (button) {
  button.disabled = true;
}
```

Prefer `textContent` for text.

```js
element.textContent = label;
```

Use `innerHTML` only with trusted or sanitized content.

Avoid injecting unsanitized user content into HTML.

Use `classList` for classes.

```js
element.classList.add("active");
element.classList.toggle("hidden", isHidden);
```

Use `dataset` for `data-*` attributes.

```js
const id = element.dataset.id;
```

Use `setAttribute()` and `removeAttribute()` for attributes where properties are not appropriate.

Use DOM properties for common reflected properties.

```js
input.value = "";
button.disabled = true;
```

Use `createElement()` for creating elements.

```js
const item = document.createElement("li");
item.textContent = name;
```

Use `DocumentFragment` or batch DOM updates for large insertions.

```js
const fragment = document.createDocumentFragment();
```

Use `replaceChildren()` to replace content.

```js
list.replaceChildren(...items);
```

Use `closest()` for ancestor lookup.

```js
const row = event.target.closest("[data-row]");
```

Use `matches()` for selector checks.

```js
if (element.matches(".active")) {}
```

Avoid layout thrashing by batching reads and writes.

```js
const width = element.offsetWidth;
element.style.width = `${width + 10}px`;
```

Use `requestAnimationFrame()` for visual updates.

```js
requestAnimationFrame(() => {
  element.style.transform = "translateX(10px)";
});
```

Use `MutationObserver`, `ResizeObserver`, and `IntersectionObserver` instead of polling when appropriate.

## Events

Use `addEventListener()`.

```js
button.addEventListener("click", handleClick);
```

Remove listeners when no longer needed.

```js
button.removeEventListener("click", handleClick);
```

Use event delegation for many similar child elements.

```js
list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
});
```

Use options such as `once`, `passive`, and `signal`.

```js
element.addEventListener("click", handler, { once: true });

const controller = new AbortController();
element.addEventListener("click", handler, { signal: controller.signal });
controller.abort();
```

Use passive listeners for scroll/touch events when `preventDefault()` is not needed.

```js
window.addEventListener("scroll", onScroll, { passive: true });
```

Understand event bubbling and capturing.

Use `event.currentTarget` when referring to the element the listener is attached to.

Use `event.target` when referring to the originating element.

Avoid inline HTML event handlers.

## Fetch And Networking

Use `fetch()` for HTTP requests.

```js
const response = await fetch("/api/users");
```

Check `response.ok`; `fetch` does not reject for HTTP error status codes.

```js
if (!response.ok) {
  throw new Error(`Request failed: ${response.status}`);
}
```

Parse based on content type or expected response format.

```js
const data = await response.json();
```

Send JSON with explicit headers.

```js
await fetch("/api/users", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(user),
});
```

Use `URL` and `URLSearchParams` for URLs.

```js
const url = new URL("/api/search", location.origin);
url.searchParams.set("q", query);
```

Use `AbortController` to cancel requests.

```js
const controller = new AbortController();

const response = await fetch(url, {
  signal: controller.signal,
});
```

Be careful with credentials.

```js
fetch(url, { credentials: "include" });
```

Understand CORS behavior rather than trying to bypass it client-side.

Avoid putting secrets in browser JavaScript.

Use exponential backoff or controlled retry logic for transient failures.

Avoid retrying non-idempotent requests unless designed for it.

## Browser Storage

Use `localStorage` for small, non-sensitive persistent string data.

```js
localStorage.setItem("theme", "dark");
const theme = localStorage.getItem("theme");
```

Use `sessionStorage` for tab/session-lifetime string data.

Do not store sensitive tokens or secrets in localStorage if avoidable.

Wrap storage access because it can throw in privacy modes or quota situations.

```js
try {
  localStorage.setItem("key", value);
} catch {}
```

Use IndexedDB for larger structured client-side data.

Use Cache Storage for request/response caching, typically with service workers.

Use cookies only when their HTTP behavior is needed.

Set cookie security attributes server-side where possible: `HttpOnly`, `Secure`, `SameSite`.

## Web Components

Use custom elements when native component encapsulation and framework independence are useful.

```js
class UserCard extends HTMLElement {
  connectedCallback() {
    this.textContent = "User";
  }
}

customElements.define("user-card", UserCard);
```

Use shadow DOM for style and DOM encapsulation.

```js
const root = this.attachShadow({ mode: "open" });
```

Use templates for reusable markup.

Use attributes for string-based configuration and properties for rich values.

Clean up side effects in `disconnectedCallback`.

Avoid web components when a project’s framework component model is clearly the better local fit.

## Forms

Use semantic form elements.

Use `FormData` to read form values.

```js
const formData = new FormData(form);
const email = formData.get("email");
```

Use built-in constraint validation where appropriate.

```js
if (!form.checkValidity()) {
  form.reportValidity();
}
```

Use proper `name` attributes.

Use button `type` explicitly.

```html
<button type="submit">Save</button>
<button type="button">Cancel</button>
```

Prevent default form submission only when handling submission in JavaScript.

```js
form.addEventListener("submit", async (event) => {
  event.preventDefault();
});
```

Do not rely only on client-side validation. Validate on the server too.

## Accessibility Defaults

Use semantic HTML first.

Use buttons for actions and links for navigation.

Do not replace native controls with custom ones unless necessary.

Preserve keyboard access.

Manage focus intentionally for dialogs, menus, and route changes.

Use ARIA only when native HTML cannot express the behavior.

Do not use ARIA to change semantics incorrectly.

Keep accessible names clear.

Use `aria-live` for dynamic status updates when needed.

Respect reduced motion preferences.

```js
const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
```

Ensure JavaScript-enhanced experiences still fail gracefully where possible.

## Internationalization

Use `Intl.NumberFormat` for numbers, currency, and percentages.

```js
const formatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
});
```

Use `Intl.DateTimeFormat` for dates.

Use `Intl.RelativeTimeFormat` for relative time.

```js
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
```

Use `Intl.PluralRules` for pluralization logic.

Do not concatenate translated strings from fragments when grammar may vary.

Avoid assuming English word order, decimal separators, currency position, or plural rules.

## Performance

Prefer clarity first, then optimize measured bottlenecks.

Avoid unnecessary work in hot paths.

Debounce frequent user input.

```js
function debounce(fn, delay) {
  let timeoutId;

  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
```

Throttle high-frequency events when appropriate.

Use `requestAnimationFrame()` for animation work.

Use `requestIdleCallback()` as progressive enhancement for non-urgent background work.

Use `IntersectionObserver` for lazy visibility work.

Use `ResizeObserver` for size changes.

Avoid repeated DOM queries in tight loops when references can be reused.

Avoid forced synchronous layout by interleaving DOM reads and writes.

Use event delegation for many repeated elements.

Use lazy loading and dynamic imports for large optional code.

Use web workers for CPU-heavy work that would block the main thread.

Use transferables for large binary data where appropriate.

Prefer built-in browser APIs over large dependencies for simple tasks.

Measure with browser performance tools before complex optimization.

## Security

Never trust client input.

Escape or sanitize untrusted HTML.

Prefer `textContent` over `innerHTML`.

Avoid `eval()`, `new Function()`, and string-based timers.

```js
setTimeout(callback, 100);
```

not:

```js
setTimeout("callback()", 100);
```

Avoid inline scripts where Content Security Policy matters.

Do not expose secrets in frontend code.

Validate URLs before navigating or fetching if they come from untrusted input.

Be careful with open redirects.

Use `rel="noopener noreferrer"` for untrusted new-window links.

Understand XSS, CSRF, CORS, clickjacking, and supply-chain risks.

Use Subresource Integrity for third-party scripts where applicable.

Keep dependencies updated.

Minimize dependency surface.

## Clean Code Principles

Write code for readers.

Use names that describe intent.

```js
const activeSubscriptionCount = subscriptions.filter((s) => s.active).length;
```

Avoid vague names like `data`, `obj`, `tmp`, and `val` unless the scope is tiny and obvious.

Keep functions focused.

Avoid deeply nested control flow.

Prefer explicit data flow over hidden mutation.

Prefer simple conditionals over clever expressions.

Do not over-abstract early.

Remove dead code.

Avoid comments that restate the code.

Use comments to explain why, constraints, non-obvious tradeoffs, or external quirks.

Keep related code close together.

Separate pure computation from side effects.

Make invalid states hard to represent where possible.

Normalize data at boundaries.

Avoid boolean traps.

Prefer clear configuration objects.

Handle edge cases deliberately.

Fail loudly in developer-facing code when invariants are violated.

Use consistent formatting.

Let automated formatters handle style.

## Type Awareness Without TypeScript

Even in plain JavaScript:

- Keep value shapes consistent.
- Avoid functions that return many unrelated types.
- Document complex object shapes with JSDoc if TypeScript is not used.
- Validate unknown inputs.
- Avoid excessive dynamic property access.
- Prefer predictable APIs.

Example JSDoc:

```js
/**
 * @param {{ id: string, name: string }} user
 * @returns {string}
 */
function getDisplayName(user) {
  return user.name;
}
```

Use TypeScript for larger codebases when static checking would reduce risk.

## API Design

Design functions around clear contracts.

Keep public APIs small.

Prefer predictable return values.

Avoid returning `null`, `undefined`, `false`, and throwing for similar failure modes in the same API.

Use options objects for extensibility.

```js
function search(query, { limit = 20, signal } = {}) {}
```

Use stable naming conventions.

Use async APIs consistently when operations may become asynchronous.

Avoid exposing internal mutable data.

```js
getItems() {
  return [...this.#items];
}
```

Version APIs when consumers depend on them.

## Data Validation

Validate at trust boundaries:

- User input.
- Network responses.
- Local storage.
- URL parameters.
- Messages from workers, frames, or extensions.
- Third-party library output.

Use schema validation for complex external data.

For simple validation, use clear checks.

```js
function isUser(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    typeof value.name === "string"
  );
}
```

Avoid assuming JSON responses match expected shape.

## URL And Navigation APIs

Use `URL` for parsing and composing URLs.

```js
const url = new URL(location.href);
const page = url.searchParams.get("page");
```

Use `URLSearchParams`.

```js
const params = new URLSearchParams({ q: query, page: "1" });
```

Use History API for client-side navigation.

```js
history.pushState({ page: "settings" }, "", "/settings");
```

Listen for `popstate`.

```js
window.addEventListener("popstate", handlePopState);
```

Use `location.assign()` for navigation when appropriate.

Use `location.replace()` when the current page should not remain in history.

## Timers And Scheduling

Use `setTimeout()` for delayed work.

Use `setInterval()` carefully and clear it when done.

```js
const intervalId = setInterval(tick, 1000);
clearInterval(intervalId);
```

Prefer recursive `setTimeout()` when work duration matters.

```js
async function poll() {
  await refresh();
  setTimeout(poll, 5000);
}
```

Use `queueMicrotask()` for microtask scheduling.

```js
queueMicrotask(() => {
  notifyObservers();
});
```

Understand that promises schedule microtasks and timers schedule macrotasks.

## Workers And Messaging

Use web workers for CPU-heavy tasks.

```js
const worker = new Worker(new URL("./worker.js", import.meta.url), {
  type: "module",
});
```

Use `postMessage()` for communication.

Use structured clone-compatible data.

Use transferables for large buffers.

```js
worker.postMessage(buffer, [buffer]);
```

Terminate workers when no longer needed.

```js
worker.terminate();
```

Validate messages received from workers or other contexts.

## Clipboard, Files, And Binary Data

Use Async Clipboard API where available and permission-appropriate.

```js
await navigator.clipboard.writeText(text);
```

Use `File`, `Blob`, and `FileReader` or modern blob methods.

```js
const text = await file.text();
const buffer = await file.arrayBuffer();
```

Use object URLs for local previews and revoke them.

```js
const url = URL.createObjectURL(file);
URL.revokeObjectURL(url);
```

Use streams for large data where appropriate.

## Streams

Use Web Streams for incremental data processing when useful.

```js
const reader = response.body.getReader();
```

Prefer higher-level APIs unless streaming is needed.

Use `TextEncoder` and `TextDecoder`.

```js
const decoder = new TextDecoder();
const text = decoder.decode(buffer);
```

Use `ReadableStream`, `WritableStream`, and `TransformStream` for advanced streaming workflows.

## Canvas, Media, And Graphics

Use `<canvas>` for immediate-mode 2D drawing.

Use `requestAnimationFrame()` for animation loops.

```js
function frame() {
  draw();
  requestAnimationFrame(frame);
}
```

Use `OffscreenCanvas` as progressive enhancement where supported.

Use WebGL or WebGPU for advanced graphics when appropriate.

Use media APIs such as `HTMLMediaElement`, `MediaStream`, and `MediaRecorder` with permission and compatibility handling.

Always handle permissions and user gestures for media features.

## Progressive Enhancement

Feature-detect APIs before use.

```js
if ("clipboard" in navigator) {}
if ("IntersectionObserver" in window) {}
```

Use fallback behavior.

```js
if ("showOpenFilePicker" in window) {
  // enhanced file picker
} else {
  // input[type=file]
}
```

Avoid browser sniffing unless absolutely necessary.

Load polyfills conditionally when practical.

Enhance from semantic HTML and functional basics.

Use CSS feature queries and JS feature checks for newer features.

## Modern Cutting-Edge APIs Worth Considering With Fallbacks

These can be recommended when they improve UX and have fallback paths:

- `Temporal` for robust date/time when available or via polyfill.
- View Transitions API for progressive route/page transitions.
- File System Access API with file input fallback.
- Web Share API with clipboard or manual fallback.
- Async Clipboard API with selection/manual fallback.
- Compression Streams for browser-native compression where available.
- WebGPU for advanced graphics with WebGL/canvas fallback.
- OffscreenCanvas for worker-based rendering fallbacking to main-thread canvas.
- Navigation API for advanced client-side routing where supported.
- `scheduler.postTask()` for prioritized task scheduling where available.
- Popover API for native popovers with custom fallback.
- Declarative Shadow DOM when server-rendering web components.
- Import maps where supported or build-tool fallback.
- Speculation Rules API for progressive prerender/prefetch.
- Sanitizer API where available, with established sanitizer library fallback.
- Shared Storage, FedCM, and privacy-related APIs only for suitable use cases and with careful support checks.

## Testing

Write tests for behavior, not implementation details.

Use unit tests for pure logic.

Use integration tests for module interactions.

Use end-to-end tests for critical user flows.

Test edge cases and failure paths.

Test async behavior deterministically.

Avoid brittle tests based on timing where possible.

Use fake timers when appropriate.

Mock network boundaries deliberately.

Do not over-mock the code under test.

Use representative fixtures.

Keep tests readable and maintainable.

## Debugging

Use browser DevTools.

Use breakpoints instead of excessive logging for complex issues.

Use `console.log`, `console.warn`, `console.error`, `console.table`, and `console.time` intentionally.

Remove noisy debug logging before production.

Preserve useful operational logging where appropriate.

Use source maps in development and production error reporting where safe.

Inspect network requests, performance profiles, layout shifts, memory, and event listeners.

## Tooling Defaults

Use a formatter such as Prettier for style consistency.

Use a linter such as ESLint for bug-prone patterns.

Use TypeScript or JSDoc checking for larger projects.

Use modern bundlers only when needed for dependencies, transforms, optimization, or developer experience.

Prefer native ESM where practical.

Use package lockfiles.

Use npm scripts or equivalent task runners for common commands.

Keep dependencies minimal and justified.

Audit dependency health before adding packages.

## Dependency Use

Prefer platform APIs for standard capabilities.

Add dependencies when they provide meaningful value:

- Complex date/time manipulation.
- Schema validation.
- Internationalization frameworks.
- Rich UI components.
- State management at scale.
- Parsing.
- Cryptography wrappers around native primitives.
- Specialized algorithms.

Avoid dependencies for trivial utilities.

Check bundle size, maintenance, security, license, and API stability.

Prefer tree-shakeable packages.

Avoid importing entire libraries for one small function.

## Browser Compatibility

Use broadly shipped features by default when targeting modern browsers.

Use transpilation/polyfills only according to project browser support policy.

Understand the difference between syntax transforms and runtime polyfills.

Feature-detect runtime APIs.

Avoid assuming all embedded browsers are current.

Check compatibility for APIs that are newer, mobile-specific, permission-gated, or behind secure-context requirements.

Remember many modern APIs require HTTPS.

## Node-Compatible JavaScript

When writing JavaScript that may run in Node too:

- Use ESM or CommonJS consistently.
- Prefer standard Web APIs available in modern Node where appropriate.
- Use `node:` specifiers for built-in modules.

```js
import fs from "node:fs/promises";
```

- Avoid browser globals unless guarded.
- Avoid Node globals in browser-targeted code.
- Keep environment-specific code isolated.
- Use `process.env` only in server/build contexts.
- Do not leak server secrets into browser bundles.

## Common Pitfalls

Avoid accidental assignment in conditionals.

```js
if (value === expected) {}
```

Avoid comparing objects by value with `===`.

```js
{} === {}; // false
```

Avoid mutating state in place when consumers expect immutability.

Avoid stale closures in async callbacks and UI code.

Avoid unhandled promise rejections.

Avoid forgetting `return` in block-bodied arrow functions.

```js
items.map((item) => {
  return item.id;
});
```

Avoid using `forEach` when you need `break`, `continue`, or `await`.

Avoid relying on object key order for core logic.

Avoid using array indexes as persistent IDs.

Avoid parsing numbers without validating the result.

Avoid using `Date` parsing for non-ISO strings.

Avoid assuming `fetch` rejects on 404 or 500.

Avoid using `innerHTML` with untrusted data.

Avoid memory leaks from lingering timers, observers, subscriptions, workers, or event listeners.

Avoid excessive abstraction.

Avoid clever one-liners that hide control flow or error handling.

## Default Style Preferences

Use clear, boring code.

Prefer this:

```js
function getActiveUserNames(users) {
  return users
    .filter((user) => user.active)
    .map((user) => user.name);
}
```

Over this:

```js
const getActiveUserNames = (u) => u.filter((x) => x.active).map((x) => x.name);
```

Prefer guard clauses.

Prefer named intermediate values when they clarify intent.

```js
const hasValidEmail = email.includes("@") && email.includes(".");
if (!hasValidEmail) return;
```

Avoid compressing too much logic into a single expression.

Use descriptive errors.

Keep side effects visible.

Prefer explicit imports.

Prefer stable APIs over experimental APIs unless progressive enhancement is clear.

## Summary Of Common-Knowledge Defaults

I would generally consider the following redundant in a project-specific JavaScript guide unless the project needs stricter local policy:

- Use `const` / `let` instead of `var`.
- Use modules.
- Use strict equality.
- Use template literals.
- Use destructuring, spread, optional chaining, and nullish coalescing.
- Use promises and `async` / `await`.
- Use `fetch` with `response.ok` checks.
- Use `Map` / `Set` when appropriate.
- Use modern array methods.
- Avoid mutation unless intentional.
- Prefer semantic DOM APIs.
- Use `textContent` for untrusted text.
- Avoid `eval`.
- Validate external input.
- Prefer small functions and clear names.
- Avoid premature abstraction.
- Use feature detection for newer browser APIs.
- Use `Intl` for user-facing formatting.
- Use `AbortController` for cancellable async work.
- Use observers instead of polling.
- Use standard browser APIs before dependencies.
- Keep code readable, explicit, and maintainable.
