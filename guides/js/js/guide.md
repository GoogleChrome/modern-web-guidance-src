---
name: js
description: Action-oriented guidelines for modern JavaScript and Web APIs, covering immutable data operations, deep cloning, collection grouping, asynchronous coordination, URL query parsing, binary text encoding, and DOM manipulation. Use this guide when authoring or refactoring client- or server-side JavaScript.
web-feature-ids:
  - structured-clone
  - url
  - dom
  - array-group
  - promise-withresolvers
  - events
  - array-by-copy
  - array-findlast
  - abortsignal-timeout
  - abortsignal-any
  - error-cause
  - text-encoding
---

# JavaScript

Modern JavaScript and Web platform runtimes provide built-in primitives for deep cloning, non-mutating collection transforms, asynchronous coordination, query-string parsing, binary text encoding, and DOM mutation. Replacing legacy userland workarounds (`JSON.parse(JSON.stringify(...))`, `[...arr].sort()`, `.reduce()` bucket accumulators, manual `AbortController` timers, and `innerHTML = ''` clearing loops) eliminates subtle data corruption, prototype pollution, call-stack overflows, and unnecessary parser overhead.

## Table of Contents

1. [Use-Case Guide Matrix](#use-case-guide-matrix)
2. [Immutable Data, Deep Cloning, and Grouping](#1-immutable-data-deep-cloning-and-grouping)
   - [Deep Cloning with `structuredClone()`](#deep-cloning-with-structuredclone)
   - [Non-Mutating Array Copies and Reverse Search](#non-mutating-array-copies-and-reverse-search)
   - [Grouping Iterable Collections (`Object.groupBy()` and `Map.groupBy()`)](#grouping-iterable-collections-objectgroupby-and-mapgroupby)
3. [Asynchronous Coordination, Cancellation, and Error Chaining](#2-asynchronous-coordination-cancellation-and-error-chaining)
   - [Externalized Promise Settlement (`Promise.withResolvers()`)](#externalized-promise-settlement-promisewithresolvers)
   - [Declarative Timeout and Composite Cancellation (`AbortSignal.timeout()` and `AbortSignal.any()`)](#declarative-timeout-and-composite-cancellation-abortsignaltimeout-and-abortsignalany)
   - [Chaining Error Causes (`new Error(message, { cause })`)](#chaining-error-causes-new-errormessage-cause)
4. [URL Query Manipulation and Binary Text Encoding](#3-url-query-manipulation-and-binary-text-encoding)
   - [Parsing and Constructing Query Strings (`URLSearchParams`)](#parsing-and-constructing-query-strings-urlsearchparams)
   - [Binary UTF-8 Text Decoding and Encoding (`TextDecoder` and `TextEncoder`)](#binary-utf-8-text-decoding-and-encoding-textdecoder-and-textencoder)
5. [DOM Child Replacement and Custom Events](#4-dom-child-replacement-and-custom-events)
   - [Atomic Child Replacement and Clearing (`Element.prototype.replaceChildren()`)](#atomic-child-replacement-and-clearing-elementprototypereplacechildren)
   - [Constructing Standard and Custom Events (`new Event()` and `new CustomEvent()`)](#constructing-standard-and-custom-events-new-event-and-new-customevent)

## Use-Case Guide Matrix

For specialized temporal, scheduling, and security workflows, consult the dedicated guides below:

| Workflow / Domain | Guide |
| :--- | :--- |
| Calculating exact calendar durations (`years`, `months`, `days`) between dates or events | {{ GUIDE_REF("calculate-event-differentials") }} |
| Representing calendar dates (`PlainDate`), wall-clock times (`PlainTime`), or recurring rules without time-zone shift bugs | {{ GUIDE_REF("capture-location-agnostic-data") }} |
| Converting instants across IANA time zones (`ZonedDateTime`) with DST disambiguation | {{ GUIDE_REF("coordinate-global-events") }} |
| Sorting and comparing nanosecond-precision timestamps (`Temporal.Instant.compare`) | {{ GUIDE_REF("sort-high-precision-timestamps") }} |
| Projecting dates into non-Gregorian calendar systems (`hebrew`, `islamic-civil`, `japanese`, `chinese`) | {{ GUIDE_REF("support-global-calendar-systems") }} |
| Sanitizing untrusted HTML strings before DOM insertion | {{ GUIDE_REF("sanitize-untrusted-html") }} |

---

## 1. Immutable Data, Deep Cloning, and Grouping

### Deep Cloning with `structuredClone()`

Use `structuredClone(value)` to deep-copy nested objects, arrays, and built-in platform types without round-tripping through a JSON string.

#### Guidelines

- **DO** use `structuredClone(value)` instead of `JSON.parse(JSON.stringify(value))` or recursive cloning utilities (`_.cloneDeep`) when copying structured state in memory.
- **DO** rely on `structuredClone()` to preserve cyclic references, shared object references (DAGs), `Date` instances, `RegExp`, `Map`, `Set`, `ArrayBuffer`, `TypedArray`, `DataView`, `BigInt`, `Error` instances, `undefined` property values, `NaN`, `Infinity`, `-0`, and sparse array holes.
- **DO** pass a `{ transfer: [arrayBuffer] }` options object when moving ownership of `ArrayBuffer` or `MessagePort` instances without copying underlying bytes.
- **DO NOT** replace `JSON.parse(JSON.stringify(value))` with `structuredClone(value)` when callers depend on **JSON wire normalization**:
  - Converting `Date` instances to ISO-8601 strings (`Date.prototype.toJSON()`).
  - Invoking custom `.toJSON()` methods on objects (`structuredClone()` ignores inherited or non-enumerable `.toJSON()` methods and throws a `DataCloneError` if an object has an own enumerable function property such as `obj.toJSON = () => ...`).
  - Stripping keys whose values are `undefined`, Functions, or `Symbol`s, or converting `NaN`, `Infinity`, `-Infinity`, and sparse array holes to `null` (and `-0` to `+0`) to match JSON payload schemas.
- **DO NOT** pass non-cloneable values to `structuredClone()`. It throws a `DOMException` (`DataCloneError`) on:
  - Functions (whereas `JSON.stringify` silently omits function properties on objects or turns array elements into `null`).
  - `Symbol` values or `Symbol`-keyed properties (which `JSON.stringify` silently ignores).
  - DOM nodes (`Element`, `Document`, `Node`), live browser platform objects (`window.location`, `localStorage`, `element.dataset` (`DOMStringMap`), `getComputedStyle(el)` (`CSSStyleDeclaration`), DOM `Event` instances), `Promise`, `WeakMap`, `WeakSet`, or reactive `Proxy` state stores (such as Vue `reactive()` or MobX observables).
- **DO NOT** expect `structuredClone()` to preserve custom class prototypes, class methods, non-enumerable properties, property descriptors, or `#private` fields. Like `JSON.parse(JSON.stringify(...))`, `structuredClone()` strips custom prototype chains to `Object.prototype`, drops non-enumerable properties and `#private` fields, and evaluates enumerable getters once into plain data properties.

> [!NOTE]
> `structuredClone` is a host-provided global rather than an intrinsic ECMAScript language global. In isolated Node.js `vm.createContext({})` sandboxes or legacy custom test environments that do not expose host globals on the context object, `structuredClone` may be `undefined` unless explicitly injected into the context.

#### Code Example

```js
const original = {
  id: 'session-42',
  createdAt: new Date('2026-03-15T12:00:00Z'),
  tags: new Set(['admin', 'audit']),
  metrics: new Float64Array([0.98, 0.99]),
  optionalNote: undefined,
};
original.self = original; // Circular reference

const copy = structuredClone(original);

console.assert(copy !== original);
console.assert(copy.createdAt instanceof Date);
console.assert(copy.tags instanceof Set && copy.tags !== original.tags);
console.assert(copy.self === copy);
console.assert('optionalNote' in copy && copy.optionalNote === undefined);
```

---

### Non-Mutating Array Copies and Reverse Search

Use the copying array methods (`.toSorted()`, `.toReversed()`, `.toSpliced()`, `.with()`) and reverse search methods (`.findLast()`, `.findLastIndex()`) to transform or query arrays without mutating the source reference or allocating intermediate shallow clones.

#### Guidelines

- **DO** use `array.toSorted(compareFn)` instead of `[...array].sort(compareFn)`, `array.slice().sort(compareFn)`, or `Array.from(array).sort(compareFn)`.
- **DO** use `array.toReversed()` instead of `[...array].reverse()` or `array.slice().reverse()`.
- **DO** use `array.toSpliced(start, deleteCount, ...items)` for immutable insertions, deletions, and replacements instead of cloning and calling `.splice()`.
- **DO** use `array.with(index, value)` (which supports negative indices) for single-index immutable updates instead of copying and assigning `clone[index] = value`.
- **DO** use `array.findLast(predicate)` and `array.findLastIndex(predicate)` instead of `[...array].reverse().find(predicate)` or reversing indices manually.
- **DO NOT** drop `[...iterable]` spread conversion when the receiver is a non-Array iterable or array-like object (`Set`, `Map.keys()`, `Map.values()`, generator, `NodeList`, `HTMLCollection`, or `arguments`). Calling `.toSorted()` or `.toReversed()` directly on a `Set` or `NodeList` throws a `TypeError`; spread into an array first and chain the mutating method (`[...set].sort(compareFn)` or `[...nodeList].reverse()`) to avoid allocating two arrays.
- **DO NOT** replace `[...typedArray].sort()` with `typedArray.toSorted()` unless numeric ordering and a `TypedArray` return type are intended:
  - `Array.prototype.sort()` / `.toSorted()` converts elements to UTF-16 strings by default (`[10, 2].toSorted()` yields `[10, 2]`), whereas `%TypedArray%.prototype.toSorted()` sorts numerically (`new Uint8Array([10, 2]).toSorted()` yields `Uint8Array [2, 10]`) and returns a `TypedArray` instead of a plain `Array`.
  - `%TypedArray%.prototype` does **not** implement `.toSpliced()` (because TypedArrays have fixed byte lengths).
- **DO NOT** use `.toSorted()` or `.toReversed()` when code intentionally relies on sparse array hole preservation (`!(i in arr)`). The copying array methods always produce dense arrays where sparse holes become `undefined` elements (`0 in [, 1].toReversed()` is `true`), whereas `Array.prototype.slice()`, `.sort()`, and `.reverse()` preserve empty slots.

#### Code Example

```js
const tasks = [
  { id: 1, priority: 2, status: 'done' },
  { id: 2, priority: 5, status: 'open' },
  { id: 3, priority: 1, status: 'done' },
];

// Immutable sort and single-element update without mutating `tasks`
const byPriority = tasks.toSorted((a, b) => b.priority - a.priority);
const reopened = tasks.with(-1, { ...tasks.at(-1), status: 'open' });

// Reverse search without allocating a reversed copy
const lastCompleted = tasks.findLast((task) => task.status === 'done');
const lastCompletedIndex = tasks.findLastIndex((task) => task.status === 'done');
```

---

### Grouping Iterable Collections (`Object.groupBy()` and `Map.groupBy()`)

Use `Object.groupBy(items, callbackFn)` and `Map.groupBy(items, callbackFn)` to partition any iterable into array buckets in a single step.

#### Guidelines

- **DO** use `Object.groupBy(items, (item, index) => key)` instead of `items.reduce((acc, item) => { (acc[key] ??= []).push(item); return acc; }, {})` when grouping into string or symbol property keys and each bucket holds the unmodified original elements.
- **DO** use `Map.groupBy(items, (item, index) => key)` when grouping by object references, class instances, or primitive keys whose non-string types (`number`, `boolean`, `undefined`, `BigInt`) must be preserved without string coercion.
- **DO** use `Object.hasOwn(groups, key)` or optional chaining (`groups[key] ?? []`) when reading buckets from `Object.groupBy()`.
- **DO NOT** call `Object.prototype` methods such as `groups.hasOwnProperty(key)` on the return value of `Object.groupBy()`. `Object.groupBy()` returns a `null`-prototype object (`Object.getPrototypeOf(groups) === null`), so `groups.hasOwnProperty` is `undefined` and calling it throws a `TypeError`.
- **DO NOT** replace `.reduce()` accumulators that simultaneously transform elements (`acc[key].push(item.id)`), compute scalar aggregations (counts, sums, min/max), or pre-seed empty keys that have zero matching items (`Object.groupBy()` only creates keys that appear at least once in `items`).

#### Code Example

```js
const deliveries = [
  { id: 'd1', region: 'eu-west', weightKg: 4.2 },
  { id: 'd2', region: 'us-east', weightKg: 1.1 },
  { id: 'd3', region: 'eu-west', weightKg: 8.5 },
];

// String-keyed null-prototype dictionary of arrays
const byRegion = Object.groupBy(deliveries, (item) => item.region);
const euShipments = byRegion['eu-west'] ?? [];

// Non-string or object keys preserved in a Map
const heavyKey = { tier: 'heavy' };
const standardKey = { tier: 'standard' };
const byTier = Map.groupBy(deliveries, (item) =>
  item.weightKg >= 5 ? heavyKey : standardKey,
);
```

---

## 2. Asynchronous Coordination, Cancellation, and Error Chaining

### Externalized Promise Settlement (`Promise.withResolvers()`)

Use `Promise.withResolvers()` when a promise's `resolve` and `reject` callbacks must be stored or invoked outside the `new Promise` executor scope (such as in event listeners, worker message handlers, stream queues, or cancellation tokens).

#### Guidelines

- **DO** use `const { promise, resolve, reject } = Promise.withResolvers()` instead of declaring mutable outer variables (`let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; });`).
- **DO** keep standard `new Promise((resolve, reject) => { ... })` when the asynchronous operation is self-contained inside the executor callback (where synchronous throws inside the executor automatically reject the promise).

#### Code Example

```js
function createRequestGate() {
  const { promise, resolve, reject } = Promise.withResolvers();
  return {
    waitUntilReady: () => promise,
    open: (config) => resolve(config),
    abort: (reason) => reject(new Error(`Gate aborted: ${reason}`)),
  };
}
```

---

### Declarative Timeout and Composite Cancellation (`AbortSignal.timeout()` and `AbortSignal.any()`)

Use `AbortSignal.timeout(ms)` for time-bounded asynchronous operations and `AbortSignal.any(signals)` to combine multiple cancellation sources without manual timer bookkeeping.

#### Guidelines

- **DO** pass `{ signal: AbortSignal.timeout(ms) }` directly to `fetch()`, `addEventListener()`, streams, or abortable APIs instead of creating a one-off `AbortController` and `setTimeout(() => controller.abort(), ms)`.
- **DO** combine user-initiated cancellation (`AbortController`) with a deadline using `AbortSignal.any([controller.signal, AbortSignal.timeout(ms)])`. The composite signal aborts as soon as the first input signal aborts and propagates that signal's `reason`.
- **DO** check for both `'TimeoutError'` and `'AbortError'` when inspecting `error.name` in `catch` blocks if distinguishing user cancellation from a deadline matters.
- **DO NOT** assume `AbortSignal.timeout(ms)` aborts with `error.name === 'AbortError'`. Whereas `controller.abort()` without arguments sets `signal.reason` to `new DOMException('The operation was aborted.', 'AbortError')`, `AbortSignal.timeout(ms)` sets `signal.reason` to `new DOMException('The operation was aborted due to timeout', 'TimeoutError')` (`error.name === 'TimeoutError'`).
- **DO NOT** replace a manual `AbortController` + `setTimeout` timer when code resets the timer on activity (sliding/idle debounce timeouts) or requires a custom abort reason before the timeout fires, as `AbortSignal.timeout(ms)` starts immediately and cannot be reset or manually cleared.

#### Code Example

```js
async function fetchJsonWithDeadline(url, userSignal, timeoutMs = 5_000) {
  const signal = userSignal
    ? AbortSignal.any([userSignal, AbortSignal.timeout(timeoutMs)])
    : AbortSignal.timeout(timeoutMs);

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return await response.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`, { cause: err });
    }
    throw err;
  }
}
```

---

### Chaining Error Causes (`new Error(message, { cause })`)

Attach the original caught error via the `{ cause }` options parameter whenever wrapping and re-throwing an exception across architectural layers.

#### Guidelines

- **DO** pass `{ cause: err }` as the second argument to `new Error(message, { cause: err })` (or any built-in subclass: `TypeError`, `RangeError`, `SyntaxError`, `URIError`, `EvalError`, `AggregateError`) when catching and re-throwing with domain context.
- **DO** preserve the original error object in `error.cause` rather than concatenating `err.message` into the outer message string (`new Error('Failed: ' + err.message)`) or mutating `wrapper.cause = err` after construction (which sets an enumerable property instead of the non-enumerable specification property).
- **DO NOT** expose raw internal `cause` chains directly to untrusted client responses if the underlying error contains sensitive database queries, file paths, or credentials; log the full `error.cause` chain server-side and sanitize client-facing payloads.

#### Code Example

```js
async function loadUserProfile(userId) {
  try {
    const raw = await readRecordFromStore(`users:${userId}`);
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to load profile for user "${userId}"`, { cause: err });
  }
}
```

---

## 3. URL Query Manipulation and Binary Text Encoding

### Parsing and Constructing Query Strings (`URLSearchParams`)

Use `URLSearchParams` (and `new URL(input, base).searchParams`) to parse, inspect, mutate, and serialize query strings instead of manual `.split('&')` / `.split('=')` loops and `decodeURIComponent`.

#### Guidelines

- **DO** use `new URLSearchParams(search)` to read parameters (`.get(key)`, `.getAll(key)`, `.has(key)`) or convert to a plain key-value dictionary with `Object.fromEntries(new URLSearchParams(search))`.
- **DO** use `new URL(fullUrl, baseOrigin).searchParams` when starting from a full URL string (`https://example.com/path?a=1#section`) rather than passing a full URL directly to `new URLSearchParams(fullUrl)` (which only strips a single leading `?` and treats `https://example.com/path?a` as part of the first key name).
- **DO** rely on `URLSearchParams` to preserve `=` characters inside parameter values (such as Base64 padding `?token=aGVsbG8=`, which `.split('=')[1]` truncates) and to avoid `Object.prototype` pollution when building lookup maps.
- **DO** account for the `application/x-www-form-urlencoded` specification rules enforced by `URLSearchParams`:
  - **Plus (`+`) decoding:** `URLSearchParams` decodes `+` as a space (`' '`), whereas `decodeURIComponent('a+b')` preserves `a+b`. If literal `+` characters in unencoded query values (such as phone numbers or Base64 strings) must remain `+`, encode them as `%2B` at the source or handle them before parsing.
  - **Valueless flags (`?debug` vs `?debug=`):** `URLSearchParams` normalizes both `?debug` and `?debug=` to the empty string `""` (`params.has('debug') === true`, `params.get('debug') === ''`), whereas custom `split('=')` parsers sometimes assign `undefined` or `true` when `=` is absent.
  - **Duplicate keys (`?tag=a&tag=b`):** `params.get('tag')` returns the **first** value (`'a'`), `Object.fromEntries(params)` retains the **last** value (`'b'`), and `params.getAll('tag')` returns all values (`['a', 'b']`).
  - **Invalid percent-encoding (`?bad=%E0%A4%A`):** `URLSearchParams` replaces malformed percent sequences with the Unicode replacement character `\uFFFD` without throwing, whereas `decodeURIComponent` throws a `URIError`.
- **DO NOT** pass `location.hash` directly to `new URLSearchParams(location.hash)`. `URLSearchParams` only strips a single leading `?` (not `#`), so `new URLSearchParams('#tab=2')` parses the key as `'#tab'`. Strip the leading `#` first (`new URLSearchParams(location.hash.slice(1))`).
- **DO NOT** use `URLSearchParams` to parse semicolon-delimited strings (such as `document.cookie` or RFC 6265 `Cookie` headers); `URLSearchParams` splits exclusively on `&`.

#### Code Example

```js
// Parsing a query string into a plain object (last value wins on duplicate keys)
const query = '?filter=active&token=eyJhbGciOiJIUzI1NiJ9==&tag=js&tag=web';
const params = new URLSearchParams(query);

const token = params.get('token'); // 'eyJhbGciOiJIUzI1NiJ9==' (preserves trailing '==')
const allTags = params.getAll('tag'); // ['js', 'web']
const lastWinsDict = Object.fromEntries(params); // { filter: 'active', token: '...', tag: 'web' }

// Mutating query parameters on a full URL safely
const endpoint = new URL('https://api.example.com/v1/items?page=1#results');
endpoint.searchParams.set('page', '2');
endpoint.searchParams.append('limit', '50');
```

---

### Binary UTF-8 Text Decoding and Encoding (`TextDecoder` and `TextEncoder`)

Use `TextDecoder` and `TextEncoder` to convert between `Uint8Array` byte buffers and JavaScript strings.

#### Guidelines

- **DO** use `new TextDecoder().decode(bytes)` instead of `String.fromCharCode.apply(null, bytes)` or `String.fromCharCode(...bytes)` when decoding UTF-8 byte buffers into text. `String.fromCharCode` treats each byte (`0x00`–`0xFF`) as a separate UTF-16 code unit (corrupting multi-byte UTF-8 characters above ASCII `0x7F` into Latin-1 mojibake) and throws `RangeError: Maximum call stack size exceeded` when spreading or applying large buffers (~65 KB+).
- **DO** reuse a single `TextDecoder` instance and pass `{ stream: true }` to `decoder.decode(chunk, { stream: true })` when decoding chunked byte streams (`ReadableStream`, WebSocket frames, or file chunks), followed by a final `decoder.decode()` flush call, so multi-byte UTF-8 code points split across chunk boundaries are reassembled cleanly.
- **DO** pass `{ fatal: true }` (`new TextDecoder('utf-8', { fatal: true })`) when invalid UTF-8 byte sequences must throw a `TypeError` rather than being replaced with `\uFFFD`.
- **DO** use `new TextDecoder('latin1')` (or `'iso-8859-1'`) only when a 1-byte-per-character binary string mapping is needed on large buffers without overflowing the call stack, noting that per the WHATWG Encoding Standard, `'latin1'` and `'iso-8859-1'` map to `windows-1252` (which decodes bytes `0x80`–`0x9F` as printable characters such as `€` (`\u20AC`) rather than raw C1 control code points `\u0080`–`\u009F`).
- **DO NOT** replace `String.fromCharCode` loops with `new TextDecoder('utf-8')` when code intentionally constructs a raw 1-byte-per-code-unit binary string (`0x00`–`0xFF`) to pass to `btoa()` for Base64 encoding of arbitrary binary bytes (`Uint8Array.prototype.toBase64()` or chunked `String.fromCharCode` / Node.js `Buffer.from(bytes).toString('base64')` should be used for binary-to-Base64).

#### Code Example

```js
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

// Encode string to UTF-8 Uint8Array and decode back without stack limits
const bytes = encoder.encode('🚀 Modern Web Platform — 100% UTF-8');
const text = decoder.decode(bytes);

// Streaming decode across arbitrary chunk boundaries
async function readUtf8Stream(readableStream) {
  const streamDecoder = new TextDecoder();
  let output = '';
  for await (const chunk of readableStream) {
    output += streamDecoder.decode(chunk, { stream: true });
  }
  output += streamDecoder.decode(); // Flush any trailing bytes
  return output;
}
```

---

## 4. DOM Child Replacement and Custom Events

### Atomic Child Replacement and Clearing (`Element.prototype.replaceChildren()`)

Use `element.replaceChildren(...nodesOrStrings)` to clear a container or replace all of its existing children in a single operation.

#### Guidelines

- **DO** call `container.replaceChildren()` with no arguments to remove all child nodes instead of `container.innerHTML = ''` (which invokes the HTML fragment parser) or `while (container.firstChild) container.removeChild(container.firstChild)` loops.
- **DO** call `container.replaceChildren(...nodes)` to atomically clear and insert new `Node` instances or `DocumentFragment`s without intermediate empty states.
- **DO** pass plain strings directly to `container.replaceChildren(text)` when inserting literal text—string arguments are automatically converted into safe `Text` nodes without parsing HTML markup.
- **DO** target `templateElement.content.replaceChildren(...)` when clearing or replacing the contents of a `` `<template>` `` element. Calling `templateElement.replaceChildren()` directly mutates the light-DOM children of the `` `<template>` `` host element while leaving its inert `templateElement.content` `DocumentFragment` untouched.
- **DO NOT** pass raw HTML markup strings (`'<li>Item</li>'`) to `replaceChildren()` expecting parsed elements; `replaceChildren('<li>Item</li>')` inserts a literal `Text` node displaying `<li>Item</li>`. For untrusted HTML strings, follow {{ GUIDE_REF("sanitize-untrusted-html") }}.
- **DO NOT** pass a live `HTMLCollection` (`source.children`) or live `NodeList` into `target.replaceChildren(...source.children)` when `source` must retain copies of its children; DOM nodes can only have one parent, so `replaceChildren()` detaches each node from `source` and moves it into `target`. Clone the nodes first if both containers need them.
- **DO NOT** replace `element.innerHTML = ''` on legacy `` `<object>` `` or `` `<embed>` `` plugin containers in test harnesses that specifically assert internal HTML parser steps rather than standard DOM tree clearing.

#### Code Example

```js
function renderNotificationList(listElement, messages) {
  const items = messages.map((msg) => {
    const li = document.createElement('li');
    li.className = 'notification-item';
    li.textContent = msg;
    return li;
  });

  // Atomically replaces all existing <li> children in a single DOM operation
  listElement.replaceChildren(...items);
}

// Clearing a <template> element's inert DocumentFragment
function clearTemplate(templateEl) {
  templateEl.content.replaceChildren();
}
```

---

### Constructing Standard and Custom Events (`new Event()` and `new CustomEvent()`)

Use the `new Event(type, options)` and `new CustomEvent(type, options)` constructors instead of the deprecated `document.createEvent()` and `initEvent()` / `initCustomEvent()` initialization methods.

#### Guidelines

- **DO** use `new Event(type, { bubbles, cancelable, composed })` for standard notifications and `new CustomEvent(type, { detail, bubbles, cancelable, composed })` when attaching structured payload data via `event.detail`.
- **DO** specify `bubbles: true` and `cancelable: true` explicitly in the options object whenever an event is expected to bubble up the DOM tree or support `event.preventDefault()`; both properties default to `false` when omitted.
- **DO** set `composed: true` when dispatching an event from inside a Shadow DOM root that must cross the shadow boundary to reach outer document listeners.
- **DO NOT** use `document.createEvent('Event')`, `document.createEvent('CustomEvent')`, `event.initEvent()`, or `event.initCustomEvent()`.

#### Code Example

```js
// Dispatching a bubbling, shadow-piercing custom event with payload data
const filterChanged = new CustomEvent('filter-change', {
  detail: { category: 'architecture', minScore: 80 },
  bubbles: true,
  cancelable: true,
  composed: true,
});

const wasNotCanceled = filterPanel.dispatchEvent(filterChanged);
```
