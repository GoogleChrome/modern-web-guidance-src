# Modern Web Guidance Analyzer (`src/analyzing`)

The Modern Web Guidance Analyzer scans brownfield web codebases for legacy idioms, obsolete polyfills, and userland workarounds, mapping every finding directly to a corresponding [Modern Web Guidance](../../guides) standard. It is designed for dual operation: fast, human-readable terminal reports for developers and structured machine-readable JSON for autonomous coding agents.

See [LEXICON.md](./LEXICON.md) for the canonical vocabulary (`Modernize`, `analyze`, `Guide Triage`, `Static Matcher`, `LLM Verifier`, `Detection Eval Judge`, and the `rule-writing` and `held-out` splits).

---

## 1. Quickstart

### Command-Line Interface

The analyzer can be run locally via the repository runner `gd` or in downstream projects via `npx`:

```bash
# In the modern-web-guidance repository:
node bin/gd.ts analyze [path/to/project] [options]

# In any brownfield project via npx:
npx -y modern-web-guidance@latest analyze [path/to/project] [options]
```

### CLI Options

| Flag | Type | Description |
| :--- | :--- | :--- |
| `[dir]` | Positional | Directory to analyze (defaults to current working directory). |
| `--json` | Flag | Output machine-readable JSON format for AI coding agents. |
| `--guide <guideId>` | String | Restrict analysis to a single guide ID (e.g. `--guide autofill-sign-in-form`). |
| `--all` | Flag | Include experimental rules (default runs only qualified rules). |
| `--include-docs-and-tests` | Flag | Include documentation, example, demo, and test files (skipped by default). |
| `-h, --help` | Flag | Display CLI usage information and exit. |

### Human-Readable Output Example

```text
Modern Web Guidance Analyzer — /workspace/etherpad-lite
Found 2 modernization opportunities across 2 guides:
Note: Static analysis results are provisional — verify against the Keep/Drop criteria below.
Skipped 53 docs and test files (pass --include-docs-and-tests to scan).

* autofill-sign-in-form [qualified] (1 finding)
  Password input in sign-in or credential form should specify autocomplete="current-password" or autocomplete="new-password".
  Keep when: The password input is part of a user-facing authentication, current-password verification, or sign-in form.;…
  Drop when: The password input is disabled, readonly, hidden, or a non-interactive display widget.; The password input al…
  - src/templates/pad.html:109
    <input id='passwordinput' type='password' name='password'><input type='submit'…

* form-fields-automatically-fit-contents [qualified] (1 finding)
  Imperative JavaScript auto-resizing of textareas and inputs using scrollHeight or autosize() should be replaced with CSS field-sizing: content.
  Keep when: A keyup, input, change, or keydown event listener dynamically recalculates a textarea or text input height/wi…
  Drop when: The code is guarded by a feature query checking CSS.supports("field-sizing", "content") or field-sizing suppo…
  - src/static/js/admin/settings.js:30
    $('.settings').autosize();

Retrieve a guide: npx modern-web-guidance retrieve <guide-id> (or pass --json for coding agents)
```

### Structured JSON Output (`--json`, abridged)

Coding agents receive structured JSON containing exact file coordinates, confidence tiers, message descriptions, verification rubrics, and copy-paste retrieval commands:

