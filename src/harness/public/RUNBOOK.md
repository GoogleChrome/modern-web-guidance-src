# Public evals: operator runbook

How to change what the public dashboard shows, and how to try a change
locally first. For the shape of the published data see [README.md](./README.md).

## How it fits together

```
src/harness/public/allowlist.json  ──►  pnpm public:build  ──►  public-evals/  ──►  dashboard
        (policy, in repo)               (reads the bucket)      (on gh-pages)      (reads files)
```

- The dashboard never reads the allowlist. Nothing changes on the live site
  until a build is published to `gh-pages`.
- **No scheduled CI job exists yet.** Until that workflow lands, `--now` (`gd promote --now` /
  `gd unpublish --now`) is the only thing that pushes `public-evals/` to `gh-pages`.
- `releasedModels: []` means **nothing publishes**. Every suite is skipped as
  `unreleased-model` until a model is listed.
- Every allowlist change goes through a pull request (`CODEOWNERS` enforces
  review), even when `--now` already updated the site.

## Common tasks

Run from the repo root with `PUBLIC_EVALS_FORBIDDEN_TOKENS` set to the
comma-separated LDAPs of everyone who runs suites. `gd` is `node bin/gd.ts`
(or `gd` after `pnpm link --global`).

| I want to… | Do |
|---|---|
| Release a model | Edit `releasedModels` in `src/harness/public/allowlist.json`, open a PR |
| Publish a suite the patterns do not cover | `gd promote <suite-id>` (add `--now` to publish immediately) |
| Hide a whole suite | `gd unpublish <suite-id>` (add `--now` to take down immediately) |
| Hide one guide inside a suite | `gd unpublish <suite-id> --guide <guide>` (repeatable) |
| Restore a hidden suite or guide | `gd promote <suite-id>` (clears the exclude and any override) |
| Take something down **right now** | `gd unpublish <suite-id> --now` (see below) |
| Keep the site small | Set `retention.maxSuites` / `retention.maxAgeDays` |

`gd promote` / `gd unpublish` compute the allowlist edit from `origin/main`,
commit it on a new branch, push, open a PR with `gh`, and switch back to your
starting ref. Flags:

| Flag | Effect |
|---|---|
| `--dry-run` | print the edit against the local allowlist; write nothing |
| `--no-pr` | edit the local allowlist in place; no branch, commit, push, or PR. Cannot be combined with `--now` |
| `--now` | also rebuild and push `gh-pages` immediately with your gcloud credentials |

> PR modes require a completely clean working tree with `HEAD` at `origin/main`
> (`git fetch origin main && git checkout main && git pull --ff-only`).

## `--now`: emergency takedown and fast publish

`--now` requires `PUBLIC_EVALS_FORBIDDEN_TOKENS` (and, once suites are
published, `PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION` matching the live site):

```bash
PUBLIC_EVALS_FORBIDDEN_TOKENS=alice,bob gd unpublish nightly-2026-10-23_00-00-10-codex_cli --now
```

What happens: all preconditions below are checked first, the checked-out
`public-evals/` from `gh-pages` records the change as *pending* in
`build-state.json`, and the builder runs and validates the site outcome against
the allowlist on **`origin/main`** plus active pending changes — all before any
branch or PR is created. Once the build succeeds, the allowlist PR is opened
from `origin/main` (reusing an existing open PR on retry) and the result is
pushed to `gh-pages`.

`--now` refuses, before touching anything, when:

- `PUBLIC_EVALS_FORBIDDEN_TOKENS` is unset or contains a malformed token;
- `--no-pr` is also given (a site change always gets a PR);
- the working tree has any uncommitted changes, or `HEAD` is not at `origin/main`
  (so neither unreviewed code nor local allowlist edits can reach the site);
- it is `promote --now` for a suite that `origin/main` lists in `exclude`: that
  takedown was reviewed, so it is undone by merging the PR first;
- `PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION` differs from the version recorded in
  the published `build-state.json` (when non-empty);
