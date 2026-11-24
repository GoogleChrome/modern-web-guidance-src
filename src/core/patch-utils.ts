import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createTwoFilesPatch } from 'diff';
import { gitExec } from './git-utils.ts';

const MAX_BUFFER = 50 * 1024 * 1024; // 50MB buffer to handle large diffs/assets

const EXCLUDED_FILES_RE = /(?:^|\/)(?:node_modules\/|dist\/|(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|guide\.md|expectations\.md|task\.md|pnpm-workspace\.yaml)$)/;

const EXCLUDED_PATCH_PATHSPECS = [
  ':(exclude)node_modules',
  ':(exclude)**/node_modules',
  ':(exclude)dist',
  ':(exclude)**/dist',
  ':(exclude)package-lock.json',
  ':(exclude)**/package-lock.json',
  ':(exclude)pnpm-lock.yaml',
  ':(exclude)**/pnpm-lock.yaml',
  ':(exclude)yarn.lock',
  ':(exclude)**/yarn.lock',
  ':(exclude)bun.lockb',
  ':(exclude)**/bun.lockb',
  ':(exclude)bun.lock',
  ':(exclude)**/bun.lock',
  ':(exclude)guide.md',
  ':(exclude)**/guide.md',
  ':(exclude)expectations.md',
  ':(exclude)**/expectations.md',
  ':(exclude)task.md',
  ':(exclude)**/task.md',
  ':(exclude)pnpm-workspace.yaml',
  ':(exclude)**/pnpm-workspace.yaml',
];

const HUNK_HEADER_RE = /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/;
const BINARY_FILES_RE = /^Binary files (?:.*) and (.*) differ$/;

/** Lines that may follow a `--- `/`+++ ` pair; anything else means the pair was hunk content. */
const HEADER_FOLLOWUP_RE =
  /^(?:@@ |index |new file mode |deleted file mode |old mode |new mode |similarity index |rename |copy |Binary files |GIT binary patch|diff --git )/;

/**
 * Decodes a git `core.quotePath`-quoted path (`"b/\351\241\265.md"`) back to a raw path.
 * Escapes are C-style; `\NNN` sequences are octal bytes, so multi-byte UTF-8 survives.
 */
