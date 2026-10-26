# Modern Web Guidance Analyzer (`src/analyzing`)

The Modern Web Guidance Analyzer scans brownfield web codebases for legacy idioms, obsolete polyfills, and userland workarounds, mapping every finding directly to a corresponding [Modern Web Guidance](../../guides) standard. It is designed for dual operation: fast, human-readable terminal reports for developers and structured machine-readable JSON for autonomous coding agents.

See [LEXICON.md](./LEXICON.md) for the canonical vocabulary (`Modernize`, `analyze`, `Guide Triage`, `Static Matcher`, `LLM Verifier`, `Detection Eval Judge`, `Update Eval`, and the `rule-writing` and `held-out` splits).

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
| `--tier <tier>` | String | Restrict analysis to a confidence tier (`qualified` or `experimental`). |
| `--experimental`, `--all-rules` | Flag | Run all 71 active feature guides (98 rules total in `ALL_RULES`), including experimental rules. |
| `-h, --help` | Flag | Display CLI usage information and exit. |

### Human-Readable Output Example

```text
Modern Web Guidance Analyzer — /workspace/my-app
Found 3 modernization opportunities across 2 guides:
Note: Static analysis results are provisional — verify against the Keep/Drop criteria below.

* autofill-sign-in-form [qualified] (2 findings)
  Use standard autocomplete attributes on username and password inputs instead of custom credentials handling.
  Keep when: The form manages credentials without standard browser autofill hints
  Drop when: Input already specifies standard autocomplete="username" or autocomplete="current-password"
  - src/components/Login.tsx:42
    <input type="password" name="password">
  - src/views/Register.vue:18
    <input type="password" id="pass">

* ime-safe-enter-submit [qualified] (1 finding)
  Guard Enter-key form submission handlers with !event.isComposing to prevent premature submit during CJK IME composition.
  Keep when: Keydown handler checks for Enter and triggers submission without checking event.isComposing
  Drop when: Handler already checks event.isComposing or event.keyCode === 229
  - src/components/ChatInput.tsx:75
    if (e.key === 'Enter' && !e.shiftKey) submitMessage();

Retrieve a guide: npx modern-web-guidance retrieve <guide-id> (or pass --json for coding agents)
```

### Structured JSON Output (`--json`)

Coding agents receive structured JSON containing exact file coordinates, confidence tiers, message descriptions, and copy-paste retrieval commands:

```json
{
  "targetDir": "/workspace/my-app",
  "totalFindings": 1,
  "guides": [
    {
      "guideId": "autofill-sign-in-form",
      "tier": "qualified",
      "summary": "Use standard autocomplete attributes on username and password inputs.",
      "retrieveCommand": "npx -y modern-web-guidance@latest retrieve \"autofill-sign-in-form\"",
      "count": 1,
      "findings": [
        {
          "ruleId": "autofill-sign-in-form",
          "file": "src/components/Login.tsx",
          "line": 42,
          "message": "Missing autocomplete on login form credentials input",
          "codeSnippet": "<input type=\"password\" name=\"pass\" />"
        }
      ]
    }
  ]
}
```

---

## 2. Modernize Workflow (`D-013`)

For autonomous AI coding agents (Claude Code, Jetski, Codex), modernizing existing code follows the **Modernize** workflow. The `analyze` subcommand serves as the detection step—finding legacy patterns and stopping there—while the agent carries out the planning, guidance retrieval, modern standard application, and verification:

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

High-precision static analysis requires balancing high recall against near-zero false positive rates across diverse real-world frameworks. The analyzer achieves this through a two-step runtime architecture:

```mermaid
flowchart LR
    Source["Codebase Source Files<br/>(TS/JS, JSX/HTML, CSS, JSON)"] --> P1["Static Matcher<br/>AST & Token Pattern Matching<br/>(High Recall, Fast)"]
    P1 --> RawCards["Candidate Findings<br/>(Card ID: SHA-256 slice)"]
    RawCards --> P2["LLM Verifier<br/>Rubric Check: keepWhen / dropWhen<br/>(High Precision)"]
    P2 --> Kept["Kept Modernization Findings"]
    P2 -.-> Dropped["Dropped False Positives<br/>(Guarded, Shadowed, Non-DOM)"]
```

