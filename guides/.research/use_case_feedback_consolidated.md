# Consolidated Use Case Feedback

This document consolidates findings from pull requests investigated by subagents to extract insights about use case generation based on reviewer feedback.

---

## Agent 0 Findings (PRs 580, 560, 360, 170, 150, 201, 151, 111)

## PR #580: feat: create guide and evals for prevent-incorrect-theme-flash
- **Context**: Proposed a use case, guide, and evals for `prevent-incorrect-theme-flash` using `color-scheme` and a `localStorage` override.
- **Feedback**: The proposed use case had significant overlap with an existing use case (`browser-ui-color-theme`).
- **Resolution**: The PR was closed and the use case was deleted. The unique aspects (localStorage override) will be merged into the existing use case instead.
- **Takeaways**: Check for existing use cases to avoid overlap. If a new use case is too similar to an existing one, incorporate the new nuances into the existing use case instead of creating a duplicate.

## PR #560: #235 keep-preceding-text-static-when-editing
- **Context**: Proposed a use case for keeping preceding text static when editing, using `text-wrap: stable`.
- **Feedback**: Reviewers questioned if this was a real-world problem, noting that user agents usually handle this natively and the scenario is extremely niche.
- **Resolution**: The PR was closed and the use case was deleted.
- **Takeaways**: Ensure use cases solve tangible, real-world developer problems. Avoid creating use cases for behaviors that browsers already handle well by default or that are extremely niche.

## PR #360: Automate use case research
- **Context**: Explored automating use case research via a custom CLI tool.
- **Feedback**: Reviewers preferred utilizing local coding agents and discipline-level skills (paired with deep research models) over a purely CLI-based approach.
- **Resolution**: The PR was closed in favor of another PR that structures the generation logic as an agent skill.
- **Takeaways**: Use case generation should leverage structured agent skills and AI capabilities rather than manual CLI tools.

## PR #170: Use cases: sibling-count() and sibling-index()
- **Context**: Proposed use cases for `sibling-count()` and `sibling-index()`.
- **Feedback**: Reviewers pointed out that the descriptions included the solution itself, the slugs started with action verbs ("create", "build") which makes scanning difficult, and one of the use cases was actually better solved with flexbox/grid. Obscure terms ("boustrophedon") were noted but deemed acceptable if they describe a core use case.
- **Resolution**: The use case better solved by flexbox was deleted. Slugs were stripped of verb prefixes, and descriptions were rewritten to exclude the solution.
- **Takeaways**: 
  - Do not include the proposed solution (feature name) in the use case description.
  - Omit action verbs like "create" or "build" from slugs to improve list scannability.
  - Verify that the target feature is genuinely the best tool for the proposed use case.
  - It is acceptable to use obscure or highly technical terms if they accurately define a core use case (the AI will understand them). Keep descriptions concise.

## PR #150: GH action and script to manage issues for use cases
- **Context**: Introduced a GitHub Action script to automatically create and manage issues for use cases based on frontmatter.
- **Feedback**: General approval of the operational script with minor stylistic suggestions.
- **Resolution**: Merged to establish an automated pipeline for use case issue management.
- **Takeaways**: Use case frontmatter must be strictly valid, as it is parsed and validated by GitHub Actions in a dry-run mode during PRs to manage issue tracking.

## PR #201: Remove deep-link-to-hidden-content use case
- **Context**: A use case `deep-link-to-hidden-content` was proposed.
- **Feedback**: The phrasing incorrectly focused on the user action (adding fragments to URLs) rather than the developer task (structuring page content to support deep-linking). Additionally, it overlapped nearly entirely with another accessibility-focused use case.
- **Resolution**: The PR merged the removal of this use case, opting to combine its concepts into the overlapping guide.
- **Takeaways**: 
  - Phrase use case descriptions to focus on the developer's structural implementation, rather than the end user's action.
  - Combine overlapping use cases if they would result in nearly identical guides.

