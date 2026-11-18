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

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { runBrowserPass, type BrowserPassResult } from './browser-pass.ts';
import { launchHeadlessBrowser, type HeadlessBrowser } from './cdp.ts';
import {
  detectProjectConfig,
  discoverTouchedFilesAndRoutes,
  ensureDevServer,
  type DevServerHandle,
} from './discovery.ts';
import { formatVerificationReport } from './reporter.ts';
import { runStaticPass } from './static-pass.ts';
import type { VerificationReport, VerifyOptions } from './types.ts';

export async function runVerification(options: VerifyOptions = {}): Promise<VerificationReport> {
  const startedAt = performance.now();
  const workspaceDir = path.resolve(options.workspaceDir || process.cwd());
  const staticOnly = Boolean(options.staticOnly);
  const perf = Boolean(options.perf);

  let workspaceExists = false;
  try {
    workspaceExists = existsSync(workspaceDir) && statSync(workspaceDir).isDirectory();
  } catch {
    workspaceExists = false;
  }
  if (!workspaceExists) {
    const missingMsg = `Workspace directory does not exist: ${workspaceDir}`;
    const baseReport: Omit<VerificationReport, 'formatted'> = {
      passed: false,
      staticOnly,
      durationMs: Math.round(performance.now() - startedAt),
      workspaceDir,
      framework: 'vanilla',
      frameworkName: 'Vanilla',
      pack: null,
      packSource: 'none',
      discoverySource: 'none',
      touchedFiles: [],
      routes: ['/'],
      errorCount: 1,
      warningCount: 0,
      infraWarning: missingMsg,
      infraFailed: true,
      passes: { static: null, browser: null, perf: null },
      findings: [],
    };
    return {
      ...baseReport,
      formatted: formatVerificationReport(baseReport, {
        maxFindings: options.maxFindings ?? 20,
      }),
    };
  }

  const failOnInfra = staticOnly
    ? false
    : !options.allowMissingBrowser && options.requireBrowser !== false;

  const project = detectProjectConfig(workspaceDir, { pack: options.pack });
  const discovery = discoverTouchedFilesAndRoutes(workspaceDir, {
    routes: options.routes,
    allFiles: options.allFiles,
    maxRoutes: options.maxRoutes ?? 5,
  });

  // Branch 1: Static Modernity (`legacy-scan`) + Workspace ESLint + Static Pack Checks at t=0ms
  const staticPromise = runStaticPass(workspaceDir, discovery.touchedFiles, project);

  // Branch 2: Dev Server + Headless CDP Pass runs concurrently with leak-free lifecycle guarantees
  let browserResult: BrowserPassResult | null = null;
  let infraWarning: string | null = null;

  if (!staticOnly) {
    let serverHandle: DevServerHandle | null = null;
    let browser: HeadlessBrowser | null = null;
    try {
      const [srvSettled, brwSettled] = await Promise.allSettled([
        ensureDevServer(project, {
          url: options.url,
          port: options.port,
          devCmd: options.devCmd,
          boot: options.boot !== false,
          forceBoot: Boolean(options.forceBoot),
          startupTimeoutMs: options.startupTimeoutMs ?? 8000,
        }),
        launchHeadlessBrowser({
          executablePath: options.chromePath,
          launchTimeoutMs: options.launchTimeoutMs ?? 5000,
        }),
      ]);

      if (srvSettled.status === 'fulfilled') {
        serverHandle = srvSettled.value;
      }
      if (brwSettled.status === 'fulfilled') {
        browser = brwSettled.value;
      }
      if (srvSettled.status === 'rejected') {
        throw srvSettled.reason;
      }
      if (brwSettled.status === 'rejected') {
        throw brwSettled.reason;
      }

      if (serverHandle && browser) {
        browserResult = await runBrowserPass({
          browser,
          baseUrl: serverHandle.baseUrl,
          routes: discovery.routes,
          workspaceDir,
          touchedFiles: discovery.touchedFiles,
          smokeProbe: options.smokeProbe !== false,
          pack: project.pack,
          perf,
        });
      }
    } catch (err) {
      infraWarning = err instanceof Error ? err.message : String(err);
    } finally {
      await Promise.allSettled([
        browser ? browser.close() : Promise.resolve(),
        serverHandle ? serverHandle.stop() : Promise.resolve(),
      ]);
    }
  }

  const staticResult = await staticPromise;
  const findings = [
    ...(browserResult ? browserResult.findings : []),
    ...staticResult.findings,
  ];

  const errorCount =
    findings.filter((f) => f.severity === 'error').length + (failOnInfra && infraWarning ? 1 : 0);
  const warningCount = findings.filter((f) => f.severity !== 'error').length;
  const strict = Boolean(options.strict);

  const passed =
    errorCount === 0 && (!strict || warningCount === 0) && (!failOnInfra || !infraWarning);

  const baseReport: Omit<VerificationReport, 'formatted'> = {
    passed,
    staticOnly,
    durationMs: Math.round(performance.now() - startedAt),
    workspaceDir,
    framework: project.framework,
    frameworkName: project.frameworkName,
    pack: project.pack,
    packSource: project.packSource,
    discoverySource: discovery.discoverySource,
    touchedFiles: discovery.touchedFiles,
    routes: discovery.routes,
    errorCount,
    warningCount,
    infraWarning,
    infraFailed: Boolean(failOnInfra && infraWarning),
    passes: {
      static: {
        durationMs: staticResult.durationMs,
        scannedFilesCount: staticResult.scannedFilesCount,
        legacyScanAvailable: staticResult.legacyScanAvailable,
        matchedGuides: staticResult.matchedGuides,
      },
      browser: browserResult
        ? {
            durationMs: browserResult.durationMs,
            axeInjected: browserResult.axeInjected,
            wcagRulesEvaluatedCount: browserResult.wcagRulesEvaluatedCount,
            packMetrics: browserResult.packMetrics,
          }
        : null,
      perf: browserResult?.perfSummary ?? null,
    },
    findings,
  };

  return {
    ...baseReport,
    formatted: formatVerificationReport(baseReport, {
      maxFindings: options.maxFindings ?? 20,
    }),
  };
}
