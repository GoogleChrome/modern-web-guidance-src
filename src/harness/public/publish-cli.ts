import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { cBold, cRed, cYellow } from '../../core/colors.ts';
import { outDir as defaultOutRoot } from '../../core/paths.ts';
import { loadValidatedAllowlist } from './allowlist.ts';
import { buildSelectedSuites, PUBLIC_EVALS_DIR } from './builder.ts';
import type { SuiteBuildResult } from './builder.ts';
import { forbiddenTokens, forbiddenTokensVersion } from './forbidden-tokens.ts';
import { checkoutPublished, publishPublicEvals } from './publish.ts';
import { reportResults } from './report.ts';
import { GcsSuiteStore } from './suite-store.ts';

/**
 * CLI: publish the public copy of eval suites to `gh-pages`.
 *
 *   node src/harness/public/publish-cli.ts [--dry-run]
 *
 * Stateless: checks out what is currently published, rebuilds it from the
 * checked-in allowlist (incrementally, via the published `build-state.json`),
 * and pushes the result. `--dry-run` builds and reports without pushing.
 * Nothing is published if any suite failed. Operator names come from
 * `PUBLIC_EVALS_FORBIDDEN_TOKENS` when set (required in CI); locally the OS
 * user and the usernames harvested from each suite's own paths cover the
 * common case.
 */

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
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log('Usage: publish-cli.ts [--dry-run]');
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
    });
    reportResults(results, path.join(outDir, PUBLIC_EVALS_DIR));
    assertNoFailures(results);
    if (values['dry-run']) {
      console.log(cBold('dry run: not publishing'));
      return 0;
    }
    await publishPublicEvals(outDir, { message: 'public-evals: publish', expectedHead });
    console.log(cBold('published public-evals to gh-pages'));
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
