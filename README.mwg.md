<p align="center">
  <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/modern-web-guidance.svg" alt="Modern Web Guidance Logo" width="150" />
</p>

# Modern Web Guidance

Inject web platform expertise, best practices, and modern API patterns directly into your AI coding agents.

**Modern Web Guidance** is an agent skill (aka `SKILL.md`) with a CLI that helps coding agents build better web applications using modern, high-performance, accessible, and secure APIs instead of legacy workarounds.

*Supported by the Google Chrome team, the Microsoft Edge team, and the web development community.*

<!-- <LIKE A DEMO VIDEO LOOP OR SOMETHING?> -->

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/terminal.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Quickstart

```shell
npx modern-web-guidance@latest install
```

This command runs an interactive wizard to place the SKILL.md appropriately. See [Alternative Installation Methods](#alternative-installation-methods) below.

#### Try it out (without installing)

```shell
# Search for relevant guides
npx modern-web-guidance@latest search "animate a dialog modal backdrop"

# Retrieve a guide by ID
npx modern-web-guidance@latest retrieve "animate-to-from-top-layer"
```

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/lightbulb.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Why?

Coding agents often default to older patterns because LLM training data contains vast amounts of legacy code. This often leads them to generate bloated JavaScript for tasks that now have native, high-performance web platform solutions.

Even if a model knows an API exists, it often lacks the density of real-world, modern implementation patterns required for production-ready code.

**Modern Web Guidance bridges this gap.** Our skill's CLI returns targeted, expert-curated guidelines directly into your agent's context window, focusing on:
* **Modern Browser APIs**: Helping models correctly structure APIs they frequently misuse.
* **Performance & Accessibility**: Eliminating legacy bloat with clean, native patterns.
* **Responsible Fallbacks**: Guiding models to use sensible, lightweight fallbacks instead of heavy polyfills or legacy libraries.

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/package.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> What's Included?

We cover the past several years of the web platform's new features, all the way up to the cutting edge. The guides are **designed to be token-efficient**; we run evals enabling us to prune lowest-common-denominator content that models already know.

### Core Disciplines

<table width="100%" style="border-collapse: collapse; border: none;">
  <tr style="border: none;">
    <td width="33%" valign="top" style="border: none; padding: 6px;">
      <h4>🎨 User Experience</h4>
      <p style="font-size: 0.9em; line-height: 1.4;">Smooth visual states (View Transitions, entry/exit animations, parallax scroll, CSS <code>scrollbar-color</code>).</p>
    </td>
    <td width="33%" valign="top" style="border: none; padding: 6px;">
      <h4>📐 CSS Layout</h4>
      <p style="font-size: 0.9em; line-height: 1.4;">Modern layout systems (container queries, <code>subgrid</code>, modern color spaces like <code>oklch</code>, text-wrap tuning, and line-height trimming).</p>
    </td>
    <td width="33%" valign="top" style="border: none; padding: 6px;">
      <h4>⚡ Performance</h4>
      <p style="font-size: 0.9em; line-height: 1.4;">Speed optimizations (instant preloading, Interaction to Next Paint (INP) diagnostics, and scheduling tasks via <code>scheduler.yield</code>).</p>
    </td>
  </tr>
  <tr style="border: none;">
    <td width="33%" valign="top" style="border: none; padding: 6px;">
      <h4>📝 Forms & UI</h4>
      <p style="font-size: 0.9em; line-height: 1.4;">Native components (Anchor Positioning for tooltips, Popover API, dialogs, <code>:user-invalid</code> validation, and auto-sizing fields).</p>
    </td>
    <td width="33%" valign="top" style="border: none; padding: 6px;">
      <h4>♿ Accessibility</h4>
      <p style="font-size: 0.9em; line-height: 1.4;">Hardened patterns (accessible error announcements, keyboard focus management).</p>
    </td>
    <td width="33%" valign="top" style="border: none; padding: 6px;">
      <h4>🤖 Built-in AI</h4>
      <p style="font-size: 0.9em; line-height: 1.4;">Local client models (native translation, summarization, and language detection APIs).</p>
    </td>
  </tr>
</table>

_View an example:_ [the `navigation-drawer` guide](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/navigation-drawer.md).

#### The full list

<details>
<summary><strong>102 modern web features</strong></summary>

### CSS & Layout (51 features)

| | | |
| :--- | :--- | :--- |
| [::backdrop](https://web-platform-dx.github.io/web-features-explorer/features/backdrop/) | [Custom highlights](https://web-platform-dx.github.io/web-features-explorer/features/highlight/) | [Scroll snap events](https://web-platform-dx.github.io/web-features-explorer/features/scroll-snap-events/) |
| [:has()](https://web-platform-dx.github.io/web-features-explorer/features/has/) | [field-sizing](https://web-platform-dx.github.io/web-features-explorer/features/field-sizing/) | [Scroll-driven animations](https://web-platform-dx.github.io/web-features-explorer/features/scroll-driven-animations/) |
| [:not()](https://web-platform-dx.github.io/web-features-explorer/features/not/) | [font-size-adjust](https://web-platform-dx.github.io/web-features-explorer/features/font-size-adjust/) | [scroll-initial-target](https://web-platform-dx.github.io/web-features-explorer/features/scroll-initial-target/) |
| [:user-valid and :user-invalid](https://web-platform-dx.github.io/web-features-explorer/features/user-pseudos/) | [image-set()](https://web-platform-dx.github.io/web-features-explorer/features/image-set/) | [scrollbar-color](https://web-platform-dx.github.io/web-features-explorer/features/scrollbar-color/) |
| [@function](https://web-platform-dx.github.io/web-features-explorer/features/function/) | [Individual transform properties](https://web-platform-dx.github.io/web-features-explorer/features/individual-transforms/) | [scrollbar-width](https://web-platform-dx.github.io/web-features-explorer/features/scrollbar-width/) |
| [@starting-style](https://web-platform-dx.github.io/web-features-explorer/features/starting-style/) | [interpolate-size](https://web-platform-dx.github.io/web-features-explorer/features/interpolate-size/) | [scrollend](https://web-platform-dx.github.io/web-features-explorer/features/scrollend/) |
| [accent-color](https://web-platform-dx.github.io/web-features-explorer/features/accent-color/) | [light-dark()](https://web-platform-dx.github.io/web-features-explorer/features/light-dark/) | [scrollIntoView()](https://web-platform-dx.github.io/web-features-explorer/features/scroll-into-view/) |
| [Active view transition](https://web-platform-dx.github.io/web-features-explorer/features/active-view-transition/) | [linear() easing](https://web-platform-dx.github.io/web-features-explorer/features/linear-easing/) | [sibling-count() and sibling-index()](https://web-platform-dx.github.io/web-features-explorer/features/sibling-count/) |
| [Anchor position container queries](https://web-platform-dx.github.io/web-features-explorer/features/container-anchor-position-queries/) | [Masks](https://web-platform-dx.github.io/web-features-explorer/features/masks/) | [sin(), cos(), tan(), asin(), acos(), atan(), and atan2() (CSS)](https://web-platform-dx.github.io/web-features-explorer/features/trig-functions/) |
| [Anchor positioning](https://web-platform-dx.github.io/web-features-explorer/features/anchor-positioning/) | [overflow-clip-margin](https://web-platform-dx.github.io/web-features-explorer/features/overflow-clip-margin/) | [text-box](https://web-platform-dx.github.io/web-features-explorer/features/text-box/) |
| [calc-size()](https://web-platform-dx.github.io/web-features-explorer/features/calc-size/) | [overflow: clip](https://web-platform-dx.github.io/web-features-explorer/features/overflow-clip/) | [text-wrap](https://web-platform-dx.github.io/web-features-explorer/features/text-wrap/) |
| [color-scheme](https://web-platform-dx.github.io/web-features-explorer/features/color-scheme/) | [overlay](https://web-platform-dx.github.io/web-features-explorer/features/overlay/) | [text-wrap: balance](https://web-platform-dx.github.io/web-features-explorer/features/text-wrap-balance/) |
| [Container queries](https://web-platform-dx.github.io/web-features-explorer/features/container-queries/) | [overscroll-behavior](https://web-platform-dx.github.io/web-features-explorer/features/overscroll-behavior/) | [text-wrap: pretty](https://web-platform-dx.github.io/web-features-explorer/features/text-wrap-pretty/) |
| [Container scroll-state queries](https://web-platform-dx.github.io/web-features-explorer/features/container-scroll-state-queries/) | [prefers-color-scheme media query](https://web-platform-dx.github.io/web-features-explorer/features/prefers-color-scheme/) | [transition-behavior](https://web-platform-dx.github.io/web-features-explorer/features/transition-behavior/) |
| [Container style queries](https://web-platform-dx.github.io/web-features-explorer/features/container-style-queries/) | [prefers-contrast media query](https://web-platform-dx.github.io/web-features-explorer/features/prefers-contrast/) | [View transitions](https://web-platform-dx.github.io/web-features-explorer/features/view-transitions/) |
| [content-visibility](https://web-platform-dx.github.io/web-features-explorer/features/content-visibility/) | [prefers-reduced-motion media query](https://web-platform-dx.github.io/web-features-explorer/features/prefers-reduced-motion/) | [view-transition-class](https://web-platform-dx.github.io/web-features-explorer/features/view-transition-class/) |
| [Cross-document view transitions](https://web-platform-dx.github.io/web-features-explorer/features/cross-document-view-transitions/) | [Scroll snap](https://web-platform-dx.github.io/web-features-explorer/features/scroll-snap/) | [Web animations](https://web-platform-dx.github.io/web-features-explorer/features/web-animations/) |

### HTML & DOM (20 features)

| | | |
| :--- | :--- | :--- |
| [:autofill](https://web-platform-dx.github.io/web-features-explorer/features/autofill/) | [Customizable &lt;select>](https://web-platform-dx.github.io/web-features-explorer/features/customizable-select/) | [Invoker commands](https://web-platform-dx.github.io/web-features-explorer/features/invoker-commands/) |
| [&lt;details>](https://web-platform-dx.github.io/web-features-explorer/features/details/) | [Email, telephone, and URL &lt;input> types](https://web-platform-dx.github.io/web-features-explorer/features/input-email-tel-url/) | [moveBefore()](https://web-platform-dx.github.io/web-features-explorer/features/move-before/) |
| [&lt;dialog closedby>](https://web-platform-dx.github.io/web-features-explorer/features/dialog-closedby/) | [Fetch priority](https://web-platform-dx.github.io/web-features-explorer/features/fetch-priority/) | [MutationObserver](https://web-platform-dx.github.io/web-features-explorer/features/mutationobserver/) |
| [&lt;dialog>](https://web-platform-dx.github.io/web-features-explorer/features/dialog/) | [hidden="until-found"](https://web-platform-dx.github.io/web-features-explorer/features/hidden-until-found/) | [Mutually exclusive &lt;details> elements](https://web-platform-dx.github.io/web-features-explorer/features/details-name/) |
| [&lt;link rel="expect">](https://web-platform-dx.github.io/web-features-explorer/features/link-rel-expect/) | [HTML in canvas](https://web-platform-dx.github.io/web-features-explorer/features/canvas-html/) | [Popover](https://web-platform-dx.github.io/web-features-explorer/features/popover/) |
| [&lt;link rel="preload">](https://web-platform-dx.github.io/web-features-explorer/features/link-rel-preload/) | [inert](https://web-platform-dx.github.io/web-features-explorer/features/inert/) | [popover="hint"](https://web-platform-dx.github.io/web-features-explorer/features/popover-hint/) |
| [blocking="render"](https://web-platform-dx.github.io/web-features-explorer/features/blocking-render/) | [Interest invokers](https://web-platform-dx.github.io/web-features-explorer/features/interest-invokers/) |  |

### JavaScript & APIs (31 features)

| | | |
| :--- | :--- | :--- |
| [AbortController and AbortSignal](https://web-platform-dx.github.io/web-features-explorer/features/aborting/) | [LanguageModel](https://web-platform-dx.github.io/web-features-explorer/features/languagemodel/) | [Speculation rules](https://web-platform-dx.github.io/web-features-explorer/features/speculation-rules/) |
| [enterkeyhint](https://web-platform-dx.github.io/web-features-explorer/features/enterkeyhint/) | [Long animation frames](https://web-platform-dx.github.io/web-features-explorer/features/long-animation-frames/) | [Summarizer](https://web-platform-dx.github.io/web-features-explorer/features/summarizer/) |
| [Event timing](https://web-platform-dx.github.io/web-features-explorer/features/event-timing/) | [Navigation API](https://web-platform-dx.github.io/web-features-explorer/features/navigation/) | [SVG](https://web-platform-dx.github.io/web-features-explorer/features/svg/) |
| [Federated credential management](https://web-platform-dx.github.io/web-features-explorer/features/fedcm/) | [navigator.modelContext](https://web-platform-dx.github.io/web-features-explorer/features/navigator-modelcontext/) | [Temporal](https://web-platform-dx.github.io/web-features-explorer/features/temporal/) |
| [Fetch](https://web-platform-dx.github.io/web-features-explorer/features/fetch/) | [Page visibility](https://web-platform-dx.github.io/web-features-explorer/features/page-visibility/) | [Top-level await](https://web-platform-dx.github.io/web-features-explorer/features/top-level-await/) |
| [fetchLater](https://web-platform-dx.github.io/web-features-explorer/features/fetchlater/) | [Page visibility state](https://web-platform-dx.github.io/web-features-explorer/features/page-visibility-state/) | [Translator](https://web-platform-dx.github.io/web-features-explorer/features/translator/) |
| [Form-associated WebMCP attributes](https://web-platform-dx.github.io/web-features-explorer/features/declarative-webmcp/) | [Partitioned cookies](https://web-platform-dx.github.io/web-features-explorer/features/partitioned-cookies/) | [User agent client hints](https://web-platform-dx.github.io/web-features-explorer/features/ua-client-hints/) |
| [inputmode](https://web-platform-dx.github.io/web-features-explorer/features/inputmode/) | [Permissions policy](https://web-platform-dx.github.io/web-features-explorer/features/permissions-policy/) | [Web authentication](https://web-platform-dx.github.io/web-features-explorer/features/webauthn/) |
| [Intersection observer](https://web-platform-dx.github.io/web-features-explorer/features/intersection-observer/) | [Registered custom properties](https://web-platform-dx.github.io/web-features-explorer/features/registered-custom-properties/) | [Web authentication signal methods](https://web-platform-dx.github.io/web-features-explorer/features/webauthn-signals/) |
| [Intl.DurationFormat](https://web-platform-dx.github.io/web-features-explorer/features/intl-duration-format/) | [Resize observer](https://web-platform-dx.github.io/web-features-explorer/features/resize-observer/) |  |
| [Language detector](https://web-platform-dx.github.io/web-features-explorer/features/languagedetector/) | [Scheduler API](https://web-platform-dx.github.io/web-features-explorer/features/scheduler/) |  |

</details>

<details>
<summary><strong>128 real-world developer use cases</strong></summary>

<h3>accessibility</h3>

- **[accessible-error-announcement](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/accessibility/accessible-error-announcement.md)**: Synchronize programmatic accessibility states (like aria-invalid) with the visual :user-invalid state to ensure screen reader users receive error feedback only after interaction, mirroring the visual experience.

<h3>built-in-ai</h3>

- **[language-detection](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/built-in-ai/language-detection.md)**: Detect the language of user-generated content or already present site content.
- **[language-model](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/built-in-ai/language-model.md)**: Run on-device natural language inference in the browser using the Prompt API, with streaming output, structured JSON responses, and multi-turn session management.
- **[summarizer](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/built-in-ai/summarizer.md)**: Summarize text content using the on-device Summarizer API.
- **[translator](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/built-in-ai/translator.md)**: Translate text between languages using the on-device Translator API.

<h3>css</h3>

- **[highlight-text-ranges](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/css/highlight-text-ranges.md)**: Highlight arbitrary text ranges on a page such as search results, spelling errors, or collaborative editing cursors.

<h3>forms</h3>

- **[animated-select-picker](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/forms/animated-select-picker.md)**: Create a custom select component whose dropdown is animated. For example, the menu fades or slides into view, or the options animate upon selection.
- **[autofill-address-form](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/forms/autofill-address-form.md)**: Build an address form with correct autocomplete attributes and autofill support.
- **[autofill-highlight-inputs](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/forms/autofill-highlight-inputs.md)**: Use CSS to highlight form fields that have been autofilled by the browser and not edited by the user.
- **[autofill-payment-form](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/forms/autofill-payment-form.md)**: Build a payment form that collects card details with correct autocomplete values and autofill support.
- **[autofill-sign-in-form](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/forms/autofill-sign-in-form.md)**: Build a sign-in form with correct autocomplete values and autofill support.
- **[autofill-sign-up-form](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/forms/autofill-sign-up-form.md)**: Build a sign-up form with correct autocomplete values and autofill support.
- **[brand-consistent-forms](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/forms/brand-consistent-forms.md)**: Match checkboxes, radio buttons, range sliders, and progress bars to your site's color palette without replacing them with custom components.
- **[branded-select-styling](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/forms/branded-select-styling.md)**: Create custom select elements whose button, picker, arrow icon, and checkmark all seamlessly match your brand or design system's typography, colors, spacing, and border treatments.
- **[custom-select-picker-layouts](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/forms/custom-select-picker-layouts.md)**: Create custom select pickers whose options are positioned in unique or interesting ways, rather than the traditional stacked list of options.
- **[form-fields-automatically-fit-contents](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/forms/form-fields-automatically-fit-contents.md)**: Allow form fields to grow and shrink to fit the user input, e.g. as the user types or selects a different option. Apply maximum and minimum size limits to create dynamic and responsive form fields that conform with the page design.
- **[required-field-feedback](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/forms/required-field-feedback.md)**: Provide error message for required form fields that were skipped or left empty *only* after user interaction, to avoid preemptive errors and ensure feedback is timely and contextually relevant to the user's flow.
- **[rich-media-picker](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/forms/rich-media-picker.md)**: Create a custom select component whose options can contain complex HTML formatting (e.g. images, icons, and other rich formatting) rather than just plain text.
- **[select-menu-interaction](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/forms/select-menu-interaction.md)**: Validate that a non-default option has been chosen in a select menu only after the user has interacted with the control.
- **[validate-input-after-interaction](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/forms/validate-input-after-interaction.md)**: Show form field validation feedback (e.g. password complexity or email format requirements) only after the user has finished their initial interaction, avoiding premature errors on page load or while the user is typing.

<h3>passkeys</h3>

- **[passkey-authentication](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/passkeys/passkey-authentication.md)**: Authenticate a returning user with a passkey for primary sign-in.
- **[passkey-conditional-create](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/passkeys/passkey-conditional-create.md)**: Silently register a passkey for an existing user after a successful password login.
- **[passkey-management](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/passkeys/passkey-management.md)**: Let users view and manage the passkeys registered to their account.
- **[passkey-reauthentication](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/passkeys/passkey-reauthentication.md)**: Verify a signed-in user's identity using their existing passkeys before a sensitive action.
- **[passkey-registration](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/passkeys/passkey-registration.md)**: Register a passkey for an existing user account.

<h3>performance</h3>

- **[batch-analytics-events](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/batch-analytics-events.md)**: Debounce and batch multiple analytics events together in a single beacon to minimize network contention and reduce server load, while still delivering real-time updates.
- **[break-up-long-tasks](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/break-up-long-tasks.md)**: Break up heavy synchronous processing (complex computations and/or long loops) or DOM updates, to let the browser handle user input and repaint the screen.
- **[calculate-total-foreground-time](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/calculate-total-foreground-time.md)**: Calculate the total time a user actually spent viewing a page, excluding periods when the tab was in the background.
- **[conditional-async-dependencies](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/conditional-async-dependencies.md)**: Conditionally load or initialize async dependencies (such as importing polyfills for missing web features) without requiring complex orchestration across all of a page's script dependencies.
- **[defer-rendering-heavy-content](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/defer-rendering-heavy-content.md)**: Reduce rendering times in content-heavy web pages (e.g. pages with long feeds, lots of articles, or complex dashboards), by deferring rendering for any content that is not immediately visible to the user.
- **[defer-work-until-scroll-ends](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/defer-work-until-scroll-ends.md)**: Defer expensive operations like DOM updates, data fetching, analytics tracking, or layout recalculation until after scrolling completes to maintain smooth scroll performance.
- **[deprioritize-background-fetches](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/deprioritize-background-fetches.md)**: Deprioritize background data fetches made with the Fetch API to prevent network contention with user-initiated requests.
- **[detect-initial-visibility-state](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/detect-initial-visibility-state.md)**: Reliably determine whether a page was initially loaded in the background, even in cases where the script is loaded asynchronously after the user foregrounded the page.
- **[efficient-background-processing](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/efficient-background-processing.md)**: Conserve system resources and battery life by pausing background JavaScript execution (such as `&lt;canvas&gt;` animations, WebGL rendering, or high-frequency WebSocket data polling) when the component is off-screen and then resume them just-in-time when they scroll back into view.
- **[faster-spa-view-transitions](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/faster-spa-view-transitions.md)**: Enable faster transitions back to previously visited views in a Single-Page Application (SPA) by preserving their structural DOM state instead of destroying and rebuilding them on every navigation.
- **[full-session-analytics](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/full-session-analytics.md)**: Reliably track analytics, errors, and telemetry data across the user's entire page visit, and defer sending of the data until the user leaves the page.
- **[identify-heavy-scripts](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/identify-heavy-scripts.md)**: Identify the scripts most responsible for long animation frames
- **[identify-inp-causes](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/identify-inp-causes.md)**: Identify slow running JavaScript that is impacting INP metric
- **[improve-next-page-load-performance](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/improve-next-page-load-performance.md)**: Improve page load performance by prefetching or prerendering pages that the user is likely to visit next.
- **[interactions-in-complex-layouts](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/interactions-in-complex-layouts.md)**: Make interactions snappier and more responsive (reducing Interaction to Next Paint (INP) scores) by avoiding layout re-calculations in complex layouts, such as data-heavy dashboards or spreadsheet-style grids.
- **[optimize-image-priority](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/optimize-image-priority.md)**: Optimize the loading priority of Largest Contentful Paint (LCP) candidate images and deprioritize non-critical images to reduce critical resource load delays.
- **[optimize-preload-priority](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/optimize-preload-priority.md)**: Optimize the relative priority of preloaded content to reduce critical resource load delays.
- **[optimize-script-priority](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/optimize-script-priority.md)**: Optimize the loading priority of scripts by boosting critical asynchronous scripts and deprioritizing non-essential or late-body scripts to improve sequencing and reduce delays.
- **[resolution-optimized-pseudo-elements](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/resolution-optimized-pseudo-elements.md)**: Use resolution-optimized images in CSS pseudo-elements (such as `::before` and `::after`) to reduce the number of DOM nodes.
- **[schedule-tasks-by-priority](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/schedule-tasks-by-priority.md)**: Schedule tasks with different priorities to ensure critical work runs first while background work is deferred.
- **[sequence-distributed-events](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/performance/sequence-distributed-events.md)**: Log and sequence operations in distributed microservices or high-throughput tracing environments by recording timestamps with nanosecond resolution.

<h3>privacy</h3>

- **[privacy](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/privacy/privacy.md)**: Action-oriented guidelines for web developers to implement privacy by design, data minimization, third-party audits, and secure data handling. Use this skill when designing applications, integrating third-party services, handling user data, or configuring security headers.

<h3>user-experience</h3>

- **[adapt-scrollbar-to-contrast-preferences](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/adapt-scrollbar-to-contrast-preferences.md)**: Enhance scrollbar visibility for users who prefer high-contrast interfaces
- **[anchor-positioning-tab-underline](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/anchor-positioning-tab-underline.md)**: Transition an element seamlessly between two target element positions. For example, moving a selected tab underline between the previously selected tab and the currently selected tab.
- **[animate-element-entry-exit](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/animate-element-entry-exit.md)**: Smoothly hide/show elements as they are added/removed from the DOM or as their display values are toggled.
- **[animate-to-from-top-layer](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/animate-to-from-top-layer.md)**: Animate elements such as dialogs, popovers, and tooltips as they're entering/exiting the top layer.
- **[animate-to-intrinsic-sizes](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/animate-to-intrinsic-sizes.md)**: Smoothly animate interactive components (like accordions, menus, and expanding cards) to and from their natural dimensions.
- **[apply-webgl-shaders](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/apply-webgl-shaders.md)**: Apply custom visual effects with WebGL shaders to HTML content.
- **[calculate-event-differentials](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/calculate-event-differentials.md)**: Calculate the duration and time remaining between dates and times.
- **[calculate-with-intrinsic-sizes](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/calculate-with-intrinsic-sizes.md)**: Calculate the size of an element based on its intrinsic size, while ensuring it fits within given design constraints.
- **[capture-location-agnostic-data](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/capture-location-agnostic-data.md)**: Record chronological data that should not change based on a user's location, such as birthdates, recurring alarms, or national holidays.
- **[carousel-slide-effects](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/carousel-slide-effects.md)**: Create a carousel of slides with images or other visual elements, where each slide animates as they enter/center/exit their scroller. For example, the slides may fade-in/fade-out, rotate, get bigger or smaller, etc.
- **[carousel-snap-highlights](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/carousel-snap-highlights.md)**: Visually highlight the currently snapped non-interactive item in scroll-snapping carousels, galleries, or full-page swipe experiences. For example, expanding a card when snapped, or revealing hidden content.
- **[child-state-based-styling](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/child-state-based-styling.md)**: Build a component that changes its styling based on the state of one of its child elements. For example, a component that renders in light or dark mode based on whether a theme toggle is checked (or not).
- **[complex-shapes](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/complex-shapes.md)**: Clip elements and their content to any free-form shape, like a symbol, brush stroke, or organic texture for more expressive designs.
- **[component-specific-light-dark-theme](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/component-specific-light-dark-theme.md)**: Force certain elements to be in light mode or dark mode (e.g. code blocks, media players, etc) independently of the page's color-scheme.
- **[consistent-cross-document-transitions](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/consistent-cross-document-transitions.md)**: Ensure critical page state is loaded and stable before initiating a cross-document view transition. This means critical CSS styles are loaded and applied, critical JavaScript is loaded and run, and the HTML visible for the user's initial view of the page has been parsed before the transition runs.
- **[content-based-styling](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/content-based-styling.md)**: Build a component that changes its layout based on whether it contains specific child elements (or not). For example, if the component contains an image, use a multi-column layout, otherwise default to a single-column layout.
- **[coordinate-global-events](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/coordinate-global-events.md)**: Schedule future meetings or events by explicitly binding them to a geographical IANA time zone so that event times remain accurate regardless of Daylight Saving Time (DST) transitions, "skipped" or "repeated" hours during clock changes.
- **[cross-document-transitions](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/cross-document-transitions.md)**: Create smooth, seamless transitions between full page navigations, such as cross-fades, custom reveal effects, or morphing of content from one page to the next.
- **[customize-scrollbar-color-and-thickness](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/customize-scrollbar-color-and-thickness.md)**: Customize the color or thickness of a scrollbar
- **[dark-mode](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/dark-mode.md)**: Implement dark mode support in a way that respects the user's light/dark theme preference and adapts browser UI (e.g. scrollbars, form controls, etc)
- **[declarative-button-actions](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/declarative-button-actions.md)**: Declaratively connect a button to any element to trigger custom, application-specific actions using declarative button commands, invoker commands, button commands, custom commands, or declarative toggle actions.
- **[declarative-dialog-popover-control](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/declarative-dialog-popover-control.md)**: Toggle the visibility of a dialog or popover from a button without writing JavaScript.
- **[deliver-optimized-decorative-images](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/deliver-optimized-decorative-images.md)**: Deliver optimized decorative images (such as backgrounds, UI icons, or complex masks) by simultaneously providing next-generation image formats (like AVIF or WebP) alongside multiple pixel densities (like 1x and 2x) so the browser can dynamically negotiate the best combination of file size and visual quality for the user's device capabilities.
- **[design-token-reactivity](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/design-token-reactivity.md)**: Define higher-order design tokens, like density modes (compact, comfortable, spacious) or themes and have descendant components react to changes directly and in component-appropriate ways.
- **[directional-navigation-transitions](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/directional-navigation-transitions.md)**: Animate visual state changes to reflect the direction of a user's navigational flow, such as sliding new content in from the right when advancing forward or from the left when returning to a previous screen.
- **[dynamic-sibling-animations](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/dynamic-sibling-animations.md)**: Stagger animation or transition timing across sibling elements so each one starts after a computed delay based on its position in the sibling list.
- **[dynamic-sibling-styling](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/dynamic-sibling-styling.md)**: Create dynamic visual spectrums or layout arrangements that automatically adapt to the number of elements in a group.
- **[export-html-media-from-canvas](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/export-html-media-from-canvas.md)**: Capture and export dynamic HTML content as images or video frames from within canvas.
- **[expose-canvas-content-to-browser-features](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/expose-canvas-content-to-browser-features.md)**: Expose content rendered in a canvas to browser features like assistive technologies, translation, or reading mode.
- **[flicker-free-client-side-ab-testing](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/flicker-free-client-side-ab-testing.md)**: Deliver and render A/B tests, multi-variate tests, or other experiments using client-side JavaScript to alter or inject HTML, CSS, and JavaScript without the original content showing first before flickering or flashing to show the experiment content.
- **[fluid-scaling](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/fluid-scaling.md)**: Scale items like font size, spacing, and media sizes smoothly based on the parent container's size rather than using fixed breakpoints
- **[format-human-readable-durations](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/format-human-readable-durations.md)**: Present elapsed time or durations to users in a readable, localized format, with the flexibility to display either detailed unit breakdowns (e.g., "1 hour and 30 minutes") or total unit counts (e.g., "90 minutes") depending on context.
- **[group-element-transitions](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/group-element-transitions.md)**: Transition a group of similar elements simultaneously using the same transition logic, such as removing a product from a shopping cart and having all the other products animate into their new positions.
- **[improve-text-layout-and-legibility](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/improve-text-layout-and-legibility.md)**: Improve the layout and legibility of short standalone text content, such as headings no longer than a few lines, by enabling the browser to apply evenly balanced line breaks when wrapping text.
- **[individual-transform-properties](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/individual-transform-properties.md)**: Animate or override individual CSS transform properties (e.g. translate, rotate, scale) independently of other transform properties on a single element.
- **[interactive-content-in-3d-scenes](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/interactive-content-in-3d-scenes.md)**: Integrate interactive HTML elements into a 3D scene.
- **[interactive-content-reveal](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/interactive-content-reveal.md)**: Create interactive reveal effects, such as a spotlight that follows the user's pointer to uncover details within an image or UI section.
- **[interest-triggered-action-previews](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/interest-triggered-action-previews.md)**: Show a live preview of a button's effect when a user signals interest (e.g. hovering, focusing, or long-pressing) but before they commit to clicking.
- **[interest-triggered-tooltips](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/interest-triggered-tooltips.md)**: Show a tooltip or supplemental information when a user hovers over, focuses on, or long-presses an interactive element, without requiring a click.
- **[light-dismiss-a-dialog](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/light-dismiss-a-dialog.md)**: Create a modal dialog that can be closed via light dismiss (i.e. clicking or tapping outside of the dialog)
- **[manage-recurring-intervals](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/manage-recurring-intervals.md)**: Calculate recurring intervals for subscription billings or payroll cycles, automatically adjusting for edge cases such as month-end transitions (e.g., adding one month to January 31st) to ensure accurate period calculations.
- **[model-partial-time-concepts](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/model-partial-time-concepts.md)**: Model date and time concepts that inherently lack a standard component (such as a specific year, day, or date) without using arbitrary placeholder values that introduce calculation errors.
- **[move-dom-element-without-losing-state](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/move-dom-element-without-losing-state.md)**: Move or reparent a DOM element without losing important element state, such as interactivity states (:focus/:active), &lt;iframe&gt; loading state, animation/transition state, etc
- **[navigation-drawer](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/navigation-drawer.md)**: Create a navigation drawer component that, when triggered from a menu button, slides in from the side overlayed on top of existing page content, and slides out when dismissed (by swiping away, tapping outside, or pressing escape).
- **[overflow-clipping-control](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/overflow-clipping-control.md)**: Adjust the visible clipping boundary of an element to align with the content edge, padding edge, or border edge—or a specified offset from any of these—offering finer-grained control over how content is clipped.
- **[parallax-scroll-effects](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/parallax-scroll-effects.md)**: Create scroll-based effects (such as parallax) where foreground and background layers move at different rates, creating a sense of depth as the user scrolls.
- **[persistent-app-tours](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/persistent-app-tours.md)**: Create persistent onboarding walkthroughs using tethered native overlays that stay open during user interaction.
- **[persistent-toast-notifications](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/persistent-toast-notifications.md)**: Create non-intrusive toast and overlay notifications for persistent, stackable messaging and state communication.
- **[persistent-top-layer-ui](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/persistent-top-layer-ui.md)**: Keep a modal dialog, fullscreen element, or native popover visibly open and functionally active when its underlying DOM node is moved or reparented in the DOM.
- **[physics-based-easing](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/physics-based-easing.md)**: Create custom, physics-based animation and transition effects, like bounce and spring, that feel more natural and engaging than traditional easing curves.
- **[platform-controls-dismiss-dialog](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/platform-controls-dismiss-dialog.md)**: Create a modal dialog that can be closed via standard platform-specific user actions, such as pressing the `Esc` key on desktop platforms, or a "back" or "dismiss" gesture on mobile platforms
- **[position-aware-tooltips](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/position-aware-tooltips.md)**: Build tooltips and popovers with directional arrows (or other visual styling) that automatically point the correct way when the element flips to a fallback position.
- **[precise-text-alignment](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/precise-text-alignment.md)**: Achieve precise vertical alignment with text of any font. For example, exactly equal visual padding above and below text, or aligning text perfectly flush with adjacent icons or images.
- **[prevent-text-wrapping](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/prevent-text-wrapping.md)**: Ensure the browser does not insert line breaks into text and will allow text to overflow its container.
- **[pull-to-reveal](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/pull-to-reveal.md)**: Build a pull-to-reveal feature that would enable the user to pull down on the screen to reveal more content, like a search bar.
- **[reduce-style-repetition](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/reduce-style-repetition.md)**: Reduce excessive style repetition by encapsulating complex or dynamic styling logic into reusable functions (such as a function that computes a gradient based on a set of input parameters).
- **[resilient-context-menus-and-nested-dropdowns](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/resilient-context-menus-and-nested-dropdowns.md)**: Build accessible, responsive menus, tooltips, dropdowns, or contextual overlays that must be tethered to specific UI elements, guaranteeing that the overlay automatically repositions itself (e.g., flipping axes) when it encounters viewport edges, ensuring it never gets cut off.
- **[same-document-transitions](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/same-document-transitions.md)**: Visually connect persisting elements across different page states or navigations in a Single Page Application (SPA) (e.g. expanding a product thumbnail into a full-bleed hero image) by smoothly morphing their size, position, or other styling properties.
- **[scroll-entry-exit-effects](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/scroll-entry-exit-effects.md)**: Create fade-in, scale-up, or other complex reveal-type effects on elements as they enter and exit the scrollport (or viewport) while the user is scrolling.
- **[scroll-position-aware-elements](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/scroll-position-aware-elements.md)**: Build floating buttons or widgets (back-to-top, scroll-to-bottom, chat launchers, etc.) that appear and disappear based on whether the user has scrolled at all.
- **[scroll-progress-indicator](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/scroll-progress-indicator.md)**: Create a scroll progress bar, stepped progress tracker, or any visual affordance that communicates how far through a page or section the user has scrolled.
- **[scroll-snap-realtime-feedback](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/scroll-snap-realtime-feedback.md)**: Provide real-time visual feedback in linked UI elements while a user scrolls through snap-aligned content, before the scroll gesture completes.
- **[scroll-snap-state-sync](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/scroll-snap-state-sync.md)**: Synchronize navigation indicators, linked content panels, and analytics tracking with the actively snapped item in a scrollable container.
- **[scroll-target-on-load](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/scroll-target-on-load.md)**: Build a scrollable list of elements (e.g. a carousel of images or a chat conversation thread) that can be displayed with a particular element scrolled into view on the initial render.
- **[scrollability-affordance-hints](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/scrollability-affordance-hints.md)**: Build scroll-shadow overlays, gradient fades, or directional arrow indicators that appear only when there's actually more content to scroll to in that direction.
- **[scrollytelling](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/scrollytelling.md)**: Animate visual properties on a target element — such as fading a backdrop, shifting a background color, or to create scrollytelling experiences — driven entirely by the scrollport position of a completely different element.
- **[search-hidden-content](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/search-hidden-content.md)**: Hide content from view using patterns such as accordions, tabs, and "Read more" sections, while ensuring the hidden text reveals itself during native "Find in page" searches, allows search engine indexing, supports URL fragment deep links, and maintains ARIA accessibility.
- **[shaped-cutouts](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/shaped-cutouts.md)**: Combine multiple shapes to create complex cutouts or 'knockout' effects in elements, such as adding a notch to an element.
- **[shrinking-header-on-scroll](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/shrinking-header-on-scroll.md)**: Smoothly animate a fixed header or full-page cover on scroll to dynamically shrink, gain shadows, and transform its layout over a predefined scroll distance.
- **[size-aware-styling](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/size-aware-styling.md)**: Build a component whose styles can be conditionally dependent on its own width or height, rather than the width or height of the viewport. For example a card component that can change its layouts depending on how large it is, or a call-to-action button that can conditionally display helper text based on its width.
- **[soft-edge-content-fade](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/soft-edge-content-fade.md)**: Apply a transparency gradient to content edges to indicate further scrollable areas or to obscure payment-walled text.
- **[stabilize-reactive-state](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/stabilize-reactive-state.md)**: Manage task deadlines or schedules in data-driven views without unexpected side effects from shared mutable state.
- **[stack-drill-down](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/stack-drill-down.md)**: Build full-screen hierarchical navigation that lets users drill down into nested views and swipe or navigate back to return, with browser history kept in sync.
- **[style-parent-with-has](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/style-parent-with-has.md)**: Style parent elements of a form field (e.g. labels or fieldsets) when the field is invalid.
- **[support-global-calendar-systems](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/support-global-calendar-systems.md)**: Display and calculate dates in non-Gregorian calendar systems (e.g., Islamic, Hebrew, or Chinese) accurately for international users.
- **[swipe-to-remove](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/swipe-to-remove.md)**: Let users act on items in a list (remove, archive, mark as read, etc.) with a horizontal swipe gesture, so they can process entries quickly without tapping a separate control.
- **[visually-stable-font-fallbacks](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/visually-stable-font-fallbacks.md)**: Define font styles such that text remains readable and visually consistent in the event that there's a swap between the perferred font and one of the fallbacks (or vise versa).
- **[visually-stable-mixed-fonts](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/visually-stable-mixed-fonts.md)**: Define font styles such that text remains readable and visually consistent in situations where multiple fonts are used to render a single block of text.
- **[visually-texture-content](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/user-experience/visually-texture-content.md)**: Apply realistic weathering and texture patterns to elements to give them an organic, aged, or physical material appearance.

<h3>webmcp</h3>

- **[agentic-forms](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/webmcp/agentic-forms.md)**: Expose client-side functionality as tools to AI agents by annotating standard HTML forms with WebMCP attributes.
- **[agentic-javascript-tools](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/webmcp/agentic-javascript-tools.md)**: Programmatically register client-side JavaScript functions as tools for AI agents using the WebMCP Imperative API.
</details>

### Safe Adoption of Modern Features

* **Progressive Enhancement & Nuanced Fallbacks**: We distinguish between purely additive enhancements (like speculative preloading) which are safe to let older browsers silently ignore, and critical behaviors (like dialog controls or network beacons) where we write highly considered, low-overhead fallbacks.
* **Responsible Fallbacks**: We prioritize lightweight, case-specific custom fallbacks (<50 LOC) or conditionally-loaded polyfills instead of heavy third-party bundles.
* **Gotchas & Quirks**: We document hidden platform limitations, such as the 64KB payload quota for `fetchLater()` or macOS-specific scrollbar behaviors.
* **Baseline-Aware Integration**: We leverage real-time compatibility data from the **Baseline** project so agents can dynamically adapt to current browser support and any browser support preferences.

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/cpu.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> How It Works

0. **Activation**: The coding agent activates the `modern-web-guidance` skill because of a relevant task. The agent is instructed to use the `modern-web` CLI for web platform queries.
2. **Local Semantic Search**: The agent runs `modern-web search "<query>"`. The tool matches the query to the best guide using an offline, CPU-efficient TensorFlow.js model (no network calls, no API keys).
3. **Guide Fetch**: The agent retrieves the guide via `modern-web retrieve <guide-id>`, inserting targeted code patterns, gotchas, and fallbacks directly into its context window.

> [!TIP]
> Note: We use `npx` to ensure the content doesn't go stale, but the CLI works offline, completely private and local.
> The NPM package is self-contained, with no extra dependencies to ensure both low-latency and supply-chain security.

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/package.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Alternative Installation Methods

<details>
<summary><b>Vercel Skills CLI</b> (aka <code>npx skills</code>)</summary>

```shell
npx skills add GoogleChrome/modern-web-guidance
```
</details>

<details>
<summary><b>GitHub CLI</b></summary>

```shell
gh skill install GoogleChrome/modern-web-guidance
```
</details>

<details>
<summary><b>Google Antigravity</b></summary>

```shell
agy plugin install https://github.com/GoogleChrome/modern-web-guidance
```
</details>

<details>
<summary><b>GitHub Copilot CLI</b></summary>

```shell
/plugin marketplace add GoogleChrome/modern-web-guidance
/plugin install modern-web-guidance@googlechrome
```
</details>

<details>
<summary><b>Claude Code Plugin</b></summary>

```shell
/plugin marketplace add GoogleChrome/modern-web-guidance
/plugin install modern-web-guidance@googlechrome
/plugin  # Select GoogleChrome marketplace, press enter, enable AutoUpdate
/reload-plugins
```
</details>

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/refresh-cw.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Updating

If you installed the skill using `npx modern-web-guidance@latest install`, you can update with: `npx modern-web-guidance@latest update`.

Otherwise, consult your agent's documentation for updating plugins and skills.

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/shield-check.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Evals to prove this works well ;)

We developed a robust eval harness to ensure that the content is **empirically proven and continuously calibrated** to ensure AI agents write better code.  We run automated evaluations using a closed-loop validation pipeline:

```
  [ Expert-authored guidance and demo ]
            │
            ▼
  [ Generated assets ] ──> Playwright Grader (.spec.ts) & Negative Demo (.html)
            │
            ▼
  [ Calibration loop ] ───────> Runs Grader on Gold-Standard Demo (Must Pass 100%)
            │                   Runs Grader on Negative Demo (Must Fail 100%)
            ▼
  [ E2E agent evals ] ────────> Runs coding agents in guided vs. unguided modes
                                Compares accuracy w/ and w/o the skill
```

0. **Simulated Developer Tasks**: We define realistic, developer prompts that mimic real-world requests (e.g., "make my images load faster"). The prompts avoid naming APIs or features, testing whether the agent can successfully discover the relevant guides naturally.
1. **Browser-based Assertions**: We write browser automation scripts that verify the guide was followed correctly: exact runtime behaviors, computed styles, accessibility states, etc.
2. **Self-Healing Calibration**: Graders are calibrated against both a reference implementation (100% pass target) and a control page (0% pass target). The agent automatically refines tests on failure.
3. **E2E Testing**: We measure coding agent performance on real tasks with and without guidance. The _opportunity_ (100% - unguided pass rate) and _uplift_ (guided - unguided pass rate) are key. If there's little opportunity, then models already do a great job and our guidance isn't providing much value. Based on the results, we revise guides to maximize the uplift, optimizing their effectiveness.

### Recent eval results snapshot

| Date | Agent + Model | Tasks / Assertions | Unguided → Guided (Uplift) |
| :--- | :--- | :---: | :---: |
| May 18 | claude_code (opus-4-7) | 75 / 603 | 52% → 85% (**+33pp**) |
| May 17 | claude_code (opus-4-7) | 75 / 603 | 54% → 85% (**+31pp**) |
| May 16 | codex_cli (gpt-5.5) | 75 / 603 | 49% → 82% (**+33pp**) |
| May 16 | claude_code (opus-4-7) | 75 / 603 | 51% → 86% (**+35pp**) |
| May 15 | codex_cli (gpt-5.5) | 74 / 600 | 52% → 81% (**+29pp**) |
| May 15 | claude_code (opus-4-7) | 74 / 600 | 53% → 82% (**+29pp**) |
| May 15 | antigravity | 74 / 600 | 47% → 91% (**+44pp**) |
| May 14 | antigravity | 68 / 554 | 47% → 91% (**+44pp**) |
| Apr 30 | claude_code (opus-4-6) | 66 / 516 | 44% → 81% (**+37pp**) |
| Apr 28 | claude_code (opus-4-6) | 66 / 524 | 41% → 77% (**+36pp**) |


## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/boxes.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Available Skill Packs

You can customize which skill packs are installed using the `--choose` flag:

```shell
npx modern-web-guidance@latest install --choose
```

* **`modern-web-guidance`** (~234 tokens): Comprehensive guidance on modern browser APIs, layouts, and performance.
* **`chrome-extensions`** (~181 tokens): Guidance on Manifest V3, background workers, extension APIs, and Chrome Web Store publishing.

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/lock.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Telemetry & Privacy

Google collects anonymous usage statistics (such as search queries, guide retrievals, and installation) to improve the reliability, relevance, and performance of the tool. You can inspect what is collected in [modern-web.ts](https://github.com/GoogleChrome/modern-web-guidance-src/blob/main/serving/bin/modern-web.ts).

> [!TIP]
> **To Opt-Out:**, set the `DISABLE_TELEMETRY=1` env variable in your shell profile (e.g., `.bashrc` or `.zshrc`):
> ```bash
> export DISABLE_TELEMETRY=1
> ```

Google handles this data in accordance with the [Google Privacy Policy](https://policies.google.com/privacy).

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/users.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Contributors

If you'd like to contribute to modern-web-guidance, please see [source repo's `CONTRIBUTING.md`](https://github.com/GoogleChrome/modern-web-guidance-src/blob/CONTRIBUTING.md). The `modern-web-guidance` repo is a purely a publish target for clean skills installation.

Huge thanks to everyone who has contributed!

<a href="https://github.com/GoogleChrome/modern-web-guidance-src/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=GoogleChrome/modern-web-guidance-src&max=101" />
</a>

## <img src="https://github.com/GoogleChrome/modern-web-guidance/raw/main/.github/img/file-text.svg" width="24" height="24" style="vertical-align: middle; margin-right: 4px;"> Attribution

Portions of the documentation in this project are derived from [MDN Web Docs](https://developer.mozilla.org/) by Mozilla Contributors and [W3C](https://www.w3.org/), [WHATWG](https://whatwg.org), and [IETF](https://www.ietf.org) specifications.