- `gh-pages` cannot be reached.

If any suite fails to build (transient storage error), nothing is pushed; fix
the cause and rerun.

### Pending-change lifecycle

- Pending entries carry `createdAt` and **expire after 7 days** if their PR was
  closed or left unmerged; after expiry the reviewed allowlist on `origin/main`
  wins again.
- Multiple guide-level takedowns (`--guide a --now`, then `--guide b --now`)
  merge their guide lists rather than overwriting each other; a whole-suite
  `unpublish --now` supersedes guide-level ones.
- Once the allowlist PR merges to `main`, the next build sees the change is
  already reflected and drops the pending record automatically. To undo an
  `unpublish --now` whose PR was abandoned before merging, run `promote --now`.

## Trying a change locally

Never test against the real allowlist file; use a scratch copy and a scratch
output directory. Needs gcloud credentials for the bucket.

```bash
cp src/harness/public/allowlist.json /tmp/al.json
# edit /tmp/al.json: add a model to releasedModels, set retention.maxSuites to 2

node src/harness/public/build.ts --all --out /tmp/al-out --allowlist /tmp/al.json
ls /tmp/al-out/public-evals
```

Edit `/tmp/al.json`, rerun, and watch the summary line:

| Change | Expect |
|---|---|
| add an id to `exclude` | `1 removed`, directory gone, manifest shorter |
| remove it again | `1 built` |
| add `{ "id": …, "excludeGuides": ["webmcp"] }` to `overrides` | that suite `built` again; no `*/webmcp/` folder; `grep -c webmcp …/evals.json` → 0 |
| an unknown guide in `excludeGuides` | suite `skipped  override: …` and removed (fail closed) |
| empty `releasedModels` | every suite `skipped  unreleased-model`, published ones removed |
| `retention.maxSuites: 1` | oldest suite `removed` |
| `include: ["*"]` | refused: wildcards must start with `nightly-` |
| an unknown key | refused by the schema |
| rerun with no edit | all `unchanged`, about two seconds |

To see it in the dashboard, build into `out/` instead (`--out out`), run
`pnpm dashboard`, and open `http://localhost:3000/?source=public`. Afterwards
`git checkout src/harness/public/allowlist.json` if you touched it.

## Reading the build output

| Line | Meaning |
|---|---|
| `built` | suite written (files, size, truncated patches) |
| `unchanged` | inputs identical to last build; nothing fetched |
| `removed` | no longer selected (exclude, pattern, retention, pending change); directory deleted |
| `skipped  <code>: <reason>` | policy rejection; remembered, retried only when the relevant input changes. Codes: `unreleased-model`, `non-public-agent`, `no-evals`, `leak`, `override`, `suite-id`. Under `CI` only the code is printed, since a reason may quote what was rejected |
| `FAILED` | transient error (storage, parse); previously published copy kept and still listed; retried next run; exit code 1 |
| `pending` | an active `--now` change still being applied on top of the allowlist |
| `expired` | a `--now` change older than 7 days dropped in favour of the allowlist |

`--force` rebuilds every selected suite regardless of state.

## Environment

| Variable | Purpose |
|---|---|
| `PUBLIC_EVALS_FORBIDDEN_TOKENS` | operator LDAPs that must not appear in output; required in CI and for all `gd promote` / `gd unpublish` calls |
| `PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION` | non-negative integer; bump after changing the list so published suites are rescanned (`--now` requires matching the live site) |
| `CI` | when set, the OS user is not added to the token list |

## Where things live

| Path | What |
|---|---|
| `src/harness/public/allowlist.json` | the policy |
| `src/harness/public/allowlist.schema.json` | its schema |
| `src/harness/public/build.ts` | `pnpm public:build` |
| `src/harness/public/promote.ts` | `gd promote` / `gd unpublish` |
| `gh-pages:/public-evals/` | the published copy |
| `out/public-evals/` | local build output (gitignored) |