### Static Matcher (High-Recall Deterministic Scanner)

- **Speed & Breadth**: Scans thousands of files in milliseconds using token pre-filters (`fastTokens`) before parsing ASTs.
- **Multi-Modal Matchers**: Evaluates JavaScript/TypeScript syntax trees via `ts-morph`, DOM elements and JSX props via custom AST visitors, CSS stylesheets via declaration parsing, and package dependencies via `package.json`.
- **Finding Identity**: Every finding receives a deterministic 12-character hex ID:
  $$\text{CardID} = \text{SHA256}(\text{repo} : \text{commit} : \text{guideId} : \text{file} : \text{line})[0..12]$$
  This guarantees stable tracking across repeat runs and evaluation datasets.

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

To guarantee zero hallucinated false alarms when run in interactive developer terminals, the analyzer enforces strict gating:
- **`QUALIFIED_RULES` (`QUALIFIED_GUIDE_IDS`):** By default in standard terminal CLI mode and `--json` mode, the analyzer runs rules for guides that clear objective qualification criteria (71 active guides: 15 qualified across 20 rules, and 56 experimental across 78 rules, totaling 98 rules in `ALL_RULES`). In `--json` mode, complete `verifierRubric` definitions (`keepWhen` and `dropWhen`) are emitted so coding agents can perform runtime verification before proposing edits.
- **`ALL_RULES` (`--experimental` / `--all-rules`):** Executes all 71 active feature guides across 98 rules in `ALL_RULES`, including experimental rules.

### 3-Tier Qualification Criteria

Rules qualify for default terminal shipping under a 3-tier hierarchy:
- **Tier A (Human Ground Truth $\ge 90\%$):** Rules validated by direct blind human spot-check decks on the `held-out` split achieving $\ge 90\%$ precision at $n \ge 35$, Wilson LB $\ge 0.90$.
- **Tier B (Detection Eval Consensus $\ge 90\%$ at $n \ge 30$):** Rules where 7-verdict Detection Eval Judge consensus reaches $\ge 90\%$ across at least 30 candidate findings on the `held-out` split.
- **Tier C (Deterministic AST / Low Misfire $\ge 85\%$ at $n \ge 10$):** Rules with deterministic structural AST/DOM/CSS/dependency matchers exhibiting $\ge 85\%$ precision with low structural misfire rates.

### 2-Axis Triage Taxonomy

Every web platform standard in the catalog is classified across two orthogonal axes in `analyzer-internal/guide-triage.json` (covering all **249 catalog guides**):
- **Axis 1: Detection (`detection`):**
  - `direct-token` (47 guides) & `structural-ast` (61 guides): Deterministic token, AST, DOM, CSS, or `package.json` patterns (`ast-only` in `LEXICON.md`) with high signal-to-noise ratio requiring no LLM runtime verification.
  - `needs-verifier` (34 guides): Pattern detectable by static matchers but requiring runtime LLM Verifier evaluation against a `verifierRubric` (`keepWhen` / `dropWhen`) to reject subtle false alarms.
  - `no-legacy-pattern` (107 guides): Visual, behavioral, or greenfield capability without a distinguishable brownfield syntax footprint to replace.
- **Axis 2: Update Scope (`updateScope`):**
  - `local-swap` (72 guides): Replacing or adding a property, selector, attribute, or call at the same site (`call-site-swap` in `LEXICON.md`; e.g., standard `autocomplete` attributes, `text-wrap: balance`, `field-sizing: content`).
  - `cross-layer-refactor` (44 guides): Deleting imperative JS listeners, observers, or helper libraries and moving behavior into declarative CSS or HTML (`@starting-style`, `animation-timeline`, `:has()`).
  - `widget-recipe` (26 guides): Coordinating HTML structure, CSS layout/styling, and JS behavior across multiple parts of a composite UI widget.
  - `n/a` (107 guides): Applicable when detection is `no-legacy-pattern`.

