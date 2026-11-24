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

import { existsSync, readFileSync } from 'node:fs';
import { runAnalyzeCli } from '../analyzing/cli.ts';
import { USE_CASES } from '../rag/guides.ts';
import { loadBrowserAuditBundle } from './browser-bundle.ts';
import { launchHeadlessBrowser, type PageSession } from './cdp.ts';
import type {
  PageAuditResult,
  VerificationFinding,
  VerifyOptions,
  VerifyReport,
} from './types.ts';

interface CdpRemoteObject {
  objectId?: string;
  type?: string;
  value?: unknown;
  description?: string;
}

const HYDRATION_RE =
  /hydration failed|did not match|text content does not match|hydration mismatch|tree hydrated|ssr-mismatch/i;

const VITE_HMR_RE = /\/@vite\/client|vite.*hmr|failed to connect to websocket/i;

const CWV_INIT_SCRIPT = `(() => {
  const state = { cls: 0, clsElement: null, lcpMs: null, lcpElement: null };
  window.__mwgCwv = state;
  if (typeof PerformanceObserver === 'undefined') return;
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.element) {
          state.lcpElement = e.element;
          state.lcpMs = Math.round(e.renderTime || e.startTime);
        }
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput || !(e.value > 0)) continue;
        state.cls += e.value;
        const srcNode = e.sources && e.sources[0] && e.sources[0].node;
        if (srcNode && srcNode.nodeType === 1) state.clsElement = srcNode;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
})();`;

let cachedGuideSet: Set<string> | null = null;

function verifiedGuides(guides: readonly string[]): string[] {
  if (!cachedGuideSet) cachedGuideSet = new Set(USE_CASES.map((u) => u.id));
  return [...new Set(guides.filter((id) => cachedGuideSet!.has(id)))];
}

export function buildFingerprint(finding: {
  id: string;
  file?: string | null;
  line?: number | null;
  selector?: string | null;
  message: string;
}): string {
  const anchor = finding.file
    ? `${finding.file}:${finding.line ?? 1}`
    : finding.selector || finding.message.slice(0, 80);
  return `${finding.id}::${anchor}`;
}

export function filterAgainstBaseline(
  findings: readonly VerificationFinding[],
  baselinePayload: unknown,
): { findings: VerificationFinding[]; suppressedCount: number } {
  const raw = Array.isArray(baselinePayload)
    ? baselinePayload
    : baselinePayload && typeof baselinePayload === 'object' && Array.isArray((baselinePayload as { findings?: unknown }).findings)
      ? ((baselinePayload as { findings: unknown[] }).findings)
      : [];
  if (raw.length === 0) return { findings: [...findings], suppressedCount: 0 };

  const baselineKeys = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Partial<VerificationFinding>;
    if (typeof rec.fingerprint === 'string' && rec.fingerprint) {
      baselineKeys.add(rec.fingerprint);
    } else if (rec.id && rec.message) {
      baselineKeys.add(buildFingerprint({ id: rec.id, file: rec.file, line: rec.line, selector: rec.selector, message: rec.message }));
    }
  }

  const kept: VerificationFinding[] = [];
  let suppressedCount = 0;
  for (const f of findings) {
    if (baselineKeys.has(f.fingerprint)) suppressedCount++;
    else kept.push(f);
  }
  return { findings: kept, suppressedCount };
}

function summarizeHydrationMessage(raw: string): string {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const diffLines = lines.filter((l) => l.startsWith('+') || l.startsWith('-')).slice(0, 4);
  const summary = (lines[0] || raw).slice(0, 180);
  return diffLines.length > 0 ? `${summary} (${diffLines.join(' | ').slice(0, 120)})` : summary;
}

function formatCdpObject(arg: CdpRemoteObject | undefined): string {
  if (!arg) return '';
  if (typeof arg.value === 'string') return arg.value;
  if (arg.value !== undefined) return String(arg.value);
  return arg.description ?? arg.type ?? '';
}

