import { cBold, cCyan, cDim, cGreen, cRed, cYellow } from '../../core/colors.ts';
import type { JobBuildResult } from './builder.ts';

/** Prints one line per job outcome plus a totals line; shared by the build and publish CLIs. */
export function reportResults(results: JobBuildResult[], publicDir: string): void {
  const byStatus = (status: JobBuildResult['status']) => results.filter(result => result.status === status);
  // Reasons may quote the very string that was rejected; CI logs are retained and widely readable.
  const why = (result: JobBuildResult) => (process.env['CI'] ? '' : `: ${result.reason}`);

  for (const result of byStatus('built')) {
    const mb = (result.bytes / (1024 * 1024)).toFixed(1);
    const note = result.truncatedPatches > 0 ? cYellow(` (${result.truncatedPatches} patch(es) over cap)`) : '';
    console.log(`${cGreen('built    ')} ${result.jobId}  ${result.files} files, ${mb} MB${note}`);
  }
  for (const result of byStatus('removed')) {
    console.log(`${cYellow('removed  ')} ${result.jobId}`);
  }
  for (const result of byStatus('skipped')) {
    console.log(`${cRed('skipped  ')} ${result.jobId}  ${result.code}${why(result)}`);
  }
  for (const result of byStatus('failed')) {
    console.log(`${cRed('FAILED   ')} ${result.jobId}${why(result)}  (will retry next build)`);
  }
  const unchanged = byStatus('unchanged').length;
  if (unchanged > 0) {
    console.log(cDim(`unchanged  ${unchanged} job(s)`));
  }
  const failed = byStatus('failed').length;
  console.log(cBold(
    `\n${byStatus('built').length} built, ${unchanged} unchanged, ${byStatus('removed').length} removed, ${byStatus('skipped').length} skipped${failed ? `, ${failed} FAILED` : ''} → ${cCyan(publicDir)}`,
  ));
}