## PR #151: Add guide: `<dialog closedby>`
- **Context**: Proposed use cases for `<dialog closedby>`.
- **Feedback**: Reviewers requested the removal of articles (like "a") from the slug and asked for the description to explicitly list standard platform behaviors.
- **Resolution**: The slug was shortened (e.g., `light-dismiss-a-dialog` to `light-dismiss-dialog`), and the description was expanded to clarify the specific platform interactions involved (e.g., "Esc key", "dismiss gesture").
- **Takeaways**: 
  - Keep slugs concise and omit unnecessary words like articles.
  - Make descriptions explicit about the platform-specific interactions and user behaviors being enabled.

## PR #111: Use cases: `light-dark()`
- **Context**: Proposed use cases and demos for the `light-dark()` function.
- **Feedback**: Descriptions inappropriately mentioned the `light-dark()` solution. Required dependent features (`color-scheme`) were missing. Reviewers debated semantic HTML in the demos, but it was clarified that demos are just to illustrate the use case for the AI, not for production use.
- **Resolution**: The solution was removed from descriptions, `color-scheme` was added to the feature requirements, and minor adjustments were made to ensure valid YAML parsing.
- **Takeaways**: 
  - Never mention the specific API/feature solution in the use case description.
  - Explicitly include all requisite dependent features (e.g., `color-scheme` for `light-dark`) in the feature list.
  - Use quotation marks or multiline syntax (`>-`) for YAML descriptions to avoid parsing errors.
  - Demos used for use case generation only need to accurately prove the feature; strict adherence to unrelated semantic HTML is unnecessary if it distracts from demonstrating the core capability.

---

## Agent 1 Findings (PRs 312, 202, 152, 102, 603, 423, 373, 213, 153, 93)

## PR #312: Refactor sync-use-cases and harden the requirements
- **Context**: Refactoring the internal sync-use-cases script to improve error handling and logic (DRY_RUN, tests, etc.).
- **Feedback**: CI checks fail if partial evaluation files exist without their counterparts. Reviewers suggested renaming work-in-progress prompts to avoid validation errors.
- **Resolution**: Merged the enforcement. Contributors must use `_prompts.md` for WIP use cases lacking a grader.
- **Takeaways**: When generating evals, always create both `grader.ts` and `prompts.md`. If creating prompts without a complete grader, name it `_prompts.md` to prevent sync validation errors. Include demo placeholders if demos are missing.

## PR #202: Fetch priority guides, expectations, prompts
- **Context**: Adding priority guides for web performance use cases.
- **Feedback**: Reviewers requested explicit limits and better precision around web performance terminology and Baseline availability.
- **Resolution**: Applied suggestions for explicit limits and updated "not Baseline" comments to "not Baseline widely available".
- **Takeaways**: Web performance use cases must be highly nuanced. Include explicit limits when discussing performance metrics, and use precise Baseline availability terminology (e.g., "not Baseline widely available").

## PR #152: Use case for accent-color
- **Context**: Adding a use case for the `accent-color` CSS property.
- **Feedback**: The reviewer (Philip Walton) noted they had to reword the use case slightly and explicitly add a demo.
- **Resolution**: Merged after the SME rewrote the use case and added the missing demo.
- **Takeaways**: Use cases should always be concise, properly worded, and include a functioning demo.

## PR #102: Move before usecases
- **Context**: Adding use cases for the `moveBefore` API. The author debated creating separate use cases for each type of element state preserved (iframe, animation, etc.).
- **Feedback**: Philip Walton suggested combining them: "Move or reparent a DOM element without losing important element state, such as interactivity states... iframe loading state, animation...". He noted that highly specific use cases (like VDOM diffing) are too narrow for average developers.
- **Resolution**: Consolidated all sub-use-cases into a single comprehensive use case.
- **Takeaways**: Consolidate similar use cases into a single use case if the guidance is largely the same. List specific examples of states/scenarios within the single description so AI tools can still match them. Avoid creating highly specialized use cases that apply only to a narrow audience (like framework authors).

## PR #603: Add guide and evals for context-sensitive sticky headers
- **Context**: Adding a new guide and evals for sticky headers.
- **Feedback**: A local `gd eval` run showed a 0% pass rate for guided runs. The reviewer suggested the evals needed further investigation and fine-tuning.
- **Resolution**: The eval files were removed from the PR to unblock the guidance, with a note to follow up on evals separately.
- **Takeaways**: Evals must be thoroughly tested with `gd eval`. If the guided pass rate is 0%, the prompt or grader needs adjustment. Unstable evals can be temporarily removed to unblock PR merges.

