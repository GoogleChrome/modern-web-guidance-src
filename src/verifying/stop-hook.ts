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

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverTouchedFilesAndRoutes } from './discovery.ts';
import type { VerifyOptions } from './types.ts';
import { runVerification } from './verify.ts';

const MAX_HOOK_RETRIES = 2;

export type AgentHostProtocol = 'antigravity' | 'cursor' | 'claude';

const SELF_PACKAGE_DIRS: ReadonlySet<string> = (() => {
  const dirs = new Set<string>();
  let cur = path.dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 5; depth++) {
    dirs.add(cur);
    try {
      dirs.add(realpathSync(cur));
    } catch {
      // Ignore
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return dirs;
})();

const SELF_PACKAGE_NAMES = new Set([
  'modern-web-guidance',
  'modern-web-guidance-src',
  'modern-web',
  'modern-web-verify',
]);

const WEB_DEP_NAMES = new Set([
  'react',
  'react-dom',
  'preact',
  'next',
  'nuxt',
  'vue',
  'svelte',
  '@sveltejs/kit',
  '@angular/core',
  'astro',
  'solid-js',
  '@solidjs/start',
  'vite',
  '@remix-run/react',
  'react-router',
  'react-router-dom',
  '@tanstack/react-router',
  '@tanstack/start',
  'lit',
  'htmx.org',
  'webpack',
  'webpack-dev-server',
  'parcel',
  '@rsbuild/core',
  '@builder.io/qwik',
  'qwik',
  'tailwindcss',
]);

const WEB_MARKER_FILES = [
  'index.html',
  'public/index.html',
  'src/index.html',
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mjs',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'astro.config.mjs',
  'astro.config.ts',
  'svelte.config.js',
  'nuxt.config.ts',
  'angular.json',
];

const UI_FILE_EXT_RE = /\.(?:html|htm|jsx|tsx|vue|svelte|astro|css|scss)$/i;

interface StopHookPayload {
  workspacePaths?: unknown;
  workspace_roots?: unknown;
  cwd?: unknown;
  terminationReason?: unknown;
  executionNum?: unknown;
  error?: unknown;
  fullyIdle?: unknown;
  hook_event_name?: unknown;
  status?: unknown;
  loop_count?: unknown;
  stop_hook_active?: unknown;
}

function detectHostProtocol(payload: StopHookPayload): AgentHostProtocol {
  if (
    'workspacePaths' in payload ||
    'terminationReason' in payload ||
    'executionNum' in payload
  ) {
    return 'antigravity';
  }
  if (
    'workspace_roots' in payload ||
    'loop_count' in payload ||
    payload.hook_event_name === 'stop'
  ) {
    return 'cursor';
  }
  return 'claude';
}

function allowStopPayload(protocol: AgentHostProtocol): Record<string, unknown> {
  if (protocol === 'antigravity') return { decision: 'stop' };
  return {};
}

function blockStopPayload(protocol: AgentHostProtocol, reason: string): Record<string, unknown> {
  if (protocol === 'antigravity') {
    return {
      decision: 'continue',
      reason,
    };
  }
  if (protocol === 'cursor') {
    return {
      followup_message: reason,
    };
  }
  return {
    decision: 'block',
    reason,
  };
}

function inspectWebWorkspaceCandidate(
  rawDir: unknown,
): { dir: string; hasExplicitWebSignal: boolean } | null {
  if (!rawDir || typeof rawDir !== 'string') return null;
  const resolved = path.resolve(rawDir);
  let realCandidate = resolved;
  try {
    realCandidate = realpathSync(resolved);
  } catch {
    // Keep resolved path
  }
  if (SELF_PACKAGE_DIRS.has(realCandidate) || SELF_PACKAGE_DIRS.has(resolved)) {
    return null;
  }

  const pkgPath = path.join(resolved, 'package.json');
  if (!existsSync(pkgPath)) {
    const hasRootHtml = WEB_MARKER_FILES.slice(0, 3).some((rel) =>
      existsSync(path.join(resolved, rel)),
    );
    return hasRootHtml ? { dir: resolved, hasExplicitWebSignal: true } : null;
  }

  let pkg: {
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    scripts?: Record<string, unknown>;
  } = {};
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as typeof pkg;
  } catch {
    return null;
  }
  if (pkg.name && SELF_PACKAGE_NAMES.has(pkg.name)) return null;

  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };

  const hasWebDep = Object.keys(allDeps).some((dep) => WEB_DEP_NAMES.has(dep));
  const hasWebMarker = WEB_MARKER_FILES.some((rel) => existsSync(path.join(resolved, rel)));
  const hasDevScript =
    typeof pkg.scripts?.dev === 'string' || typeof pkg.scripts?.start === 'string';

  if (hasWebDep || hasWebMarker) {
    return { dir: resolved, hasExplicitWebSignal: true };
  }
  if (hasDevScript) {
    return { dir: resolved, hasExplicitWebSignal: false };
  }
  return null;
}