### Qualified Feature Guides (15 Qualified Guides across 20 Rules)

| # | Guide ID | Matcher Kind | Qualification Tier | Held-Out Precision | Sample Size ($n$) | Modern Platform Target |
| :- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `autofill-address-form` | DOM | Tier C | 100.0% | 20 | Standard `autocomplete` attributes on address form inputs |
| 2 | `autofill-payment-form` | DOM | Tier C | 100.0% | 11 | Standard `autocomplete` attributes on payment and credit card inputs |
| 3 | `autofill-sign-in-form` | DOM | Tier B | 100.0% | 31 | Standard `autocomplete="username"` and `autocomplete="current-password"` |
| 4 | `branded-select-styling` | JS | Tier C | 85.2% | 27 | Customizable native `<select>` with `appearance: base-select` |
| 5 | `checkbox` | CSS | Tier C | 89.7% | 29 | CSS `accent-color` for styled checkboxes |
| 6 | `custom-text-decorations` | CSS | Tier C | 100.0% | 24 | CSS `text-decoration-thickness`, `text-underline-offset`, `text-decoration-color` |
| 7 | `equal-width-text-lines` | Dependency & JS | Tier C | 91.7% | 12 | CSS `text-wrap: balance` replacing FitText libraries |
| 8 | `form-fields-automatically-fit-contents` | CSS | Tier C | 100.0% | 26 | CSS `field-sizing: content` |
| 9 | `ime-safe-enter-submit` | JS | Tier C | 100.0% | 17 | IME-safe Enter submission gating on `isComposing` / `keyCode === 229` |
| 10 | `prevent-page-scroll-under-modal-dialog` | Dependency & CSS | Tier C | 91.7% | 12 | Native `<dialog>` and CSS `overscroll-behavior: contain` |
| 11 | `responsive-table` | Dependency & CSS | Tier B | 100.0% | 35 | CSS Container Queries (`@container`) and sticky headers |
| 12 | `scroll-entry-exit-effects` | Dependency & JS | Tier B | 97.1% | 35 | CSS Scroll-Driven Animations (`animation-timeline: view()`) |
| 13 | `scrollspy` | CSS | Tier B | 94.3% | 35 | CSS `scroll-target-group: auto` and `:target-current` |
| 14 | `select-menu-interaction` | CSS & JS | Tier C | 96.2% | 26 | Native `<select>` custom picker interactions and `:user-invalid` |
| 15 | `styling-web-components` | CSS | Tier C | 100.0% | 10 | CSS `::part()`, `adoptedStyleSheets`, and modern shadow DOM styling |

---

## 5. Evaluation, Update Eval & Measurement Framework

The analyzer adheres to statistical rigor to guarantee production accuracy before any rule is published in `QUALIFIED_RULES`.

### Evaluation Subsystem (`src/analyzing/eval/`)

- **`guide-triage.ts`**: Implements the 2-axis triage taxonomy (`detectable`, `1-to-1-replacement`, etc.) and maintains canonical metadata for all web platform guides.
- **`detection-eval.ts`**: Runs multi-pass LLM judge evaluation (`gemini-3.8-flash`) against human-graded cards (`grades.jsonl`) to measure true-positive and false-positive rates with majority voting.
- **`llm-verifier.ts`**: Implements the runtime and eval-time LLM verifier evaluating candidate matches against `verifierRubric` (`keepWhen` / `dropWhen`) specifications.
- **`update-eval.ts`**: Automated patch validation harness testing candidate modernization updates across 3 classes of bad patches (`no-op`, `deletion-gutting`, `broken/evasion`) and reference good fixes.
- **`stats.ts`**: Statistical foundations implementing Wilson binomial confidence intervals, sequential stopping decisions, and TPR/TNR metrics.
- **`prompts.ts`**: Centralized prompt templates, thinking budgets, and content-hashed version tracking across all LLM evaluation passes.

