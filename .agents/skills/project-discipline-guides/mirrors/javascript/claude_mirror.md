# JavaScript Best Practices, Syntax, and APIs — Common Knowledge Guide

## 1. Variable Declarations

### Use `const` by default, `let` when reassigning, never `var`
```javascript
const MAX_RETRIES = 3;        // Immutable binding
let counter = 0;              // Mutable binding
counter += 1;

// Avoid:
var x = 5;                    // Function-scoped, hoisted, no TDZ
```

- `const` and `let` are block-scoped.
- `const` prevents reassignment, not mutation (`const arr = []; arr.push(1)` is fine).
- `var` should be avoided due to hoisting quirks and function scoping.
- Temporal Dead Zone (TDZ): `let`/`const` cannot be accessed before declaration.

### Naming conventions
- `camelCase` for variables and functions.
- `PascalCase` for classes and constructors.
- `SCREAMING_SNAKE_CASE` for true constants (module-level primitives).
- `_prefix` historically signaled "private"; prefer `#privateField` in classes now.

## 2. Strict Equality and Type Coercion

### Always use `===` and `!==`
```javascript
if (value === null) { ... }
if (count !== 0) { ... }

// Avoid:
if (value == null)            // Loose equality (though == null is one common exception)
```

- `==` performs type coercion with surprising results (`[] == false`, `'' == 0`).
- The single legitimate use of `==` is `value == null` to check both `null` and `undefined`, but `value === null || value === undefined` is clearer.

### `Object.is()` for special cases
```javascript
Object.is(NaN, NaN);     // true (=== returns false)
Object.is(0, -0);        // false (=== returns true)
```

## 3. Nullish Handling

### Nullish coalescing `??`
```javascript
const port = config.port ?? 3000;        // Falls back only on null/undefined
const name = input || 'default';         // Falls back on '', 0, false too
```

### Optional chaining `?.`
```javascript
const city = user?.address?.city;
const result = obj?.method?.();
const item = arr?.[0];
```

### Logical assignment operators
```javascript
a ??= b;    // a = a ?? b
a ||= b;    // a = a || b
a &&= b;    // a = a && b
```

## 4. Functions

### Arrow functions for callbacks and lexical `this`
```javascript
const double = (x) => x * 2;
const add = (a, b) => a + b;
const log = () => console.log('hi');

[1, 2, 3].map((n) => n * 2);
```

- Arrow functions don't have their own `this`, `arguments`, `super`, or `new.target`.
- Cannot be used as constructors.
- Use traditional `function` declarations for methods that need `this`, or for hoisted top-level functions.

### Default parameters
```javascript
function greet(name = 'World', greeting = 'Hello') {
  return `${greeting}, ${name}!`;
}
```

### Rest and spread
```javascript
function sum(...nums) {
  return nums.reduce((a, b) => a + b, 0);
}

const merged = [...arr1, ...arr2];
const cloned = { ...original, override: true };
fn(...args);
```

### Avoid `arguments` object
Use rest parameters `(...args)` instead — they're real arrays.

## 5. Destructuring

```javascript
// Object destructuring
const { name, age, email = 'n/a' } = user;
const { name: userName } = user;          // Rename
const { a, ...rest } = obj;               // Rest

// Array destructuring
const [first, second, ...others] = list;
const [, , third] = list;                 // Skip
[a, b] = [b, a];                          // Swap

// Nested
const { address: { city } } = user;

// In parameters
function render({ title, body, author = 'Anon' }) { ... }
```

## 6. Template Literals

```javascript
const greeting = `Hello, ${name}!`;
const multiline = `
  Line 1
  Line 2
`;

// Tagged templates
const html = tag`<div>${value}</div>`;
```

- Always prefer template literals over string concatenation.

## 7. Objects

### Shorthand syntax
```javascript
const x = 1, y = 2;
const point = { x, y };                   // Property shorthand

const obj = {
  greet() { return 'hi'; },               // Method shorthand
  [`dynamic_${key}`]: value,              // Computed property names
};
```

### Object methods
```javascript
Object.keys(obj);
Object.values(obj);
Object.entries(obj);
Object.fromEntries(entries);
Object.assign(target, ...sources);        // Prefer { ...spread } usually
Object.freeze(obj);                       // Shallow immutability
Object.hasOwn(obj, 'key');                // Modern replacement for hasOwnProperty
```

