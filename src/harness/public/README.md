# Public evals: data contract

What the public builder publishes, where, and in what shape. This is the
interface any front-end (the current dashboard's `public` source, or the new
one) reads from. Nothing here requires authentication.

## Where

Everything lives under one directory on the same origin as the dashboard
(GitHub Pages, `gh-pages` branch):

```
public-evals/
  suites.gen.json                                  index of every published suite
  <suiteId>/
    evals.json                                     one suite's results
    <run>/<guide>/<task>/<guided|unguided>/
      agent.patch                                  code diff for that run (optional)
      modern-web.log                               guides the agent requested (optional)
```

- `<suiteId>` is the raw suite's folder name, e.g. `nightly-2026-10-20_20-43-48-codex_cli`.
- `<run>` is the 1-based run number; `<guide>`, `<task>`, and the mode come from the
  result key (see below). Example: `1/security/daily-grind/guided/agent.patch`.
- `suites.gen.json` is the only index. Do not list the directory.
- Fetch with plain relative URLs: `fetch('public-evals/suites.gen.json')`. Add a
  cache-buster (`?t=<now>`) to the manifest; GitHub Pages caches for ~10 min.

## `suites.gen.json`

An array, sorted by `testId`, one entry per published suite. Produced by
`src/dashboard/summary-extractor.js#extractSuiteSummary`, so it is the same
shape the private bucket's manifest has. Fields the landing page uses:

| field | type | notes |
|---|---|---|
| `testId` | string | suite id; also the folder name |
| `timestamp` | ISO string | when the suite ran |
| `agent` | string | `claude_code`, `codex_cli`, `antigravity_cli` only |
| `model` | string | only values on the allowlist's `releasedModels` |
| `serving` | string | always `unknown` publicly; the field is not published in `evals.json` |
| `taskCount`, `maxRuns` | number | |
| `guidedStats`, `unguidedStats` | `{ passed, total }` | assertion counts |
| `earlyFailureRate` | number | percent of runs that failed before grading |
| `guides` | `Record<guide, GuideSummary>` | per-guide pass counts, rates, uplift; `tasks` sub-map when a guide has several |
| `chartData` | object | precomputed series for the landing charts |

## `<suiteId>/evals.json`

Built fresh from an allowlist of fields; anything not listed below is never
present. Types match `src/harness/lib/metrics.ts`.

**Suite level**

| field | notes |
|---|---|
| `timestamp`, `agent`, `model`, `totalRuntime` | copied |
| `summary` | recomputed by `calculateMetrics` over the published runs only |
| `stats` | per-result-key `{ medianPassRate, runPassRates, passedChecks, totalChecks, ... }`, recomputed |
| `results` | `Record<resultKey, PublicRun[]>` |

A **result key** is `"<task> - <guide> - <guided|unguided>"`. Split on `" - "`;
the guide is always the middle part.

**Per run (`PublicRun`)**

| field | notes |
|---|---|
| `runNumber` | 1-based |
| `baseApp`, `taskName`, `guideName`, `prompt` | task metadata; `prompt` is the full task text, so no separate fetch is needed |
| `guidesUsed`, `retrievedGuides`, `fileReadGuides`, `guidanceToolsUsed`, `expectedToolPrefixes` | guide/tool usage lists |
| `runtime` | `{ agentRuntime?, graderRuntime? }` seconds |
| `tokenUsage` | `{ total, cached }` |
| `files` | which of `agent.patch`, `modern-web.log` exist for this run. **Use this; do not probe.** |
| `results` | `PublicCheck[]` |

**Per assertion (`PublicCheck`)**

| field | notes |
|---|---|
| `id`, `passed`, `message` | `message` is the assertion's title |
| `isEarlyFailure`, `failureReason` | present when the run died before grading |
| `error` | failing assertion's error text (failed checks only) |
| `errorLocation` | `guides/<guide>/grader.ts:<line>`, repo-relative |
| `pageSnapshot` | accessibility-tree text of the page at failure; can be several KB, render collapsed |
| `browserErrors` | console errors and failed requests captured during the check |

All strings have been path-scrubbed: anything that was under a home directory
or the repo checkout is now repo-relative or `~/...`.

## `agent.patch` and `modern-web.log`

- `agent.patch` is a `diff --git` unified patch. For runs that stored a built
  app instead of a patch, the builder generated a single-file diff of the
  task's target file against the base app. Patches over 1 MB are replaced by a
  one-line `# diff omitted: ...` placeholder. Lockfiles, `node_modules/`,
  `dist/`, `build/` hunks are removed.
- `modern-web.log` is plain text; lines are the guides the MWG server returned
  to the agent. Unguided runs usually have none.

## What is guaranteed absent

So nothing needs UI for it:

- agent trajectories (`session-*`, `chat_log.txt`)
- `agent_stderr.log`, `generation_failed.json`
- built app files, `grade-report/`, `<task>_results.json`, harness scripts
- `serving`, `skillVersion`, `cliVersion`, `targetFile`, `files` other than the two above
- any suite whose agent is not public or whose model is not released
- any guide listed in an `excludeGuides` override (its keys and artifacts are simply missing and `summary`/`stats` do not count it)

## Lifecycle

- A suite appears when it matches `src/dashboard/public-suites-allowlist.json`
  and the builder runs (scheduled job, or `gd promote --now`).
- A suite disappears when it is added to `exclude` (or no longer matches) and
  the builder runs again; its directory is removed and the manifest rewritten.
- Retention: `evals.json` and the manifest entry are kept indefinitely;
  `agent.patch` and `modern-web.log` are pruned after 90 days (then absent from
  `run.files`). The site stays under GitHub Pages' 1 GB cap.

## Developing against it offline

```bash
# Build a real public copy from the checked-in fixture (no credentials needed)
mkdir -p /tmp/store/nightly-2026-10-20_20-43-48-codex_cli
cp src/harness/public/fixtures/nightly-sample.evals.json /tmp/store/nightly-2026-10-20_20-43-48-codex_cli/evals.json
printf '{"include":["nightly-*"],"exclude":[],"overrides":[],"releasedModels":["example-model"]}' > /tmp/allowlist.json
pnpm build:public --all --source /tmp/store --allowlist /tmp/allowlist.json --out /tmp/pe
ls /tmp/pe/public-evals
```

For browser tests, `src/dashboard/public-view.spec.js` shows the pattern:
build with `buildSuite()` in `beforeAll`, serve `public-evals/**` from the
output with `page.route`, and block every Google host so a regression that
reaches the private bucket fails the test.
