import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { EvalsReport } from '../../lib/metrics.ts';
import { CLOUDTOP_HOST, REPO_CHECKOUT } from './leak-samples.ts';

/**
 * A bucket-shaped temp directory built from the checked-in sample nightly, for
 * tests that run the real builder without credentials. Shared by the harness
 * unit tests and the dashboard e2e spec so both exercise the same shape.
 */

export const FIXTURE_SUITE = 'nightly-2026-10-20_20-43-48-codex_cli';
export const FIXTURE_MODEL = 'example-model';
/** A target-based run that carries a captured `agent.patch`. */
export const SECURITY_RUN = '1/security/daily-grind/guided';
/** A legacy-layout run that stored the built app; the builder generates its diff. */
export const PASSKEY_RUN = '1/passkey-authentication/task/guided';

const FIXTURE_EVALS = path.join(import.meta.dirname, 'nightly-sample.evals.json');

export interface FixtureStore {
  /** Pass to `new LocalSuiteStore(root)`. */
  root: string;
  /** Pass as `baseAppsDir`; contains `daily-grind/index.html`. */
  baseApps: string;
}

/**
 * Creates the store. Besides the sample suite it contains a same-shaped suite
 * with an unreleased model and a non-nightly suite, so selection and gating
 * have something to reject.
 */
export function makeFixtureStore(): FixtureStore {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'public-evals-store-'));
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_EVALS, 'utf8')) as EvalsReport;

  const suite = path.join(root, FIXTURE_SUITE);
  write(path.join(suite, 'evals.json'), JSON.stringify(fixture));
  write(
    path.join(suite, SECURITY_RUN, 'agent.patch'),
    'diff --git a/src/app.ts b/src/app.ts\n--- a/src/app.ts\n+++ b/src/app.ts\n@@ -0,0 +1 @@\n+ok\n' +
      'diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml\n--- a/pnpm-lock.yaml\n+++ b/pnpm-lock.yaml\n@@ -0,0 +1 @@\n+lock\n',
  );
  write(path.join(suite, SECURITY_RUN, 'modern-web.log'), `GET /guides/security from ${REPO_CHECKOUT}/guides\n`);
  write(path.join(suite, SECURITY_RUN, 'agent_stderr.log'), `at ${CLOUDTOP_HOST}: secret\n`);
  write(path.join(suite, SECURITY_RUN, 'session-1.html'), '<html>trajectory</html>');
  write(path.join(suite, PASSKEY_RUN, 'index.html'), '<p>agent version</p>\n');
  write(path.join(suite, PASSKEY_RUN, 'modern-web.log'), 'GET /guides/passkeys\n');

  const unreleased = path.join(root, 'nightly-2026-10-21_00-00-00-claude_code');
  write(path.join(unreleased, 'evals.json'), JSON.stringify({ ...fixture, agent: 'claude_code', model: 'secret-model' }));

  const adhoc = path.join(root, 'test-2026-07-30T13-02-05');
  write(path.join(adhoc, 'evals.json'), JSON.stringify(fixture));

  const baseApps = fs.mkdtempSync(path.join(os.tmpdir(), 'public-evals-base-apps-'));
  write(path.join(baseApps, 'daily-grind', 'index.html'), '<p>base version</p>\n');
  return { root, baseApps };
}

export function write(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}
