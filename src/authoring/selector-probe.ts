import fs from 'node:fs';
import path from 'node:path';
import { parse as parseCss, getRules, parseSelectorAST, CSSStyleRule } from 'cssomnom';
import { baseAppsDir } from '../core/paths.ts';
import { TASK_FILE, TARGETS_DIR } from '../core/guide-validation.ts';
import { applyPatchSync, capturePatchFromGit, extractTargetFilesFromPatch, initGitRepo } from '../core/patch-utils.ts';
import { createIsolatedHome, cleanupIsolatedHome } from '../harness/lib/agent-shared.ts';
import { copyBaseAppToWorkspace } from '../harness/lib/utils.ts';
import { collectSpecs, runPlaywright, type PlaywrightSuite, type RunPlaywrightOptions } from '../grading/run-grader.ts';

const CSS_EXTS = new Set(['.css']);
const MARKUP_EXTS = new Set(['.html', '.htm', '.astro', '.vue', '.svelte']);
const JS_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);
const SOURCE_EXTS = new Set([...CSS_EXTS, ...MARKUP_EXTS, ...JS_EXTS]);
const IGNORED_DIRS = new Set(['node_modules', '.astro', 'dist', '.git', 'test-results']);

const IDENT_RE = /^[a-zA-Z_-][a-zA-Z0-9_-]*$/;

function collectClassSelectorsFromAst(node: unknown, out: Set<string>): void {
  if (!node || typeof node !== 'object') return;
  const n = node as { type?: unknown; name?: unknown; selectors?: unknown[]; items?: unknown[]; argument?: unknown };
  if (n.type === 'class-selector' && typeof n.name === 'string') {
    out.add(n.name);
    return;
  }
  if (Array.isArray(n.selectors)) {
    for (const child of n.selectors) collectClassSelectorsFromAst(child, out);
  }
  if (Array.isArray(n.items)) {
    for (const child of n.items) collectClassSelectorsFromAst(child, out);
  }
  if (n.argument && typeof n.argument === 'object') {
    collectClassSelectorsFromAst(n.argument, out);
  }
}

function unwrapGlobalPseudo(css: string): string {
  return css.replaceAll(/:global\(([^)]*)\)/g, '$1');
}

