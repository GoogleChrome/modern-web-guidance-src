---
description: Debugging form and Autofill issues in Chrome DevTools to improve user experience and accessibility.
filename: debug-form-autofill-issues
category: ui
---

# Debugging Form and Autofill Issues with Chrome DevTools

This guide outlines how to leverage new features in Chrome DevTools to identify and resolve problems with form input and the Autofill functionality, enhancing both user experience and accessibility.

## Understanding Autofill

Autofill is a Chrome feature that securely stores user data (addresses, payment details, login information) and offers to populate form fields automatically, saving users time and effort. Chrome also provides suggestions for single form fields that don't fit structured Autofill data, based on past usage.

## Testing New Chrome DevTools Autofill Features

Chrome is actively developing new capabilities within the DevTools **Issues** panel to aid in debugging Autofill glitches. These features are in early development, and user feedback is crucial.

### Enabling Autofill Debugging Features

1.  **Chrome Canary:** Ensure you are using the latest development version of Chrome.
2.  **Enable Experiment:**
    *   Navigate to `chrome://flags` and search for `AutofillEnableDevtoolsIssues`. Enable this flag.
    *   Alternatively, launch Chrome Canary from the command line with the following flags:
        *   **Windows:** `start chrome --restart --flag-switches-begin --enable-features=AutofillEnableDevtoolsIssues`
        *   **Mac:** `open -a "Google Chrome Canary" --args --restart --flag-switches-begin --enable-features=AutofillEnableDevtoolsIssues`
3.  **Reload DevTools:** After enabling the feature, reopen DevTools (F12 or right-click -> Inspect).

### Identifying Form Issues

1.  Open the **Issues** panel in Chrome DevTools on a page containing forms. A good test page is [form-problems.glitch.me](https://form-problems.glitch.me).
2.  The Issues panel will highlight various form-related problems, such as:
    *   Input fields missing `id` or `name` attributes.
    *   Duplicate element IDs.
    *   Incorrect `<label>` `for` attributes not matching any element `id`.
    *   Fields with empty `autocomplete` attributes.
3.  Hover over a highlighted element in the DOM tree and click **View issue** for detailed information.
4.  Click **Violating node** to see the specific elements affected by the issue.

### Improving Form Accessibility

DevTools can also identify accessibility problems related to Autofill, such as form fields lacking an `aria-labelledby` attribute or an associated `<label>`.

*   **Good Practice:** An `<input>` element with a matching label allows assistive technologies to announce its purpose correctly.
*   **Problematic:** When no matching label or `aria-labelledby` attribute is found, assistive devices may not be able to convey the purpose of the form field to the user.

## Providing Feedback

Your feedback is invaluable for improving these features. You can share your thoughts and report issues through the following channels:

*   **Umbrella Bug:** Submit suggestions and feedback via the [umbrella bug on crbug.com](https://bugs.chromium.org/p/chromium/issues/detail?id=1442954).
*   **Report from DevTools:** Go to **More options** > **Help** > **Report a DevTools issue**.
*   **Twitter:** Tweet to [@ChromeDevTools](https://twitter.com/intent/tweet?text=@ChromeDevTools).

## Further Learning

*   [Learn Forms](https://web.dev/learn/forms): A comprehensive course on HTML forms for developers new to forms and Autofill.
*   [web.dev/tags/forms](https://web.dev/articles/tags/forms): Resources, best practices, and codelabs for working with payment, login, and address forms.