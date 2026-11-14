import { spawnSync } from 'node:child_process';

// Resolve the reporter in Node so the test command also works in Windows shells.
const result = spawnSync(process.execPath, [
  '--test',
  '--test-reporter', process.env.TEST_REPORTER || 'dot',
  ...process.argv.slice(2),
], { stdio: 'inherit' });

if (result.error) console.error(result.error);
process.exitCode = result.status ?? 1;
