import path from 'node:path';
import { parseArgs } from 'node:util';
import { cBold, cCyan, cDim, cGreen, cRed, cYellow } from '../../core/colors.ts';
import { outDir as defaultOutRoot } from '../../core/paths.ts';
import { DEFAULT_ALLOWLIST_PATH, loadValidatedAllowlist, selectSuites } from './allowlist.ts';
import type { PendingChange } from './allowlist.ts';
import {
  buildSelectedSuites,
  buildSuite,
  effectiveAllowlist,
  pendingChanges,
  PUBLIC_EVALS_DIR,
  writeManifest,
} from './builder.ts';
import type { BuildOptions, SuiteBuildResult } from './builder.ts';
import { forbiddenTokens, forbiddenTokensVersion } from './forbidden-tokens.ts';
import { GcsSuiteStore, LocalSuiteStore } from './suite-store.ts';

/**
 * CLI: build the public copy of eval suites.
 *
 *   node src/harness/public/build.ts --all
 *   node src/harness/public/build.ts --suite <id> [--suite <id>...]   (each must be selected by the allowlist)
 *
 * Options:
 *   --out <dir>              Output root (default: out/). Suites land in <out>/public-evals/.
 *   --allowlist <file>       Allowlist JSON (default: src/harness/public/allowlist.json).
 *   --source <gcs|dir>       Read from the bucket (default) or a local directory laid out like it.
 *   --forbidden-tokens a,b   Extra tokens that must not appear in output. Also read from
 *                            PUBLIC_EVALS_FORBIDDEN_TOKENS (required when CI is set). Outside
 *                            CI the current OS user is added too.
 *   --force                  Rebuild suites even if build-state.json says they are unchanged.
 *
 * --all is incremental: suites whose raw evals.json and overrides have not changed since the
 * last build in <out> are left alone. Skipped suites (policy) are reported and remembered;
 * failed suites (transient errors) are reported, retried next run, and make the exit code 1.
 */

function reportExpired(expired: readonly PendingChange[]): void {
  for (const change of expired) {
    const scope = change.guides.length > 0 ? `${change.suiteId} (${change.guides.join(', ')})` : change.suiteId;
    console.warn(cYellow(`expired   ${change.command} ${scope}  (created ${change.createdAt}; dropped in favour of allowlist)`));
  }
}

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
    forbiddenTokensVersion: forbiddenTokensVersion(),
    force: values.force,
    onExpiredPending: reportExpired,
  };

  if (options.allowlist.releasedModels.length === 0) {
    console.warn(cYellow('releasedModels is empty in the allowlist; every suite will be skipped.'));
  }

  let results: SuiteBuildResult[];
  if (values.all) {
    results = await buildSelectedSuites(options);
  } else {
    const layered = effectiveAllowlist(options.allowlist, options.outDir);
    reportExpired(layered.expired);
    const suiteOptions: BuildOptions = { ...options, allowlist: layered.allowlist };
    const selected = new Set(selectSuites(suiteOptions.allowlist, values.suite));
    const unselected = values.suite.filter(suiteId => !selected.has(suiteId));
    if (unselected.length > 0) {
      throw new Error(`${unselected.join(', ')}: not selected by the allowlist; use --all or edit the allowlist`);
    }
    results = [];
    for (const suiteId of values.suite) {
      results.push(await buildSuite(suiteId, suiteOptions));
    }
    writeManifest(options.outDir, results, suiteOptions.forbiddenTokens);
  }

  report(results, path.join(options.outDir, PUBLIC_EVALS_DIR));
  for (const change of pendingChanges(options.outDir)) {
    const scope = change.guides.length > 0 ? `${change.suiteId} (${change.guides.join(', ')})` : change.suiteId;
    console.log(cYellow(`pending   ${change.command} ${scope}  (applied until the allowlist reflects it)`));
  }
  return results.some(result => result.status === 'failed') ? 1 : 0;
}

function report(results: SuiteBuildResult[], publicDir: string): void {
  const byStatus = (status: SuiteBuildResult['status']) => results.filter(result => result.status === status);
  // Reasons may quote the very string that was rejected; CI logs are retained and widely readable.
  const why = (result: SuiteBuildResult) => (process.env['CI'] ? '' : `: ${result.reason}`);

  for (const result of byStatus('built')) {
    const mb = (result.bytes / (1024 * 1024)).toFixed(1);
    const note = result.truncatedPatches > 0 ? cYellow(` (${result.truncatedPatches} patch(es) over cap)`) : '';
    console.log(`${cGreen('built    ')} ${result.suiteId}  ${result.files} files, ${mb} MB${note}`);
  }
  for (const result of byStatus('removed')) {
    console.log(`${cYellow('removed  ')} ${result.suiteId}`);
  }
  for (const result of byStatus('skipped')) {
    console.log(`${cRed('skipped  ')} ${result.suiteId}  ${result.code}${why(result)}`);
  }
  for (const result of byStatus('failed')) {
    console.log(`${cRed('FAILED   ')} ${result.suiteId}${why(result)}  (will retry next run)`);
  }
  const unchanged = byStatus('unchanged').length;
  if (unchanged > 0) {
    console.log(cDim(`unchanged  ${unchanged} suite(s)`));
  }
  const failed = byStatus('failed').length;
  console.log(cBold(
    `\n${byStatus('built').length} built, ${unchanged} unchanged, ${byStatus('removed').length} removed, ${byStatus('skipped').length} skipped${failed ? `, ${failed} FAILED` : ''} → ${cCyan(publicDir)}`,
  ));
}

main().then(
  code => process.exit(code),
  err => {
    console.error(cRed(err instanceof Error ? err.stack ?? err.message : String(err)));
    process.exit(1);
  },
);
