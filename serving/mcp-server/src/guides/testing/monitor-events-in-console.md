---
description: Monitor events dispatched to an object in the Console to aid in debugging and understanding object behavior.
filename: monitor-events-in-console
category: testing
---

# Monitor Events in the Console

This guide demonstrates how to use the `monitorEvents()` method in the Chrome DevTools Console to log all events dispatched to a specific object. This is particularly useful for debugging and understanding the lifecycle and properties of event objects.

## Quickly monitor events from the Console Panel

The `monitorEvents()` method is a Command Line API method available in Chrome DevTools. It allows you to log all events dispatched to an object directly to the Console.

### How to use `monitorEvents()`

To use `monitorEvents()`, you need to provide the object you want to monitor and optionally an array of event names to filter.

```javascript
// Monitor all events dispatched to the 'document' object
monitorEvents(document);

// Monitor only 'click' and 'mouseover' events dispatched to a specific button element
const button = document.querySelector('button');
monitorEvents(button, ['click', 'mouseover']);
```

When events are dispatched to the monitored object, they will appear in the Console, allowing you to inspect their properties and understand their behavior.

### Example: Monitoring events on a DOM element

Let's say you have a button element on your page and you want to see all the events it receives.

1.  **Open Chrome DevTools:** Right-click on the element and select "Inspect" or press `F12`.
2.  **Navigate to the Console tab.**
3.  **Select the element in the Elements panel** or get a reference to it in the Console.
4.  **Execute the `monitorEvents()` command:**

    ```javascript
    // Assuming you have a button with id="myButton"
    const myButton = document.getElementById('myButton');
    monitorEvents(myButton);
    ```

Now, when you interact with `myButton` (e.g., click it, hover over it), you will see the dispatched events logged in the Console.

## Inspecting Event Properties

Once events are logged, you can expand them in the Console to inspect their various properties. This is invaluable for understanding what data is available during an event and how to use it. For example, `event.target`, `event.currentTarget`, `event.clientX`, `event.clientY` are common properties to inspect for mouse events.

## Stopping Event Monitoring

To stop monitoring events for an object, use the `unmonitorEvents()` method, providing the same object reference.

```javascript
// Stop monitoring all events on the document object
unmonitorEvents(document);

// Stop monitoring events on the specific button
unmonitorEvents(myButton);
```

By leveraging `monitorEvents()`, developers can gain deeper insights into their application's event handling, leading to more efficient debugging and a better understanding of DOM interactions.