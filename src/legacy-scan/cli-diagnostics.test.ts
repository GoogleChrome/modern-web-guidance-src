import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  formatHumanReadable,
  runLegacyScanCli,
  type ScanJsonOutput,
} from './cli.ts';

process.env.NO_COLOR = '1';

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'legacy-scan-diag-test-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('legacy-scan diagnostics (unsupported formats, parse errors, empty targets)', () => {
  it('reports 0 scannable files on an empty directory instead of claiming clean coverage', async () => {
    await withTempDir(async (emptyDir) => {
      const resEmpty = await runLegacyScanCli([emptyDir]);
      assert.equal(resEmpty.exitCode, 0);
      assert.match(
        resEmpty.output,
        new RegExp(`0 scannable files found in ${emptyDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`),
      );
      assert.doesNotMatch(resEmpty.output, /0 findings from \d+ qualified guides/);

      const resEmptyJson = await runLegacyScanCli([emptyDir, '--json']);
      assert.equal(resEmptyJson.exitCode, 0);
      const parsedEmpty = JSON.parse(resEmptyJson.output) as ScanJsonOutput;
      assert.equal(parsedEmpty.totalFindings, 0);
      assert.equal(parsedEmpty.scannedFileCount, 0);
      assert.deepEqual(parsedEmpty.guides, []);
      assert.equal(parsedEmpty.skippedUnsupportedFiles, undefined);
      assert.equal(parsedEmpty.parseErrorCount, undefined);
      assert.doesNotMatch(parsedEmpty.note ?? '', /No legacy patterns found/);
      assert.match(parsedEmpty.note ?? '', /0 scannable files found; checked 0 of/);
    });
  });

  it('reports skippedUnsupportedFiles on a single unsupported file path', async () => {
    await withTempDir(async (singleDir) => {
      const phtmlPath = join(singleDir, 'template.phtml');
      await writeFile(phtmlPath, '<form><input type="password"></form>\n', 'utf8');

      const singleJson = await runLegacyScanCli([phtmlPath, '--json']);
      assert.equal(singleJson.exitCode, 0);
      assert.equal(singleJson.data?.totalFindings, 0);
      assert.equal(singleJson.data?.scannedFileCount, 0);
      assert.deepEqual(singleJson.data?.skippedUnsupportedFiles, { '.phtml': 1 });
      assert.equal(singleJson.data?.parseErrorCount, undefined);
      assert.doesNotMatch(singleJson.data?.note ?? '', /No legacy patterns found/);
      assert.match(singleJson.data?.note ?? '', /Skipped 1 unsupported file \(\.phtml: 1\)\./);

      const singleHuman = await runLegacyScanCli([phtmlPath]);
      assert.equal(singleHuman.exitCode, 0);
      assert.match(singleHuman.output, /0 scannable files found in /);
      assert.match(singleHuman.output, /Skipped 1 unsupported file \(\.phtml: 1\)\./);
    });
  });

  it('counts skipped unsupported extensions across a repo while respecting ignored dirs', async () => {
    await withTempDir(async (unsupportedDir) => {
      await mkdir(join(unsupportedDir, 'views'), { recursive: true });
      await mkdir(join(unsupportedDir, 'node_modules', 'pkg'), { recursive: true });
      await mkdir(join(unsupportedDir, 'docs'), { recursive: true });

      await writeFile(join(unsupportedDir, 'views', 'clean.html'), '<p>ok</p>\n', 'utf8');
      for (let i = 1; i <= 5; i++) {
        await writeFile(join(unsupportedDir, 'views', `v${i}.phtml`), '<p>phtml</p>\n', 'utf8');
      }
      await writeFile(join(unsupportedDir, 'views', 'a.hbs'), '<p>hbs</p>\n', 'utf8');
      await writeFile(join(unsupportedDir, 'views', 'b.hbs'), '<p>hbs</p>\n', 'utf8');
      await writeFile(join(unsupportedDir, 'views', 'c.twig'), '<p>twig</p>\n', 'utf8');
      await writeFile(join(unsupportedDir, 'node_modules', 'pkg', 'ignored.twig'), '<p/>\n', 'utf8');
      await writeFile(join(unsupportedDir, 'docs', 'ignored.phtml'), '<p/>\n', 'utf8');
      await writeFile(join(unsupportedDir, 'README.md'), '# readme\n', 'utf8');
      await writeFile(join(unsupportedDir, 'logo.png'), 'png', 'utf8');

      const resJson = await runLegacyScanCli([unsupportedDir, '--json']);
      assert.equal(resJson.exitCode, 0);
      assert.equal(resJson.data?.totalFindings, 0);
      assert.equal(resJson.data?.scannedFileCount, 1);
      assert.deepEqual(resJson.data?.skippedUnsupportedFiles, {
        '.hbs': 2,
        '.phtml': 5,
        '.twig': 1,
      });
      assert.equal(resJson.data?.parseErrorCount, undefined);
      assert.doesNotMatch(resJson.data?.note ?? '', /No legacy patterns found/);
      assert.match(
        resJson.data?.note ?? '',
        /Skipped 8 unsupported files \(\.phtml: 5, \.hbs: 2, \.twig: 1\)\./,
      );

      const resHuman = await runLegacyScanCli([unsupportedDir]);
      assert.equal(resHuman.exitCode, 0);
      assert.match(resHuman.output, /0 findings in scanned subset across \d+ qualified guides\./);
      assert.match(
        resHuman.output,
        /Skipped 8 unsupported files \(\.phtml: 5, \.hbs: 2, \.twig: 1\)\./,
      );
    });
  });

  it('surfaces parseErrorCount alongside valid findings, unsupported files, and --max-files truncation', async () => {
    await withTempDir(async (parseDir) => {
      const unrecoverableCss = '.accordion-panel { max-height: 0; transition: max-height 0.3s;\n' + '{\n'.repeat(3000);
      await writeFile(join(parseDir, 'broken.css'), unrecoverableCss, 'utf8');
      await writeFile(join(parseDir, 'package.json'), '{ "dependencies": {', 'utf8');
      await writeFile(join(parseDir, 'view.phtml'), '<p>template</p>\n', 'utf8');
      await writeFile(
        join(parseDir, 'a-login.html'),
        '<form action="/login"><input type="password" name="pwd"></form>\n',
        'utf8',
      );
      await writeFile(
        join(parseDir, 'z-login.html'),
        '<form action="/login"><input type="password" name="pwd2"></form>\n',
        'utf8',
      );

      const fullJson = await runLegacyScanCli([parseDir, '--json']);
      assert.equal(fullJson.exitCode, 0);
      assert.equal(fullJson.data?.totalFindings, 2);
      assert.equal(fullJson.data?.parseErrorCount, 2);
      assert.deepEqual(fullJson.data?.skippedUnsupportedFiles, { '.phtml': 1 });
      assert.match(fullJson.data?.note ?? '', /Skipped 1 unsupported file \(\.phtml: 1\)\./);
      assert.match(
        fullJson.data?.note ?? '',
        /Encountered parse errors in 2 files \(affected blocks skipped\)\./,
      );
      assert.match(fullJson.data?.note ?? '', /reflects only the scanned subset/);

      const fullHuman = await runLegacyScanCli([parseDir]);
      assert.equal(fullHuman.exitCode, 0);
      assert.match(fullHuman.output, /Found 2 modernization opportunities/);
      assert.match(fullHuman.output, /Skipped 1 unsupported file \(\.phtml: 1\)\./);
      assert.match(
        fullHuman.output,
        /Encountered parse errors in 2 files \(affected blocks skipped\)\./,
      );

      // Combined with --max-files truncation (package.json + a-login.html + broken.css = 3 files; z-login.html unread)
      const truncJson = await runLegacyScanCli([parseDir, '--max-files', '3', '--json']);
      assert.equal(truncJson.exitCode, 0);
      assert.equal(truncJson.data?.truncatedByMaxFiles, true);
      assert.equal(truncJson.data?.parseErrorCount, 2);
      assert.deepEqual(truncJson.data?.skippedUnsupportedFiles, { '.phtml': 1 });
      assert.match(truncJson.data?.note ?? '', /Partial scan only: scanned 3 of 4 eligible files/);
      assert.match(truncJson.data?.note ?? '', /Skipped 1 unsupported file \(\.phtml: 1\)\./);
      assert.match(
        truncJson.data?.note ?? '',
        /Encountered parse errors in 2 files \(affected blocks skipped\)\./,
      );
    });
  });

  it('never claims "No legacy patterns found" when only a malformed package.json exists', async () => {
    await withTempDir(async (onlyParseErrDir) => {
      await writeFile(join(onlyParseErrDir, 'package.json'), '{ "dependencies": {', 'utf8');

      const resJson = await runLegacyScanCli([onlyParseErrDir, '--json']);
      assert.equal(resJson.exitCode, 0);
      assert.equal(resJson.data?.totalFindings, 0);
      assert.equal(resJson.data?.parseErrorCount, 1);
      assert.doesNotMatch(resJson.data?.note ?? '', /No legacy patterns found/);
      assert.match(
        resJson.data?.note ?? '',
        /Encountered parse errors in 1 file \(affected blocks skipped\)\./,
      );

      const resHuman = await runLegacyScanCli([onlyParseErrDir]);
      assert.equal(resHuman.exitCode, 0);
      assert.match(resHuman.output, /0 findings in scanned subset across \d+ qualified guides\./);
      assert.match(
        resHuman.output,
        /Encountered parse errors in 1 file \(affected blocks skipped\)\./,
      );
    });
  });

  it('formats large unsupported-file totals with commas consistent with per-extension counts', () => {
    const largeUnsupportedHuman = formatHumanReadable('/big-repo', 0, [], undefined, {
      activeGuideCount: 38,
      isDefaultQualifiedMode: true,
      color: false,
      stats: {
        scannedFileCount: 0,
        skippedUnsupportedFiles: { '.phtml': 1200 },
      },
    });
    assert.match(
      largeUnsupportedHuman,
      /Skipped 1,200 unsupported files \(\.phtml: 1,200\)\./,
    );
  });
});
