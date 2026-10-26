import { generateUnifiedDiff } from '../../core/patch-utils.ts';

/**
 * Prepares the public `agent.patch` for one run. Two sources:
 *  - runs with an `agent.patch` (target-based guides): filtered and capped
 *  - legacy runs that stored the built app instead: a diff of the task's
 *    target file against the base app, in the same `diff --git` format so the
 *    dashboard renders both the same way
 */

/** Patches larger than this are replaced with a placeholder. */
export const MAX_PATCH_BYTES = 1024 * 1024;

/** Files whose hunks are dropped: generated or vendored content that bloats patches and never helps a reader. */
const EXCLUDED_PATH_RE = /(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|node_modules\/|dist\/|build\/|\.next\/)/;

export interface PreparedPatch {
  text: string;
  /** True when the patch was replaced by a placeholder because it exceeded `MAX_PATCH_BYTES`. */
  truncated: boolean;
  /** Paths whose hunks were dropped. */
  droppedFiles: string[];
}

/** Removes excluded files from a `diff --git` patch and enforces the size cap. */
export function preparePatch(rawPatch: string): PreparedPatch {
  const kept: string[] = [];
  const droppedFiles: string[] = [];
  for (const section of splitPatch(rawPatch)) {
    const file = fileOfSection(section);
    if (file !== undefined && EXCLUDED_PATH_RE.test(file)) {
      droppedFiles.push(file);
    } else {
      kept.push(section);
    }
  }
  return capPatch(kept.join(''), droppedFiles);
}

/**
 * Builds a single-file `diff --git` patch for a legacy run from the base app's
 * copy and the agent's copy. Binary targets (images, fonts) get git's one-line
 * `Binary files ... differ` section instead of a byte-soup diff.
 */
export function patchFromFiles(relPath: string, base: Buffer | undefined, agent: Buffer): PreparedPatch {
  if (isBinary(agent) || (base !== undefined && isBinary(base))) {
    if (base !== undefined && base.equals(agent)) {
      return { text: '', truncated: false, droppedFiles: [] };
    }
    const from = base === undefined ? '/dev/null' : `a/${relPath}`;
    return { text: `diff --git a/${relPath} b/${relPath}\nBinary files ${from} and b/${relPath} differ\n`, truncated: false, droppedFiles: [] };
  }
  const baseText = base?.toString('utf8');
  const agentText = agent.toString('utf8');
  const diff = generateUnifiedDiff(baseText ?? '', agentText, `a/${relPath}`, `b/${relPath}`)
    // The `diff` package emits a `====` separator line that git-style patches do not have.
    .replace(/^=+\n/m, '');
  if (!diff.includes('@@')) {
    return { text: '', truncated: false, droppedFiles: [] };
  }
  const header = baseText === undefined
    ? `diff --git a/${relPath} b/${relPath}\nnew file mode 100644\n`
    : `diff --git a/${relPath} b/${relPath}\n`;
  return capPatch(header + diff + '\n', []);
}

/** Splits a patch into one string per `diff --git` section, keeping the header line with its section. */
function splitPatch(patch: string): string[] {
  const sections: string[] = [];
  const starts = [...patch.matchAll(/^diff --git /gm)].map(match => match.index);
  for (let i = 0; i < starts.length; i++) {
    sections.push(patch.slice(starts[i], starts[i + 1]));
  }
  return sections;
}

/** Git's heuristic: a NUL byte in the first 8 KB means binary. Also catches invalid UTF-8. */
export function isBinary(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 8000);
  if (head.includes(0)) {
    return true;
  }
  try {
    // stream: true tolerates a multi-byte character cut off at the 8 KB boundary.
    new TextDecoder('utf-8', { fatal: true }).decode(head, { stream: true });
    return false;
  } catch {
    return true;
  }
}

function fileOfSection(section: string): string | undefined {
  return /^diff --git a\/(.+?) b\//.exec(section)?.[1];
}

function capPatch(text: string, droppedFiles: string[]): PreparedPatch {
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > MAX_PATCH_BYTES) {
    const mb = (bytes / (1024 * 1024)).toFixed(1);
    return { text: `# diff omitted: ${mb} MB exceeds the ${MAX_PATCH_BYTES / (1024 * 1024)} MB cap\n`, truncated: true, droppedFiles };
  }
  return { text, truncated: false, droppedFiles };
}
