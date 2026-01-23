---
description: Learn to update arrays immutably using Array.prototype.with() to avoid unintended side effects and improve code predictability.
filename: immutable-array-updates
category: ui
---

# Immutable Array Updates with `Array.prototype.with()`

Reference docs:
- https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/with

## Best Practices

The `Array.prototype.with(index, value)` method provides a clean and readable way to create a new array with a single element modified, without altering the original array. This is crucial for maintaining immutability, a core principle in many modern JavaScript frameworks like React, Vue, and Angular, which can lead to more predictable state management and improved performance.

### Basic Usage

When you need to change a specific element in an array while ensuring the original remains untouched, `Array.prototype.with()` is the preferred method.

```javascript
const originalArray = [10, 20, 30, 40];
const newArray = originalArray.with(1, 25); // Changes the element at index 1 to 25

console.log(newArray);      // Output: [10, 25, 30, 40]
console.log(originalArray); // Output: [10, 20, 30, 40] (remains unchanged)
```

### Avoiding Mutation with Bracket Notation

Directly assigning a value using bracket notation on a variable that references an array will mutate the original array.

```javascript
const originalArray = [10, 20, 30, 40];
const arrayReference = originalArray; // arrayReference now points to the same array

arrayReference[1] = 25; // This mutates the originalArray

console.log(arrayReference); // Output: [10, 25, 30, 40]
console.log(originalArray);  // Output: [10, 25, 30, 40] (also changed)
```

### Alternatives for Immutability

Before `Array.prototype.with()`, developers often used methods like `map()` to achieve immutable updates, which could sometimes reduce code readability for simple modifications.

```javascript
const originalArray = [10, 20, 30, 40];

const newArray = originalArray.map((element, index) => {
  if (index === 1) {
    return 25; // Return the new value for the element at index 1
  }
  return element; // Return the original element for all other indices
});

console.log(newArray);      // Output: [10, 25, 30, 40]
console.log(originalArray); // Output: [10, 20, 30, 40] (remains unchanged)
```

`Array.prototype.with()` simplifies this common pattern.

### Chaining Immutable Operations

The `Array.prototype.with()` method returns a new array, allowing for chaining multiple immutable updates or other array methods.

```javascript
const originalArray = [10, 20, 30, 40];

const newArray = originalArray
  .with(1, originalArray[1] + 5) // Increment the second element
  .with(2, originalArray[2] * 2); // Double the third element

console.log(newArray);      // Output: [10, 25, 60, 40]
console.log(originalArray); // Output: [10, 20, 30, 40] (unchanged)
```

### Related Immutable Array Methods

In addition to `Array.prototype.with()`, several other new methods offer immutable alternatives to their mutating counterparts:

- [`Array.prototype.toReversed()`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/toReversed): Returns a new array with the elements in reverse order, without modifying the original.
- [`Array.prototype.toSorted()`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted): Returns a new array with the elements sorted, without modifying the original.
- [`Array.prototype.toSpliced()`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/toSpliced): Returns a new array with elements added, removed, or replaced, without modifying the original.

These methods, including `Array.prototype.with()`, make it significantly easier to manage state immutably in JavaScript applications.