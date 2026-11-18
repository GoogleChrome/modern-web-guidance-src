/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { resolveVerticalPack, type PackageManifestLike } from './packs.ts';
import type { DiscoverySource, FrameworkId, ProjectConfig } from './types.ts';

const FRAMEWORK_DEFAULTS: Record<
  FrameworkId,
  { name: string; port: number; devScript: string }
> = {
  nextjs: { name: 'Next.js', port: 3000, devScript: 'dev' },
  nuxt: { name: 'Nuxt', port: 3000, devScript: 'dev' },
  solidjs: { name: 'SolidStart', port: 3000, devScript: 'dev' },
  astro: { name: 'Astro', port: 4321, devScript: 'dev' },
  angular: { name: 'Angular', port: 4200, devScript: 'start' },
  svelte: { name: 'SvelteKit', port: 5173, devScript: 'dev' },
  vue: { name: 'Vue', port: 5173, devScript: 'dev' },
  react: { name: 'React', port: 5173, devScript: 'dev' },
  vanilla: { name: 'Vanilla', port: 3000, devScript: 'dev' },
};

export const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.astro',
  '.angular',
  '.output',
  'dist',
  'dist-ssr',
  'build',
  'coverage',
]);

export const CODE_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.mts',
  '.cts',
  '.jsx',
  '.tsx',
  '.vue',
  '.svelte',
  '.astro',
  '.html',
  '.css',
  '.scss',
]);

export const TEST_FILE_RE = /(?:^|\/)(?:__tests__|tests?|e2e|cypress)\/|\.(?:test|spec)\.[a-z0-9]+$/i;
// Explicit Unicode escape for ESC (0x1b) per project-coding-standards
// oxlint-disable-next-line no-control-regex
const ANSI_ESCAPE_RE = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const NON_COMPONENT_STEMS = new Set([
  'types',
  'utils',
  'helpers',
  'constants',
  'config',
  'styles',
  'env',
]);

interface RawPackageJson extends PackageManifestLike {
  scripts?: Record<string, string | undefined>;
}

function detectPackageManager(workspaceDir: string): 'pnpm' | 'yarn' | 'bun' | 'npm' {
  if (existsSync(path.join(workspaceDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(path.join(workspaceDir, 'yarn.lock'))) return 'yarn';
  if (
    existsSync(path.join(workspaceDir, 'bun.lockb')) ||
    existsSync(path.join(workspaceDir, 'bun.lock'))
  ) {
    return 'bun';
  }
  return 'npm';
}

function parsePortFromScriptOrEnv(
  workspaceDir: string,
  scripts: Record<string, string | undefined>,
): number | null {
  for (const scriptName of ['dev', 'start']) {
    const cmd = scripts[scriptName];
    if (typeof cmd !== 'string') continue;
    const match =
      cmd.match(/(?:--port|-p)\s*=?\s*\$\{PORT:-(\d{2,5})\}/) ||
      cmd.match(/(?:--port|-p)\s*=?\s*(\d{2,5})\b/) ||
      cmd.match(/\bPORT=(\d{2,5})\b/);
    if (match) return Number(match[1]);
  }
  for (const envFile of ['.env.local', '.env.development', '.env']) {
    const envPath = path.join(workspaceDir, envFile);
    if (!existsSync(envPath)) continue;
    const text = readFileSync(envPath, 'utf8');
    const match = text.match(/^\s*PORT\s*=\s*(\d{2,5})\s*$/m);
    if (match) return Number(match[1]);
  }
  return null;
}

export function detectProjectConfig(
  workspaceDir: string,
  options: { pack?: string } = {},
): ProjectConfig {
  const pkgPath = path.join(workspaceDir, 'package.json');
  let pkg: RawPackageJson = {};
  if (existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as RawPackageJson;
    } catch {
      pkg = {};
    }
  }

  const allDeps: Record<string, string> = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };

  let framework: FrameworkId = 'vanilla';
  if ('next' in allDeps) framework = 'nextjs';
  else if ('nuxt' in allDeps) framework = 'nuxt';
  else if ('@solidjs/start' in allDeps || 'solid-js' in allDeps) framework = 'solidjs';
  else if ('astro' in allDeps) framework = 'astro';
  else if ('@angular/core' in allDeps) framework = 'angular';
  else if ('@sveltejs/kit' in allDeps || 'svelte' in allDeps) framework = 'svelte';
  else if ('vue' in allDeps) framework = 'vue';
  else if ('react' in allDeps || 'vite' in allDeps) framework = 'react';

  const defaults = FRAMEWORK_DEFAULTS[framework];
  const scripts = pkg.scripts ?? {};
  const pm = detectPackageManager(workspaceDir);

  let scriptKey: string | null = null;
  if (typeof scripts.dev === 'string') scriptKey = 'dev';
  else if (typeof scripts[defaults.devScript] === 'string') scriptKey = defaults.devScript;
  else if (typeof scripts.start === 'string') scriptKey = 'start';

  const devCmd = scriptKey
    ? pm === 'yarn'
      ? `yarn ${scriptKey}`
      : `${pm} run ${scriptKey}`
    : null;

  const explicitPort = parsePortFromScriptOrEnv(workspaceDir, scripts);
  const port = explicitPort || defaults.port;
  const { pack, packSource } = resolveVerticalPack({
    explicitPack: options.pack,
    pkg,
  });

  return {
    workspaceDir,
    framework,
    frameworkName: defaults.name,
    pack,
    packSource,
    packageManager: pm,
    devCmd,
    port,
    scripts,
    dependencies: Object.keys(allDeps),
  };
}