```json
{
  "targetDir": "/workspace/etherpad-lite",
  "totalFindings": 1,
  "guides": [
    {
      "guideId": "form-fields-automatically-fit-contents",
      "tier": "qualified",
      "summary": "Imperative JavaScript auto-resizing of textareas and inputs using scrollHeight or autosize() should be replaced with CSS field-sizing: content.",
      "retrieveCommand": "npx modern-web-guidance retrieve form-fields-automatically-fit-contents",
      "verifierRubric": {
        "keepWhen": [
          "A keyup, input, change, or keydown event listener dynamically recalculates a textarea or text input height/width using scrollHeight or scrollWidth to auto-expand the field as the user types.",
          "…"
        ],
        "dropWhen": [
          "The code is guarded by a feature query checking CSS.supports(\"field-sizing\", \"content\") or field-sizing support.",
          "…"
        ]
      },
      "count": 1,
      "findings": [
        {
          "ruleId": "form-fields-automatically-fit-contents",
          "file": "src/static/js/admin/settings.js",
          "line": 30,
          "message": "Library autosize() call auto-expands textarea/input fields; modernize with CSS field-sizing: content.",
          "codeSnippet": "   28 |       $('.settings').append(settings.results);\n   29 |       $('.settings').focus();\n>  30 |       $('.settings').autosize();\n   31 |     }\n   32 |     else{…",
          "summary": "Imperative JavaScript auto-resizing of textareas and inputs using scrollHeight or autosize() should be replaced with CSS field-sizing: content.",
          "verifierRubric": {
            "keepWhen": [
              "A keyup, input, change, or keydown event listener dynamically recalculates a textarea or text input height/width using scrollHeight or scrollWidth to auto-expand the field as the user types.",
              "…"
            ],
            "dropWhen": [
              "The code is guarded by a feature query checking CSS.supports(\"field-sizing\", \"content\") or field-sizing support.",
              "…"
            ]
          }
        }
      ]
    }
  ],
  "skippedDocsAndTestsCount": 53
}
```

---

## 2. Modernize Workflow

For autonomous AI coding agents (such as Claude Code or Codex), modernizing existing code follows the **Modernize** workflow. The `analyze` subcommand serves as the detection step—finding legacy patterns and stopping there—while the agent carries out the planning, guidance retrieval, modern standard application, and verification:

```mermaid
flowchart TD
    Scan["1. Detect Legacy Patterns<br/><code>analyze [dir] --json</code>"] --> Plan["2. Plan & Report<br/>Present modernization diff to user"]
    Plan --> Retrieve["3. Retrieve Guidance<br/><code>retrieve &lt;guideId&gt;</code>"]
    Retrieve --> Modernize["4. Modernize & Verify<br/>Apply modern platform standard<br/>Re-run <code>analyze</code> to verify"]
    Modernize --> Disclose["5. Disclose & Summarize<br/>Report modernizations & Baseline targets"]
```

1. **Detect Legacy Patterns (`analyze`)**: Execute `npx modern-web-guidance analyze <dir> --json` to detect candidate modernization targets across the project. `analyze` finds legacy patterns and stops there.
2. **Plan & Confirm**: Group detected findings by `guideId`, inspect source contexts against the verification rubric (`keepWhen`/`dropWhen`), and report a clear modernization proposal to the developer before editing code.
3. **Retrieve Guidance**: For each approved guide ID, run `npx modern-web-guidance retrieve "<guideId>"` to fetch the complete canonical guidance, including edge cases, accessibility invariants, and fallback strategies.
4. **Modernize & Verify**: Update legacy code to standard web platform features (e.g. native `<dialog>`, `content-visibility`, `autocomplete`). Re-run `analyze <dir> --json` to verify that findings are eliminated without regressions.
5. **Disclose & Summarize**: End the turn with a concise summary describing the modernized APIs and any browser Baseline implications.

---

## 3. Architecture: Static Matcher + LLM Verifier

High-precision static analysis requires balancing high recall against low matcher misfire rates across diverse real-world frameworks. The analyzer achieves this through a two-step runtime architecture:

```mermaid
flowchart LR
    Source["Codebase Source Files<br/>(TS/JS, JSX/HTML, CSS, JSON)"] --> StaticMatcher["Static Matcher<br/>AST & Token Pattern Matching<br/>(High Recall, Fast)"]
    StaticMatcher --> RawCards["Candidate Findings<br/>(Card ID: SHA-256 slice)"]
    RawCards --> LlmVerifier["LLM Verifier<br/>Rubric Check: keepWhen / dropWhen<br/>(High Precision)"]
    LlmVerifier --> Kept["Kept Modernization Findings"]
    LlmVerifier -.-> Dropped["Dropped False Positives<br/>(Guarded, Shadowed, Non-DOM)"]
```

### Static Matcher (High-Recall Deterministic Scanner)

