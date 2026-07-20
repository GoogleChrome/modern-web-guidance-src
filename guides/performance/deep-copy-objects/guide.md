---
name: deep-copy-objects
description: Create an independent deep copy of an object that contains native types like Map, Set, and Date or circular references.
web-feature-ids:
  - structured-clone
sources:
  - https://developer.mozilla.org/docs/Web/API/Window/structuredClone
---

# Deep copy objects with native types and circular references

Creating a deep copy (or deep clone) of a JavaScript object ensures that the new object is entirely independent of the original, with no shared references to nested structures. While developers traditionally used `JSON.parse(JSON.stringify(obj))`, that approach fails for circular references and mangles native types like `Map`, `Set`, and `Date`. The `structuredClone()` API provides a native, robust way to perform deep copies while preserving these types and correctly handling cyclical graphs.

## How to implement

### Create a deep clone of complex data
Use `structuredClone()` to duplicate objects containing native JavaScript types that JSON serialization cannot handle.

```javascript
const original = {
  name: "Deep Copy Example",
  timestamp: new Date(), // JSON would turn this into a string
  data: new Set([1, 2, 3]), // JSON would turn this into an empty object
  mapping: new Map([["key", "value"]]),
  buffer: new Uint8Array([255, 0, 128]).buffer
};

// MANDATORY: Use structuredClone for true deep copies of native types
const clone = structuredClone(original);

// Verify independence
clone.data.add(4);
console.log(original.data.has(4)); // false
console.log(clone.timestamp instanceof Date); // true: type is preserved
```

### Handling circular references
Unlike legacy methods, `structuredClone()` tracks references and can clone objects that point back to themselves without causing a stack overflow.

```javascript
const user = { name: "Alice" };
user.self = user; // Circular reference

// MANDATORY: structuredClone handles cyclical structures automatically
const clonedUser = structuredClone(user);

console.log(clonedUser.self === clonedUser); // true
console.log(clonedUser.self === user); // false: it's a new reference
```

### Dealing with uncloneable types and prototype loss
You must be aware that `structuredClone()` is strictly a data duplicator. It does not clone functions, DOM nodes, or preserve class prototypes.

```javascript
class User {
  constructor(name) { this.name = name; }
  greet() { return `Hi, ${this.name}`; }
}

const instance = new User("Bob");

try {
  const clone = structuredClone({
    instance,
    // MANDATORY: Encountering a function throws a DataCloneError
    callback: () => console.log("Success") 
  });
} catch (err) {
  if (err.name === 'DataCloneError') {
    // Handle or strip uncloneable properties before cloning
  }
}

const simpleClone = structuredClone(instance);
console.log(simpleClone instanceof User); // false: prototype is lost
// simpleClone.greet() would throw: it is now a plain object
```

## Fallback strategies

{{ FEATURE_FALLBACKS("structured-clone") }}

If `structuredClone` is unavailable, you should conditionally load a polyfill or use a mature library like Lodash's `cloneDeep`.

```javascript
// MANDATORY: Feature detect before use
if (typeof structuredClone === 'function') {
  const clone = structuredClone(original);
} else {
  // Fallback for older browsers (e.g., Safari < 15.4, Node < 17)
  // Note: JSON hack will fail if the object has circular references or Maps/Sets
  try {
    const fallbackClone = JSON.parse(JSON.stringify(original));
  } catch (e) {
    // If complex types are present, use a specialized library
    // import cloneDeep from 'lodash/cloneDeep';
    // const fallbackClone = cloneDeep(original);
  }
}
```

For environments where you cannot use a library, you can implement a recursive cloning function, but ensure it handles `Date`, `Map`, `Set`, and uses a `WeakMap` to track circular references to avoid infinite loops.