### 2-Split Corpus Architecture (`rule-writing` vs `held-out`)

The evaluation corpus is divided into two strictly isolated splits across 26,426 files and 8,508 repositories covering 71/71 active feature guides:
- **`rule-writing` (13,215 files across 208 local repos in `analyzer-internal/repos.json` and remote GitMirror repos):** Used freely by engineers and agents to discover legacy patterns, author Static Matcher AST patterns, and tune LLM Verifier rubrics.
- **`held-out` (13,211 files across 8,508 repositories, `MOD(ABS(FARM_FINGERPRINT(repository)), 2) = 1`):** Reserved strictly for out-of-sample precision and recall validation (`scorecard.ts`). Never inspected when authoring or debugging rules, guaranteeing zero tuning leakage.

Cross-split boundary isolation is statically verified by internal audit tooling.

### Update Eval

To evaluate end-to-end code modernization without falling into the "Deletion Equals Resolution" trap (`G12`), **Update Eval** (`update-eval.ts`) enforces three static checks on every candidate modernization update:
- **Check 1 (Finding Eliminated Check):** Splices the patched window into the full file and verifies `0` remaining findings in the window and reduced full-file finding count.
- **Check 2 (Modern Syntax & Anti-Gutting Check):** Verifies clean AST/DOM/CSS parsing (`ts-morph` with JSX support, `linkedom`, `cssomnom`), top-level export retention, and comment-stripped presence of the guide's positive modern web feature.
- **Check 3 (Behavioral Check):** Runs behavioral/test assertions when available.
- **Verified Benchmarks:** **100.0% (`177/177`) rejection** on the 3-class seeded bad-patch sensitivity suite across 59 seeded fixtures (`no-op`, `deletion-gutting`, `broken/evasion`), and **100.0% (`59/59`) acceptance** on reference good fixes.

### Running Evaluation Benchmarks

```bash
# Run unit tests across analyzing subsystem:
node --test "src/analyzing/**/*.test.ts"

# Run preflight verification (build, typecheck, lint):
pnpm run preflight

# Run Detection Eval Judge benchmark on evaluation decks:
node --env-file=.env src/analyzing/eval/detection-eval.ts

# Run seeded sensitivity suite & end-to-end agentic update evaluation:
node --env-file=.env src/analyzing/eval/update-eval.ts
```

All scorecard results and audit trails are logged to `PROGRESS.md` and serialized in `analyzer-internal/findings/`.

---

## 6. Contributor Playbook: How to Add & Qualify an Analyzer Rule

Follow this 4-step workflow to author, test, and qualify a rule for modern web guidance:

### Step 1: Guide Triage
1. **Verify Guide Triage status**: Ensure the feature guide is triaged with `detection: 'direct-token'`, `'structural-ast'`, or `'needs-verifier'` (never `'no-legacy-pattern'`).
2. **Record the Guide Triage entry**: Identify concrete 1-to-1 legacy APIs, CSS workarounds, or npm packages that the modern platform feature directly replaces (`replaces`), alongside lookalike patterns that are out of scope (`doesNotReplace`).
3. **Ground in real code**: Inspect only the `rule-writing` corpus (13,215 files across local and GitMirror repositories). Never inspect held-out code.

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
2. **Run detection and update evaluation**: `node --env-file=.env src/analyzing/eval/update-eval.ts` and `node --env-file=.env src/analyzing/eval/detection-eval.ts`.
3. **Qualification criteria**:
   - **Experimental Rule**: Active in `ALL_RULES`, available under `--experimental` / `--all-rules`.
   - **Qualified Rule**: Promoted to `QUALIFIED_GUIDE_IDS` for default terminal shipping once it meets Tier A, B, or C qualification criteria on the untuned `held-out` split.