- **Speed & Breadth**: Scans thousands of files in milliseconds using token pre-filters (`fastTokens`) before parsing ASTs.
- **Multi-Modal Matchers**: Evaluates JavaScript/TypeScript syntax trees via `ts-morph`, DOM elements and JSX props via custom AST visitors, CSS stylesheets via declaration parsing, and package dependencies via `package.json`.
- **Finding Identity**: Every finding receives a deterministic 12-character hex ID:
  $$\text{CardID} = \text{SHA256}(\text{repo} : \text{commit} : \text{guideId} : \text{file} : \text{line})[0..12]$$
  This provides stable tracking across repeat runs and evaluation datasets.

### LLM Verifier (Contextual Rubric Filter)

Candidate matches are validated against rule-specific rubrics defined in [`schema.ts`](./schema.ts):
- **`keepWhen` Criteria**: Verified when the candidate matches genuine legacy workarounds (e.g., custom event loops, manual clipboard workarounds, DIY popover positioning).
- **`dropWhen` Criteria**: Immediately discards false positives, including:
  - Code already guarded by feature detection (`'showPicker' in HTMLInputElement.prototype`).
  - Identifiers shadowed in unrelated scopes (e.g., local variables named `dialog` in audio or physics engines).
  - Out-of-domain contexts (WebGL canvas contexts, Node.js CLI tools).

---

## 4. Rule Authoring (`AnalyzerRule`)

Each analyzer rule implements the `AnalyzerRule` interface from [`schema.ts`](./schema.ts):

```typescript
export interface AnalyzerRule {
  readonly id: string;
  readonly guideId: string;
  readonly guideHash: string;
  readonly summary: string;
  readonly matcher: RuleMatcher;
  readonly verifierRubric: VerifierRubric;
}
```

### Supported Matcher Kinds

1. **`JsRuleMatcher` (`kind: 'js'`):** Analyzes JavaScript and TypeScript files using `ts-morph` AST navigation.
2. **`DomRuleMatcher` (`kind: 'dom'`):** Inspects HTML templates and JSX/TSX elements for tag names, attribute combinations, and missing modern platform attributes.
3. **`CssRuleMatcher` (`kind: 'css'`):** Checks CSS rules and style declarations for obsolete workarounds (e.g. manual `-webkit-line-clamp` fallbacks).
4. **`DependencyRuleMatcher` (`kind: 'dependency'`):** Flags obsolete third-party npm packages whose functionality has been superseded by native web platform APIs.

### Example Rule Implementation

```typescript
import type { AnalyzerRule, DomRuleMatcher } from '../schema.ts';

const matcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'input',
  fastTokens: ['type="password"', "type='password'"],
  matchElement(element) {
    const type = element.getAttribute('type');
    if (type !== 'password') return null;

    const hasAutocomplete = element.hasAttribute('autocomplete');
    if (hasAutocomplete) return null;

    return {
      message: 'Password input lacks standard autocomplete attribute; modern password managers require autocomplete="current-password" or autocomplete="new-password".',
    };
  },
};

export const autofillSignInFormRule: AnalyzerRule = {
  id: 'autofill-sign-in-form',
  guideId: 'autofill-sign-in-form',
  guideHash: 'a1b2c3d4e5f6',
  summary: 'Add standard autocomplete attributes to sign-in and registration form inputs.',
  matcher,
  verifierRubric: {
    keepWhen: [
      'Input element has type="password" without an autocomplete attribute.',
      'Input element accepts credential data inside an authentication or registration form.',
    ],
    dropWhen: [
      'Element already defines autocomplete="current-password" or autocomplete="new-password".',
      'Element is an internal mock, unit test fixture, or non-credential token input.',
    ],
  },
};
```

### Qualified Rules & Gated Execution

To keep terminal false alarms low when run in developer environments, the analyzer enforces qualification gating:
- **`QUALIFIED_RULES` (`QUALIFIED_GUIDE_IDS`):** By default in standard terminal CLI mode and `--json` mode, the analyzer runs rules for guides that clear the default-on qualification standard on the `held-out` split as scored by the multi-judge panel: Static Matcher Precision $\ge 80\%$ and Post-Verifier Precision $\ge 90\%$ at $n \ge 10$ (or Static Matcher Precision $\ge 90\%$ at $n \ge 5$ for rare patterns). In `--json` mode, complete `verifierRubric` definitions (`keepWhen` and `dropWhen`) are emitted so coding agents can perform runtime verification before proposing edits.
- **`ALL_RULES` (`--all`):** Executes all active feature guides across all rules in `ALL_RULES`, including experimental rules.

