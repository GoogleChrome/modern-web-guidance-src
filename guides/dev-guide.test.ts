import test from 'node:test';
import assert from 'node:assert';
import { parsePassRates } from './lib/utils.ts';

test('parsePassRates parses multi-dimensional base-app scores correctly', () => {
  const output = `
Some generation logs...
Running agent test for target: daily-grind
=== Test Suite Starting with ID: size-aware-styling-daily-grind ===
...
Grading unguided...
  unguided: 1/4 checks passed (25%)
Grading guided...
  guided: 3/4 checks passed (75%)
Agent test results:
  Base app (zero-passrate): 0/4 checks passed (0%)
  Unguided:                 1/4 checks passed (25%)
  Guided:                   3/4 checks passed (75%)
  Guide impact:             +50% (vs unguided)
  Guides consumed:          [size-aware-styling, container-queries]

Running agent test for target: devtools-times
=== Test Suite Starting with ID: size-aware-styling-devtools-times ===
...
Grading unguided...
  unguided: 2/4 checks passed (50%)
Grading guided...
  guided: 4/4 checks passed (100%)
Agent test results:
  Base app (zero-passrate): 0/4 checks passed (0%)
  Unguided:                 2/4 checks passed (50%)
  Guided:                   4/4 checks passed (100%)
  Guide impact:             +50% (vs unguided)
  Guides consumed:          [size-aware-styling]
`;

  const parsed = parsePassRates(output);
  assert.deepStrictEqual(parsed, {
    'daily-grind': {
      unguided: '25',
      guided: '75',
      guidesConsumed: ['size-aware-styling', 'container-queries']
    },
    'devtools-times': {
      unguided: '50',
      guided: '100',
      guidesConsumed: ['size-aware-styling']
    }
  });
});

test('parsePassRates parses legacy single-page outputs correctly (fallback to demo)', () => {
  const output = `
Some generation logs...
=== Test Suite Starting with ID: legacy-same-document-transitions ===
...
Grading unguided...
  unguided: 0/4 checks passed (0%)
Grading guided...
  guided: 2/4 checks passed (50%)
Agent test results:
  Base app (zero-passrate): 0/4 checks passed (0%)
  Unguided:                 0/4 checks passed (0%)
  Guided:                   2/4 checks passed (50%)
  Guide impact:             +50% (vs unguided)
  Guides consumed:          [same-document-transitions]
`;

  const parsed = parsePassRates(output);
  assert.deepStrictEqual(parsed, {
    'demo': {
      unguided: '0',
      guided: '50',
      guidesConsumed: ['same-document-transitions']
    }
  });
});

test('setupGuideDevWorkDir conditionally copies credentials based on GD_DEV_USE_GEMINI', async (t) => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');
  const { setupGuideDevWorkDir } = await import('./lib/utils.ts');
  const { cleanupIsolatedHome } = await import('../harness/lib/agent-shared.ts');

  const originalHome = process.env.HOME;
  const originalGdUseGemini = process.env.GD_DEV_USE_GEMINI;
  const originalJetskiDir = process.env.JETSKI_DIR;

  const mockHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-home-'));
  const mockGemini = path.join(mockHome, '.gemini');
  const mockJetski = path.join(mockGemini, 'jetski');
  fs.mkdirSync(mockJetski, { recursive: true });

  fs.writeFileSync(path.join(mockGemini, 'oauth_creds.json'), '{"mock": "gemini"}');
  fs.writeFileSync(path.join(mockJetski, 'installation_id'), 'mock-jetski-id');

  process.env.HOME = mockHome;

  t.after(() => {
    process.env.HOME = originalHome;
    if (originalGdUseGemini === undefined) {
      delete process.env.GD_DEV_USE_GEMINI;
    } else {
      process.env.GD_DEV_USE_GEMINI = originalGdUseGemini;
    }
    if (originalJetskiDir === undefined) {
      delete process.env.JETSKI_DIR;
    } else {
      process.env.JETSKI_DIR = originalJetskiDir;
    }
    fs.rmSync(mockHome, { recursive: true, force: true });
  });

  // 1. Without GD_DEV_USE_GEMINI (default Jetski CLI mode)
  delete process.env.GD_DEV_USE_GEMINI;
  delete process.env.JETSKI_DIR;
  const jetskiWorkDir = setupGuideDevWorkDir('test-dev-jetski');
  const jetskiTempHome = path.dirname(jetskiWorkDir);

  assert.strictEqual(fs.existsSync(path.join(jetskiTempHome, '.gemini', 'oauth_creds.json')), false, 'Gemini credentials should not be copied');
  assert.ok(fs.existsSync(path.join(jetskiTempHome, '.gemini', 'jetski', 'installation_id')), 'Jetski credentials should be copied');
  assert.strictEqual(process.env.JETSKI_DIR, path.join(jetskiTempHome, '.gemini', 'jetski'), 'JETSKI_DIR should be set');

  cleanupIsolatedHome(jetskiTempHome);

  // Restore HOME to mockHome before second run
  process.env.HOME = mockHome;

  // 2. With GD_DEV_USE_GEMINI=1 (Gemini CLI mode)
  process.env.GD_DEV_USE_GEMINI = '1';
  delete process.env.JETSKI_DIR;
  const geminiWorkDir = setupGuideDevWorkDir('test-dev-gemini');
  const geminiTempHome = path.dirname(geminiWorkDir);

  assert.ok(fs.existsSync(path.join(geminiTempHome, '.gemini', 'oauth_creds.json')), 'Gemini credentials should be copied');
  assert.strictEqual(fs.existsSync(path.join(geminiTempHome, '.gemini', 'jetski', 'installation_id')), false, 'Jetski credentials should not be copied');
  assert.strictEqual(process.env.JETSKI_DIR, undefined, 'JETSKI_DIR should not be set');

  cleanupIsolatedHome(geminiTempHome);
});

