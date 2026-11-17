# Public evals: data contract

What the public builder publishes, where, and in what shape. This is the
interface any front-end reads from. Nothing here requires authentication. For
how to change what is published, see [RUNBOOK.md](./RUNBOOK.md).

## Where

Everything lives under one directory on the same origin as the dashboard
(GitHub Pages, `gh-pages` branch):

```
public-evals/
  suites.gen.json                                  index of every published job
  build-state.json                                 builder bookkeeping; front-ends ignore it
  <suiteId>/
    evals.json                                     one job's results
    artifacts.json                                 every trial's agent.patch and modern-web.log
```

- `<suiteId>` is the raw job's folder name, e.g. `nightly-2026-10-20_20-43-48-codex_cli`.
- `artifacts.json` is one JSON object per job mapping
  `<trial>/<guide>/<task>/<guided|unguided>/<file>` to that file's text. `<trial>` is
  the 1-based trial number; `<guide>`, `<task>`, and the condition come from the result
  key (see below). Example key: `1/security/daily-grind/guided/agent.patch`.
  It is one file rather than one per artifact because a job has about 600
  artifacts, and the number of published files is the suspected cause of slow
  Pages deploys. The text is JSON-escaped, so parse the file before searching
  it for a string.
- `suites.gen.json` is the only index. Do not list the directory.
- `build-state.json` lets the next build skip jobs whose inputs have not
  changed. It holds job ids, bucket generations, excluded guide names,
  machine-readable skip codes, and, for published and deferred jobs, their
  agent and model (both already public in `evals.json`); a job skipped for an
  unreleased model records the released-model list it was judged against, never
  its own model. No error text either: it is published too, and could quote what
  was rejected.
- Fetch with plain relative URLs: `fetch('public-evals/suites.gen.json')`. Add a
  10-minute bucketed cache-buster (`?t=<Math.floor(Date.now() / 600_000)>`) to
  every `public-evals/` fetch except `artifacts.json`; GitHub Pages caches for
  ~10 min, and bucketing keeps repeat fetches within the same session cacheable.
  Fetch `artifacts.json` without one: it is the largest file, and a changing URL
  would download it again where a plain one is revalidated.

## `suites.gen.json`

An array, sorted by `testId`, one entry per published job. Produced by
`src/dashboard/summary-extractor.js#extractSuiteSummary`, so it is the same
shape the private bucket's manifest has. Fields the landing page uses:

| field | type | notes |
|---|---|---|
| `testId` | string | job id; also the folder name |
| `timestamp` | ISO string | when the job ran |
| `agent` | string | `claude_code`, `codex_cli`, `antigravity_cli` only |
| `model` | string | only values on the allowlist's `releasedModels` |
| `reasoningEffort` | object | optional `{ level?: string, source: 'observed' \| 'configured' \| 'model-id' \| 'agent-default' }`; omitted on legacy jobs without it |
| `serving` | string | always `unknown` publicly; the field is not published in `evals.json` |
| `taskCount`, `maxRuns` | number | |
| `guidedStats`, `unguidedStats` | `{ passed, total }` | check counts |
| `earlyFailureRate` | number | percent of trials with infra errors before grading |
| `guides` | `Record<guide, GuideSummary>` | per-guide pass counts, rates, uplift; `tasks` sub-map when a guide has several |
| `chartData` | object | precomputed series for the landing charts |

## `<suiteId>/evals.json`

Built fresh from an allowlist of fields; anything not listed below is never
present. Types match `src/harness/lib/metrics.ts`.

**Job level**

| field | notes |
|---|---|
| `timestamp`, `agent`, `model`, `totalRuntime` | copied |
| `reasoningEffort` | optional `{ level?: string, source: 'observed' \| 'configured' \| 'model-id' \| 'agent-default' }`; copied when valid (omitted on older jobs without it) |
| `summary` | recomputed by `calculateMetrics` over the published trials only |
| `stats` | per-result-key `{ medianPassRate, runPassRates, passedChecks, totalChecks, ... }`, recomputed |
| `results` | `Record<resultKey, PublicTrial[]>` |

A **result key** is `"<task> - <guide> - <guided|unguided>"`. Split on `" - "`;
the guide is always the middle part.

**Per trial (`PublicTrial`)**

| field | notes |
|---|---|
| `runNumber` | 1-based |
| `baseApp`, `taskName`, `guideName`, `prompt` | task metadata; `prompt` is the full task text, so no separate fetch is needed |
| `discipline` | guide category (`security`, `visual-design`, …); the job page groups charts by it |
| `guidesUsed`, `retrievedGuides`, `fileReadGuides`, `guidanceToolsUsed`, `expectedToolPrefixes` | guide/tool usage lists |
| `runtime` | `{ agentRuntime?, graderRuntime? }` milliseconds |
| `tokenUsage` | `{ total, cached }` |
| `files` | which of `agent.patch`, `modern-web.log` exist for this trial in `artifacts.json`. **Use this; do not probe.** |
| `results` | `PublicCheck[]` |

**Per check (`PublicCheck`)**