### Iterate with `Object.entries`
```javascript
for (const [key, value] of Object.entries(obj)) {
  console.log(key, value);
}
```

## 8. Arrays

### Prefer immutable, functional methods
```javascript
arr.map(fn);
arr.filter(fn);
arr.reduce(fn, initial);
arr.find(fn);
arr.findIndex(fn);
arr.findLast(fn);
arr.findLastIndex(fn);
arr.some(fn);
arr.every(fn);
arr.flat(depth);
arr.flatMap(fn);
arr.includes(value);
arr.at(-1);                              // Negative indexing
```

### Immutable counterparts to mutating methods (modern)
```javascript
arr.toSorted();      // Non-mutating sort
arr.toReversed();    // Non-mutating reverse
arr.toSpliced(start, deleteCount, ...items);
arr.with(index, value);  // Replace at index
```

### Array creation
```javascript
Array.from(iterable);
Array.from({ length: 5 }, (_, i) => i);
Array.of(1, 2, 3);
[...iterable];                            // Often the cleanest
```

### Avoid `for...in` for arrays
Use `for...of`, `forEach`, or index loops. `for...in` iterates enumerable properties (including inherited ones).

## 9. Iteration

```javascript
// for...of: values from any iterable
for (const item of iterable) { ... }

// for...in: keys from object (rarely the right choice)
for (const key in obj) {
  if (Object.hasOwn(obj, key)) { ... }
}

// Classic for: when you need index control
for (let i = 0; i < arr.length; i++) { ... }

// Entries for index + value
for (const [i, value] of arr.entries()) { ... }
```

## 10. Maps and Sets

```javascript
const map = new Map();
map.set(key, value);
map.get(key);
map.has(key);
map.delete(key);
map.size;
for (const [k, v] of map) { ... }

const set = new Set([1, 2, 3]);
set.add(4);
set.has(2);
set.delete(1);
[...new Set(arr)];                        // Deduplicate

// WeakMap / WeakSet for keys held weakly (no enumeration, GC-friendly)
const cache = new WeakMap();
```

Use `Map` over plain objects when:
- Keys aren't strings/symbols.
- You need ordered iteration.
- You need frequent add/delete operations.
- You need a known size.

## 11. Async / Await and Promises

### Prefer async/await over `.then()` chains
```javascript
async function loadUser(id) {
  try {
    const res = await fetch(`/users/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to load user', err);
    throw err;
  }
}
```

### Parallel awaits
```javascript
// Sequential (slow)
const a = await fetchA();
const b = await fetchB();

// Parallel (fast)
const [a, b] = await Promise.all([fetchA(), fetchB()]);
```

### Promise combinators
```javascript
Promise.all(promises);            // All succeed or first rejection
Promise.allSettled(promises);     // Wait for all, regardless
Promise.race(promises);           // First to settle
Promise.any(promises);            // First to fulfill
```

### Top-level await
Available in ES modules. No need to wrap in an IIFE.

### Async iteration
```javascript
for await (const chunk of stream) { ... }

async function* generate() {
  yield await fetch(...);
}
```

### Never forget to await
Floating promises swallow errors. Use `void promise` to explicitly ignore, or `await` it.

## 12. Error Handling

### Throw `Error` instances
```javascript
throw new Error('Descriptive message');
throw new TypeError('Expected number');

// Custom errors
class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}
```

### `Error.cause` for chaining
```javascript
try {
  doThing();
} catch (err) {
  throw new Error('Higher-level failure', { cause: err });
}
```

### `try/catch` without binding
```javascript
try { ... } catch { ... }                 // Optional binding
```

### `AggregateError` for multiple errors
Returned by `Promise.any` when all fail.

## 13. Modules (ESM)

```javascript
// Named exports
export function foo() {}
export const BAR = 1;
export { existing as renamed };

// Default export
export default class App {}

// Imports
import App, { foo, BAR as CONST } from './module.js';
import * as utils from './utils.js';

// Dynamic imports (returns a Promise)
const mod = await import('./lazy.js');

// Re-exports
export { foo } from './other.js';
export * from './other.js';
```

- Prefer named exports; they aid refactoring and tree-shaking.
- Use `.js` extensions in import paths for native ESM.
- One responsibility per module.

## 14. Classes

```javascript
class Counter {
  #count = 0;                             // Private field
  static instances = 0;                   // Static field