function findWebWorkspace(
  candidates: readonly unknown[],
): { dir: string; hasExplicitWebSignal: boolean } | null {
  for (const raw of candidates) {
    const match = inspectWebWorkspaceCandidate(raw);
    if (match) return match;
  }
  return null;
}

function shouldSkipRetry(protocol: AgentHostProtocol, payload: StopHookPayload): boolean {
  if (protocol === 'antigravity') {
    if (payload.error) return true;
    if (payload.fullyIdle === false) return true;
    if (payload.terminationReason && payload.terminationReason !== 'NO_TOOL_CALL') {
      return true;
    }
    if (typeof payload.executionNum === 'number' && payload.executionNum > MAX_HOOK_RETRIES) {
      return true;
    }
    return false;
  }
  if (protocol === 'cursor') {
    if (payload.status && payload.status !== 'completed') return true;
    if (typeof payload.loop_count === 'number' && payload.loop_count >= MAX_HOOK_RETRIES) {
      return true;
    }
    return false;
  }
  if (payload.stop_hook_active === true) {
    return true;
  }
  return false;
}

export type VerifyRunnerFn = (
  options: VerifyOptions,
) => Promise<{ passed: boolean; formatted: string }>;

export async function runStopHook(
  rawStdin: string,
  verifyImpl?: VerifyRunnerFn | null,
): Promise<Record<string, unknown>> {
  let payload: StopHookPayload = {};
  if (rawStdin && rawStdin.trim()) {
    try {
      payload = JSON.parse(rawStdin) as StopHookPayload;
    } catch {
      return {};
    }
  }

  const protocol = detectHostProtocol(payload);
  if (shouldSkipRetry(protocol, payload)) {
    return allowStopPayload(protocol);
  }

  const explicitRoots = [
    ...(Array.isArray(payload.workspacePaths) ? payload.workspacePaths : []),
    ...(Array.isArray(payload.workspace_roots) ? payload.workspace_roots : []),
    ...(typeof payload.cwd === 'string' && payload.cwd.trim() ? [payload.cwd] : []),
  ];
  const candidateRoots = explicitRoots.length > 0 ? explicitRoots : [process.cwd()];

  const candidate = findWebWorkspace(candidateRoots);
  if (!candidate) {
    return allowStopPayload(protocol);
  }

  const workspaceDir = candidate.dir;
  const discovery = discoverTouchedFilesAndRoutes(workspaceDir);
  if (discovery.touchedFiles.length === 0) {
    return allowStopPayload(protocol);
  }
  if (
    !candidate.hasExplicitWebSignal &&
    !discovery.touchedFiles.some((f) => UI_FILE_EXT_RE.test(f))
  ) {
    return allowStopPayload(protocol);
  }

  try {
    const runVerifyFn: VerifyRunnerFn = verifyImpl ?? runVerification;
    const report = await runVerifyFn({
      workspaceDir,
      routes: discovery.routes,
      requireBrowser: true,
    });
    if (report.passed) {
      return allowStopPayload(protocol);
    }
    const reason = [
      '`modern-web-guidance verify` found web verification issues in your changes. Fix them before concluding:',
      '',
      report.formatted,
    ].join('\n');
    return blockStopPayload(protocol, reason);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[modern-web-guidance hook] fail-open on error: ${msg}\n`);
    return allowStopPayload(protocol);
  }
}