| field | notes |
|---|---|
| `id`, `passed`, `message` | `message` is the check's title |
| `isEarlyFailure`, `failureReason` | present when the trial died before grading |
| `error` | failing check's error text (failed checks only) |
| `errorLocation` | `guides/<discipline>/<guide>/targets/<task>/grader.ts:<line>` (or `guides/<discipline>/<guide>/grader.ts:<line>`), repo-relative |
| `pageSnapshot` | accessibility-tree text of the page at failure; can be several KB, render collapsed |
| `browserErrors` | console errors and failed requests captured during the check |

All strings have been path-scrubbed: anything that was under a home directory
or the repo checkout is now repo-relative or `~/...`.

## `agent.patch` and `modern-web.log`

Both are values in the job's `artifacts.json`, not files of their own.

- `agent.patch` is a `diff --git` unified patch. For trials that stored a built
  app instead of a patch, the builder generated a single-file diff of the
  task's target file against the base app. Patches over 1 MB are replaced by a
  one-line `# diff omitted: ...` placeholder. Lockfiles, `node_modules/`, root
  `dist/`/`build/`/`.next/`, `.env*` files, `*.pem`/`*.key` files, and root
  `.claude/`/`.codex/`/`.gemini/`/`.antigravity/` hunks are removed.
- `modern-web.log` is plain text; lines are the guides the MWG server returned
  to the agent. Unguided trials usually have none.

## What is guaranteed absent

So nothing needs UI for it:

- agent trajectories (`session-*`, `chat_log.txt`)
- `agent_stderr.log`, `generation_failed.json`
- built app files, `grade-report/`, `<task>_results.json`, harness scripts
- `serving`, `skillVersion`, `cliVersion`, `targetFile`, `files` other than the two above
- any job whose agent is not public or whose model is not released
- any guide listed in an `excludeGuides` override (its keys and artifacts are simply missing and `summary`/`stats` do not count it)

## Lifecycle

- `src/harness/public/allowlist.json` on `main` is the single source of truth.
  A job appears when it matches the allowlist and `pnpm public:publish` runs;
  it disappears when it is added to `exclude` (or no longer matches) and the
  publisher runs again: its directory is removed and the manifest rewritten.
- `pnpm public:publish` is the only publisher to `gh-pages`. It is stateless:
  it checks out what is published, rebuilds from the checked-in allowlist, and
  pushes.
- Retention (`retention.maxAgeDays`, `retention.maxSuitesPerAgent`, and
  `retention.maxSuites` in the allowlist) drops whole jobs, oldest first by
  the timestamp in the job id, to keep the site under GitHub Pages' 1 GB cap.
  The caps count jobs that pass the agent/model gate, so unreleased jobs do
  not use up slots; the per-agent cap is applied first so an agent whose
  recent jobs are unreleased is not aged out by the others. A published job
  whose gate check fails transiently keeps its retention slot so an older job
  is not churned in and out.
- Builds are incremental: a job is rebuilt only when its raw `evals.json`
  changes, its override changes, its own model is released or un-released, the
  builder's field lists or scrub patterns change, the builder's
  `OUTPUT_REVISION` is bumped (as it is for a change of output layout), or
  `PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION` is bumped. Releasing an additional
  model only builds the jobs that were waiting on it. Changes to summary
  extraction or accessibility classification (`summary-extractor.js`,
  `a11y-classifier.js`, `showcase-config.js`, `utils.js`) re-extract
  `suites.gen.json` directly from the local `public-evals/<suiteId>/evals.json`
  copies without re-downloading raw jobs. `--force` rebuilds
  everything. A job whose build hit a transient error keeps its previously
  published copy and is retried next run.

## Environment

| variable | purpose |
|---|---|
| `PUBLIC_EVALS_FORBIDDEN_TOKENS` | comma-separated operator LDAPs that must not appear in output, beyond the OS user and the names harvested from each job's paths; required when `CI` is set |
| `PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION` | non-negative integer; bump after changing the list so already-built jobs are rescanned |
| `CI` | when set, the OS user is not added to the token list (on a runner it is just `runner`), and skip/failure reasons are not printed (only codes), since they may quote what was rejected |

## Developing against it offline

```bash
# Build a real public copy from the checked-in fixture (no credentials needed)
mkdir -p /tmp/store/nightly-2026-10-20_20-43-48-codex_cli
cp src/harness/public/fixtures/nightly-sample.evals.json /tmp/store/nightly-2026-10-20_20-43-48-codex_cli/evals.json
printf '{"include":["nightly-*"],"exclude":[],"overrides":[],"releasedModels":["example-model"]}' > /tmp/allowlist.json
pnpm public:build --all --source /tmp/store --allowlist /tmp/allowlist.json --out /tmp/pe
ls /tmp/pe/public-evals
```

The fixture store above has only `evals.json`, so the build writes `evals.json`
and an empty `artifacts.json` per job. Add `<trial>/<guide>/<task>/<condition>/agent.patch`
and `modern-web.log` under the job folder to see per-trial artifacts come through. `--suite <id>` builds a
single job (skipping retention and state updates), provided the allowlist
selects it.
The dev server (`pnpm dashboard`) serves `out/public-evals/` at `/public-evals/`,
so a build into `out/` shows up in the signed-out dashboard; nothing under
`src/dashboard/` is ever read for it.

For browser tests, `src/dashboard/public-view.spec.js` shows the pattern:
build with `buildJob()` in `beforeAll`, serve `public-evals/**` from the
output with `page.route`, and block every Google host so a regression that
reaches the private bucket fails the test.
