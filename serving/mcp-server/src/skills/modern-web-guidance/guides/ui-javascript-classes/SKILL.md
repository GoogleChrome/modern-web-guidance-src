---
description: Learn how to define and use JavaScript classes for object-oriented programming.
filename: javascript-classes
category: ui
---

# JavaScript Classes

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes

## Best Practices

JavaScript ES6 classes provide a more accessible syntax for working with prototypes and constructor functions, enabling object-oriented programming patterns.

### Defining Classes

Use the `class` keyword, and follow convention by starting class names with a capital letter.

```javascript
class MyClass {}
```

### Instantiating Classes

Use the `new` operator to create instances of a class.

```javascript
class MyClass {}
const myClassInstance = new MyClass();
```

### Class Methods

Functions defined within a class are exposed as methods on each instance. These methods are part of the instance's prototype.

```javascript
class MyClass {
  classMethod() {
    console.log("My class method.");
  }
}
const myClassInstance = new MyClass();
myClassInstance.classMethod();
// Output: "My class method."
```

### Constructors

The `constructor()` method is a special method for creating and initializing an instance. It runs automatically when an instance is created using `new`. Arguments passed to the class instantiation are available within the `constructor`.

```javascript
class MyClass {
  constructor(myPassedValue) {
    console.log(myPassedValue);
  }
}
const myClassInstance = new MyClass("A string.");
// Output: "A string."
```

Within the `constructor` and other methods, `this` refers to the instance itself. Properties assigned to `this` become instance properties.

```javascript
class MyClass {
  constructor(myPassedValue) {
    this.instanceProperty = myPassedValue;
  }
}
const myClassInstance = new MyClass("A string.");
console.log(myClassInstance.instanceProperty);
// Output: "A string."
```

A class can only have one `constructor()` method. If none is defined, a default empty constructor is assumed.

### Class Declarations vs. Expressions

**Class Declarations:**
- Require a name.
- Cannot be redeclared.
- Follow `let`/`const` hoisting rules (temporal dead zone).

```javascript
class MyClass {
  constructor() {}
}

// Redeclaration causes a SyntaxError:
// class MyClass {}
```

**Class Expressions:**
- Can be named or anonymous.
- Can be reassigned (if declared with `let` or `var`).
- Useful for creating classes dynamically.

```javascript
let ClassExpression = class {
  constructor() {}
};

// Reassignment is allowed:
ClassExpression = class MyOtherClass {
  constructor(myString) {
    this.myProp = myString;
  }
};
const instance = new ClassExpression("String.");
// instance is now an instance of MyOtherClass
```

A named class expression's name is available for debugging but not for direct invocation.

```javascript
let MyVariable = class MyClass {};
// MyClass; // Uncaught ReferenceError: MyClass is not defined
console.log(MyVariable.name); // Output: "MyClass"
```

### Temporal Dead Zone (TDZ)

Class declarations, like `let` and `const`, are subject to the temporal dead zone. You cannot access a class before its declaration.

```javascript
{
  // let myVar = new MyClass(); // Uncaught ReferenceError: Cannot access 'MyClass' before initialization
  class MyClass {}
}
```

## Check your understanding

<div><p>Which of the following correctly defines a class?</p></div>
<div correct><div><code>class MyClass {}</code></div><div></div></div>
<div><div><code>myClass = class {}</code></div><div></div></div>
<div><div><code>new class()</code></div><div></div></div>

<div><p>How many <code>constructor()</code> methods can a class have?</p></div>
<div correct><div>One</div><div></div></div>
<div><div>None</div><div></div></div>
<div><div>Unlimited</div><div></div></div>