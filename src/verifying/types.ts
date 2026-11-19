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

export type FindingCategory = 'RUNTIME' | 'A11Y' | 'LAYOUT' | 'MODERNITY' | 'PERF' | 'SMOKE';

export type FindingSeverity = 'error' | 'warning' | 'info';

export interface ResolvedSourceLocation {
  framework: string;
  component: string;
  file: string | null;
  line: number | null;
  column: number | null;
}

export interface VerificationFinding {
  id: string;
  fingerprint: string;
  category: FindingCategory;
  severity: FindingSeverity;
  url?: string;
  selector?: string | null;
  file?: string | null;
  line?: number | null;
  column?: number | null;
  framework?: string | null;
  message: string;
  fix: string;
  guides: string[];
}

export interface BrowserAuditFinding {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  selector: string;
  file: string | null;
  line: number | null;
  column: number | null;
  framework: string | null;
  message: string;
  fix: string;
  guides: string[];
}

export interface InteractiveCandidate {
  smokeIdx: number;
  selector: string;
  label: string;
  file: string | null;
  line: number | null;
  column: number | null;
  framework: string | null;
}

export interface PageAuditResult {
  finalUrl: string;
  findings: BrowserAuditFinding[];
  interactiveCandidates: InteractiveCandidate[];
  openModalCount: number;
  cls: number;
  lcpMs: number | null;
}

export interface VerifyOptions {
  url?: string;
  targetDir?: string;
  mobile?: boolean;
  cpuThrottle?: number;
  baselinePath?: string;
  smokeProbe?: boolean;
  timeoutMs?: number;
  chromePath?: string;
}

export interface VerifyReport {
  passed: boolean;
  url: string | null;
  targetDir: string | null;
  viewport: { width: number; height: number; mobile: boolean } | null;
  cpuThrottle: number | null;
  durationMs: number;
  findingsCount: number;
  suppressedCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  cls: number | null;
  lcpMs: number | null;
  guides: string[];
  findings: VerificationFinding[];
}

export interface VerifyingCliResult {
  exitCode: number;
  stdout?: string;
  stderr?: string;
  data?: VerifyReport;
}
