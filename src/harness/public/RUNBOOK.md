# Public evals: operator runbook

How to change what the public dashboard shows, and how to try a change
locally first. For the shape of the published data see [README.md](./README.md).

## How it fits together

```
allowlist.json  ──►  pnpm build:public  ──►  public-evals/  ──►  dashboard
 (policy, in repo)    (reads the bucket)      (on gh-pages)      (reads files)
```

- The dashboard never reads the allowlist. Nothing changes on the site until
  the builder runs: the scheduled job, or `--now`.
- `releasedModels: []` means **nothing publishes**. Every suite is skipped as
  `unreleased-model` until a model is listed.
- Every allowlist change goes through a pull request (`CODEOWNERS` enforces
  review), even when `--now` already updated the site.

## Common tasks

Run from the repo root. `gd` is `node bin/gd.ts` (or `gd` after `pnpm link --global`).

| I want to… | Do |
|---|---|
| Release a model | Edit `releasedModels` in `src/dashboard/public-suites-allowlist.json`, open a PR |
| Publish a suite the patterns do not cover | `gd promote <suite-id>` |
| Hide a whole suite | `gd unpublish <suite-id>` |
| Hide one guide inside a suite | `gd unpublish <suite-id> --guide <guide>` (repeatable) |
| Restore a hidden suite or guide | `gd promote <suite-id>` (clears the exclude and any override) |
| Take something down **right now** | `gd unpublish <suite-id> --now` (see below) |
| Keep the site small | Set `retention.maxSuites` / `retention.maxAgeDays` |

`gd promote` / `gd unpublish` edit the allowlist, commit it on a new branch,
push, and open a PR with `gh`. Flags:

| Flag | Effect |
|---|---|
| `--dry-run` | print the edit; write nothing |
| `--no-pr` | edit the file in place; no branch, commit, push, or PR |
| `--now` | also rebuild and push `gh-pages` immediately with your gcloud credentials |

> Run these from `main` with a clean tree. From a feature branch the PR would
> carry the whole branch; with other uncommitted changes the command refuses.

## `--now`: emergency takedown and fast publish

`--now` needs `PUBLIC_EVALS_FORBIDDEN_TOKENS` set to the comma-separated LDAPs
of everyone who runs suites, the same list the scheduled job uses.

```bash
PUBLIC_EVALS_FORBIDDEN_TOKENS=alice,bob gd unpublish nightly-2026-10-23_00-00-10-codex_cli --now
```

What happens: allowlist edited and PR opened as usual, then the current
`public-evals/` is checked out from `gh-pages`, the change is recorded as
*pending* in `build-state.json`, the builder runs against the checked-in
allowlist plus that pending change, and the result is pushed. The suite is
gone within a minute.

The pending record is what stops the scheduled job (still on the old
allowlist) from bringing the suite back before the PR merges. It clears
itself once the merged allowlist reflects the change. To undo a `--now`
whose PR was abandoned, run the opposite command with `--now`.

## Trying a change locally

Never test against the real allowlist file; use a scratch copy and a scratch
output directory. Needs gcloud credentials for the bucket.

```bash
cp src/dashboard/public-suites-allowlist.json /tmp/al.json
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

To see it in the dashboard, build into `out/` instead (`--out out`) and run
`pnpm dashboard`; open an incognito window for the public view. Afterwards
`git checkout src/dashboard/public-suites-allowlist.json` if you touched it.

## Reading the build output

| Line | Meaning |
|---|---|
| `built` | suite written (files, size, truncated patches) |
| `unchanged` | inputs identical to last build; nothing fetched |
| `removed` | no longer selected (exclude, pattern, retention, pending change); directory deleted |
| `skipped  <code>: <reason>` | policy rejection; remembered, retried only when the relevant input changes. Codes: `unreleased-model`, `non-public-agent`, `no-evals`, `leak`, `override`, `suite-id` |
| `FAILED` | transient error (storage, parse); previously published copy kept; retried next run; exit code 1 |
| `pending` | a `--now` change still being applied on top of the allowlist |

`--force` rebuilds every selected suite regardless of state.

## Environment

| Variable | Purpose |
|---|---|
| `PUBLIC_EVALS_FORBIDDEN_TOKENS` | operator LDAPs that must not appear in output; required in CI and for `--now` |
| `PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION` | bump after changing the list so published suites are rescanned |
| `CI` | when set, the OS user is not added to the token list |

## Where things live

| Path | What |
|---|---|
| `src/dashboard/public-suites-allowlist.json` | the policy |
| `src/dashboard/public-suites-allowlist.schema.json` | its schema |
| `src/harness/public/build.ts` | `pnpm build:public` |
| `src/harness/public/promote.ts` | `gd promote` / `gd unpublish` |
| `gh-pages:/public-evals/` | the published copy |
| `out/public-evals/` | local build output (gitignored) |
