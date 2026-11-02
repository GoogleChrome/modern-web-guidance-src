import { createTwoFilesPatch } from 'diff';

/**
 * Prepares the public `agent.patch` for one run. Two sources:
 *  - runs with an `agent.patch` (target-based guides): filtered and capped
 *  - legacy runs that stored the built app instead: a diff of the task's
 *    target file against the base app, in the same `diff --git` format
 */

/** Patches larger than this are replaced with a placeholder. */
export const MAX_PATCH_BYTES = 1024 * 1024;

/**
 * Files whose hunks are dropped: generated or vendored content that bloats
 * patches and never helps a reader, plus files that tend to hold secrets or
 * agent-local configuration. Build output (`dist/`, `build/`, `.next/`) and
 * agent config directories count only at the repo root, so `src/build/x.ts`
 * and `docs/dist/readme.md` stay in; lockfiles and `node_modules/` count at
 * any depth.
 */
export const EXCLUDED_PATH_RE = new RegExp([
  String.raw`(?:^|/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$`,
  String.raw`(?:^|/)node_modules/`,
  String.raw`^(?:dist|build|\.next)/`,
  String.raw`(?:^|/)\.env(?:\.[^/]+)?$`,
  String.raw`\.(?:pem|key)$`,
  String.raw`^\.(?:claude|codex|gemini|antigravity)/`,
].join('|'));

export interface PreparedPatch {
  text: string;
  /** True when the patch was replaced by a placeholder because it exceeded `MAX_PATCH_BYTES`. */
  truncated: boolean;
  /** Paths whose hunks were dropped. */
  droppedFiles: string[];
}

/**
 * Removes excluded files from a `diff --git` patch and enforces the size cap.
 * A section is dropped if any path it names (either side of the header, `---`/
 * `+++` markers, or rename/copy headers) is excluded, and also if its header
 * cannot be read at all: a section we cannot attribute to a file is not one we
 * can vouch for.
 */
export function preparePatch(rawPatch: string): PreparedPatch {
  const kept: string[] = [];
  const droppedFiles: string[] = [];
  for (const section of splitPatch(rawPatch)) {
    const paths = pathsOfSection(section);
    const excluded = paths?.find(file => EXCLUDED_PATH_RE.test(file));
    if (paths === undefined) {
      droppedFiles.push(headerLine(section));
    } else if (excluded !== undefined) {
      droppedFiles.push(excluded);
    } else {
      kept.push(section);
    }
  }
  return capPatch(kept.join(''), droppedFiles);
}

/**
 * Builds a single-file `diff --git` patch for a legacy run from the base app's
 * copy and the agent's copy. Targets that `preparePatch` would drop (`.env`,
 * keys, lockfiles, build output) are dropped here too. Binary targets (images,
 * fonts) get git's one-line `Binary files ... differ` section instead of a
 * byte-soup diff.
 */