async function detectCdpClickListeners(
  session: PageSession,
  url: string,
): Promise<VerificationFinding[]> {
  const objectGroup = 'mwg-verify-listeners';
  try {
    const arrRes = await session.send<{ result?: CdpRemoteObject }>('Runtime.evaluate', {
      objectGroup,
      returnByValue: false,
      expression: 'window.__mwgAudit ? window.__mwgAudit.collectCdpClickCandidates() : []',
    });
    const arrayId = arrRes.result?.objectId;
    if (!arrayId) return [];

    const props = await session.send<{ result?: Array<{ name: string; value?: CdpRemoteObject }> }>(
      'Runtime.getProperties',
      { objectId: arrayId, ownProperties: true },
    );
    const items = (props.result ?? []).filter((p) => /^\d+$/.test(p.name) && p.value?.objectId);
    const checks = await Promise.all(
      items.map(async (item): Promise<VerificationFinding | null> => {
        const objectId = item.value!.objectId!;
        try {
          const { listeners = [] } = await session.send<{ listeners?: Array<{ type?: string }> }>(
            'DOMDebugger.getEventListeners',
            { objectId },
          );
          if (!listeners.some((l) => l.type === 'click')) return null;
          const hasKeyboard = listeners.some(
            (l) => l.type === 'keydown' || l.type === 'keyup' || l.type === 'keypress',
          );
          const metaRes = await session.send<{
            result?: {
              value?: {
                selector: string;
                tag: string;
                role: string;
                tabIndex: string | null;
                ignored: boolean;
                framework: string;
                file: string | null;
                line: number | null;
                column: number | null;
              };
            };
          }>('Runtime.callFunctionOn', {
            objectId,
            returnByValue: true,
            functionDeclaration:
              'function() { return window.__mwgAudit ? window.__mwgAudit.describeElement(this) : null; }',
          });
          const info = metaRes.result?.value;
          if (!info || info.ignored) return null;
          if (hasKeyboard && info.role && info.tabIndex !== null && Number(info.tabIndex) >= 0) {
            return null;
          }
          const message = `<${info.tag}> (${info.selector}) has a JS click listener without button semantics or keyboard accessibility.`;
          return {
            id: 'a11y-non-semantic-click',
            fingerprint: buildFingerprint({
              id: 'a11y-non-semantic-click',
              file: info.file,
              line: info.line,
              selector: info.selector,
              message,
            }),
            category: 'A11Y',
            severity: 'error',
            url,
            selector: info.selector,
            file: info.file,
            line: info.line,
            column: info.column,
            framework: info.framework,
            message,
            fix: 'Use `<button type="button">` (or `<a href>` for navigation) instead of attaching click listeners to non-semantic elements.',
            guides: verifiedGuides(['accessibility']),
          };
        } catch {
          return null;
        }
      }),
    );
    return checks.filter((f): f is VerificationFinding => f !== null);
  } catch {
    return [];
  } finally {
    await session.send('Runtime.releaseObjectGroup', { objectGroup }).catch(() => {});
  }
}

async function runStaticLegacyScan(targetDir: string): Promise<VerificationFinding[]> {
  const res = await runAnalyzeCli(['.', '--json'], { cwd: targetDir });
  if (res.exitCode !== 0 || !res.data) return [];
  const findings: VerificationFinding[] = [];
  for (const guideGroup of res.data.guides) {
    for (const ruleGroup of guideGroup.rules) {
      for (const f of ruleGroup.findings) {
        const file = f.file.replace(/\\/g, '/');
        const id = ruleGroup.ruleId || guideGroup.guideId;
        const message = f.message || ruleGroup.summary || `Legacy pattern (${guideGroup.guideId})`;
        findings.push({
          id,
          fingerprint: buildFingerprint({ id, file, line: f.line || 1, message }),
          category: 'MODERNITY',
          severity: 'warning',
          file,
          line: f.line || 1,
          column: null,
          message,
          fix: ruleGroup.summary || `Apply modern web guidance \`${guideGroup.guideId}\`.`,
          guides: verifiedGuides([guideGroup.guideId]),
        });
      }
    }
  }
  return findings;
}

