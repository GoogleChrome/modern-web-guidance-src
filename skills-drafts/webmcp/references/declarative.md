# WebMCP Declarative API

The Declarative API transforms standard HTML `<form>` elements into WebMCP tools via attributes. The browser synthesizes a JSON Schema from the form inputs and handles agent interactions.

## Form Attributes

*   `toolname`: Unique name for the tool.
*   `tooldescription`: Purpose of the tool.
*   `toolautosubmit`: (Optional) If present, the agent can submit the form without waiting for user interaction. 
*   `toolparamdescription`: (Optional, on input) Maps to the property description. Defaults to the `<label>` text.
    *   *Note*: For `<input type="radio">` groups, place this on the *first* `<input>` element.

### Example

```html
<form toolname="search-cars" 
      tooldescription="Perform a car make/model search" 
      toolautosubmit>
  <label for="make">Vehicle Make</label>
  <input type="text" id="make" name="make" required>
  
  <label for="model">Vehicle Model</label>
  <input type="text" id="model" name="model" toolparamdescription="e.g., 330i, F-150" required>
  
  <button type="submit">Search</button>
</form>
```

## Handling Submissions in JavaScript

When an agent submits the form, the `SubmitEvent` includes `agentInvoked` (boolean) and `respondWith(promise)`.

```javascript
document.querySelector('form').addEventListener('submit', (event) => {
  event.preventDefault();

  // Validate the form
  if (!myFormIsValid()) {
    if (event.agentInvoked) { 
      event.respondWith(Promise.resolve({ error: "Validation failed" })); 
    }
    return;
  }

  const resultPromise = performAsyncSearch(new FormData(event.target));
  
  // Return the result directly to the agent without navigation
  if (event.agentInvoked) {
    event.respondWith(resultPromise);
  }
});
```

## Lifecycle Events

The window emits events when agents start or stop interacting with a tool:

```javascript
window.addEventListener('toolactivated', ({ toolName }) => {
  console.log(`Tool "${toolName}" was activated by the agent.`);
});

window.addEventListener('toolcancel', ({ toolName }) => {
  console.log(`Tool "${toolName}" interaction was cancelled.`);
});
```

## Visual Feedback (CSS)

Use pseudo-classes to highlight forms when an agent interacts with them:

*   `:tool-form-active`: Applied to the `<form>` element actively used by the agent.
*   `:tool-submit-active`: Applied to the submit button when the browser pauses for user review (if `toolautosubmit` is omitted).

```css
form:tool-form-active {
  outline: 2px dashed blue;
  background-color: rgba(0, 0, 255, 0.05);
}

button:tool-submit-active {
  outline: 2px dashed red;
  animation: pulse 2s infinite;
}
```