## PR #423: #363 dynamic-sibling-animations
- **Context**: Adding dynamic sibling animations. The author asked about testing expectations.
- **Feedback**: A local `gd eval` run yielded equal unguided and guided pass rates (17%). Reviewer noted: "Seems like maybe the agent never thought to query the CLI, so the prompt might need to be adjusted."
- **Resolution**: Merged the guide as-is with a plan to fine-tune the evals later.
- **Takeaways**: Pay attention to whether the task prompt naturally leads the agent to search for the right API or query the CLI. If guided metrics show no improvement over unguided, adjust the prompt to better trigger tool usage.

## PR #373: Add loaf use cases and demos
- **Context**: Adding Long Animation Frames (LoAF) use cases and demos.
- **Feedback**: Reviewers debated keeping multiple similar use cases (e.g., INP vs long frames). Philip Walton noted: "I lean toward only having a single use case... Otherwise you end up with a lot of overlapping content, and we're already seeing issues where the agent is matching with the wrong use cases because of use-case similarity."
- **Resolution**: Merged four similar use cases into two distinct ones (`identify-inp-causes` and `identify-heaviest-script`).
- **Takeaways**: Avoid creating multiple use cases with overlapping intent, as it causes AI agents to match incorrectly. Combine related scenarios into a single, distinct use case. Use concise, action-oriented naming conventions.

## PR #213: Use cases: interpolate-size
- **Context**: Adding a use case for `interpolate-size`.
- **Feedback**: Philip Walton identified overlap with `calc-size()`. He advised that since `interpolate-size` should be the primary recommendation, they should be combined into one guide, with `calc-size()` only recommended for specific calculation scenarios.
- **Resolution**: `calc-size` was added to the web features list for the `interpolate-size` use case, and the separate `calc-size` PR was abandoned.
- **Takeaways**: When two web features solve fundamentally the same problem, combine them into a single use case. Feature the simpler/more common solution as the primary recommendation, introducing the secondary feature only for advanced scenarios.

## PR #153: Add use cases related to view transition
- **Context**: Adding use cases for the View Transition API.
- **Feedback**: The author iterated on the granularity, removing a basic "same-document-transitions" use case and structuring them by navigation intent. Philip Walton approved the final set after tweaking the wording.
- **Resolution**: Settled on distinct use cases defined by specific navigational goals (cross-document, shared elements, directional).
- **Takeaways**: Granularity matters for broad APIs. Define use cases by distinct developer goals or user experiences rather than just listing API capabilities.

## PR #93: Add in page-visibility-state use cases
- **Context**: Adding use cases for the `page-visibility-state` feature.
- **Feedback**: Reviewers noticed the use cases were actually addressing the old `visibilitychange` event instead of the new `page-visibility-state` API. They recommended that SMEs with historical context handle poorly documented APIs.
- **Resolution**: The PR was closed.
- **Takeaways**: Ensure use cases accurately target the specific web platform API requested, rather than related legacy events. When an API is poorly documented, rely on historical context and SMEs to capture the precise intent.

---

## Agent 2 Findings (PRs 344, 304, 224, 154, 134, 94, 525, 355, 295, 215, 115, 95)

## PR 344: Flatten autofill use cases
- **Context**: Structural flattening of autofill use cases without modifying file contents.
- **Feedback**: Approved since there were no content changes.
- **Resolution**: Merged as-is.
- **Takeaways**: No specific rule for use case generation; mostly project structure maintenance.

## PR 304: Adds the guide for top-level await for fetching async dependencies.
- **Context**: Added a guide for fetching async dependencies using top-level `await`.
- **Feedback**: Reviewers noted a conflict between standard fallback strategies (which tell agents to avoid top-level `await` entirely due to Safari bugs) and demonstrating the modern API. If agents strictly follow the fallback, they won't use the feature being taught.
- **Resolution**: Adjusted the guidance to clarify the Safari bug workaround, so agents are permitted to use top-level `await` while avoiding the bug, rather than abandoning the feature.
- **Takeaways**: Handle fallback conflicts carefully. If demonstrating a modern API requires a workaround for specific browsers, teach the workaround explicitly rather than recommending a fallback that prevents the API's use.