  constructor(start = 0) {
    this.#count = start;
    Counter.instances++;
  }

  get value() { return this.#count; }     // Getter
  set value(v) { this.#count = v; }       // Setter

  increment() { this.#count++; return this; }

  static create(start) {                  // Static method
    return new Counter(start);
  }

  #privateMethod() { ... }                // Private method
}

class Timer extends Counter {
  constructor() {
    super(0);
  }
}
```

- Use `#field` for true privacy (enforced by the engine).
- Prefer composition over inheritance.
- Don't add methods to prototypes manually — use `class` syntax.

## 15. Symbols and Well-Known Symbols

```javascript
const id = Symbol('id');
obj[id] = 123;

// Well-known symbols enable customization
class Range {
  *[Symbol.iterator]() { yield 1; yield 2; }
}
```

## 16. Generators and Iterators

```javascript
function* range(start, end) {
  for (let i = start; i < end; i++) yield i;
}

for (const n of range(0, 5)) { ... }
[...range(0, 5)];
```

## 17. Numbers, BigInt, Math

```javascript
Number.isInteger(x);
Number.isFinite(x);
Number.isNaN(x);                          // Reliable, unlike global isNaN
Number.parseInt(str, 10);                 // Always pass radix
Number.parseFloat(str);
Number.EPSILON;
Number.MAX_SAFE_INTEGER;

// Numeric separators for readability
const million = 1_000_000;

// BigInt for arbitrary precision integers
const big = 9007199254740993n;
big + 1n;

Math.trunc(x);
Math.sign(x);
Math.hypot(a, b);
Math.clz32(x);
```

### Floating-point comparison
```javascript
Math.abs(a - b) < Number.EPSILON;
```

## 18. Strings

```javascript
str.startsWith(prefix);
str.endsWith(suffix);
str.includes(sub);
str.padStart(targetLength, padChar);
str.padEnd(targetLength, padChar);
str.repeat(n);
str.trim();
str.trimStart();
str.trimEnd();
str.replaceAll(search, replacement);
str.at(-1);
str.normalize('NFC');                     // Unicode normalization
str.matchAll(regex);                      // Returns iterator
```

### String iteration (Unicode-aware)
```javascript
[...'😀'].length;                          // Correctly handles surrogates
for (const char of str) { ... }
```

## 19. Regular Expressions

```javascript
const re = /pattern/giu;                  // u flag for Unicode

// Named capture groups
const { groups: { year, month } } = '2026-05'.match(/(?<year>\d{4})-(?<month>\d{2})/);

// Lookbehind
/(?<=\$)\d+/

// Sticky flag
/foo/y
```

- Use `u` flag for Unicode-correct matching.
- Use `s` flag (dotAll) when `.` should match newlines.
- Prefer `String.matchAll` over `RegExp.exec` loops.

## 20. JSON

```javascript
JSON.stringify(value, null, 2);           // Pretty-print with 2-space indent
JSON.stringify(value, replacer);
JSON.parse(text, reviver);
```

- Wrap `JSON.parse` in try/catch when parsing untrusted input.
- `undefined`, functions, and Symbols are dropped during stringify.

## 21. Dates

```javascript
const now = new Date();
now.toISOString();                        // '2026-05-12T...'
Date.now();                               // Epoch ms
```

- For non-trivial date logic, prefer libraries (date-fns, dayjs, Luxon) or the upcoming `Temporal` API where available.
- `Intl.DateTimeFormat` for locale-aware formatting:
```javascript
new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date);
```

## 22. Internationalization (`Intl`)

```javascript
new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(1234.5);
new Intl.RelativeTimeFormat('en').format(-3, 'day');     // '3 days ago'
new Intl.ListFormat('en').format(['A', 'B', 'C']);       // 'A, B, and C'
new Intl.PluralRules('en').select(2);                    // 'other'
new Intl.Collator('en').compare('a', 'b');
new Intl.Segmenter('en', { granularity: 'word' });
```

## 23. Fetch API

```javascript
const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
  signal: controller.signal,
});

if (!res.ok) throw new Error(`HTTP ${res.status}`);
const data = await res.json();
```

- `fetch` only rejects on network errors — always check `res.ok`.
- Use `AbortController` for cancellation and timeouts:
```javascript
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);
fetch(url, { signal: controller.signal });

// Or built-in:
fetch(url, { signal: AbortSignal.timeout(5000) });
```

## 24. URL and URLSearchParams

```javascript
const url = new URL('/path', 'https://example.com');
url.searchParams.set('q', 'hello');
url.searchParams.append('tag', 'js');
url.toString();

const params = new URLSearchParams(window.location.search);
params.get('id');
```

Don't manually concatenate query strings.

## 25. DOM (Browser)

### Selection
```javascript
document.querySelector('.btn');
document.querySelectorAll('li');
element.closest('.container');
element.matches('.active');
```

### Manipulation
```javascript
element.classList.add('active');
element.classList.toggle('open', isOpen);
element.dataset.userId;                   // Reads data-user-id
element.replaceChildren(...nodes);
element.append(child);                    // Accepts strings & nodes
element.prepend(child);
element.before(node);
element.after(node);
element.remove();
```

### Events
```javascript
element.addEventListener('click', handler, { once: true, passive: true, signal });

// Use AbortController to remove multiple listeners at once
const controller = new AbortController();
el.addEventListener('click', h, { signal: controller.signal });
controller.abort();                       // Removes them all

// Event delegation
container.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  ...
});
```

### Avoid `innerHTML` with untrusted input (XSS risk)
Prefer `textContent`, `append`, or sanitize with a library.

## 26. Web APIs (Common)

```javascript
// Storage
localStorage.setItem('key', JSON.stringify(value));
JSON.parse(localStorage.getItem('key'));
sessionStorage;

// Timers
setTimeout(fn, ms);
setInterval(fn, ms);
queueMicrotask(fn);                       // Microtask queue
requestAnimationFrame(fn);                // Before next paint
requestIdleCallback(fn);                  // When idle

// Crypto
crypto.randomUUID();
crypto.getRandomValues(new Uint8Array(16));
await crypto.subtle.digest('SHA-256', data);

// Observers
new IntersectionObserver(cb).observe(el);
new ResizeObserver(cb).observe(el);
new MutationObserver(cb).observe(el, { childList: true });

// Structured cloning
const clone = structuredClone(obj);       // Deep clone, handles cycles, Maps, etc.
```

## 27. Modern Cloning and Equality

- `structuredClone(value)` for deep clones (no JSON round-trip needed).
- `{ ...obj }` and `[...arr]` for shallow clones.
- Reference equality only — no built-in deep equality.

## 28. Typing and Documentation

### JSDoc for type hints in plain JS
```javascript
/**
 * @param {string} name
 * @param {number} [age]
 * @returns {Promise<User>}
 */
async function findUser(name, age) { ... }
```

- Editors (VS Code) understand JSDoc and provide IntelliSense.
- For larger projects, consider TypeScript.

## 29. Clean Code Principles

### Naming
- Use intention-revealing names: `daysSinceLogin`, not `d`.
- Booleans read as questions: `isReady`, `hasPermission`, `canEdit`.
- Functions are verbs: `getUser`, `renderList`, `parseJSON`.
- Avoid abbreviations; favor clarity over brevity.
- Plural for collections (`users`), singular for items (`user`).

### Functions
- Single Responsibility: one function, one reason to change.
- Keep functions small; extract when they do >1 thing.
- Prefer pure functions: same input → same output, no side effects.
- Limit parameters (≤3); use options objects when more are needed.
- Avoid boolean flag parameters that change behavior — split into two functions.
- Return early; avoid deep nesting.

```javascript
// Guard clauses
function process(user) {
  if (!user) return null;
  if (!user.active) return null;
  ...
}
```

### Avoid magic numbers and strings
```javascript
const MAX_LOGIN_ATTEMPTS = 5;
const STATUS_PENDING = 'pending';
```

### Immutability
- Don't mutate function arguments.
- Prefer non-mutating array methods (`map`, `filter`, `toSorted`).
- Treat data as immutable; return new objects.

### Composition over inheritance
- Small reusable functions composed together generally beat deep class hierarchies.
- Mixins via plain objects/functions when sharing behavior.

### Don't repeat yourself — but don't over-abstract
- Three similar usages is better than a premature abstraction.
- Wait until the right shape is obvious.

### Comments
- Code should be self-documenting.
- Comments explain *why*, not *what*.
- Delete commented-out code — version control remembers.
- Use `// TODO:` and `// FIXME:` sparingly; track in an issue tracker.

### Error handling
- Fail fast at boundaries (validate input, throw early).
- Don't swallow errors; either handle or rethrow.
- Use specific error types so callers can discriminate.
- `try/catch` should wrap the smallest possible block.

### Avoid global state
- Use modules; export only what's needed.
- Side effects belong at edges, not in pure logic.

### Avoid `eval`, `Function` constructor, and `with`
Security hazards and prevent optimization.

## 30. Performance Defaults

- Cache repeated DOM lookups in variables.
- Batch DOM writes (use `DocumentFragment` or `replaceChildren`).
- Debounce/throttle high-frequency events (input, scroll, resize).
- Use `passive: true` on touch/wheel listeners that don't `preventDefault`.
- Lazy-load with dynamic `import()`.
- Use `Map`/`Set` over arrays for membership lookups.
- Memoize pure expensive computations.
- Avoid premature optimization — measure first (`performance.now()`, DevTools).

## 31. Security Defaults

- Never trust user input — validate and sanitize.
- Use parameterized queries; never string-concat SQL.
- Avoid `innerHTML` with untrusted content; prefer `textContent`.
- Use `crypto.randomUUID()` and `crypto.getRandomValues` — never `Math.random` for tokens/IDs requiring uniqueness or unpredictability.
- Set `Content-Security-Policy`, `X-Content-Type-Options`, etc. on the server.
- Use `rel="noopener noreferrer"` on `target="_blank"` links.
- Hash passwords with bcrypt/argon2 server-side; never roll your own crypto.

## 32. Testing Hygiene

- Test behavior, not implementation.
- Arrange / Act / Assert structure.
- One logical assertion per test.
- Descriptive test names: `it('returns null when user is inactive')`.
- Avoid shared mutable state between tests.
- Mock at module boundaries; prefer real objects when possible.

## 33. Tooling Defaults

- Use a formatter (Prettier) — don't bikeshed style.
- Use a linter (ESLint) with sensible defaults.
- Pin dependency versions in `package-lock.json` / `pnpm-lock.yaml`.
- Use `"type": "module"` in `package.json` for native ESM.
- Use `node:` prefix for Node built-ins: `import fs from 'node:fs/promises';`.

## 34. Async Patterns Worth Knowing

### Sequential async with reduce
```javascript
await items.reduce(async (prev, item) => {
  await prev;
  await process(item);
}, Promise.resolve());
```

### Concurrent with limit
Often via libraries (`p-limit`); avoid hand-rolling.

### Avoid `async` in `forEach`
`forEach` ignores returned promises. Use `for...of` + `await`, or `Promise.all(arr.map(async ...))`.

## 35. Common Pitfalls to Avoid

- Mutating a parameter (`function(arr) { arr.push(...) }`).
- Forgetting `await` before an async call.
- Using `==` instead of `===`.
- Using `for...in` on arrays.
- Calling `.length` repeatedly on huge arrays inside loops.
- Confusing `null` and `undefined` (prefer `undefined` for "not set"; reserve `null` for "intentional empty").
- Using `parseInt` without radix.
- Capturing loop variables with `var` in closures (use `let`).
- Returning from inside `forEach` expecting it to break (it doesn't).
- Comparing objects/arrays with `===` (reference equality only).
- Mixing tabs and spaces.
- Leaking secrets into client-side code.

## 36. Modern Syntax Quick Reference

```javascript
// Numeric separators
1_000_000

// Logical assignment
a ??= b; a ||= b; a &&= b;

// Optional chaining
obj?.prop?.method?.()

// Nullish coalescing
value ?? fallback

// Object spread
{ ...a, ...b }

// Top-level await (in modules)
const data = await fetch(url).then(r => r.json());

// Private class fields
class C { #x = 0; }

// Static blocks
class C { static { /* init */ } }

// Error cause
new Error('msg', { cause: err })

// Array.prototype.at
arr.at(-1)

// Object.hasOwn
Object.hasOwn(obj, key)

// String.prototype.replaceAll
str.replaceAll('a', 'b')

// Array immutable methods
arr.toSorted(); arr.toReversed(); arr.with(i, v);

// structuredClone
structuredClone(obj)
```

---

This represents the baseline of "common JavaScript knowledge" I apply by default — modern (ES2020+) features that have shipped across all evergreen browsers, plus standard clean-code conventions widely recognized in the JS ecosystem.
