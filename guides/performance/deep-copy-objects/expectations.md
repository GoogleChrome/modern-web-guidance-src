## Must pass
- Cloned objects containing `Map`, `Set`, and `Date` instances must be deep copies where the instances are new objects with identical content.
- Objects with circular references must be cloned successfully without throwing errors, maintaining the same circular structure in the copy.
- Mutating a nested property or a value within a `Map`/`Set` in the cloned object must not affect the original object.

## Must fail
- Fails if `JSON.parse(JSON.stringify(obj))` is used, as it cannot handle circular references and incorrectly serializes `Map`, `Set`, and `Date`.
- Fails if a shallow copy (e.g., `Object.assign` or spread syntax) is used, as it maintains references to nested objects and native types.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.