## PR 224: Use cases for `starting-style` and `transition-behavior`
- **Context**: Adding use cases for new CSS transition features.
- **Feedback**: Reviewers noted that `starting-style` and `transition-behavior` are highly related and frequently used together. Overlap with related APIs (popovers, dialogs) was also pointed out.
- **Resolution**: Updated to include both APIs and cross-reference related popover/dialog use cases.
- **Takeaways**: Combine related APIs. If multiple features are intrinsically linked or commonly used together, consolidate them into a cohesive use case.

## PR 154: Use cases for contain-intrinsic-size and contain-inline-size
- **Context**: Adding use cases for CSS containment properties.
- **Feedback**: Reviewers requested adding a small demo for each use case, noting that demos help with the review process and illustrate the concept clearly.
- **Resolution**: Demos were generated and added to each use case.
- **Takeaways**: Always include a small, concise demo (e.g., `demo.html`) for each use case.

## PR 134: Add guide: `autofill-background-color`
- **Context**: Proposed a specific use case for styling the background color of an autofilled input.
- **Feedback**: Reviewers pointed out that a separate PR already covered styling the border of autofilled inputs. Splitting these into two separate use cases would bloat the context window when an AI agent is prompted generally to "style an autofilled input".
- **Resolution**: The PR was closed, and the content was consolidated into a single broader use case covering general `:autofill` styling.
- **Takeaways**: Consolidate granular styling tasks. Group related style modifications into a single overarching use case to avoid context bloat.

## PR 94: Adding in scroll-initial-target use cases
- **Context**: Adding use cases for `scroll-initial-target`.
- **Feedback**: Requested an update to align with the newly formalized guidance structure and to fix inaccurate resource links.
- **Resolution**: Use case was refactored to match the new structure and updated with correct resources.
- **Takeaways**: Ensure use cases adhere to the formalized project structure and provide accurate, up-to-date resource links.

## PR 525: Passkey skill
- **Context**: Attempted to flatten draft passkey skill guides into a single `SKILL.md` file.
- **Feedback**: Reviewers were concerned that merging everything into a single file would drop important technical nuance and degrade agent performance. It was suggested that large features be broken down into individual use cases (e.g., "Register a new passkey", "Authenticate a user").
- **Resolution**: PR was closed. The plan pivoted to extracting specific, smaller use cases.
- **Takeaways**: Break down complex features. Do not cram multi-step, intricate features into a single generic guide; split them into logical, detailed use cases.

## PR 355: Fix evals for search-hidden-content use case
- **Context**: Modifying an existing use case because there was no measurable difference between guided and unguided results during evaluation.
- **Feedback**: Needed clearer expectations and consolidated prompts to ensure tests verified both `<details>` and `hidden="until-found"` behaviors.
- **Resolution**: Expectations were clarified (though the PR was superseded).
- **Takeaways**: Write comprehensive expectations. Ensure the use case covers enough specific behavior (and multiple states, if applicable) so that evaluations can definitively measure the impact of the guidance.

## PR 295: Project-level agent skills to assist contributors
- **Context**: Introducing new `.agents/skills` files to assist contributors with creating use cases, writing guidance, and generating evals.
- **Feedback**: General code review and CLA checks.
- **Resolution**: Merged.
- **Takeaways**: Contributors should actively use the newly provided project-level skills (`project-use-cases` and `project-use-cases-research`) when authoring use cases.

## PR 215: Adding popover="hint" use cases
- **Context**: Proposed specific use cases for `popover="hint"`.
- **Feedback**: Noted that these use cases would already be covered by a broader, existing PR for the Popover API.
- **Resolution**: PR was closed to prevent duplicate work.
- **Takeaways**: Check for overlapping in-flight work. Avoid creating standalone use cases if they fall under the umbrella of a broader feature PR.

## PR 115: Use cases for color-scheme
- **Context**: Added use cases for `color-scheme` and `accent-color`.
- **Feedback**: Reviewers requested checking for overlap with other PRs and added demos to the use cases, slightly tweaking wording.
- **Resolution**: Merged after updates.
- **Takeaways**: Demos are essential. Consistently include demos and ensure use case wording is precise.