/**
 * Runs live Chromium verification against `options.url` and/or static
 * `legacy-scan` against `options.targetDir`, with optional mobile viewport,
 * CPU throttling, interactive focus-trap probing, and baseline suppression.
 */
export async function runVerify(options: VerifyOptions): Promise<VerifyReport> {
  const startedAt = performance.now();
  const findings: VerificationFinding[] = [];
  const seenFingerprints = new Set<string>();
  const addFinding = (f: VerificationFinding): void => {
    if (seenFingerprints.has(f.fingerprint)) return;
    seenFingerprints.add(f.fingerprint);
    findings.push(f);
  };

  let cls: number | null = null;
  let lcpMs: number | null = null;
  const mobile = Boolean(options.mobile);
  const cpuThrottle = options.cpuThrottle && options.cpuThrottle > 1 ? options.cpuThrottle : null;
  const viewport = options.url
    ? { width: mobile ? 390 : 1280, height: mobile ? 844 : 800, mobile }
    : null;

  if (options.url) {
    const targetUrl = options.url;
    const targetOrigin = new URL(targetUrl).origin;
    const browserBundle = await loadBrowserAuditBundle();
    const browser = await launchHeadlessBrowser({
      executablePath: options.chromePath,
      launchTimeoutMs: options.timeoutMs ?? 10_000,
    });

    try {
      await browser.withPageSession({ mobile, cpuThrottle: cpuThrottle ?? undefined }, async (session) => {
        await Promise.all([
          session.send('Page.enable'),
          session.send('Runtime.enable'),
          session.send('Log.enable'),
          session.send('Network.enable'),
          session.send('Page.addScriptToEvaluateOnNewDocument', { source: CWV_INIT_SCRIPT }),
        ]);

        const runtimeErrors: Array<{ id: string; message: string; fix: string }> = [];
        const inFlight = new Set<string>();
        let mainDocStatus: number | null = null;
        let viteHmrErrors = 0;

        const recordRuntime = (raw: string, sourceUrl = ''): void => {
          if (!raw) return;
          if (VITE_HMR_RE.test(raw) || VITE_HMR_RE.test(sourceUrl)) {
            viteHmrErrors++;
            return;
          }
          if (HYDRATION_RE.test(raw)) {
            runtimeErrors.push({
              id: 'ssr-hydration-mismatch',
              message: summarizeHydrationMessage(raw),
              fix: 'Ensure SSR and initial client render are deterministic (avoid `Date.now()`, `Math.random()`, or `window` branching during initial render).',
            });
            return;
          }
          runtimeErrors.push({
            id: 'runtime-error',
            message: raw.split('\n')[0].trim().slice(0, 220),
            fix: 'Inspect the stack trace or failing endpoint and handle uncaught errors and failed requests.',
          });
        };

        session.on('Runtime.consoleAPICalled', (ev) => {
          const type = typeof ev.type === 'string' ? ev.type : '';
          if (type !== 'error' && type !== 'warning') return;
          const args = Array.isArray(ev.args) ? (ev.args as CdpRemoteObject[]) : [];
          const joined = args.map(formatCdpObject).join(' ').trim();
          if (!joined || (type === 'warning' && !HYDRATION_RE.test(joined))) return;
          recordRuntime(joined);
        });

        session.on('Runtime.exceptionThrown', (ev) => {
          const details = (ev.exceptionDetails ?? {}) as {
            text?: string;
            url?: string;
            exception?: CdpRemoteObject;
          };
          const desc = formatCdpObject(details.exception) || details.text || 'Uncaught exception';
          recordRuntime(desc, details.url ?? '');
        });

        session.on('Log.entryAdded', (ev) => {
          const entry = (ev.entry ?? {}) as { level?: string; source?: string; text?: string; url?: string };
          if (entry.level === 'error' && entry.source !== 'network' && entry.text) {
            recordRuntime(entry.text, entry.url ?? '');
          }
        });

        session.on('Network.requestWillBeSent', (ev) => {
          const id = typeof ev.requestId === 'string' ? ev.requestId : '';
          const type = typeof ev.type === 'string' ? ev.type : '';
          const reqUrl = (ev.request as { url?: string } | undefined)?.url ?? '';
          if (id && type !== 'WebSocket' && type !== 'EventSource' && !VITE_HMR_RE.test(reqUrl)) {
            inFlight.add(id);
          }
        });

        session.on('Network.loadingFinished', (ev) => {
          if (typeof ev.requestId === 'string') inFlight.delete(ev.requestId);
        });

        session.on('Network.responseReceived', (ev) => {
          const res = (ev.response ?? {}) as { url?: string; status?: number };
          const resUrl = res.url ?? '';
          const status = typeof res.status === 'number' ? res.status : 0;
          if (ev.type === 'Document' && resUrl.startsWith(targetOrigin) && mainDocStatus === null) {
            mainDocStatus = status;
          }
          if (status >= 400 && !resUrl.endsWith('/favicon.ico')) {
            if (VITE_HMR_RE.test(resUrl)) {
              viteHmrErrors++;
              return;
            }
            const shortPath = resUrl.startsWith(targetOrigin) ? resUrl.slice(targetOrigin.length) || '/' : resUrl;
            runtimeErrors.push({
              id: 'http-error',
              message: `HTTP ${status} on ${shortPath}`,
              fix: `Verify endpoint \`${shortPath}\` returns a successful status code.`,
            });
          }
        });

        session.on('Network.loadingFailed', (ev) => {
          if (typeof ev.requestId === 'string') inFlight.delete(ev.requestId);
          if (ev.canceled) return;
          const errText = typeof ev.errorText === 'string' ? ev.errorText : '';
          if (errText.includes('ERR_ABORTED')) return;
          if (ev.type === 'WebSocket' || VITE_HMR_RE.test(errText)) {
            viteHmrErrors++;
            return;
          }
          runtimeErrors.push({
            id: 'network-failure',
            message: `Network request failed (${errText || 'unknown'})`,
            fix: 'Check server connectivity, CORS headers, or broken asset URLs.',
          });
        });

        const loadDone = new Promise<void>((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            unsub();
            resolve();
          };
          const unsub = session.on('Page.loadEventFired', finish);
          const timer = setTimeout(finish, options.timeoutMs ?? 8000);
        });

        await session.send('Page.navigate', { url: targetUrl });
        await loadDone;
        await waitForNetworkSettle(inFlight, 250, 600);

        if (mainDocStatus !== null && mainDocStatus >= 400) {
          const message = `Target URL returned HTTP ${mainDocStatus}.`;
          addFinding({
            id: 'http-document-error',
            fingerprint: buildFingerprint({ id: 'http-document-error', message }),
            category: 'RUNTIME',
            severity: 'error',
            url: targetUrl,
            message,
            fix: 'Ensure the route renders without throwing an SSR or routing error.',
            guides: [],
          });
          return;
        }

        await session.send('Runtime.evaluate', { expression: browserBundle, returnByValue: false });

        const auditRes = await session.send<{ result?: { value?: PageAuditResult } }>('Runtime.evaluate', {
          expression: `window.__mwgAudit.runPageAudit(window, { viewportWidth: ${viewport!.width} })`,
          returnByValue: true,
        });
        const audit = auditRes.result?.value;
        if (audit) {
          cls = audit.cls;
          lcpMs = audit.lcpMs;
          for (const f of audit.findings) {
            addFinding({
              ...f,
              url: targetUrl,
              guides: verifiedGuides(f.guides),
              fingerprint: buildFingerprint(f),
            });
          }
        }

        for (const f of await detectCdpClickListeners(session, targetUrl)) {
          addFinding(f);
        }

        // Optional interactive smoke + Escape modal focus-trap/focus-return probe.
        const consumedRuntime = new Set<number>();
        if (options.smokeProbe !== false && audit && audit.interactiveCandidates.length > 0) {
          let prevModals = audit.openModalCount;
          for (const ctrl of audit.interactiveCandidates) {
            const beforeLen = runtimeErrors.length;
            await session
              .send('Runtime.evaluate', {
                userGesture: true,
                returnByValue: true,
                expression: `(() => {
                  const el = (window.__mwgSmokeElements && window.__mwgSmokeElements[${ctrl.smokeIdx}]) || document.querySelector(${JSON.stringify(ctrl.selector)});
                  window.__mwgLastTrigger = el || null;
                  if (el && typeof el.focus === 'function') { try { el.focus({ preventScroll: true }); } catch {} }
                  if (el && typeof el.click === 'function') el.click();
                })()`,
              })
              .catch(() => {});
            await new Promise<void>((r) => setTimeout(r, 110));

            for (let i = beforeLen; i < runtimeErrors.length; i++) {
              consumedRuntime.add(i);
              const message = `Clicking "${ctrl.label}" threw: ${runtimeErrors[i].message}`;
              addFinding({
                id: 'smoke-click-error',
                fingerprint: buildFingerprint({ id: 'smoke-click-error', file: ctrl.file, line: ctrl.line, selector: ctrl.selector, message }),
                category: 'SMOKE',
                severity: 'error',
                url: targetUrl,
                selector: ctrl.selector,
                file: ctrl.file,
                line: ctrl.line,
                column: ctrl.column,
                framework: ctrl.framework,
                message,
                fix: `Guard click handler on "${ctrl.label}" against unhandled errors.`,
                guides: [],
              });
            }

            const state = await session
              .send<{ result?: { value?: { href: string; modalCount: number; blocking: boolean } } }>('Runtime.evaluate', {
                returnByValue: true,
                expression: `(() => {
                  const isVis = window.__mwgAudit.isVisuallyRendered;
                  const modals = Array.from(document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], .modal')).filter(isVis);
                  const top = modals[modals.length - 1] || null;
                  const blocking = Boolean(top && (top.getAttribute('closedby') === 'none' || top.getAttribute('role') === 'alertdialog'));
                  return { href: location.href, modalCount: modals.length, blocking };
                })()`,
              })
              .then((r) => r.result?.value ?? { href: targetUrl, modalCount: 0, blocking: false })
              .catch(() => ({ href: targetUrl, modalCount: 0, blocking: false }));

            if (state.modalCount > prevModals && !state.blocking) {
              await session.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
              await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
              await new Promise<void>((r) => setTimeout(r, 80));

              const afterEsc = await session
                .send<{ result?: { value?: { modalCount: number; restoredFocus: boolean } } }>('Runtime.evaluate', {
                  returnByValue: true,
                  expression: `(() => {
                    const isVis = window.__mwgAudit.isVisuallyRendered;
                    const modalCount = Array.from(document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], .modal')).filter(isVis).length;
                    const trig = window.__mwgLastTrigger;
                    const active = document.activeElement;
                    const restoredFocus = Boolean(!trig || !trig.isConnected || !isVis(trig) || (active && (active === trig || trig.contains(active))));
                    return { modalCount, restoredFocus };
                  })()`,
                })
                .then((r) => r.result?.value ?? { modalCount: 0, restoredFocus: true })
                .catch(() => ({ modalCount: 0, restoredFocus: true }));

              if (afterEsc.modalCount >= state.modalCount) {
                const message = `Modal opened by "${ctrl.label}" ignores Escape key dismissal (focus trap).`;
                addFinding({
                  id: 'smoke-modal-focus-trap',
                  fingerprint: buildFingerprint({ id: 'smoke-modal-focus-trap', file: ctrl.file, line: ctrl.line, selector: ctrl.selector, message }),
                  category: 'SMOKE',
                  severity: 'error',
                  url: targetUrl,
                  selector: ctrl.selector,
                  file: ctrl.file,
                  line: ctrl.line,
                  column: ctrl.column,
                  framework: ctrl.framework,
                  message,
                  fix: 'Use native `<dialog closedby="any">` opened with `.showModal()` / `command="show-modal"` for automatic Escape dismissal and focus return.',
                  guides: verifiedGuides(['dialog', 'light-dismiss-a-dialog']),
                });
              } else if (afterEsc.modalCount === 0 && !afterEsc.restoredFocus) {
                const message = `Dismissing modal opened by "${ctrl.label}" with Escape lost keyboard focus instead of restoring it to the trigger.`;
                addFinding({
                  id: 'smoke-focus-restoration',
                  fingerprint: buildFingerprint({ id: 'smoke-focus-restoration', file: ctrl.file, line: ctrl.line, selector: ctrl.selector, message }),
                  category: 'SMOKE',
                  severity: 'warning',
                  url: targetUrl,
                  selector: ctrl.selector,
                  file: ctrl.file,
                  line: ctrl.line,
                  column: ctrl.column,
                  framework: ctrl.framework,
                  message,
                  fix: 'Use native `<dialog>` (`showModal()` / `command="show-modal"`) or restore focus to the invoking trigger on close.',
                  guides: verifiedGuides(['dialog', 'declarative-dialog-popover-control']),
                });
              }
              prevModals = afterEsc.modalCount;
            } else {
              prevModals = state.modalCount;
            }

            if (state.href && state.href !== audit.finalUrl) {
              await session.send('Page.navigate', { url: targetUrl }).catch(() => {});
              await new Promise<void>((r) => setTimeout(r, 120));
            }
          }
        }

        for (let i = 0; i < runtimeErrors.length; i++) {
          if (consumedRuntime.has(i)) continue;
          const err = runtimeErrors[i];
          addFinding({
            id: err.id,
            fingerprint: buildFingerprint({ id: err.id, message: err.message }),
            category: 'RUNTIME',
            severity: 'error',
            url: targetUrl,
            message: err.message,
            fix: err.fix,
            guides: [],
          });
        }

        if (viteHmrErrors >= 2) {
          const message = `Coalesced ${viteHmrErrors} Vite HMR WebSocket errors.`;
          addFinding({
            id: 'vite-hmr-disconnected',
            fingerprint: buildFingerprint({ id: 'vite-hmr-disconnected', message }),
            category: 'RUNTIME',
            severity: 'warning',
            url: targetUrl,
            message,
            fix: 'Attach Vite HMR to the HTTP server or disable HMR in headless test mode.',
            guides: [],
          });
        }
      });
    } finally {
      await browser.close();
    }
  }

  if (options.targetDir) {
    for (const f of await runStaticLegacyScan(options.targetDir)) {
      addFinding(f);
    }
  }

  let finalFindings = findings;
  let suppressedCount = 0;
  if (options.baselinePath && existsSync(options.baselinePath)) {
    const baseline = JSON.parse(readFileSync(options.baselinePath, 'utf8')) as unknown;
    const filtered = filterAgainstBaseline(findings, baseline);
    finalFindings = filtered.findings;
    suppressedCount = filtered.suppressedCount;
  }

  const errorCount = finalFindings.filter((f) => f.severity === 'error').length;
  const warningCount = finalFindings.filter((f) => f.severity === 'warning').length;
  const infoCount = finalFindings.filter((f) => f.severity === 'info').length;
  const guides = [...new Set(finalFindings.flatMap((f) => f.guides))];

  return {
    passed: errorCount === 0,
    url: options.url ?? null,
    targetDir: options.targetDir ?? null,
    viewport,
    cpuThrottle,
    durationMs: Math.round(performance.now() - startedAt),
    findingsCount: finalFindings.length,
    suppressedCount,
    errorCount,
    warningCount,
    infoCount,
    cls,
    lcpMs,
    guides,
    findings: finalFindings,
  };
}

async function waitForNetworkSettle(
  inFlight: ReadonlySet<string>,
  minMs: number,
  maxExtraMs: number,
): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, minMs));
  const deadline = Date.now() + maxExtraMs;
  while (inFlight.size > 0 && Date.now() < deadline) {
    await new Promise<void>((r) => setTimeout(r, 40));
  }
}