export function listWorkspaceFiles(workspaceDir: string): string[] {
  const results: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!CODE_EXTENSIONS.has(ext)) continue;
      const rel = path.relative(workspaceDir, fullPath).split(path.sep).join('/');
      results.push(rel);
    }
  };
  walk(workspaceDir);
  return results.sort();
}

function isEligibleTouchedCodeFile(workspaceDir: string, rel: string): boolean {
  if (!rel || TEST_FILE_RE.test(rel)) return false;
  const parts = rel.split('/');
  if (parts.some((p) => IGNORED_DIRS.has(p))) return false;
  if (!CODE_EXTENSIONS.has(path.extname(rel).toLowerCase())) return false;
  const full = path.join(workspaceDir, rel);
  if (!existsSync(full)) return false;
  try {
    return statSync(full).isFile();
  } catch {
    return false;
  }
}

function getGitChangedFiles(workspaceDir: string): string[] | null {
  try {
    const rawTopLevel = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: workspaceDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    }).trim();
    if (!rawTopLevel) return null;

    let topLevel = rawTopLevel;
    let realWorkspace = workspaceDir;
    try {
      topLevel = realpathSync(rawTopLevel);
      realWorkspace = realpathSync(workspaceDir);
    } catch {
      // Keep resolved paths
    }

    if (realWorkspace !== topLevel) {
      try {
        execFileSync('git', ['check-ignore', '-q', '.'], {
          cwd: workspaceDir,
          stdio: 'ignore',
          timeout: 1500,
        });
        return null;
      } catch {
        // Exit code 1 means not ignored; continue.
      }
    }

    const statusOut = execFileSync('git', ['status', '--porcelain', '-uall', '--', '.'], {
      cwd: workspaceDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    });

    const workingTreeEligible = new Set<string>();
    for (const rawLine of statusOut.split(/\r?\n/)) {
      if (rawLine.length < 4) continue;
      const status = rawLine.slice(0, 2);
      if (status.includes('D')) continue;
      let filePart = rawLine.slice(3).trim();
      if (filePart.includes(' -> ')) {
        filePart = (filePart.split(' -> ').pop() ?? '').trim();
      }
      filePart = filePart.replace(/^"|"$/g, '');
      if (!filePart) continue;
      const absFromRepo = path.resolve(topLevel, filePart);
      const relToWorkspace = path.relative(realWorkspace, absFromRepo).split(path.sep).join('/');
      if (
        relToWorkspace &&
        !relToWorkspace.startsWith('..') &&
        isEligibleTouchedCodeFile(workspaceDir, relToWorkspace)
      ) {
        workingTreeEligible.add(relToWorkspace);
      }
    }

    if (workingTreeEligible.size > 0) {
      return [...workingTreeEligible];
    }

    try {
      const lastCommitOut = execFileSync(
        'git',
        ['diff', '--relative', '--name-only', '--diff-filter=ACMR', 'HEAD~1', 'HEAD', '--', '.'],
        {
          cwd: workspaceDir,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 2000,
        },
      );
      const committedEligible = new Set<string>();
      for (const line of lastCommitOut.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && isEligibleTouchedCodeFile(workspaceDir, trimmed)) {
          committedEligible.add(trimmed);
        }
      }
      return [...committedEligible];
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