### Qualification Criteria

Rules qualify for default terminal shipping when scored on `held-out` findings by the multi-judge panel:
- **Standard Bar:** Static Matcher Precision $\ge 80.0\%$ and Post-Verifier Precision $\ge 90.0\%$ at $n \ge 10$ evaluated findings on the `held-out` split.
- **Rare-Pattern Bar:** Static Matcher Precision $\ge 90.0\%$ at $n \ge 5$ evaluated findings on the `held-out` split.
- Rules below the bar remain in the experimental tier (`--all`) until their matchers and rubrics clear the threshold.

### 2-Axis Triage Taxonomy

Every web platform standard in the catalog is classified across two orthogonal axes:
- **Axis 1: Detection (`detection`):**
  - `direct-token` & `structural-ast`: Deterministic token, AST, DOM, CSS, or `package.json` patterns with high signal-to-noise ratio requiring no LLM runtime verification.
  - `needs-verifier`: Pattern detectable by static matchers but requiring runtime LLM Verifier evaluation against a `verifierRubric` (`keepWhen` / `dropWhen`) to reject subtle false alarms.
  - `no-legacy-pattern`: Visual, behavioral, or greenfield capability without a distinguishable brownfield syntax footprint to replace.
- **Axis 2: Update Scope (`updateScope`):**
  - `local-swap`: Replacing or adding a property, selector, attribute, or call at the same site (e.g., standard `autocomplete` attributes, `text-wrap: balance`, `field-sizing: content`).
  - `cross-layer-refactor`: Deleting imperative JS listeners, observers, or helper libraries and moving behavior into declarative CSS or HTML (`@starting-style`, `animation-timeline`, `:has()`).
  - `widget-recipe`: Coordinating HTML structure, CSS layout/styling, and JS behavior across multiple parts of a composite UI widget.
  - `n/a`: Applicable when detection is `no-legacy-pattern`.

### Qualified Feature Guides

*Scores are multi-judge panel consensus estimates on the `held-out` split.*