/** Extracts CSS class selector names from CSS text using CSSOMNom's selector AST. */
export function extractCssSelectorClasses(cssText: string): Set<string> {
  const classes = new Set<string>();
  const normalized = unwrapGlobalPseudo(cssText);
  try {
    const sheet = parseCss(normalized);
    for (const rule of getRules(sheet, CSSStyleRule)) {
      if (!rule.selectorText) continue;
      try {
        collectClassSelectorsFromAst(parseSelectorAST(rule.selectorText), classes);
      } catch {
        // Ignore unparseable selector fragments
      }
    }
    // Also inspect CSSScopeRule preludes (`@scope (.card)`) if present
    const walkScopePreludes = (rules: Iterable<unknown>) => {
      for (const r of rules) {
        if (!r || typeof r !== 'object') continue;
        const rec = r as { prelude?: string; cssRules?: Iterable<unknown> };
        if (typeof rec.prelude === 'string') {
          for (const m of rec.prelude.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)) {
            classes.add(m[1]!);
          }
        }
        if (rec.cssRules) walkScopePreludes(rec.cssRules);
      }
    };
    walkScopePreludes(sheet.cssRules);
  } catch {
    // Best-effort fallback if stylesheet fails to parse
    for (const m of normalized.matchAll(/(?:^|[\s,{>+~(:])\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)) {
      classes.add(m[1]!);
    }
  }
  return classes;
}

/** Extracts explicit `id`, `class`, and `data-*` hook names mentioned in `task.md`. */
export function extractTaskHooks(taskMdContent: string): Set<string> {
  const hooks = new Set<string>();
  for (const m of taskMdContent.matchAll(/\bclass\s*=\s*["']([^"']+)["']/gi)) {
    for (const token of m[1]!.split(/\s+/)) {
      if (token) hooks.add(token);
    }
  }
  for (const m of taskMdContent.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) {
    if (m[1]) hooks.add(m[1]);
  }
  for (const m of taskMdContent.matchAll(/\b(data-[a-zA-Z0-9_-]+)/g)) {
    hooks.add(m[1]!);
  }
  for (const m of taskMdContent.matchAll(/(?:^|[\s(`"'[])[.#]([a-zA-Z_-][a-zA-Z0-9_-]*)/g)) {
    hooks.add(m[1]!);
  }
  for (const m of taskMdContent.matchAll(/`\.?#?([a-zA-Z_-][a-zA-Z0-9_-]*)`/g)) {
    if (IDENT_RE.test(m[1]!)) hooks.add(m[1]!);
  }
  return hooks;
}

function findMatchingDelimiter(text: string, openIdx: number, openChar: string, closeChar: string): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i]!;
    if (quote) {
      if (ch === '\\') { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractBalancedCallArgs(jsText: string, methodRe: RegExp): string[] {
  const argsList: string[] = [];
  const re = new RegExp(methodRe.source, methodRe.flags.includes('g') ? methodRe.flags : `${methodRe.flags}g`);
  let match: RegExpExecArray | null;
  while ((match = re.exec(jsText)) !== null) {
    const openParen = match.index + match[0].length - 1;
    const closeParen = findMatchingDelimiter(jsText, openParen, '(', ')');
    if (closeParen !== -1) {
      argsList.push(jsText.slice(openParen + 1, closeParen));
    }
  }
  return argsList;
}

function extractStringLiterals(text: string): string[] {
  const literals: string[] = [];
  for (const m of text.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    literals.push(m[2]!);
  }
  return literals;
}

function extractMarkupAttrClasses(markup: string, out: Set<string>): void {
  for (const m of markup.matchAll(/\b(?:class|className)\s*=\s*(["'])([^"']*)\1/g)) {
    for (const token of m[2]!.split(/\s+/)) {
      if (token) out.add(token);
    }
  }
  for (const m of markup.matchAll(/\b(?:class|className|class:list)\s*=\s*\{/g)) {
    const openBrace = m.index! + m[0].length - 1;
    const closeBrace = findMatchingDelimiter(markup, openBrace, '{', '}');
    if (closeBrace === -1) continue;
    const expr = markup.slice(openBrace + 1, closeBrace).replaceAll(/\$\{[^}]*\}/g, ' ');
    for (const lit of extractStringLiterals(expr)) {
      for (const token of lit.split(/\s+/)) {
        if (token) out.add(token);
      }
    }
  }
}

function extractJsSelectorClasses(jsText: string, out: Set<string>, includeClassList: boolean): void {
  for (const args of extractBalancedCallArgs(jsText, /\b(?:querySelector|querySelectorAll|closest|matches)\s*\(/g)) {
    for (const lit of extractStringLiterals(args)) {
      const cleaned = lit.replaceAll(/\$\{[^}]*\}/g, 'x');
      try {
        collectClassSelectorsFromAst(parseSelectorAST(cleaned), out);
      } catch {
        for (const m of cleaned.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)) {
          out.add(m[1]!);
        }
      }
    }
  }
  for (const args of extractBalancedCallArgs(jsText, /\bgetElementsByClassName\s*\(/g)) {
    for (const lit of extractStringLiterals(args)) {
      for (const token of lit.split(/\s+/)) {
        if (token && IDENT_RE.test(token)) out.add(token);
      }
    }
  }
  if (includeClassList) {
    for (const args of extractBalancedCallArgs(jsText, /\.classList\.(?:add|remove|toggle|contains|replace)\s*\(/g)) {
      for (const lit of extractStringLiterals(args)) {
        for (const token of lit.split(/\s+/)) {
          if (token) out.add(token);
        }
      }
    }
  }
}

/** Extracts class names from one source file (`base` includes markup/classList; `golden-candidates` targets CSS & DOM selector queries). */
export function extractClassesFromSource(
  filePath: string,
  content: string,
  mode: 'base' | 'golden-candidates'
): Set<string> {
  const ext = path.extname(filePath).toLowerCase();
  const classes = new Set<string>();
  const includeAll = mode === 'base';

  if (CSS_EXTS.has(ext)) {
    for (const c of extractCssSelectorClasses(content)) classes.add(c);
    return classes;
  }

  if (MARKUP_EXTS.has(ext)) {
    let body = content;
    if (ext === '.astro' && body.startsWith('---')) {
      const endFm = body.indexOf('\n---', 3);
      if (endFm !== -1) {
        extractJsSelectorClasses(body.slice(3, endFm), classes, includeAll);
        body = body.slice(endFm + 4);
      }
    }
    for (const m of body.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
      for (const c of extractCssSelectorClasses(m[1]!)) classes.add(c);
    }
    for (const m of body.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
      extractJsSelectorClasses(m[1]!, classes, includeAll);
    }
    if (includeAll) {
      const markupOnly = body
        .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
        .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
      extractMarkupAttrClasses(markupOnly, classes);
    }
    return classes;
  }

  if (JS_EXTS.has(ext)) {
    extractJsSelectorClasses(content, classes, includeAll);
    if (includeAll && (ext === '.tsx' || ext === '.jsx')) {
      extractMarkupAttrClasses(content, classes);
    }
  }
  return classes;
}

function listSourceFiles(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) return [];
  const results: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && SOURCE_EXTS.has(path.extname(entry.name).toLowerCase())) {
        results.push(full);
      }
    }
  };
  walk(rootDir);
  return results.sort();
}

/** Collects all class names appearing in a base application directory. */
export function collectBaseAppClasses(appDir: string): Set<string> {
  const classes = new Set<string>();
  for (const file of listSourceFiles(appDir)) {
    const content = fs.readFileSync(file, 'utf8');
    for (const c of extractClassesFromSource(file, content, 'base')) {
      classes.add(c);
    }
  }
  return classes;
}

/** Identifies custom CSS class names introduced only by the golden patch, excluding base-app classes and `task.md` hooks. */
export function extractGoldenOnlyClasses(opts: {
  goldenFiles: ReadonlyArray<{ filePath: string; content: string }>;
  baseAppClasses: ReadonlySet<string>;
  taskHooks: ReadonlySet<string>;
}): string[] {
  const candidates = new Set<string>();
  for (const { filePath, content } of opts.goldenFiles) {
    for (const c of extractClassesFromSource(filePath, content, 'golden-candidates')) {
      if (!opts.baseAppClasses.has(c) && !opts.taskHooks.has(c)) {
        candidates.add(c);
      }
    }
  }
  return [...candidates].sort();
}

/** Builds a deterministic rename map (`foo-bar` -> `mwg-probe-0`, ...). */
export function buildProbeRenameMap(classes: readonly string[]): Map<string, string> {
  const unique = [...new Set(classes)].sort();
  return new Map(unique.map((cls, i) => [cls, `mwg-probe-${i}`]));
}

function replaceClassTokens(text: string, renameMap: ReadonlyMap<string, string>): string {
  return text.split(/(\s+)/).map(part => renameMap.get(part) ?? part).join('');
}

function replaceSelectorClasses(selectorText: string, renameMap: ReadonlyMap<string, string>): string {
  return selectorText.replaceAll(/(?<!\\)\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g, (full, name: string) => {
    const next = renameMap.get(name);
    return next ? `.${next}` : full;
  });
}

function renameClassesInCss(css: string, renameMap: ReadonlyMap<string, string>): string {
  let out = '';
  let i = 0;
  while (i < css.length) {
    if (css[i] === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? css.length : end + 2;
      out += css.slice(i, stop);
      i = stop;
      continue;
    }
    if (css[i] === '"' || css[i] === "'") {
      const quote = css[i]!;
      let j = i + 1;
      while (j < css.length) {
        if (css[j] === '\\') { j += 2; continue; }
        if (css[j] === quote) { j++; break; }
        j++;
      }
      out += css.slice(i, j);
      i = j;
      continue;
    }
    if (css.slice(i, i + 4).toLowerCase() === 'url(') {
      const close = findMatchingDelimiter(css, i + 3, '(', ')');
      if (close !== -1) {
        out += css.slice(i, close + 1);
        i = close + 1;
        continue;
      }
    }
    // `[class~="foo-bar"]` / `[class="foo-bar"]` attribute selectors
    if (css[i] === '[') {
      const close = findMatchingDelimiter(css, i, '[', ']');
      if (close !== -1) {
        const attrSel = css.slice(i, close + 1).replace(
          /^(\[\s*class\s*(?:[~|^$*]?=)\s*)(["'])([^"']*)\2/i,
          (_, prefix: string, q: string, val: string) => `${prefix}${q}${replaceClassTokens(val, renameMap)}${q}`
        );
        out += attrSel;
        i = close + 1;
        continue;
      }
    }
    if (css[i] === '.' && (i === 0 || css[i - 1] !== '\\')) {
      const rest = css.slice(i + 1);
      const m = rest.match(/^([a-zA-Z_-][a-zA-Z0-9_-]*)/);
      if (m) {
        const name = m[1]!;
        const replacement = renameMap.get(name);
        out += `.${replacement ?? name}`;
        i += 1 + name.length;
        continue;
      }
    }
    out += css[i]!;
    i++;
  }
  return out;
}

function renameStringLiterals(text: string, renameMap: ReadonlyMap<string, string>, mode: 'tokens' | 'selector'): string {
  return text.replaceAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g, (full, quote: string, inner: string) => {
    if (quote === '`' && inner.includes('${')) {
      // Split around `${...}` interpolations so JS expressions inside templates aren't mangled
      let rebuilt = '';
      let pos = 0;
      while (pos < inner.length) {
        const interp = inner.indexOf('${', pos);
        if (interp === -1) {
          const chunk = inner.slice(pos);
          rebuilt += mode === 'tokens' ? replaceClassTokens(chunk, renameMap) : replaceSelectorClasses(chunk, renameMap);
          break;
        }
        const chunk = inner.slice(pos, interp);
        rebuilt += mode === 'tokens' ? replaceClassTokens(chunk, renameMap) : replaceSelectorClasses(chunk, renameMap);
        const endExpr = findMatchingDelimiter(inner, interp + 1, '{', '}');
        if (endExpr === -1) {
          rebuilt += inner.slice(interp);
          break;
        }
        rebuilt += `\${${renameStringLiterals(inner.slice(interp + 2, endExpr), renameMap, mode)}}`;
        pos = endExpr + 1;
      }
      return `${quote}${rebuilt}${quote}`;
    }
    const updated = mode === 'tokens' ? replaceClassTokens(inner, renameMap) : replaceSelectorClasses(inner, renameMap);
    return `${quote}${updated}${quote}`;
  });
}

function renameBalancedCallArgs(
  text: string,
  methodRe: RegExp,
  renameMap: ReadonlyMap<string, string>,
  mode: 'tokens' | 'selector'
): string {
  const re = new RegExp(methodRe.source, methodRe.flags.includes('g') ? methodRe.flags : `${methodRe.flags}g`);
  let out = '';
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const openParen = match.index + match[0].length - 1;
    const closeParen = findMatchingDelimiter(text, openParen, '(', ')');
    if (closeParen === -1) continue;
    out += text.slice(lastIdx, openParen + 1);
    out += renameStringLiterals(text.slice(openParen + 1, closeParen), renameMap, mode);
    lastIdx = closeParen;
  }
  return out + text.slice(lastIdx);
}

function renameSetAttributeClass(text: string, renameMap: ReadonlyMap<string, string>): string {
  const re = /\.setAttribute\s*\(/g;
  let out = '';
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const openParen = match.index + match[0].length - 1;
    const closeParen = findMatchingDelimiter(text, openParen, '(', ')');
    if (closeParen === -1) continue;
    const args = text.slice(openParen + 1, closeParen);
    const firstArg = args.match(/^\s*(['"])class\1\s*,([\s\S]*)$/);
    if (!firstArg) continue;
    out += text.slice(lastIdx, openParen + 1);
    const commaIdx = args.indexOf(',');
    out += args.slice(0, commaIdx + 1) + renameStringLiterals(firstArg[2]!, renameMap, 'tokens');
    lastIdx = closeParen;
  }
  return out + text.slice(lastIdx);
}

function renameClassesInJs(js: string, renameMap: ReadonlyMap<string, string>): string {
  let out = js;
  out = renameBalancedCallArgs(out, /\b(?:querySelector|querySelectorAll|closest|matches)\s*\(/g, renameMap, 'selector');
  out = renameBalancedCallArgs(out, /\bgetElementsByClassName\s*\(/g, renameMap, 'tokens');
  out = renameBalancedCallArgs(out, /\.classList\.(?:add|remove|toggle|contains|replace)\s*\(/g, renameMap, 'tokens');
  out = renameSetAttributeClass(out, renameMap);
  out = out.replaceAll(
    /(\.\s*className\s*(?:\+=|=)\s*)(['"`])((?:\\.|(?!\2)[^\\])*)\2/g,
    (_, prefix: string, q: string, val: string) => `${prefix}${q}${replaceClassTokens(val, renameMap)}${q}`
  );
  return out;
}

function renameClassesInMarkup(markup: string, renameMap: ReadonlyMap<string, string>): string {
  let out = markup.replaceAll(
    /(\b(?:class|className)\s*=\s*)(["'])([^"']*)\2/g,
    (_, prefix: string, q: string, val: string) => `${prefix}${q}${replaceClassTokens(val, renameMap)}${q}`
  );

  // Dynamic JSX/Astro attributes: class={...}, className={...}, class:list={...}
  const attrRe = /\b(?:class|className|class:list)\s*=\s*\{/g;
  let rebuilt = '';
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(out)) !== null) {
    const openBrace = m.index + m[0].length - 1;
    const closeBrace = findMatchingDelimiter(out, openBrace, '{', '}');
    if (closeBrace === -1) continue;
    rebuilt += out.slice(lastIdx, openBrace + 1);
    rebuilt += renameStringLiterals(out.slice(openBrace + 1, closeBrace), renameMap, 'tokens');
    lastIdx = closeBrace;
  }
  return rebuilt + out.slice(lastIdx);
}

/** Deterministically renames classes in `renameMap` across HTML, CSS, JS/TS, TSX/JSX, and Astro files. */
export function renameClassesInContent(
  filePath: string,
  content: string,
  renameMap: ReadonlyMap<string, string>
): string {
  if (renameMap.size === 0) return content;
  const ext = path.extname(filePath).toLowerCase();

  if (CSS_EXTS.has(ext)) {
    return renameClassesInCss(content, renameMap);
  }

  if (JS_EXTS.has(ext)) {
    let out = renameClassesInJs(content, renameMap);
    if (ext === '.tsx' || ext === '.jsx') {
      out = renameClassesInMarkup(out, renameMap);
    }
    return out;
  }

  if (MARKUP_EXTS.has(ext)) {
    let frontmatter = '';
    let body = content;
    if (ext === '.astro' && body.startsWith('---')) {
      const endFm = body.indexOf('\n---', 3);
      if (endFm !== -1) {
        frontmatter = `---${renameClassesInJs(body.slice(3, endFm), renameMap)}\n---`;
        body = body.slice(endFm + 4);
      }
    }

    // Rename <style> and <script> blocks in place, and markup outside them
    const rawBlockRe = /<(style|script)(\b[^>]*)>([\s\S]*?)<\/\1\s*>/gi;
    let rebuilt = '';
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    while ((m = rawBlockRe.exec(body)) !== null) {
      rebuilt += renameClassesInMarkup(body.slice(lastIdx, m.index), renameMap);
      const [full, tag, attrs, inner] = m;
      const renamedInner = tag!.toLowerCase() === 'style'
        ? renameClassesInCss(inner!, renameMap)
        : renameClassesInJs(inner!, renameMap);
      const closing = full.slice(full.lastIndexOf('<'));
      rebuilt += `<${tag}${attrs}>${renamedInner}${closing}`;
      lastIdx = m.index + full.length;
    }
    rebuilt += renameClassesInMarkup(body.slice(lastIdx), renameMap);
    return frontmatter + rebuilt;
  }

  return content;
}

export interface SelectorProbeResult {
  passed: boolean;
  renamedClasses: Map<string, string>;
  failingTests: string[];
  diagnostic?: string;
}

export interface SelectorProbeOptions {
  guideDirAbs: string;
  baseApp: string;
  patchFile: string;
  graderPath: string;
  /** Optional list of tests that passed on the original golden (used to avoid attributing pre-existing failures). */
  originalPassingTests?: readonly string[];
  /** Injectable Playwright runner for unit testing. */
  runPlaywrightFn?: (targetPathAbs: string, graderPath: string, options: RunPlaywrightOptions) => Promise<any>;
}

/**
 * Stages a golden patch with all golden-only custom CSS classes deterministically renamed (`mwg-probe-0`, ...)
 * and runs `grader.ts` to verify no passing test is coupled to non-contract class names.
 */
export async function runSelectorGatingProbe(opts: SelectorProbeOptions): Promise<SelectorProbeResult> {
  const targetDir = path.join(opts.guideDirAbs, TARGETS_DIR, opts.baseApp);
  const taskPath = path.join(targetDir, TASK_FILE);
  const taskHooks = fs.existsSync(taskPath) ? extractTaskHooks(fs.readFileSync(taskPath, 'utf8')) : new Set<string>();
  const baseAppClasses = collectBaseAppClasses(path.join(baseAppsDir, opts.baseApp));

  const tempHome = createIsolatedHome('selector-probe');
  const workDir = path.join(tempHome, opts.baseApp);
  try {
    await copyBaseAppToWorkspace(opts.baseApp, workDir);
    initGitRepo(workDir);

    const applyRes = applyPatchSync(workDir, opts.patchFile);
    if (!applyRes.success) {
      return {
        passed: false,
        renamedClasses: new Map(),
        failingTests: [],
        diagnostic: `Selector probe could not apply ${path.basename(opts.patchFile)}: ${applyRes.error || 'unknown patch error'}`,
      };
    }

    const patchedRelFiles = extractTargetFilesFromPatch(opts.patchFile);
    const goldenFiles = patchedRelFiles
      .map(rel => ({ rel, abs: path.join(workDir, rel) }))
      .filter(({ abs }) => fs.existsSync(abs) && fs.statSync(abs).isFile() && SOURCE_EXTS.has(path.extname(abs).toLowerCase()))
      .map(({ rel, abs }) => ({ filePath: rel, content: fs.readFileSync(abs, 'utf8') }));

    const goldenOnly = extractGoldenOnlyClasses({ goldenFiles, baseAppClasses, taskHooks });
    const renameMap = buildProbeRenameMap(goldenOnly);
    if (renameMap.size === 0) {
      return { passed: true, renamedClasses: renameMap, failingTests: [] };
    }

    for (const file of listSourceFiles(workDir)) {
      const before = fs.readFileSync(file, 'utf8');
      const after = renameClassesInContent(file, before, renameMap);
      if (after !== before) {
        fs.writeFileSync(file, after);
      }
    }

    const probePatchPath = path.join(tempHome, 'selector-probe.patch');
    const captured = capturePatchFromGit(workDir, probePatchPath);
    if (!captured.success) {
      return { passed: true, renamedClasses: renameMap, failingTests: [] };
    }

    const runner = opts.runPlaywrightFn ?? runPlaywright;
    const results = await runner(targetDir, opts.graderPath, {
      stdio: 'ignore',
      patchFile: probePatchPath,
      baselineTarget: 'widely',
    });

    if (results?.errors?.length) {
      const errMsg = results.errors.map((e: { message?: string }) => e.message || String(e)).join('\n');
      return {
        passed: false,
        renamedClasses: renameMap,
        failingTests: [],
        diagnostic: `Grader appears coupled to non-contract class names on ${opts.baseApp}: Playwright errored after class rename:\n${errMsg}`,
      };
    }

    const allFailing: string[] = (results?.suites || []).flatMap((s: PlaywrightSuite) => collectSpecs(s, false));
    const failingTests = opts.originalPassingTests
      ? allFailing.filter(t => opts.originalPassingTests!.includes(t))
      : allFailing;

    if (failingTests.length > 0 || (results?.stats?.unexpected ?? 0) > 0 && !opts.originalPassingTests) {
      const renamedPairs = [...renameMap.entries()].map(([k, v]) => `${k} -> ${v}`).join(', ');
      const testLines = failingTests.length > 0
        ? failingTests.map(t => `  - ${t}`).join('\n')
        : '  - (one or more tests failed)';
      return {
        passed: false,
        renamedClasses: renameMap,
        failingTests,
        diagnostic: [
          `Grader appears coupled to non-contract class names on ${opts.baseApp} (${path.basename(opts.patchFile)}).`,
          `Failing test(s) after renaming golden-only classes:\n${testLines}`,
          `Renamed classes: ${renamedPairs}`,
        ].join('\n'),
      };
    }

    return { passed: true, renamedClasses: renameMap, failingTests: [] };
  } finally {
    try {
      cleanupIsolatedHome(tempHome);
    } catch {}
  }
}
