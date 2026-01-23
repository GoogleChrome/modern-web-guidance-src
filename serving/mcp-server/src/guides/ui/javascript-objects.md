---
description: Learn how to create and use JavaScript objects, which are mutable data structures that can hold key-value pairs.
filename: javascript-objects
category: ui
---

# JavaScript Objects

Reference docs:
- [MDN Web Docs - Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)

## Best Practices

JavaScript objects are fundamental to the language, used for everything from simple data storage to complex application logic. Understanding how to create, manipulate, and utilize them effectively is crucial for any JavaScript developer.

### Object Literals

The most common and recommended way to create objects in JavaScript is by using object literal notation. This involves enclosing key-value pairs within curly braces `{}`.

**DO** use object literals for creating objects due to their conciseness and readability.

```javascript
let myObject = {
  propertyName: "some value",
  anotherProperty: 123,
  aMethod: function() {
    console.log("This is a method.");
  }
};
```

### Property Keys

Property keys (or names) can be strings or symbols. When using strings, they should be enclosed in quotes.

**DO** use descriptive and predictable strings for property keys.

```javascript
let carAttributes = {
  "color": "red",
  "make": "Toyota"
};
```

**DO NOT** use template literals for property keys; they will result in a `SyntaxError`.

```javascript
// Incorrect:
let carAttributes = {
  `model` : "Camry"
};
// Uncaught SyntaxError: expected property name, got template literal
```

### Property Values

Property values can be of any JavaScript data type, including other objects, functions (methods), arrays, primitives, etc.

**DO** leverage the ability of objects to contain nested objects and functions to create complex data structures and encapsulate behavior.

```javascript
let userProfile = {
  name: "Jane Doe",
  contact: {
    email: "jane.doe@example.com",
    phone: "123-456-7890"
  },
  greet: function() {
    console.log(`Hello, my name is ${this.name}`);
  }
};
```

### Methods

When the value of a property is a function, it's referred to as a method.

**DO** define methods within object literals to associate behavior with the object's data.

```javascript
const calculator = {
  add: function(a, b) {
    return a + b;
  },
  subtract(a, b) { // Shorthand method syntax
    return a - b;
  }
};

console.log(calculator.add(5, 3)); // Output: 8
console.log(calculator.subtract(10, 4)); // Output: 6
```

### Using `new Object()`

While `new Object()` can be used to create objects, it's generally less preferred than object literals for creating plain objects.

**DO NOT** typically use `new Object()` for creating regular objects; prefer object literals for simplicity.

```javascript
// Less common:
let emptyObject = new Object();
emptyObject.key = "value";

// More common and preferred:
let populatedObject = {
  key: "value"
};
```

`new Object()` can be used to wrap primitive values, creating object wrappers, but this is rarely necessary in modern JavaScript.

```javascript
// Example of wrapping a primitive (rarely needed):
let numberObject = new Object(10);
console.log(numberObject); // Output: Number { 10 }
```

### Parentheses for Object Literals in Certain Contexts

When an object literal is the sole expression in a statement and could be misinterpreted as a block statement (due to sharing curly brace syntax `{}`), it requires surrounding parentheses `()`.

**DO** use parentheses `()` around object literals when they appear as standalone expressions, like immediately after a `return` statement or as arguments to functions, if ambiguity is possible.

```javascript
// Incorrect:
// return { value: 42 };

// Correct:
// return ({ value: 42 });

// No parentheses needed when assigned to a variable:
let myObject = { value: 42 };
```

## Check your understanding {:.hide-from-toc}

<div class="wd-assessment">
  <devsite-multiple-choice>
    <div><p>What is the most common and recommended way to create an object in JavaScript?</p></div>
    <div correct>
      <div>Using object literal notation `{}`</div>
      <div></div>
    </div>
    <div>
      <div>Using the `new Object()` constructor</div>
      <div></div>
    </div>
    <div>
      <div>Using `Object.create()`</div>
      <div></div>
    </div>
    <div>
      <div>Using a class definition</div>
      <div></div>
    </div>
  </devsite-multiple-choice>
	<devsite-multiple-choice>
    <div><p>Which of the following is a valid way to define a method within an object literal?</p></div>
    <div correct>
      <div><code>myMethod() { /* code */ }</code></div>
      <div></div>
    </div>
		<div correct>
      <div><code>myMethod: function() { /* code */ }</code></div>
      <div></div>
    </div>
    <div>
      <div><code>myMethod: () => { /* code */ }</code></div>
      <div></div>
    </div>
		<div>
      <div><code>function myMethod() { /* code */ }</code></div>
      <div></div>
    </div>
  </devsite-multiple-choice>
	<devsite-multiple-choice>
    <div><p>When might you need to use parentheses around an object literal?</p></div>
    <div correct>
      <div>When it's the sole expression in a statement and could be confused with a block statement.</div>
      <div></div>
    </div>
    <div>
      <div>When assigning it to a variable.</div>
      <div></div>
    </div>
    <div>
      <div>When defining a method within another object.</div>
      <div></div>
    </div>
    <div>
      <div>Never; parentheses are not used with object literals.</div>
      <div></div>
    </div>
  </devsite-multiple-choice>
</div>