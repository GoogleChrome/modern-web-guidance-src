---
name: web-components
description: Action-oriented guidelines for authoring and using Web Components (Custom Elements, Shadow DOM, and HTML Templates). Use this skill when creating reusable UI components, implementing design systems, or managing component lifecycle and styling isolation.
---

# Web Components

Web Components are a collection of different specifications, allowing the creation of reusable custom elements with their functionality and styling encapsulated away from the rest of the document. These assets can be published and used in any web application, regardless of the framework or library used. These technologies are leveraged in the modern web development landscape to create reusable UI components, design systems, and manage component lifecycle and styling isolation.

## Table of Contents

1. [Glossary](#1-glossary)
2. [Decision Matrix: Choosing Web Component Features](#2-decision-matrix-choosing-web-component-features)
3. [Custom Elements](#3-custom-elements)
    3.1 [Lifecycle Management](#31-lifecycle-management)
    3.2 [Implementation Guidelines](#32-implementation-guidelines)
4. [Shadow DOM & Encapsulation](#4-shadow-dom--encapsulation)
    4.1 [Encapsulation Strategies](#41-encapsulation-strategies)
    4.2 [Styling & Theming](#42-styling--theming)
5. [Styling Web Components](#5-styling-web-components)
    5.1 [The :host Pseudo-class](#51-the-host-pseudo-class)
    5.2 [Slots and ::slotted Content](#52-slots-and-slotted-content)
    5.3 [Style Inheritance and CSS Custom Properties](#53-style-inheritance-and-css-custom-properties)
    5.4 [Methods for Loading Stylesheets](#54-methods-for-loading-stylesheets)
    5.5 [The ::part() Pseudo-element](#55-the-part-pseudo-element)
6. [Semantics, Accessibility, and Forms](#6-semantics-accessibility-and-forms)
    6.1 [Shadow DOM and ARIA](#61-shadow-dom-and-aria)
    6.2 [Form-Associated Custom Elements (FACE)](#62-form-associated-custom-elements-face)
7. [HTML Templates and Slots](#7-html-templates-and-slots)
8. [Performance](#8-performance)
    8.1 [Performance Bottlenecks](#81-performance-bottlenecks)
    8.2 [Optimization Strategies](#82-optimization-strategies)
    8.3 [Measuring Component Performance](#83-measuring-component-performance)

## 1. Glossary

| Term | Definition |
| :--- | :--- |
| **Custom Element** | A user-defined HTML tag that extends the standard set of HTML elements via the `customElements.define()` API. |
| **Shadow DOM** | A "lite" version of the DOM that is attached to an element but separated from the main document DOM, providing style and markup encapsulation. |
| **Shadow Root** | The root node of a Shadow DOM subtree. It is attached to a "shadow host." |
| **Shadow Host** | The regular DOM node that the Shadow DOM is attached to. |
| **Light DOM** | The regular DOM inside an element that is *not* part of its Shadow DOM. This is where slotted content lives. |
| **Autonomous Custom Element** | A custom element that extends the base `HTMLElement` class (e.g., `<my-card>`). |
| **Customized Built-in Element** | A custom element that extends a specific native element (e.g., `<button is="my-button">`). *Note: These are not recommended for production due to a permanent lack of cross-browser support (specifically Safari).* |
| **Slot** | A placeholder inside a component's Shadow DOM that "projects" content from the Light DOM into the component. |
| **HTML Template** | The `<template>` element, used to hold HTML markup that is not rendered on page load but can be cloned and reused later. |
| **Observed Attributes** | A static list of attribute names that, when changed, trigger the `attributeChangedCallback`. |
| **Lifecycle Callbacks** | Special methods (`connectedCallback`, `disconnectedCallback`, etc.) that run automatically at specific points in an element's life. |

## 2. Decision Matrix: Choosing Features

Use the following heuristics to determine which parts of the Web Components suite to leverage:

| If you need to... | Use... | Reasoning |
| :--- | :--- | :--- |
| Create a new semantic tag (e.g., `<user-profile>`) | **Custom Elements** | Defines the behavior and lifecycle of the element. |
| Scope styles to the component (avoid CSS leakage) | **Shadow DOM** | Provides strict style and DOM isolation. |
| Inject user content into specific parts of a UI | **Slots** | Enables composition while maintaining encapsulation. |
| Reuse markup structures efficiently | **HTML Templates** | High-performance cloning of pre-defined markup. |
| Integrate with a global design system (Light DOM) | **Custom Elements (No Shadow)** | Easiest for inheriting global CSS and theme variables. |
| Build a self-contained widget (e.g., Video Player) | **Shadow DOM with Templates** | Protects internal structure and styles from the host page. |

## 3. Custom Elements

### 3.1 Lifecycle Management

- **MANDATORY**: Register custom elements with a kebab-case name containing at least one hyphen (e.g., `my-element`).
- **MANDATORY**: Define `observedAttributes` if you need to react to attribute changes via `attributeChangedCallback`. See [§3.2.4 Property-to-Attribute Reflection](#324-property-to-attribute-reflection) for more details.
- Use `connectedCallback` for setup logic (DOM manipulation, fetching data) rather than the `constructor`. See [§3.2.3 Constructor](#323-constructor) for more details.
- Clean up global listeners, timers, or observers in `disconnectedCallback` to prevent memory leaks. See [§3.2.7 Disconnected Callback](#327-disconnected-callback) for more details.

```javascript
define('my-element', class extends HTMLElement {...});
```

### 3.2 Guidelines

#### 3.2.1 Base Class

Custom elements must extend the base `HTMLElement` class. While the spec includes "customized built-in elements" (extending specific classes like `HTMLButtonElement`), they are not recommended for production due to their permanent lack of cross-browser support (specifically [Safari](https://bugs.webkit.org/show_bug.cgi?id=182671)).

{{ BASELINE_STATUS("customized-built-in-elements") }}

#### 3.2.2 Constructor

The `constructor` is used for initializing state and attaching a Shadow DOM.

**IMPORTANT**: Avoid performing DOM manipulations or setting attributes here, as the element may not yet be in the document.

**Always** call `super()` first in the constructor.

```javascript
class MyComponent extends HTMLElement {
  constructor() {
    super(); // ✅ GOOD: Call super first
    this.shadowRoot = this.attachShadow({ mode: 'open' });
    this.userName = 'Guest';
    ... // other initialization logic
  }
}
```

**NEVER** call `super()` after performing other operations that may modify `this`.

```javascript
// ❌ BAD: Calling super after modifying this
class MyComponent extends HTMLElement {
  constructor() {
    this.attachShadow({ mode: 'open' }); // ❌ BAD: Modify this before calling super
    this.userName = 'Guest';
    super();
    ... // other initialization logic
  }
}
```

#### 3.2.3 Best Practice: Property Naming

Properly naming your component's properties and methods is essential for creating a predictable public API and maintaining clean internal logic.

- **Public API (Properties/Methods)**: Use `camelCase` for all public properties and methods to match standard DOM element conventions (e.g., `this.userName`, `this.updateStatus()`).
- **Internal Properties/State**: Use one of the following conventions to distinguish internal state from the public API:
    - **Private Fields (`#`)**: Use the native `#` prefix for true privacy. These properties are inaccessible from outside the class and provide the strongest encapsulation. **Best for**: Strict encapsulation where you want to prevent any external access or subclass overrides.
    - **Convention-based (`_`)**: Use a `_` prefix to signal that a property is intended for internal use only. While still technically accessible, this is a standard signal to other developers. **Best for**: Scenarios where you want to signal "internal use" but still allow subclasses to access or override the property for extension.
- **Avoid `data-` Prefixes for Properties**: While `data-*` attributes are useful for storing metadata in HTML, it is not recommended to prefix your JavaScript properties with `data-`. Use descriptive camelCase names instead.
- **Event Handler Properties**: If your component has property-based event handlers, prefix them with `on` (e.g., `this.onClick`).
- **Avoid Global Attribute Collisions**: Do not name your properties after global HTML attributes (like `style`, `class`, or `id`) unless you are intentionally overriding or wrapping their behavior. See [Avoiding Global Attribute Conflicts](#326-avoiding-global-attribute-conflicts) for more details.

```javascript
class MyComponent extends HTMLElement {
  #internalValue = 0; // Native private field
  _helperState = true; // Convention-based internal property
  userName = 'Guest'; // Public property (camelCase)

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  // Public method
  refreshUI() {
    this.#updateInternalState();
    this.render();
  }

  // Private method
  #updateInternalState() {
    this.#internalValue++;
  }
}
```

#### 3.2.4 Property-to-Attribute Reflection

Reflection ensures that the JavaScript property and the HTML attribute of a custom element stay in sync. This allows developers to interact with your component via both HTML and JavaScript seamlessly.

1. **Attribute to Property**: Use `attributeChangedCallback` to update internal state when an attribute changes.
2. **Property to Attribute**: Use getters and setters to update the attribute when the property is modified.

Note that the value of attributes fetched from the DOM are always strings. You will need to appropriately transform the string values from the attribute into the appropriate type for the property. Using TypeScript can help catch type errors at compile time, ensuring that you appropriately transform the string values from the attribute into the appropriate type for the property. Alternatively, you can use JSDoc to document the type of the property and the attribute; ideal if you don't want to add a compilation step to your project.

##### 3.2.4.1 Example: String/Number Reflection

```javascript
class MyElement extends HTMLElement {
  static get observedAttributes() {
    return ['label'];
  }

  // Getter/Setter for the 'label' property
  get label() {
    return this.getAttribute('label');
  }

  set label(val) {
    if (val) {
      this.setAttribute('label', val);
    } else {
      this.removeAttribute('label');
    }
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'label' && oldVal !== newVal) {
      this.render();
    }
  }
}
```

##### 3.2.4.2 Example: Boolean Attribute Reflection

Boolean attributes (like `disabled` or `checked`) follow a specific pattern: if the attribute is present (even without a value), the property is `true`. If absent, it is `false`.

```javascript
class MyToggle extends HTMLElement {
  static get observedAttributes() {
    return ['disabled'];
  }

  get disabled() {
    return this.hasAttribute('disabled');
  }

  set disabled(isPushed) {
    if (isPushed) {
      this.setAttribute('disabled', '');
    } else {
      this.removeAttribute('disabled');
    }
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'disabled') {
      this.classList.toggle('is-disabled', newVal !== null);
    }
  }
}
```

##### 3.2.4.3 Observed vs. Unobserved State

Determine whether a property should be **observed** or **unobserved** based on how its value impacts the component's state or appearance:

- **Observed Attributes**: Attributes listed in `static get observedAttributes()` trigger `attributeChangedCallback`. Use these for state that represents the component's public API and requires the component to **re-render** or perform a side effect when changed externally (e.g., via `element.setAttribute()`).
- **Unobserved Properties/Internal State**: State used purely for internal bookkeeping or properties that do not affect the visual output immediately should remain **unobserved**. This avoids the performance overhead of the `attributeChangedCallback` lifecycle.
- **Styling-only Reflection**: You may reflect a property to an attribute purely for CSS targeting (e.g., using `:host([is-loading])`) without adding that attribute to `observedAttributes`, provided the component is the sole manager of that state and does not need to react to external changes of that attribute.

#### 3.2.5 Syncing State

Always check for existing attributes during `connectedCallback` to ensure the initial property values match the HTML markup. This is important to ensure that the component is in a consistent state when it is first rendered.

#### 3.2.6 Avoiding Global Attribute Conflicts

Avoid using global attribute names as custom attribute or property names, as they have pre-defined behaviors in the browser. Using them can cause unexpected side effects or break standard functionality.

**Common conflicting names include:**

- `style`: Overwriting this can break the element's inline styling capability.
- `class`, `id`: Standard identifiers used for selection and styling.
- `slot`, `part`: Used for Web Component composition and styling.
- `lang`, `title`, `dir`: Global attributes for accessibility and localization.
- `disabled`: While common in custom elements, remember that it is not a global attribute for all elements (only for form-related ones). Using it on a non-form-associated element requires manual management of its effect on interactivity and styling.

## 4. Shadow DOM & Encapsulation

### Structuring a semantic template

When designing the template for a component, consider the following:

- By using semantic HTML elements, you can ensure that the component is accessible and that the user can understand the structure of the component. Most accessibility issues inside web components are due to the lack of semantic mark-up. This does not negate the need to attach appropriate event handlers or aria attributes to the component.
- Slots can be either named or unnamed. The unnamed slot is considered the "default" slot. Any content inside the component that is not specifically assigned to a named slot will be placed in the default slot. Note: this can include text nodes such as whitespace. To style the default slot, you can use `slot:not([name])` to target only the slot without an assigned name.
- Named slots provide a way to inject content into specific parts of the component  by an external consumer. Inside the template, you can use the `<slot name="name">` element to define the slot. When styling those slots, you can use `slot[name="name"]` to target the slot. Assigning content to a named slot is done with the `slot="name"` attribute on the element.

```html
<template id="my-component-template">
  <div class="container">
    <slot name="header"></slot>
    <div class="wrapper">
      <slot></slot>
      <slot name="aside"></slot>
    </div>
    <slot name="footer"></slot>
  </div>
</template>
```

Note: though content may be assigned to a slot in a specific order, the nodes themselves remain in the order they were originally added to the DOM. This means that `:first-child` and `:last-child` selectors will not work as expected when targeting content inside a slot.

**DOES NOT WORK:**

With this markup:

```html
<my-component>
    <div slot="footer"></div>
    <div slot="header"></div>
    <div slot="header"></div>
</my-component>
```

These styles inside the component will not work:

```css
/* Applies no styles because none of the header nodes are the first child */
slot[name="header"]::slotted(*:first-child) {}
```

### 4.1 Encapsulation Strategies

- Prefer `mode: 'open'` for most use cases to allow standard debugging tools to inspect the shadow root.
- Use `mode: 'closed'` if you want to obfuscate the internal structure of the component.
- **IMPORTANT**: Use `delegatesFocus: true` when attaching a shadow root if the element contains focusable parts and you want the host to focus the first available child. This is important to ensure that the component is accessible and that the user can focus the first available child when the component is focused.

### 4.2 Loading Stylesheets

| Method | Pros | Cons |
| :--- | :--- | :--- |
| **`<style>` Tag** | Simple, encapsulated, works everywhere. | Redundant if used in many instances; can bloat the DOM. |
| **`<link>` Tag** | Cacheable, allows external CSS files. | Risk of FOUC (Flash of Unstyled Content); separate network request. |
| **`adoptedStyleSheets`** | High performance; styles are shared via `CSSStyleSheet` objects across instances. | Requires JavaScript; doesn't support `@import` in the same way. |

## 5. Styling Web Components

- Use CSS Custom Properties and inherited properties (like `color` and `font-family`) for theming. These are the primary ways to pass styles through the shadow boundary by default.
- Use `::part()` to expose specific internal elements for external styling without breaking encapsulation.
- Style light-DOM children passed into slots using the `::slotted()` pseudo-element.

### 5.1 The :host Pseudo-class

- Use `:host` to style the custom element itself from within its Shadow DOM.
- Use `:host(selector)` to apply styles only when the host element matches a specific selector (e.g., `:host(.active)`).
- **Avoid** `:host-context(selector)` to style the host based on its ancestors (useful for theming, e.g., `:host-context([theme="dark"])`). This is not widely supported.

### 5.2 Slotted Content

Styles applied via `::slotted(selector)` only target the top-level elements assigned to the slot. That element's children and nested elements cannot be styled this way.

```html
<my-component>
    <div slot="header">
        <h1>Header</h1>
    </div>
</my-component>
```

```css
/* Does not work because h1 is not directly assigned to the slot */
::slotted(h1) {
    color: red;
}
```

Slotted content retains its original **Light DOM** styles. The `::slotted()` styles have lower specificity than styles directly targeting the elements in the Light DOM so this technique is most useful if you want users to own the styling of their slotted content. If you want your component to exert stronger control over the styling of its slotted content, you can:

- Lift the content out of the light DOM and inject it the shadow DOM. This is a brittle approach that requires careful management of the content and its children. If content is updated dynamically, you will need to refresh the component to ensure the new content is replaced accurately.
- Assign `!important` to all your `::slotted()` styles. This is a brute force approach that will override the styles of the slotted content as long as the consumer does not assign `!important` to their styles. This is also not recommended because it breaks the expected behavior of styling and is a poor consumer experience.

### 5.3 Inheritance and CSS Custom Properties

Web Components' Shadow DOM provides a natural encapsulation boundary for styles. This means that styles applied to the parent document will not affect the component's styles, and vice versa with a few exceptions. Certain typographic properties like `font-family`, `color`, and `line-height` naturally pass through the shadow boundary. If your component is not providing a background color, for example, but is rendering text, it's a good idea to set the `color` property to inherit from the parent document. To prevent these properties from passing through the shadow boundary, you can define them to your preferred values inside your template and they will override the inherited values.

Many projects leverage CSS Custom Properties (Variables) as the primary API for component theming because, like typographic properties, they naturally pass through the shadow boundary. If you want to allow outside styles to override the component's styles, you can define them as CSS Custom Properties. You should provide a reasonable fallback value for the custom properties to ensure that the component is styled even if the custom property is not defined.

```css
:host {
  background-color: var(--my-component--BackgroundColor, white);
  color: var(--my-component--TextColor, contrast-color(var(--my-component--BackgroundColor, white)));
}
```

```css
:root {
    --my-component--BackgroundColor: goldenrod;
    --my-component--TextColor: black;
}
```

Note: If you define a CSS Custom Property at the `:host` level, users will only be able to override it if they assign the custom properties to the tag itself. If you want custom properties to be inheritable through the DOM tree, you should set custom properties as empty variables and assign the default values as the fallbacks.

**DON'T**

```css
:host {
  --my-component--BackgroundColor: white;
  --my-component--TextColor: contrast-color(white);

  .content {
    background-color: var(--my-component--BackgroundColor);
    color: var(--my-component--TextColor);
  }
}
```

because users will have to:

```css
/* The above requires users to assign custom properties to the tag */
my-component {
  --my-component--BackgroundColor: goldenrod;
  --my-component--TextColor: black;
}

/* These will not override the properties defined on :host above */
body {
  --my-component--BackgroundColor: goldenrod; /* lower specificity */
  --my-component--TextColor: black;
}
```

### 5.4 The ::part() Pseudo-element

The `::part()` pseudo-element allows you to expose specific elements within your Shadow DOM to external styling. This provides a flexible way to allow theming without requiring users be familiar with the internal structure of the component. Parts allow any valid CSS property to be applied to that part of the component and is not ideal for strict design systems.

- **When to use**: Use `part="name"` to expose high-level UI elements (like a "button", "input", or "label") that consumers might want to style directly.
- **When NOT to use**: Avoid exposing every internal `<div>` or `<span>`. This creates a brittle API and defeats the purpose of Shadow DOM encapsulation. If you need to expose many styles, prefer CSS Custom Properties.

```html
<!-- Inside Component Template -->
<div class="container">
  <button part="submit-button">Submit</button>
</div>

<!-- External CSS -->
my-component::part(submit-button) {
  background-color: navy;
  color: white;
}
```

Use custom properties when you want to allow users access to specific properties of the component.

Use parts when you want to allow users unrestricted access to style an internal element of the component.

```html
<!-- Inside Component Template -->
<div class="container">
  <button part="submit-button">Submit</button>
</div>

<!-- External CSS -->
my-component::part(submit-button) {
  background-color: navy;
  appearance: none;
  color: white;
}
```

## 6. Semantics, Accessibility, and Forms

### 6.1 Shadow DOM and ARIA

- **MANDATORY**: Ensure that IDs used for ARIA relationships (e.g., `aria-labelledby`, `aria-describedby`) are contained within the same Shadow Root. ARIA relationships cannot cross shadow boundaries.
- Use the `role` attribute on the host element if the component represents a specific landmark or widget type.

### 6.2 Form-Associated Custom Elements (FACE)

- **IMPORTANT**: Set `static formAssociated = true` in your custom element class to allow it to participate in native HTML `<form>` submissions.
- **IMPORTANT**: Use `this.attachInternals()` to access the `ElementInternals` API, which provides methods for managing form value, validity, and state.
- FACE solves the problem of custom elements needing hidden `<input>` fields to submit data or report validity to the surrounding form.

## 7. HTML Templates and Slots

- Use `<template>` elements for complex markup to benefit from the browser's optimized cloning performance.
- **MANDATORY**: Always use `template.content.cloneNode(true)` when instantiating templates to ensure the fragment is reused.
- Use named slots (`<slot name="header">`) when your component requires multiple distinct content injection points.

## 8. Performance

Optimizing Web Components is crucial for maintaining a smooth user experience, especially when using many instances of a component.

### 8.1 Performance Bottlenecks

- **Deeply Nested Shadow Roots**: Avoid creating many levels of nested components with their own Shadow DOMs. Each level adds overhead to style resolution, layout calculation, and DOM traversal.
- **"Div Soup" in Templates**: Keep your component templates lean. Excessive wrapping elements (heavy div usage) increase memory consumption and slow down rendering. Prefer a flat DOM structure where possible.
- **Excessive Observation**: Only include attributes in `observedAttributes` that strictly require a re-render or a side effect. Observing every attribute adds unnecessary overhead to every change.

### 8.2 Optimization Strategies

- **Reuse `<template>` Instances**: Define your `<template>` once (e.g., as a static property or in the module scope) and use `cloneNode(true)` to instantiate it. This is much faster than repeatedly setting `innerHTML`.
- **Defer Non-Critical Work**: Use `connectedCallback` for initialization, but defer heavy logic (like complex data fetching or expensive DOM manipulations) until the element is actually visible using an `IntersectionObserver`.
- **Avoid Unnecessary Shadow Roots**: If a component does not require style or DOM encapsulation (e.g., a simple wrapper that should inherit all global styles), do not attach a Shadow DOM.
- **Conditional Rendering**: For large components, avoid rendering hidden parts until they are needed. Use `<template>` elements or standard JS logic to lazily inject DOM sections.

### 8.3 Measuring Component Performance

Use the User Timing API (`performance.mark` and `performance.measure`) to identify bottlenecks in your component's lifecycle. This allows you to track how long specific operations (like rendering or data processing) take across many instances.

#### Using performance.mark in Lifecycle Callbacks

Mark the start and end of critical operations to calculate their duration.

```javascript
class MySlowComponent extends HTMLElement {
  constructor() {
    super();
    performance.mark('my-component-constructor-start');
    this.attachShadow({ mode: 'open' });
    // ... initialization ...
    performance.mark('my-component-constructor-end');
    performance.measure('MyComponent Constructor', 'my-component-constructor-start', 'my-component-constructor-end');
  }

  connectedCallback() {
    const markName = `my-component-connected-${this.id || 'instance'}`;
    performance.mark(`${markName}-start`);

    this.render();

    performance.mark(`${markName}-end`);
    performance.measure(`MyComponent Connected (${this.id})`, `${markName}-start`, `${markName}-end`);
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal !== newVal) {
      performance.mark(`my-component-attr-change-${name}-start`);
      this.render();
      performance.mark(`my-component-attr-change-${name}-end`);
      performance.measure(`MyComponent Attr Change: ${name}`, `my-component-attr-change-${name}-start`, `my-component-attr-change-${name}-end`);
    }
  }
}
```

- **Naming Strategy**: Use unique names for marks and measures, especially if multiple instances of the same component exist. Incorporating the element's `id` or a unique counter is recommended.
- **Production Use**: While valuable for debugging, consider stripping or conditionally enabling these marks in production to avoid minimal overhead and "polluting" the performance timeline for users.