function normalizeDynamicSegment(seg: string): string | null {
  if (/^\[\[.*\]\]$/.test(seg)) return null;
  if (/^\[\.\.\..+\]$/.test(seg)) return 'sample';
  const paramMatch = seg.match(/^\[([^\]]+)\]$/);
  if (paramMatch) {
    const name = paramMatch[1].toLowerCase();
    if (name.includes('id') || name.includes('num')) return '1';
    return 'sample';
  }
  if ((seg.startsWith(':') || seg.startsWith('$')) && seg.length > 1) {
    const name = seg.slice(1).toLowerCase();
    return name.includes('id') || name.includes('num') ? '1' : 'sample';
  }
  return seg;
}

function normalizeRouteSegments(
  rawSegs: string[],
  options: { disallowApi?: boolean; disallowSlots?: boolean } = {},
): string | null {
  const { disallowApi = false, disallowSlots = false } = options;
  const segments: string[] = [];
  for (const seg of rawSegs) {
    if (!seg) continue;
    if (disallowApi && seg === 'api') return null;
    if (disallowSlots && seg.startsWith('@')) return null;

    const rootIntercept = seg.match(/^\(\.\.\.\)(.+)$/);
    if (rootIntercept) {
      segments.length = 0;
      const mapped = normalizeDynamicSegment(rootIntercept[1]);
      if (mapped) segments.push(mapped);
      continue;
    }

    const upIntercept = seg.match(/^((?:\(\.\.\))+)(.+)$/);
    if (upIntercept) {
      const upCount = Math.floor(upIntercept[1].length / 4);
      segments.splice(Math.max(0, segments.length - upCount), upCount);
      const mapped = normalizeDynamicSegment(upIntercept[2]);
      if (mapped) segments.push(mapped);
      continue;
    }

    const sameIntercept = seg.match(/^\(\.\)(.+)$/);
    if (sameIntercept) {
      const mapped = normalizeDynamicSegment(sameIntercept[1]);
      if (mapped) segments.push(mapped);
      continue;
    }

    if (seg.startsWith('(') && seg.endsWith(')')) continue;

    const mapped = normalizeDynamicSegment(seg);
    if (mapped) segments.push(mapped);
  }
  return '/' + segments.join('/');
}

function isSpaRootEntryFile(normPath: string): boolean {
  return /^(?:src\/)?(?:frontend\/)?(?:App|main|index|app\.component)\.(?:tsx|jsx|ts|vue|svelte|html)$/i.test(
    normPath,
  );
}

function fileBasedRouteFromFilePath(relPath: string): string | null {
  const norm = relPath.replace(/\\/g, '/');

  const appMatch = norm.match(
    /^(?:src\/)?app\/(?:(.*)\/)?(?:page|layout|template|default)\.(?:tsx|jsx|ts|js|mdx)$/i,
  );
  if (appMatch) {
    const rawDir = appMatch[1] || '';
    if (!rawDir.startsWith('pages/') && rawDir !== 'pages') {
      return normalizeRouteSegments(rawDir.split('/').filter(Boolean), {
        disallowApi: true,
        disallowSlots: true,
      });
    }
  }

  const svelteMatch = norm.match(
    /^(?:src\/)?routes\/(?:(.*)\/)?\+(?:page|layout)(?:@[a-z0-9_-]*)?\.(?:svelte|ts|js)$/i,
  );
  if (svelteMatch) {
    const rawDir = svelteMatch[1] || '';
    return normalizeRouteSegments(rawDir.split('/').filter(Boolean), { disallowApi: true });
  }

  const pagesMatch = norm.match(
    /^(?:(?:src|app)\/)?pages\/(.+)\.(?:tsx|jsx|ts|js|vue|astro|svelte|mdx)$/i,
  );
  if (pagesMatch) {
    const body = pagesMatch[1];
    if (body.startsWith('api/') || body.startsWith('_') || body === '404' || body === '500') {
      return null;
    }
    const rawSegs = body.split('/').filter(Boolean);
    if (rawSegs[rawSegs.length - 1] === 'index') rawSegs.pop();
    return normalizeRouteSegments(rawSegs);
  }

  const fileRoutesMatch = norm.match(
    /^(?:src\/)?routes\/(.+)\.(?:tsx|jsx|ts|js|vue|svelte)$/i,
  );
  if (fileRoutesMatch) {
    const body = fileRoutesMatch[1];
    const baseName = path.posix.basename(body);
    if (
      body.startsWith('api/') ||
      baseName.startsWith('+') ||
      baseName.startsWith('_') ||
      body === '404' ||
      body === '500'
    ) {
      return null;
    }
    const rawSegs = body.split('/').filter(Boolean);
    if (rawSegs[rawSegs.length - 1] === 'index') rawSegs.pop();
    return normalizeRouteSegments(rawSegs);
  }

  return null;
}