test('collectPlaywrightErrors correctly parses nested suites, deduplicates errors, and ignores passing tests', async () => {
  const { collectPlaywrightErrors } = await import('./run-grader.ts');

  const mockReport = {
    suites: [
      {
        title: 'Root Suite',
        suites: [
          {
            title: 'Nested Suite',
            specs: [
              {
                title: 'Passing Spec',
                ok: true,
                tests: [{ results: [{ status: 'passed' }] }]
              },
              {
                title: 'Failing Spec 1',
                ok: false,
                tests: [
                  {
                    results: [
                      {
                        status: 'failed',
                        error: { message: 'Expected foo but received bar', stack: 'at line 10' },
                        errors: [{ message: 'Expected foo but received bar', stack: 'at line 10' }]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  const parsed = collectPlaywrightErrors(mockReport);
  assert.strictEqual(parsed, 'Test: Root Suite > Nested Suite > Failing Spec 1\nError: Expected foo but received bar\nStack: at line 10');

  // Verify graceful handling of null/empty results
  assert.strictEqual(collectPlaywrightErrors(null), '');
  assert.strictEqual(collectPlaywrightErrors({}), '');
});

test('exciseOldEvalArtifacts removes tasks folder, grader.ts, and negative-demo.html when they exist while keeping demo.html', async (t) => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');
  const { exciseOldEvalArtifacts } = await import('./dev-guide.ts');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-dev-excision-test-'));

  t.after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Create old artifacts
  const tasksDir = path.join(tmpDir, 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, 'task.md'), '# Task');
  fs.writeFileSync(path.join(tmpDir, 'grader.ts'), 'export const grader = true;');
  fs.writeFileSync(path.join(tmpDir, 'demo.html'), '<html><body>Demo</body></html>');
  fs.writeFileSync(path.join(tmpDir, 'negative-demo.html'), '<html><body>Negative Demo</body></html>');

  // Create non-old artifacts that should NOT be excised
  fs.writeFileSync(path.join(tmpDir, 'guide.md'), '# Guide');
  fs.writeFileSync(path.join(tmpDir, 'expectations.md'), '# Expectations');

  // Run excision
  exciseOldEvalArtifacts(tmpDir);

  // Assert old artifacts were deleted
  assert.strictEqual(fs.existsSync(tasksDir), false, 'tasks directory should be excised');
  assert.strictEqual(fs.existsSync(path.join(tmpDir, 'grader.ts')), false, 'grader.ts should be excised');
  assert.strictEqual(fs.existsSync(path.join(tmpDir, 'negative-demo.html')), false, 'negative-demo.html should be excised');

  // Assert demo.html and non-old artifacts remain intact
  assert.strictEqual(fs.existsSync(path.join(tmpDir, 'demo.html')), true, 'demo.html should remain intact');
  assert.strictEqual(fs.existsSync(path.join(tmpDir, 'guide.md')), true, 'guide.md should remain');
  assert.strictEqual(fs.existsSync(path.join(tmpDir, 'expectations.md')), true, 'expectations.md should remain');
});

test('exciseOldEvalArtifacts handles directory when old artifacts do not exist', async (t) => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');
  const { exciseOldEvalArtifacts } = await import('./dev-guide.ts');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-dev-excision-empty-test-'));

  t.after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  fs.writeFileSync(path.join(tmpDir, 'guide.md'), '# Guide');

  // Should not throw
  assert.doesNotThrow(() => {
    exciseOldEvalArtifacts(tmpDir);
  });

  assert.strictEqual(fs.existsSync(path.join(tmpDir, 'guide.md')), true);
});


