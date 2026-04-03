---
name: project-evals
description: Best practices for creating expectations and grader files to evaluate guidance quality. Use this skill any time you're writing or reviewing an `expectations.md` or `grader.ts` file.
---

# Stage 3: Evaluating guidance for a use case (Needs evals)

This is the third of three stages in creating guidance:

1. Stage 1: Identifying use cases for a feature
2. Stage 2: Authoring guidance for a use case
3. Stage 3: Evaluating guidance for a use case (you are here)

## What the eval agent sees vs real-world agents

**Real-world coding agents see only `guide.md`** — retrieved automatically via the RAG skills system when a developer asks for help. Every other file in a use case directory is eval infrastructure.

**The eval harness** runs a separate coding agent in a controlled environment to test whether the guidance works. This eval agent receives the first prompt from `tasks/task.md` and has access to `guide.md` via the same RAG system. The harness then runs `grader.ts` against the eval agent's output.

None of the following are ever seen by real-world coding agents:

| File | Role in eval pipeline |
|---|---|
| `tasks/task.md` | Simulated developer prompts and base application name fed to the eval agent by the harness |
| `demo.html` | Reference implementation — grader runs against it to confirm tests pass on correct code |
| `negative-demo.html` | Anti-example — grader runs against it to confirm tests fail on incorrect code |
| `expectations.md` | Spec used to generate `grader.ts` |
| `grader.ts` | Playwright tests run against the eval agent's output |

## How the eval files work together

`tasks/task.md`, `expectations.md`, and `grader.ts` form a tightly coupled pipeline:
1. **`tasks/task.md`** — Simulated developer prompts used only by the eval harness. It must start with a YAML frontmatter specifying the `base_app`, followed by a list of prompts. Each prompt should sound like a real developer request, without naming specific APIs or best practices — the eval agent is expected to discover those by reading `guide.md` via RAG. The first prompt is the most important: it is used as the default task.

2. **`expectations.md`** — The ground truth for what a correct implementation looks like. Each bullet becomes exactly one test in `grader.ts`. Write expectations assuming the eval agent read `guide.md` and implemented it faithfully; they describe the observable output, not the implementation approach.

3. **`grader.ts`** — A Playwright test file generated 1:1 from `expectations.md`. Every bullet maps to one `test()` block. If an expectation cannot be translated into a Playwright assertion (static file check or browser automation), it does not belong in `expectations.md`.

## Writing `expectations.md`

Write a natural language, bulleted list of assertions that must be true if an agent implements the `guide.md` correctly (e.g., "The input element is styled with a red border only AFTER a blur event").

* **1:1 with grader tests** — Each bullet becomes exactly one test. Write one bullet per assertion. Do not combine multiple checks into a single bullet.
* **Concrete and testable** — A grader must be able to write a Playwright assertion for it. Bullets like "Keep form pages visually simple" are best practices, not expectations.
* **Scoped to this use case** — Only include expectations that apply to the specific use case being graded. Do not copy generic expectations from other guides if they describe behavior that won't appear in an implementation of this guide (e.g., don't include URL input expectations in a sign-in form grader).
* **No external links** — The grader generator cannot resolve them.
* **Avoid over-constraining** — Don't assert implementation details that don't affect correctness (e.g., don't require a direct child relationship if a descendant also works).

## Grading Note
* Graders (`grader.ts`) live within their respective guide folders. These are Playwright test files, but they are permitted to perform non-browser tests (like `str.includes()` on file contents) as well as actual browser automation checks. A huamn may manually edit them if the generator struggles to get it perfectly tailored.

---

Once a guide has its `guide.md`, `demo.html`, and `expectations.md` completely written, it is ready for the evaluation pipeline.

## Generating the Eval Graders

To generate the eval graders, use the `gd dev` tool. 

Run the following command:
```bash
node ./bin/gd.ts dev <path-to-guide-directory>
```

This command will automatically:
1. Generate a `negative-demo.html` based on the guidance.
2. Generate a `grader.ts` Playwright test that asserts your `expectations.md` against both `demo.html` (should pass) and `negative-demo.html` (should fail).
3. Test and calibrate the grader by running the test suite.

## Writing `tasks/task.md`

`tasks/task.md` contains realistic developer prompts used to run AI agents end-to-end against the guide's grader, prefixed by a YAML frontmatter specifying the base application.

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

**Quantity:** 1–4 prompts is typical. A single highly specific prompt is fine for technical use cases. Multiple prompts are useful for use cases with multiple valid entry points (e.g., "accordion", "tabs", "drawer" all exercising the same feature).

**Test your prompts:** Before finalizing, ask yourself: would an agent reading this prompt understand what they need to build? Vague phrases like "I should be able to search" may not convey browser-native "Find in page" behavior to a model. If the prompt is ambiguous, rewrite it to make the intent explicit.

**Consistency:** If writing multiple prompts, consider starting them with the same verb or structure (e.g., all starting with "Create a...") to make the list scannable and consistent.

## Troubleshooting

If `gd dev` fails to calibrate the grader:
* Read the command output to see which assertions failed.
* If the grader logic generated by the pipeline is wrong, you may need to tweak the language in `expectations.md` so the generated grader is more accurate, or simply run `gd dev` again (it attempts to fix itself using failure context).
