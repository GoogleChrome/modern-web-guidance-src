---
name: project-evals
description: Best practices for generating, calibrating, and reviewing target evaluation capsules (`grader.ts`, `task.md`, and solution patches). Use this skill any time you're working on Stage 3 evaluation files.
---

# Stage 3: Evaluating guidance for a use case (Needs evals)

This is the third of three stages in creating guidance:

1. Stage 1: Identifying use cases for a feature
2. Stage 2: Authoring guidance for a use case
3. Stage 3: Evaluating guidance for a use case (you are here)

## What the eval agent sees vs real-world agents

**Real-world coding agents see only `guide.md`** — retrieved automatically via the RAG skills system when a developer asks for help. Every other file in a use case directory is eval infrastructure.

**The eval harness** runs a separate coding agent in a controlled environment to test whether the guidance works. This eval agent receives the first prompt from `targets/<base_app>/task.md` and has access to `guide.md` via the same RAG system. The harness then runs `targets/<base_app>/grader.ts` against the eval agent's output.

None of the following are ever seen by real-world coding agents:

| File | Role in eval pipeline |
|---|---|
| `targets/<base_app>/task.md` | Simulated developer prompts and base application name fed to the eval agent by the harness |
| `demo.html` | Standalone reference implementation of the use case |
| `expectations.md` | Spec used to generate and calibrate target graders (`targets/<base_app>/grader.ts`) |
| `targets/<base_app>/patches/*-solution.patch` | Golden solution diffs against the base app (must pass 100% of grader checks) |
| `targets/<base_app>/patches/zero-passrate.patch` | Baseline diff without guidance (must fail 100% of grader checks) |
| `targets/<base_app>/grader.ts` | Playwright tests run against the eval agent's output |

## How the eval files work together

`targets/<base_app>/task.md`, `expectations.md`, and `targets/<base_app>/grader.ts` form a tightly coupled pipeline:
1. **`targets/<base_app>/task.md`** — Simulated developer prompts used only by the eval harness. It must start with a YAML frontmatter specifying the `base_app`, followed by a list of prompts. Each prompt should sound like a real developer request, without naming specific APIs or best practices — the eval agent is expected to discover those by reading `guide.md` via RAG. The first prompt is the most important: it is used as the default task.

2. **`expectations.md`** — The ground truth for what a correct implementation looks like (authored in Stage 2 alongside `guide.md` and `demo.html`; see [project-guides/SKILL.md](../project-guides/SKILL.md) for `expectations.md` authoring and review rules). Each bullet becomes one test in `targets/<base_app>/grader.ts`.

3. **`targets/<base_app>/grader.ts`** — A Playwright test file generated from `expectations.md` and calibrated against `patches/*-solution.patch` (100% pass) and `patches/zero-passrate.patch` (0% pass). Every bullet maps to a `test()` block (verified by `validateGraderExpectationCoverage()`).

## Grading Note
* Graders (`targets/<base_app>/grader.ts`) are Playwright test files calibrated per target base app, with exactly one assertion per `test()` block.
* **AVOID** regex or `str.includes()` on raw file contents to test HTML, CSS, or JavaScript syntax. These are extremely brittle and will fail if the agent uses a different class name, semantic element, or formatting.
* **PREFER static analysis first** using the template helpers: Linkedom for HTML structure (`getHtmlDocuments`), CSSOMNom for CSS rules and at-rules (`getCssStyleSheet`), and ts-morph for JavaScript/TypeScript (`getJsProject`). Verify outcomes rather than one narrow implementation, and accept equivalent utility classes in utility-first CSS apps.
* **Browser checks only when necessary**: Use Playwright browser APIs (e.g., `element.evaluate((el) => window.getComputedStyle(el).propertyName)`) for requirements that cannot be verified statically, such as runtime click events, dynamic state updates, or computed styles.
* A human may manually edit the `.ts` file if the generator struggles to get it perfectly tailored.

---

