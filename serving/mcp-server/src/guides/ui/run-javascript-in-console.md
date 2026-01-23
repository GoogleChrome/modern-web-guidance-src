---
description: Learn how to use the Chrome DevTools Console to run JavaScript, inspect and modify web pages, and test code snippets.
filename: run-javascript-in-console
category: ui
---

# Run JavaScript in the Console

Reference docs:
- [Chrome DevTools][1]
- [Get Started With Logging Messages][2]
- [Get Started With Debugging JavaScript][3]
- [Console Utilities API Reference][9]

## Overview

The **Console** is a REPL (Read, Evaluate, Print, Loop) that allows you to execute JavaScript code directly within your browser. It's a powerful tool for inspecting and manipulating web pages, debugging code, and experimenting with JavaScript features.

## Set up DevTools

To follow along with the examples, open the Chrome DevTools Console.

1.  Press `Command+Option+J` (Mac) or `Control+Shift+J` (Windows, Linux, ChromeOS) to open the **Console** on the current page.

    <img src="image/this-tutorial-the-left-3bf8b216c0b2e.png" alt="This tutorial on the left, and DevTools on the right." width="800" height="480">

    **Figure 1**. This tutorial on the left, and DevTools on the right.

## View and change the page's JavaScript or DOM

You can use the Console to dynamically alter the appearance or behavior of a web page.

1.  Observe the text in the button below.

    <button id="hello">Hello, World!</button>

2.  In the **Console**, type `document.getElementById('hello').textContent = 'Hello, Console!'` and press `Enter`. Notice how the button's text updates.

    <img src="image/how-console-looks-evalu-b3a745fbdfd18.png" alt="How the Console looks after evaluating the expression above." width="800" height="463">

    **Figure 2**. How the Console looks after evaluating the expression above.

    The Console prints `"Hello, Console!"`, which is the result of evaluating the expression, demonstrating the "Print" step of the REPL.

## Run arbitrary JavaScript that's not related to the page

The Console also serves as a convenient code playground for testing JavaScript snippets or exploring new features.

1.  Type `5 + 15` in the Console and press `Enter`. The result `20` will appear below your expression.

2.  To define a function with a default parameter, type the following code into the **Console**:

    ```js
    function add(a, b=20) {
      return a + b;
    }
    ```

3.  Now, call the function:

    ```js
    add(25);
    ```

    <img src="image/how-console-looks-evalu-ca99a80fda31c.png" alt="How the Console looks after evaluating the expressions above." width="800" height="463">

    **Figure 3**. How the Console looks after evaluating the expressions above.

    `add(25)` evaluates to `45` because `b` defaults to `20` when not provided.

**Note:** If a JavaScript execution takes too long, you can use the **Task Manager** to cancel it, but this may also cause the current page to fail and result in data loss.

## Next steps

- Explore more features for running JavaScript in the Console: [Run JavaScript][7].
- Learn how to pause script execution and use the Console for debugging: [Get Started With Debugging JavaScript][8].
- Discover how to format and style console messages: [Format and style messages in the Console](/docs/devtools/console/format-style).
- Utilize Console convenience functions for easier interaction with web pages, such as:
    - `$()`: Alias for `document.querySelector()`.
    - `debug(function)`: Sets a breakpoint on the first line of a function.
    - `keys(object)`: Returns an array of an object's keys.
    - For a full list, see [Console Utilities API Reference][9].

[1]: /docs/devtools
[2]: /docs/devtools/console/log
[3]: /docs/devtools/javascript
[4]: https://en.wikipedia.org/wiki/Read%E2%80%93eval%E2%80%93print_loop
[5]: http://2ality.com/2012/09/expressions-vs-statements.html
[6]: http://es6-features.org/#DefaultParameterValues
[7]: /docs/devtools/console/reference#js
[8]: /docs/devtools/javascript
[9]: /docs/devtools/console/utilities