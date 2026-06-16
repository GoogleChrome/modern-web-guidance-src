---
name: web-components
description: Orientation and cross-cutting principles for authoring and using Web Components, covering Custom Elements, Shadow DOM, templates and slots, Declarative Shadow DOM, styling across the shadow boundary, Form-Associated Custom Elements, and accessibility requirements. Use this guide when building reusable UI components, design systems, or server-rendered custom elements.
---

# Web Components Orientation Guide

Web Components are Custom Elements, Shadow DOM, and HTML Templates: the platform primitives for reusable, framework-agnostic components whose markup and styles are encapsulated from the document. Use them for design systems, embeddable widgets, and self-contained UI.

The rules below are cross-cutting. Retrieve the specific guide for the task at hand; each restates the context it needs and documents the APIs and pitfalls unique to it.

## Decide whether you even need a custom element

Reach for a custom element only when you need encapsulated behavior, lifecycle, or a reusable JS-backed API on a tag. Do **not** build one when:

- A plain HTML element with CSS would do. A styled `<button>` or `<details>` is more accessible and cheaper than a re-implementation.
- The thing is purely presentational with no behavior. A class on a native element is more performant, and scopable with `@layer` or `@scope`.
- You only need style scoping on the server with no interactivity; a scoped stylesheet or Declarative Shadow DOM (without an upgrade) may be enough.

Rebuilding native semantics (a custom `<my-button>` that re-creates focus, activation, and ARIA) is the most common misuse: you inherit the platform's accessibility for free only if you reuse the native element.

## Cross-cutting rules

These hold across every guide below:

- **MANDATORY**: the tag name must be kebab-case with at least one hyphen (e.g. `my-element`). This is what distinguishes custom elements from current and future built-ins.
- **MANDATORY**: call `super()` first in the constructor, before touching `this`; calling it after any statement that reads or writes `this` throws.
- **MANDATORY**: use semantic elements (`<button>`, `<nav>`, `<ul>`) inside shadow templates. Most accessibility failures in shadow trees come from non-semantic markup; a slot does not change the role of what it projects.
- **MANDATORY**: ARIA `id` references (`aria-labelledby`, `aria-describedby`, `aria-controls`) cannot cross a shadow boundary; the referencing element and the `id` it points to must live in the same tree.
- Prefer `attachShadow({ mode: 'open' })` so dev tools, page scripts, and server hydration can reach `element.shadowRoot`. Use `'closed'` only when you must hide internal structure from page scripts.
- Avoid *customized built-in elements* (`extends HTMLButtonElement` with `is="…"`); Safari has permanently declined to ship them.

## Glossary

| Term | Definition |
| :--- | :--- |
| **Custom Element** | A user-defined HTML tag registered via `customElements.define()`. |
| **Autonomous Custom Element** | A custom element extending the base `HTMLElement` class (e.g. `<my-card>`). |
| **Customized Built-in Element** | A custom element extending a specific native element (e.g. `<button is="my-button">`). Not recommended for production; Safari has declined to implement them. |
| **Shadow DOM** | An encapsulated DOM subtree attached to an element, isolated from the main document's styles and markup. |
| **Shadow Root** | The root node of a Shadow DOM subtree. |
| **Shadow Host** | The regular DOM node a shadow root is attached to. |
| **Light DOM** | The regular DOM inside an element that is *not* part of its shadow tree. Slotted content lives here. |
| **Slot** | A placeholder (`<slot>`) inside a shadow tree that projects Light DOM content into the component. |
| **HTML Template** | The `<template>` element: inert markup that is parsed but not rendered, cloned for reuse. |
| **ElementInternals** | The object returned by `this.attachInternals()`, exposing form participation, validity, and ARIA semantics to a custom element. |
| **Observed Attributes** | The static list of attribute names that trigger `attributeChangedCallback` when changed. |

## Use-case guide matrix

Identify the task and retrieve its guide:

| If you need to… | Retrieve |
| :--- | :--- |
| Define a new semantic tag with behavior and lifecycle | {{ GUIDE_REF("custom-elements") }} |
| Scope styles and markup to a component, and project consumer content into it | {{ GUIDE_REF("shadow-dom") }} |
| Render a component's shadow tree on the server (SSR) without a flash of unstyled content | {{ GUIDE_REF("declarative-shadow-dom") }} |
| Style across the shadow boundary (theming, `::part`, custom properties) | {{ GUIDE_REF("styling-web-components") }} |
| Submit a custom control's value to a surrounding `<form>` | {{ GUIDE_REF("form-associated-custom-elements") }} |
| Make a custom element accessible (roles, focus, ARIA across shadow roots) | {{ GUIDE_REF("accessible-web-components") }} |
