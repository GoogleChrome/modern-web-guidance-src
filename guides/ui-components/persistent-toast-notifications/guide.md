---
name: persistent-toast-notifications
description: Create non-intrusive toast and overlay notifications for persistent, stackable messaging and state communication.
web-feature-ids:
  - popover
  - arianotify
  - anchor-positioning
  - sibling-count
  - transition-behavior
---

# Creating Toast Notifications

Toast notifications are transient status messages. Unlike menus, they should not close when a user interacts with other parts of the page. The popover="manual" state is ideal because it lacks "light-dismiss" behavior and allows multiple notifications to coexist.

## When to use

Toast notifications must be used to provide non-critical, supplemental information about the results of an interaction, or an event (e.g. an email has been received). An example may include confirming that a form submission was successful. Notifications that require immediate attention should instead use an alternative component. Examples include inline banners, dialogs or modal dialogs. These examples surface information in a way that is easier to identify for everyone. Toasts should be used sparingly, as making them accessible to everyone means addressing complex considerations, and is the reason why some companies have opted to no longer use them, and instead, utilize the alternative aforementioned components.

## Implementation guidelines

Prefer persistent toast notifications that remain present until they are dismissed, except for frequent, low importance events, where the friction persistence creates outweighs the value of the information provided. In those cases, do evaluate whether toasts actually add to the user experience in general — in some cases it may be preferable to not have them at all.

* **MANDATORY:** Use popover="manual" so the notification stays visible until explicitly closed or timed out by a script.
* **MANDATORY:** Ensure that the information in the toast can be identified by other means, so that if it is part of a pattern that disappears after a short period of time, people can still identify the information without the toast being present.
* **DO** use a container to manage the stacking of multiple toasts. Since popovers in the Top Layer ignore parent z-index, you must position them individually or within a common layout group.
* **DO** add toast notifications consistently to the same container in the page, so that people using assistive technologies can consistently locate them.
* **DO** make the container a region, with an accessible name, so that it can be easily identified using a screen reader. For example: `<div role="region" aria-label="Notifications"></div>`.
* **DO** use `ariaNotify()` to announce the content present in toasts that are displayed. This ensures that people using screen readers, who cannot see the screen, are aware of the presence of toast messages
{# For context, this approach is as recommended in Celebrating with the Perfect Toast by Ian Lloyd https://a11y-tools.com/blog/2025/05/celebrating-with-the-perfect-toast/ #}
* **DO** ensure that only the toast's visible text is announced as part of the `ariaNotify()` and not the names of any controls. If actions are available in the toast (aside from a close control), append "Actions available" to the end of the announcement.
* **DO** provide an explicit "Close" button within the toast using popovertargetaction="hide".
* **DO** ensure that a toast's dismiss button is keyboard-focusable (without automatically stealing focus when the toast appears), so keyboard users can navigate to the toast region and dismiss notifications.
* **DO** manage focus when a user manually dismisses a currently focused toast: move focus to the next remaining toast in the stack, or—if no toasts remain—return focus to the user's prior focus location (or the control that triggered the toast).
* **DO** declare `transition-behavior: allow-discrete` as a separate property after `transition` (rather than inside the `transition` shorthand) to animate entry and exit from the Top Layer without older browsers ignoring the `transition` declaration.
* **DO** provide a non-animated version using the `prefers-reduced-motion` media query
* **DO** ensure that toast messages scale in size, and that all toast content remains visible when resizing text up to 200% to adhere to WCAG 1.4.4 Resize Text (Level AA)
* **DO** ensure that all toast content remains visible when adjusting text styling and spacing with CSS to adhere to 1.4.12 Text Spacing (Level AA)
* **DO** ensure that all toast content remains visible, or can be accessed still, when using a viewport sized to 320 by 256 CSS pixels to adhere to 1.4.10 Reflow (Level AA)

* **DON'T** surface toasts in scenarios where focus redirection may be used at the same time. The focus redirection may cancel out the toast announcements, resulting in people missing information.
* **DON'T** use toasts in modal dialogs. Content outside of the dialog will be inert and unavailable to assistive technologies. Placing the toast in a modal dialog, separate from the existing toast container makes it difficult to locate, and may lead to people not being able to locate it.
* **DON'T** surface toast notifications in the background while a modal dialog is open. It's likely the notification will be missed. Instead, suppress the notification until the modal dialog is dismissed.
* **DON'T** include controls in toast notifications that are not already permanently available outside the toast notifications. Controls in toasts should be used sparingly, and only provided as an alternative way of completing an action.

## Optional: Usability & accessibility improvements

* **Surface previous toasts**: Provide a way for people to access a list of past toast messages. This can help people who may encounter difficulty in remembering what the toast informed them, or reduce anxiety for people who inadvertently dismissed a toast message.
{# This approach is suggested in Designing Toast Messages for Accessibility by Sheri Byrne-Haber in https://sheribyrnehaber.medium.com/designing-toast-messages-for-accessibility-fb610ac364be #}
* **Customize toast notifications**: Provide a way for people to customize which toast notifications are provided. This can help to ensure that information provided to people is relevant, reducing distractions and confusion.
{# This approach is suggested in Notifications by Heydon Pickering in https://inclusive-components.design/notifications/ #}
* **Use an alternative way to communicate toasts are present**: It is recommended that there are multiple ways to communicate that a toast has been made visible. An example of this may be a brief sound effect (which could be turned off). This will help people using screen magnification software, who may otherwise find it difficult to identify that toasts are present.
{# This approach is suggested in A toast to an accessible toast... by Scott O’Hara https://www.scottohara.me/blog/2019/07/08/a-toast-to-a11y-toasts.html #}

## Fallback strategies

{{ FEATURE_FALLBACKS("popover") }}

{{ FEATURE_FALLBACKS("arianotify") }}

{{ FEATURE("anchor-positioning", "popover-fallbacks") }}

#### sibling-index()

* **Guidance:** If sibling-index() is not supported, use the `+` operator to add margin manually. I.e. `popover + popover { margin-top: 1rem }`

#### transition-behavior

* **Guidance:** If transition-behavior is not supported, use JavaScript to add animation via classes as the toast element transitions in and out.