Once a guide has its `guide.md`, `demo.html`, and `expectations.md` completely written, it is ready for the evaluation pipeline.

## Generating the Eval Graders

To generate and calibrate the evaluation capsules across `SUPPORTED_BASE_APPS` (`daily-grind`, `devtools-times`), use `gd dev`:

```bash
gd dev <path-to-guide-directory>
# Or to re-verify calibration of existing target graders and patches:
gd dev <path-to-guide-directory> --test-grader
```

This command will automatically:
1. Generate multi-agent golden solution patches (`patches/*-solution.patch`), a baseline `patches/zero-passrate.patch`, and `task.md` for each base app under `targets/<base_app>/`.
2. Generate a `targets/<base_app>/grader.ts` Playwright test suite that asserts `expectations.md` passes 100% on the golden solution patches and fails 100% on `zero-passrate.patch`.
3. Run guided vs. unguided agent evaluations and write a diagnostic report.

* **Eval Performance Thresholds**: A guide is not considered ready if evaluation pass rates are low. A 0% unguided pass rate is a critical blocker, indicating the guide may lack sufficient scaffolding for the model to discover the solution.

## Writing `targets/<base_app>/task.md`

`targets/<base_app>/task.md` contains realistic developer prompts used to run AI agents end-to-end against the guide's grader, prefixed by a YAML frontmatter specifying the base application.

**Format:**
```md
---
base_app: daily-grind
---
- make my images load faster on the page
- Optimize the priority of my LCP image 'hero.jpg' and deprioritize the gallery images below the fold.
```

**Critical:** The **first prompt** is the most important. It is used as the default task for the harness, and it must be specific enough to produce a grader-testable result.

**Rules:**
- DO write prompts as a developer talking to an AI coding assistant — casual, lowercase, sometimes vague.
- DO phrase prompts as action requests or directives (e.g. "add X", "can you build Y", "implement Z").
- DO NOT phrase prompts as advisory questions (e.g. "how can I?", "what's the best way to?", "can you explain?"). The agent must implement, not just explain.
- DO vary specificity: include at least one vague/intent-based prompt and one specific/technical ask.
- DO assume the developer is working on an existing app (the base app). Reference its real assets and endpoints if needed (e.g., `hero.jpg`, `/api/analytics`).
- DO NOT mention the guide, the feature name, or hint that guidance exists.
- DO NOT name the base app (e.g., "daily-grind") — a real developer wouldn't refer to it that way.
- DO NOT tell the agent which web API or CSS property to use unless a real developer would naturally do so. The point is to test whether the agent discovers the right solution via the guide.
  > [!IMPORTANT]
  > **Functional Locators vs. Technical Solutions**
  > It is completely acceptable (and sometimes necessary) to mandate specific DOM IDs or CSS classes (e.g., `"add a .fan-card class"`) if the grader requires them to locate elements. What is strictly banned is mandating the underlying implementation technology (e.g., commanding the model to `"use sibling-index()"` or `"use the Temporal API"`).

**Quantity:** 1–4 prompts is typical. A single highly specific prompt is fine for technical use cases. Multiple prompts are useful for use cases with multiple valid entry points (e.g., "accordion", "tabs", "drawer" all exercising the same feature).

**Test your prompts:** Before finalizing, ask yourself: would an agent reading this prompt understand what they need to build? Vague phrases like "I should be able to search" may not convey browser-native "Find in page" behavior to a model. If the prompt is ambiguous, rewrite it to make the intent explicit.

**Consistency:** If writing multiple prompts, consider starting them with the same verb or structure (e.g., all starting with "Create a...") to make the list scannable and consistent.

## Troubleshooting

If `gd dev` fails to calibrate the grader:
* Read the command output to see which assertions failed.
* If the grader logic generated by the pipeline is wrong, you may need to tweak the language in `expectations.md` so the generated grader is more accurate, or simply run `gd dev` again (it attempts to fix itself using failure context).