export function routeFromFilePath(relPath: string): string | null {
  const fileRoute = fileBasedRouteFromFilePath(relPath);
  if (fileRoute !== null) return fileRoute;
  const norm = relPath.replace(/\\/g, '/');
  if (isSpaRootEntryFile(norm)) return '/';
  return null;
}

function normalizeCandidateRouteString(
  rawCandidate: string | undefined,
  content: string,
): string | null {
  if (rawCandidate === undefined || rawCandidate === null || rawCandidate.includes('*')) return null;
  if (/\.[a-z0-9]{1,5}$/i.test(rawCandidate)) return null;
  if (rawCandidate === '') return '/';
  if (!rawCandidate.startsWith('/') && !/routes/i.test(content)) return null;
  const segs = rawCandidate
    .split('/')
    .filter(Boolean)
    .map(normalizeDynamicSegment)
    .filter((s): s is string => Boolean(s));
  return '/' + segs.join('/');
}

function extractExplicitRoutesFromSource(content: string): string[] {
  const found: string[] = [];
  const routePatterns = [
    /\bpath\s*:\s*['"](\/?[a-zA-Z0-9/_:-]*)['"]/g,
    /<Route[^>]*\bpath\s*=\s*['"](\/[a-zA-Z0-9/_:-]*)['"]/g,
    /\bapp\.get\s*\(\s*['"](\/(?!api\/)[a-zA-Z0-9/_:-]*)['"]/g,
  ];
  for (const re of routePatterns) {
    for (const match of content.matchAll(re)) {
      const norm = normalizeCandidateRouteString(match[1], content);
      if (norm) found.push(norm);
    }
  }
  return found;
}

function extractRoutesMatchingTokens(content: string, tokens: Iterable<string>): string[] {
  const targetSymbols = new Set<string>();
  const targetSpecifiers: string[] = [];

  for (const tok of tokens) {
    if (!tok) continue;
    targetSpecifiers.push(tok);
    if (/^[A-Za-z_$][\w$]*$/.test(tok)) {
      targetSymbols.add(tok);
    }
  }

  const importRe = /\bimport\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  for (const m of content.matchAll(importRe)) {
    const clause = m[1].trim();
    const spec = m[2];
    const matchesTok = targetSpecifiers.some(
      (tok) =>
        spec === tok ||
        spec.endsWith(`/${tok}`) ||
        spec.includes(`/${tok}.`) ||
        spec.includes(`/${tok}/`) ||
        spec === `./${tok}`,
    );
    if (!matchesTok) continue;

    const braceIdx = clause.indexOf('{');
    const beforeBrace = (braceIdx === -1 ? clause : clause.slice(0, braceIdx))
      .replace(/,/g, '')
      .trim();
    if (beforeBrace && /^[A-Za-z_$][\w$]*$/.test(beforeBrace)) {
      targetSymbols.add(beforeBrace);
    }
    const nsMatch = beforeBrace.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (nsMatch) targetSymbols.add(nsMatch[1]);

    if (braceIdx !== -1) {
      const closeBrace = clause.indexOf('}', braceIdx);
      const namedBody =
        closeBrace === -1
          ? clause.slice(braceIdx + 1)
          : clause.slice(braceIdx + 1, closeBrace);
      for (const part of namedBody.split(',')) {
        const clean = part.replace(/^\s*type\s+/, '').trim();
        if (!clean) continue;
        const asParts = clean.split(/\s+as\s+/);
        const localName = (asParts[asParts.length - 1] || '').trim();
        if (/^[A-Za-z_$][\w$]*$/.test(localName)) {
          targetSymbols.add(localName);
        }
      }
    }
  }

  const snippetMatchesTargets = (snippet: string): boolean => {
    for (const sym of targetSymbols) {
      const symRe = new RegExp(
        `(?<![\\w$])${sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w$])`,
      );
      if (symRe.test(snippet)) return true;
    }
    for (const spec of targetSpecifiers) {
      if (snippet.includes(`/${spec}`) || snippet.includes(`./${spec}`)) return true;
    }
    return false;
  };

  const matchedRoutes: string[] = [];

  const jsxRouteRe = /<Route\b[\s\S]*?(?:\/>|<\/Route>)/g;
  for (const m of content.matchAll(jsxRouteRe)) {
    const tagBlock = m[0];
    if (!snippetMatchesTargets(tagBlock)) continue;
    const pathMatch = tagBlock.match(/\bpath\s*=\s*['"](\/?[a-zA-Z0-9/_:-]*)['"]/);
    if (pathMatch) {
      const norm = normalizeCandidateRouteString(pathMatch[1], content);
      if (norm) matchedRoutes.push(norm);
    }
  }

  const objRouteRe = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  for (const m of content.matchAll(objRouteRe)) {
    const objBlock = m[0];
    const pathMatch = objBlock.match(/\bpath\s*:\s*['"](\/?[a-zA-Z0-9/_:-]*)['"]/);
    if (!pathMatch) continue;
    if (!snippetMatchesTargets(objBlock)) continue;
    const norm = normalizeCandidateRouteString(pathMatch[1], content);
    if (norm) matchedRoutes.push(norm);
  }

  return matchedRoutes;
}

function componentSearchTokensForFile(relPath: string): string[] {
  const norm = relPath.replace(/\\/g, '/');
  const ext = path.posix.extname(norm);
  const rawStem = path.posix.basename(norm, ext);
  const withoutExt = norm.slice(0, norm.length - ext.length);
  const tokens = new Set<string>();

  if (rawStem === 'index') {
    const parentDir = path.posix.basename(path.posix.dirname(norm));
    if (
      parentDir &&
      parentDir !== '.' &&
      parentDir !== 'src' &&
      !NON_COMPONENT_STEMS.has(parentDir.toLowerCase())
    ) {
      tokens.add(parentDir);
    }
    const dirWithoutIndex = path.posix.dirname(norm);
    if (dirWithoutIndex && dirWithoutIndex !== '.') {
      tokens.add(dirWithoutIndex.replace(/^src\//, ''));
    }
  } else if (rawStem && !NON_COMPONENT_STEMS.has(rawStem.toLowerCase())) {
    tokens.add(rawStem.replace(/\.component$/i, ''));
    tokens.add(rawStem);
    tokens.add(withoutExt.replace(/^src\//, ''));
  }

  return [...tokens].filter(Boolean);
}

export function normalizeRoutes(routes: readonly string[], maxRoutes = 5): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of routes) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    let r = raw.trim();
    if (!r.startsWith('/')) r = '/' + r;
    if (r.length > 1) r = r.replace(/\/+$/, '');
    if (!seen.has(r)) {
      seen.add(r);
      ordered.push(r);
    }
    if (ordered.length >= maxRoutes) break;
  }
  return ordered.length > 0 ? ordered : ['/'];
}

export function discoverTouchedFilesAndRoutes(
  workspaceDir: string,
  options: { routes?: string[]; allFiles?: boolean; maxRoutes?: number } = {},
): { touchedFiles: string[]; routes: string[]; discoverySource: DiscoverySource } {
  const allWorkspaceFiles = listWorkspaceFiles(workspaceDir).filter(
    (rel) => !TEST_FILE_RE.test(rel),
  );
  const gitChanged = options.allFiles ? null : getGitChangedFiles(workspaceDir);

  const touchedFiles = gitChanged !== null ? gitChanged : allWorkspaceFiles;

  if (Array.isArray(options.routes) && options.routes.length > 0) {
    return {
      touchedFiles,
      routes: normalizeRoutes(options.routes, options.maxRoutes ?? 5),
      discoverySource: 'explicit',
    };
  }

  const candidateRoutes: string[] = [];
  const visitedTokens = new Set<string>();
  let frontier = new Set<string>();

  for (const rel of touchedFiles) {
    const fileRoute = fileBasedRouteFromFilePath(rel);
    if (fileRoute) {
      candidateRoutes.push(fileRoute);
    }

    let explicitRoutes: string[] = [];
    try {
      const content = readFileSync(path.join(workspaceDir, rel), 'utf8');
      explicitRoutes = extractExplicitRoutesFromSource(content);
    } catch {
      // Ignore unreadable files
    }

    if (explicitRoutes.length > 0) {
      candidateRoutes.push(...explicitRoutes);
    } else if (!fileRoute) {
      if (isSpaRootEntryFile(rel.replace(/\\/g, '/'))) {
        candidateRoutes.push('/');
      } else {
        for (const tok of componentSearchTokensForFile(rel)) {
          visitedTokens.add(tok);
          frontier.add(tok);
        }
      }
    }
  }

  if (frontier.size > 0) {
    const contentByFile = new Map<string, string>();
    for (const rel of allWorkspaceFiles) {
      try {
        contentByFile.set(rel, readFileSync(path.join(workspaceDir, rel), 'utf8'));
      } catch {
        // Ignore
      }
    }

    for (let hop = 0; hop < 3 && frontier.size > 0; hop++) {
      const nextFrontier = new Set<string>();
      for (const [rel, text] of contentByFile.entries()) {
        const importsFrontier = [...frontier].some(
          (tok) =>
            text.includes(`/${tok}'`) ||
            text.includes(`/${tok}"`) ||
            text.includes(`/${tok}/`) ||
            text.includes(`/${tok}.`) ||
            text.includes(`./${tok}`) ||
            text.includes(`<${tok}`),
        );
        if (!importsFrontier) continue;

        const fileRoute = fileBasedRouteFromFilePath(rel);
        if (fileRoute) {
          candidateRoutes.push(fileRoute);
          continue;
        }

        const targetedExplicit = extractRoutesMatchingTokens(text, frontier);
        if (targetedExplicit.length > 0) {
          candidateRoutes.push(...targetedExplicit);
          continue;
        }

        const allExplicit = extractExplicitRoutesFromSource(text);
        if (allExplicit.length > 0) {
          candidateRoutes.push(...allExplicit);
          continue;
        }

        if (isSpaRootEntryFile(rel.replace(/\\/g, '/'))) {
          candidateRoutes.push('/');
          continue;
        }

        for (const parentTok of componentSearchTokensForFile(rel)) {
          if (!visitedTokens.has(parentTok)) {
            visitedTokens.add(parentTok);
            nextFrontier.add(parentTok);
          }
        }
      }
      frontier = nextFrontier;
    }
  }

  return {
    touchedFiles,
    routes: normalizeRoutes(candidateRoutes, options.maxRoutes ?? 5),
    discoverySource: gitChanged !== null ? 'git-diff' : 'workspace',
  };
}

export async function probeHttpServer(url: string, timeoutMs = 450): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    });
    return res.status > 0 && res.status < 600;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function findFreePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

function killProcessGroup(child: ChildProcess | null): Promise<void> {
  if (!child || !child.pid) return Promise.resolve();
  const pid = child.pid;
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    child.once('exit', finish);
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        child.kill('SIGTERM');
      } catch {
        finish();
        return;
      }
    }
    const timer = setTimeout(() => {
      if (!settled) {
        try {
          process.kill(-pid, 'SIGKILL');
        } catch {
          try {
            child.kill('SIGKILL');
          } catch {
            // Already exited
          }
        }
        finish();
      }
    }, 400);
    if (typeof timer === 'object' && 'unref' in timer) {
      timer.unref();
    }
  });
}

export interface DevServerHandle {
  baseUrl: string;
  reused: boolean;
  stop: () => Promise<void>;
}

export interface EnsureDevServerOptions {
  url?: string;
  port?: number;
  devCmd?: string;
  boot?: boolean;
  forceBoot?: boolean;
  startupTimeoutMs?: number;
}

export async function ensureDevServer(
  project: ProjectConfig,
  options: EnsureDevServerOptions = {},
): Promise<DevServerHandle> {
  if (options.url) {
    const cleanUrl = options.url.replace(/\/+$/, '');
    if (!(await probeHttpServer(cleanUrl, 1500))) {
      throw new Error(`Explicit server URL ${cleanUrl} is not reachable.`);
    }
    return {
      baseUrl: cleanUrl,
      reused: true,
      stop: async () => {},
    };
  }

  const targetPort = options.port || project.port;
  const defaultUrl = `http://127.0.0.1:${targetPort}`;
  const localhostUrl = `http://localhost:${targetPort}`;

  if (!options.forceBoot) {
    if (await probeHttpServer(localhostUrl)) {
      return { baseUrl: localhostUrl, reused: true, stop: async () => {} };
    }
    if (await probeHttpServer(defaultUrl)) {
      return { baseUrl: defaultUrl, reused: true, stop: async () => {} };
    }
  }

  if (options.boot === false) {
    throw new Error(
      `No running dev server detected at ${localhostUrl} (and --no-boot was specified).`,
    );
  }

  const bootCmd = options.devCmd || project.devCmd;
  if (!bootCmd) {
    throw new Error(
      `No running server on port ${targetPort} and no "dev" or "start" script found in package.json.`,
    );
  }

  const spawnPort = options.forceBoot ? await findFreePort() : targetPort;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(spawnPort),
    BROWSER: 'none',
    CI: '1',
  };

  let extraArgs = '';
  const devScript = project.scripts.dev ?? '';
  if (options.forceBoot && /\bvite\b/.test(devScript) && !devScript.includes('--port')) {
    extraArgs = ` -- --port ${spawnPort}`;
  }

  const child = spawn('sh', ['-c', `${bootCmd}${extraArgs}`], {
    cwd: project.workspaceDir,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let detectedPort = spawnPort;
  const logChunks: string[] = [];
  const onOutput = (chunk: Buffer): void => {
    const clean = chunk.toString('utf8').replace(ANSI_ESCAPE_RE, '');
    logChunks.push(clean);
    if (logChunks.length > 40) logChunks.shift();
    const urlMatch = clean.match(
      /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\]):(\d{2,5})/,
    );
    if (urlMatch) {
      detectedPort = Number(urlMatch[1]);
    }
  };

  child.stdout?.on('data', onOutput);
  child.stderr?.on('data', onOutput);

  let earlyExitCode: number | null = null;
  child.once('exit', (code) => {
    earlyExitCode = code ?? 1;
  });

  const startupTimeoutMs = options.startupTimeoutMs ?? 8000;
  const deadline = Date.now() + startupTimeoutMs;

  while (Date.now() < deadline) {
    if (earlyExitCode !== null) {
      await killProcessGroup(child);
      throw new Error(
        `Dev server "${bootCmd}" exited prematurely (code ${earlyExitCode}):\n${logChunks.join('').trim().slice(-600)}`,
      );
    }
    const ipv4Url = `http://127.0.0.1:${detectedPort}`;
    if (await probeHttpServer(ipv4Url, 250)) {
      return {
        baseUrl: ipv4Url,
        reused: false,
        stop: () => killProcessGroup(child),
      };
    }
    const localUrl = `http://localhost:${detectedPort}`;
    if (await probeHttpServer(localUrl, 250)) {
      return {
        baseUrl: localUrl,
        reused: false,
        stop: () => killProcessGroup(child),
      };
    }
    await new Promise<void>((r) => setTimeout(r, 80));
  }

  await killProcessGroup(child);
  throw new Error(
    `Timed out after ${startupTimeoutMs}ms waiting for dev server "${bootCmd}" on port ${detectedPort}.\n${logChunks.join('').trim().slice(-600)}`,
  );
}