## PR 95: Add `customizable-select` use cases
- **Context**: Proposed highly specific use cases (e.g., `rich-media-picker`, `animated-select-picker`).
- **Feedback**: Reviewers cautioned that highly specific use cases lead to nearly identical guides. Furthermore, extreme specificity (e.g., a country picker) might prevent an AI agent from matching the guide to a slightly different prompt (e.g., a stock ticker).
- **Resolution**: The specific use cases were generalized into broader categories (e.g., "branded select styling", "custom select picker layouts").
- **Takeaways**: Generalize use cases. Avoid over-specific scenarios. Broaden the use case scope (e.g., "rich option rendering" instead of "country picker") so AI agents can match a wider variety of user prompts without redundant guides.

---

## Agent 3 Findings (PRs 106, 647, 527, 507, 467, 357, 307, 217, 197, 187, 157, 97)

## PR #106: Use cases for text-wrap values: nowrap, balance, pretty, and stable.
- **Context**: Proposed use cases for `text-wrap` values, specifically `nowrap`, `balance`, `pretty`, and `stable`.
- **Feedback**: Reviewers (Philip Walton) noted it's perfectly fine for related features (like `balance` and `pretty`) to have overlapping use cases and share a guide with multiple `web-feature-ids`. Also suggested not to treat `text-wrap` purely as a parent but to include use cases where base features (e.g., `text-wrap: nowrap`) are distinctly better than legacy alternatives (`white-space: nowrap`).
- **Resolution**: Merged as is, keeping use cases concise and keeping base feature use cases if they hold meaningful advantages.
- **Takeaways**: When related features have overlapping scenarios, specify multiple `web-feature-ids` and address them in a single use case. Include use cases for base features if they solve problems differently from legacy properties. Keep descriptions concise.

## PR #647: #252 position-aware-tooltips
- **Context**: Proposed a use case for position-aware tooltips using anchor positioning.
- **Feedback**: Reviewers requested adjustments to scope and realism (specifically concerning fallback scenarios).
- **Resolution**: Tweaked the guide to reflect a more realistic fallback scenario, avoiding assumptions about nonexistent browser versions where popover might not be supported but anchor positioning is.
- **Takeaways**: Ensure use cases and their demos use realistic fallback scenarios and accurately reflect real-world browser support states.

## PR #527: Guide and evals for manage-recurring-intervals use case for temporal
- **Context**: Proposed use case and eval files for `manage-recurring-intervals` using the Temporal API.
- **Feedback**: Reviewer (Malchata) suggested that code comments should focus on the "why" rather than the "what", and to place directives within them. Also, the use case was initially undiscoverable by the eval harness due to a missing build step.
- **Resolution**: Addressed comments and fixed evals.
- **Takeaways**: When generating scaffolding and code for use cases, write code comments that explain the "why" and include embedded directives to properly guide model execution.

## PR #507: separate guide usage metrics
- **Context**: Focused on splitting out guide usage metrics and improving reporting for the eval harness.
- **Feedback**: PR was approved. A bug report emerged later about ES Module paths for the playwright config.
- **Resolution**: Merged. Follow-up fixes for ESM compatibility.
- **Takeaways**: No direct takeaways for use-case generation (infra PR).

## PR #467: 364 Create guide and evals for the dynamic sibling styling use case
- **Context**: Proposed use case for dynamic sibling styling. The author asked if it should be split into multiple use cases.
- **Feedback**: Reviewer (Rick Viscomi) agreed it fits better as a single use case.
- **Resolution**: Kept as a single use case and fine-tuned evaluations to pass perfectly.
- **Takeaways**: Combine related variations into a single use case rather than splitting them up to avoid redundant, fragmented guides.

## PR #357: Create guidance for the blocker=render use cases
- **Context**: Added use cases and guidance for `blocker=render` scenarios.
- **Feedback**: Linter errors pointed out missing files: "Must have BOTH grader.ts and prompts.md."
- **Resolution**: Added the missing eval files for each use case.
- **Takeaways**: When generating the complete scaffold for a use case, ensure all necessary evaluation files (`grader.ts`, `prompts.md`, etc.) are included to pass CI validation.

