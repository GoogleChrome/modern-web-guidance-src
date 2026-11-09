import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createTwoFilesPatch } from 'diff';
import { gitExec } from './git-utils.ts';

const MAX_BUFFER = 50 * 1024 * 1024; // 50MB buffer to handle large diffs/assets

const EXCLUDED_FILES_RE = /(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|guide\.md|expectations\.md|task\.md|pnpm-workspace\.yaml)$/;

const EXCLUDED_PATCH_PATHSPECS = [
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

/**
 * Extracts target modified file paths directly from unified diff headers (+++ b/<path>).
 * Ignores deleted files (/dev/null), package manager lockfiles, and authoring metadata files.
 */
export function extractTargetFilesFromPatch(patchPath: string): string[] {
  try {
    if (!fs.existsSync(patchPath)) return [];
    const content = fs.readFileSync(patchPath, 'utf8');
    const matches = Array.from(content.matchAll(/^\+\+\+ (?:b\/)?(.+)$/gm));
    return matches
      .map((m) => m[1].trim())
      .filter((filePath) => filePath && filePath !== '/dev/null' && !EXCLUDED_FILES_RE.test(filePath));
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

    // Stage untracked files with intent-to-add so git diff includes them
    gitExec(['add', '-N', '--ignore-removal', '--', targetPath], {
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