| Guide ID | Rule ID | Matcher Kind | Split | Yield | Sampled ($n$ / kept $n$) | Static Matcher Precision (95% Wilson CI) | Post-Verifier Precision (95% Wilson CI) | Modern Platform Target |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- | :--- | :--- |
| `deliver-optimized-decorative-images` | `deliver-optimized-decorative-images` | CSS | `held-out` | 224 | 35 / 35 | 100.0% ([90.1%, 100.0%]) | 100.0% ([90.1%, 100.0%]) | Standard CSS `image-set()` for decorative backgrounds and masks |
| `improve-text-layout-and-legibility` | `improve-text-layout-and-legibility/package-text-balance` | Dependency | `held-out` | 32 | 32 / 32 | 100.0% ([89.3%, 100.0%]) | 100.0% ([89.3%, 100.0%]) | CSS `text-wrap: balance` and `text-wrap: pretty` |
| `styling-web-components` | `styling-web-components` | CSS & JS | `held-out` | 107 | 19 / 14 | 100.0% ([83.2%, 100.0%]) | 100.0% ([78.5%, 100.0%]) | `::part()`, `:host`, and constructable stylesheets (`adoptedStyleSheets`) |
| `autofill-address-form` | `autofill-address-form` | DOM | `held-out` | 19 | 18 / 17 | 100.0% ([82.4%, 100.0%]) | 100.0% ([81.6%, 100.0%]) | Standard `autocomplete` attributes on address form inputs |
| `dynamic-sibling-animations` | `dynamic-sibling-animations` | CSS | `held-out` | 15 | 11 / 11 | 100.0% ([74.1%, 100.0%]) | 100.0% ([74.1%, 100.0%]) | CSS `sibling-index()` and `sibling-count()` for staggered delays |
| `scroll-entry-exit-effects` | `scroll-entry-exit-effects/package-scroll-reveal` | Dependency | `held-out` | 16 | 10 / 10 | 100.0% ([72.2%, 100.0%]) | 100.0% ([72.2%, 100.0%]) | CSS Scroll-Driven Animations (`animation-timeline: view()`) |
| `light-dismiss-a-dialog` | `light-dismiss-a-dialog` | JS | `held-out` | 5 | 5 / 5 | 100.0% ([56.6%, 100.0%]) | 100.0% ([56.6%, 100.0%]) | Declarative `<dialog closedby="any">` light dismiss |
| `secure-external-subresources` | `secure-external-subresources` | DOM | `held-out` | 289 | 35 / 34 | 97.1% ([85.5%, 99.5%]) | 100.0% ([89.8%, 100.0%]) | Subresource Integrity (`integrity` and `crossorigin`) on third-party scripts |
| `scrollspy` | `scrollspy` | DOM | `held-out` | 122 | 35 / 34 | 97.1% ([85.5%, 99.5%]) | 100.0% ([89.8%, 100.0%]) | CSS `scroll-target-group: auto` and `:target-current` |
| `custom-text-decorations` | `custom-text-decorations` | CSS | `held-out` | 34 | 28 / 26 | 96.4% ([82.3%, 99.4%]) | 100.0% ([87.1%, 100.0%]) | `text-decoration-thickness`, `text-underline-offset`, and `text-decoration-color` |
| `form-fields-automatically-fit-contents` | `form-fields-automatically-fit-contents` | Dependency & JS | `held-out` | 29 | 26 / 25 | 96.2% ([81.1%, 99.3%]) | 100.0% ([86.7%, 100.0%]) | CSS `field-sizing: content` |
| `scroll-entry-exit-effects` | `scroll-entry-exit-effects/js-scroll-reveal` | JS | `held-out` | 44 | 25 / 25 | 96.0% ([80.5%, 99.3%]) | 96.0% ([80.5%, 99.3%]) | CSS Scroll-Driven Animations (`animation-timeline: view()`) |
| `dark-mode` | `dark-mode` | CSS | `held-out` | 78 | 35 / 34 | 94.3% ([81.4%, 98.4%]) | 94.1% ([80.9%, 98.4%]) | `color-scheme: light dark` and `light-dark()` color function |
| `interest-triggered-tooltips` | `interest-triggered-tooltips/js-tooltip` | JS | `held-out` | 56 | 13 / 13 | 92.3% ([66.7%, 98.6%]) | 92.3% ([66.7%, 98.6%]) | HTML `popover="hint"` and `interestfor` |
| `calculate-event-differentials` | `format-human-readable-durations/js-duration-formatter` | JS | `held-out` | 27 | 25 / 25 | 92.0% ([75.0%, 97.8%]) | 92.0% ([75.0%, 97.8%]) | Native `Temporal.Duration` and `Intl.DurationFormat` |
| `sanitize-untrusted-html` | `sanitize-untrusted-html/js-dompurify-innerhtml` | JS | `held-out` | 13 | 10 / 10 | 90.0% ([59.6%, 98.2%]) | 90.0% ([59.6%, 98.2%]) | Native Sanitizer API (`element.setHTML()`) |
| `checkbox` | `checkbox` | CSS, DOM & JS | `held-out` | 175 | 35 / 32 | 85.7% ([70.6%, 93.7%]) | 93.8% ([79.9%, 98.3%]) | Native `<input type="checkbox">`, `accent-color`, and `:indeterminate` |
| `autofill-sign-in-form` | `autofill-sign-in-form` | DOM | `held-out` | 265 | 35 / 26 | 85.7% ([70.6%, 93.7%]) | 92.3% ([75.9%, 97.9%]) | Standard `autocomplete="username"` and `autocomplete="current-password"` |
| `autofill-payment-form` | `autofill-payment-form` | DOM & JS | `held-out` | 27 | 15 / 12 | 80.0% ([54.8%, 93.0%]) | 100.0% ([75.7%, 100.0%]) | Standard `cc-*` `autocomplete` attributes on payment inputs |

---

## 5. Evaluation & Measurement Framework

The analyzer gates rules on evaluation against held-out repositories before any rule is published in `QUALIFIED_RULES`.

### Evaluation Subsystem (`src/analyzing/eval/`)

