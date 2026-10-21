import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { cBold, cCyan, cGreen, cRed, cYellow } from '../../core/colors.ts';
import { dashboardDir, outDir as defaultOutRoot } from '../../core/paths.ts';
import { loadAllowlist, validateAllowlistPolicy } from './allowlist.ts';
import { buildSelectedSuites, buildSuite, PUBLIC_EVALS_DIR, writeManifest } from './builder.ts';
import type { BuildOptions, SuiteBuildResult } from './builder.ts';
import { GcsSuiteStore, LocalSuiteStore } from './suite-store.ts';

/**
 * CLI: build the public copy of eval suites.
 *
 *   node src/harness/public/build.ts --all
 *   node src/harness/public/build.ts --suite <id> [--suite <id>...]
 *
 * Options:
 *   --out <dir>              Output root (default: out/). Suites land in <out>/public-evals/.
 *   --allowlist <file>       Allowlist JSON (default: src/dashboard/public-suites-allowlist.json).
 *   --source <gcs|dir>       Read from the bucket (default) or a local directory laid out like it.
 *   --forbidden-tokens a,b   Extra tokens that must not appear in output. Also read from
 *                            PUBLIC_EVALS_FORBIDDEN_TOKENS. The current OS user is always added.
 *
 * Exit code is 1 only if the manifest cannot be written; skipped suites are reported, not fatal.
 */

const DEFAULT_ALLOWLIST = path.join(dashboardDir, 'public-suites-allowlist.json');

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      all: { type: 'boolean', default: false },
      suite: { type: 'string', multiple: true, default: [] },
      out: { type: 'string', default: defaultOutRoot },
      allowlist: { type: 'string', default: DEFAULT_ALLOWLIST },
      source: { type: 'string', default: 'gcs' },
      'forbidden-tokens': { type: 'string', default: '' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help || (!values.all && values.suite.length === 0)) {
    console.log('Usage: build.ts (--all | --suite <id>...) [--out <dir>] [--allowlist <file>] [--source gcs|<dir>] [--forbidden-tokens a,b]');
    return values.help ? 0 : 1;
  }

  const allowlist = loadAllowlist(values.allowlist);
  const problems = validateAllowlistPolicy(allowlist);
  if (problems.length > 0) {
    console.error(cRed(`Refusing to build: ${values.allowlist} violates allowlist policy`));
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    return 1;
  }

  const options: BuildOptions = {
    store: values.source === 'gcs' ? new GcsSuiteStore() : new LocalSuiteStore(values.source),
    outDir: path.resolve(values.out),
    allowlist,
    forbiddenTokens: forbiddenTokens(values['forbidden-tokens']),
  };

  if (options.allowlist.releasedModels.length === 0) {
    console.warn(cYellow('releasedModels is empty in the allowlist; every suite will be skipped.'));
  }

  let results: SuiteBuildResult[];
  if (values.all) {
    results = await buildSelectedSuites(options);
  } else {
    results = [];
    for (const suiteId of values.suite) {
      results.push(await buildSuite(suiteId, options));
    }
    writeManifest(options.outDir);
  }

  report(results, path.join(options.outDir, PUBLIC_EVALS_DIR));
  return 0;
}

/** Tokens from the flag, the environment, and the current OS user (who is very likely a suite operator). */
function forbiddenTokens(flagValue: string): string[] {
  const fromFlag = flagValue.split(',');
  const fromEnv = (process.env['PUBLIC_EVALS_FORBIDDEN_TOKENS'] ?? '').split(',');
  const user = os.userInfo().username;
  return [...fromFlag, ...fromEnv, user].map(token => token.trim()).filter(token => token.length >= 3);
}

function report(results: SuiteBuildResult[], publicDir: string): void {
  const built = results.filter(result => result.status === 'built');
  const skipped = results.filter(result => result.status === 'skipped');

  for (const result of built) {
    const mb = (result.bytes / (1024 * 1024)).toFixed(1);
    const note = result.truncatedPatches > 0 ? cYellow(` (${result.truncatedPatches} patch(es) over cap)`) : '';
    console.log(`${cGreen('built  ')} ${result.suiteId}  ${result.files} files, ${mb} MB${note}`);
  }
  for (const result of skipped) {
    console.log(`${cRed('skipped')} ${result.suiteId}  ${result.reason}`);
  }
  console.log(cBold(`\n${built.length} built, ${skipped.length} skipped → ${cCyan(publicDir)}`));
}

main().then(
  code => process.exit(code),
  err => {
    console.error(cRed(err instanceof Error ? err.stack ?? err.message : String(err)));
    process.exit(1);
  },
);
