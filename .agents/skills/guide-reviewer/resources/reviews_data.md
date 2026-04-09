# PR Reviews Archive

## PR #511: create guide and evals for improve body text layout and legibility guide

### Reviews

#### **malchata** (CHANGES_REQUESTED)
> I think once these changes are applied, I can give a quick approval on this. Good work on this, @dvdherron!

#### **rviscomi** (APPROVED)
> LGTM modulo @malchata's comments

### Comments

#### **malchata** on `guides/user-experience/improve-body-text-layout-and-legibility/guide.md`
> This instance of `MANDATORY:` is followed by a description of the behavior, rather than an imperative thing.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+```css
+/* Apply to paragraphs to prevent orphaned words */
+p {
+  /* MANDATORY: Enables pretty line-breaking logic */
```

</details>

#### **malchata** on `guides/user-experience/improve-body-text-layout-and-legibility/guide.md`
> ```suggestion
>   /* MANDATORY: Enable pretty line-breaking logic */
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+```css
+/* Apply to paragraphs to prevent orphaned words */
+p {
+  /* MANDATORY: Enables pretty line-breaking logic */
```

</details>

#### **malchata** on `guides/user-experience/improve-body-text-layout-and-legibility/guide.md`
> ```suggestion
>    /* MANDATORY: Enable pretty line-breaking logic */
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+/* Also effective for other multi-line text elements */
+blockquote, li, .pretty-text {
+   /* MANDATORY: Enables pretty line-breaking logic */
```

</details>

#### **malchata** on `guides/user-experience/improve-body-text-layout-and-legibility/guide.md`
> I wonder if it would be more helpful for agents to break this into a list of elements.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Implementation steps
+
+1.  **Identify long-form text elements**: Select paragraphs (`p`), blockquotes, list items, or other long text blocks where orphaned words (runts) or poor line breaks are most noticeable.
```

</details>

#### **malchata** on `guides/user-experience/improve-body-text-layout-and-legibility/guide.md`
> ```suggestion
> 1.  **Identify long-form text elements**: Select elements potentially containing long runs of text where orphaned words (runts) or poor line breaks are most noticeable. This includes the following elements:
>   - `<p>`
>   - `<blockquote>`
>   - `<li>`
>   - Any other element potentially containing long runs of text.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Implementation steps
+
+1.  **Identify long-form text elements**: Select paragraphs (`p`), blockquotes, list items, or other long text blocks where orphaned words (runts) or poor line breaks are most noticeable.
```

</details>

#### **malchata** on `guides/user-experience/improve-body-text-layout-and-legibility/guide.md`
> Being a big of a performance nerd, I hadn't considered this, but wonder if it's really that much more noticeably expensive. Either way, I think we can rephrase the bit after `MANDATORY:` though, because it's not clear what is actually mandatory until we get to the next sentence which reads "Avoid applying it globally..."

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Key constraints
+
+*   **Performance vs. Quality**: MANDATORY: `text-wrap: pretty` is more computationally expensive than the default `wrap` (greedy) algorithm because it evaluates multiple lines (typically the last four) to optimize the break points. Avoid applying it globally to every element if your page has an extreme amount of text content.
```

</details>

#### **malchata** on `guides/user-experience/improve-body-text-layout-and-legibility/guide.md`
> ```suggestion
> *   **Performance vs. Quality**: MANDATORY: DO NOT apply `text-wrap: pretty` globally to every element on the page, because it evaluates multiple lines (typically the last four) to optimize the break points, which can affect page rendering performance.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Key constraints
+
+*   **Performance vs. Quality**: MANDATORY: `text-wrap: pretty` is more computationally expensive than the default `wrap` (greedy) algorithm because it evaluates multiple lines (typically the last four) to optimize the break points. Avoid applying it globally to every element if your page has an extreme amount of text content.
```

</details>

---

## PR #509: Add guidance for `move-dom-element-without-losing-state`

### Reviews

#### **malchata** (APPROVED)
*(No review body)*

---

## PR #508: Guide: subgrid

### Reviews

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/subgrid/guide.md`
> @paulirish I'm curious, did the agent choose this name, or was it part of some generation task you specified? I ask because we've previously been avoiding mentioning the feature name in the use case (name or description), and I wonder if this needs to be clearer in the skills.
> 
> For this one, I think a better name would be something like `align-nested-grids` or `align-nested-grid-items`.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,82 @@
+---
+name: subgrid
```

</details>

#### **philipwalton** on `guides/user-experience/subgrid/guide.md`
> Ahhh, OK, it looks like this is defined here: https://github.com/GoogleChrome/guidance/blob/a745576207060f212d02cdb569953ab36fd45c70/guides/guide-gen.ts#L365
> 
> I think we want the slug to be generated as well from the use case name.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,82 @@
+---
+name: subgrid
```

</details>

---

## PR #503: #253 precise-text-alignment

### Reviews

#### **malchata** (APPROVED)
> Small changes. I'll approve to unblock in case these are not major issues, though, but the guide LGTM overall.

#### **rviscomi** (APPROVED)
*(No review body)*

### Comments

#### **malchata** on `guides/user-experience/precise-text-alignment/guide.md`
> ```suggestion
> ### Fallback strategies
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- **DO** combine with `line-height` for controlled spacing. Trimming removes the leading before the first and last line of text, but `line-height` still affects the distance between lines in multi-line text.
+- **DO NOT** apply to every element. Use it only where precision alignment is a requirement.
+
+## Fallback Strategies
```

</details>

#### **malchata** on `guides/user-experience/precise-text-alignment/guide.md`
> Gemini suggests adding `**DO**`, `**DO NOT**`, or `**MANDATORY**` to code comments, but I do recall @rviscomi saying that may not be necessary. IMO, I don't think it's needed here, but Gemini keeps calling these kinds of things out.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  /* 
+    Trims the top to the cap-height and 
+    the bottom to the alphabetic baseline.
+  */
```

</details>

#### **malchata** on `guides/user-experience/precise-text-alignment/guide.md`
> This seems a bit at odds with the CSS in some of the examples, which use `text-box-trim` and `text-box-edge` explicitly.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Best Practices
+
+- **DO** use the `text-box` shorthand for conciseness: `text-box: <trim-direction> <edges>`.
```

</details>

---

## PR #501: docs: add guide and evals for `animate-element-entry-exit`

### Reviews

#### **malchata** (CHANGES_REQUESTED)
> Some comments to consider, but I do think some of these need to be changed. Gemini did suggest a number of these, and they seem sensible from my perspective.

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (APPROVED)
> LGTM after some fine tuning
> 
> - I updated the prompt to specify the same IDs and class names the grader expected from the demo.
> - Rewrote a chunk of the grader to use a more reliable animation spy rather than timeouts to remove flakiness

#### **malchata** (APPROVED)
*(No review body)*

### Comments

#### **malchata** on `guides/user-experience/animate-element-entry-exit/negative-demo.html`
> More a question for @rviscomi and @philipwalton—I see a lot of the generated demos use non-semantic HTML elements for containers. For example, I've seen `<div>` used as a main page container where `<main>` would be better. Is this something that the accessibility agent skill would be looking for?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+    </div>
+  </div>
+
+  <div class="demo-section">
```

</details>

#### **malchata** on `guides/user-experience/animate-element-entry-exit/negative-demo.html`
> Also noting that I posted this comment on the negative demo, where it probably wouldn't really matter (or even be used as future eval criteria for a "bad" demo), but the question still stands :)

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+    </div>
+  </div>
+
+  <div class="demo-section">
```

</details>

#### **malchata** on `guides/user-experience/animate-element-entry-exit/guide.md`
> @rviscomi ,the agent skill insists on this being a level 3 heading, but I don't think that would make sense here, because why would we want to nest it under `## Constraints & Accessibility` if fallback strategies were an entirely separate concern?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- **DO**: Respect user preferences for reduced motion using the `prefers-reduced-motion` media query.
+- **DO NOT**: Rely on `@starting-style` for exit animations; it only defines the *starting* point for an entry transition. Exit animations are defined by the transition to the hidden state.
+
+## Fallback strategies
```

</details>

#### **malchata** on `guides/user-experience/animate-element-entry-exit/guide.md`
> Using `prefers-reduced-motion` is mentioned here, but not shown in action in the code snippets in this guide.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- **MANDATORY**: Use `allow-discrete` (either via `transition-behavior: allow-discrete` or the `allow-discrete` keyword in the `transition` shorthand) when transitioning `display`. Without it, the element will instantly disappear during exit.
+- **MANDATORY**: Use `@starting-style` for entry animations. Browsers skip transitions on an element's first style update (initial render or `display: none` change) unless this is provided.
+- **DO**: Include `overlay` in the `transition` list if animating top-layer elements like `<dialog>` or `popover` to ensure they stay in the top layer during the exit animation.
+- **DO**: Respect user preferences for reduced motion using the `prefers-reduced-motion` media query.
```

</details>

#### **malchata** on `guides/user-experience/animate-element-entry-exit/demo.html`
> `prefers-reduced-motion` is also not used in the demo—if this was generated, maybe modify your generation criteria to explicitly mention this, particularly if it's an accessibility constraint.

#### **malchata** on `guides/user-experience/animate-element-entry-exit/guide.md`
> I think using `CSS.supports()` is worth considering.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+### Manual Entry Animation (JS Fallback)
+
+```javascript
```

</details>

#### **rviscomi** on `guides/user-experience/animate-element-entry-exit/negative-demo.html`
> No it doesn't matter. The demo files are only used for calibrating the grader. See https://github.com/GoogleChrome/guidance/blob/main/.agents/skills/project-guides/SKILL.md for more info

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+    </div>
+  </div>
+
+  <div class="demo-section">
```

</details>

#### **rviscomi** on `guides/user-experience/animate-element-entry-exit/guide.md`
> Yeah, the skill hardcodes the H3 level, so it should be relaxed
> 
> > You **MUST** include a `### Fallback strategies` section regardless of Baseline status, as developers may have older baseline targets.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- **DO**: Respect user preferences for reduced motion using the `prefers-reduced-motion` media query.
+- **DO NOT**: Rely on `@starting-style` for exit animations; it only defines the *starting* point for an entry transition. Exit animations are defined by the transition to the hidden state.
+
+## Fallback strategies
```

</details>

---

## PR #498: Guide and evals for `format-human-readable-durations` use case for temporal

### Reviews

#### **malchata** (COMMENTED)
*(No review body)*

#### **malchata** (CHANGES_REQUESTED)
*(No review body)*

### Comments

#### **malchata** on `guides/user-experience/format-human-readable-durations/guide.md`
> ```suggestion
> ## Fallback strategies
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+*   **DO NOT** rely on `Temporal.Duration.prototype.toString()` for user-facing text; it returns ISO 8601 strings (e.g., `PT1H30M`).
+*   **DO** use feature detection and a polyfill for environments lacking native support.
+
+## Fallback Strategy
```

</details>

#### **malchata** on `guides/user-experience/format-human-readable-durations/guide.md`
> Total nit, but Gemini complains if you don't do it like this.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+*   **DO NOT** rely on `Temporal.Duration.prototype.toString()` for user-facing text; it returns ISO 8601 strings (e.g., `PT1H30M`).
+*   **DO** use feature detection and a polyfill for environments lacking native support.
+
+## Fallback Strategy
```

</details>

#### **malchata** on `guides/user-experience/format-human-readable-durations/guide.md`
> I know this use case was already settled, but it mentions a "localized" format, but should this be dropped? Otherwise you might want to consider adding `Intl.DurationFormat` to this guide. If you do, you'll need to:
> 
> - Add `intl-duration-format` to `web-feature-ids`.
> - Add a link to the MDN docs for `Intl.DurationFormat` in `sources`.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -3,4 +3,71 @@ name: format-human-readable-durations
 description: Present elapsed time or durations to users in a readable, localized format, with the flexibility to display either detailed unit breakdowns (e.g., "1 hour and 30 minutes") or total unit counts (e.g., "90 minutes") depending on context.
```

</details>

#### **malchata** on `guides/user-experience/format-human-readable-durations/guide.md`
> Should these have imperative language? e.g., `**DO**`, `**DO NOT**`, `**MANDATORY**`?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+1.  **Create a Duration**: Use `Temporal.Duration.from()` to create a duration object from a set of units.
+2.  **Apply Balancing**: Use the `round()` method with the `largestUnit` option to control how units are balanced. For example, to convert 90 minutes into hours and minutes, or to keep it as total minutes.
+3.  **Build the Display String**: Access the specific unit properties (like `.hours`, `.minutes`) to construct the human-readable string.
```

</details>

#### **malchata** on `guides/user-experience/format-human-readable-durations/guide.md`
> Manually handling pluralization and joining units manually seems kinda brittle, and I think is well-served by `Intl.DurationFormat`.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+## Strategic Implementation & Best Practices
+
+*   **DO** use `Temporal.Duration.round()` with `largestUnit` to control the display strategy (detailed breakdown vs total count).
+*   **DO** handle pluralization and joining of units manually or with external helpers, as `Temporal.Duration` does not provide localized string formatting.
```

</details>

---

## PR #497: docs: add guides and evals for `light-dismiss-a-dialog`

### Reviews

#### **malchata** (DISMISSED)
*(No review body)*

#### **rviscomi** (APPROVED)
> LGTM with a few changes, also addressing @malchata's feedback
> 
> > Pass Rate - Unguided: 63%, Guided: 100% 🎉 
> 
> I asked Gemini to summarize what I changed:
> 
> ---
> 
> #### 1. **Explicit Class Name Requirement (`tasks/task.md`, `demo.html`, `negative-demo.html`)**
> - **Change**: Replaced the fragile text-based trigger locators with a standardized class requirement (`.test-dialog-trigger`). 
> - **Why**: Avoids brittle regex-based button matching (like checking for `"Open (Wrongly)"` or `"Logout"`). This ensures the grader reliably identifies the trigger across positive demos, negative demos, and live base-app evaluation runs without relying on context-dependent text labels.
> 
> #### 2. **Robust Grader Targeting (`grader.ts`)**
> - **Change**: Updated all Playwright `page.locator` queries for the open button to strictly target `.test-dialog-trigger`.
> - **Why**: Keeps the test suite clean and unified, allowing tests to run deterministically regardless of which app or demo environment is being evaluated.
> 
> #### 3. **Conditional JavaScript Fallback Alignment (`guide.md`, `expectations.md`)**
> - **Change**: Wrapped the fallback click-listener snippet in the guide with a feature-detection check (`if (!('closedBy' in HTMLDialogElement.prototype))`).
> - **Why**: Aligns the documented guide exactly with the positive `demo.html` implementation. This guarantees that modern browsers always rely on the native declarative `closedby` implementation without attaching redundant custom JavaScript listeners.
> 
> #### 4. **Strict Negative Demo Failure Enforcement (`negative-demo.html`)**
> - **Change**: Refactored the negative demo to disable dialog opening via `e.preventDefault()` and completely removed the `.close()` script string signature.
> - **Why**: Ensures that the negative demo accurately fails all 8 evaluation checks (achieving a perfect 0% pass rate), proving that the test harness is robustly calibrated and will never produce false positives.

### Comments

#### **malchata** on `guides/user-experience/light-dismiss-dialog/guide.md`
> ```suggestion
> ### Styling the Backdrop
> 
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- `closerequest`: Enables "close requests" and developer mechanisms only. This is the default for modal dialogs.
+- `none`: Only developer mechanisms can close the dialog.
+
+### Styling the Backdrop
```

</details>

#### **malchata** on `guides/user-experience/light-dismiss-dialog/guide.md`
> ```suggestion
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+For browsers that do not yet support `closedby`, implement light-dismiss by checking if a click occurred outside the dialog content's boundaries.
+
+### Manual Light-Dismiss
```

</details>

#### **malchata** on `guides/user-experience/light-dismiss-dialog/guide.md`
> More of a nit here than anything, but I think this heading could be removed and be part of the fallback strategies main content, but I don't think it's a dealbreaker.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+For browsers that do not yet support `closedby`, implement light-dismiss by checking if a click occurred outside the dialog content's boundaries.
+
+### Manual Light-Dismiss
```

</details>

#### **malchata** on `guides/user-experience/light-dismiss-dialog/guide.md`
> ```suggestion
> <!-- MANDATORY: Always use showModal(), not show(), to ensure the dialog behaves as a modal with a backdrop -->
> <button onclick="document.getElementById('myDialog').showModal()">Open Dialog</button>
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  </form>
+</dialog>
+
+<button onclick="document.getElementById('myDialog').showModal()">Open Dialog</button>
```

</details>

#### **malchata** on `guides/user-experience/light-dismiss-dialog/guide.md`
> I think having a comment here would add a bit more clarity :)

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  </form>
+</dialog>
+
+<button onclick="document.getElementById('myDialog').showModal()">Open Dialog</button>
```

</details>

#### **malchata** on `guides/user-experience/light-dismiss-dialog/guide.md`
> Does this need to be enclosed in any kind of feature checking code? If so, I'd wrap the relevant parts of this in such a check.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+```javascript
+const dialog = document.querySelector('dialog');
+
+// Fallback for browsers without closedby support
```

</details>

#### **malchata** on `guides/user-experience/light-dismiss-dialog/guide.md`
> In general, I think this snippet would be helped by comments where needed that explains not just what the code does, but why it does it.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+If you only need light-dismiss for browsers without `closedby` support (like Safari as of early 2026), use the following script:
+
+```javascript
```

</details>

---

## PR #495: Guides and evals for `coordinate-global-events` use case for temporal

### Reviews

#### **malchata** (CHANGES_REQUESTED)
*(No review body)*

### Comments

#### **malchata** on `guides/user-experience/coordinate-global-events/guide.md`
> ```suggestion
> ## Fallback strategies
> ```
> 
> Total nit, but Gemini yells about it.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+-   **DO NOT** use `Temporal.PlainDateTime` for global events, as it does not carry time zone information and cannot account for DST changes.
+-   **DO** use `.withTimeZone()` to calculate the equivalent time in other locations without mutating the original object (Temporal objects are immutable).
+
+## Fallback Strategy
```

</details>

#### **malchata** on `guides/user-experience/coordinate-global-events/guide.md`
> (It mandates it to be an level three heading as well, but it doesn't make a lot of sense to do so in this context, IMO.)

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+-   **DO NOT** use `Temporal.PlainDateTime` for global events, as it does not carry time zone information and cannot account for DST changes.
+-   **DO** use `.withTimeZone()` to calculate the equivalent time in other locations without mutating the original object (Temporal objects are immutable).
+
+## Fallback Strategy
```

</details>

#### **malchata** on `guides/user-experience/coordinate-global-events/guide.md`
> It's not clear which of these steps are optional, and which aren't. Prefixing these with the usual directives would make that a bit more clear to agents.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+1.  **Create a ZonedDateTime**: Use `Temporal.ZonedDateTime.from()` to create a time-zone-aware date-time object.
+2.  **Handle Ambiguity**: Use the `disambiguation` option to control behavior when a time is ambiguous or does not exist (e.g., during clock changes).
+3.  **Convert Time Zones**: Use `.withTimeZone()` to see the equivalent time in another location.
```

</details>

#### **malchata** on `guides/user-experience/coordinate-global-events/guide.md`
> Gemini suggests removing this an integrating the best practices directly into code comments, but I'm not so sure myself. Wouldn't mind guidance from @rviscomi or @philipwalton here.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+console.log(`Tokyo time: ${tokyoTime.toString()}`);
+```
+
+## Strategic Implementation & Best Practices
```

</details>

---

## PR #494: Guide and evals `capture-location-agnostic-data` use case for temporal

### Reviews

#### **rviscomi** (APPROVED)
> LGTM with a few changes:
> 
> *   **`task.md`**: Merged date and time requests into a **single-line prompt** targeting **`index.html`** (preventing the agent from creating untracked files).
> *   **`grader.ts`**: **Relaxed rigid regex checks** to focus on intent and **removed the broken behavioral test** that looked for non-existent UI elements.
> *   **`expectations.md`**: Removed the legacy `Date` expectation to align with the grader cleanup.
> 
> Unguided: 29%, Guided: 100%

---

## PR #492: Support evals for discipline SKILLs

### Reviews

#### **rviscomi** (COMMENTED)
> I have some doubts about the feasibility of creating a single demo and expectations file per high-level skill that faithfully captures most of the best practices. These skill files tend to cover A LOT of ground.

#### **rviscomi** (COMMENTED)
*(No review body)*

### Comments

#### **rviscomi** on `guides/forms/expectations.md`
> From a quick look, it seems like this is missing a ton of nuance in the skill file. Are we ok not eval'ing most of the guidance?

#### **rviscomi** on `guides/forms/expectations.md`
> Ok SG. If this PR will be more infra-focused I'll remove myself as a reviewer.

---

## PR #491: #234 improve-heading-text-layout-and-legibility

### Reviews

#### **rviscomi** (APPROVED)
*(No review body)*

---

## PR #490: Create guide and evals for declarative-button-actions 

### Reviews

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (APPROVED)
> LGTM
> 
> I just removed the expectation for a status indicator, since that's not something we actually expect coding agents to do in the wild. Just using the polyfill is good enough.
> 
> Evals are passing at 100%
> 
> (BTW unguided evals also 100%, which suggests that maybe agents already have a good enough handle on invoker commands to not need our guidance. We can decide what to do about that later.)

### Comments

#### **rviscomi** on `guides/user-experience/declarative-button-actions/demo.html`
> Since the feature is not yet widely available, the demo should also show the fallback strategy for unsupported browsers

#### **rviscomi** on `guides/user-experience/declarative-button-actions/expectations.md`
> Add any expectations to make sure that the fallbacks are implemented correctly

#### **rviscomi** on `guides/user-experience/declarative-button-actions/grader.ts`
> Update to align with expectations

---

## PR #489: remove duplicate task and combine prompts (dynamic-sibling-styling)

### Reviews

#### **rviscomi** (COMMENTED)
*(No review body)*

### Comments

#### **rviscomi** on `guides/user-experience/dynamic-sibling-styling/tasks/task.md`
> Good catch, I missed that other task file. We can drop this prompt though, I adapted it into the one above.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
 base_app: daily-grind
 ---
 - Use modern CSS to update the existing `.card` elements to also have the class `.spectrum-card` and give them background colors spreading across a spectrum. Also, add a `.fan-container` with 5 loyalty cards with class `.fan-card` that fan out symmetrically, and a `.circle-container` with 6 coffee origin badges with class `.circle-orb` arranged in a circle. MANDATORY: Ensure all implementations are dynamic and will automatically adapt if items are added or removed in the future.
+- Can you style these swatches so each one has a unique hue based on its position in the list? Use the modern CSS sibling-index() and sibling-count() functions and provide a JS fallback for older browsers.
```

</details>

---

## PR #476: Create guide and and evals for prevent-text-wrapping use case

### Reviews

#### **rviscomi** (APPROVED)
> LGTM
> 
> I tried this locally but the negative-demo failed one test, so `gd dev` ended up regenerating the grader file. After that though, the calibration passed and the guided run outperformed the unguided run, so this is good to go.

---

## PR #474: publish all guides. add in form skill

### Reviews

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (APPROVED)
*(No review body)*

### Comments

#### **rviscomi** on `serving/skills-cli/build-dist.ts`
> Why the special case for Forms? There's also a Performance skill as of earlier today.
> 
> Could this be written more generically to take any `guides/*/SKILL.md` file?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
     process.exit(1);
   }
 
+  console.log("Copying forms SKILL.md...");
```

</details>

---

## PR #470: Guide and evals for `calculate-event-differentials` for temporal

### Reviews

#### **rviscomi** (APPROVED)
> LGTM with a couple of changes
> 
> 1. Adjusted the prompt to remove mention of Temporal. I did have to balance that out by hinting the agent "not assume it knows the most modern approach" which is less than ideal. I think it will become obsolete after we have a skill file to teach agents that Temporal exists.
> 
> 2. I made some changes to the use case description so that it didn't specify two narrow applications, and I also removed all of the redundant non-MDN sources. I also removed the fallback strategies for node and global script, since coding agents should be able to adapt the ESM fallback as needed.
> 
> 
> ```
> Agent test results:
>   Base app (pre):    1/12 checks passed (8%)
>   Unguided:          1/12 checks passed (8%)
>   Guided:            10/12 checks passed (83%)
>   Guide impact:      +75% (vs unguided)
> ```

---

## PR #467: 364 Create guide and evals for the dynamic sibling styling use case

### Reviews

#### **rviscomi** (COMMENTED)
> I agree this probably fits better as a single use case.

#### **rviscomi** (APPROVED)
> Applied all of my suggested changes and fine-tuned the evals:
> 
> ```
> Agent test results:
>   Base app (pre):    0/6 checks passed (0%)
>   Unguided:          2/6 checks passed (33%)
>   Guided:            6/6 checks passed (100%)
>   Guide impact:      +67% (vs unguided)
> ```

### Comments

#### **rviscomi** on `guides/user-experience/dynamic-sibling-styling/guide.md`
> Suggest rephrasing to focus more on the use case
> ```suggestion
> description: Create dynamic visual spectrums or layout arrangements that automatically adapt to the number of elements in a group.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
 ---
 name: dynamic-sibling-styling
-description: Stagger animation or transition timing across sibling elements so each one starts after a computed delay based on its position in the sibling list.
+description: Compute visual properties like position, color, or size dynamically for each child element based on how many siblings are present and its position among them.
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-styling/guide.md`
> `sin()` and `cos()` are mentioned and recently widely available, so would be good to include
> ```suggestion
>   - sibling-count
>   - trig-functions
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
-description: Stagger animation or transition timing across sibling elements so each one starts after a computed delay based on its position in the sibling list.
+description: Compute visual properties like position, color, or size dynamically for each child element based on how many siblings are present and its position among them.
 web-feature-ids:
   - sibling-count
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-styling/prompts.md`
> These prompts are phrased in a way that assumes that certain elements in the base app exist, but the `daily-grind` app doesn't have swatches or circular buttons, so the agent would probably struggle and fail the evals.
> 
> If you remove this file and rerun `gd dev` it should automatically generate the file with prompts that fit the base app. Alternatively, you could set the base app to `empty-app` and change the prompt so that the agent is starting from nothing, eg "In index.html, create a minimal CSS demo having 3 swatches with..."

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,3 @@
+- Can you style these swatches so each one has a unique hue based on its position in the list? Use the modern CSS sibling-index() and sibling-count() functions and provide a JS fallback for older browsers.
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-styling/guide.md`
> Nesting isn't widely available yet, so let's flatten this part

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  --count: var(--sibling-count);
+
+  /* 2. Override with native functions ONLY if supported */
+  @supports (top: calc(sibling-index() * 1px)) {
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-styling/guide.md`
> To clarify that `background-color` itself isn't necessarily part of the fallback strategy
> ```suggestion
>   /* 3. Use the computed variables - replace this with your implementation-specific styles */
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+    --count: sibling-count();
+  }
+
+  /* 3. Use the computed variables */
```

</details>

---

## PR #462: Guide and eval for `sequence-distributed-events` use case for temporal

### Reviews

#### **rviscomi** (APPROVED)
> LGTM
> 
> I made a change to the prompt to avoid being overly prescriptive about using Temporal and fallbacks. To get the agent to look for the guide, I added "MANDATORY: The timestamps MUST have nanosecond resolution." which seems to have worked.
> 
> ```
> Agent test results:
>   Base app (pre):    0/7 checks passed (0%)
>   Unguided:          0/7 checks passed (0%)
>   Guided:            6/7 checks passed (86%)
>   Guide impact:      +86% (vs unguided)
> ```

---

## PR #460: Add guide for declaritive-dialog-popover-control 

### Reviews

#### **rviscomi** (APPROVED)
> LGTM
> 
> I committed a change to the prompt to ensure that the agent creates BOTH the dialog and popover elements, as expected by the grader. I've also tidied up the grader so that it doesn't rely on any brittle regexes.
> 
> ```
> Agent test results:
>   Base app (pre):    1/18 checks passed (6%)
>   Unguided:          2/18 checks passed (11%)
>   Guided:            18/18 checks passed (100%)
>   Guide impact:      +89% (vs unguided)
> ```

---

## PR #456: adjust primary skill.md framing with triggers and examples

### Reviews

#### **rviscomi** (COMMENTED)
> If it works, it works. But do you think it might be a little too finely tuned to today's set of use cases (scrolling, forms, etc) and may not trigger for whatever else we come up with in the future? Or is that a known limitation and the plan is to periodically update it with more keywords?

---

## PR #451: Guides and evals for `customizable-select` use cases

### Reviews

#### **rviscomi** (APPROVED)
> LGTM
> 
> - Trimmed the source lists to only the immediately relevant blog post
> - Added `MANDATORY` prefixes to prompts to emphasize the modern parts of the request
> - Added HTML example to the `animated-select-picker` guide
> 
> | Use Case | Guided Pass Rate | Unguided Pass Rate |
> | :--- | :--- | :--- |
> | `animated-select-picker` | 100% (11/11) | 9% (1/11) |
> | `custom-select-picker-layouts` | 89% (8/9) | 11% (1/9) |
> | `rich-media-picker` | 90% (9/10) | 20% (2/10) |
> | `branded-select-styling` | 100% (12/12) | 0% (0/12) |
> 

---

## PR #445: Add skill and build dist on dev

### Reviews

#### **rviscomi** (APPROVED)
*(No review body)*

---

## PR #433: Design Token Demo

### Reviews

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (APPROVED)
> Converted to a minimal demo

### Comments

#### **rviscomi** on `guides/user-experience/design-token-reactivity/demo.html`
> FYI these demo files are only used for calibrating the grader, never shown to developers or their coding agents. So while this is a beautiful demo, it's a bit overkill. See the project-use-cases/SKILL.md for more info:
> 
> https://github.com/GoogleChrome/guidance/blob/15f0bdb87b3d18f52bb6dc2fc7fcbc141afbe8ef/.agents/skills/project-use-cases/SKILL.md#L117-L123
> 
> Gemini suggested this as a minimal implementation of the use case. Could this work?
> 
> ```html
> <!DOCTYPE html>
> <html lang="en">
> <head>
>   <style>
>     .container {
>       --density: compact;
>       /* No container-type required for style queries! */
>     }
> 
>     .item {
>       padding: 1rem;
>       border: 1px solid #ccc;
>     }
> 
>     @container style(--density: compact) {
>       .item {
>         padding: 0.5rem;
>       }
>     }
> 
>     @container style(--density: spacious) {
>       .item {
>         padding: 2.5rem;
>       }
>     }
>   </style>
> </head>
> <body>
>   <div class="container" id="target-container">
>     <div class="item" id="target-item">I react to density</div>
>   </div>
> 
>   <button id="toggle-spacious">Toggle Spacious</button>
> 
>   <script>
>     document.getElementById('toggle-spacious').addEventListener('click', () => {
>       const c = document.getElementById('target-container');
>       const current = getComputedStyle(c).getPropertyValue('--density').trim();
>       c.style.setProperty('--density', current === 'spacious' ? 'compact' : 'spacious');
>     });
>   </script>
> </body>
> </html>
> ```

#### **rviscomi** on `guides/user-experience/design-token-reactivity/demo.html`
> Reading https://github.com/GoogleChrome/guidance/issues/163#issuecomment-4143874400 I think he was mostly just asking for _a_ demo, since it was missing entirely

---

## PR #432: Perf skill

### Reviews

#### **rviscomi** (COMMENTED)
> Thanks! Applied all of your suggestions and made a note to follow up on potential changes needed to the Learn course.

#### **rviscomi** (COMMENTED)
*(No review body)*

### Comments

#### **rviscomi** on `guides/performance/SKILL.md`
> Hmm yeah if it's a best practice that we still stand behind, I'm inclined to keep it and continue refining it to guide coding agents on how to apply it correctly. Does that work?

#### **rviscomi** on `guides/performance/SKILL.md`
> Sounds good!

---

## PR #431: Forms skill and subdir

### Reviews

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

### Comments

#### **rviscomi** on `guides/forms/SKILL.md`
> Done

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
 
 - **DO** use a single field for names.
 - **DO** use `autocomplete="street-address"`.
+- **DO** use free-form textareas for addresses to accommodate global diversity.
```

</details>

#### **rviscomi** on `guides/forms/SKILL.md`
> Done

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -254,47 +256,45 @@ form.addEventListener('submit', (e) => {
 <form action="/checkout" method="POST">
```

</details>

---

## PR #428: Add guide and evals for field-sizing use case

### Reviews

#### **rviscomi** (APPROVED)
> LGTM with a couple of changes

---

## PR #426: Create guides and evals for :has use cases

### Reviews

#### **rviscomi** (APPROVED)
> The guidance looks good, but the evals are the same for both unguided and guided runs. It doesn't seem like the agent used the CLI at all.
> 
> This won't be as much of an issue when we add support for the high-level CSS skills, which include `:has()` so merging this now LGTM and we can fine-tune later as needed.

---

## PR #423: #363 dynamic-sibling-animations

### Reviews

#### **rviscomi** (CHANGES_REQUESTED)
> Ready for `gd dev` to generate prompts and grader

#### **rviscomi** (COMMENTED)
> Ran this locally:
> 
> ```
> Agent test results:
>   Base app (pre):    0/6 checks passed (0%)
>   Unguided:          1/6 checks passed (17%)
>   Guided:            1/6 checks passed (17%)
>   Guide impact:      +0% (vs unguided)
> ```
> 
> Worth a closer look into why the guided checks are so low. Seems like maybe the agent never thought to query the CLI, so the prompt might need to be adjusted.

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (APPROVED)
> Since the guide is in good shape, I'm actually inclined to merge this as-is and follow up on fine-tuning the evals later as needed. Thanks @jamesnw!

### Comments

#### **rviscomi** on `guides/user-experience/dynamic-sibling-animations/guide.md`
> ```suggestion
> Stagger animations provide an interesting effect where multiple ordered elements animate sequentially with a slight delay between each, rather than all animating at once. This technique is often used in lists, galleries, or navigation menus to guide the user's eye and add a polished, rhythmic feel to interactions.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+Stagger animations provide an interesting effect where multiple ordered elements animate
+sequentially with a slight delay between each, rather than all animating
+at once. This technique is often used in lists, galleries, or navigation
+menus to guide the user's eye and add a polished, rhythmic feel to interactions.
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-animations/guide.md`
> ```suggestion
> **MANDATORY:** Respect user preferences by disabling the animation for users who prefer reduced motion. 
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+}
+```
+
+Do respect user preferences by disabling the animation for users who prefer reduced motion. 
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-animations/guide.md`
> IIUC omitting the selector implies CSS nesting, as it's done in demo.html. That's fine for the demo, but the guide should probably expand this out so that it doesn't rely on nesting, which isn't quite widely available yet:
> 
> ```suggestion
> @media (prefers-reduced-motion: reduce){
>   /* Disable animation for users who prefer reduced motion. */
>   #stagger-list > .item {
>     animation: none;
>   }
> }
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+@media (prefers-reduced-motion: reduce){
+  /* Disable animation for users who prefer reduced motion. */
+  animation: none;
+}
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-animations/guide.md`
> ```suggestion
>   animation-delay: calc(sibling-index() * var(--stagger-time));
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+```css
+#stagger-list > .item {
+  animation-delay: calc(var(--sibling-index) * var(--stagger-time));
+  animation-delay: calc(var(sibling-index()) * var(--stagger-time));
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-animations/expectations.md`
> Each expectation should correspond to a single, concrete assertion
> ```suggestion
> * The implementation provides a fallback for older browsers using CSS custom properties.
> * The custom property values start at 1 and increment for each sibling.
> * The fallback is applied conditionally only when `sibling-index()` is not supported.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,4 @@
+* The animation on the first element starts before the animation on the second element.
+* `sibling-index()` is multiplied by a time and used as the `animation-delay`.
+* If a legacy fallback is required, JavaScript checks if `sibling-index()` is supported, and if not, adds a custom property on each sibling element being animated, starting with 1. The `animation-delay` uses this property in its calculation, and a second `animation-delay` uses `sibling-index()`.
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-animations/prompts.md`
> The ideal prompt wouldn't be this prescriptive, to better emulate a developer who isn't necessarily aware of the latest features and best practices. 
> 
> Was this generated or handwritten? (Just asking so we can adjust the generation prompt if needed)

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,4 @@
+- add a 0.4s fade-in animation to the cards in the .grid so they stagger in sequentially. use the css sibling-index() function for the animation-delay multiplied by a 0.1s stagger time. also include a js fallback that sets a --sibling-index variable for older browsers, but make sure to wrap it in a CSS.supports check so it doesn't run if it's not needed. disable the animation entirely if the user prefers reduced motion.
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-styling/guide.md`
> I think the old description actually does a better job of describing the use case that's solved by this guide, which should make it more discoverable and likely to be used by agents. Was there something about it that you didn't like?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
 ---
 name: dynamic-sibling-styling
-description: Stagger animation or transition timing across sibling elements so each one starts after a computed delay based on its position in the sibling list.
+description: Compute visual properties like position, color, or size dynamically for each child element based on how many siblings are present and its position among them.
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-animations/prompts.md`
> Yeah, manually edit for now.
> 
> If useful, I've found this prompt helpful for fine-tuning the task.md:
> 
> >look at task.md. if a coding agent with access to guide.md implements the first prompt, would you expect it follow everything in expectations.md?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,4 @@
+- add a 0.4s fade-in animation to the cards in the .grid so they stagger in sequentially. use the css sibling-index() function for the animation-delay multiplied by a 0.1s stagger time. also include a js fallback that sets a --sibling-index variable for older browsers, but make sure to wrap it in a CSS.supports check so it doesn't run if it's not needed. disable the animation entirely if the user prefers reduced motion.
```

</details>

---

## PR #418: Fix grader-gen errors (typecheck failures, bash syntax)

### Reviews

#### **rviscomi** (APPROVED)
*(No review body)*

---

## PR #415: Add guide content and expectations for transition-between-target-element-positions

### Reviews

#### **rviscomi** (CHANGES_REQUESTED)
> Could you also run `gd dev` to generate the prompts and grader?

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (APPROVED)
*(No review body)*

### Comments

#### **rviscomi** on `guides/user-experience/transition-between-target-element-positions/guide.md`
> ```suggestion
>     border-bottom: .25lh red solid;
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+```css
+ul li.active{
+  @supports not (position-anchor: auto){
+    border-bottom: .25h red solid;
```

</details>

#### **rviscomi** on `guides/user-experience/transition-between-target-element-positions/guide.md`
> ```suggestion
> ## Fallback strategies
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+This is only a visual indicator, and must not be a replacement for setting the appropriate `aria-current="page"` or `aria-selected` aria values.
+
+## Fallbacks
```

</details>

#### **rviscomi** on `guides/user-experience/transition-between-target-element-positions/guide.md`
> ```suggestion
> ul::before{
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+```css
+/*  */
+ul::before{
```

</details>

#### **rviscomi** on `guides/user-experience/transition-between-target-element-positions/expectations.md`
> ```suggestion
> * When `prefers-reduced-motion: reduce` is enabled, there is no animation.
> * When `prefers-reduced-motion: no-preference` is enabled, the underline animates.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+* The underline element's block start edge is positioned below the block end edge of the active tab item.
+* Changing the active page moves the underline element to be positioned underneath the new active tab item.
+* When `prefers-reduced-motion: reduced-motion` is enabled, there is no animation.
+* When `prefers-reduced-motion: reduced-motion` is enabled, the underline animates.
```

</details>

#### **rviscomi** on `guides/user-experience/transition-between-target-element-positions/guide.md`
> So the coding agent doesn't think `red` is mandatory
> 
> ```suggestion
>   @supports not (position-anchor: auto){
>     /* Choose a color appropriate to the app theme. */
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+```css
+ul li.active{
+  @supports not (position-anchor: auto){
```

</details>

#### **rviscomi** on `guides/user-experience/transition-between-target-element-positions/guide.md`
> Yeah, that'd help

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+```css
+ul li.active{
+  @supports not (position-anchor: auto){
```

</details>

---

## PR #414: Add evals for defer-rendering-heavy-content

### Reviews

#### **rviscomi** (APPROVED)
> LGTM

---

## PR #407: Add guide content and expectations for interest-triggered-tooltips

### Reviews

#### **malchata** (COMMENTED)
> Some initial thoughts here.

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **malchata** (CHANGES_REQUESTED)
> Some more comments—since this is my first comprehensive review of a guide, I'd like to get buy-in from @rviscomi or @philipwalton before approving this one to know if I'm on the right track with suggestions. This is shaping up nicely, @jamesnw!

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **malchata** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **malchata** (APPROVED)
*(No review body)*

#### **malchata** (APPROVED)
> Unless there are strong objections, I think this is fine!

#### **rviscomi** (APPROVED)
*(No review body)*

### Comments

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> ```suggestion
> The tooltip element must have an `id` attribute with a unique value:
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute, which is a unique idref.
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> Feel free to push back on this (and really anything), but the latter feels more direct and something developers might say. Anecdote: I have only heard "idref" used in relation to specifications.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute, which is a unique idref.
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> Same concern here about usage of "idref", which if we wanted to adopt my earlier suggestion, this would need to be reconciled.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+### Triggering the tooltip
+
+A user expresses interest in the additional information by hovering or focusing on an `<a>` or `<button>` element. The element must have an `interestfor` attribute with the value of the idref of the tooltip.
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/demo.html`
> `import` without an `await` clause won't pause the execution of the rest of the page.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
     <meta charset="utf-8" />
     <title>Interest-Triggered Tooltips</title>
+    <script type="module">
+      import("https://unpkg.com/interestfor");
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/demo.html`
> Similar concern here re: lack of `await` with `import()`.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+    ></script>
+    <script type="module">
+      if (!("anchorName" in document.documentElement.style)) {
+        import("https://unpkg.com/@oddbird/css-anchor-positioning");
```

</details>

#### **rviscomi** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> For each feature/fallback, let's clarify the canonical way to feature detect so the polyfill can be loaded conditionally.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+}
+```
+
+## Fallbacks & Browser Support
```

</details>

#### **rviscomi** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> These two anchor positioning fallback options might benefit from code examples

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+{{ BASELINE_STATUS("anchor-positioning") }}
+
+To support browsers without anchor positioning, provide a fallback by putting the popover in the center of the user's screen. Add a `@supports (anchor-name: auto){}` supports block around the anchor positioning rules on the tooltip so browsers with anchor positioning show the tooltip in the desired location.
```

</details>

#### **rviscomi** on `guides/user-experience/interest-triggered-tooltips/expectations.md`
> ```suggestion
> * Polyfills for interestfor and popover must be conditionally installed.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+* The tooltip is a `<div>`.
+* The tooltip is positioned with anchor positioning, with `position-area` and `position-try`.
+* Anchor positioning rules are inside a `@supports` block.
+* Polyfills for interestfor and popover must be installed.
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> I believe this intersects with my work on #304.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+}
+```
+
+## Fallbacks & Browser Support
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> ```suggestion
> **MANDATORY:** The tooltip element must have an `id` attribute with a unique value:
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute with a unique value:
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> This feedback is from Gemini CLI using appropriate agent skills, but it does feel a bit out of place for me. Wouldn't mind a gut check here from @rviscomi or @philipwalton.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute with a unique value:
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> ```suggestion
> <!-- MANDATORY: The tooltip container `<div>` must have a `popover` attribute.
>      the value of `"hint"` ensures it can be "light dismissed". -->
> <div popover="hint" id="tooltip">Tooltip content</div>
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+The tooltip element must have an `id` attribute with a unique value:
+
+```html
+<div popover="hint" id="tooltip">Tooltip content</div>
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> ```suggestion
> A user expresses interest in the additional information by hovering or focusing on an `<a>` or `<button>` element. **MANDATORY:** The element must have an `interestfor` attribute that matches the `id` attribute of the tooltip.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+### Triggering the tooltip
+
+A user expresses interest in the additional information by hovering or focusing on an `<a>` or `<button>` element. The element must have an `interestfor` attribute that matches the `id` attribute of the tooltip.
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> ```suggestion
> ```html
> <!-- The `interestfor` attribute can be applied to a `<button>` element: -->
> <button interestfor="tooltip">Tooltip trigger</button>
> 
> <!-- The `interestfor` attribute can also be applied to an `<a>` element: -->
> <a interestfor="tooltip" href="">Tooltip trigger</a>
> ```
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+```html
+<a interestfor="tooltip" href="">Tooltip trigger</a>
+```
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> ```suggestion
> ### Fallback strategies
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+}
+```
+
+## Fallbacks & Browser Support
```

</details>

#### **rviscomi** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> I have a pending change to the "MANDATORY" thing in the skill file: 
> 
> https://github.com/GoogleChrome/guidance/blob/ff4fff0b31323a2b0fa0912eee9720b55b9d1528/.agents/skills/project-guides/SKILL.md?plain=1#L49-L50
> 
> So it should really only be used where extra emphasis is needed, especially if we see that the coding agent is failing to adhere to a specific bit of guidance.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute with a unique value:
```

</details>

#### **rviscomi** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> A requirement like this should probably be in both places, but I would omit the "MANDATORY:" part

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+The tooltip element must have an `id` attribute with a unique value:
+
+```html
+<div popover="hint" id="tooltip">Tooltip content</div>
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> I wrestled with this a bit, but the agent skill in Gemini CLI gave this output when I applied it to your guide:
> 
> ```
> 2. Code Snippets (Rule 3)
>    * Missing Comments: The code snippets currently contain zero comments. The guidelines state snippets must be heavily commented.
>    * Directives in Code: You must include directives directly in the code comments (e.g., <!-- MANDATORY: The id must match the interestfor
>      attribute of the trigger -->).
>    * Explain "WHY": The comments must explain why a value or approach is chosen, not just what it does. For example, explain why position-area:
>      block-start is used in the CSS snippet.
> ```
> 
> My sense on this is that guidance _in_ code snippets doesn't feel exactly right, but it doesn't feel exactly wrong. I would defer to @rviscomi or @philipwalton on what they think about this, but I'm not opposed to placing them in code snippets.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+The tooltip element must have an `id` attribute with a unique value:
+
+```html
+<div popover="hint" id="tooltip">Tooltip content</div>
```

</details>

#### **rviscomi** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> Yeah let's just recommend the polyfill approach for a more consistent UI

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+{{ BASELINE_STATUS("anchor-positioning") }}
+
+To support browsers without anchor positioning, provide a fallback by putting the popover in the center of the user's screen. Add a `@supports (anchor-name: auto){}` supports block around the anchor positioning rules on the tooltip so browsers with anchor positioning show the tooltip in the desired location.
```

</details>

---

## PR #402: Evals for `scroll-initial-target` use cases (`pull-to-reveal`, `scroll-target-on-load`)

### Reviews

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **rviscomi** (CHANGES_REQUESTED)
*(No review body)*

#### **rviscomi** (APPROVED)
> I went ahead and applied my own feedback and committed it to the PR.
> 
> | Use Case | Unguided Pass Rate | Guided Pass Rate |
> | :--- | :---: | :---: |
> | **Pull to Reveal** | 33% | 78% |
> | **Scroll Target on Load** | 50% | 100% |

### Comments

#### **philipwalton** on `guides/user-experience/pull-to-reveal/expectations.md`
> Can you elaborate on this change? Why is it a problem to require it to be the first descendant?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -1,5 +1,5 @@
 - The implementation MUST include an ancestor scroll container configured with scrolling (e.g., `overflow-y: auto`) and mandatory snapping (e.g., `scroll-snap-type: y mandatory`).
-- A hidden element (e.g., a search bar) MUST be defined as the first descendant in the scroll container and MUST have `scroll-snap-align: start` applied to it. This element is scrolled out of view on initial load.
+- A hidden element (e.g., a search bar) MUST be one of the descendants in the scroll container and MUST have `scroll-snap-align: start` applied to it. This element is scrolled out of view on initial load.
```

</details>

#### **philipwalton** on `guides/user-experience/pull-to-reveal/guide.md`
> Nit: most of the use case descriptions end in periods. (According to Gemini, 109 end with periods and only 9 do not.)

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
 ---
 name: pull-to-reveal
-description: Build a pull-to-reveal feature that would enable the user to pull down on the screen to reveal more content, like a search bar.
+description: Build a pull-to-reveal feature that would enable the user to pull down on the screen to reveal more content, like a search bar
```

</details>

#### **rviscomi** on `guides/user-experience/pull-to-reveal/guide.md`
> ```suggestion
> ## Fallback Strategy
> 
> {{ BASELINE_STATUS("scroll-initial-target") }}
> ```

#### **rviscomi** on `guides/user-experience/scroll-target-on-load/tasks/task.md`
> WDYT about rephrasing to focus more on the desired outcome, less about the implementation details?Although we do need to specify that the target element has a specific class or ID in order for the grader to target it correctly.
> 
> ```suggestion
> Add a vertical scroll container with 5 media cards that contain images with defined dimensions. Make it so the 3rd element (give it a class of `target`) is already scrolled into view on the initial load, ensuring no visible scrolling animation or flash occurs.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+base_app: daily-grind
+grader: scroll-target-on-load
+---
+Can you help me turn the seasonal favorites grid into a vertical scroll container with media cards that contain images with defined dimensions? Make it into a scrollable feed that centers on target element in view on initial load, ensuring no JavaScript is used for the initial offset and no visible scrolling animation or flash occurs. Be sure to add necessary `CSS.supports` and `DOMContentLoaded` fallbacks for browsers that dont support the API or CSS property yet.
```

</details>

#### **rviscomi** on `harness/lib/agent-shared.ts`
> Revert this?
> ```suggestion
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
    const mcpConfig: { mcpServers: Record<string, any> } = { mcpServers: {} };
 
   for (const serverName of serversToEnable) {
+
```

</details>

#### **rviscomi** on `guides/user-experience/pull-to-reveal/guide.md`
> The other guide isn't open in this PR but it should also have the `BASELINE_STATUS` macro in the same place. Could you add it?

#### **rviscomi** on `guides/user-experience/scroll-target-on-load/tasks/task.md`
> Not needed in the new process
> 
> ```suggestion
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,5 @@
+---
+base_app: daily-grind
+grader: scroll-target-on-load
```

</details>

#### **rviscomi** on `guides/user-experience/pull-to-reveal/tasks/task.md`
> Not needed in the new process
> ```suggestion
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+base_app: daily-grind
+grader: pull-to-reveal
```

</details>

#### **rviscomi** on `guides/user-experience/scroll-target-on-load/expectations.md`
> I think we can drop this one, since we're already checking for the CSS property
> ```suggestion
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
-- The `scroll-initial-target` property MUST be applied uniquely to the single target element within the container.
+- The `scroll-initial-target` property MUST be applied to the single target element within the container.
 - Media elements (e.g., embedded images) within the scroll container MUST have explicit dimensions applied (e.g., via `height`, `width`, or `aspect-ratio`) to prevent unpredictable layout shifts that would invalidate initial scroll coordinates.
 - The implementation MUST NOT rely on JavaScript to calculate the initial scroll offset as its primary mechanism. The CSS property alone must manage the positioning to avoid a visible flash.
```

</details>

#### **rviscomi** on `guides/user-experience/scroll-target-on-load/expectations.md`
> For each expectation that relies on validating the target element, specify the `.target` element per the prompt. For example, "The `.target` element must have an ancestor...."

#### **rviscomi** on `guides/user-experience/scroll-target-on-load/grader.ts`
> All of these regex-based tests should be rewritten to use browser APIs like querySelector and getComputedStyle whenever possible.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  test(`The target element MUST have the 'scroll-initial-target: nearest' CSS property applied`, async () => {
+    // Check for the property in the source code (CSS or inline style)
+    // Using a more specific regex to avoid matching text in <code> blocks
+    expect(html).toMatch(/[\s{;]scroll-initial-target\s*:\s*nearest\s*[;}]/);
```

</details>

#### **rviscomi** on `guides/user-experience/scroll-target-on-load/grader.ts`
> Instead of regex matching, add a spy to wrap CSS.supports so we can see how it's called

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+  test(`The progressive enhancement fallback MUST evaluate native CSS capability using 'CSS.supports'`, async () => {
+    // Matches CSS.supports('scroll-initial-target', 'nearest') with single or double quotes
+    expect(html).toMatch(/CSS\.supports\(\s*['"]scroll-initial-target['"]\s*,\s*['"]nearest['"]\s*\)/);
```

</details>

#### **rviscomi** on `guides/user-experience/scroll-target-on-load/grader.ts`
> It's also valid for the fallback script to be placed at the bottom of the `<body>` right?
> 
> I think this and the next `onload` check could be combined into a single "did the fallback happen at the expected time" check, by comparing when the fallback code was executed and when these events occurred

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+  test(`The fallback script MUST execute no later than 'DOMContentLoaded'`, async () => {
+    // Ensure DOMContentLoaded is used for early execution as per expectations
+    expect(html).toMatch(/DOMContentLoaded/);
```

</details>

#### **rviscomi** on `guides/user-experience/scroll-target-on-load/grader.ts`
> Add a spy to scrollIntoView instead of regex

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+  test(`The fallback script MUST use 'behavior: instant' for scrollIntoView`, async () => {
+    // The fallback should mimic the discrete jump of the native property
+    expect(html).toMatch(/scrollIntoView\(\s*\{\s*[^}]*behavior\s*:\s*['"]instant['"]/);
```

</details>

#### **rviscomi** on `guides/user-experience/scroll-target-on-load/grader.ts`
> The guide should also clarify that running the fallback script at the end of `<body>` is ok

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+  test(`The fallback script MUST execute no later than 'DOMContentLoaded'`, async () => {
+    // Ensure DOMContentLoaded is used for early execution as per expectations
+    expect(html).toMatch(/DOMContentLoaded/);
```

</details>

---

## PR #387: Fine tune evals for various use cases

### Reviews

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

### Comments

#### **rviscomi** on `guides/dev-guide.ts`
> Looks like it gets copied into `base-app.html`, so I think this would be correct
> 
> https://github.com/GoogleChrome/guidance/blob/9c952688ca9dbaa729d174766b197e47296ca367/guides/dev-guide.ts#L234

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- Phrase prompts as ACTION REQUESTS or directives (e.g. "add X", "can you build Y", "implement Z"). NEVER phrase them as advisory questions (e.g. "how can I?", "what's the best way to?", "can you explain?") — the agent must implement, not just explain.
+- The first prompt is the most important: it must be specific enough that an agent implementing it would produce a grader-testable result.
+- Vary specificity: include at least one vague/intent-based prompt and one specific/technical ask.
+- Assume the developer is working on the existing app seen in base-app.html. Reference its real assets and content where relevant.
```

</details>

#### **rviscomi** on `serving/mcp-server/tools/modern-web.ts`
> No you're right, this isn't strictly necessary. It was just for consistency, to actually describe what the tool does. My only tests were with both tool description changes, and guide usage is up a lot, so it's unclear if this change alone is causing regressions, but it's ok AFAICT.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
     "get_best_practices",
     {
-      description: "MANDATORY: After finding a relevant 'use_case_id' from 'search_use_cases', call this tool to retrieve the complete, actionable implementation guide. This guidance is framework-agnostic; adapt it to whatever library or framework is being used. Do not guess or hallucinate APIs; you must use the patterns in this guide.",
+      description: `This is a retrieval tool that returns the complete, actionable implementation guide for a given web development use case.
```

</details>

#### **philipwalton** on `guides/performance/full-session-analytics/guide.md`
> This is fine if it's working. But I wonder if a simpler fix could be to just not mention the `visibilitychange` event at all, so there's nothing to confuse the agent.
> 
> The only thing the agent needs to be aware of is that—since there's no reliable end-of-session events on the web—the polyfill, just to be safe, could send the event before the user's session actually ends. So a robust analytics package should always check to see if the fetchLater result  has been activated, and respond accordingly.
> 
> And looking at the code now, I see the example doesn't do that, so I should fix that...
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
 Use the following minimal `fetchLater()` polyfill, which implements the API as closely as possible in unsupporting browsers.
 
-The only notable behavior difference with this polyfill is instead of sending the payload when the user leaves the page, it sends it whenever the page's `visibilityState` changes to "hidden", since this is the most reliable end-of-session signal that's widely available today.
+The only notable behavior difference with this polyfill is that it uses `visibilitychange` to detect when the user leaves, rather than relying on the browser's native unload handling. This is an internal implementation detail — your code does not need to listen for `visibilitychange` or any other page lifecycle events. Just call `fetchLater()` and the polyfill handles delivery.
```

</details>

#### **rviscomi** on `guides/performance/full-session-analytics/guide.md`
> Thanks, it does seem to help so I'll merge it with this PR, but feel free to remove it if you'll be changing the example later.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
 Use the following minimal `fetchLater()` polyfill, which implements the API as closely as possible in unsupporting browsers.
 
-The only notable behavior difference with this polyfill is instead of sending the payload when the user leaves the page, it sends it whenever the page's `visibilityState` changes to "hidden", since this is the most reliable end-of-session signal that's widely available today.
+The only notable behavior difference with this polyfill is that it uses `visibilitychange` to detect when the user leaves, rather than relying on the browser's native unload handling. This is an internal implementation detail — your code does not need to listen for `visibilitychange` or any other page lifecycle events. Just call `fetchLater()` and the polyfill handles delivery.
```

</details>

---

## PR #373: Add loaf use cases and demos

### Reviews

#### **philipwalton** (COMMENTED)
> FYI, I noticed some spelling/grammar issues, so I asked Gemini to review and pushed those changes.

#### **philipwalton** (COMMENTED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/performance/correlate-interaction-with-long-frame/guide.md`
> Gah! Embarrassing that I just trusted Gemini on that one!

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
 description: Correlate a specific user interaction with the long animation frame that delayed its visual feedback.
 web-feature-ids:
   - long-animation-frames
+  - event-timing
```

</details>

---

## PR #369: Avoid static assertions in grader.ts

### Reviews

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

### Comments

#### **rviscomi** on `.agents/skills/project-evals/SKILL.md`
> Ah yes I think it should go in the prompt too (I missed that) but I think we should also keep it here in the skill. Reason being that we want contributors' coding agents to be able to keep generated graders in check as we go, or to retroactively apply grader best practices to previously generated files.
> 
> I don't mind the duplication so much, but if needed we could find a way to centralize the instructions. (I don't love it but we could scrape the skill md and inject it into the prompt)

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
 ## Grading Note
-* Graders (`grader.ts`) live within their respective guide folders. These are Playwright test files, but they are permitted to perform non-browser tests (like `str.includes()` on file contents) as well as actual browser automation checks. A huamn may manually edit them if the generator struggles to get it perfectly tailored.
+* Graders (`grader.ts`) live within their respective guide folders. These are Playwright test files.
+* **AVOID** using static assertions (like regex or `str.includes()` on `fs.readFileSync`) to test CSS or HTML syntax whenever possible. These are extremely brittle and will fail if the agent uses a different class name, semantic element, or formatting.
```

</details>

#### **rviscomi** on `.agents/skills/project-evals/SKILL.md`
> Updated

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
 ## Grading Note
-* Graders (`grader.ts`) live within their respective guide folders. These are Playwright test files, but they are permitted to perform non-browser tests (like `str.includes()` on file contents) as well as actual browser automation checks. A huamn may manually edit them if the generator struggles to get it perfectly tailored.
+* Graders (`grader.ts`) live within their respective guide folders. These are Playwright test files.
+* **AVOID** using static assertions (like regex or `str.includes()` on `fs.readFileSync`) to test CSS or HTML syntax whenever possible. These are extremely brittle and will fail if the agent uses a different class name, semantic element, or formatting.
```

</details>

---

## PR #361: Autofill x 5: add content to guide.me, and add grader.ts, negative-demo.html

### Reviews

#### **rviscomi** (APPROVED)
*(No review body)*

---

## PR #360: Automate use case research

### Reviews

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

### Comments

#### **rviscomi** on `bin/gd.ts`
> Done

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+    case 'research': {
+      // Pass remaining args through to the research script
+      const researchArgs = process.argv.slice(3);
+      await spawnChild('node', [
```

</details>

#### **rviscomi** on `guides/research-use-cases.ts`
> Done

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+let seedSources: string[];
+
+if (values.issue) {
+  const issueData = fetchIssue(values.issue);
```

</details>

#### **rviscomi** on `guides/research-use-cases.ts`
> Pulled in scanAllGuides, LMK if you had something else in mind

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+// Guide stub creation
+// ---------------------------------------------------------------------------
+
+function collectExistingDescriptions(): string[] {
```

</details>

#### **rviscomi** on `guides/research-use-cases.ts`
> Yeah, what I hoped was for people to manually prune irrelevant articles from their GH issue descriptions, but that's ok. I have a script that'll scoop them up and saves them for other features-to-sources uses in the future.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  console.log(`Fetching issue #${issueNumber} from GitHub…`);
+  let json: string;
+  try {
+    json = execSync(`gh issue view ${issueNumber} --json title,body`, { encoding: 'utf8' });
```

</details>

---

## PR #357: Create guidance for the blocker=render use cases

### Reviews

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

### Comments

#### **rviscomi** on `guides/user-experience/consistent-cross-document-transitions/guide.md`
> ```suggestion
> 3. **DO** use `blocking="render"` on `<script>` elements that must execute before the transition animates (e.g., scripts that apply a theme or affect the layout).
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+1. **MANDATORY:** Opt in to cross-document view transitions with the `@view-transition` CSS at-rule on both pages.
+2. **MANDATORY:** Ensure critical stylesheets are in the `<head>`. Stylesheets in the `<head>` are render-blocking by default. Dynamically injected stylesheets require explicit `blocking="render"`.
+3. **DO** use `blocking="render"` on `<script>` elements that must execute before the transition animates (e.g., scripts that apply a theme or effect the layout).
```

</details>

#### **rviscomi** on `guides/user-experience/consistent-cross-document-transitions/guide.md`
> ```suggestion
> If a non-blocking script in the `<head>` must run before the transition animates (e.g., to apply a theme class or affect the layout), mark it with `blocking="render"`. Without this, `async`, `defer`, or `type="module"` scripts may execute after the transition has already started.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+### Step 2: Block Rendering Until Critical Scripts Execute
+
+If a non-blocking script in the `<head>` must run before the transition animates (e.g., to apply a theme class or effect the layout), mark it with `blocking="render"`. Without this, `async`, `defer`, or `type="module"` scripts may execute after the transition has already started.
```

</details>

#### **rviscomi** on `guides/user-experience/consistent-cross-document-transitions/expectations.md`
> To confirm, is it ok to block parsing? The guide only recommends setting up the listener in a non-parser-blocking script (`<script async blocking=render>`)

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- Scripts that must run before the transition (e.g., theme application) are marked with `blocking="render"` in the `<head>`.
+- The `media` attribute is used on `<link rel="expect">` when different viewport sizes require blocking on different DOM elements.
+- Render blocking is limited to resources and elements visible in the initial viewport. Non-critical or below-the-fold content is NOT render-blocked.
+- If `view-transition-name` values are assigned dynamically via `pagereveal`, the listener is registered in a parser-blocking script or a `blocking="render"` script in the `<head>`.
```

</details>

#### **rviscomi** on `guides/user-experience/consistent-cross-document-transitions/expectations.md`
> @micahjo7 this use case requires eval'ing multiple files, which isn't currently supported. Do you have any ideas how we might do that?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,9 @@
+- Both the source and destination pages include the `@view-transition { navigation: auto; }` CSS at-rule.
```

</details>

#### **rviscomi** on `guides/user-experience/flicker-free-client-side-ab-testing/guide.md`
> This might confuse agents when implementing the inline script approach, where the solution is to use `type=module` rather than `async`

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+### Implementation Strategy
+
+1. **MANDATORY:** Place the experimentation script in the document `<head>`.
+2. **MANDATORY:** Add the `blocking="render"` attribute alongside `async` on the script tag.
```

</details>

#### **philipwalton** on `guides/user-experience/consistent-cross-document-transitions/expectations.md`
> Good point. It's technically OK for this use case (and AFAICT it was taken from [this bit](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document#:~:text=Important%3A%20The,%3Cscript%3E%20tag.) in Bramus's doc), but it's probably not something we want to recommend given that `blocking=render` works.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- Scripts that must run before the transition (e.g., theme application) are marked with `blocking="render"` in the `<head>`.
+- The `media` attribute is used on `<link rel="expect">` when different viewport sizes require blocking on different DOM elements.
+- Render blocking is limited to resources and elements visible in the initial viewport. Non-critical or below-the-fold content is NOT render-blocked.
+- If `view-transition-name` values are assigned dynamically via `pagereveal`, the listener is registered in a parser-blocking script or a `blocking="render"` script in the `<head>`.
```

</details>

#### **philipwalton** on `guides/user-experience/flicker-free-client-side-ab-testing/guide.md`
> Potentially. The thing is we can't really recommend using <script type=module> here because not all experiment scripts can run as modules. Also with these types of scripts you typically want the `async` behavior rather than the `defer` behavior because they're independent of all other scripts and you want them to load ASAP.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+### Implementation Strategy
+
+1. **MANDATORY:** Place the experimentation script in the document `<head>`.
+2. **MANDATORY:** Add the `blocking="render"` attribute alongside `async` on the script tag.
```

</details>

#### **rviscomi** on `guides/user-experience/flicker-free-client-side-ab-testing/guide.md`
> Maybe relax the "MANDATORY" bit, or add a condition like "... if the script isn't inline"

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+### Implementation Strategy
+
+1. **MANDATORY:** Place the experimentation script in the document `<head>`.
+2. **MANDATORY:** Add the `blocking="render"` attribute alongside `async` on the script tag.
```

</details>

#### **philipwalton** on `guides/user-experience/consistent-cross-document-transitions/expectations.md`
> For the MVP ahead of I/O, I think there will be relatively few of these cases. It might be easiest to manually create the tests if they have complicated requirements like this.
> 
> But long term I think we will need a solution. For example, there are folks wanting to write WASM use cases that will almost certainly require advanced test setup to properly validate.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,9 @@
+- Both the source and destination pages include the `@view-transition { navigation: auto; }` CSS at-rule.
```

</details>

#### **philipwalton** on `guides/user-experience/flicker-free-client-side-ab-testing/guide.md`
> Addressed in https://github.com/GoogleChrome/guidance/pull/357/commits/c29fd5f44e0e53c4e25494169a299092cd97ca0c

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+### Implementation Strategy
+
+1. **MANDATORY:** Place the experimentation script in the document `<head>`.
+2. **MANDATORY:** Add the `blocking="render"` attribute alongside `async` on the script tag.
```

</details>

#### **philipwalton** on `guides/user-experience/consistent-cross-document-transitions/expectations.md`
> Addressed in https://github.com/GoogleChrome/guidance/pull/357/commits/c29fd5f44e0e53c4e25494169a299092cd97ca0c

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- Scripts that must run before the transition (e.g., theme application) are marked with `blocking="render"` in the `<head>`.
+- The `media` attribute is used on `<link rel="expect">` when different viewport sizes require blocking on different DOM elements.
+- Render blocking is limited to resources and elements visible in the initial viewport. Non-critical or below-the-fold content is NOT render-blocked.
+- If `view-transition-name` values are assigned dynamically via `pagereveal`, the listener is registered in a parser-blocking script or a `blocking="render"` script in the `<head>`.
```

</details>

---

## PR #356: event-timing: add use cases

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
> These are good use cases, but as I mentioned in one of the inline comments, I wonder if we want to stick to use cases that are not already well-covered by the `web-vitals` JS library.
> 
> IMO custom attribution is the main reasons someone would use event timing in addition to (or instead of) the `web-vitals` library.
> 

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/performance/first-input-delay/guide.md`
> Do we want to include a use case for a metric we don't recommend people track anymore? My sense is we can omit this one.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,10 @@
+---
+name: first-input-delay
+description: Measure the First Input Delay (FID) using the Event Timing API to assess the delay between the first user interaction and when the browser begins processing its event handlers.
```

</details>

#### **philipwalton** on `guides/performance/interaction-latency-attribution/guide.md`
> ```suggestion
> description: Identify slow user interactions, and attribute them for diagnostic purposes (e.g. determining the target element of an interaction or decomposing its phases into input delay, processing duration, and presentation delay).
> ```
> 
> I think it makes sense to generalize this to cover more attribution use cases (in addition to the phase breakdown).
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,11 @@
+---
+name: interaction-latency-attribution
+description: Decompose interaction latency into input, processing, and presentation phases to diagnose responsiveness bottlenecks.
```

</details>

#### **philipwalton** on `guides/performance/interaction-to-next-paint/guide.md`
> For this one, is our recommendation for the AI to use event timing, or is it to use the `web-vitals` library?
> 
> I'm concerned that if we include use cases where our actual recommendation is to use `web-vitals` then we may end up with a bunch of sites that poorly track Core Web Vitals metrics. WDYT?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,10 @@
+---
+name: interaction-to-next-paint
+description: Monitor session-wide interaction latency to identify and optimize the Interaction to Next Paint (INP) score.
```

</details>

#### **rviscomi** on `guides/sync-use-cases.ts`
> Ah good catch. I included this change in #358 and added tests to make sure it doesn't happen again.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
-      guideErrors = errors;
-      guideData = data;
-      guideBody = body;
+      const validation = validateGuide(path.join(subdir, 'guide.md'));
```

</details>

#### **philipwalton** on `guides/performance/interaction-to-next-paint/guide.md`
> Yeah, I think we can drop it, and I agree that this subject can easily be covered in a performance skill.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,10 @@
+---
+name: interaction-to-next-paint
+description: Monitor session-wide interaction latency to identify and optimize the Interaction to Next Paint (INP) score.
```

</details>

---

## PR #353: Fix fetchlater evals

### Reviews

#### **rviscomi** (APPROVED)
*(No review body)*

---

## PR #344: Flatten autofill use cases

### Reviews

#### **malchata** (APPROVED)
> Seeing as these are flattened without changes to files, I'll approve this!

---

## PR #342: Adds use cases for the VisibilityStateEntry API.

### Reviews

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **philipwalton** (CHANGES_REQUESTED)
> I think all three of these use cases can be generalized into a single use case related to determining whether or not a page was loaded in the background.
> 
> In addition to this one, I'd add another distinct use case around determining the total amount of time a user spent in the foreground state.
> 
> So then the two use cases would be:
> 
> 1. `detect-initial-visibility-state`: Reliably determine whether a page was initially loaded in the background, even in cases where the script is loaded asynchronously after the user foregrounded the page.
> 
> 2. `calculate-total-foreground-time`: Calculate the total time a user actually spent viewing a page, excluding periods when the tab was in the background.
> 

#### **philipwalton** (APPROVED)
*(No review body)*

### Comments

#### **rviscomi** on `guides/performance/debug-resource-throttling/guide.md`
> ```suggestion
> description: Diagnose whether slow or failing page tasks are caused by background resource throttling.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: debug-resource-throttling
+description: Detect if a page's tasks are running slowly or failing due to resource throttling by checking its visiblity state to see if the page is being run in the background.
```

</details>

#### **rviscomi** on `guides/performance/detect-initial-visibility-state-prerendering/demo.html`
> Demo required

#### **rviscomi** on `guides/performance/skewed-core-web-vitals/demo.html`
> Demo required

#### **rviscomi** on `guides/performance/debug-resource-throttling/demo.html`
> Demo required

#### **philipwalton** on `guides/performance/detect-initial-visibility-state-prerendering/guide.md`
> ```suggestion
> description: Reliably determine whether a page was initially loaded in the background, even in cases where the script is loaded asynchronously after the user foregrounded the page.
> ```
> 
> I'd remove the mention of prerendering, as I think that's too specific. The use case is primarily about detecting background loads, and then the guide can go into more detail as to why you'd want to do that.
> 
> E.g. it could say: "...this can be useful to potentially ignore or attribute page-load performance data that may be tainted due to background throttling."
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: detect-initial-visibility-state-prerendering
+description: Detect a page's initial visibility state to verify if prerendering occurred in a backgrounded page where other detection mechanisms may be less reliable and accurate.
```

</details>

#### **philipwalton** on `guides/performance/detect-initial-visibility-state-prerendering/guide.md`
> ```suggestion
> name: detect-initial-visibility-state
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: detect-initial-visibility-state-prerendering
```

</details>

#### **philipwalton** on `guides/performance/debug-resource-throttling/guide.md`
> I'd drop this use case, as I think it's too similar to the next one (which I'm suggesting you generalize).

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: debug-resource-throttling
+description: Detect if a page's tasks are running slowly or failing due to resource throttling by checking its visiblity state to see if the page is being run in the background.
```

</details>

#### **philipwalton** on `guides/performance/skewed-core-web-vitals/guide.md`
> I'd drop this one as well, as I think it's essentially the same as your second one.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: skewed-core-web-vitals
+description: Check if a page's Core Web Vitals may be artificially higher due to a page being run in the background by checking the page's visibility state.
```

</details>

---

## PR #312: Refactor sync-use-cases and harden the requirements

### Reviews

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

### Comments

#### **rviscomi** on `guides/user-experience/pull-to-reveal/grader.ts`
> @pattishin I generated this with `gd dev`. Could you give it a look and make sure that it's implementing the expectations correctly?
> 
> I needed to do it in this PR because I'm changing the severity of the warnings about missing eval-related files, and not having them would start to cause CI errors.

#### **rviscomi** on `guides/user-experience/scroll-target-on-load/grader.ts`
> @pattishin same comment, could you take a look?

#### **rviscomi** on `guides/user-experience/pull-to-reveal/grader.ts`
> As discussed offline, @pattishin will review the grader changes and make any changes after merging this PR

---

## PR #307: Add guide content and expectations for reduce-style-repetition

### Reviews

#### **malchata** (CHANGES_REQUESTED)
> Added some suggestions using the guide skills.

### Comments

#### **malchata** on `guides/user-experience/reduce-style-repetition/guide.md`
> ```suggestion
> ### Fallback Strategies
> 
> {{ BASELINE_STATUS("function") }}
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+}
+```
+
+### 4. Fallback Strategies
```

</details>

#### **malchata** on `guides/user-experience/reduce-style-repetition/guide.md`
> ```suggestion
> 
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+}
+```
+
+{{ BASELINE_STATUS("function") }}
```

</details>

#### **malchata** on `guides/user-experience/reduce-style-repetition/guide.md`
> ```suggestion
>   /* DO: Call the custom fluid function. This reduces boilerplate by centralizing the complex calculation logic. */
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+/* Usage */
+.element {
+  /* DO: Call custom fluid function */
```

</details>

#### **malchata** on `guides/user-experience/reduce-style-repetition/guide.md`
> ```suggestion
>   /* DO: Use clamp() and calc() to create a fluid value that scales proportionally between the min and max viewport widths. This ensures the output scales smoothly across device sizes without complex media queries. */
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+```css
+/* Definition */
+@function --fluid-size(--min, --max, --vw-min, --vw-max) {
+  /* DO: Calculate fluid size with clamp/calc */
```

</details>

---

## PR #304: Adds the guide for top-level await for fetching async dependencies.

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> ```suggestion
> # Conditionally load or initialize async dependencies
> ```
> 
> I think it's good to be consistent with the description.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
     - top-level-await
 ---
+
+# Conditional polyfill dependency fetching and initialization with top-level await
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> Nit: I'd update this entire code block to be a JS rather than an HTML, since that's how most people author JS. (Also, an inline module script can't really export anything, because there no way to import it.)

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+```html
+<!-- 1. Ensure the execution environment allows ESM. -->
+<script type="module">
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> I'd avoid using this an example. `IntersectionObserver` has been Baseline widely available for many, many years, and this could confuse AI agents into thinking `IntersectionObserver` code needs to use a polyfill.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+<script type="module">
+  // 2. Check for browser capabilities to avoid running code
+  //    in contexts where a feature doesn't require a polyfill
+  if (typeof globalThis.IntersectionObserver === 'undefined') {
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> I think this is only true when importing from a third-party domain. If you're using a bundler that will create a chunk hosted along with all your other chunks, then I don't think it's necessary to use a try/catch. (And since most people use bundlers, I expect that will be the majority case.)

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+1. Verify that your module is being parsed as an ECMAScript module.
+2. Programmatically detect the absence of the required API or feature in the current runtime environment.
+3. Wrap the dynamic import logic within a `try/catch` block to prevent unhandled rejections from failing the entire module graph.
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> Yes, but most people are going to be using a bundler, which should take care of that for you.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## How to implement
+
+1. Verify that your module is being parsed as an ECMAScript module.
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> Again, only if the request is to a 3P domain.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+2. Programmatically detect the absence of the required API or feature in the current runtime environment.
+3. Wrap the dynamic import logic within a `try/catch` block to prevent unhandled rejections from failing the entire module graph.
+4. Execute a dynamic `import()` to fetch and evaluate the required polyfill.
+5. Provide fallback logic in the `catch` block to ensure graceful degradation if the network request fails.
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> I think it would be more helpful to move this step higher and frame it as: "Ensure your conditional and top-level await run before the features being loaded or initialized is used.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+3. Wrap the dynamic import logic within a `try/catch` block to prevent unhandled rejections from failing the entire module graph.
+4. Execute a dynamic `import()` to fetch and evaluate the required polyfill.
+5. Provide fallback logic in the `catch` block to ensure graceful degradation if the network request fails.
+6. Export the module's public API only after the environment has been successfully patched and verified.
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> ```suggestion
>       await import('path/to/polyfill.js');
> ```
> 
> I'd just use a generic reference, and definitely don't use a reference to polyfill.io, since that service has been compromised.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  if (typeof globalThis.IntersectionObserver === 'undefined') {
+    try {
+      // 3 & 4: Dynamically await the polyfill import
+      await import('https://cdn.polyfill.io/v3/polyfill.min.js?features=IntersectionObserver');
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> I would expect the code here to use `IntersectionObserver` (or whatever you switch this to) freely at this point, rather than creating another wrapper.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+    }
+  }
+
+  // 6: Export bindings synchronously; downstream consumers are guaranteed the polyfill is evaluated (or handled)
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> Again, only if importing from a 3P site (but that's true of all imports).

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+## Best practices
+
+* **DO** ensure an ESM execution context. In the browser, top-level await is syntactically invalid in `<script>` blocks that don't use the `type="module"` attribute.
+* **DO** implement strict error boundaries. Unhandled Promise rejections using top-level await will abort module evaluation, resulting in missing dependencies or non-execution of application logic.
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> This section should include some recommendations to avoid this bug (which is what is preventing this feature from being Baseline): https://bugs.webkit.org/show_bug.cgi?id=242740

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+</script>
+```
+
+## Best practices
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> The use case in this file is generic and mentions both loading or initializing async dependencies, but this guide only mentions loading polyfills. I think you should add an example that includes a non-polyfill async dependency.

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> This file is also missing a fallback section, which in this case I think should discuss how to use the feature in a way that doesn't trigger the Safari bug.

---

## PR #298: use cases: overflow: clip

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
> Thanks @marcianoskate, FYI I had previously discussed with @rviscomi that perhaps we should remove this feature and only covered it a skill.md file (e.g. use `overflow: clip` instead of `overflow: hidden`), but I think your use case that incorporates `overflow-clip-margins` is actually a good one to have a guide for.
> 
> So, to restate, I'd remove all but the 3rd use case (which I left some comments on). The other use cases are probably better handled via a skill.

#### **philipwalton** (APPROVED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/preserve-visual-effects-with-clip-margins/guide.md`
> ```suggestion
> name: preserve-overflow-effects
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: preserve-visual-effects-with-clip-margins
```

</details>

#### **philipwalton** on `guides/user-experience/preserve-visual-effects-with-clip-margins/guide.md`
> ```suggestion
> description: Allow limited decorative overflow (e.g. box shadows, outlines, badges, etc.) on an HTML element, while otherwise clipping its contents to within a defined box size.
> ```
> 
> Avoid the use of the API in the use case description.
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: preserve-visual-effects-with-clip-margins
+description: Use `overflow-clip-margin` to expand the clipping boundary and preserve visual effects like box-shadow or focus outlines.
```

</details>

#### **philipwalton** on `guides/user-experience/preserve-visual-effects-with-clip-margins/guide.md`
> ```suggestion
>   - overflow-clip
>   - overflow-clip-margin
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+name: preserve-visual-effects-with-clip-margins
+description: Use `overflow-clip-margin` to expand the clipping boundary and preserve visual effects like box-shadow or focus outlines.
+web-feature-ids: 
+  - overflow-clip
```

</details>

---

## PR #296: Add a guide for deferring heavy content rendering

### Reviews

#### **philipwalton** (COMMENTED)
> Thanks! This mostly LGTM. Were you planning to add prompts and expectations in this PR?

#### **philipwalton** (APPROVED)
> LGTM, once a few minor comments are addressed.

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (APPROVED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/performance/defer-rendering-heavy-content/guide.md`
> Should this be included in the numbered instructions above? Also, should you explain when it makes sense to set a number value vs. use "auto"?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  /* Skips rendering calculations when off-screen */
+  content-visibility: auto;
+  
+  /* Mandatory: Provide an estimated height to prevent layouts shifts */
```

</details>

#### **philipwalton** on `guides/performance/defer-rendering-heavy-content/guide.md`
> @rviscomi is this how these widgets are expected to be used (separated from the content), or should they be used inline in the text?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Browser support and fallback strategies
+
+{{ BASELINE_STATUS("content-visibility") }}
```

</details>

#### **philipwalton** on `guides/performance/defer-rendering-heavy-content/guide.md`
> ```suggestion
> When `hidden="until-found` is not supported elements will remain hidden. Use feature detection targeting `onbeforematch` and extract or reveal content accordingly.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+```
+
+### `hidden="until-found"` fallback
+When `hidden="until-found` is not supported elements will remain hidden.Use feature detection targeting `onbeforematch` and extract or reveal content accordingly.
```

</details>

#### **philipwalton** on `guides/performance/defer-rendering-heavy-content/guide.md`
> Can you update this comment and explain why these specific values were chosen? I wouldn't want AI tools to just blindly copy/paste these values, thinking they're a best practice.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  /* Skips rendering calculations when off-screen */
+  content-visibility: auto;
+  
+  /* Mandatory: Provide an estimated height to prevent layouts shifts */
```

</details>

#### **philipwalton** on `guides/performance/defer-rendering-heavy-content/guide.md`
> ```suggestion
> When `hidden="until-found"` is not supported elements will remain hidden. Use feature detection targeting `onbeforematch` and extract or reveal content accordingly.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+```
+
+### `hidden="until-found"` fallback
+When `hidden="until-found` is not supported elements will remain hidden. Use feature detection targeting `onbeforematch` and extract or reveal content accordingly.
```

</details>

#### **philipwalton** on `guides/performance/defer-rendering-heavy-content/demo.html`
> @taraojo FYI I added this to match the guide, but wanted to confirm this is correct.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
     .below-fold-cv {
       content-visibility: auto;
-      contain-intrinsic-size: 1000px;
+      contain-intrinsic-size: auto none auto 1000px;
```

</details>

#### **philipwalton** on `guides/performance/defer-rendering-heavy-content/demo.html`
> AI review caught this, and I think changing it to false is correct, right?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
             style="font-size:1.2rem; color: #d97706; background: #fffbeb; padding: 2px 6px; border-radius: 4px;">Supercalifragilisticexpialidocious</code>.
           If it is hidden, the browser will automatically reveal this entire section!</p>
-        <button class="btn" id="toggle-btn-3" aria-expanded="true">Show Dashboard</button>
+        <button class="btn" id="toggle-btn-3" aria-expanded="false">Show Dashboard</button>
```

</details>

#### **rviscomi** on `guides/performance/defer-rendering-heavy-content/guide.md`
> It's ok to have them on their own lines, but yeah the expectation is to have them under their respective subsections. So this one should be moved within the ```### `content-visibility` fallback``` section.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Browser support and fallback strategies
+
+{{ BASELINE_STATUS("content-visibility") }}
```

</details>

#### **philipwalton** on `guides/performance/defer-rendering-heavy-content/guide.md`
> Yep, this is very clear, thanks! Feel free to merge when ready.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  /* Skips rendering calculations when off-screen */
+  content-visibility: auto;
+  
+  /* Mandatory: Provide an estimated height to prevent layouts shifts */
```

</details>

---

## PR #295: Project-level agent skills to assist contributors

### Reviews

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

### Comments

#### **philipwalton** on `.agents/skills/project-guides/SKILL.md`
> ```suggestion
> * **Focus:** Keep it abstract but short. No fluff. No conversational text. Include a brief overview of the use case and explanation of why the solution outlined in the guide is the recommended approach.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+### 2. Tone and Formatting
+* **MANDATORY:** Use strict imperative directives. Start instructions with `MANDATORY:`, `DO`, and `DO NOT`. Coding agents respond best to rigid constraints.
+* **Focus:** Keep it abstract but short. No fluff. No conversational text. Include a brief overview of the feature and why it is useful for the use-case.
```

</details>

#### **philipwalton** on `.agents/skills/project-use-cases/SKILL.md`
> FWIW, I used Deep Research in the Gemini web app and not NotebookLM. Do we need to be this prescriptive?
> 
> Also, this is written for the agent, right? Should we phrase these as "Suggest that the user use Deep Research..."?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Manual research and discovery
+
+Use Deep Research in NotebookLM to discover sources and real-world implementations you might not be aware of. Focus on finding complex edge cases, performance implications, and emerging best practices. Deep Research is particularly effective at surfacing GitHub discussions, W3C specifications, and developer blog posts that highlight non-obvious constraints.
```

</details>

#### **philipwalton** on `.agents/skills/project-use-cases/SKILL.md`
> ```suggestion
> A "use case" in this project is not a description of a feature; it's a task that the user is trying to implement, or a problem they're trying to solve. The feature is only relevant in the sense that it's part of the recommended solution for the use case.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Identifying action-oriented tasks
+
+A "use case" in this project is not a description of a feature; it's how the feature would be used in the wild.
```

</details>

#### **philipwalton** on `.agents/skills/project-use-cases/SKILL.md`
> ```suggestion
> * **Action-oriented thinking**: Frame every use case as a task, and make sure it starts with a verb. Instead of "Scroll-driven animations support horizontal scrolling," use something like "Synchronize an animation's progress with the horizontal scroll distance of a container."
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+A "use case" in this project is not a description of a feature; it's how the feature would be used in the wild.
+
+* **Action-oriented thinking**: Frame every use case as a task. Instead of "Scroll-driven animations support horizontal scrolling," use something like "Synchronize an animation's progress with the horizontal scroll distance of a container."
```

</details>

#### **philipwalton** on `.agents/skills/project-use-cases/SKILL.md`
> ```suggestion
> * **Bridge the knowledge gap**: Assume the developer knows *what* they want to build (e.g., "I need a sticky header that shrinks on scroll") but might not know *which* modern web feature is the best solution (e.g., scroll-driven animations). Your use cases should facilitate this discovery by focusing on the desired outcome.
> * **Don't get too specific**: The use case must be general enough to match a wide range of relevant user prompts. Try to be as general as possible, while still faithfully representing the use case. For example, instead of saying "Fade an image in/out..." say "Smoothly hide/show a component...".
> * **Focus on the WHAT not the HOW**: Do not mention the solution in the use case description. For example, avoid phrases like "...by doing..." or "...through the use of...". Ideally, the use case description should remain constant, even if the recommended features or best practices for implementing it change over time.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+A "use case" in this project is not a description of a feature; it's how the feature would be used in the wild.
+
+* **Action-oriented thinking**: Frame every use case as a task. Instead of "Scroll-driven animations support horizontal scrolling," use something like "Synchronize an animation's progress with the horizontal scroll distance of a container."
+* **Bridge the knowledge gap**: Assume the developer knows *what* they want to build (e.g., "I need a sticky header that shrinks on scroll") but might not know *which* modern web feature is the best solution (e.g., scroll-driven animations). Your use cases should facilitate this discovery by focusing on the desired outcome.
```

</details>

#### **philipwalton** on `.agents/skills/project-use-cases/SKILL.md`
> ```suggestion
> * **Scope**: Aim for 2-5 distinct use cases per feature. Each use case should represent a distinct implementation pattern or a significant variation in how the feature is applied. IMPORTANT: Not every sub-feature or feature variation needs a use cases.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+* **Action-oriented thinking**: Frame every use case as a task. Instead of "Scroll-driven animations support horizontal scrolling," use something like "Synchronize an animation's progress with the horizontal scroll distance of a container."
+* **Bridge the knowledge gap**: Assume the developer knows *what* they want to build (e.g., "I need a sticky header that shrinks on scroll") but might not know *which* modern web feature is the best solution (e.g., scroll-driven animations). Your use cases should facilitate this discovery by focusing on the desired outcome.
+* **Targeted scope**: Aim for 2-5 distinct use cases per feature. Each should represent a unique implementation pattern or a significant variation in how the feature is applied.
```

</details>

#### **philipwalton** on `.agents/skills/project-use-cases/SKILL.md`
> Ideally we'd be able to run the `search_use_cases` tool to identify any similar, existing use cases.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+This guidance is ultimately served through a RAG (Retrieval-Augmented Generation) search system. If multiple guides have significant overlap, coding agents may struggle to select the most relevant one, leading to confusing or contradictory advice.
+
+* **Check existing guides**: Before creating a new use case, review existing guides in the same discipline.
+* **Search by web-feature-id**: Each guide lists the web features it relies on in the `web-feature-ids` metadata field. Search for the ID of the feature you're writing about in existing guides and open PRs to see how it's being used.
```

</details>

#### **philipwalton** on `.agents/skills/project-use-cases/SKILL.md`
> I'm now realizing that some of my suggestions above are covered here. Not sure where it's better to include them, so I'll make suggestions in both places for now.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Implementation and scaffolding
+
+The following steps are REQUIRED for creating a new use case:
```

</details>

#### **philipwalton** on `.agents/skills/project-use-cases/SKILL.md`
> ```suggestion
>   You MUST choose a short (max 1024 characters), action-oriented description of the problem the feature solves. The description must be a single sentence, start with a verb, and answer the question: "What is the user trying to DO?"
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+* **Step 1: Describe the use case**
+
+  You MUST choose a short, action-oriented description of the problem the feature solves. The description must be a single sentence that captures the essence of the use case.
```

</details>

#### **philipwalton** on `.agents/skills/project-use-cases/SKILL.md`
> ```suggestion
>   Create a `demo.html` file in the new subdirectory. This file should be minimal example of a correct implementation of the use case, without unnecessary fluff or polish. The demo file should be self-contained with inline scripts and styles for any necessary functionality. Use placeholder URLs for any subresources like images or videos.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+* **Step 5: Create the `demo.html` file**
+
+  Create a `demo.html` file in the new subdirectory. This file should be an ultra-minimal example of a correct implementation of the use case. It should be self-contained with inline scripts and styles for any necessary functionality. Use placeholder URLs for any subresources like images or videos.
```

</details>

#### **philipwalton** on `.agents/skills/project-guides/SKILL.md`
> ```suggestion
> `guide.md` must start with this YAML frontmatter structure (added in **Stage 1**):
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+**MANDATORY RULES FOR WRITING `guide.md`:**
+
+### 1. YAML Frontmatter Schema
+`guide.md` must start with this YAML frontmatter structure:
```

</details>

#### **rviscomi** on `.agents/skills/project-use-cases/SKILL.md`
> Yes, I'll update this to clarify that the user should do the research, not the agent. It's here mainly for the agent to guide the user on how to do the research.
> 
> I'll also split up this example prompt into two steps to clarify that the process is to deep research sources first, and analyze the use cases second.
> 
> As for whether to use deep research in the Gemini app, NotebookLM, or both, my suggestion is to use the deep research option of NotebookLM:
> 
> <img width="745" height="452" alt="Image" src="https://github.com/user-attachments/assets/c5c58cb9-2eeb-4a5b-b670-1305aeac5d37" />
> 
> I'm being more prescriptive about using NotebookLM because of the finer-grained control it gives us over adding, removing, or disabling individual sources. OTOH deep research in the Gemini app defaults to producing a huge report, and it's not possible to manage specific sources. Maybe most importantly, NotebookLM tries to base its responses only on the sources, so if you ask it about something unrelated, it'll respond like "The provided sources do not contain direct recommendations on XYZ". Meanwhile the Gemini app will try to answer the question using additional (unrelated, unvetted) sources, muddying the quality and attribution.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Manual research and discovery
+
+Use Deep Research in NotebookLM to discover sources and real-world implementations you might not be aware of. Focus on finding complex edge cases, performance implications, and emerging best practices. Deep Research is particularly effective at surfacing GitHub discussions, W3C specifications, and developer blog posts that highlight non-obvious constraints.
```

</details>

#### **rviscomi** on `.agents/skills/project-use-cases/SKILL.md`
> Yeah, when we have the CLI set up we can instruct the agent to use that to look for similar use cases. Right now having the MCP server installed in development isn't a prerequisite.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+This guidance is ultimately served through a RAG (Retrieval-Augmented Generation) search system. If multiple guides have significant overlap, coding agents may struggle to select the most relevant one, leading to confusing or contradictory advice.
+
+* **Check existing guides**: Before creating a new use case, review existing guides in the same discipline.
+* **Search by web-feature-id**: Each guide lists the web features it relies on in the `web-feature-ids` metadata field. Search for the ID of the feature you're writing about in existing guides and open PRs to see how it's being used.
```

</details>

#### **rviscomi** on `.agents/skills/project-use-cases/SKILL.md`
> Probably doesn't hurt to have it in both places, so let's roll with it

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Implementation and scaffolding
+
+The following steps are REQUIRED for creating a new use case:
```

</details>

#### **philipwalton** on `.agents/skills/project-use-cases/SKILL.md`
> That makes sense if you want to just stick to the sources, but I think there are cases where you actually want to agent to find sources that you weren't aware existed.
> 
> For example, when I did Deep Research in the Gemini App for the `fetchLater()` API, it found an obscure discussion about cross-origin fetch quota that is relevant for Ad Tech use cases, which I was not aware of.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Manual research and discovery
+
+Use Deep Research in NotebookLM to discover sources and real-world implementations you might not be aware of. Focus on finding complex edge cases, performance implications, and emerging best practices. Deep Research is particularly effective at surfacing GitHub discussions, W3C specifications, and developer blog posts that highlight non-obvious constraints.
```

</details>

#### **rviscomi** on `.agents/skills/project-use-cases/SKILL.md`
> Yeah, NotebookLM will also do the deep research to find additional sources on top of the ones you provide in the prompt.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Manual research and discovery
+
+Use Deep Research in NotebookLM to discover sources and real-world implementations you might not be aware of. Focus on finding complex edge cases, performance implications, and emerging best practices. Deep Research is particularly effective at surfacing GitHub discussions, W3C specifications, and developer blog posts that highlight non-obvious constraints.
```

</details>

---

## PR #294: Sync use case priority with feature

### Reviews

#### **philipwalton** (APPROVED)
*(No review body)*

---

## PR #293: feat: Add use cases for CSS @function

### Reviews

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (APPROVED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/fluid-sizing-calculation/guide.md`
> ```suggestion
> description: Reduce excessive style repetition by encapsulating complex or dynamic styling logic into reusable functions (such as a function that computes a fluid size value based on a set of input parameters).
> ```
> 
> I would generalize this use case, while still offering your specific one as an example.
> 
> Also, the original framing is fairly similar to [this previously-submitted use case](https://github.com/GoogleChrome/guidance/blob/main/guides/user-experience/fluid-scaling/guide.md), so it's good to be distinct: 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,10 @@
+---
+name: fluid-sizing-calculation
+description: Encapsulate complex fluid sizing calculations into a reusable CSS custom function with @function.
```

</details>

#### **philipwalton** on `guides/performance/avoid-javascript-style-calculators/guide.md`
> TBH, I'm not sure this use case makes sense. I mean, the use case itself is fine, but I don't know if `@function()` is the appropriate recommendation, since there are many other ways to do this with pure CSS that don't involving using `@function()`.
> 
> My recommendation would be to drop this one and just stick with your other use case.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,10 @@
+---
+name: avoid-javascript-style-calculators
+description: Eliminate main-thread blocking JavaScript event listeners and layout thrashing by encapsulating conditional style computations directly in CSS with @function.
```

</details>

#### **philipwalton** on `guides/user-experience/fluid-sizing-calculation/guide.md`
> ```suggestion
> name: reduce-style-repetition
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,10 @@
+---
+name: fluid-sizing-calculation
```

</details>

#### **philipwalton** on `guides/user-experience/fluid-sizing-calculation/guide.md`
> Another potential use case (that is arguably a subset of this use case), would be something like:
> 
> - **`improve-style-readability`:** Encapsulate complex or hard-to-understand style logic into self-documenting style functions that clearly communicate the intent of the code.
> 
> ...though arguably this is getting into skills territory. WDYT?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,10 @@
+---
+name: fluid-sizing-calculation
+description: Encapsulate complex fluid sizing calculations into a reusable CSS custom function with @function.
```

</details>

---

## PR #280: Adds the top-level await use case.

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (APPROVED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/performance/condition-polyfill-loading-top-level-await/guide.md`
> ```suggestion
> description: Conditionally load or initialize async dependencies (such as importing polyfills for missing web features) without requiring complex orchestration across all of a page's script dependencies.
> ```
> 
> Generalized to include more cases. Also removed the mention of the feature in the use case description.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: conditional-polyfill-loading-top-level-await
+description: Use top-level await to conditionally and asynchronously load polyfills for missing web features without disrupting developer ergonomics and the order of parsing and exectuon of modules.
```

</details>

#### **philipwalton** on `guides/performance/condition-polyfill-loading-top-level-await/guide.md`
> ```suggestion
> name: conditional-async-dependencies
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: conditional-polyfill-loading-top-level-await
```

</details>

---

## PR #279: Add demoes for Scheduler API use cases

### Reviews

#### **philipwalton** (APPROVED)
> Nice demos!

---

## PR #269: Add Guides for Scroll-Driven Animations Use-Cases

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/carousel-item-effects/guide.md`
> This reads like defining a "center" value is required. I'd clarify that you can define keyframes for any part of the animations, and then give "center" as one such example.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+    </ul>
+    ```
+
+2.  **Define the animation:** Create a CSS animation that defines the different states of your slides as they enter, center, and exit the scrollport. For example, you can use the `scale` property to make the slides grow as they approach the center and shrink as they move away.
```

</details>

#### **philipwalton** on `guides/user-experience/carousel-item-effects/guide.md`
> This might be obvious for the agent, but I'd include the CSS code needed to make the container a scroller.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+Here’s how to create carousel slide effects:
+
+1.  **Create a scroller:** This element will act as the container for your carousel slides.
```

</details>

#### **philipwalton** on `guides/user-experience/carousel-item-effects/guide.md`
> If you want to include this example, then I'd add some comments to explain this code a bit more. I have no idea how to properly define a named view timeline based on just this example, and I'm not sure if I AI could figure it out either.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+}
+
+.scroller > * {
+  view-timeline: --item inline;
```

</details>

#### **philipwalton** on `guides/user-experience/carousel-item-effects/guide.md`
> In this case, multiple elements are animating aren't they (e.g. multiple carousel items)? But I suspect you didn't mean "multiple" in that sense, so if I'm right then I'd clarify this a bit more.
> 
> I'd also clarify exactly what "tracked subject" means.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+}
+```
+
+Prefer a named `view-timeline` when multiple elements or children of the tracked subject need to animate.
```

</details>

#### **philipwalton** on `guides/user-experience/carousel-item-effects/guide.md`
> I *think* I understand what this means, but it's a bit fuzzy so I'd just be a bit more explicit.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+When using the `view()` function to create a scroll-driven animation:
+
+- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `view(block)` or `view(inline)`.
+- When the animation is not applied to the tracked subject itself, use a named view timeline.
```

</details>

#### **philipwalton** on `guides/user-experience/carousel-item-effects/guide.md`
> ```suggestion
> - **DO** use a CSS `<dashed-ident>` for the name (e.g. `view-timeline: --my-custom-name`)
> ```
> 
> Just to be explicit about what a dashed-ident is.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+When using the `view-timeline` property to create a scroll-driven animation:
+
+- **DO** use a CSS `<dashed-ident>` for the name.
```

</details>

#### **philipwalton** on `guides/user-experience/carousel-item-effects/guide.md`
> This is also a bit fuzzy, and at this point I'm wondering if the use of named view timelines just doesn't belong in this use case (and it would be clearer in a use case where using it is the recommendation). I'll revisit this comment after reviewing the rest of the guides.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+- **DO** use a CSS `<dashed-ident>` for the name.
+- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `view-timeline-axis`.
+- **DO** make sure the scope of the lookup works: When the element that is declaring the `view-timeline` is not a flat tree ancestor of the animated element, hoist up the visibility of the `view-timeline`’s name by using `timeline-scope` on a shared ancestor.
```

</details>

#### **philipwalton** on `guides/user-experience/parallax-scroll-effects/guide.md`
> ```suggestion
> A parallax effect on scroll is a visual technique where different layers of content move at varying speeds as the user scrolls down a page. This creates an illusion of depth, with foreground elements appearing to move faster than the background elements, resulting in an engaging and immersive browsing experience. This effect is best achieved using CSS Scroll-Driven Animations, which allow you to link animations to the scroll position of a container.
> ```
> 
> Should we make this recommendation stronger?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+# Build a Parallax Effect on Scroll
+
+A parallax effect on scroll is a visual technique where different layers of content move at varying speeds as the user scrolls down a page. This creates an illusion of depth, with foreground elements appearing to move faster than the background elements, resulting in an engaging and immersive browsing experience. This effect can be achieved using CSS Scroll-Driven Animations, which allow you to link animations to the scroll position of a container.
```

</details>

#### **philipwalton** on `guides/user-experience/parallax-scroll-effects/guide.md`
> Can the wrapper be the `<html>` or `<body>` elements? If so then maybe say "define the wrapper"?
> 
> Also same comment as on the other guide about showing how to make this a scrollable container.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+Here’s how to create a basic parallax effect:
+
+1.  **Create a wrapper element:** This element will contain all the layers of your parallax animation.
```

</details>

#### **philipwalton** on `guides/user-experience/parallax-scroll-effects/guide.md`
> I think using `sibling-index()` makes sense in your demos since it has lots of layers, but would this really make sense in a typical parallax example, which would likely just have one foreground (text) and one background (image) layer—and only the background layer is moving at a different speed?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+5.  **Stagger the animations:** To make the layers move at different speeds, you can use one of two approaches:
+
+    *   **Using `sibling-index()` in the keyframes:** This is the simplest approach. The `sibling-index()` function returns the index of a child element amongst its siblings, which you can then use in your keyframes to create a staggered effect.
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-entry-exit-effects/guide.md`
> Might want to add a comment here to the effect of: "Customize this to match the logic defined in your CSS."

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+    const observer = new IntersectionObserver(
+      (entries) => {
+        for (const entry of entries) {
+          entry.target.style.scale = 0.5 + entry.intersectionRatio * 0.5;
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-entry-exit-effects/guide.md`
> Gross, but I like it :)

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+        }
+      },
+      {
+        threshold: Array.from({ length: 101 }, (_, i) => i / 100),
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-entry-exit-effects/guide.md`
> I think including this is fine, but at the same time I suspect the AI will be able to figure out what's going on in your fallback example, so maybe it's not needed? (The evals would be able to answer this question.)

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+</script>
+```
+
+This script first checks if the browser supports `animation-timeline: view()` and `animation-range: entry`. If not, it creates an `IntersectionObserver` that will fire a callback whenever one of the observed elements intersects with the viewport.
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-progress-indicator/guide.md`
> Similar to above, I think the AI can figure this out and this paragraph is likely not needed.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+</script>
+```
+
+This script first checks if `animation-timeline: scroll()` is supported. If not, it adds a scroll event listener to the `window`. In the event listener, it calculates the scroll progress as a percentage and updates the `scaleX` of the `#progress` element. This provides a similar visual effect for browsers that don't yet support the CSS feature.
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-progress-indicator/guide.md`
> I wonder if a stronger recommendation should be made here (and in the fallback section of the other use case guides as well).
> 
> Something like: "...even though Scroll Driven Animations are not yet Baseline Widely available, given their performance benefits, they should still be preferred on browsers that support them..."

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+{{ BASELINE_STATUS("scroll-driven-animations") }}. Therefore, a fallback strategy is typically required.
+
+While browser support for scroll-driven animations is improving, a fallback is still necessary. You can use JavaScript to create a similar effect.
```

</details>

#### **philipwalton** on `guides/user-experience/parallax-scroll-effects/guide.md`
> I'd remove this unless we're saying the use case should not be implemented without it (see other comments for more context).

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
 description: Create scroll-based effects (such as parallax) where foreground and background layers move at different rates, creating a sense of depth as the user scrolls.
 web-feature-ids:
   - scroll-driven-animations
+  - sibling-count
```

</details>

#### **philipwalton** on `guides/user-experience/shrinking-header-on-scroll/guide.md`
> I'm confused by this example because it comes right after a tip but then it doesn't show what's mentioned in the tip. Should this example be moved up above the tip?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+**Tip:** When your header shrinks from a large height (e.g., `100vh`) to a smaller one (e.g., `10vh`), the `animation-range-end` should be the difference between the start and end sizes (e.g., `90vh`). This ensures the animation completes precisely when the header reaches its final size.
+
+
+## Example code
```

</details>

---

## PR #260: Add use cases for anchor positioning

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
> Thanks @taraojo, I made a few suggestions.
> 
> In addition to these use cases, I think you might also want to also include the following:
> - Transition an element seamlessly between two target element positions. For example: moving a selected tab underline between the previously selected tab and the currently selected tab (note: your carousel demo does this)
> - Create footnotes/sidenotes, comments, or other text annotations that are positioned in the margins of a page next to the text they're referencing.

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (APPROVED)
> LGTM. I updated the demos and use case description a bit.

### Comments

#### **philipwalton** on `guides/user-experience/advanced-carousels-and-scroll-linked-indicators/guide.md`
> I think this is too specific.
> 
> The more general framing would be any complex component that contains visual elements that should be positioned relative to the component itself (e.g. top-left corner, centered at the bottom, etc.). Then you could use carousel dot markers and next/prev buttons as an example.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,8 @@
+---
+name: advanced-carousels-and-scroll-linked-indicators
+description: Build interactive, horizontally scrolling content galleries or hero image sliders that require synchronized pagination dots with visual highlights tethered to current elements.
```

</details>

#### **philipwalton** on `guides/user-experience/animate-popover-preview/guide.md`
> This doesn't seem like a use case that is specific to anchor positioning. It seems to be mostly about starting-style and transition-behavior.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: animate-popover-preview
+description: Implement smooth entry and exit transitions for elements toggling their visibility state for overlay components shown from a hidden state, making it an accessible option for e-commerce galleries, contextual product cards, and detailed tooltip interactions.
```

</details>

#### **philipwalton** on `guides/user-experience/customizable-native-select-elements/guide.md`
> I think this description focuses too much on customizable select. Anchor positioning is useful for any type of dropdown menu, whether that be a `<select>` dropdown or a sub-menu in a nav bar.
> 
> I'd generalize this to focus on the core anchor positioning features:
> - Positioning the dropdown relative to another element
> - Automatic repositioning when space is limited in a given direction

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,7 @@
+---
+name: customizable-native-select-elements
+description: Create visually rich, accessible dropdown options, such as injecting icons, profile avatars, or secondary text layouts inside form selection inputs, anchoring the menu to the trigger element.
```

</details>

#### **philipwalton** on `guides/user-experience/resilient-context-menus-and-nested-dropdowns/guide.md`
> If you generalize the previous use case, then I think it's basically the same as this one, so you can probably combine the two.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,7 @@
+---
+name: resilient-context-menus-and-nested-dropdowns
+description: Build accessible, responsive menus, tooltips, or contextual overlays that must be tethered to specific UI elements, guaranteeing that the overlay automatically repositions itself (e.g., flipping axes) when it encounters viewport edges, ensuring it never gets cut off.
```

</details>

#### **philipwalton** on `guides/user-experience/animate-popover-preview/guide.md`
> If I'm understanding the use case correctly, I think this is covered by #229 and #230 from `transition-behavior`.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: animate-popover-preview
+description: Implement smooth entry and exit transitions for elements toggling their visibility state for overlay components shown from a hidden state, making it an accessible option for e-commerce galleries, contextual product cards, and detailed tooltip interactions.
```

</details>

---

## PR #248: Adding `text-box` use case

### Reviews

#### **philipwalton** (APPROVED)
> Thanks! I tweaked the use case description slightly to broaden it's scope.

---

## PR #221: replace manual frontmatter parsing with gray-matter

### Reviews

#### **rviscomi** (APPROVED)
*(No review body)*

---

## PR #218: Add guide for Language Detection

### Reviews

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (APPROVED)
> LGTM!
> 
> As a next step, after you've written the guidance, rerun `gd dev` to generate the task.md file and make sure everything is calibrated and passing.

### Comments

#### **rviscomi** on `README.md`
> @tomayac could you move non-guidance changes like this to a separate PR?

#### **rviscomi** on `guides/built-in-ai/language-detection/guide.md`
> ```suggestion
>   - languagedetector
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+name: language-detection
+description: Detect the language of user-generated content or already present site content.
+web-feature-ids:
+    - LanguageDetector
```

</details>

---

## PR #217: Add Scroll-Driven Animations Use-Cases and Demos

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
> Thanks for the extensive set of demos and use cases!
> 
> I made several suggestions for how to reword some of the use case description to be more active, and I also suggested combining/dropping a few of the use cases.
> 
> Some other potential use cases that I don't think are covered  by the ones you listed:
> - **Scroll more indicators:** shadows or other effects that indicate to the user that an element can be scrolled beyond where it currently is.
> - **Backdrop fade with UI sheet dismiss:** create an effect with swipeable UI sheets where the backdrop fades in/out as the sheet enters/exits.
> 
> WDYT?

#### **philipwalton** (APPROVED)
> Thanks @bramus, this looks great! I just left a few minor comments.

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/3d-model-explorer/guide.md`
> I think this use case may be too niche to include. We're aiming for 2-5 core use cases per feature for the initial launch, so I think it'd be fine to omit this one.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: 3d-model-explorer
+description: Rotate a 3D model on scroll.
```

</details>

#### **philipwalton** on `guides/user-experience/carousel-item-effects/guide.md`
> ```suggestion
> description: Create a carousel of slides with images or other visual elements, where each slide animates as they enter/center/exit their scroller. For example, the slides may fade-in/fade-out, rotate, get bigger or smaller, etc.
> ```
> 
> Reworded to be phrased more actively, and I used the term "slide" which I think is more common for carousels?
> 
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,10 @@
+---
+name: carousel-item-effects
+description: A carousel where the entries animate as they enter/center/exit their scroller. The items can fade-in/fade-out, rotate, get bigger or smaller, etc.
```

</details>

#### **philipwalton** on `guides/user-experience/carousel-step-indicator/guide.md`
> Do you think this use case is sufficiently distinct from the `scroll-progress-indicator` use case below (which is more general and could potentially cover this one)?
> 
> I do think people think of the "dot indicators" patterns in a carousel as being distinct from scroll progress indicators, but then there's also the question of whether you should use SDA or `::scroll-marker` for that. WDYT?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: carousel-step-indicator
+description: A stepped progress or indicator bar shown above an image carousel that grows to indicate which item the user is currently viewing.
```

</details>

#### **philipwalton** on `guides/user-experience/cover-image-to-fixed-header/guide.md`
> IMO this one could be merged into the `shrinking-header-on-scroll` use case (since that one is more common).
> 
> While I get that the visual effects are different, the guidance will likely be mostly the same, and a user prompt would likely to match both guides (which would duplicate tokens unnecessarily, and isn't ideal).

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: cover-image-to-fixed-header
+description: A full-page cover image that dynamically shrinks and transforms into a fixed header as the user scrolls down the page.
```

</details>

#### **philipwalton** on `guides/user-experience/horizontal-scroll-section/guide.md`
> I wonder if this could be expanded into a more generalized "scrollytelling" use case, and then this specific example could be included in the guide. WDYT?
> 
> My concern with the current framing is I think it'd be unlikely to match many user prompts.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: horizontal-scroll-section
+description: A layout technique where a horizontal strip of content scrolls by horizontally as the user scrolls vertically down the page.
```

</details>

#### **philipwalton** on `guides/user-experience/parallax-animation/guide.md`
> ```suggestion
> description: Create scroll-based effects (such as parallax) where foreground and background layers move at different rates, creating a sense of depth as the user scrolls.
> ```
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: parallax-animation
+description: Images or Layers of content that move at a slower or different speed relative to the scrolling content, yielding a 3D depth or parallax effect.
```

</details>

#### **philipwalton** on `guides/user-experience/reveal-and-unreveal-effects-for-items-in-list/guide.md`
> This is pretty similar to `carousel-item-effects`.
> 
> I think if one is frames as being specific to a "carousel" (and focused on horizontal scroll) and the other is for standard page content (focused on vertical scroll) then they could work as separate use cases ... but I could also seem them being combined into a single use case and guide that covers both.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: reveal-and-unreveal-effects-for-items-in-list
+description: Items that animate in and out as they enter or exit their scrollport.
```

</details>

#### **philipwalton** on `guides/user-experience/reverse-scrolling-columns/guide.md`
> I really like this visual effect, but I also think it's niche and is unlikely to match many user prompts. I'd be OK with dropping this one for the initial launch.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: reverse-scrolling-columns
+description: A multi-column layout where a central column follows the regular scroll direction, while the surrounding columns are animated to scroll in the opposite direction.
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-progress-indicator/guide.md`
> ```suggestion
> description: Create a scroll progress bars, step trackers, or any visual affordance that communicates how far through a page or section the user has scrolled.
> ```
> 
> Per my comments above, I think `carousel-step-indicator` above can likely be merged with this one.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,8 @@
+---
+name: scroll-progress-indicator
+description: A progress bar at the top of the scrollport that grows until it takes up the full width upon reaching the end of the document, indicating how far down you have scrolled.
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-velocity-effects/guide.md`
> Similar to my other comments, I really like this visual effect, but I also think it's niche and is unlikely to match many user prompts. I'd be OK with dropping this one for the initial launch.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,8 @@
+---
+name: scroll-velocity-effects
+description: Animate elements on scroll based on scroll velocity and direction, applying dynamic visual changes like skewing or motion blur.
```

</details>

#### **philipwalton** on `guides/user-experience/self-revealing-images-on-scroll/guide.md`
> ```suggestion
> description: Create fade-in, scale-up, or other complex reveal-type effects on elements as they enter and exit the viewport while the user is scrolling
> ```
> I think is a good use case, but can probably be generalize to be about more than images. And I think this could satisfy my comment in https://github.com/GoogleChrome/guidance/pull/217/changes#r2898646830 re: vertical based scroll reveals.
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: self-revealing-images-on-scroll
+description: Images that reveal themselves dynamically as they enter the scrollport, often using an animated "open curtain" clip-path effect.
```

</details>

#### **philipwalton** on `guides/user-experience/shrinking-header-on-scroll/guide.md`
> ```suggestion
> description: Create a large header bar that stays fixed to the top but shrinks in size (along with other effects like adding a shadow) as the user scrolls down.
> ```
> 
> As mentioned above, I think the `cover-image-to-fixed-header` use case can be merged into this one.
> 
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: shrinking-header-on-scroll
+description: A sticky top navigation bar that minimizes in size and gains a drop shadow effect as the user scrolls down the web app.
```

</details>

#### **philipwalton** on `guides/user-experience/stacking-cards/guide.md`
> I really like this effect (also [this one](https://chrome.dev/carousel/horizontal/app-switcher/)), but I worry it's too niche to match any user prompts...

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: stacking-cards
+description: A set of elements that animate on scroll from the moment they get stuck until the next item in the list is stuck
```

</details>

#### **philipwalton** on `guides/user-experience/text-reveal-character-by-character/guide.md`
> I think text reveal is a really common use case, but it's not usually done on scroll. I worry this guide could match people wanting to do other text-reveal type effects which could create issues. I'd be fine to drop this as well.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,8 @@
+---
+name: text-reveal-character-by-character
+description: Text that gradually reveals itself character by character as the overall progress of a scroller advances to the end of the page.
```

</details>

#### **philipwalton** on `guides/user-experience/carousel-item-effects/guide.md`
> ```suggestion
> name: carousel-slide-effects
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,10 @@
+---
+name: carousel-item-effects
```

</details>

#### **philipwalton** on `guides/user-experience/self-revealing-images-on-scroll/guide.md`
> ```suggestion
> name: scroll-entry-exit-effects
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: self-revealing-images-on-scroll
```

</details>

---

## PR #206: update console log path for showing report to remove 'guides' since w…

### Reviews

#### **rviscomi** (APPROVED)
*(No review body)*

---

## PR #203: guides: automated grader calibration

### Reviews

#### **rviscomi** (APPROVED)
*(No review body)*

---

## PR #202: Fetch priority guides, expectations, prompts

### Reviews

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **malchata** (COMMENTED)
> Some nits and observations.

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

### Comments

#### **rviscomi** on `guides/performance/deprioritize-background-fetches/guide.md`
> Good catch, yeah I meant to say "not Baseline Widely available"
> 
> Once https://github.com/GoogleChrome/guidance/pull/185 is merged this will be replaced with the macro which will keep the Baseline status in sync with web-features

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+### Fetch Priority
+
+The Fetch Priority API is not Baseline.
+
```

</details>

#### **rviscomi** on `guides/performance/optimize-image-priority/guide.md`
> I don't think we need to do that much more convincing. If the agent is reading this, it's already committed to following the guide. 
> 
> Was there anything problematic in the original text?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+# Optimize image priority
+
+Browsers use heuristics to assign loading priorities to images, but these defaults may not always align with your page's Largest Contentful Paint (LCP). Using `fetchpriority` on an `<img>` element allows you to explicitly signal an image's importance to the browser, ensuring critical images load faster while non-essential ones don't compete for bandwidth.
```

</details>

---

## PR #201: Remove deep-link-to-hidden-content use case

### Reviews

#### **philipwalton** (COMMENTED)
> Great demo! Though now that I see the demo, I'm thinking maybe we should slightly change the wording of the use case.
> 
> With the current phrasing of the use case, I'd expect the guide to explain how to add text fragments to URLs. But I think what you're actually wanting to show is how to structure your page content so that hidden content *can* be deep-linked to via URL fragments, correct?
> 
> If so, then how about rewording the use case to this:
> 
> "Enable visually hidden content (for example in collapsed accordions, closed tabs, or below "Read more" sections) to be deep linked to via URL fragments and "Scroll to Text Fragment" links."

#### **philipwalton** (APPROVED)
*(No review body)*

---

## PR #199: Add guides for `scroll-initial-target` use cases

### Reviews

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (APPROVED)
> I was curious to see how well AI could address all of the comments I made on this PR, and it actually did a really good job! So I decided to just push all of those changes.
> 
> This was the prompt I used (note, I have GitHub CLI installed locally, which it used without being asked to):
> 
> > Read the feedback for this PR (199) and address all of the comments

### Comments

#### **philipwalton** on `guides/user-experience/focus-chat-message/expectations.md`
> I don't believe that scroll snap needs to be used. And TBH for a messages app, I think it makes more sense not to.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,7 @@
+- The `scroll-initial-target` property must be applied directly to the **child element** (the target) that needs to be scrolled into view, not to its scroll container. The parent scroll container must be a scroll snap container (e.g., using `overflow-y: auto` and `scroll-snap-type: y mandatory`) and the child must have a scroll snap alignment (e.g., `scroll-snap-align: start`).
```

</details>

#### **philipwalton** on `guides/user-experience/focus-chat-message/expectations.md`
> Most of the bullet point here are true statements about the API, but they're not really "expectations"—meaning they're not something we could write a test for to evaluate whether the AI tool correctly followed the guide.

#### **philipwalton** on `guides/user-experience/focus-chat-message/guide.md`
> I know I already approved these use cases, but now that this guide and the `focus-item-in-carousel` are 99% the same, I think it makes sense to combine and generalize.
> 
> How about combining these two into the following use case: "Build a scrollable list view component (such as an image carousel or a chat conversation view) that can render with a specific item initially scrolled into view."

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
 ---
-name: chat-message-search
+name: focus-chat-message
 description: Build a chat message feature that can display a conversation automatically scrolled to a specific message (e.g. matching a search query) on initial render.
```

</details>

#### **philipwalton** on `guides/user-experience/focus-chat-message/guide.md`
> Setting scroll snap properties on the container should be presented as optional, not manditory. It works well for use cases like a photo carousel, but I don't think I'd recommend it for a chat conversation view because there I'd expect the scrolling to be smooth.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+The `scroll-initial-target` property allows you to declaratively set which child element should be scrolled into view when a scroll container is first displayed.
+
+To implement this:
+1. Ensure the parent element is a scroll container with scroll snapping (e.g., `overflow-y: auto` and `scroll-snap-type: y mandatory`).
```

</details>

#### **philipwalton** on `guides/user-experience/focus-chat-message/guide.md`
> Here I'd give two examples to show various ways to implement this use case:
> 1. A horizontal scrolling image carousel (with scroll snaping), initially scrolled to the middle item
> 2. A vertical scrolling chat conversation view (without snapping), scrolled all the say to the bottom message (or to a specific message, e.g. matching a search query).

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+When multiple elements specify an initial target within the same container, the user agent selects the one which comes first in the tree order. Once the user manually scrolls or an explicit programmatic scroll is triggered, the initial target isn't active anymore and the scroll container can be freely scrolled.
+
+## Example code
```

</details>

#### **philipwalton** on `guides/user-experience/focus-chat-message/guide.md`
> Add these as `sources` in the YAML front matter.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+You can leave the default scroll position as a safe fallback for progressive enhancement if the specific target content isn't critical for the initial view.
+
+## References
```

</details>

#### **philipwalton** on `guides/user-experience/focus-chat-message/guide.md`
> ```suggestion
>   - scroll-initial-target
>   - scroll-into-view
>   - scroll-snap
> ```
> 
> Add all features that are mentioned in the guide.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+name: focus-chat-message
 description: Build a chat message feature that can display a conversation automatically scrolled to a specific message (e.g. matching a search query) on initial render.
 web-feature-ids:
   - scroll-initial-target
```

</details>

#### **philipwalton** on `guides/user-experience/pull-to-reveal/guide.md`
> Similar to the other use case. This isn't actually required to make this work.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+The `scroll-initial-target` property allows you to declaratively set which child element should be scrolled into view when a scroll container is first displayed.
+
+To implement this:
+1. Ensure the parent element is a scroll container with scroll snapping (e.g., `overflow-y: auto` and `scroll-snap-type: y mandatory`).
```

</details>

#### **philipwalton** on `guides/user-experience/pull-to-reveal/guide.md`
> This contradicts (2) above?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+ * Make sure that once the target is revealed, the user can search freely.
+ */
+.main-content {
+  scroll-snap-align: none;
```

</details>

#### **philipwalton** on `guides/user-experience/pull-to-reveal/guide.md`
> Moves these to `sources` in the YAML front matter.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+You can leave the default scroll position as a safe fallback for progressive enhancement if the specific target content isn't critical for the initial view (users will just see the search bar immediately instead of having to pull to reveal it).
+
+## References
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> ```suggestion
> name: scroll-target-on-load
> ```
> 
> WDYT?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,75 @@
+---
+name: mixed-media-scroll-view
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> ```suggestion
> description: Build a scrollable list of elements (e.g. a carousel of images or a chat conversation thread) that can be displayed with a particular element scrolled into view on the initial render).
> ```
> 
> I think this new working might be a bit too broad now. I know we've gone back and forth on this, so I left a description that I think works well and is a mix of general and specific.
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,75 @@
+---
+name: mixed-media-scroll-view
+description: Build a single scrollable feed with mixed media and text that automatically renders with a specific media item scrolled into view.
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> ```suggestion
> ```
> 
> I don't think scroll-snap is required for this use case.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+web-feature-ids:
+  - scroll-initial-target
+  - scroll-into-view
+  - scroll-snap
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> ```suggestion
> # Set a scroll target for the initial render
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  - https://webstatus.dev/features/scroll-initial-target
+---
+
+# Mixed Media Scroll View
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> 
> 
> I think the main issue with `Element.scrollIntoView()` is that it's very tricky to get the timing right. If you call it before the element is rendered, nothing happens. But if you call it after the element is rendered, then you see a flash of the initial state before then seeing the updated state.
> 
> And the issue with fragment identifiers is they don't for any scroll container other than the root scroller.
> 
> 
> ```suggestion
> The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific child element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#item-id`) both of which have limitations and are tricky to implement.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+# Mixed Media Scroll View
+
+The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific child element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#item-id`) to position a feed—both of which can cause layout shifts or conflict with user navigation.
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> ```suggestion
> ```
> 
> I think you can drop this, as it's largely a repeat of what you have above. It's fine to go straight into the instructions list.
> 
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## How to Implement
+
+The `scroll-initial-target` property allows you to set which child element should be the starting point of a scroll container. This is particularly effective for mixed-media feeds where content height is unpredictable.
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> I'm not sure if we need this step? The use case implies that there already is a scrollable container, so I think it's fine to omit this.
> 
> Also I don't think we need to mention that scroll snap is not required.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+To implement this successfully:
+
+1.  **Define the Container:** Ensure the parent element is a scroll container. You do not need to enforce `scroll-snap-type` if you want users to scroll freely after the initial load.
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> Nit: technically the target doesn't need to be an immediate child of the scroll. For the sake of clarity, I'd use the term "descendant" instead.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+To implement this successfully:
+
+1.  **Define the Container:** Ensure the parent element is a scroll container. You do not need to enforce `scroll-snap-type` if you want users to scroll freely after the initial load.
+2.  **Target the Item:** Apply `scroll-initial-target: nearest` to the specific child element you want to bring into view. You do not need to apply `scroll-snap-align` to the feed items, allowing the scrolling experience to remain smooth and native without forced snapping.
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> ```suggestion
> In this example, a feed starts scrolled to a specific "featured" item rather than the very top of the list.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Example Code: Vertical Media Feed
+
+In this example, the feed starts focused on a specific "featured" item rather than the very top of the list.
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-target-on-load/guide.md`
> Ooohh, I like the calendar starting on the current day example :)

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Strategic Implementation & Best Practices
+
+- **DO** use `scroll-initial-target` for "middle-start" experiences, such as a calendar starting on the current day or a gallery starting on a specific image.
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> What is `scroll-start`?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- **DO** use `scroll-initial-target` for "middle-start" experiences, such as a calendar starting on the current day or a gallery starting on a specific image.
+- **DO NOT** confuse this with accessibility focus. This property only moves the **visual** viewport; it does not move the keyboard focus. You must manually manage `element.focus()` if the target is intended to be the starting point for keyboard users.
+- **DO NOT** use this if you need a smooth "scrolling" animation on load; this property is discrete and sets the position instantly during the layout phase.
+- **DO** account for the **Precedence Hierarchy**: A URL fragment (e.g., `example.com/#top`) and the container-level `scroll-start` property both take precedence over `scroll-initial-target`.
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> I wouldn't recommend waiting until load, or the initial scroll position will be visible for a bit. Also, if you follow the best practices outlined above, you don't need to wait until load to layout images.
> 
> I think DOMContentLoaded is a better general recommendation than load, but in my experience it's best to put the script immediately after the DOM node (though I know that's not always possible).

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Fallback Strategy
+
+For browsers that do not yet support the API, use a JavaScript fallback. For feeds containing images or mixed media, use the `window.load` event to ensure the browser has calculated the full height of all elements before triggering the scroll.
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-target-on-load/guide.md`
> I'd remove this timeout, as it shouldn't be needed if following best practices.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+document.addEventListener("DOMContentLoaded", () => {
+  // Check for native CSS support
+  if (!CSS.supports("scroll-initial-target", "nearest")) {
+    setTimeout(() => {
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-target-on-load/guide.md`
> Yes, but I don't think this matches the behavior of `scroll-initial-target`? (Unless you're using scroll snapping)

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+      const feedTarget = document.querySelector(".item.target");
+
+      if (feedTarget) {
+        // 'block: center' ensures the featured media is centered in view
```

</details>

#### **philipwalton** on `guides/user-experience/pull-to-reveal/guide.md`
> Couldn't this be done with the root scroller? Do you really need to define your own scroll container?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+To implement this successfully:
+
+1.  **Define the Container:** The parent element must be a scroll container and can optionally add `scroll-snap-type`.
```

</details>

#### **philipwalton** on `guides/user-experience/pull-to-reveal/guide.md`
> In your demo, if I remove all the scroll snap stuff, it works fine (AFAICT).
> 
> If that's true, then this shouldn't be marked as mandatory. But I do think it should be stated as a recommendation to ensure that the search bar is always either fully visible or fully hidden.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+To implement this successfully:
+
+1.  **Define the Container:** The parent element must be a scroll container and can optionally add `scroll-snap-type`.
+2.  **Set Alignment (Required):** Apply `scroll-snap-align` (e.g., `start`) to the child elements. **Note:** If the child's alignment is `none` (the default), `scroll-initial-target` will not function because the browser has no reference point for positioning.
```

</details>

#### **philipwalton** on `guides/user-experience/pull-to-reveal/guide.md`
> ```suggestion
> 3.  **Target the Item:** Apply `scroll-initial-target: nearest` to the specific descendant element you want to snap into view.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+1.  **Define the Container:** The parent element must be a scroll container and can optionally add `scroll-snap-type`.
+2.  **Set Alignment (Required):** Apply `scroll-snap-align` (e.g., `start`) to the child elements. **Note:** If the child's alignment is `none` (the default), `scroll-initial-target` will not function because the browser has no reference point for positioning.
+3.  **Target the Item:** Apply `scroll-initial-target: nearest` to the specific child element you want to snap into view.
```

</details>

#### **philipwalton** on `guides/user-experience/pull-to-reveal/guide.md`
> ```suggestion
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## How to Implement
+
+The `scroll-initial-target` property allows you to declaratively set which child element should be scrolled into view when a scroll container is first displayed.
```

</details>

#### **philipwalton** on `guides/user-experience/pull-to-reveal/guide.md`
> This conflicts what you said above, right?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+.scroll-container {
+  height: 100vh;
+  overflow-y: auto;
+  /* Optional: Enables snapping for subsequent user scrolls */
```

</details>

#### **philipwalton** on `guides/user-experience/pull-to-reveal/guide.md`
> Change parent/child to ancestor/descendant here (and throughout).

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+> **The "First-Wins" Rule:** If multiple elements within the same container specify `nearest`, the browser selects the one that appears first in the DOM tree order.
+
+## Example Code: Pull to Reveal Search
```

</details>

---

## PR #197: Add invoker-command API use cases

### Reviews

#### **philipwalton** (APPROVED)
> I tweaked these use cases slightly and added demos.

---

## PR #188: Add expecations, demo, and prompts: `autofill`

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (APPROVED)
> Thanks! In the interest of moving this forward, I'm going to merge this as an LGTM for the use cases, and then we can we can discuss the expectations and demos in the PR(s) for the use case guides.

### Comments

#### **philipwalton** on `guides/user-experience/autofill/demo.html`
> There are a number of commented out lines in this file. Can you review and, for each commented out line or section, either:
> 1. Delete it
> 2. Add a contextual comment explaining why you might want to uncomment the line

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  <meta http-equiv="X-UA-Compatible" content="IE=edge">
+  <meta name="viewport" content="width=device-width, initial-scale=1">
+
+  <!-- <link rel="stylesheet" href="css/main.css"> -->
```

</details>

#### **philipwalton** on `guides/user-experience/autofill/expectations.md`
> Most of these look good as a set of best practices, but just FYI, the point of the `expectations.md` file is not to list the best practices; rather, it's to evaluate whether or not the agent correctly followed the instructions in `guide.md`, which means these bullets need to be concrete enough that a test could be written for them (and phrases like "Keep form pages visually simple, with clear calls to action" are not).
> 
> My suggestion would be that we scope these expectations down to things that are specific to testing a correct implementation of `<form>` autofill best practices.
> 
> Then, anything that's not directly related to autofill can be put into a `SKILL.md` that covers form best practices. Our plan is to tackles skills after we tackle the use cases.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,54 @@
+# Expectations: `autofill`
```

</details>

#### **philipwalton** on `guides/user-experience/autofill/autofill-sign-in-form/expectations.md`
> Is this true? Why does this matter?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- An `<input>` element **MUST** include a `type` attribute if available, for example for email, password, telephone, or  URL entry.
+- Every `<input>`, `<select>`, or `<textarea>` element in a form **MUST** have an `id` attribute and a `name` attribute with a non-empty value.
+- `id` and `name` attributes **MUST** be unique to each element. `id` and `name` attributes **MUST NOT** be the same for multiple elements.
+- The value of the `id` and `name` attributes of a form element **SHOULD** be the same.
```

</details>

#### **philipwalton** on `guides/user-experience/autofill/autofill-sign-in-form/expectations.md`
> What about inputs that are wrapped in a label?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- The value of the `id` and `name` attributes of a form element **SHOULD** be the same.
+- A `pattern` attribute **SHOULD** be provided when appropriate to validate data entry.
+- Every `<input>`, `<select>`, or `<textarea>` element in a form **MUST** be visually labeled using a `<label>` element.
+- Every `<label>` element **MUST** have a `for` attribute with a value that matches the `id` attribute value of an adjacent `<input>`, `<select>`, or `<textarea>` element element.
```

</details>

#### **philipwalton** on `guides/user-experience/autofill/expectations.md`
> Does it have to be above? What about to the left?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- Every `<input>`, `<select>`, or `<textarea>` element in a form **MUST** be visually labeled using a `<label>` element.
+- Every `<label>` element **MUST** have a `for` attribute with a value that matches the `id` attribute value of an adjacent `<input>`, `<select>`, or `<textarea>` element element.
+- An `<input>` element **MAY** use placeholder text to help the user enter text, but the `placeholder` attribute **MUST NOT** be used to provide a visual UI label for an `<input>` element. A `<label>` element should be used instead.
+- Each form element label provided using a `<label>` element **SHOULD** be displayed above its associated form element, and **MUST** be clearly associated visually with the form element.
```

</details>

#### **philipwalton** on `guides/user-experience/autofill/autofill-sign-in-form/expectations.md`
> Ahh, I think this answers my question above?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- Each form element label provided using a `<label>` element **SHOULD** be displayed above its associated form element, and **MUST** be clearly associated visually with the form element.
+- The vertical margin (whitespace) between a form element's label and the form element itself **MUST** be less than the vertical margin (whitespace) between the form element and the form element that follows it.
+- The `type="number"` attribute **MUST NOT** be used for numbers that are not meant to be incremented, such as payment card numbers or telephone numbers. `type="text"` or `inputmode="numeric"` (**NOT** `type="number"`) **MUST** be used for user input of numbers that are not meant to be incremented.
+- To help browsers autofill forms, every `<input>` element **MUST** have a `name` and `id` attribute that is stable and does not change between page loads or website deployments.
```

</details>

#### **philipwalton** on `guides/user-experience/autofill/expectations.md`
> Is this true? Why are there `autocomplete=given-name` and `autocomplete=family-name` values?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- Data in a form **MUST** be validated during entry, as well as when the user attempts to submit the form.
+- Progress through a multi-page form **MUST** be clearly displayed to the user, showing progress steps with clear labels and calls to action. A user **MUST** be able to navigate backwards and forwards between pages on a multi-page form.
+- Avoid clutter and distractions in forms, to reduce the likelihood of a user abandoning form completion. Keep form pages visually simple, with clear calls to action.
+- Where possible, ask for personal names with a single `<input>`. Do not assume that all users have a first name and a last name.
```

</details>

#### **philipwalton** on `guides/user-experience/autofill/expectations.md`
> Expectations shouldn't link to references, as these will be used to automatically create evals (and I don't think link lookup will work).

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- In forms that request an address, allow for a variety of international address formats. https://www.columbia.edu/%7Efdc/postal/ provides information about addresses in different locales.
+- The `autocomplete` attribute **MUST** be used with billing address form fields.
+- Internationalize and localize form labels where necessary.
+- Appropriate payment card autocomplete values **MUST** be used. https://web.dev/articles/payment-and-address-form-best-practices provides more information about address and payment form best practice.
```

</details>

#### **philipwalton** on `guides/user-experience/autofill/expectations.md`
> I read through this and thought of a few more things I didn't see here. Let me know if you think these are worth adding?
> - `autocomplete=off` should not be used (right?)
> - Custom JS-powered form controls that use hidden inputs should reflect the selected value as well as the `:autofill` state in their custom UI.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,54 @@
+# Expectations: `autofill`
```

</details>

#### **philipwalton** on `guides/user-experience/autofill/guide.md`
> Should this also mention "password managers"? Or is that implied by "autofill"?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: autofill
+description: Build a <form> that follows best practice, and works correctly with browser autofill features.
```

</details>

#### **philipwalton** on `guides/user-experience/autofill/expectations.md`
> Got it. Given how many sites already have labels on the left, I worry that a recommendation too strong in this area could cause the tool to not work well with existing sites.
> 
> Also, research-supported recommendations probably makes sense in a general SKILL.md file of best practices rather than an implementation guide (that should focus on technical requirements).

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- Every `<input>`, `<select>`, or `<textarea>` element in a form **MUST** be visually labeled using a `<label>` element.
+- Every `<label>` element **MUST** have a `for` attribute with a value that matches the `id` attribute value of an adjacent `<input>`, `<select>`, or `<textarea>` element element.
+- An `<input>` element **MAY** use placeholder text to help the user enter text, but the `placeholder` attribute **MUST NOT** be used to provide a visual UI label for an `<input>` element. A `<label>` element should be used instead.
+- Each form element label provided using a `<label>` element **SHOULD** be displayed above its associated form element, and **MUST** be clearly associated visually with the form element.
```

</details>

---

## PR #187: Use cases for calc-size

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/animate-to-height-auto/guide.md`
> I think this description captures the gist of the use case, but I wonder if "content-aware states" is too generic and in this case it might be better to start with the primary use case and then generalize? For example:
> 
> ```suggestion
> description: Animate smoothly to and from `height: auto`, or  other intrinsic sizes that depend on the element's content.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: animate-to-height-auto
+description: Animate smoothly between two different content-aware states, e.g. from the most compact single-line state to the fully expanded state that is defined by the content length and described by height auto.
```

</details>

#### **philipwalton** on `guides/user-experience/animate-to-height-auto/expectations.md`
> Same question here as in the other expectations file.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+* The agent has defined a CSS `@property` with `syntax: '<color>'` to register an interpolatable variable.
```

</details>

#### **philipwalton** on `guides/user-experience/apply-math-boundaries-to-intrinsically-sized-content/guide.md`
> ```suggestion
> description: Create highly resilient components that default to their intrinsic size but enforce strict mathematical guardrails.
> ```
> 
> I'd drop the "without needing extra lines of CSS" because it may limit what prompts this guide matches.
> 
> Also WDYT about saying "enforce strict size constraints" instead of "enforce strict mathematical guardrails"? I get that the "math" part relates to "calc", but I'm not sure how relevant that part actually is to this use case.
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: apply-math-boundaries-to-intrinsically-sized-content
+description: Create highly resilient components that default to their intrinsic size but enforce strict mathematical guardrails without needing extra lines of CSS or media queries.
```

</details>

#### **philipwalton** on `guides/user-experience/apply-math-boundaries-to-intrinsically-sized-content/expectations.md`
> Same question here as in the other expectations file.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+* The agent has defined a CSS `@property` with `syntax: '<color>'` to register an interpolatable variable.
```

</details>

#### **philipwalton** on `guides/user-experience/add-fixed-offset-to-dynamically-sized-container/expectations.md`
> Are these expectations from another use case?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+* The agent has defined a CSS `@property` with `syntax: '<color>'` to register an interpolatable variable.
```

</details>

#### **philipwalton** on `guides/user-experience/add-fixed-offset-to-dynamically-sized-container/guide.md`
> After looking a bit at this use case and the `apply-math-boundaries-to-intrinsically-sized-content` use case, I'm not convinced they need to be separate use cases. WDYT about combining them?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: add-fixed-offset-to-dynamically-sized-container
+description: Create elements like tooltips, buttons, modals, or dropdowns that need to fit their content plus a specific mathematical offset by adding fixed offsets, padding allowances, or viewport units directly to a intrisically sized element.
```

</details>

#### **philipwalton** on `guides/user-experience/add-fixed-offset-to-dynamically-sized-container/guide.md`
> Ok, yeah, I see you're point. Though I think I will need to update the describes a bit more to make it more clear (to me at least).
> 
> I'll do that at merge, so we can get this closed out.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: add-fixed-offset-to-dynamically-sized-container
+description: Create elements like tooltips, buttons, modals, or dropdowns that need to fit their content plus a specific mathematical offset by adding fixed offsets, padding allowances, or viewport units directly to a intrisically sized element.
```

</details>

#### **philipwalton** on `guides/user-experience/add-fixed-offset-to-dynamically-sized-container/guide.md`
> Actually, I changed my mind again. I'm thinking about what the guides will look like for these use cases, and I think they'd be almost identical, at least in regards to the `calc-size()` usage instructions.
> 
> Also, for the "adding something to an intrinsic size" use case, there are lots of ways to solve that outside of `calc-size()` (e.g. using flexbox or grid), and I'm not sure if we want to always recommend `calc-size()` (which could happen if that was the only guide that matched the user's prompt).
> 
> Anyway, in the interest of time I opened #241 to close out this feature, but feel free to keep discussing this if you disagree. We can always add more use cases later.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: add-fixed-offset-to-dynamically-sized-container
+description: Create elements like tooltips, buttons, modals, or dropdowns that need to fit their content plus a specific mathematical offset by adding fixed offsets, padding allowances, or viewport units directly to a intrisically sized element.
```

</details>

---

## PR #185: Baseline status macro

### Reviews

#### **rviscomi** (COMMENTED)
*(No review body)*

### Comments

#### **rviscomi** on `serving/mcp-server/data/baseline.ts`
> Updated

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  if ((baseline === 'low' || baseline === 'high') && baseline_low_date) {
+    const isWidely = baseline === 'high' || (baseline_low_date <= subtractMonths(new Date().toISOString().split('T')[0], 30));
+    const statusName = isWidely ? 'Widely available' : 'Newly available';
+    return `${subject} has been Baseline since ${baseline_low_date} (${statusName})`;
```

</details>

---

## PR #183: Fetch Priority use cases

### Reviews

#### **philipwalton** (APPROVED)
*(No review body)*

---

## PR #178: Fix guides with incorrect feature ID data

### Reviews

#### **rviscomi** (APPROVED)
*(No review body)*

---

## PR #170: Use cases: sibling-count() and sibling-index()

### Reviews

#### **malchata** (CHANGES_REQUESTED)
> Some suggestions here.

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (APPROVED)
> @marcianoskate the 2nd and 3rd use case LGTM. Feel free to remove the first one and merge unless you feel strongly that we should keep it.

#### **philipwalton** (COMMENTED)
*(No review body)*

### Comments

#### **malchata** on `guides/user-experience/build-quantity-responsive-layouts/guide.md`
> Wondering if this could be condensed a bit. It doesn't _need_ to change, but it feels a little long for a use case. Thoughts, @philipwalton?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,7 @@
+---
+name: build-quantity-responsive-layouts
+description: Build quantity-responsive layouts and adaptive typography components by calculating fluid widths or adjusting font sizes dynamically based on the total number of sibling elements present, eliminating the need for complex CSS quantity queries or JavaScript.
```

</details>

#### **malchata** on `guides/user-experience/calculate-math-driven-spatial-patterns/guide.md`
> Same here. For example, I'd avoid terminology like "boustrophedon" and just say what it means (which you have in parentheses, which I'm ironically using parentheses to talk about your parentheses).

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,7 @@
+---
+name: calculate-math-driven-spatial-patterns
+description: Calculate math-driven spatial patterns and complex geometric layouts, such as fanning items out into a perfect circle or plotting boustrophedon (zigzag) grid rows, by feeding an element's positional index into trigonometric or arithmetic CSS functions.
```

</details>

#### **philipwalton** on `guides/user-experience/create-procedural-staggered-animations/guide.md`
> ```suggestion
> description: Create procedural staggered animations and cascading transition delays for any group of sibling elements, including standard sequential fades and reverse staggers.
> ```
> The last part should be clarified in the guide itself, so I don't think it needs to be in the description.
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: create-procedural-staggered-animations
+description: Create procedural staggered animations and cascading transition delays for any group of sibling elements, including standard sequential fades and reverse staggers, by computing time values based on an element's index and the total count of its siblings.
```

</details>

#### **philipwalton** on `guides/user-experience/create-procedural-staggered-animations/guide.md`
> Nit: for the use case slug, I think I'd drop "create". I don't think we need the slugs to use active phrasing, and I also worry that all the slugs would then be prefixed with  "create" or "build", which would make it harder to scan through them in a list.
> 
> And I guess this applies to all the use case slugs in this PR.
> ```suggestion
> name: procedural-staggered-animations
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: create-procedural-staggered-animations
```

</details>

#### **philipwalton** on `guides/user-experience/calculate-math-driven-spatial-patterns/guide.md`
> I think it's ok to use an obscure term (the AI tool will know what it means), as long as its a core use case and not just a random example. In this case I'm not sure how common it would be for someone to want to do this.
> 
> Also, I'd recommend reframing the last part to keep the solution out of the use case description.
> 
> ```suggestion
> description: Create math-driven spatial patterns and complex geometric layouts based on how many children an element has, e.g. fanning items out into a perfect circle or plotting boustrophedon (zigzag) grid rows. 
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,7 @@
+---
+name: calculate-math-driven-spatial-patterns
+description: Calculate math-driven spatial patterns and complex geometric layouts, such as fanning items out into a perfect circle or plotting boustrophedon (zigzag) grid rows, by feeding an element's positional index into trigonometric or arithmetic CSS functions.
```

</details>

#### **philipwalton** on `guides/user-experience/build-quantity-responsive-layouts/guide.md`
> TBH, I'm not convinced that we'd want to always suggest sibling-count/index as the solution to this use case. In particular, the demo you shared could be more easily built with either flexbox or grid.
> 
> Unless we can come up with a specific case where sibling-count/index really unlocks some new potential, I'd suggest we drop this one.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: build-quantity-responsive-layouts
+description: Build layouts and typography for content that varies in quantity (quantity-responsive) by dynamically calculating fluid widths or adjusting font sizes based on the total number of sibling items present, eliminating the need for complex CSS rules or JavaScript.
```

</details>

#### **philipwalton** on `guides/user-experience/build-quantity-responsive-layouts/guide.md`
> @marcianoskate ping on this. Any objections to dropping this use case?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: build-quantity-responsive-layouts
+description: Build layouts and typography for content that varies in quantity (quantity-responsive) by dynamically calculating fluid widths or adjusting font sizes based on the total number of sibling items present, eliminating the need for complex CSS rules or JavaScript.
```

</details>

#### **philipwalton** on `guides/user-experience/build-quantity-responsive-layouts/guide.md`
> Removed

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: build-quantity-responsive-layouts
+description: Build layouts and typography for content that varies in quantity (quantity-responsive) by dynamically calculating fluid widths or adjusting font sizes based on the total number of sibling items present, eliminating the need for complex CSS rules or JavaScript.
```

</details>

---

## PR #158: :user-valid and :user-invalid use-cases and guides

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (APPROVED)
> LGTM with some suggestions. 

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/accessible-error-announcement/guide.md`
> ```suggestion
> We want the *programmatic* state (`aria-invalid="true"`) to be applied **at the exact same moment** the *visual* state (`:user-invalid`) applies. Since `:user-invalid` relies on the browser's internal "user-interacted" flag, we can use JavaScript to check that this selector matches during standard interaction events.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+If you use standard `:invalid` styling, screen readers might announce "Invalid entry" the moment a user tabs into a required field that is currently empty. This creates a disruptive experience for users using assistive technologies, as the error is announced before interaction has occurred.
+
+## The Solution
+We want the *programmatic* state (`aria-invalid="true"`) to be applied **at the exact same moment** the *visual* state (`:user-invalid`) applies. Since `:user-invalid` relies on the browser's internal "user-interacted" flag, we can use JavaScript to check for this selector matches during standard interaction events.
```

</details>

#### **philipwalton** on `guides/user-experience/accessible-error-announcement/guide.md`
> ```suggestion
> 3.  **Bridge Visual & Accessibility Layer**: Create a lightweight JavaScript utility that listens for `blur` and `input` events, checks if the element matches `:user-invalid`, and updates the ARIA attributes accordingly.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+1.  **Visual Layer**: Use CSS `:user-invalid` to show borders/icons.
+2.  **Accessibility Layer**: Use `aria-invalid` and `aria-errormessage` to communicate state to Assistive Technology (AT).
+3.  **Bridge Visual & Accessibility Layer**: A lightweight JavaScript utility that listens for `blur` and `input` events, checks if the element matches `:user-invalid`, and updates the ARIA attributes accordingly.
```

</details>

#### **philipwalton** on `guides/user-experience/accessible-error-announcement/guide.md`
> ```suggestion
> Since there is no "UserInvalidChanged" event, hook into standard form events to check the state.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+```
+
+### 3. JavaScript
+Since there is no "UserInvalidChanged" event, we hook into standard form events to check the state.
```

</details>

#### **philipwalton** on `guides/user-experience/accessible-error-announcement/guide.md`
> This won't apply to fields that are programmatically added to the DOM.
> 
> I think the recommendation should be to add capturing `focus` and `blur` event listeners to the window/document and then check if the target matches `input, textarea, select`

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+Since there is no "UserInvalidChanged" event, we hook into standard form events to check the state.
+
+```javascript
+const inputs = document.querySelectorAll('input, textarea, select');
```

</details>

#### **philipwalton** on `guides/accessibility/accessible-error-announcement/guide.md`
> I guess adding fallback logic is fine, but I do wonder how necessary it is and whether or not this should just be a pure progressive enhancement.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+}
+```
+
+### Fallback Logic
```

</details>

#### **philipwalton** on `guides/user-experience/accessible-error-announcement/guide.md`
> Similar to above, this would need to get re-called any time a form is added to the DOM. Why not just use capturing event listeners for all blur/input/change/reset events, so there's less manually wiring up required.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+})();
+
+// Initialize for a specific form
+const form = document.querySelector('#demo-form');
```

</details>

#### **philipwalton** on `guides/user-experience/accessible-error-announcement/guide.md`
> I see you kinda answer my above comments here, but TBH I still think event delegation is a better solution since focus/blur fire relatively infrequently and input/change/reset would only be added in older browsers, so it won't impact most users.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+    *   Ensure the text content of your error message (`#email-error`) is translated. The logic remains the same.
+
+3.  **Performance**:
+    *   `input.matches(':user-invalid')` is very fast. Attaching these listeners to hundreds of inputs is generally negligible, but event delegation (listening on the `<form>` element) is a good optimization for large forms.
```

</details>

#### **philipwalton** on `guides/user-experience/required-field-feedback/guide.md`
> ```suggestion
> description: Provide error message for required form fields that were skipped or left empty *only* after user interaction, to avoid preemptive errors and ensure feedback is timely and contextually relevant to the user's flow.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,166 @@
+---
+name: required-field-feedback
+description: Highlighting required fields that were skipped or left empty after user focus and blur, ensuring feedback is contextually relevant to the user's flow.
```

</details>

#### **philipwalton** on `guides/user-experience/required-field-feedback/guide.md`
> Given that these fallbacks add implementation complexity, I think we should frame them as option. How about something like:
> 
> If the user's Baseline target is older than Baseline 2023, consider adding a fallback strategy for browsers that don't support `:user-invalid`...

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Fallbacking & Browser Support
+
+For older browsers, we need to manually track the "visited" or "dirty" state.
```

</details>

#### **philipwalton** on `guides/user-experience/required-field-feedback/guide.md`
> This reference to the other file likely won't work in the context of a MCP response.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+1.  **Asterisks**: It is still best practice to indicate required fields visually (e.g., with an asterisk `*`) in the label, so users know what to expect *before* they interact.
+2.  **Submit Buttons**: Unlike `disabled` buttons, keep your submit button enabled. If the user clicks it, the browser will automatically trigger `:user-invalid` on all empty required fields and focus the first one. This is excellent for accessibility and UX.
+3.  **Accessibility**: While the fallback script automatically toggles `aria-invalid`, native `:user-invalid` does not automatically sync with ARIA attributes. To ensure a consistent accessibility experience for all users, see the [Accessible Error Announcement](../accessible-error-announcement/guide.md) guide.
```

</details>

#### **philipwalton** on `guides/user-experience/select-menu-interaction/guide.md`
> ```suggestion
> description: Validate that a non-default option has been chosen in a select menu only after the user has interacted with the control.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,166 @@
+---
+name: select-menu-interaction
+description: Validating that a non-default option has been chosen in a select menu only after the user has interacted with the control.
```

</details>

#### **philipwalton** on `guides/user-experience/select-menu-interaction/guide.md`
> Same comment here as the other use case. I think we should present this an optional fallback strategy, given it will only be needed by a small portion of users, and (presumably) the site already has other validation mechanism in place (e.g. server-side validation).

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+```
+
+### JavaScript Fallback
+If the browser doesn't support the selector, we can use a reusable utility that tracks interaction state using a `WeakMap`. This avoids polluting the DOM with "dirty" classes or data attributes.
```

</details>

#### **philipwalton** on `guides/user-experience/style-parent-with-has/guide.md`
> ```suggestion
> 1.  **Selector**: Use `.parent:has(:user-invalid)` to target the container.
> ```
> To include selects as well? I don't think this will have worse performance, but if so you could also do `:is(input,select):user-invalid`.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+### Implementation Strategy
+
+1.  **Selector**: Use `.parent:has(input:user-invalid)` to target the container.
```

</details>

#### **philipwalton** on `guides/user-experience/style-parent-with-has/guide.md`
> Same comment here as for other use cases. IMO this one is a great candidate for pure progressive enhancement because presumably the input itself will have the error styling and the only thing that won't is the parent element.
> 
> I wonder if we should just recommend to make sure the input has some visual styling and then no fallback is ok?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+}
+```
+
+## Fallbacking & Browser Support
```

</details>

#### **philipwalton** on `guides/user-experience/validate-input-after-interaction/guide.md`
> Not sure if this will matter, but this is not a valid HTML comment...

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+      id="password" 
+      autocomplete="new-password"
+      required
+      /* 
```

</details>

#### **philipwalton** on `guides/user-experience/validate-input-after-interaction/guide.md`
> Same comment as before, I'm not sure if we should present this as "mandatory".

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+```
+
+### JavaScript Fallback
+MANDATORY: If the browser doesn't support the selector, we can use a reusable utility that tracks interaction state using a `WeakMap`. This avoids polluting the DOM with "dirty" classes or data attributes.
```

</details>

#### **philipwalton** on `guides/user-experience/required-field-feedback/guide.md`
> @rviscomi suggestions?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+1.  **Asterisks**: It is still best practice to indicate required fields visually (e.g., with an asterisk `*`) in the label, so users know what to expect *before* they interact.
+2.  **Submit Buttons**: Unlike `disabled` buttons, keep your submit button enabled. If the user clicks it, the browser will automatically trigger `:user-invalid` on all empty required fields and focus the first one. This is excellent for accessibility and UX.
+3.  **Accessibility**: While the fallback script automatically toggles `aria-invalid`, native `:user-invalid` does not automatically sync with ARIA attributes. To ensure a consistent accessibility experience for all users, see the [Accessible Error Announcement](../accessible-error-announcement/guide.md) guide.
```

</details>

#### **philipwalton** on `guides/user-experience/style-parent-with-has/guide.md`
> ```suggestion
> description: Style parent elements of a form field (e.g. labels or fieldsets) when the field is invalid.
> ```
> 
> I think we want avoid mentioning solutions or implementation details in the use case, otherwise I worry that a user prompt like the following won't match this use case: "write me some JavaScript code to automatically style a form label..."
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,187 @@
+---
+name: style-parent-with-has
+description: Declaratively style parent elements like labels or fieldsets when a child input is in the :user-invalid state, eliminating the need for JavaScript state management.
```

</details>

#### **philipwalton** on `guides/user-experience/validate-input-after-interaction/guide.md`
> ```suggestion
> description: Show form field validation feedback (e.g. password complexity or email format requirements) only after the user has finished their initial interaction, avoiding premature errors on page load or while the user is typing.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,254 @@
+---
+name: validate-input-after-interaction
+description: Validation feedback for form inputs that only appears after the user has finished their initial interaction, avoiding premature errors on page load or while the user is typing. This consolidated guide covers sub-use-cases including password complexity validation and validating email after interaction.
```

</details>

#### **rviscomi** on `guides/user-experience/required-field-feedback/guide.md`
> If we absolutely had to link two guides together, the way to do it would be something like `MANDATORY: Call get_best_practices("accessible-error-announcement") to ensure a consistent accessibility experience.`
> 
> However, that should be extremely rare if we ever need to do it at all. Ideally, in the interest of speeding up responses and conserving tokens, guides will be as self-contained as possible so that agents have everything they need to implement the use case correctly.
> 
> My suggestion would be to bake the a11y guidance directly into the implementation section of this guide. I think we can get it down to just a few lines of JS:
> 
> ```js
> // Sync aria-invalid with the CSS :user-invalid state
> const syncAria = (el) => {
>   el.toggleAttribute?.('aria-invalid', el.matches(':user-invalid'));
> };
> 
> // Update on blur (to show error) and input (to clear it)
> document.addEventListener('blur', (e) => syncAria(e.target), true);
> document.addEventListener('input', (e) => {
>   if (e.target.hasAttribute('aria-invalid')) syncAria(e.target);
> });
> ```
> 
> We should probably also revisit the part about "You don't need `onBlur` handlers" to make clear that some JS is needed, even in the modern implementation.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+1.  **Asterisks**: It is still best practice to indicate required fields visually (e.g., with an asterisk `*`) in the label, so users know what to expect *before* they interact.
+2.  **Submit Buttons**: Unlike `disabled` buttons, keep your submit button enabled. If the user clicks it, the browser will automatically trigger `:user-invalid` on all empty required fields and focus the first one. This is excellent for accessibility and UX.
+3.  **Accessibility**: While the fallback script automatically toggles `aria-invalid`, native `:user-invalid` does not automatically sync with ARIA attributes. To ensure a consistent accessibility experience for all users, see the [Accessible Error Announcement](../accessible-error-announcement/guide.md) guide.
```

</details>

#### **rviscomi** on `guides/accessibility/accessible-error-announcement/guide.md`
> Should this be under `guides/accessibility`?

#### **philipwalton** on `guides/accessibility/accessible-error-announcement/guide.md`
> Yeah, good call. @PaulKinlan can you move this when you add the rest of your changes?

---

## PR #157: Use cases for Temporal API

### Reviews

#### **malchata** (CHANGES_REQUESTED)
> The overarching concern here, I think, is the mention of specific API methods and properties, and to keep the use cases general enough to focus on the problem without wading into implementation details.

#### **philipwalton** (APPROVED)
> Thanks @NourNabil! I made a few minor changes to wording, but other than that your latest changes LGTM.

### Comments

#### **malchata** on `guides/user-experience/calculate-event-differentials/guide.md`
> Similar concern here to what @taraojo has mentioned in another use case. Additionally, words like "leverage" in this case inhibit clarity, where "use" would be more direct. In fact, the second sentence might be (mostly) unnecessary:
> 
> ```suggestion
> description: Determine the exact time elapsed between two discrete events to calculate trial expirations or prorated costs while avoiding error-prone manual timestamp division.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: calculate-event-differentials
+description: Determine the exact time elapsed between two discrete events to calculate trial expirations or prorated costs. levarage the .since() and .until() methods to return balanced duration objects, replacing error-prone manual timestamp division.
```

</details>

#### **malchata** on `guides/user-experience/manage-financial-intervals/guide.md`
> Would prefer to avoid mentions of discrete methods and/or properties (`Temporal.Duration` here). I also believe that the specific example here ("edge cases like adding one month to January 31st"). I think the use case could be written to communicate the benefit of "overflow clamping" without adding too much to the overall specificity of the use case.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: manage-financial-intervals
+description: Perform complex date mathematics for recurring subscriptions or payroll. Use Temporal.Duration to add or subtract months and years while utilizing native "overflow" clamping to safely handle edge cases like adding one month to January 31st.
```

</details>

#### **malchata** on `guides/user-experience/stabilize-reactive-state/guide.md`
> I _think_ we want to avoid mentioning specific frameworks—my concern is that generated "best practices" guidance could key in on mentions of them and possibly provide guidance that is too narrow (but maybe we're okay with that).

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: stabilize-reactive-state
+description: Prevent reference-based bugs in UI frameworks (like React or Vue) by utilizing immutable chronological objects. Every update yields a brand-new memory reference, ensuring framework diffing algorithms correctly trigger re-renders without silent state mutations.
```

</details>

---

## PR #154: Use cases for contain-intrinsic-size and contain-inline-size

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (APPROVED)
> LGTM. I like the demo!

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/caption-wrapping-for-visual-media/guide.md`
> Hmmm, TBH, `contain-inline-size` doesn't seem like the right features to use to achieve this result. I get that it works, but setting a width of `min-content` on the `<figure>` in your demo would also work, and I think would be the right tool for the job.
> 
> I'd drop this use case.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: caption-wrapping-for-visual-media
+description: Ensures that descriptive labels remain restricted to the same horizontal footprint as their primary images rather than stretching the container to fit a single line of text.
```

</details>

#### **philipwalton** on `guides/performance/reserved-space-for-third-party-widgets/guide.md`
> FYI, your demo uses `contain: strict` instead of `contain: inline-size`.
> 
> Also, would the best way to reserve space for 3P widget be to specify a width an a height (which your demo also does)?
> 
> If there isn't a good reason, then I think we should drop this one.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: reserved-space-for-third-party-widgets
+description: Create designated areas for third-party widgets that stay occupied by a default height and width even before external scripts or advertisements have finished downloading.
```

</details>

#### **philipwalton** on `guides/performance/scrollbar-stabilization-for-infinite-feeds/guide.md`
> This is a good use case, and I think you can merge the first one into this one. Can you update it to be the following, and also add a demo?
> 
> `optimize-scroll-stability`: Keep the page layout, scroll bar, and scroll position as stable as possible as users scroll through content-heavy pages (feeds, dashboards, long lists) where elements transition from hidden to visible.
> 
> Also, the more I think about it, the more I think that we don't need to create use cases for `contain-inline-size`, and just stick to `contain-intrinsic-size`.
> 
> I think the `contain` property in CSS would be good to mention in a general performance skill, but probably doesn't need its own use case.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: scrollbar-stabilization-for-infinite-feeds
+description: Provides a temporary placeholder for off-screen components, ensuring the user's position remains steady as content is rendered.
```

</details>

#### **philipwalton** on `guides/performance/rendering-complex-tables/guide.md`
> I mention this in the comment below, but I'd merge this use case into the 3rd one.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,7 @@
+---
+name: rendering-complex-tables
+description: Informs the browser it can calculate the width of a specific section independently, preventing a single update from forcing a recalculation of the entire document's horizontal layout.
```

</details>

#### **rviscomi** on `guides/performance/optimize-scroll-stability/guide.md`
> @syntxerror should this also include `contain-inline-size`? The [issue](https://github.com/GoogleChrome/guidance/issues/43) associated with that feature got closed, but it's unclear if it's because there are no use cases for it or if it was a mistake.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+name: optimize-scroll-stability
+description: Keep the page layout, scroll bar, and scroll position as stable as possible as users scroll through content-heavy pages (feeds, dashboards, long lists) where elements transition from hidden to visible.
+web-feature-ids:
+  - contain-intrinsic-size
```

</details>

#### **rviscomi** on `guides/performance/optimize-scroll-stability/guide.md`
> Ah I see, thanks!

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+name: optimize-scroll-stability
+description: Keep the page layout, scroll bar, and scroll position as stable as possible as users scroll through content-heavy pages (feeds, dashboards, long lists) where elements transition from hidden to visible.
+web-feature-ids:
+  - contain-intrinsic-size
```

</details>

---

## PR #153: Add use cases related to view transition

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
> Thanks for putting this together @kevinkiklee. This is a really broad topic, but I think the use cases you've identified do a good job of capturing the core uses cases at the right granularity.
> 
> I've left a few comments to be addressed, but overall I think this is pretty good.

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (APPROVED)
> LGTM. Tweaked the use case wording and demos slightly.

### Comments

#### **philipwalton** on `guides/user-experience/shared-element-transition-on-navigation/demo.html`
> When I run this demo locally, I don't see any transitions. Can you double-check?

#### **philipwalton** on `guides/user-experience/directional-element-transition-on-navigation/guide.md`
> ```suggestion
> name: directional-navigation-transitions
> ```
> Nit, but this is shorter and I think reads clearer.
> 
> Also, I think the "on navigation" part is a bit confusing because these aren't necessarily "navigations" in the browser page, and the "on" prefix kinda makes it sound like you're listening to a navigate event (at least to me).

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,7 @@
+---
+name: directional-element-transition-on-navigation
```

</details>

#### **philipwalton** on `guides/user-experience/directional-navigation-transitions/guide.md`
> Question: is the `active-view-transition` feature required to implement this use case (i.e. does it need to be part of the guide), or does it just happen to be used in your demo?
> 
> If it needs to be present in the guide then it's fine to have this feature in the list, otherwise take it out.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+description: Animate visual state changes to reflect the direction of a user's navigational flow, such as sliding new content in from the right when advancing forward or from the left when returning to a previous screen.
+web-feature-ids:
+  - view-transitions
+  - active-view-transition
```

</details>

#### **philipwalton** on `guides/user-experience/element-transition-on-cross-document-navigation/guide.md`
> ```suggestion
>   - view-transitions
>   - cross-document-view-transitions
> ```
> 
> BTW, I think it makes sense to include both same-doc and cross-doc view transitions in this use case (since the choice of tech is really just an implementation detail).
> 
> Also, I noticed that @taraojo put her name down for `cross-document-view-transitions` in the feature sheet. Tara, have you started on this? If not, maybe we should just use this PR to cover both types of VT use cases? There's a lot of overlap in use cases.
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+name: element-transition-on-cross-document-navigation
+description: Animate the entire screen state when a user navigates between distinct HTML documents, such as creating seamless cross-fades or custom page-level slide effects without relying on single-page application architectures.
+web-feature-ids:
+  - view-transitions
```

</details>

#### **philipwalton** on `guides/user-experience/element-transition-on-cross-document-navigation/guide.md`
> ```suggestion
> name: seamless-full-page-transitions
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: element-transition-on-cross-document-navigation
```

</details>

#### **philipwalton** on `guides/user-experience/element-transition-on-cross-document-navigation/guide.md`
> ```suggestion
> description: Create smooth, seamless transitions between full page navigations, such as cross-fades, custom reveal effects, or morphing of content from one page to the next.
> ```
> 
> Cross document view transitions don't necessarily have to animate the entire page. Also, I'd remove the SPA mention, since it's kinda an implementation details.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: element-transition-on-cross-document-navigation
+description: Animate the entire screen state when a user navigates between distinct HTML documents, such as creating seamless cross-fades or custom page-level slide effects without relying on single-page application architectures.
```

</details>

#### **philipwalton** on `guides/user-experience/shared-element-transition-on-navigation/guide.md`
> ```suggestion
> name: shared-element-transitions
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,7 @@
+---
+name: shared-element-transition-on-navigation
```

</details>

#### **philipwalton** on `guides/user-experience/shared-element-transition-on-navigation/guide.md`
> Question: is `view-transition-class` the recommended way to implement this use case, or is this just an example of where you *can* use `view-transition-class`?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+description: Visually connect persisting interface components across different navigation states by smoothly morphing their size, position, and styling, such as expanding a product thumbnail into a full-bleed hero image or uniformly animating an entire grid of items.
+web-feature-ids:
+  - view-transitions
+  - view-transition-class
```

</details>

#### **philipwalton** on `guides/user-experience/same-document-transitions/guide.md`
> Is this the same as the previous use case, but for same-doc instead of cross-doc? If so, then I'd combine them.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: element-transition-on-same-document-navigation
+description: Animate visual state changes when dynamically updating the DOM within a single-page application or interactive component, such as preventing abrupt visual jumps when filtering lists, switching tabs, or opening dialogs.
```

</details>

#### **philipwalton** on `guides/user-experience/directional-navigation-transitions/guide.md`
> Got it, thanks!

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+description: Animate visual state changes to reflect the direction of a user's navigational flow, such as sliding new content in from the right when advancing forward or from the left when returning to a previous screen.
+web-feature-ids:
+  - view-transitions
+  - active-view-transition
```

</details>

#### **philipwalton** on `guides/user-experience/same-document-transitions/guide.md`
> I agree it's a bit complicated in the case of View Transitions. The problem is that many (though not all) use cases can be implemented with either cross-doc VTs or same-doc VTs, and I want to enable an AI tool to implement a given use case regardless of what architecture the project has set.
> 
> That said, I do think there will devs asking explicitly asking their AI tool for cross-document view transitions—and I also think there are use cases where, even though they *can* be implemented with cross-doc VTs, the better choice is sam-doc VT (e.g. animating the removal of an item from a list of items).
> 
> So why don't we just stick to those use cases that are more clear cut, and drop the vague ones, e.g. this one.
> 
> I'll make a separate suggestion for a new use case to add.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: element-transition-on-same-document-navigation
+description: Animate visual state changes when dynamically updating the DOM within a single-page application or interactive component, such as preventing abrupt visual jumps when filtering lists, switching tabs, or opening dialogs.
```

</details>

#### **philipwalton** on `guides/user-experience/shared-element-transitions/demo.html`
> This is not actually doing anything, because you're not defining any view transition styles referencing this class name.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  <style>
+    /* CORE: All list items share the same transition */
+    .item {
+      view-transition-class: item;
```

</details>

#### **philipwalton** on `guides/user-experience/shared-element-transitions/demo.html`
> There was also an issue where the items weren't actually transitioning positions because they didn't have a unique VT name. I got Gemini to fix it and I pushed https://github.com/GoogleChrome/guidance/pull/153/commits/2c55ca6b8cfed2e0b610adbd4e12dfcd8ea7451c

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  <style>
+    /* CORE: All list items share the same transition */
+    .item {
+      view-transition-class: item;
```

</details>

#### **philipwalton** on `guides/user-experience/shared-element-transitions/guide.md`
> I think the multiple elements simultaneously transitioning is a good use case, (and I think we should keep this demo), but I actually think that's a separate use case from the classic "shared element" VT, which is transitioning something like an image thumbnail into the full-res hero image when going from a product in a grid view to the product details view.
> 
> Can you add a new use case so both are captured? Maybe with names:
> - `shared-element-transitions`
> - `multiple-element-tarnsitions`
> 
> WDYT?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,7 @@
+---
+name: shared-element-transitions
+description: Apply uniform transition animations across multiple distinct elements, such as items in a dynamic list or grid, without needing to write or dynamically generate unique CSS selectors for every individual element's view transition name.
```

</details>

---

## PR #152: Use case for accent-color

### Reviews

#### **philipwalton** (COMMENTED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/pwa-native-parity/guide.md`
> I think something about "brand colors" should be mentioned here, correct (IIUC)?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: "PWA Native Parity"
+description: "Synchronize internal UI form styling with the external operating system's overall theme to create a deeply integrated, seamless application environment that mimics a true native mobile experience."
```

</details>

---

## PR #151: Add guide: `<dialog closedby>`

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (APPROVED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/light-dismiss-a-dialog/guide.md`
> ```suggestion
> description: Create a modal dialog that can be closed via light dismiss (i.e. clicking or tapping outside of the dialog)
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: light-dismiss-a-dialog
+description: Allow closing a `<dialog>` element by clicking outside of it with the `closedby="any"` attribute.
```

</details>

#### **philipwalton** on `guides/user-experience/control-dialog-closure/guide.md`
> ```suggestion
> description: Create a modal dialog that can be closed via standard platform-specific user actions, such as pressing the `Esc` key on desktop platforms, or a "back" or "dismiss" gesture on mobile platforms
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: control-dialog-closure
+description: Restrict closure of a `<dialog>` element to be a platform-specific user action or a developer-specified mechanism excluding a light-dismissal by using the `closedby="closerequest"` attribute.
```

</details>

#### **philipwalton** on `guides/user-experience/light-dismiss-dialog/guide.md`
> ```suggestion
> name: light-dismiss-dialog
> ```
> 
> Nit: I'd change this to `light-dismiss-dialog` (remove the "a"), which also means changing the directory name.
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: light-dismiss-a-dialog
```

</details>

#### **philipwalton** on `guides/user-experience/control-dialog-closure/guide.md`
> ```suggestion
> name: platform-controls-dismiss-dialog
> ```
> 
> Change the directory structure as well to match.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: control-dialog-closure
```

</details>

---

## PR #138: Popover

### Reviews

#### **philipwalton** (DISMISSED)
> I've done an initial pass of the `create-contextual-tooltip` example with some suggestions.
> 
> I'll work through the rest of the use cases soon.

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **rviscomi** (APPROVED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-interface/create-contextual-tooltips/guide.md`
> ```suggestion
> description: Create contextual tooltips for certain elements on the page that provide additional information to the user. The tooltips are initially not show, they appear only when the user shows interest in the element, such as hovering or focusing it.
> ```
> I'd remove the mention of the API names, as in this case those are implementation details. Also, re: "shows interest", I'm not sure that term is going to be clear enough for the LLM to match it with the use case, so I'd add more detail to explain that.
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+---
+name: create-contextual-tooltips
+
+description: Create contextual tooltips that provide additional information when the user shows interest. This leverages popover="hint", CSS Anchor Positioning, and the Interest Invoker API.
```

</details>

#### **philipwalton** on `guides/user-interface/create-contextual-tooltips/guide.md`
> This is YAML front matter so these need to be  a hyphen instead of an asterisk (here and throughout). I'd also remove the new lines between properties (not sure if that's technically invalid, but I think it's non-standard).

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+description: Create contextual tooltips that provide additional information when the user shows interest. This leverages popover="hint", CSS Anchor Positioning, and the Interest Invoker API.
+
+web-feature-ids:
+* popover
```

</details>

#### **philipwalton** on `guides/user-interface/create-contextual-tooltips/guide.md`
> First sentence is great. Given that there are lots of existing ways to build contextual tooltip that the LLM probably knows about, I'd start the second sentence with something that tries to establish that this is the best way to do it:
> 
> "The simplest and most performant way to build a contextual tooltip is to use the `popover="hint"` and the `interestfor` attribute ... because it requires no additional JavaScript code ..."
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+# Creating Contextual Tooltips
+
+Contextual tooltips provide secondary information about a UI element. By combining `popover="hint"` with the Interest Invoker API's `interestfor` attribute, tooltips are wired declaratively to their trigger element — the browser handles showing and hiding them on hover and keyboard focus with no JavaScript required. The `hint` popover type keeps tooltips in a separate ephemeral stack so they won't dismiss other active UI layers like open dropdown menus.
```

</details>

#### **philipwalton** on `guides/user-interface/create-contextual-tooltips/guide.md`
> The implementation section should be a clear, step-by-step guide to implementing the use case. It's not clear to me if this is just a checklist of things to make sure you did or if it's the actual steps. (If it is the steps then I think more detail is needed.)
> 
> I'd also include a minimal example after the implementation steps that shows the recommended HTML structure for tooltips as well as the basic CSS needed to make it work.
> 
> Keep in mind that the only content the AI tool will see is what's in this guide. It will not see the `demo.html` file.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+Contextual tooltips provide secondary information about a UI element. By combining `popover="hint"` with the Interest Invoker API's `interestfor` attribute, tooltips are wired declaratively to their trigger element — the browser handles showing and hiding them on hover and keyboard focus with no JavaScript required. The `hint` popover type keeps tooltips in a separate ephemeral stack so they won't dismiss other active UI layers like open dropdown menus.
+
+### Implementation Guidelines
```

</details>

#### **philipwalton** on `guides/user-interface/create-contextual-tooltips/guide.md`
> Related to my comment above, this line mentions `interestfor="<tooltip-id>"`, but none of the prior steps mention putting an ID on the tooltip.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+### Implementation Guidelines
+
+* **MANDATORY:** Apply `popover="hint"` to the tooltip element to ensure it is ephemeral and does not close other active UI layers.
+* **MANDATORY:** Add `interestfor="<tooltip-id>"` to the trigger element (a `<button>` or `<a>`). This declaratively links the invoker to its tooltip popover. The browser automatically shows and hides the popover when the user hovers or focuses the invoker.
```

</details>

#### **philipwalton** on `guides/user-interface/create-contextual-tooltips/guide.md`
> We should recommend feature-detecting and then conditionally loading the polyfill, so it's not loaded for Chrome users who don't need it.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+* **MANDATORY:** Apply `popover="hint"` to the tooltip element to ensure it is ephemeral and does not close other active UI layers.
+* **MANDATORY:** Add `interestfor="<tooltip-id>"` to the trigger element (a `<button>` or `<a>`). This declaratively links the invoker to its tooltip popover. The browser automatically shows and hides the popover when the user hovers or focuses the invoker.
+* **DO** include the `interestfor` polyfill (`npm: interestfor`) as a `<script>` tag for browsers that do not yet natively support the Interest Invoker API. The polyfill monitors hover and keyboard focus on `document.body` and fires `interest`/`loseinterest` events, automatically showing and hiding the popover target to match native behavior.
```

</details>

#### **philipwalton** on `guides/user-interface/create-contextual-tooltips/guide.md`
> Is there a way to do this conditionally as well? E.g. we can recommend doing `popover=hint` everywhere, and then a script can run that detects if the browser supports `hint` and if not then converts all of those attributes to `auto`. E.g.
> 
> ```js
> const browserSupportsHint = Object.assign(document.createElement("div"), {popover: "hint"}).popover === "hint";
> 
> if (!browserSupportsHint) {
>   Array.from(document.querySelectorAll("[popover=hint]")).forEach(e => (e.popover = "auto"));
> }
> ```
> 
> This obviously wouldn't work for popovers added later, but you get the point...
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+* **MANDATORY:** Apply `popover="hint"` to the tooltip element to ensure it is ephemeral and does not close other active UI layers.
+* **MANDATORY:** Add `interestfor="<tooltip-id>"` to the trigger element (a `<button>` or `<a>`). This declaratively links the invoker to its tooltip popover. The browser automatically shows and hides the popover when the user hovers or focuses the invoker.
+* **DO** include the `interestfor` polyfill (`npm: interestfor`) as a `<script>` tag for browsers that do not yet natively support the Interest Invoker API. The polyfill monitors hover and keyboard focus on `document.body` and fires `interest`/`loseinterest` events, automatically showing and hiding the popover target to match native behavior.
+* **DO** use `popover=auto` if `popover=hint` is not supported in your browser support matrix.
```

</details>

#### **philipwalton** on `guides/user-interface/create-contextual-tooltips/demo.html`
> Can you update this to show how to feature detect and conditionally load the polyfill?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+<body>
+  <button class="anchor" interestfor="tip">Hover Me</button>
+  <div id="tip" popover="hint">Contextual info bubble</div>
+</body>
```

</details>

#### **philipwalton** on `guides/user-interface/create-contextual-tooltips/guide.md`
> Your demo doesn't do this. Can you make sure there's an example that does?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+* **MANDATORY:** Add `interestfor="<tooltip-id>"` to the trigger element (a `<button>` or `<a>`). This declaratively links the invoker to its tooltip popover. The browser automatically shows and hides the popover when the user hovers or focuses the invoker.
+* **DO** include the `interestfor` polyfill (`npm: interestfor`) as a `<script>` tag for browsers that do not yet natively support the Interest Invoker API. The polyfill monitors hover and keyboard focus on `document.body` and fires `interest`/`loseinterest` events, automatically showing and hiding the popover target to match native behavior.
+* **DO** use `popover=auto` if `popover=hint` is not supported in your browser support matrix.
+* **DO** use CSS Anchor Positioning to tether the tooltip to its trigger element. Set `anchor-name` on the invoker element and `position-anchor` on the tooltip for explicit anchoring (required when using the polyfill). The native `interestfor` API also creates an implicit anchor relationship between invoker and target.
```

</details>

#### **philipwalton** on `guides/user-interface/create-contextual-tooltips/guide.md`
> Really? `position-area` doesn't work with animating? What about a simple fade in/out?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+* **DO** use `popover=auto` if `popover=hint` is not supported in your browser support matrix.
+* **DO** use CSS Anchor Positioning to tether the tooltip to its trigger element. Set `anchor-name` on the invoker element and `position-anchor` on the tooltip for explicit anchoring (required when using the polyfill). The native `interestfor` API also creates an implicit anchor relationship between invoker and target.
+* **DO** set `inset: auto` on the popover to reset the browser's default centering behavior before applying anchor styles.
+* **DO** use `position-area` for simplified placement. For example, `position-area: top center` places the tooltip directly above the anchor. Note: if the user wants to animate, do not use `position-area` and use `top/left/bottom/right` positioning instead.
```

</details>

#### **philipwalton** on `guides/user-interface/create-contextual-tooltips/guide.md`
> Should you also add a note not to use `:hover` CSS rules?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+* **DO** use `position-area` for simplified placement. For example, `position-area: top center` places the tooltip directly above the anchor. Note: if the user wants to animate, do not use `position-area` and use `top/left/bottom/right` positioning instead.
+* **DO** use `position-try-options: flip-block` to ensure the tooltip remains visible by flipping to the bottom if it overflows the top of the viewport.
+* **DO NOT** use `z-index` to manage the tooltip's visibility; the Top Layer handles this natively.
+* **DO NOT** wire tooltip show/hide manually with `mouseenter`/`mouseleave` JavaScript when the `interestfor` attribute (or its polyfill) can be used instead.
```

</details>

#### **philipwalton** on `guides/user-interface/create-contextual-tooltips/guide.md`
> Yeah, instructions for how to transition the popover in/out will be key.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+* **DO NOT** use `z-index` to manage the tooltip's visibility; the Top Layer handles this natively.
+* **DO NOT** wire tooltip show/hide manually with `mouseenter`/`mouseleave` JavaScript when the `interestfor` attribute (or its polyfill) can be used instead.
+
+** TODO : Need to add animation and anchored CQ **
```

</details>

#### **philipwalton** on `guides/user-interface/create-contextual-tooltips/guide.md`
> We're trying to frame browser support in terms of Baseline, so instead of saying that's it's only in Chrome, say "Baseline Limited availability".

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+### Fallback Strategies
+#### interest-invokers
+
+The Interest Invoker API (`interestfor` attribute) is currently only supported in Chrome. For browsers that do not yet support it natively:
```

</details>

#### **philipwalton** on `guides/user-interface/create-contextual-tooltips/guide.md`
> I believe it treats it as "manual" when "hint" isn't support. At least that's what I'm seeing in Safari and Firefox.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+#### popover-hint
+
+The hint state is currently only in Chrome. If the browser does not support `popover="hint"`, it will treat the value as `popover="auto"`, which may close other open auto popovers when the tooltip appears. This is still preferable to not using the Popover API at all.
```

</details>

#### **philipwalton** on `guides/user-interface/create-contextual-tooltips/guide.md`
> Same comment as above. I don't think this is true. If `popover=auto` is the preferred fallback when "hint" is not available, we should have a recommendation for that.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+The hint state is currently only in Chrome. If the browser does not support `popover="hint"`, it will treat the value as `popover="auto"`, which may close other open auto popovers when the tooltip appears. This is still preferable to not using the Popover API at all.
+
+* **Guidance:** Keep `popover="hint"` on the tooltip element and let it naturally degrade to `popover="auto"` behavior in unsupported browsers. Do **not** replace it with `popover="manual"` + JavaScript event listeners — `popover="auto"` still provides Top Layer promotion, correct stacking, and light-dismiss behavior, which are all better than a manually managed element.
```

</details>

#### **philipwalton** on `guides/user-interface/create-contextual-tooltips/guide.md`
> I'd also recommend adding instructions for how to control the interest delay, which then should probably mention the need for the `--interest-delay-start/end` custom properties in the polyfill.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+* **DO NOT** use `z-index` to manage the tooltip's visibility; the Top Layer handles this natively.
+* **DO NOT** wire tooltip show/hide manually with `mouseenter`/`mouseleave` JavaScript when the `interestfor` attribute (or its polyfill) can be used instead.
+
+** TODO : Need to add animation and anchored CQ **
```

</details>

#### **philipwalton** on `guides/user-interface/create-contextual-tooltips/guide.md`
> Here's what I'm seeing in Firefox when I run your demo:
> 
> <img width="686" height="94" alt="Screenshot 2026-03-10 at 11 45 33 PM" src="https://github.com/user-attachments/assets/7897e74c-b09f-4b25-9fd0-6cc16a16ec5b" />
> 
> And this is Safari:
> 
> <img width="573" height="78" alt="Screenshot 2026-03-10 at 11 46 27 PM" src="https://github.com/user-attachments/assets/bec531a7-c2c8-486e-96b0-de62d721cccf" />
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+#### popover-hint
+
+The hint state is currently only in Chrome. If the browser does not support `popover="hint"`, it will treat the value as `popover="auto"`, which may close other open auto popovers when the tooltip appears. This is still preferable to not using the Popover API at all.
```

</details>

#### **philipwalton** on `guides/user-interface/create-contextual-tooltips/demo.html`
> ```suggestion
>       script.src = 'https://unpkg.com/interestfor/src/interestfor.min.js';
> ```
> Also, you could use `import()` instead of creating a script tag.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+    // If the browser doesn't support it, dynamically load the polyfill.
+    if (!('interestForElement' in HTMLButtonElement.prototype)) {
+      const script = document.createElement('script');
+      script.src = 'https://unpkg.com/interestfor/dist/interestfor.min.js';
```

</details>

---

## PR #137: Add guidance for `search-hidden-content`

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
> Overall I think this guide is looking pretty good and I definitely learned a few things reading it!
> 
> There were a few issues I noticed though, and I left comments/suggestions for those.

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (APPROVED)
> @taraojo I pushed a few updates myself. If these LGTY then feel free to merge.
> 
> FYI: I tried switching the fallback to a CSS-based approach to make it more resilient, but then I ultimately reverted it once I saw your demo and realized that the fallback needed to also account for `aria` state. Another benefit of having a demo!

### Comments

#### **philipwalton** on `guides/user-experience/search-hidden-content/guide.md`
> Is this supposed to be in the fallback section?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+}
+```
+
+#### Use the `<details>` element
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/guide.md`
> ```suggestion
> if (!('onbeforematch' in HTMLElement.prototype)) {
> ```
> 
> I know the DCC article has what you have here, but I think it's safer to check `HTMLElement.prototype` because it's less likely that someone modified that object.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+Expand all hidden content for unsupported browsers, for example, for accordions, expand all sections.
+
+```javascript
+if (!('onbeforematch' in document.body)) {
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/guide.md`
> ```suggestion
> The `hidden="until-found"` attribute introduces a "matchable" state. It allows content to remain visually concealed while keeping its text nodes indexed for search.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+Web interfaces often hide content from view for reasons such as improving the user experience, saving space or to improve performance. Patterns such as accordions, tabs and collapsible sections are commonly used to achieve this using `display: none` or `visibility: hidden` making text invisible to the browser's native "Find in page" (Ctrl+F) tool.
+
+The hidden="until-found" attribute introduces a "matchable" state. It allows content to remain visually concealed while keeping its text nodes indexed for search.
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/guide.md`
> This step is optional, right? I.e. hidden-until-found will work on pages that don't register `beforematch` listeners, correct?
> 
> If so, then I'd clarify in these instructions.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+## How to implement
+
+1. Apply the `hidden="until-found"` HTML attribute to the elements that contain content that should be hidden from view.
+2. Use the `beforematch` event to synchronise the state of related elements, for example, to close a tab before the hidden tab is opened or to rotate the icon for an accordion.
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/guide.md`
> I'd also clarify that the target for this event is the element with the `hidden="until-found"` attribute. That wasn't immediately obvious to me from these instructions, and I think the AI will need to know what element to register the event listener on.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+## How to implement
+
+1. Apply the `hidden="until-found"` HTML attribute to the elements that contain content that should be hidden from view.
+2. Use the `beforematch` event to synchronise the state of related elements, for example, to close a tab before the hidden tab is opened or to rotate the icon for an accordion.
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/guide.md`
> I think it would be good to show a very basic example that doesn't use any JavaScript, and then you can also include this accordion-style example. WDYT?
> 
> I'm concerned that most people using this API will not need the accordion behavior, so I'd hesitate to have that as the only example.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+1. Apply the `hidden="until-found"` HTML attribute to the elements that contain content that should be hidden from view.
+2. Use the `beforematch` event to synchronise the state of related elements, for example, to close a tab before the hidden tab is opened or to rotate the icon for an accordion.
+
+## Example code
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/guide.md`
> It looks like there's some complexity with this API, as `beforematch` [is Baseline](https://developer.mozilla.org/en-US/docs/Web/API/Element/beforematch_event#browser_compatibility), but there's [a bug in Safari](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/hidden#browser_compatibility) affecting the `until-found` attribute. Given that, feature detecting using `beforematch` is not going to be 100% reliable.
> 
> That said, I don't think this bug warrants avoiding this API. Especially for a site that is already hiding content, as this API would be a pure enhancement.
> 
> I think it's worth given a stronger recommendation to use this feature for sites that are already hiding content and want to unlock a better find-in-page experience. But you could also give the caveat that for site's were find-in-page is critical, they should still feature detect and expand the content when `beforematch` is not supported.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Browser support and fallback strategies
+
+The `hidden="until-found"` attribute and `beforematch` event are not currently supported in all modern browsers (Baseline limited availability), thus a fallback strategy is typically required.
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/prompts.md`
> If this is supposed to be a single prompt, then put it all on the same line. Multiple lines is intended for uses cases where we want to test multiple prompts.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,5 @@
+# Prompts: `search-hidden-content`
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/expectations.md`
> ```suggestion
> - If targeting baseline widely available or baseline newly available, the implementation must include an explicit feature detection check for `hidden="until-found"` support (e.g., `if (!('onbeforematch' in HTMLElement.prototype))`) with a fallback strategy.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- Elements utilizing the `hidden="until-found"` attribute must NOT have `display: none`, `visibility: hidden`, or any associated `display` or `visibility` CSS properties applied to them directly.
+- The `hidden="until-found"` attribute must NOT be used to hide sensitive information, internal data tokens, or "screen reader only" text.
+- If there is related UI state (e.g., updating ARIA attributes, toggling open/close classes, or managing accordion icons), this should be synchronized with the JavaScript event listener for the `beforematch` event. 
+- If targeting baseline widely available or baseline newly available, the implementation must include an explicit feature detection check for `hidden="until-found"` support (e.g., `if (!('onbeforematch' in document.body))`) with a fallback strategy.
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/demo.html`
> ```suggestion
>     if (!('onbeforematch' in HTMLElement.prototype)) {
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+    // 3. Fallback strategy for browsers without 'beforematch' support
+    // (We auto-expand all hidden content)
+    if (!('onbeforematch' in document.body)) {
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/guide.md`
> Got it. It wasn't clear to me that this behavior worked natively inside a `<details>`.
> 
> So if this works natively inside of `<details>`, then why wouldn't that just be the default recommendation? Are there reasons not to use `<details>`?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+}
+```
+
+#### Use the `<details>` element
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/guide.md`
> You can use `<details>` for non-accordion content hide/show toggles as well.
> 
> I guess my point was, if using `<details>` fulfills the use case and is the simplest way to implement it, then I think that should be the primary recommendation. You can then offer `hidden=until-found` as a secondary recommendation for situations where you need more control than what's offered by `<details>`.
> 
> Note on the styling point that [details-content](https://webstatus.dev/features/details-content) (for styling `<details>` elements) is another newly available feature that wasn't on the list but potentially could be covered here as well, since it's related to this use case.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+}
+```
+
+#### Use the `<details>` element
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/guide.md`
> To be clear, it's not that `hidden=until-found` doesn't it exist (it does), it's that it has a [bug in Safari](https://bugs.webkit.org/show_bug.cgi?id=304174) where the text content is revealed but the browser doesn't scroll to it. And actually, in my testing, Safari *does* scroll to it if you keep pressing "find next", it just doesn't scroll to it on the very first "find next" invocation.
> 
> Given that there's no way (AFAICT) to feature detect this bug (and the best we can do is feature detect `beforematch`), I think the fallback you already recommend is sufficient.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Browser support and fallback strategies
+
+The `hidden="until-found"` attribute and `beforematch` event are not currently supported in all modern browsers (Baseline limited availability), thus a fallback strategy is typically required.
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/prompts.md`
> Got it. Re-reading them again I can see that they're distinct. I'd recommend rephrasing so they all start with the same "Create a..." intro, to make that a bit more clear.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,5 @@
+# Prompts: `search-hidden-content`
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/prompts.md`
> I'm curious, did you test this prompt to see if it worked?
> 
> Specifically I'm wondering if the AI understands that the phrase "I should be able to search" refers to the "find in page" feature. (Same question for the next prompt.)

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+# Prompts: `search-hidden-content`
+
+- Create an accordion component with 3 sections, with the second and third sections hidden by default. Text in the sections should be visible to the browser's native "Find in page" feature.
+- Use tabs to display comparisons of 2 products, I should be able to search for a product name and the tab with that product should be revealed.
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/expectations.md`
> Add `<details>` here as another option.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,7 @@
+# Expectations: `search-hidden-content`
+
+- Any content intended to be visually hidden but remain searchable via the browser's native "Find in page" feature MUST use the `hidden="until-found"` attribute.
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/expectations.md`
> Nit: this phrase reads awkwardly to me. I think it would be clearer to phrase it something like:
> 
> "If the hidden content has related UI state ... that state MUST be synchronized using a `beforematch` event listener."
> 
> That said, these expectations aren't for human consumption, so it's not a huge deal either way.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- Any content intended to be visually hidden but remain searchable via the browser's native "Find in page" feature MUST use the `hidden="until-found"` attribute.
+- Elements utilizing the `hidden="until-found"` attribute MUST NOT have `display: none`, `visibility: hidden`, or any associated `display` or `visibility` CSS properties applied to them directly.
+- The `hidden="until-found"` attribute MUST NOT be used to hide sensitive information, internal data tokens, or "screen reader only" text.
+- Only if there is related UI state (e.g., updating ARIA attributes, toggling open/close classes, or managing accordion icons), the implementation MUST synchronize this state using a JavaScript event listener for the `beforematch` event. 
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/expectations.md`
> Similar comment here as above. I'd rephrase this something like: "If the users Baseline target is older than Baseline 2025, a fallback strategy MUST be used..."

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- Elements utilizing the `hidden="until-found"` attribute MUST NOT have `display: none`, `visibility: hidden`, or any associated `display` or `visibility` CSS properties applied to them directly.
+- The `hidden="until-found"` attribute MUST NOT be used to hide sensitive information, internal data tokens, or "screen reader only" text.
+- Only if there is related UI state (e.g., updating ARIA attributes, toggling open/close classes, or managing accordion icons), the implementation MUST synchronize this state using a JavaScript event listener for the `beforematch` event. 
+- Only if the target is baseline widely available or baseline newly available, a fallback strategy MUST be present. The implementation MUST include an explicit JavaScript feature detection check for native support (e.g., `if (!('onbeforematch' in HTMLElement.prototype))`) and execute a fallback UI strategy for unsupported browsers. 
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/guide.md`
> This paragraph recommends using `<details>` before explaining that `<details>` is a solution to the use case. I'd recommend structuring this section a bit differently. Something like:
> 
> > Web interfaces often hide content from view to improve the user experience, save screen space, or increase page performance. Traditional methods like `display: none` or `visibility: hidden` work to hide content visually, but they also make that content completely inaccessible to screen readers and browser features like "Find in page".
> >
> > To hide content visually but still allow it to be searchable by users, you can use either the HTML `<details>` element or the `hidden="until-found"` attribute. The `<details>` element is generally recommended as it's simpler to implement and maintain, but there are some more complex cases where `<details>` is not sufficient and `hidden="until-found"` is required.
> >
> > For example:
> >- If you want full control over the styling of the show/hide mechanism.
> >- If the UI controls to show/hide the content are in another part of the DOM
> >- If you don't want to support hiding the content after it's shown
> 
> And then the next sections can explain how to use each, though I'd start with `<details>` since that's the primary recommendation.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+Web interfaces often hide content from view to improve the user experience, save screen space, or increase page performance. Traditional methods like `display: none` or `visibility: hidden` completely remove text from the browser's search index.
+
+In most cases, you **SHOULD** use the native HTML `<details>` element to resolve this issue (for example, for accordions, tabs, and "Read more" sections). Modern browsers natively support "Find in page" for closed `<details>` elements.
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/guide.md`
> As we discussed today, let's include a very brief example showing the `<details>` element, just to make sure its omission doesn't signal to the model that `hidden-until-found` should be preferred.
> 
> We can re-evaluate whether its needed better once we have the evals done.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+Web interfaces often hide content from view to improve the user experience, save screen space, or increase page performance. Traditional methods like `display: none` or `visibility: hidden` completely remove text from the browser's search index.
+
+In most cases, you **SHOULD** use the native HTML `<details>` element to resolve this issue (for example, for accordions, tabs, and "Read more" sections). Modern browsers natively support "Find in page" for closed `<details>` elements.
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/guide.md`
> ```suggestion
>   - details
>   - details-name
>   - hidden-until-found
> ```
> 
> Given that both of these features are mentioned in the guide.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -4,3 +4,131 @@ description: Hide content from view using patterns such as accordions, tabs, and
 web-feature-ids:
   - hidden-until-found
```

</details>

---

## PR #135: Add use cases for `mask`

### Reviews

#### **philipwalton** (APPROVED)
> Great use cases! LGTM, with just one question about a use case name.

### Comments

#### **philipwalton** on `guides/user-experience/non-geometric-shape-clipping/guide.md`
> Nit: should this be "complex-shape" instead of "non-geometric"? I don't think it matters too much since this is just a name slug, but it stuck out to me because I think this use case also applies to geometric shapes.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,7 @@
+---
+name: non-geometric-shape-clipping
```

</details>

#### **philipwalton** on `guides/user-experience/soft-edge-content-fade/demo.html`
> TIL you can use a linear-gradient as a mask image!

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+      padding: 20px;
+      border-radius: 8px;
+      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
+      mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
```

</details>

---

## PR #134: Add guide: `autofill-background-color`

### Reviews

#### **philipwalton** (COMMENTED)
> This seems like it's basically the same use case as #132, just with background instead of border, correct? If so I'd recommend combining them (unless there's a good reason not to?).

---

## PR #132: Add guide: `autofill-highlight-inputs`

### Reviews

#### **philipwalton** (COMMENTED)
> Overall this LGTM, but I did have a few questions before merging.

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (APPROVED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/autofill-highlight-inputs/demo.html`
> FYI, I'm getting an error when running the demo page because this script is run in the `<head>`, which means it doesn't find the `<form>` element.
> 
> Is this JS code required for the demo?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+    }
+
+  </style>
+  <script>
```

</details>

#### **philipwalton** on `guides/user-experience/autofill-highlight-inputs/demo.html`
> Should these comments be removed? (This and the next line.)

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  <meta http-equiv="X-UA-Compatible" content="IE=edge">
+  <meta name="viewport" content="width=device-width, initial-scale=1">
+
+  <!-- <link rel="stylesheet" href="css/main.css"> -->
```

</details>

#### **philipwalton** on `guides/user-experience/autofill-highlight-inputs/demo.html`
> Should this be removed? If not then I'd recommend a comment explanation (similar to "<!-- Alternative address format -->" above).

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+        <input id="tel" name="tel" autocomplete="tel" type="tel" maxlength="30" pattern="[\d \-\+]+" required>
+      </section>
+      <input type="submit" value="Submit" id="submit">
+      <!--       <button id="save-address" type="submit">Save address</button> -->
```

</details>

#### **philipwalton** on `guides/user-experience/autofill-highlight-inputs/guide.md`
> ```suggestion
> description: Use CSS to clearly highlight form fields that have been autofilled by the browsers and not edited by the user.
> ```
> 
> Nit: should we say "form fields" instead of "input" since autofill works with `<select>` elements as well?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: autofill-highlight-inputs
+description: Use CSS to clearly highlight inputs that have been autofilled by the browsers and not edited by the user.
```

</details>

#### **philipwalton** on `guides/user-experience/autofill-highlight-inputs/expectations.md`
> Both <input> and `<select>` right?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,8 @@
+# Expectations: `autofill-highlight-inputs`
+
+- In browsers that support the `:autofill` CSS pseudo-class, the `:autofill` CSS pseudo-class can be used to style autofilled `<input>` elements as required. JavaScript or other mechanisms SHOULD NOT be used to style autofilled `<input>` elements in browsers where the `:autofill` CSS pseudo-class is supported.
```

</details>

#### **philipwalton** on `guides/user-experience/autofill-highlight-inputs/demo.html`
> Maybe add a comment explaining why this is here?
> 
> Also, is it reliable to assume that `:-webkit-autofill` will always match the same elements as `:autofill`? I think it'd be better to define all styles on both rather than define all `border` styles on the legacy selector and then only override the `border-style` property on `:autofill`.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+      --desktop-font-size: 22px;
+    }
+
+    :-webkit-autofill {
```

</details>

#### **philipwalton** on `guides/user-experience/autofill-highlight-inputs/demo.html`
> ```suggestion
>     /*box-shadow: 0 0 0 100vmax #efe inset;*/
> ```
> Use `100vmax` instead just to be safe? Also switched just `box-shadow`.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  input:-webkit-autofill,
+  input:-webkit-autofill:hover,
+  input:-webkit-autofill:focus {
+    /*-webkit-box-shadow: 0 0 0px 40rem #efe inset;*/
```

</details>

#### **philipwalton** on `guides/user-experience/autofill-highlight-inputs/demo.html`
> Also, per may comment in https://github.com/GoogleChrome/guidance/pull/134#issuecomment-3987730598, I'd keep this here (commented out) and add a comment above it explaining that `box-shadow` can be used customize the background, given that `background` can't be overridden directly.
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  input:-webkit-autofill,
+  input:-webkit-autofill:hover,
+  input:-webkit-autofill:focus {
+    /*-webkit-box-shadow: 0 0 0px 40rem #efe inset;*/
```

</details>

#### **philipwalton** on `guides/user-experience/autofill-highlight-inputs/guide.md`
> Looks like this merge conflict got left in.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,10 @@
+---
+name: autofill-highlight-inputs
+<<<<<<< HEAD
```

</details>

#### **philipwalton** on `guides/user-experience/autofill-highlight-inputs/prompts.md`
> Optional: you might even add another, more specific prompt asking to style both the border and background color of an autofilled-input, because if we want to recommend that then we should have an eval that tests that the AI tool can use `box-shadow` as an alternative to `background`.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+Use the `:autofill` CSS pseudo-class.
+
+Use CSS to highlight form fields that have been autofilled by the browser and not edited by the user.
```

</details>

---

## PR #118: Add `:not()` and `:has()` use cases

### Reviews

#### **philipwalton** (COMMENTED)
> These are good use cases, but I think they're a bit too specific. See this thread for more context as to why that matters: https://chat.google.com/room/AAQAPIjpZaI/d5uNBYMRDX0/d5uNBYMRDX0?cls=10
> 
> Also, I think your second use case does this, but I'd definitely make sure to include a use case that covers both `:not()` and `:has()` e.g. (doesn't have) because IMO `:not()` became 10x more useful once `:has()` landed :)

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (APPROVED)
> I tweaked the demo and use cases slightly to incorporate `:not()`.

### Comments

#### **philipwalton** on `guides/user-experience/conditional-layouts/guide.md`
> ```suggestion
> description: Build a component that changes its layout based on whether it contains specific child elements. For example, if the component contains an image, use a multi-column layout, otherwise default to a single-column layout.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: conditional-layouts
+description: Build a component that changes its layout based on whether it contains an image. For example, if the component contains an image, use a multi-column layout, otherwise default to a single-column layout.
```

</details>

#### **philipwalton** on `guides/user-experience/conditional-layouts/guide.md`
> ```suggestion
> name: content-based-styling
> ```
> WDYT?
> 
> I worry "conditional-layouts" could apply to too many other use cases (e.g. container queries, style queries, etc.)

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: conditional-layouts
```

</details>

#### **philipwalton** on `guides/user-experience/default-theme-styling/guide.md`
> I like this demo and use case, but I don't think this description captures it. How about something like: "Build a component that changes its layout based on the state of one of its child elements. For example, a component that renders in light or dark mode based on whether a theme toggle is checked.
> 
> And then maybe the name is `child-state-based-styling`? WDYT?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: default-theme-styling
+description: Build a component that has a default theme that can be overridden by another theme (i.e. dark mode).
```

</details>

#### **philipwalton** on `guides/user-experience/sibling-dimming/demo.html`
> I know I suggested a `:has()` and `:not()` demo, but the effect in this particular demo could be easily achieved without `:has()` and `:not()`, so I'm not sure how useful this is.
> 
> I'm now thinking we should just make sure `:not(:has()` is present in the guide as an example for `:has()` usage in both your `content-based-styling` and `child-state-based-styling` use cases.
> 
> In other words, feel free to remove this use case as I don't think it's distinct enough.

---

## PR #117: Add :has() use cases

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
> These are good use cases, but I think they're a bit too specific. See this thread for more context as to why that matters: https://chat.google.com/room/AAQAPIjpZaI/d5uNBYMRDX0/d5uNBYMRDX0?cls=10

---

## PR #115: Use cases for color-scheme

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/performance/incorrect-theme-flash/guide.md`
> The `name` field implies what the use case is here, but the `description` field focuses more on the solution. Can you rework this so the description just covers the use case?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: prevent-incorrect-theme-flash
+description: Leverage the color-scheme specification at the earliest possible stage: the HTML parsing layer, by placing <meta name="color-scheme" content="light dark"> high within the <head> of the HTML document. The browser is reliably informed of the document's supported color schemes well before it attempts its initial viewport paint.
```

</details>

#### **philipwalton** on `guides/user-experience/stateful-theme-switching/guide.md`
> Same comments as above. I think I understand the use case from the name, but the `description` field could make it more clear.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: decouple-site-and-os-color-schemes
+description: This feature ensures users can customize their visual experience for specific contexts, such as utilizing a light theme for improved readability within an app or site while maintaining a system-wide dark theme to conserve battery or protect their screen lifetime.
```

</details>

#### **philipwalton** on `guides/performance/incorrect-theme-flash/guide.md`
> This description is framed more as a technical solution than a use case.
> 
> I think the `name` property does describe the use case well. Can you expand on that for the description? Perhaps something like:
> 
> "Implement light/dark theme support in a way that ensures the user's chosen theme is always displayed on first render, without ever seeing a flash of the default theme"

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
 ---
 name: prevent-incorrect-theme-flash
-description: Leverage the color-scheme specification at the earliest possible stage: the HTML parsing layer, by placing <meta name="color-scheme" content="light dark"> high within the <head> of the HTML document. The browser is reliably informed of the document's supported color schemes well before it attempts its initial viewport paint.
+description: Leverage the color-scheme specification at the earliest possible stage, the HTML parsing layer, so the browser is reliably informed of the document's supported themeswell before it attempts its initial viewport paint.
```

</details>

#### **philipwalton** on `guides/user-experience/brand-consistent-typographic-scaling-and-legibility/guide.md`
> Similar content to the above. This is framed as a solution. Can you reword to describe the use case that the user is trying to implement?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,7 @@
+---
+name: brand-consistent-typographic-scaling-and-legibility
+description: Leverage advanced CSS properties alongside foundational design principles, ensuring web interfaces are resilient, readable, and perfectly aligned with brand visual standards.
```

</details>

---

## PR #113: Add use-cases for `content-visibility`

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (APPROVED)
> LGTM, after making a few suggestions.

### Comments

#### **philipwalton** on `guides/performance/faster-spa-view-transitions/guide.md`
> ```suggestion
> description: Enable faster transitions between views in Single-Page Applications or complex modals, so when a user switches between views, the browser doesn't rebuild the view from scratch, instead it is shown instantly.
> ```
> 
> I'd try to make descriptions one sentence if possible.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: faster-spa-view-transitions
+description: Faster transitions between views in Single-Page Applications or complex modals. When a user switches between views, the browser doesn't rebuild the view from scratch, instead it is shown instantly.
```

</details>

#### **philipwalton** on `guides/performance/interactions-in-complex-layouts/guide.md`
> ```suggestion
> description: Make interactions snappier and more responsive (reducing Interaction to Next Paint (INP) scores) by avoiding layout re-calculations in complex layouts, such as data-heavy dashboards or spreadsheet-style grids.
> ```
> 
> Again, trying to phrase this as a single sentence.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: interactions-in-complex-layouts
+description: Make interactions snappier and more responsive by avoiding layout re-calculations in complex layouts, such as data-heavy dashboards or spreadsheet-style grids. This reduces Interaction to Next Paint (INP) scores.
```

</details>

#### **philipwalton** on `guides/performance/efficient-background-processing/guide.md`
> TIL!

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: efficient-background-processing
+description: Pause high-CPU tasks like <canvas> animations, WebSocket data streams, or heavy API polling, when they go out of view and then resume them just-in-time when they scroll back into view.
```

</details>

#### **philipwalton** on `guides/performance/defer-rendering-off-screen-content/guide.md`
> I think this use case can be implemented without `hidden-until-found`, right?
> 
> I suppose it'll depend on what the guide says, but I'd remove this unless your intent here is to ensure the person writing the guide includes this feature in the solution.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+name: defer-rendering-off-screen-content
+description: Reduce rendering times of off-screen content in content-heavy web pages, such as content with long feeds, lots of articles, or complex dashboards, by deferring rendering for any content below the fold.
+web-feature-ids:
+  - hidden-until-found
```

</details>

#### **philipwalton** on `guides/performance/defer-rendering-off-screen-content/guide.md`
> I guess it's just not clear to me how `hidden-until-found` fits into this use case, which is why I said "I suppose it'll depend on what the guide says". Were you planning on writing the guide for this? If not then we just need to make sure your implementation plan for the use case is clear in the issue.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+name: defer-rendering-off-screen-content
+description: Reduce rendering times of off-screen content in content-heavy web pages, such as content with long feeds, lots of articles, or complex dashboards, by deferring rendering for any content below the fold.
+web-feature-ids:
+  - hidden-until-found
```

</details>

#### **philipwalton** on `guides/performance/defer-rendering-off-screen-content/guide.md`
> Thanks for clarifying (and sorry for the slow reply, this thread accidentally got archived).
> 
> I *think* I now understand what you're describing, but it would be helpful to see a demo because my naive understanding of `hidden-until-found` is that it's a design consideration and not something you'd use for performance reasons. If you want to improve performance but keep off-screen text searchable, then you'd use `content-visibility: auto`. Right?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+name: defer-rendering-off-screen-content
+description: Reduce rendering times of off-screen content in content-heavy web pages, such as content with long feeds, lots of articles, or complex dashboards, by deferring rendering for any content below the fold.
+web-feature-ids:
+  - hidden-until-found
```

</details>

#### **philipwalton** on `guides/performance/defer-rendering-heavy-content/guide.md`
> ```suggestion
> description: Reduce rendering times in content-heavy web pages (e.g. pages with long feeds, lots of articles, or complex dashboards), by deferring rendering for any content that is not immediately visible to the user.
> ```
> 
> I removed the "native browser features" bit to keep this focused on the use case and not the solution. I also reworded a bit to make it easier to read (at least for me).
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,7 @@
+---
+name: defer-rendering-heavy-content
+description: Reduce rendering times in content-heavy web pages, such as pages with long feeds, lots of articles, or complex dashboards, by using native browser features to defer rendering for any content that is not immediately visible to the user.
```

</details>

#### **philipwalton** on `guides/performance/efficient-background-processing/guide.md`
> ```suggestion
> description: Pause high-CPU tasks like `<canvas>` animations, WebSocket data streams, or heavy API polling, when they go out of view to conserve device resources, and then resume them just-in-time when they scroll back into view.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: efficient-background-processing
+description: Pause high-CPU tasks like <canvas> animations, WebSocket data streams, or heavy API polling, when they go out of view and then resume them just-in-time when they scroll back into view.
```

</details>

#### **philipwalton** on `guides/performance/faster-spa-view-transitions/guide.md`
> ```suggestion
> description: Enable faster transitions between views in Single-Page Applications or other complex user interfaces with large DOM structures that can normally take a long time to render.
> ```
> Remove the bit about "rebuilding from scratch", as I think that can be mentioned as part of the solution in the guide.
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: faster-spa-view-transitions
+description: Enable faster transitions between views in Single-Page Applications or complex modals, so when a user switches between views, the browser doesn't rebuild the view from scratch, instead it is shown instantly.
```

</details>

---

## PR #112: Use cases for Scheduler API

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
> I made a few suggestions inline.
> 
> In addition, I think one missing use case is the "yield + continuation" use case for `scheduler.yield()`, where you want to yield to the main thread but you don't want your continuation work to get put at the end of the queue: https://developer.chrome.com/blog/use-scheduler-yield#prioritized_continuations_after_yielding

#### **philipwalton** (APPROVED)
> Updates look great, thanks!

### Comments

#### **philipwalton** on `guides/performance/complex-computations-and-loops/guide.md`
> ```suggestion
> description: Break up heavy synchronous processing or DOM updates, to let the browser handle user input and repaint the screen
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: complex-computations-and-loops
+description: Break up heavy synchronous processing or DOM updates, to let the browser handle user input and repaint the screen using the Scheduler API.
```

</details>

#### **philipwalton** on `guides/performance/prioritized-preloading/guide.md`
> I'd generalize the "background network requests" to just something like "low priority work", in order to match more varied prompts.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: prioritized preloading
+description: Orchestrate background network requests without competing with critical rendering using the Scheduler API.
```

</details>

---

## PR #111: Use cases: `light-dark()`

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
> These use cases LGTM.
> 
> I think, for these in particular, a minimal demo showing them in action would be useful to make it clear to the folks writing the guide exactly what you mean.

#### **malchata** (COMMENTED)
> Just some quick questions/changes.

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **malchata** (COMMENTED)
*(No review body)*

#### **philipwalton** (APPROVED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/component-specific-light-dark-theme/guide.md`
> ```suggestion
> description: Create component-specific themes by forcing explicit color schemes on individual UI elements, giving users theme choices that are decoupled from their global operating system preferences
> ```
> 
> I'd remove the mention of the solution (i.e. the feature) in the use case description.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: component-specific-light-dark-theme
+description: Create component-specific themes by forcing explicit color schemes on individual UI elements, giving users theme choices that are decoupled from their global operating system preferences by combining localized color-scheme properties with the light-dark() CSS color function.
```

</details>

#### **philipwalton** on `guides/user-experience/light-dark-theme-semantic-color-palettes/guide.md`
> ```suggestion
> description: Implement semantic color palettes for both light and dark modes natively on a single line, eliminating the need to write bulky @media (prefers-color-scheme: dark) blocks to overwrite custom properties
> ```
> 
> Same comment as above.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: light-dark-theme-semantic-color-palettes
+description: Implement semantic color palettes for both light and dark modes natively on a single line, eliminating the need to write bulky @media (prefers-color-scheme: dark) blocks to overwrite custom properties using the light-dark() CSS color function.
```

</details>

#### **malchata** on `guides/user-experience/component-specific-light-dark-theme/demo.html`
> Consider using a `<main>` or `<section>` element here.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+    Toggle Page Theme (System Default)
+  </button>
+
+  <div class="card-grid">
```

</details>

#### **malchata** on `guides/user-experience/component-specific-light-dark-theme/demo.html`
> Is a `<div>` here the appropriate approach? Wondering if a unordered list might be semantically better.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+    </div>
+
+    <!-- Card 2: Exclusively forced to light mode -->
+    <div class="themed-card force-light">
```

</details>

#### **malchata** on `guides/user-experience/light-dark-theme-semantic-color-palettes/guide.md`
> Not sure what these are called, but would a `>-` and a line break before the property value also fix this?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: light-dark-theme-semantic-color-palettes
+description: "Implement semantic color palettes for both light and dark modes natively on a single line, eliminating the need to write bulky `@media (prefers-color-scheme: dark)` blocks."
```

</details>

#### **malchata** on `guides/user-experience/component-specific-light-dark-theme/demo.html`
> Wondering if using `light-dark()` here in an inline style without something to block rendering until this is complete cause a potential "flash of color preference" here (I just made that up!) where the initial OS setting will appear first and suddenly shift? Just a thing to think about.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  <meta charset="UTF-8">
+  <meta name="viewport" content="width=device-width, initial-scale=1.0">
+  <title>Component-Specific Default Theme Demo</title>
+  <style>
```

</details>

#### **philipwalton** on `guides/user-experience/component-specific-light-dark-theme/demo.html`
> FYI: Inline <style> tags in the head will block rendering.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  <meta charset="UTF-8">
+  <meta name="viewport" content="width=device-width, initial-scale=1.0">
+  <title>Component-Specific Default Theme Demo</title>
+  <style>
```

</details>

#### **malchata** on `guides/user-experience/component-specific-light-dark-theme/demo.html`
> Thought so. Just had a nagging thought.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  <meta charset="UTF-8">
+  <meta name="viewport" content="width=device-width, initial-scale=1.0">
+  <title>Component-Specific Default Theme Demo</title>
+  <style>
```

</details>

#### **philipwalton** on `guides/user-experience/component-specific-light-dark-theme/guide.md`
> ```suggestion
>   - color-scheme
>   - light-dark
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+name: component-specific-light-dark-theme
+description: Create component-specific themes by forcing explicit color schemes on individual UI elements, giving users theme choices that are decoupled from their global operating system preferences
+web-feature-ids: 
+  - light-dark
```

</details>

#### **philipwalton** on `guides/user-experience/component-specific-light-dark-theme/demo.html`
> Resolving since I don't think this matters for the purposes of this demo.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+    </div>
+
+    <!-- Card 2: Exclusively forced to light mode -->
+    <div class="themed-card force-light">
```

</details>

#### **philipwalton** on `guides/user-experience/light-dark-theme-semantic-color-palettes/guide.md`
> ```suggestion
>   - color-scheme
>   - light-dark
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+name: light-dark-theme-semantic-color-palettes
+description: "Implement semantic color palettes for both light and dark modes natively on a single line, eliminating the need to write bulky `@media (prefers-color-scheme: dark)` blocks."
+web-feature-ids: 
+  - light-dark
```

</details>

---

## PR #110: Add speculation rules guide

### Reviews

#### **rviscomi** (COMMENTED)
> Could you also add a [prompt setup file](https://chat.google.com/room/AAQAPIjpZaI/ckbpdJ_5tVM/ckbpdJ_5tVM?cls=10)? That would give the agent a specific problem to solve, and then the expectations file could be more specific about the expected outcomes, eg prefetch a document rule at moderate eagerness, but in a way that doesn't also prefetch the logout page.

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (APPROVED)
*(No review body)*

### Comments

#### **rviscomi** on `guides/performance/improve-loading-speed-of-links-with-speculation-rules/expectations.md`
> The expectations and evals should be as objective and deterministic as possible. Could you try to quantify how many is "too many" links to fail the eval?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  - `"moderate"`
+  - `"conservative"`
+- If using `immediate` for `urls` property then the `urls` property should contain a maximum of 10 urls, and ideally fewer.
+- If using `immediate` for `where` property then the rule should be very specific and not match too many links.
```

</details>

#### **rviscomi** on `guides/performance/improve-loading-speed-of-links-with-speculation-rules/guide.md`
> The guidance says that a fallback strategy isn't needed, but one is provided anyway. Could you clarify when an agent would be expected to use the library?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+### Speculation rules polyfill
+
+A polyfill for speculation does not exist but libraries like [Quicklink](https://github.com/GoogleChrome/quicklink) provide similar functionality for prefetching with cross-browser support.
```

</details>

#### **rviscomi** on `guides/performance/improve-loading-speed-of-links-with-speculation-rules/guide.md`
> It might not be clear to agents when prerendering becomes appropriate. Is there any more guidance we can give to help it make that decision?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+Less eager speculative loading is a good choice when it is less obvious what the user will do next, when there are many links on the page, each equally likely to be visited. By waiting for more signals, such as hovering, or starting to click on the page, you can get a head-start on the next page and improve the user experience, even if it is not fully prefetched or prerender.
+
+Similarly, prefetch is a more conservative choice than prerender, using less resources (on both the client and the server side) but providing less benefit to the user. It is a good choice for initial implementation, expanding to prerender later if appropriate.
```

</details>

#### **rviscomi** on `guides/performance/improve-next-page-load-performance/expectations.md`
> TIL! Should this be in the guidance? How and why to set a tag.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  - `"prefetch"`
+  - `"prerender"`
+  - `"prerender_until_script"`
+  - `"tag"`
```

</details>

#### **philipwalton** on `guides/performance/improve-loading-speed-of-links-with-speculation-rules/guide.md`
> ```suggestion
> Less eager speculative loading is a good choice when it is less obvious what the user will do next, when there are many links on the page, each equally likely to be visited. By waiting for more signals, such as hovering, or starting to click on the page, you can get a head-start on the next page and improve the user experience, even if it is not fully prefetched or prerendered.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+More eager speculative loading is a good choice for pages that are likely to be visited next, such as a headline article or the next page in a stepped process like a learning a course.
+
+Less eager speculative loading is a good choice when it is less obvious what the user will do next, when there are many links on the page, each equally likely to be visited. By waiting for more signals, such as hovering, or starting to click on the page, you can get a head-start on the next page and improve the user experience, even if it is not fully prefetched or prerender.
```

</details>

#### **philipwalton** on `guides/performance/improve-loading-speed-of-links-with-speculation-rules/guide.md`
> ```suggestion
> A `tag` can also be used, either at a global level or on a per-rule basis. When set, this tag will be included in the `Sec-Speculation-Tags` header, and allows you to identify server-side which speculations were made.
> ```
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+Speculation rules have a JSON-based format and can be included in a `<script type="speculationrules">` tag. The rules can be included in the `<head>` or `<body>` of the document, or can be dynamically added using JavaScript.
+
+A `tag` can also be used, either at a global level or on a per-rule basis. This allows identification of which speuclations (and which rules) server-side and is a best practice.
```

</details>

#### **philipwalton** on `guides/performance/improve-next-page-load-performance/guide.md`
> Of specific URLs? The phrase "of specific..." is used here and in the next few examples, and it seems like a word may be missing from the heading?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+A `tag` can also be used, either at a global level or on a per-rule basis. This allows identification of which speuclations (and which rules) server-side and is a best practice.
+
+### Example of a simple URL list rule of specific for prefetching
```

</details>

#### **philipwalton** on `guides/performance/improve-next-page-load-performance/guide.md`
> This API has been around a while, so I think LLMs may be aware of the tradeoffs, but is it worth listing them here just in case?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- **DO** take more care when using speculation rules for dynamic pages, where the content is more likely to change often, may become out of date, and where pages are more expensive to produce.
+- **DO** prefer document rules over list rules, as they are more flexible, allow the same rule to be shared across multiple pages, and can be used to prefetch and prerender pages that are not known in advance.
+- **DO** consider the trade-offs between prefetch and prerender, and choose the appropriate one for your use case. Ask the developer for their preference if unsure.
+- **DO** consider the trade-offs between the different `eagerness` levels, and choose the appropriate one for your use case. Ask the developer for their preference if unsure.
```

</details>

#### **philipwalton** on `guides/performance/improve-next-page-load-performance/guide.md`
> In other guides we've tried to avoid listing the specific browsers that do/don't support a feature, and instead just say something like "...not currently supported in all modern browsers (Baseline limited availability)", as that is easier to keep up-to-date.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Browser support and fallback strategies
+
+Speculative loading is a new feature, and as such, browser support is limited, primarily to Chromium-based browsers, though an implementation exists in Safari for prefetch and is expected to be available soon.
```

</details>

#### **philipwalton** on `guides/performance/improve-next-page-load-performance/guide.md`
> I would make a stronger recommendation here, and clearly state that lack of browser support is not a good reason not to use this feature. Maybe something like:
> 
> "However, even though Speculation Rules is not supported in some browsers, it is perfectly safe to use an enhancement, and is highly recommended given the potential performance benefits. If a browser does not support speculation rules, it will simply ignore the instructions."

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+Speculative loading is a new feature, and as such, browser support is limited, primarily to Chromium-based browsers, though an implementation exists in Safari for prefetch and is expected to be available soon.
+
+Speculative loading can be seen as a progressive enhancement, where the browser will use the speculation rules if supported, and will ignore them if not supported. This means that you do not need to provide a fallback strategy, as the browser will handle it for you.
```

</details>

#### **philipwalton** on `guides/performance/improve-next-page-load-performance/guide.md`
> TBH, I think I would omit this, given that it doesn't support the Speculation Rules format and there is no performance degradation in browsers that don't support the API. 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+Speculative loading can be seen as a progressive enhancement, where the browser will use the speculation rules if supported, and will ignore them if not supported. This means that you do not need to provide a fallback strategy, as the browser will handle it for you.
+
+If you wish to also support other browsers, libraries like [Quicklink](https://github.com/GoogleChrome/quicklink) provide similar functionality for prefetching with cross-browser support, though do not support the speculation rules syntax, nor prerendering.
```

</details>

#### **philipwalton** on `guides/performance/improve-loading-speed-of-links-with-speculation-rules/guide.md`
> ```suggestion
> description: Improve page load performance by prefetching or prerendering pages that the user is likely to visit next.
> ```
> We've been trying to avoid mentioning the solution in the use case description

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,128 @@
+---
+name: improve-loading-speed-of-links-with-speculation-rules
+description: Use speculation rules to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
```

</details>

#### **philipwalton** on `guides/performance/improve-loading-speed-of-links-with-speculation-rules/guide.md`
> ```suggestion
> name: improve-next-page-load-performance
> ```
> ...or something like this that does't include the feature name. And then update the directory name to match.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,128 @@
+---
+name: improve-loading-speed-of-links-with-speculation-rules
```

</details>

#### **philipwalton** on `guides/performance/improve-loading-speed-of-links-with-speculation-rules/guide.md`
> ```suggestion
> # Improve next page load performance
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  - speculation-rules
+---
+
+# Improve loading speed of links with speculation rules
```

</details>

#### **philipwalton** on `guides/performance/improve-loading-speed-of-links-with-speculation-rules/guide.md`
> ```suggestion
> One of the most effective ways to improve page load performance for users navigating a site is to initiate loading the next page they're about to visit *before* they visit it. This can be done through a technique called speculative loading using the Speculation Rules API.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+# Improve loading speed of links with speculation rules
+
+Speculative loading is a technique that allows you to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
```

</details>

#### **philipwalton** on `guides/performance/improve-next-page-load-performance/prompts.md`
> I'll be curious to see if this prompt matches the guide above...

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,9 @@
+# Prompts: `improve-loading-speed-of-links-with-speculation-rules`
+
+- Improve the speed of my website
```

</details>

#### **philipwalton** on `guides/performance/improve-next-page-load-performance/guide.md`
> ```suggestion
> However, speculative loading is a progressive enhancement. It is perfectly safe to use as an enhancement, and is highly recommended given the potential performance benefits. If a browser does not support speculation rules, it will simply ignore them.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+Speculative loading is a new feature, and as such, is not supported in all modern browsers (Baseline limited availability).
+
+However, speculative loading is a progressive enhancement. It is perfectly safe to use an enhancement, and is highly recommended given the potential performance benefits. If a browser does not support speculation rules, it will simply ignore them.
```

</details>

---

## PR #109: Use cases: image-set()

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (APPROVED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/performance/inject-sharp-pseudo-element-icons/guide.md`
> Great use case. I'd recommend generalizing it a bit so that it matches more varied prompts. I think you can also drop the feature name from the description, since it'll be in the guide content.
> 
> Here's a suggestion, but feel free to tweak if you want.
> 
> ```suggestion
> description: Use resolution-optimized images in CSS  pseudo elements (such as `::before` and `::after`) to reduce the number of DOM nodes 
> ```
> 
> The guide description can then expand on why developers needed to use DOM nodes for this in the past.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,7 @@
+---
+name: inject-sharp-pseudo-element-icons
+description: Inject sharp, resolution-optimized UI icons into ::before and ::after pseudo-elements without adding unnecessary DOM nodes using the image-set() CSS functional notation within the content property
```

</details>

#### **philipwalton** on `guides/user-experience/deliver-appropriate-image-resolutions/guide.md`
> I wonder if this and the following use case should be combined into a single use case that's essentially: "Deliver responsive images in CSS, supporting situations where modifying the HTML is difficult or impossible".

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: deliver-appropriate-image-resolutions
+description: Deliver appropriate background image resolutions for varying device pixel densities and network bandwidth constraints using the image-set() CSS functional notation
```

</details>

#### **philipwalton** on `guides/user-experience/deliver-appropriate-image-resolutions/guide.md`
> Agreed, though my point was the `<img srcset>` and `<picture>` already give developers this ability, and those APIs are widely available. So AFAICT the main reason to use `image-set()` is in situations where you can't use `<img>` or `<picture>` for whatever reason, and I think we want to frame the use case in a way that will likely match developer prompts for those cases.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: deliver-appropriate-image-resolutions
+description: Deliver appropriate background image resolutions for varying device pixel densities and network bandwidth constraints using the image-set() CSS functional notation
```

</details>

#### **philipwalton** on `guides/user-experience/deliver-appropriate-image-resolutions/guide.md`
> > I believe this should be clearly explained in the guide. Should we make sure to add it to the summary of the use-case?
> 
> I think it's fine to have it in the guide itself (no need to spell it out in the use case). We'll just need to make sure this requirement is stated in the use case issue so it's clear to the contractors to mention it. cc: @rviscomi 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: deliver-appropriate-image-resolutions
+description: Deliver appropriate background image resolutions for varying device pixel densities and network bandwidth constraints using the image-set() CSS functional notation
```

</details>

---

## PR #108: Add new use cases,  guides and demos for scrollbar customization, animation and preference adaptation.

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **philipwalton** (APPROVED)
> LGTM with a few additional suggestions.

### Comments

#### **philipwalton** on `guides/user-experience/adapt-scrollbar-to-contrast-preferences/guide.md`
> ```suggestion
>   - scrollbar-color
>   - prefers-contrast
> ```
> 
> If this is a key feature for this use case then it should be included here

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+name: adapt-scrollbar-to-contrast-preferences
+description: Enhance scrollbar visibility for users who prefer high-contrast interfaces
+web-features:
+  - scrollbar-color
```

</details>

#### **philipwalton** on `guides/user-experience/adapt-scrollbar-to-contrast-preferences/guide.md`
> I think this is a good as a use case, but perhaps this is also something that should be included in a top-level skill file. @rviscomi WDYT?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,68 @@
+---
+name: adapt-scrollbar-to-contrast-preferences
+description: Enhance scrollbar visibility for users who prefer high-contrast interfaces
```

</details>

#### **philipwalton** on `guides/user-experience/adapt-scrollbar-to-contrast-preferences/guide.md`
> Ideally we'd be specifying this in terms of a Baseline target, rather than just "legacy versions of Safari/Chrome", so that AI agent can understand whether or not it needs to include this in a given project.
> 
> Perhaps something like "If your Baseline target is older than Baseline 2025, then..."
> 
> @rviscomi we still need to figure out exactly how we phrase this, and also test that it works.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+
+## Legacy WebKit Fallbacks
+
+If you are using legacy WebKit pseudo-elements to ensure custom colored scrollbars on older versions of Safari/Chrome, the variable assignments from the media query above will automatically cascade to the fallback.
```

</details>

#### **philipwalton** on `guides/user-experience/adapt-scrollbar-to-light-dark-preferences/guide.md`
> ```suggestion
>   - scrollbar-color
>   - color-scheme
>   - prefers-color-scheme
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+name: adapt-scrollbar-to-light-dark-preferences
+description: Ensure the scrollbar visually matches the user's operating system light/dark mode preference
+web-features:
+  - scrollbar-color
```

</details>

#### **philipwalton** on `guides/user-experience/adapt-scrollbar-to-light-dark-preferences/guide.md`
> I wonder if it's better to say "non-standard" rather than "legacy", which could maybe side step the Baseline issue I mentioned in a comment above.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+If you are using `scrollbar-color` or the legacy `::-webkit-scrollbar` pseudo-elements to explicitly define custom scrollbar colors, you MUST ensure these colors are legible and appropriate in both light and dark modes.
+
+MANDATORY: Use CSS custom properties (variables) to define your colors and update them within a `prefers-color-scheme` media query to avoid repetition.
+MANDATORY: To prevent conflicts between standard properties and legacy WebKit selectors in browsers that support both natively (like modern Chrome), you MUST wrap legacy WebKit fallbacks in an `@supports not (scrollbar-color: auto)` block.
```

</details>

#### **philipwalton** on `guides/user-experience/adapt-scrollbar-to-light-dark-preferences/expectations.md`
> Repeating what I said above, it'd be great if we could test that this fallback isn't included if the project's Baseline target doesn't require it.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+* The explicit scrollbar colors use the standard `scrollbar-color: var(--thumb) var(--track)` property applied directly to the scrollable element.
+* The explicit `scrollbar-width` property is also applied to the scrollable element to ensure the custom colors render on macOS.
+* The explicit `scrollbar-gutter: stable` property is applied to ensure the track background is visible on macOS.
+* The fallback `::-webkit-scrollbar-*` styling is conditionally applied within an `@supports not (scrollbar-color: auto)` or equivalent feature query to prevent overriding modern properties.
```

</details>

#### **philipwalton** on `guides/user-experience/animate-scrollbar-color-on-scroll/guide.md`
> ```suggestion
>   - https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline
>   - https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Properties_and_values_API/Registering_properties
>   
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+  - registered-custom-properties
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-color
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline
```

</details>

#### **philipwalton** on `guides/user-experience/customize-scrollbar-color/guide.md`
> I'd combine this and the following use case into a single "Customize the color or thickness of a scrollbar" use case that shows how to do both.
> 
> Otherwise, if a user's prompt asks to do both then the MCP server would likely return both guides (which is probably unnecessary).

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,60 @@
+---
+name: customize-scrollbar-color
+description: Change the color scheme of the scrollbar
```

</details>

#### **rviscomi** on `guides/user-experience/adapt-scrollbar-to-contrast-preferences/guide.md`
> Maybe for now let's see how well agents are able to discover this use case with specific and vague prompts, and if it's not as discoverable as we'd like, we can add something to the skill file.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,68 @@
+---
+name: adapt-scrollbar-to-contrast-preferences
+description: Enhance scrollbar visibility for users who prefer high-contrast interfaces
```

</details>

#### **philipwalton** on `guides/user-experience/adapt-scrollbar-to-contrast-preferences/guide.md`
> Yeah, keep it, I was just saying we should have a plan for how to log these things as they come up.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,68 @@
+---
+name: adapt-scrollbar-to-contrast-preferences
+description: Enhance scrollbar visibility for users who prefer high-contrast interfaces
```

</details>

#### **philipwalton** on `guides/user-experience/adapt-scrollbar-to-light-dark-preferences/expectations.md`
> I'll update the expectation so we don't forget to enable it

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+* The explicit scrollbar colors use the standard `scrollbar-color: var(--thumb) var(--track)` property applied directly to the scrollable element.
+* The explicit `scrollbar-width` property is also applied to the scrollable element to ensure the custom colors render on macOS.
+* The explicit `scrollbar-gutter: stable` property is applied to ensure the track background is visible on macOS.
+* The fallback `::-webkit-scrollbar-*` styling is conditionally applied within an `@supports not (scrollbar-color: auto)` or equivalent feature query to prevent overriding modern properties.
```

</details>

#### **philipwalton** on `guides/user-experience/adapt-scrollbar-to-light-dark-preferences/expectations.md`
> ```suggestion
> * If the legacy WebKit pseudo elements are needed to support the user's Baseline target, `::-webkit-scrollbar-*` styling is conditionally applied within an `@supports not (scrollbar-color: auto)` or equivalent feature query to prevent overriding modern properties.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+* The explicit scrollbar colors use the standard `scrollbar-color: var(--thumb) var(--track)` property applied directly to the scrollable element.
+* The explicit `scrollbar-width` property is also applied to the scrollable element to ensure the custom colors render on macOS.
+* The explicit `scrollbar-gutter: stable` property is applied to ensure the track background is visible on macOS.
+* The fallback `::-webkit-scrollbar-*` styling is conditionally applied within an `@supports not (scrollbar-color: auto)` or equivalent feature query to prevent overriding modern properties.
```

</details>

#### **philipwalton** on `guides/user-experience/adapt-scrollbar-to-light-dark-preferences/expectations.md`
> ```suggestion
> * If the legacy WebKit pseudo elements are needed to support the user's Baseline target, the fallback includes basic `::-webkit-scrollbar` dimensions (e.g., `width` or `height`) so the scrollbar renders its colors in webkit browsers.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+* The explicit `scrollbar-width` property is also applied to the scrollable element to ensure the custom colors render on macOS.
+* The explicit `scrollbar-gutter: stable` property is applied to ensure the track background is visible on macOS.
+* The fallback `::-webkit-scrollbar-*` styling is conditionally applied within an `@supports not (scrollbar-color: auto)` or equivalent feature query to prevent overriding modern properties.
+* The fallback includes basic `::-webkit-scrollbar` dimensions (e.g., `width` or `height`) so the scrollbar renders its colors in webkit browsers.
```

</details>

---

## PR #107: Use case for field-sizing: content

### Reviews

#### **philipwalton** (APPROVED)
> LGTM, with the one suggestion.

### Comments

#### **philipwalton** on `guides/user-experience/form-fields-automatically-fit-contents/guide.md`
> ```suggestion
> description: Allow form fields to grow and shrink to fit the user input, e.g. as the user types or selects a different option. Apply maximum and minimum size limits to create dynamic and responsive form fields that conform with the page design.
> ```
> 
> Right?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: form-fields-automatically-fit-contents
+description: Allow form fields to grow and shrink to fit the user input, e.g. as the user types or selects a different option. Apply maximum and minimum size limits to create dynamic and responsive form fields that confirm with the page design.
```

</details>

---

## PR #106: Use cases for text-wrap values: nowrap, balance, pretty, and stable.

### Reviews

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (APPROVED)
> Overall this LGTM, modulo getting some clarity on the recommendation for `pretty`.

### Comments

#### **philipwalton** on `guides/user-experience/improve-body-text-layout-and-legibility/guide.md`
> BTW, on MDN it [specifically says](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-wrap#pretty) that `pretty` can be used for body copy
> 
> > Results in the same behavior as wrap, except that the user agent will use a slower algorithm that favors better layout over speed. This is intended for body copy where good typography is favored over performance (for example, when the number of orphans should be kept to a minimum).

#### **philipwalton** on `guides/user-experience/improve-heading-text-layout-and-legibility/guide.md`
> Also BTW, on MDN [it says](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-wrap#balance) balance is limited to 6 (or less) lines in Chrome. Should this be updated to say 4?

#### **philipwalton** on `guides/user-experience/improve-body-text-layout-and-legibility/guide.md`
> It would probably be good to get the feature owner's perspective on this. My gut reaction is not recommend this as the default for body text, but to suggest it as a solution appropriate for body text on sites that care deeply about their typography and design aesthetics.

---

## PR #104: Add use cases for `hidden="until-found"`

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (APPROVED)
> LGTM if you remove the use case I mentioned in my comment.

### Comments

#### **philipwalton** on `guides/user-experience/deep-link-to-hidden-content/guide.md`
> I think it might be worth expanding on what "hidden content" means here, in the hopes that it matches more prompts. Perhaps something like: "Deep-link to collapsed or visually hidden content using..."
> 
> WDYT?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: deep-link-to-hidden-content
+description: Deep-link to hidden content using URL fragments and "Scroll to Text Fragment" links. 
```

</details>

#### **philipwalton** on `guides/user-experience/search-hidden-content/guide.md`
> ```suggestion
> description: Hide content from view using patterns such as accordions, tabs, and "Read more" sections, and enable native "Find in page" search to show hidden regions, while ensuring content can be indexed for search and referenced by `aria` attributes for accessibility.
> ```
> 
> Nit: I'd make this one sentence, otherwise it reads like two use cases.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: search-hidden-content
+description: Hide content from view using patterns such as accordions, tabs, and "Read more" sections, and enable native "Find in page" search to show hidden regions. Ensure content can be indexed for search and referenced by `aria` attributes for accessibility.
```

</details>

#### **philipwalton** on `guides/performance/reduce-rendering-time/guide.md`
> I think I'd remove this use case.
> 
> As worded, I think it's too generic and will likely match lots of prompts where the hidden-until-found feature probably isn't helpful or the best fit (especially given the generic mention of improving Core Web Vitals). I'm also not sure we'd recommend this API as a solution to improving Core Web Vitals, so I think it's fine to omit this from the tool.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: reduce-rendering-time
+description: Reduce rendering times in content-heavy web pages, such as long feeds or dashboards. Improve critical Core Web Vitals, including Largest Contentful Paint (LCP) and Interaction to Next Paint (INP).
```

</details>

---

## PR #102: Move before usecases

### Reviews

#### **philipwalton** (COMMENTED)
> > Open question. Should we have one use-case per type of element that isn't now no-longer impacted by a re-parenting?
> 
> I think it primarily comes down to:
> 1. How different do we expect the guides to be for each of these similar use cases
> 2. Whether or not we think we can combine them into a single use case where the AI tool would still reliably match each of the sub-use-cases.
> 
> In this case, I think a single use case like the following could potentially work: "Move or reparent a DOM element without losing important element state, such as interactivity states (:focus/:active), <iframe> loading state, animation/transition state, etc.". You could potentially even list all of the things mentioned [here in the MDN docs](https://developer.mozilla.org/en-US/docs/Web/API/Element/moveBefore#description).
> 
> Then another use case not mentioned in this PR that I think is important is the VDOM / JS framework reactivity use case. While the guidance for that is probably the same as the one I just listed, I think its description is different enough that it might match different prompts.
> 
> WDYT?

#### **philipwalton** (APPROVED)
*(No review body)*

---

## PR #101: Container and Style Query Use Cases

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (APPROVED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/adaptive-cta-buttons/guide.md`
> I would generalize this use case to cover any situation where you want to style a component conditionally based on the size of a containing element.
> 
> The guide can then provide some specific examples (like this one).

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: Adaptive CTA Buttons
+description: Change the visible portions of a CTA button based on how large the button is, for instance, swapping to just an icon from an icon and text.
```

</details>

#### **philipwalton** on `guides/user-experience/size-aware-layouts/guide.md`
> Similar to my first comment on `adaptive-cta-buttons`, I'd generalize this into a single use case.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: Size-Aware Layouts
+description: Create a component, like a card, that can change its layout based on its own width, letting a single component work in grids, sidebars, and even hero slots.
```

</details>

#### **philipwalton** on `guides/user-experience/fluid-typography/guide.md`
> Good use case. I'm wondering if there are other similar use cases that fit into the "scale smoothly" paradigm (rather than the typical "breakpoint" styling) in addition to font sizes?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: Fluid Typography
+description: Scale font size smoothly based on the parent container's available space instead of the viewport size.
```

</details>

#### **philipwalton** on `guides/user-experience/design-token-reactivity/guide.md`
> Should this say "child components" or "descendant components" instead of "individual components"?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: Design Token Reactivity
+description: Define higher-order design tokens, like density modes (compact, comfortable, spacious) and have individual components react directly to them.
```

</details>

#### **philipwalton** on `guides/user-experience/component-level-theme-switching/guide.md`
> Can you clarify what this means? When you say "manage their own theme styling directly", is this something different from reacting to container styles?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: Component-Level Theme Switching
+description: Let components manage their own theme styling directly instead of relying on body class indirection or JavaScript.
```

</details>

#### **philipwalton** on `guides/user-experience/state-driven-component-variations/guide.md`
> Is this sufficiently different from the "design-token-reactivity" use case?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: State-Driven Component Variations
+description: Change how a component is displayed based state by combining a CSS variable that changes, for instance, when a layout area changes from single-column to a sidebar.
```

</details>

#### **philipwalton** on `guides/user-experience/state-driven-component-variations/guide.md`
> SG, we'll just need to make sure it's very clear to folks writing the guide exactly what solution you're envisioning.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: State-Driven Component Variations
+description: Change how a component is displayed based state by combining a CSS variable that changes, for instance, when a layout area changes from single-column to a sidebar.
```

</details>

#### **philipwalton** on `guides/user-experience/design-token-reactivity/guide.md`
> ```suggestion
> name: design-token-reactivity
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: Design Token Reactivity
```

</details>

#### **philipwalton** on `guides/user-experience/fluid-scaling/guide.md`
> ```suggestion
> name: fluid-scaling
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: Fluid Scaling
```

</details>

#### **philipwalton** on `guides/user-experience/fluid-scaling/guide.md`
> Though should this be "fluid-container-based-scaling"? I go back and forth on whether the current name is too generic.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: Fluid Scaling
```

</details>

#### **philipwalton** on `guides/user-experience/fluid-scaling/guide.md`
> ```suggestion
> description: Scale items like font size, spacing, and media sizes smoothly based on the parent container's size rather than using fixed breakpoints
> ```
> WDYT? Also, I removed "without JavaScript" because that will be clear from the implementation instructions (and any prompt asking to do this without JS would still match this use case, but a prompt that *didn't* specify no JS might not).

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: Fluid Scaling
+description: Scale items smoothly based on the parent container's size instead of viewport size and without JavaScript. Commonly used for font size, spacing, and media assets.
```

</details>

#### **philipwalton** on `guides/user-experience/size-aware-adaptations/guide.md`
> ```suggestion
> description: Build a component whose styles can be conditionally dependent on its own width or height, rather than the width or height of the viewport. For example a card component that can change its layouts depending on how large it is, or a call-to-action button that can conditionally display helper text based on its width.
> ```
> 
> Reworded this to make it more clear. Let me know if you think anything has been lost.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: Size-Aware Adaptations
+description: Have a component adapt based on its own size, typically width, instead of tying them to the viewport with media queries and without JavaScript. Common usecases include card components that can change their layouts depending on how large they are, or removing or adding helper text next to an icon in a call-to-action button.
```

</details>

#### **philipwalton** on `guides/user-experience/size-aware-adaptations/guide.md`
> ```suggestion
> name: size-aware-adaptations
> ```
> Maybe `size-aware-styling`? WDYT?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: Size-Aware Adaptations
```

</details>

#### **philipwalton** on `guides/user-experience/state-driven-component-variations/guide.md`
> ```suggestion
> description: Build a component that can adapt its styles conditionally based on where it appears in the DOM (via CSS custom property inheritance) rather than available size. For example, a table of contents components that is expanded in the sidebar but collapsed in a single-column layout.
> ```
> Similar to above, I reworded this to make it more active. Let me know if you think anything is lost.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: Usage-Aware Component Variations
+description: Adapt a component based on where on a page it's used by toggling a CSS variable in a parent. Can be used, for insatnce, to expand or collapse a table of contents depending on whether it's in a sing-column layout or used in a sidebar, both of which may have overlapping widths making size-based adjustements not accurate enough.
```

</details>

#### **philipwalton** on `guides/user-experience/state-driven-component-variations/guide.md`
> ```suggestion
> name: usage-aware-component-variations
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: Usage-Aware Component Variations
```

</details>

#### **philipwalton** on `guides/user-experience/size-aware-adaptations/guide.md`
> Got it. Let's go with styling as I think that's more generally applicable, but the next step is going to be to test all of these anyway and see how well the LLM understands the guidance.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: Size-Aware Adaptations
```

</details>

#### **philipwalton** on `guides/user-experience/fluid-scaling/guide.md`
> Yeah, I don't know which one will be more effective. So we'll have to test it and we can make changes as needed based on those results.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: Fluid Scaling
+description: Scale items smoothly based on the parent container's size instead of viewport size and without JavaScript. Commonly used for font size, spacing, and media assets.
```

</details>

#### **philipwalton** on `guides/user-experience/fluid-scaling/guide.md`
> Let's keep it for now.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: Fluid Scaling
```

</details>

#### **philipwalton** on `guides/user-experience/size-aware-adaptations/guide.md`
> ```suggestion
> name: size-aware-styling
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: size-aware-adaptations
```

</details>

---

## PR #100: Use cases and file structure for blocking="render"

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (APPROVED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/consistent-cross-document-transitions/guide.md`
> I think this use-case description is correct, but I wonder if it would be better to expand on it to make it more easily discoverable by the agent (given a potentially vague user prompt).
> 
> E.g. the phrase "loaded and stable" doesn't (to me at least) fully convey that the browser has done everything it needs to do in order to visually render the page in the expected state for the cross-document view transition to appear seamless to the user.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: consistent-cross-document-transitions
+description: Ensure critical page state is loaded and stable before initiating a cross-document view transition.
```

</details>

#### **philipwalton** on `guides/user-experience/consistent-cross-document-transitions/guide.md`
> Yeah, it's a balancing act for sure. But the most important thing is that the MCP tool is able to match this guide against a user's prompt, so that's how I've been approaching the decision re: when to add more detail vs. when to be concise.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: consistent-cross-document-transitions
+description: Ensure critical page state is loaded and stable before initiating a cross-document view transition.
```

</details>

---

## PR #97: User validation guides

### Reviews

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/password-complexity-validation/guide.md`
> I wonder if it makes sense to broaden this, and not limit it to just password fields? I agree that passwords is likely the most common occurance of this, but I think we'd want this guidance to also match other form-field use cases like email, phone number, etc.
> 
> @rviscomi WDYT?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: password-complexity-validation
+description: Providing feedback on password pattern requirements only after the user has interacted with the field, preventing intimidating error states during initial entry.
```

</details>

#### **philipwalton** on `guides/user-experience/prevent-validation-styling-on-draft-save/guide.md`
> TIL about `formnovalidate`! But I still don't understand how this would work...
> 
> Something like `:has([formnovalidate]) :user-invalid {...}` would match if the form contained a draft submit button, not just if the user pressed that.
> 
> Or were you imagining something else?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: prevent-validation-styling-on-draft-save
+description: Use :user-invalid with :has() to conditionally style invalid fields, ensuring validation errors don't appear when a user opts to save a draft using formnovalidate.
```

</details>

#### **philipwalton** on `guides/user-experience/required-field-feedback/guide.md`
> ```suggestion
> description: Highlighting required fields that were skipped or left empty after user focus and blur, ensuring feedback is contextually relevant to the user's flow.
> ```
> 
> Nit: I think "required" might be more likely to match a semantic search since there's a `required` attribute in HTML.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: required-field-feedback
+description: Highlighting mandatory fields that were skipped or left empty after user focus and blur, ensuring feedback is contextually relevant to the user's flow.
```

</details>

#### **philipwalton** on `guides/user-experience/style-parent-with-has/guide.md`
> Great use case. Also a good use case for `:has()`, so we should confirm that @pattishin (who is signed up for `:has()`) is not also writing this guide.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: style-parent-with-has
+description: Declaratively style parent elements like labels or fieldsets when a child input is in the :user-invalid state, eliminating the need for JavaScript state management.
```

</details>

#### **philipwalton** on `guides/user-experience/validate-email-after-interaction/guide.md`
> Same comment as above. I think it might make sense to combine this with the password one? WDYT?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: validate-email-after-interaction
+description: Validation feedback for email inputs that only appears after the user has finished their initial interaction, avoiding premature errors on page load.
```

</details>

#### **rviscomi** on `guides/user-experience/password-complexity-validation/guide.md`
> Yeah, generalizing this to other form fields makes sense. It's hard to imagine substantive differences between the guides, but I'm interested to hear if there are any.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: password-complexity-validation
+description: Providing feedback on password pattern requirements only after the user has interacted with the field, preventing intimidating error states during initial entry.
```

</details>

#### **philipwalton** on `guides/user-experience/prevent-validation-styling-on-draft-save/guide.md`
> Have you tried that? I'm asking because I don't think it works. I think what will happen is you'll get the error message as soon as the user blurs the field, but then that error message will go away when you click the "Save draft" button — and I'm not sure that's actually a better experience.
> 
> Or are you thinking you'd always suppress errors if there's a "Save draft" button and then only show them once the "Submit" button matches `:active`?
> 
> Anyway, I guess TL;DR is it'd be good to see a demo of how you're expecting this to work.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: prevent-validation-styling-on-draft-save
+description: Use :user-invalid with :has() to conditionally style invalid fields, ensuring validation errors don't appear when a user opts to save a draft using formnovalidate.
```

</details>

#### **philipwalton** on `guides/user-experience/password-complexity-validation/guide.md`
> I think we should consolidate for now, but make sure all of the sub-use-cases are enumerated in the description. We can always add more use case guides later if we determine that the tool isn't properly matching in real world usage.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: password-complexity-validation
+description: Providing feedback on password pattern requirements only after the user has interacted with the field, preventing intimidating error states during initial entry.
```

</details>

---

## PR #95: Add `customizable-select` use cases

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
> I think all of these use cases could be generalized into a single use case where anything non-text is displayed inside of a select option. If we keep it as is with these very-specific use cases I see two potential problems:
> 
> 1. The guides for each of these end up being 99% the same
> 2. The specificity of these example could mean an AI agent might not match a prompt for a slightly different requirement (e.g. Stock ticker symbol + graph, or company name + logo).
> 
> I think the other big use case (in addition rich option rendering) is full control over select and option styling (usually to match a company's existing design system).

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (CHANGES_REQUESTED)
> Thanks @pattishin, these two use cases LGTM (with one small comment).
> 
> Can you also add the following two use cases (with demos)?
> 
> - **`branded-select-styling`**: Create custom select elements whose button, picker, arrow icon, and checkmark all seamlessly match your brand or design system's typography, colors, spacing, and border treatments.
> - **`custom-select-picker-layouts`**: Create custom select pickers whose options are positioned in unique or interesting ways, rather than the traditional stacked list of options.

#### **philipwalton** (APPROVED)
> LGTM. FYI, I updated one of the demos and fixed some of the incorrectly named files.

### Comments

#### **rviscomi** on `guides/user-experience/top-layer-picker/guide.md`
> > ❌ Error: Web feature ID "top-layer" not found in web-features package (guides/user-experience/top-layer-picker/guide.md).
> 
> ```suggestion
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+description: Build a simple modal component that renders a select picker within it.
+web-feature-ids:
+  - customizable-select
+  - top-layer
```

</details>

#### **philipwalton** on `guides/user-experience/rich-media-picker/guide.md`
> I think the "identify countries" part is still too specific. How about this?
> 
> ```suggestion
> description: Build a custom select dropdown component whose options can contain complex HTML formatting (e.g. images, icons, and other rich formatting) rather than just plain text.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: rich-media-picker
+description: Build a custom picker that opens to display essential information and media in a structured layout to make it easier to identify countries.
```

</details>

#### **philipwalton** on `guides/user-experience/rich-media-picker/demo.html`
> The `grid` styles aren't rendering properly in this demo. I think you're missing a style for `::picker(select) { }` somewhere.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+    }
+
+    /* Option Layout - Grid approach for the rich media */
+    select.rich-select option {
```

</details>

#### **philipwalton** on `guides/user-experience/top-layer-picker/demo.html`
> I don't understand what this demo is trying to show. It appears to be just a regular select inside of a modal. What am I missing?

#### **philipwalton** on `guides/user-experience/smooth-select-picker/guide.md`
> ```suggestion
> name: animated-select-pickers
> ```
> 
> Nit: but "smooth" doesn't necessarily convey "animated" to me.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: smooth-select-picker
```

</details>

---

## PR #94: Adding in scroll-initial-target use cases

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
> Thanks @pattishin for getting started on this. I left a few comments in the PR, also (FYI) I updated the issue with a new set resource links because the previous ones were not accurate.

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (APPROVED)
> LGTM with one suggestion.

### Comments

#### **philipwalton** on `guides/user-experience/scroll-to-middle-image-in-gallery/guide.md`
> I would generalize this use case so it can match more than just image galleries (while still listing that as a primary use case). I'd also rephrase to make it more active.
> 
> How about something like: "Build a scrollable carousel of images (or other visual elements) where the scroll position can be set to display any one of the elements in view on the initial render."

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: scroll-to-middle-image-in-gallery
+description: An image gallery that starts scrolled to the middle image
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-to-selected-menu-list/guide.md`
> I believe this use case was taken from [the explainer](https://github.com/DavMila/explainer-scroll-initial-target?tab=readme-ov-file#use-cases), but to be honest, I don't really understand this, do you? Perhaps it's worth checking with awogbemila@ (feature owner), but my sense is that this use case is not sufficiently different from the one you have above to justify a whole new guide. WDYT?
> 
> That said, I do think the second use case listed in the explainer (the "pull to reveal" pattern) is a good one to cover.
> 
> 

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: scroll-to-selected-menu-list
+description: A menu list that starts scrolled to the selected option based on previous user selection.
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-to-selected-menu-list/guide.md`
> Another interesting use case that Gemini deep research help me discover is a search feature in a chat or messaging application, where you want to load the conversation scrolled to a particular message, but then still make it possible for the user to scroll up or down through the full conversation.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: scroll-to-selected-menu-list
+description: A menu list that starts scrolled to the selected option based on previous user selection.
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-to-selected-menu-list/guide.md`
> No, you have to manually apply the `scroll-initial-target` property to the item you want scrolled into view. There isn't anything auto-magic that happens AFAIK.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: scroll-to-selected-menu-list
+description: A menu list that starts scrolled to the selected option based on previous user selection.
```

</details>

#### **philipwalton** on `guides/user-experience/focus-chat-message/guide.md`
> I would update this to make sure it's super clear that this use case involves having the message container *scrolled* to the message in question, rather than just visually displaying it to the user in some other way.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: chat-message-search
+description: Build a chat message feature that would enable the user to land on a specific message in the conversation on initial render.
```

</details>

#### **philipwalton** on `guides/user-experience/focus-chat-message/guide.md`
> ```suggestion
> description: Build a chat message feature that can display a conversation automatically scrolled to a specific message (e.g. matching a search query) on initial render.
> ```

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: chat-message-search
+description: Build a chat messagefeature that automatically scrolls to a specific message on initial render.
```

</details>

---

## PR #93: Add in page-visibility-state use cases

### Reviews

#### **philipwalton** (COMMENTED)
> @pattishin I think these use cases are covering the `visibilitychange` event, which is different from the `page-visibility-state` feature. And looking at issue (#69) it seems like the resources listed there are about `visibilitychange` as well, so I'll fix that. The only public doc I can find that refers to this feature is the MDN docs for [VisibilityStateEntry](https://developer.mozilla.org/en-US/docs/Web/API/VisibilityStateEntry).
> 
> TBH, given that this API is not very well documented, it might make sense for either me or @tunetheweb to write the use cases for it, given we have the historical context that I'm not sure is well-captured in any public docs.

---

## PR #88: Add guides for the fetchlater use cases

### Reviews

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/performance/batch-analytics-events/expectations.md`
> @paulirish @micahjo7 can you comment on whether these expectations are comprehensive enough? E.g. do we need an expectation that the API is called with the correct arguments for the use case?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,9 @@
+# Expectations: `batch-analytics-events`
```

</details>

#### **philipwalton** on `guides/performance/full-session-analytics/expectations.md`
> @paulirish @micahjo7 same question here...

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,7 @@
+# Expectations: `full-session-analytics`
```

</details>

#### **rviscomi** on `guides/performance/batch-analytics-events/expectations.md`
> I'd be curious to see if this expectation is specific enough to auto-generate the corresponding eval

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
+- The `fetchLater()` API is the only API that should be used to send beacons. Other APIs like `fetch()`, `sendBeacon()`, `XMLHttpRequest`, or `new Image()` should not used.
+- `fetchLater()` should be invoked with the `activeAfter` option set.
+- Multiple invocations of `fetchLater()` withing the `activateAfter` time window should be batched into a single request (e.g. prior calls should be aborted).
+- Batching should be limited in some way to prevent starvation or quota overflow.
```

</details>

#### **rviscomi** on `guides/performance/full-session-analytics/expectations.md`
> If the second arg is optional and doesn't affect the eval, is it worth mentioning?

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,7 @@
+# Expectations: `full-session-analytics`
+
+- The `fetchLater()` API is invoked with a URL string as the first argument, and (optionally) a `DeferredRequestInit` object as the second argument.
```

</details>

#### **philipwalton** on `guides/performance/full-session-analytics/expectations.md`
> I'm not sure. This gets back to the discussion about whether or not the tools need access to reference docs.
> 
> It's possible that someone wanting to implement this use case will need to specify custom fetch params (e.g. custom headers or a specific request method), but that's not relevant to the use case.
> 
> So maybe that means we need to add another use case that covers custom fetch param? That use case wouldn't be specific to the `fetchLater()` use cases, though it would be relevant since there is a lot of API overlap.

<details>
<summary>Diff Hunk (Truncated)</summary>

```diff
@@ -0,0 +1,7 @@
+# Expectations: `full-session-analytics`
+
+- The `fetchLater()` API is invoked with a URL string as the first argument, and (optionally) a `DeferredRequestInit` object as the second argument.
```

</details>

---

