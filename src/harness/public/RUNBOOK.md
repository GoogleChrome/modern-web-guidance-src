# Public evals: operator runbook

How to change what the public dashboard shows, and how to try a change
locally first. For the shape of the published data see [README.md](./README.md).

## How it fits together

```
src/harness/public/allowlist.json  ──►  pnpm public:publish  ──►  public-evals/  ──►  dashboard
        (policy, in repo)               (reads the bucket)        (on gh-pages)      (reads files)
```

- `allowlist.json` on `main` is the single source of truth. The dashboard never
  reads it; nothing changes on the live site until `pnpm public:publish` runs.
- `pnpm public:publish` is the only thing that pushes `public-evals/` to
  `gh-pages`. The nightly run (`src/harness/nightly/run-guidance-nightly.sh`)
  calls it after the agents finish when its checkout is a clean `main` in sync
  with `origin/main`; run it by hand to apply an allowlist change sooner.
- `releasedModels: []` means **nothing publishes**. Every job is skipped as
  `unreleased-model` until a model is listed.
- Every allowlist change goes through a pull request (`CODEOWNERS` enforces
  review). There is no fast path around review.

## Common tasks

Every change is an edit to `src/harness/public/allowlist.json` in a pull
request. After it merges, the next `pnpm public:publish` run applies it.

| I want to… | Do |
|---|---|
| Release a model | Add it to `releasedModels` |
| Publish a job the patterns do not cover | Add its exact id to `include` |
| Hide a whole job | Add its id to `exclude` |
| Hide one guide inside a job | Add `{ "id": "<suite-id>", "excludeGuides": ["<guide>"] }` to `overrides` (one entry per job; list several guides in it) |
| Restore a hidden job or guide | Remove the `exclude` entry or the override |
| Keep the site small | Set `retention.maxSuitesPerAgent` / `retention.maxSuites` / `retention.maxAgeDays` |

## Publishing

Run from the repo root on a checkout of `main`, with gcloud credentials for
the bucket, a git identity (`user.name` / `user.email`, as the `gh-pages`
commit needs an author; a CI runner will have to set one), and GitHub CLI (`gh`)
authenticated (`gh auth login` with `workflow` scope) to dispatch the Actions
Pages deployment:

```bash
pnpm public:publish               # build, push gh-pages, and dispatch deployment
pnpm public:publish --dry-run     # build and report only
pnpm public:publish --no-dispatch # push gh-pages without dispatching deploy
```

Usernames are scrubbed from two sources: the names the builder harvests from
each job's own paths, plus your OS user. To add more (other operators whose
runs are in the bucket), set `PUBLIC_EVALS_FORBIDDEN_TOKENS=alice,bob`; in CI,
where the OS user is just `runner`, that variable is required.

It checks out the published `public-evals/` from `gh-pages`, rebuilds it from
the checked-out allowlist (incrementally, so an unchanged site costs one
listing call), prints the per-job summary, and pushes. It refuses to push
when `PUBLIC_EVALS_FORBIDDEN_TOKENS` is malformed, when `gh-pages` moved while
it was building, or when any job FAILED (transient storage error): fix the
cause and rerun. The publisher does not check which branch is checked out, so
run it from `main` or the site will reflect a local allowlist.

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
| add `{ "id": …, "excludeGuides": ["webmcp"] }` to `overrides` | that job `built` again; no `*/webmcp/` folder; `grep -c webmcp …/evals.json` → 0 |
| an unknown guide in `excludeGuides` | job `skipped  override: …` and removed (fail closed) |
| empty `releasedModels` | every job `skipped  unreleased-model`, published ones removed |
| `retention.maxSuites: 1` | oldest job `removed` |
| `include: ["*"]` | refused: wildcards must start with `nightly-` |
| an unknown key | refused by the schema |
| rerun with no edit | all `unchanged`, about two seconds |

To see it in the dashboard, build into `out/` instead (`--out out`), run
`pnpm dashboard`, and open `http://localhost:3000/?source=public`. Afterwards
`git checkout src/harness/public/allowlist.json` if you touched it.

## Reading the build output

| Line | Meaning |
|---|---|
| `built` | job written (files, size, truncated patches) |
| `unchanged` | inputs identical to last build; nothing fetched |
| `removed` | no longer selected (exclude, pattern, retention); directory deleted |
| `skipped  <code>: <reason>` | policy rejection; remembered, retried only when the relevant input changes. Codes: `unreleased-model`, `non-public-agent`, `no-evals`, `leak`, `override`, `suite-id`. Under `CI` only the code is printed, since a reason may quote what was rejected |
| `FAILED` | transient error (storage, parse); previously published copy kept and still listed; retried next run; exit code 1 (and `public:publish` does not push) |

`--force` rebuilds every selected job regardless of state.

## Environment

| Variable | Purpose |
|---|---|
| `PUBLIC_EVALS_FORBIDDEN_TOKENS` | extra operator LDAPs that must not appear in output, beyond the OS user and the names harvested from each job; required in CI |
| `PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION` | non-negative integer; bump after changing the list so published jobs are rescanned |
| `CI` | when set, the OS user is not added to the token list |

## Where things live

| Path | What |
|---|---|
| `src/harness/public/allowlist.json` | the policy |
| `src/harness/public/allowlist.schema.json` | its schema |
| `src/harness/public/build.ts` | `pnpm public:build` |
| `src/harness/public/publish-cli.ts` | `pnpm public:publish` |
| `gh-pages:/public-evals/` | the published copy |
| `out/public-evals/` | local build output (gitignored) |