## PR #307: Add guide content and expectations for reduce-style-repetition
- **Context**: First commit used the project-guides SKILL to generate guides for a use case.
- **Feedback**: Reviewer (Micahjo7) noticed the generated changes had a similar but not identical format to checked-in guides.
- **Resolution**: PR closed to revisit later.
- **Takeaways**: Ensure the generated use case stubs and files strictly adhere to the project's formatting conventions to maintain consistency across the repository.

## PR #217: Add Scroll-Driven Animations Use-Cases and Demos
- **Context**: Proposed multiple use cases for Scroll-Driven Animations.
- **Feedback**: Reviewers (Philip Walton, Bramus) suggested rewording use cases to be more active. They also discussed dropping overly specific use cases (like "Backdrop fade with UI sheet dismiss") because the actual feature code would be overshadowed by unrelated setup (the swipeable sheet).
- **Resolution**: Reworded descriptions to start with verbs. Generalized specific scenarios into broader patterns (e.g., "animate one element when a different element crosses the scrollport").
- **Takeaways**: Always use verb-first, active descriptions. Avoid overly specific, contrived use cases where the target feature represents only a tiny portion of the implementation code; generalize them into broader functional patterns.

## PR #197: Add invoker-command API use cases
- **Context**: Added 3 general use cases for the Invoker Commands API.
- **Feedback**: Reviewer (Philip Walton) requested demos for the use cases to ensure they were understood properly before commenting.
- **Resolution**: Tweaked the use cases and added demos.
- **Takeaways**: Always include a small `demo.html` for each use case. Demos help validate that the use case maps accurately to a real-world task and clarifies the intended outcome.

## PR #187: Use cases for calc-size
- **Context**: Proposed 3 use cases for the `calc-size` feature.
- **Feedback**: Changes requested.
- **Resolution**: PR was closed without merging.
- **Takeaways**: Ensure use cases align directly with the primary problems the feature solves. Provide clear visual evidence (demos) of what the use case achieves.

## PR #157: Use cases for Temporal API
- **Context**: Proposed use cases for the Temporal API.
- **Feedback**: Reviewers (Tara Ojo, Malchata) requested demos for each use case to help visualize them and potentially combine overlapping ones. They also strongly advised against mentioning specific API methods and properties in the use case descriptions.
- **Resolution**: Added demos and rewrote the descriptions to be more general and focused on the problem, removing specific API mentions.
- **Takeaways**: Focus strictly on the WHAT-not-HOW. Do not mention specific API methods, properties, or implementation details in the use case description. Frame it purely around the user problem. Include demos to help visualize and deduplicate.

## PR #97: User validation guides
- **Context**: Proposed guides for user-pseudos (`:user-invalid`, etc.).
- **Feedback**: The author noted that after testing, some use cases (like `prevent-validation-styling-on-draft-save` and `web-component-validation`) had to be deleted because they didn't work in practice due to browser behavior constraints and spec issues.
- **Resolution**: Deleted the non-viable use cases.
- **Takeaways**: Thoroughly test the technical feasibility of proposed use cases. If a use case relies on browser behaviors that are broken, inconsistent, or blocked by spec limitations, discard it rather than documenting a theoretical solution.

---

## Agent 4 Findings (PRs 498, 408, 298, 198, 138, 108, 88, 429, 269, 199)

## PR 498: Guide and evals for `format-human-readable-durations` use case for temporal
- **Context**: Added guides and evals for formatting human readable durations using the Temporal API.
- **Feedback**: Reviewer suggested that manually handling pluralization is brittle and `Intl.DurationFormat` is a better fit. Reviewer also asked whether imperative language (`**DO**`, `**DO NOT**`, `**MANDATORY**`) should be used for expectations. Requested clarifying the fallback strategy for `Intl.DurationFormat`. Noted a "total nit" that Gemini expects exact heading names like `## Fallback strategies`.
- **Resolution**: Clarified fallback strategy and integrated `Intl.DurationFormat`. Used the exact heading format requested.
- **Takeaways**: Use appropriate modern APIs (like `Intl.DurationFormat`) rather than brittle manual solutions, even when authoring a use case focused on a related API (like Temporal). Ensure standard headings (e.g., `## Fallback strategies`) are used exactly, as AI tooling depends on them. Expectations should use clear imperative language. Ensure `web-feature-ids` and `sources` accurately reflect all APIs used in the guide.

