import path from 'node:path';
import { parseArgs } from 'node:util';
import { cBold, cCyan, cDim, cGreen, cRed, cYellow } from '../../core/colors.ts';
import { outDir as defaultOutRoot } from '../../core/paths.ts';
import { DEFAULT_ALLOWLIST_PATH, loadValidatedAllowlist } from './allowlist.ts';
import { buildSelectedSuites, buildSuite, PUBLIC_EVALS_DIR, writeManifest } from './builder.ts';
import type { BuildOptions, SuiteBuildResult } from './builder.ts';
import { forbiddenTokens } from './forbidden-tokens.ts';
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
 *   --force                  Rebuild suites even if build-state.json says they are unchanged.
 *
 * --all is incremental: suites whose raw evals.json and overrides have not changed since the
 * last build in <out> are left alone. Exit code is 1 only if the allowlist is invalid or the
 * manifest cannot be written; skipped suites are reported, not fatal.
 */

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      all: { type: 'boolean', default: false },
      suite: { type: 'string', multiple: true, default: [] },
      out: { type: 'string', default: defaultOutRoot },
      allowlist: { type: 'string', default: DEFAULT_ALLOWLIST_PATH },
      source: { type: 'string', default: 'gcs' },
      'forbidden-tokens': { type: 'string', default: '' },
      force: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help || (!values.all && values.suite.length === 0)) {
    console.log('Usage: build.ts (--all | --suite <id>...) [--out <dir>] [--allowlist <file>] [--source gcs|<dir>] [--forbidden-tokens a,b] [--force]');
    return values.help ? 0 : 1;
  }

  const options: BuildOptions = {
    store: values.source === 'gcs' ? new GcsSuiteStore() : new LocalSuiteStore(values.source),
    outDir: path.resolve(values.out),
    allowlist: loadValidatedAllowlist(values.allowlist),
    forbiddenTokens: forbiddenTokens(values['forbidden-tokens'].split(',')),
    force: values.force,
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
    writeManifest(options.outDir, results);
  }

  report(results, path.join(options.outDir, PUBLIC_EVALS_DIR));
  return 0;
}

function report(results: SuiteBuildResult[], publicDir: string): void {
  const byStatus = (status: SuiteBuildResult['status']) => results.filter(result => result.status === status);

  for (const result of byStatus('built')) {
    const mb = (result.bytes / (1024 * 1024)).toFixed(1);
    const note = result.truncatedPatches > 0 ? cYellow(` (${result.truncatedPatches} patch(es) over cap)`) : '';
    console.log(`${cGreen('built    ')} ${result.suiteId}  ${result.files} files, ${mb} MB${note}`);
  }
  for (const result of byStatus('removed')) {
    console.log(`${cYellow('removed  ')} ${result.suiteId}`);
  }
  for (const result of byStatus('skipped')) {
    console.log(`${cRed('skipped  ')} ${result.suiteId}  ${result.reason}`);
  }
  const unchanged = byStatus('unchanged').length;
  if (unchanged > 0) {
    console.log(cDim(`unchanged  ${unchanged} suite(s)`));
  }
  console.log(cBold(
    `\n${byStatus('built').length} built, ${unchanged} unchanged, ${byStatus('removed').length} removed, ${byStatus('skipped').length} skipped → ${cCyan(publicDir)}`,
  ));
}

main().then(
  code => process.exit(code),
  err => {
    console.error(cRed(err instanceof Error ? err.stack ?? err.message : String(err)));
    process.exit(1);
  },
);
