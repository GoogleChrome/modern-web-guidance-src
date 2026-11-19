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

export type ActivePackName = 'commerce' | 'media' | 'saas';
export type PackSource = 'explicit' | 'package.json' | 'auto' | 'none';
export type DiscoverySource = 'explicit' | 'git-diff' | 'workspace' | 'none';

export type FrameworkId =
  | 'nextjs'
  | 'nuxt'
  | 'solidjs'
  | 'astro'
  | 'angular'
  | 'svelte'
  | 'vue'
  | 'react'
  | 'vanilla';

export type FindingCategory =
  | 'RUNTIME'
  | 'A11Y'
  | 'SMOKE'
  | 'PACK:COMMERCE'
  | 'PACK:MEDIA'
  | 'PACK:SAAS'
  | 'PERF'
  | 'MODERNITY';

export type FindingSeverity = 'error' | 'warning';

export interface VerificationFinding {
  category: FindingCategory;
  severity: FindingSeverity;
  route?: string;
  file?: string | null;
  line?: number | null;
  ruleId?: string;
  message: string;
  guides: string[];
  fix: string;
}

export interface ProjectConfig {
  workspaceDir: string;
  framework: FrameworkId;
  frameworkName: string;
  pack: ActivePackName | null;
  packSource: PackSource;
  packageManager: 'pnpm' | 'yarn' | 'bun' | 'npm';
  devCmd: string | null;
  port: number;
  scripts: Record<string, string | undefined>;
  dependencies: string[];
}

export interface FileRecord {
  relPath: string;
  raw: string;
  stripped: string;
}

export interface NodeHint {
  tag?: string;
  id?: string | null;
  testId?: string | null;
  className?: string | null;
  text?: string;
  html?: string;
  selector?: string;
  debugFile?: string | null;
  debugLine?: number | null;
  ownerComponent?: string | null;
  hasFrameworkClick?: boolean;
}

export interface PerfRouteMetrics {
  route: string;
  cls: number;
  lcpMs: number;
  loafCount: number;
  maxLoafMs: number;
  interactionLoafMs: number;
  domNodes: number;
  detachedDomNodes: number;
  jsHeapUsedMb: number;
  jsHeapTotalMb: number;
  globalWindowListeners: number;
  globalDocumentListeners: number;
  maxListenerTypeCount: number;
}

export interface PerfSummary {
  maxCls: number;
  maxLcpMs: number;
  maxLoafMs: number;
  maxInteractionLoafMs: number;
  maxDomNodes: number;
  maxDetachedDomNodes: number;
  maxJsHeapUsedMb: number;
  maxGlobalListeners: number;
  routes: PerfRouteMetrics[];
}

export interface StaticPassSummary {
  durationMs: number;
  scannedFilesCount: number;
  legacyScanAvailable: boolean;
  matchedGuides: string[];
}

export interface BrowserPassSummary {
  durationMs: number;
  axeInjected: boolean;
  wcagRulesEvaluatedCount: number;
  packMetrics: Array<Record<string, unknown>>;
}

export interface VerificationReport {
  passed: boolean;
  staticOnly: boolean;
  durationMs: number;
  workspaceDir: string;
  framework: FrameworkId;
  frameworkName: string;
  pack: ActivePackName | null;
  packSource: PackSource;
  discoverySource: DiscoverySource;
  touchedFiles: string[];
  routes: string[];
  errorCount: number;
  warningCount: number;
  infraWarning: string | null;
  infraFailed: boolean;
  passes: {
    static: StaticPassSummary | null;
    browser: BrowserPassSummary | null;
    perf: PerfSummary | null;
  };
  findings: VerificationFinding[];
  formatted: string;
}

export interface VerifyOptions {
  workspaceDir?: string;
  url?: string;
  port?: number;
  routes?: string[];
  maxRoutes?: number;
  pack?: string;
  perf?: boolean;
  devCmd?: string;
  boot?: boolean;
  forceBoot?: boolean;
  startupTimeoutMs?: number;
  chromePath?: string;
  launchTimeoutMs?: number;
  smokeProbe?: boolean;
  staticOnly?: boolean;
  allFiles?: boolean;
  strict?: boolean;
  requireBrowser?: boolean;
  allowMissingBrowser?: boolean;
  maxFindings?: number;
}

export interface MaintainabilityHint {
  file: string;
  lineCount: number;
  ruleId: string;
  reason: string;
  guides: string[];
}

export interface ContextGuideItem {
  id: string;
  score: number;
  reasons: string[];
  content?: string;
  source?: 'local-corpus';
}

export interface ContextGuidesResult {
  durationMs: number;
  workspaceDir: string;
  framework: FrameworkId;
  frameworkName: string;
  pack: ActivePackName | null;
  touchedFiles: string[];
  routes: string[];
  guideIds: string[];
  retrieveCommand: string | null;
  guides: ContextGuideItem[];
  maintainabilityHints: MaintainabilityHint[];
}

export interface ContextGuidesOptions {
  workspaceDir?: string;
  files?: string[];
  pack?: string;
  limit?: number;
  includeContent?: boolean;
  allFiles?: boolean;
  mwgGuidesDir?: string;
}