export function patchFromFiles(relPath: string, base: Buffer | undefined, agent: Buffer): PreparedPatch {
  if (EXCLUDED_PATH_RE.test(relPath)) {
    return { text: '', truncated: false, droppedFiles: [relPath] };
  }
  if (isBinary(agent) || (base !== undefined && isBinary(base))) {
    if (base !== undefined && base.equals(agent)) {
      return { text: '', truncated: false, droppedFiles: [] };
    }
    const from = base === undefined ? '/dev/null' : `a/${relPath}`;
    return { text: `diff --git a/${relPath} b/${relPath}\nBinary files ${from} and b/${relPath} differ\n`, truncated: false, droppedFiles: [] };
  }
  const baseText = base?.toString('utf8');
  const agentText = agent.toString('utf8');
  // Not `generateUnifiedDiff`: it trims the output, which eats a trailing blank context line
  // and leaves the hunk shorter than its `@@` header claims. Only the `====` separator line
  // that git-style patches do not have is removed.
  const diff = createTwoFilesPatch(`a/${relPath}`, `b/${relPath}`, baseText ?? '', agentText).replace(/^=+\n/, '');
  if (!diff.includes('@@')) {
    return { text: '', truncated: false, droppedFiles: [] };
  }
  const header = baseText === undefined
    ? `diff --git a/${relPath} b/${relPath}\nnew file mode 100644\n`
    : `diff --git a/${relPath} b/${relPath}\n`;
  return capPatch(header + diff, []);
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

/** A header path: either C-quoted (`"a/p\tq"`, as git writes control/non-ASCII chars) or bare. */
const QUOTED = String.raw`"((?:[^"\\]|\\.)*)"`;
const HEADER_RE = new RegExp(String.raw`^diff --git (?:${QUOTED}|(.+?)) (?:${QUOTED}|(.+))$`);
const EXTENDED_PATH_RES: readonly { re: RegExp; prefix?: string }[] = [
  { re: new RegExp(String.raw`^rename from (?:${QUOTED}|(.+))$`, 'gm') },
  { re: new RegExp(String.raw`^rename to (?:${QUOTED}|(.+))$`, 'gm') },
  { re: new RegExp(String.raw`^copy from (?:${QUOTED}|(.+))$`, 'gm') },
  { re: new RegExp(String.raw`^copy to (?:${QUOTED}|(.+))$`, 'gm') },
  { re: new RegExp(String.raw`^--- (?:${QUOTED}|(a/.+))$`, 'gm'), prefix: 'a/' },
  { re: new RegExp(String.raw`^\+\+\+ (?:${QUOTED}|(b/.+))$`, 'gm'), prefix: 'b/' },
];

/**
 * Every path a section names: both sides of the `diff --git` header plus any
 * `---`/`+++` or rename/copy header lines. Undefined when the header does not
 * have the shape git writes, or a path is not under `a/` / `b/` as expected.
 */
function pathsOfSection(section: string): string[] | undefined {
  const headerPaths = parseHeaderLine(headerLine(section));
  if (!headerPaths) {
    return undefined;
  }
  const paths = [...headerPaths];
  const extendedHeaders = section.split(/^@@ /m, 1)[0];
  for (const { re, prefix } of EXTENDED_PATH_RES) {
    for (const match of extendedHeaders.matchAll(re)) {
      const decoded = match[1] !== undefined ? unquote(match[1]) : match[2];
      if (decoded === undefined) {
        return undefined;
      }
      const cleaned = prefix ? stripPrefix(decoded, prefix) : decoded;
      if (cleaned === undefined) {
        return undefined;
      }
      paths.push(cleaned);
    }
  }
  return [...new Set(paths)];
}

/**
 * Reads `a/<path>` and `b/<path>` from `diff --git ...`. Git does not quote
 * plain ASCII spaces, so `diff --git a/dir b/.env b/dir b/.env` is checked for
 * an exact `a/<p> b/<p>` symmetry before falling back to `HEADER_RE`.
 */
function parseHeaderLine(line: string): [string, string] | undefined {
  if (line.startsWith('diff --git a/')) {
    const rest = line.slice('diff --git '.length);
    if ((rest.length - 5) % 2 === 0) {
      const half = (rest.length - 5) / 2;
      if (half > 0 && rest.slice(2 + half, 5 + half) === ' b/' && rest.slice(2, 2 + half) === rest.slice(5 + half)) {
        const same = rest.slice(2, 2 + half);
        return [same, same];
      }
    }
  }
  const header = HEADER_RE.exec(line);
  if (!header) {
    return undefined;
  }
  const [, quotedA, bareA, quotedB, bareB] = header;
  const a = stripPrefix(quotedA !== undefined ? unquote(quotedA) : bareA, 'a/');
  const b = stripPrefix(quotedB !== undefined ? unquote(quotedB) : bareB, 'b/');
  return a !== undefined && b !== undefined ? [a, b] : undefined;
}

function headerLine(section: string): string {
  const end = section.indexOf('\n');
  return end === -1 ? section : section.slice(0, end);
}

function stripPrefix(text: string | undefined, prefix: string): string | undefined {
  return text !== undefined && text.startsWith(prefix) && text.length > prefix.length ? text.slice(prefix.length) : undefined;
}

const ESCAPES: Record<string, string> = { '"': '"', '\\': '\\', a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v' };

/** Decodes the body of a git C-quoted string. Undefined on an escape git would not write. */
function unquote(body: string): string | undefined {
  let out = '';
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== '\\') {
      out += body[i];
      continue;
    }
    const octal = /^[0-7]{3}/.exec(body.slice(i + 1, i + 4));
    if (octal) {
      out += String.fromCharCode(parseInt(octal[0], 8));
      i += 3;
      continue;
    }
    const escaped = ESCAPES[body[i + 1] ?? ''];
    if (escaped === undefined) {
      return undefined;
    }
    out += escaped;
    i++;
  }
  return out;
}

function capPatch(text: string, droppedFiles: string[]): PreparedPatch {
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > MAX_PATCH_BYTES) {
    const mb = (bytes / (1024 * 1024)).toFixed(1);
    return { text: `# diff omitted: ${mb} MB exceeds the ${MAX_PATCH_BYTES / (1024 * 1024)} MB cap\n`, truncated: true, droppedFiles };
  }
  return { text, truncated: false, droppedFiles };
}
