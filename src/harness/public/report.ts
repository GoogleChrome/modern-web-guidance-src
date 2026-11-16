import { cBold, cCyan, cDim, cGreen, cRed, cYellow } from '../../core/colors.ts';
import type { SuiteBuildResult } from './builder.ts';

/** Prints one line per suite outcome plus a totals line; shared by the build and publish CLIs. */
export function reportResults(results: SuiteBuildResult[], publicDir: string): void {
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
