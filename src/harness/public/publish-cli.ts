import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { cBold, cRed, cYellow } from '../../core/colors.ts';
import { outDir as defaultOutRoot } from '../../core/paths.ts';
import { loadValidatedAllowlist } from './allowlist.ts';
import { buildSelectedSuites, PUBLIC_EVALS_DIR } from './builder.ts';
import type { SuiteBuildResult } from './builder.ts';
import { forbiddenTokens, forbiddenTokensVersion } from './forbidden-tokens.ts';
import { checkoutPublished, originRemoteUrl, publishPublicEvals, repoFromRemoteUrl } from './publish.ts';
import { reportResults } from './report.ts';
import { GcsSuiteStore } from './suite-store.ts';

/**
 * CLI: publish the public copy of eval suites to `gh-pages` and dispatch the
 * Pages deployment workflow on `main`.
 *
 *   node src/harness/public/publish-cli.ts [--dry-run] [--force] [--no-dispatch]
 *
 * Stateless: checks out what is currently published, rebuilds it from the
 * checked-in allowlist (incrementally, via the published `build-state.json`),
 * pushes the result to `gh-pages`, and dispatches `deploy-pages.yml` on `main`.
 * `--dry-run` builds and reports without pushing; `--force` rebuilds every
 * suite even when `build-state.json` says it is unchanged; `--no-dispatch`
 * pushes to `gh-pages` without dispatching the Actions deployment workflow.
 * Nothing is published if any suite failed. Operator names come from
 * `PUBLIC_EVALS_FORBIDDEN_TOKENS` when set (required in CI); locally the OS
 * user and the usernames harvested from each suite's own paths cover the
 * common case.
 */

/** Dispatches the GitHub Pages deployment workflow (`deploy-pages.yml`) on `main`. Fails loudly on error. */
function dispatchPagesDeployment(repo: string): void {
  console.log(cBold(`dispatching Pages deployment workflow for ${repo}...`));
  const res = spawnSync('gh', ['workflow', 'run', 'deploy-pages.yml', '-R', repo, '--ref', 'main'], {
    stdio: 'inherit',
    encoding: 'utf8',
  });
  if (res.error) {
    throw new Error(`failed to dispatch Pages deployment workflow on ${repo}: ${res.error.message}`, { cause: res.error });
  }
  if (res.status !== 0) {
    throw new Error(`failed to dispatch Pages deployment workflow on ${repo}: gh exited with code ${res.status}`);
  }
  console.log(cBold('dispatched deploy-pages.yml on main'));
}

/** Throws when any result is `failed`, so a transient error never publishes a partial site. */
function assertNoFailures(results: readonly SuiteBuildResult[]): void {
  const failed = results.filter(result => result.status === 'failed').map(result => result.suiteId);
  if (failed.length > 0) {
    throw new Error(`${failed.length} suite(s) failed to build; nothing published: ${failed.join(', ')}`);
  }
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      dispatch: { type: 'boolean', default: true },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log('Usage: publish-cli.ts [--dry-run] [--force] [--no-dispatch]');
    return 0;
  }

  const tokens = forbiddenTokens([], process.env);
  const tokensVersion = forbiddenTokensVersion();
  const allowlist = loadValidatedAllowlist();
  if (allowlist.releasedModels.length === 0) {
    console.warn(cYellow('releasedModels is empty in the allowlist; every suite will be skipped.'));
  }

  fs.mkdirSync(defaultOutRoot, { recursive: true });
  const outDir = fs.mkdtempSync(path.join(defaultOutRoot, 'public-evals-publish-'));
  try {
    const expectedHead = checkoutPublished(outDir);
    const results = await buildSelectedSuites({
      store: new GcsSuiteStore(),
      outDir,
      allowlist,
      forbiddenTokens: tokens,
      forbiddenTokensVersion: tokensVersion,
      force: values.force,
    });
    reportResults(results, path.join(outDir, PUBLIC_EVALS_DIR));
    assertNoFailures(results);
    if (values['dry-run']) {
      console.log(cBold('dry run: not publishing'));
      return 0;
    }
    const published = await publishPublicEvals(outDir, { message: 'public-evals: publish', expectedHead });
    if (published) {
      console.log(cBold('published public-evals to gh-pages'));
      if (values.dispatch) {
        const repo = repoFromRemoteUrl(originRemoteUrl());
        dispatchPagesDeployment(repo);
      }
    } else {
      console.log(cBold('public-evals on gh-pages already matches; no push needed'));
    }
    return 0;
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

main().then(
  code => process.exit(code),
  err => {
    console.error(cRed(err instanceof Error ? err.stack ?? err.message : String(err)));
    process.exit(1);
  },
);
