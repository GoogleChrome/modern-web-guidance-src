---
description: Build advanced text editing experiences on the web by decoupling text input from the DOM with the EditContext API.
filename: editcontext-api-for-advanced-editing
category: ui
---

# EditContext API for Advanced Editing

Reference docs:
- https://w3c.github.io/edit-context
- https://developer.mozilla.org/docs/Web/API/EditContext_API

## Best Practices

The EditContext API allows developers to receive text input directly, without being tied to the browser's default editing behaviors, enabling advanced text editing features and custom editor views.

### Initialize and Associate EditContext

Create an `EditContext` instance and associate it with a DOM element to make it focusable and capable of receiving text input.

```js
const element = document.querySelector('#editor-element');
const editContext = new EditContext();
element.editContext = editContext;
```

### Render Text and Selection

Listen for the `textupdate` event to render the user's typed text and selection onto the page.

```js
editContext.addEventListener('textupdate', event => {
  element.textContent = editContext.text;
  // Code to render selection goes here
  renderSelection(editContext.selectionStart, editContext.selectionEnd);
});
```

### Manage Editable Region and Selection Bounds

Inform the `EditContext` instance about changes to the editable region and selection bounds using `updateControlBounds()` and `updateSelectionBounds()` to help the platform position IME windows and other UI correctly.

```js
const controlBound = editorElement.getBoundingClientRect();
const selection = document.getSelection();
const selectionBound = selection.getRangeAt(0).getBoundingClientRect();
editContext.updateControlBounds(controlBound);
editContext.updateSelectionBounds(selectionBound);
```

### Manage Editor UI Position

Respond to the `characterboundsupdate` event and use `updateCharacterBounds()` to assist the platform in positioning IME windows and other editing UI.

### Apply Formatting

Listen for the `textformatupdate` event and apply the specified text decorations to your editor view, which is crucial for IMEs in certain languages.

### Handle Rich Text Editing Behaviors

Listen to the `beforeinput` event to implement rich text editing functionalities like hotkeys for formatting or spell check corrections.

### Manage Selection Changes

When user selections change, inform the `EditContext` instance using `updateSelection()` by mapping DOM selection offsets to plain text space. This is particularly important for non-DOM based editors like `<canvas>`.

```js
document.addEventListener('selectionchange', () => {
  const selection = document.getSelection();
  editContext.updateSelection(selection.anchorOffset, selection.focusOffset);
});
```

**Note:** For `<canvas>` elements, you'll need to implement selection and caret navigation behaviors manually. The browser's built-in spell check also doesn't work with `<canvas>`.

## EditContext vs. `contenteditable`

Use EditContext when implementing fully-featured editors, requiring fine-grained control over text input, or when adding advanced features like co-editing. For simpler text editing needs, `contenteditable`, `<input>`, or `<textarea>` may still be more suitable.

## Browser Support and Future

EditContext is available in Chrome and Edge since version 121 (January 2024). Consult [Mozilla's](https://github.com/mozilla/standards-positions/issues/199) and [WebKit's positions](https://github.com/WebKit/standards-positions/issues/243) for their stance on the API.

## Feedback and Bug Reporting

- For API design feedback, open an issue in the [EditContext API's Github repository](https://github.com/w3c/edit-context/issues).
- To report implementation bugs, submit a bug at [crbug.com](https://bugs.chromium.org/p/chromium/issues/list).