## PR 408: Autofill review
- **Context**: Reviewed multiple autofill-related use cases (address, highlight inputs, payment, sign in, sign up).
- **Feedback**: Reviewer asked about the removal of an expectation (e.g., `inputmode="numeric"` for number inputs), and if they were redundant or out of scope. Another reviewer noted the initial pass was too aggressive and audited requirements mentioned in the guide that should be added to expectations. Specifically, `inputmode=numeric` shouldn't be a strict requirement for all address forms (since postal codes aren't always numeric), but should remain in the payment use case.
- **Resolution**: Merged as-is with a plan to expand expectations later if coding agents do not follow the guides.
- **Takeaways**: Use case expectations must accurately reflect guide requirements. Avoid overly strict global expectations if they only apply to a subset of related use cases (e.g., payment vs address forms).

## PR 298: use cases: overflow: clip
- **Context**: Added use cases for `overflow: clip` and `overflow-clip-margins`.
- **Feedback**: The reviewer originally thought `overflow: clip` was just a feature best suited for a skill file (e.g., "use `overflow: clip` instead of `overflow: hidden`"). However, a use case incorporating `overflow-clip-margins` was deemed a good fit. The reviewer ultimately updated the PR to a more technical use case focused on fine-grained control over which box is chosen to contain the overflow.
- **Resolution**: Changed the focus to fine-grained control over overflow containment.
- **Takeaways**: Features that act as simple 1-to-1 replacements belong in a skill file, not a standalone use case guide. Use case guides should highlight compelling, distinct problems that the feature uniquely solves (like fine-grained control over the containing box).

## PR 199: Add guides for `scroll-initial-target` use cases
- **Context**: Added `scroll-initial-target` use cases (focus chat message, focus item in carousel, pull to reveal, scroll target on load).
- **Feedback**: Reviewer noted that `focus-chat-message` and `focus-item-in-carousel` were 99% identical and suggested combining them into a single "scrollable list view component" use case that demonstrates both horizontal (with snapping) and vertical (without snapping) examples. `scroll-snap` was incorrectly marked as mandatory; reviewer stressed it should be optional. Expectations were critiqued for just being true statements about the API rather than testable criteria ("something we could write a test for"). Fallback recommendations using the `load` event were discouraged due to visual flashes. Pointed out incorrect terminology (parent/child vs. ancestor/descendant).
- **Resolution**: Combined duplicate use cases, fixed grammar/terms, restricted `scroll-snap` to where it made sense (`pull-to-reveal`), and tightened expectations.
- **Takeaways**: Combine highly similar use cases into a single generalized guide containing multiple examples. Expectations must be verifiable and testable criteria, not just factual statements about an API. Provide precise API guidance (e.g., clarify what is optional vs mandatory). Use accurate DOM terminology (ancestor/descendant). Recommend fallback strategies that avoid UX issues like layout flashes (e.g., prefer `DOMContentLoaded` or inline scripts over `load`).