function decodeGitQuotedPath(quoted: string): string {
  const inner = quoted.slice(1, -1);
  const bytes: number[] = [];
  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    if (char !== '\\') {
      bytes.push(...Buffer.from(char, 'utf8'));
      continue;
    }
    const escape = inner[++i];
    switch (escape) {
      case 'a': bytes.push(0x07); break;
      case 'b': bytes.push(0x08); break;
      case 't': bytes.push(0x09); break;
      case 'n': bytes.push(0x0a); break;
      case 'v': bytes.push(0x0b); break;
      case 'f': bytes.push(0x0c); break;
      case 'r': bytes.push(0x0d); break;
      case '"': bytes.push(0x22); break;
      case '\\': bytes.push(0x5c); break;
      default: {
        if (escape !== undefined && escape >= '0' && escape <= '7') {
          let octal = escape;
          while (octal.length < 3 && inner[i + 1] !== undefined && inner[i + 1] >= '0' && inner[i + 1] <= '7') {
            octal += inner[++i];
          }
          bytes.push(parseInt(octal, 8) & 0xff);
        } else {
          bytes.push(...Buffer.from(`\\${escape ?? ''}`, 'utf8'));
        }
      }
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

/** Removes a leading `a/` or `b/` marker from a diff path. */
function stripDiffMarker(rawPath: string): string {
  return rawPath.replace(/^[ab]\//, '');
}

/**
 * Parses the path out of a diff header payload (the text after `--- ` / `+++ `),
 * handling git-quoted paths and the optional `\t<timestamp>` suffix that `diff -u` adds.
 */
function parseDiffPath(payload: string): string {
  const trimmed = payload.trim();
  if (trimmed.startsWith('"')) {
    let end = 1;
    while (end < trimmed.length) {
      if (trimmed[end] === '\\') {
        end += 2;
        continue;
      }
      if (trimmed[end] === '"') break;
      end++;
    }
    return stripDiffMarker(decodeGitQuotedPath(trimmed.slice(0, end + 1)));
  }
  const tabIndex = trimmed.indexOf('\t');
  const pathPart = tabIndex === -1 ? trimmed : trimmed.slice(0, tabIndex);
  return stripDiffMarker(pathPart.trim());
}

/**
 * Parses the target path out of a `diff --git <old> <new>` line.
 *
 * Git writes both sides of the same path and only quotes non-ASCII paths, so `\t` is not a
 * separator here (`a/my file.txt b/my file.txt` is a real header). Prefer the symmetric
 * `a/<p> b/<p>` reading, then fall back to the last ` b/` split.
 */
function parseDiffGitTarget(payload: string): string | null {
  const quoted = /^("(?:[^"\\]|\\.)*") ("(?:[^"\\]|\\.)*")$/.exec(payload);
  if (quoted) {
    return parseDiffPath(quoted[2]);
  }

  if (payload.startsWith('a/')) {
    const remainder = payload.slice(2);
    // `a/<p> b/<p>` — the two halves must name the same path.
    const symmetric = /^(.*?) b\/(.*)$/.exec(remainder);
    if (symmetric && symmetric[1] === symmetric[2]) {
      return stripDiffMarker(symmetric[1]);
    }
    const lastSplit = remainder.lastIndexOf(' b/');
    if (lastSplit !== -1) {
      return stripDiffMarker(remainder.slice(lastSplit + 3));
    }
  }

  const halves = payload.split(' ');
  return halves.length >= 2 ? parseDiffPath(halves[halves.length - 1] ?? '') : null;
}

/**
 * Extracts target modified file paths from a unified diff.
 *
 * Paths come from `+++` headers, plus the `diff --git` declaration for changes that emit no text
 * header at all — binary additions (PNG/wasm via `GIT binary patch` or `Binary files … differ`) and
 * empty new files (`new file mode` with only an `index` line).
 *
 * A `--- `/`+++ ` pair is only read as a header when it is immediately followed by a hunk header or
 * a git extended header. Hunk bodies legitimately contain added lines that begin with `+++` (or
 * removed lines beginning with `---`), so position alone is not enough.
 *
 * Ignores deleted files (/dev/null), package manager lockfiles, and authoring metadata files.
 */
export function extractTargetFilesFromPatch(patchPath: string): string[] {
  try {
    if (!fs.existsSync(patchPath)) return [];
    const content = fs.readFileSync(patchPath, 'utf8');

    const found: string[] = [];
    const seen = new Set<string>();
    const add = (rawPath: string | null): void => {
      if (!rawPath || rawPath === '/dev/null' || EXCLUDED_FILES_RE.test(rawPath) || seen.has(rawPath)) {
        return;
      }
      seen.add(rawPath);
      found.push(rawPath);
    };

    const lines = content.split('\n').map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));

    let sectionTarget: string | null = null;
    let sectionHasTextBox = false;
    let sectionHasBinary = false;
    let sectionAddsFile = false;

    const closeSection = (): void => {
      // Changes without a text header still touched a real file.
      if (!sectionHasTextBox && (sectionHasBinary || sectionAddsFile) && sectionTarget) {
        add(sectionTarget);
      }
      sectionTarget = null;
      sectionHasTextBox = false;
      sectionHasBinary = false;
      sectionAddsFile = false;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';

      if (line.startsWith('diff --git ')) {
        closeSection();
        sectionTarget = parseDiffGitTarget(line.slice('diff --git '.length));
        continue;
      }

      // A file header is a `--- ` line immediately followed by `+++ ` and then a real diff body.
      if (line.startsWith('--- ') && (lines[i + 1] ?? '').startsWith('+++ ')) {
        const after = lines[i + 2] ?? '';
        const isPair = after === '' || HUNK_HEADER_RE.test(after) || HEADER_FOLLOWUP_RE.test(after);
        if (isPair) {
          sectionHasTextBox = true;
          add(parseDiffPath((lines[i + 1] ?? '').slice(4)));
          i++;
          continue;
        }
      }

      if (line.startsWith('GIT binary patch')) {
        sectionHasBinary = true;
        continue;
      }

      if (line.startsWith('new file mode ')) {
        sectionAddsFile = true;
        continue;
      }

      const binaryFiles = BINARY_FILES_RE.exec(line);
      if (binaryFiles) {
        sectionHasBinary = true;
        add(parseDiffPath(binaryFiles[1]));
      }
    }

    closeSection();
    return found;
  } catch (e) {
    console.warn(`Failed to extract target files from patch ${patchPath}: ${e}`);
    return [];
  }
}

export interface PatchResult {
  success: boolean;
  error?: string;
}

function extractExecErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const stderr = 'stderr' in err && err.stderr != null ? String(err.stderr).trim() : '';
    if (stderr) return stderr;
    const stdout = 'stdout' in err && err.stdout != null ? String(err.stdout).trim() : '';
    if (stdout) return stdout;
    if ('message' in err && typeof err.message === 'string' && err.message.trim()) {
      return err.message.trim();
    }
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * Synchronously applies a unified diff patch file to a target directory.
 * Tries git apply first, falling back to standard patch -p1.
 */
export function applyPatchSync(targetDir: string, patchPath: string): PatchResult {
  const absPatchPath = path.resolve(patchPath);
  const absTargetDir = path.resolve(targetDir);
  if (!fs.existsSync(absPatchPath)) {
    return { success: false, error: `Patch file not found: ${absPatchPath}` };
  }
  if (!fs.existsSync(absTargetDir)) {
    return { success: false, error: `Target directory not found: ${absTargetDir}` };
  }

  try {
    gitExec(['apply', '--whitespace=nowarn', '--unsafe-paths', absPatchPath], {
      cwd: absTargetDir,
      isolated: true,
      stdio: 'pipe',
      maxBuffer: MAX_BUFFER,
      // Don't let git discover an enclosing repo (e.g. results/ inside the checkout). There, it reads
      // `diff --git` paths as relative to that repo's root, skips them all, and still exits 0.
      env: { GIT_CEILING_DIRECTORIES: path.dirname(fs.realpathSync(absTargetDir)) },
    });
    return { success: true };
  } catch (gitErr: unknown) {
    const gitMsg = extractExecErrorMessage(gitErr);
    // patch(1) cannot apply GIT binary diffs and leaves partial text hunks behind on failure.
    if (/^GIT binary patch$/m.test(fs.readFileSync(absPatchPath, 'utf8'))) {
      return { success: false, error: gitMsg ? `git apply: ${gitMsg}` : 'Unknown error applying patch' };
    }
    try {
      execFileSync('patch', ['-p1', '--no-backup-if-mismatch', '-i', absPatchPath], {
        cwd: absTargetDir,
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: MAX_BUFFER,
        env: { ...process.env, LC_ALL: 'C' },
      });
      return { success: true };
    } catch (patchErr: unknown) {
      const patchMsg = extractExecErrorMessage(patchErr);
      const errorMsg = [gitMsg ? `git apply: ${gitMsg}` : '', patchMsg ? `patch: ${patchMsg}` : '']
        .filter(Boolean)
        .join('\n');
      return { success: false, error: errorMsg || 'Unknown error applying patch' };
    }
  }
}

/**
 * Captures git modifications (both tracked changes and untracked new files) from a working directory
 * into a relative patch file, excluding package manager lockfiles.
 */
export function capturePatchFromGit(
  workDir: string,
  destPatchPath: string,
  relativeSubdir?: string
): { success: boolean; diff: string } {
  try {
    const targetPath = relativeSubdir || '.';

    // Stage untracked files with intent-to-add so git diff includes them (excluding build/dep dirs)
    gitExec(['add', '-N', '--ignore-removal', '--', targetPath, ...EXCLUDED_PATCH_PATHSPECS], {
      cwd: workDir,
      isolated: true,
      stdio: 'ignore',
    });

    // Diff against the initial root commit to include any commits made by the agent
    const rootCommit = gitExec(['rev-list', '--max-parents=0', 'HEAD'], {
      cwd: workDir,
      isolated: true,
      maxBuffer: MAX_BUFFER,
    }).trim();
    const diff = gitExec(
      [
        'diff',
        rootCommit,
        ...(relativeSubdir ? [`--relative=${relativeSubdir}`] : []),
        '--',
        targetPath,
        ...EXCLUDED_PATCH_PATHSPECS,
      ],
      { cwd: workDir, isolated: true, maxBuffer: MAX_BUFFER }
    );

    if (!diff.trim()) {
      return { success: false, diff: '' };
    }

    fs.mkdirSync(path.dirname(destPatchPath), { recursive: true });
    fs.writeFileSync(destPatchPath, diff);
    return { success: true, diff };
  } catch (err: any) {
    console.warn(`Failed to capture patch from git in ${workDir}: ${err?.message || err}`);
    return { success: false, diff: '' };
  }
}

/**
 * Initializes a clean git repository in the target directory with an initial commit.
 * Required so git diff / capturePatchFromGit can track modified and new files.
 */
export function initGitRepo(workDir: string): void {
  try {
    const opts = { cwd: workDir, isolated: true, stdio: 'ignore' as const };
    gitExec(['init', '-q'], opts);
    gitExec(['config', 'user.name', 'AI'], opts);
    gitExec(['config', 'user.email', 'ai@example.com'], opts);
    gitExec(['add', '.'], opts);
    gitExec(['commit', '-q', '--allow-empty', '-m', 'init'], opts);
  } catch (err) {
    console.warn(`Failed to initialize git in workDir ${workDir}: ${err}`);
  }
}

/**
 * Generates an aligned unified diff of two strings for LLM context and file comparison.
 */
export function generateUnifiedDiff(
  oldText: string,
  newText: string,
  oldLabel = 'Old',
  newLabel = 'New',
  contextLines = 3
): string {
  if (oldText === newText) {
    return 'No differences detected.';
  }

  const patch = createTwoFilesPatch(oldLabel, newLabel, oldText, newText, undefined, undefined, { context: contextLines });
  if (!patch.includes('@@')) {
    return 'No differences detected.';
  }
  return patch.trim();
}