- **`guide-triage.ts`**: Implements the 2-axis triage taxonomy (`Detection` and `Update Scope`) and maintains canonical metadata for all web platform guides.
- **`detection-eval.ts`**: Runs multi-pass LLM judge evaluation (`gemini-3.8-flash`) against human-graded cards to measure true-positive and matcher misfire rates with majority voting.
- **`llm-verifier.ts`**: Implements the runtime and eval-time LLM verifier evaluating candidate matches against `verifierRubric` (`keepWhen` / `dropWhen`) specifications.
- **`stats.ts`**: Statistical foundations implementing Wilson binomial confidence intervals, sequential stopping decisions, and TPR/TNR metrics.
- **`prompts.ts`**: Centralized prompt templates, thinking budgets, and content-hashed version tracking across all LLM evaluation passes.

### 2-Split Corpus Architecture (`rule-writing` vs `held-out`)

The evaluation corpus is divided into two isolated splits across repositories and source files covering active feature guides:
- **`rule-writing`:** Used by engineers and agents to discover legacy patterns, author Static Matcher AST patterns, and tune LLM Verifier rubrics.
- **`held-out`:** Reserved strictly for out-of-sample precision and recall validation. Kept separate when authoring or debugging rules to evaluate generalization on unseen code.

Cross-split boundary isolation is statically verified by internal audit tooling.

### Running Evaluation Benchmarks

```bash
# Run unit tests across analyzing subsystem:
node --test "src/analyzing/**/*.test.ts"

# Run preflight verification (build, typecheck, lint):
pnpm run preflight

# Run Detection Eval Judge benchmark on evaluation decks:
node --env-file=.env src/analyzing/eval/detection-eval.ts
```

---

## 6. Contributor Playbook: How to Add & Qualify an Analyzer Rule

Follow this 4-step workflow to author, test, and qualify a rule for modern web guidance:

### Step 1: Guide Triage
1. **Verify Guide Triage status**: Ensure the feature guide is triaged with `detection: 'direct-token'`, `'structural-ast'`, or `'needs-verifier'` (never `'no-legacy-pattern'`).
2. **Record the Guide Triage entry**: Identify concrete 1-to-1 legacy APIs, CSS workarounds, or npm packages that the modern platform feature directly replaces (`replaces`), alongside lookalike patterns that are out of scope (`doesNotReplace`).
3. **Ground in real code**: Inspect only the `rule-writing` corpus. Do not inspect held-out code.

### Step 2: Static Matcher Authoring
1. **Choose matcher kind**: `JsRuleMatcher` (AST via `ts-morph`), `DomRuleMatcher` (HTML/JSX DOM via `linkedom`), `CssRuleMatcher` (CSS via `cssomnom`), or `DependencyRuleMatcher` (`package.json`).
2. **Implement in `src/analyzing/rules/<guide-id>.ts`**:
   - Set `fastTokens` pre-filters to ensure fast string pre-screening.
   - Target high recall on the structural shape of the legacy idiom.
   - Return clean finding messages explaining the modern replacement.
3. **Add unit test suite in `src/analyzing/rules/<guide-id>.test.ts`**: Test positive examples, negative examples, and edge cases.

### Step 3: LLM Verifier Rubric
1. **Define `verifierRubric` in the rule definition**:
   - `keepWhen`: Precise criteria matching genuine legacy workarounds.
   - `dropWhen`: Immediate exclusions (feature detection guards, shadowed variables, out-of-domain contexts).
2. **Agentic verification**: Ensure that `--json` output emits the complete rubric so AI coding agents can verify findings before proposing modernizations.

### Step 4: Held-Out Qualification
1. **Run preflight checks**: `pnpm run preflight` and `node --test "src/analyzing/**/*.test.ts"`.
2. **Run detection evaluation**: `node --env-file=.env src/analyzing/eval/detection-eval.ts`.
3. **Qualification criteria**:
   - **Experimental Rule**: Active in `ALL_RULES`, available under `--all`.
   - **Qualified Rule**: Promoted to `QUALIFIED_GUIDE_IDS` for default terminal shipping once it clears the multi-judge qualification standard on the `held-out` split (Static Matcher Precision $\ge 80\%$ and Post-Verifier Precision $\ge 90\%$ at $n \ge 10$, or Static Matcher Precision $\ge 90\%$ at $n \ge 5$ for rare patterns).