## PR 198: Add use cases for the interest-invokers API
- **Context**: Use cases for the interest-invokers API, such as hovercards and hint popovers.
- **Feedback**: Reviewer asked if these overlap with existing popover use cases (#138). While the author argued hover cards are more complex and involve different interactions, the reviewer clarified that guides should focus on implementing use cases, not documenting features. Thus, covering every different effect of a feature is unnecessary if the UX overlaps. Secondary interactions like long-press for mobile shouldn't spawn a new guide if they are just recommendations for hovercards.
- **Resolution**: PR closed in favor of covering the tooltip/hovercard use cases within the broader popover PR.
- **Takeaways**: Guides should be use-case driven, not feature-driven. Do not create separate guides to document different aspects or APIs if the underlying user experience (like tooltips or hovercards) overlaps significantly. Secondary features or best practices (like long press on mobile) should be integrated as recommendations into the main use case guide rather than getting their own guide.

## PR 138: Popover
- **Context**: Implementation of several popover use cases.
- **Feedback**: PR had overlapping use cases with newer merged ones. Reviewer discarded `create-contextual-tooltips` as redundant with `interest-triggered-tooltips`. Renamed `create-toast-notifications` to `persistent-toast-notifications`, mapped layered menus to `light-dismiss-content-overlay`, and renamed `create-persistent-app-tours` to `persistent-app-tours` to match conventions.
- **Resolution**: Dropped the `create-` prefix to match conventions. Deduped redundant use cases and mapped them to their correct descriptive user experience names.
- **Takeaways**: Use case titles should describe the user experience (e.g., `persistent-app-tours`, `light-dismiss-content-overlay`) and avoid verb prefixes like `create-` or `build-` to match repository conventions. Ensure distinct use cases do not redundantly solve the same UX pattern.

## PR 108: Add new use cases, guides and demos for scrollbar customization, animation and preference adaptation.
- **Context**: Custom scrollbars use cases.
- **Feedback**: Reviewer suggested merging "customize scrollbar color" and "customize scrollbar thickness" into a single guide. Otherwise, users asking for both would get two guides returned by MCP, which is unnecessary. Asked for Baseline-aware fallback wording (e.g. "If your Baseline target is older than Baseline 2025...") instead of just "legacy versions". Noted that if best practices aren't discovered well, they might belong in a top-level skill file. Reminded author to include all key features (like `prefers-contrast` and `color-scheme`) in the `web-feature-ids`.
- **Resolution**: Combined color and thickness into one use case. Used conditional wording for fallbacks based on the user's Baseline target.
- **Takeaways**: Combine highly related use cases (e.g., customizing color and thickness of an element) into a single guide to prevent the MCP server from spamming multiple guides for a single prompt. Specify fallback behaviors explicitly in terms of the user's Baseline target (e.g., "If needed to support the user's Baseline target..."). Ensure `web-feature-ids` lists all key features used, including media queries.

## PR 88: Add guides for the fetchlater use cases
- **Context**: Guides for `batch-analytics-events` and `full-session-analytics` using `fetchLater`.
- **Feedback**: Reviewer questioned whether expectations were specific enough to auto-generate the corresponding eval (e.g., whether to test if the API is called with the correct arguments). Discussed whether optional arguments should be mentioned if they don't affect evals, and whether another use case is needed for custom fetch params.
- **Resolution**: Merged for now, with plans to refine expectations later.
- **Takeaways**: Expectations should be specific enough to auto-generate evals (e.g., verifying correct API arguments). Keep use case scopes focused; if custom parameters are complex but not essential to the core use case, avoid complicating the specific use case guide.

## PR 429: Use case research skill
- **Context**: Added skills and scripts for researching use cases.
- **Feedback**: Closed in favor of another PR (#486) which was branched directly off of main.
- **Resolution**: Closed.
- **Takeaways**: Branch management and ensuring PRs are created off the correct base branch (`main`) is important to avoid integration issues.

## PR 269: Add Guides for Scroll-Driven Animations Use-Cases
- **Context**: Added guides for scrollytelling, scroll progress, parallax, etc., using Scroll-Driven Animations.
- **Feedback**: Author noted having to repeat general guidance across guides. Reviewer said it's fine for guides to be independent but suggested tailoring best practices to the specific use case. Author felt `scrollytelling` should use scroll-triggered animations (STA) instead, but reviewer pointed out that existing guides (like tooltips) combine multiple APIs to achieve a use case, and it's fine if the fallback recommendation is complex or to avoid it. Reviewer strongly encouraged recommending native APIs for their performance benefits, even if they aren't fully Baseline Widely Available yet.
- **Resolution**: Left scrollytelling as is for now, tailoring the repetition.
- **Takeaways**: Guides should remain independent, even if it means duplicating general guidance, but general guidance should be tailored to fit the specific use case. A single use case guide can and should cover multiple APIs if they are used together to achieve the desired user experience. Strongly advocate for modern, performant web APIs (like native Scroll-Driven Animations) even if they aren't fully Baseline yet, while still providing less performant fallbacks (like IntersectionObserver). Keep guides concise and omit explanations that an AI can infer on its own.
