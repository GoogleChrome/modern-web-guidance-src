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

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { resolveAxeScriptSource, summarizeHydrationMessage } from './browser-pass.ts';
import { findChromiumExecutable } from './cdp.ts';
import { installPluginConfigs, runStopHook } from './cli.ts';
import { resolveContextGuides } from './context-guides.ts';
import {
  detectProjectConfig,
  discoverTouchedFilesAndRoutes,
  probeHttpServer,
  routeFromFilePath,
} from './discovery.ts';
import { resolveVerticalPack } from './packs.ts';
import {
  getVerifiedMwgGuideSet,
  runStaticPass,
  stripCommentsPreservingLines,
} from './static-pass.ts';
import { runVerification } from './verify.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const MODERN_WEB_CLI = path.join(REPO_ROOT, 'src/cli/modern-web.ts');
const VERIFY_CLI = path.join(REPO_ROOT, 'src/verifying/cli.ts');

function withTempDir<T>(fn: (dir: string) => Promise<T> | T, prefix = 'mw-verify-test-'): Promise<T> {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  return Promise.resolve()
    .then(() => fn(dir))
    .finally(() => {
      rmSync(dir, { recursive: true, force: true });
    });
}

function writeFiles(root: string, fileMap: Record<string, string>): void {
  for (const [rel, content] of Object.entries(fileMap)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf8');
  }
}

function hasGitBinary(): boolean {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const gitAvailable = hasGitBinary();
const chromeBinary = findChromiumExecutable();

test('routeFromFilePath normalizes Next.js App/Pages Router, SvelteKit, SolidStart, Nuxt 4, and Astro routes', () => {
  assert.equal(routeFromFilePath('src/app/checkout/page.tsx'), '/checkout');
  assert.equal(routeFromFilePath('src/app/checkout/layout.tsx'), '/checkout');
  assert.equal(routeFromFilePath('src/app/(marketing)/pricing/page.tsx'), '/pricing');
  assert.equal(routeFromFilePath('src/app/orders/[orderId]/page.tsx'), '/orders/1');
  assert.equal(routeFromFilePath('src/app/@modal/login/page.tsx'), null);
  assert.equal(routeFromFilePath('pages/settings/index.tsx'), '/settings');
  assert.equal(routeFromFilePath('app/pages/checkout.vue'), '/checkout');
  assert.equal(routeFromFilePath('src/pages/blog/[slug].astro'), '/blog/sample');
  assert.equal(routeFromFilePath('pages/api/health.ts'), null);
  assert.equal(routeFromFilePath('src/routes/(app)/billing/+page.svelte'), '/billing');
  assert.equal(routeFromFilePath('src/routes/[[lang]]/checkout/+page.svelte'), '/checkout');
  assert.equal(routeFromFilePath('src/app/(.)login/page.tsx'), '/login');
  assert.equal(routeFromFilePath('src/app/feed/(..)photo/[id]/page.tsx'), '/photo/1');
  assert.equal(routeFromFilePath('src/routes/checkout.tsx'), '/checkout');
  assert.equal(routeFromFilePath('src/routes/orders/[id].tsx'), '/orders/1');
});

test(
  'discoverTouchedFilesAndRoutes resolves leaf/barrel components, React Router App.tsx, and committed diffs with dirty tests',
  { skip: !gitAvailable ? 'git binary not present in hermetic sandbox' : false },
  async () => {
    await withTempDir(async (dir) => {
      writeFiles(dir, {
        'package.json': JSON.stringify({
          name: 'shop',
          dependencies: { next: '15.0.0', react: '19.0.0' },
        }),
        'src/app/page.tsx': 'export default function Home() { return <main>Home</main>; }\n',
        'src/app/checkout/page.tsx':
          'import { CouponModal } from "../../components/CouponModal";\nexport default function Checkout() { return <CouponModal />; }\n',
        'src/components/CouponModal/index.tsx':
          'export function CouponModal() { return <div>v1</div>; }\n',
      });

      execFileSync('git', ['init', '-q'], { cwd: dir });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
      execFileSync('git', ['add', '.'], { cwd: dir });
      execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir });

      writeFileSync(
        path.join(dir, 'src/components/CouponModal/index.tsx'),
        'export function CouponModal() { return <div className="modal">v2</div>; }\n',
      );

      const result = discoverTouchedFilesAndRoutes(dir);
      assert.deepEqual(result.touchedFiles, ['src/components/CouponModal/index.tsx']);
      assert.deepEqual(result.routes, ['/checkout']);
      assert.equal(result.discoverySource, 'git-diff');

      execFileSync('git', ['add', 'src/components/CouponModal/index.tsx'], { cwd: dir });
      execFileSync('git', ['commit', '-q', '-m', 'feat-modal'], { cwd: dir });
      writeFileSync(path.join(dir, 'src/app/checkout/page.test.tsx'), 'test("ok", () => {});\n');

      const committedWithDirtyTest = discoverTouchedFilesAndRoutes(dir);
      assert.deepEqual(committedWithDirtyTest.touchedFiles, [
        'src/components/CouponModal/index.tsx',
      ]);
      assert.deepEqual(committedWithDirtyTest.routes, ['/checkout']);
    });

    await withTempDir(async (spaDir) => {
      writeFiles(spaDir, {
        'package.json': JSON.stringify({
          name: 'spa',
          dependencies: { react: '19.0.0', 'react-router-dom': '7.0.0' },
        }),
        'src/App.tsx': [
          'import { Routes, Route } from "react-router-dom";',
          'import { CheckoutView } from "./views/CheckoutView";',
          'export function App() {',
          '  return <Routes><Route path="/" element={<main />} /><Route path="/checkout" element={<CheckoutView />} /></Routes>;',
          '}',
        ].join('\n'),
        'src/views/CheckoutView.tsx': 'export function CheckoutView() { return <main>v1</main>; }\n',
      });
      execFileSync('git', ['init', '-q'], { cwd: spaDir });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: spaDir });
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: spaDir });
      execFileSync('git', ['add', '.'], { cwd: spaDir });
      execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: spaDir });

      writeFileSync(
        path.join(spaDir, 'src/views/CheckoutView.tsx'),
        'export function CheckoutView() { return <main>v2</main>; }\n',
      );
      const spaRes = discoverTouchedFilesAndRoutes(spaDir);
      assert.deepEqual(spaRes.routes, ['/checkout']);
    });
  },
);

test('in-process legacy-scan integration and quote-aware comment stripper catch legacy web patterns and pass when modernized', async () => {
  const mwgGuideSet = getVerifiedMwgGuideSet();

  const globSource = [
    'const a = "src/*";',
    'const secret = document.execCommand("copy"); /* real comment */',
    'const b = "*/index.tsx";',
  ].join('\n');
  const strippedGlob = stripCommentsPreservingLines(globSource, '.tsx');
  assert.match(strippedGlob, /document\.execCommand\("copy"\)/);
  assert.doesNotMatch(strippedGlob, /real comment/);

  await withTempDir(async (dir) => {
    writeFiles(dir, {
      'package.json': JSON.stringify({ dependencies: { react: '19.0.0' } }),
      'src/components/Tooltip.tsx': [
        'const includeGlob = "src/*";',
        'export function Tooltip({ triggerEl, tipEl }: { triggerEl: HTMLElement; tipEl: HTMLElement }) {',
        '  const copy = () => document.execCommand("copy");',
        '  const cloned = JSON.parse(JSON.stringify({ a: 1 }));',
        '  window.addEventListener("scroll", () => {',
        '    const r = triggerEl.getBoundingClientRect();',
        '    tipEl.style.top = (r.bottom + window.scrollY) + "px";',
        '  });',
        '  return { copy, cloned };',
        '}',
        'const tailGlob = "*/index.tsx";',
      ].join('\n'),
      'src/styles.css': [
        'input:invalid { border-color: red; }',
        '.accordion-open { max-height: 9999px; transition: max-height 0.3s; }',
        '.hero { min-height: 100vh; }',
      ].join('\n'),
    });

    const project = detectProjectConfig(dir);
    const badRes = await runStaticPass(
      dir,
      ['src/components/Tooltip.tsx', 'src/styles.css'],
      project,
    );

    assert.equal(badRes.legacyScanAvailable, true);
    const ruleIds = new Set(badRes.findings.map((f) => f.ruleId));
    assert.ok(ruleIds.has('MWG-CLIPBOARD-EXECCOMMAND'));
    assert.ok(ruleIds.has('MWG-TOOLTIP-POS'));
    assert.ok(ruleIds.has('MWG-LEGACY-100VH'));
    assert.ok(ruleIds.has('js/structured-clone'));
    assert.ok(ruleIds.has('validate-input-after-interaction'));
    assert.ok(ruleIds.has('animate-to-intrinsic-sizes'));

    for (const f of badRes.findings) {
      for (const g of f.guides) {
        assert.ok(mwgGuideSet.has(g), `Unverified MWG guide ID "${g}" in finding ${f.ruleId}`);
      }
    }

    writeFiles(dir, {
      'src/components/Tooltip.tsx': [
        'import { forwardRef, memo, useId, useState, type FC, type JSX } from "react";',
        'export const Summary: FC<{ total: number }> = ({ total }): JSX.Element => {',
        '  const helper = { label() { return "Total"; } };',
        '  const [open] = useState(false);',
        '  return (',
        '    <div data-open={open}>',
        "      <p>Customer's {helper.label()}: {total} {/* legacy document.execCommand('copy') removed */}</p>",
        '      <button type="button" interestfor="price-tip" style={{ anchorName: "--price-btn" }}>Info</button>',
        '      <div id="price-tip" popover="hint" role="tooltip" style={{ positionAnchor: "--price-btn", positionArea: "block-end", positionTryFallbacks: "flip-block" }}>',
        '        Included VAT',
        '      </div>',
        '    </div>',
        '  );',
        '};',
        'export const Field = forwardRef<HTMLInputElement, { label: string }>(function(props, ref) {',
        '  const id = useId();',
        '  return <div><label htmlFor={id}>{props.label}</label><input id={id} ref={ref} /></div>;',
        '});',
        'export const Badge = memo(({ text }: { text: string }) => { const [on] = useState(true); return <span data-on={on}>{text}</span>; });',
      ].join('\n'),
      'src/index.html': [
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Doc</title>',
        '<style>/* old: .hero { height: 100vh; } */ .hero { padding: 1rem; }</style></head>',
        '<body><main><p>Welcome</p></main>',
        '<script type="module">// removed document.execCommand("copy");\nconst ok = true;</script></body></html>',
      ].join('\n'),
      'src/styles.css': '.hero { min-height: 100dvh; }\ninput:user-invalid { border-color: red; }\n',
    });

    const cleanRes = await runStaticPass(
      dir,
      ['src/components/Tooltip.tsx', 'src/index.html', 'src/styles.css'],
      project,
    );
    assert.deepEqual(cleanRes.findings, []);
  });
});

test('summarizeHydrationMessage extracts component and server/client diff cleanly', () => {
  const react19Msg = [
    "Hydration failed because the server rendered HTML didn't match the client.",
    '  <PriceTable>',
    '+   $10',
    '-   CHF 10',
  ].join('\n');
  assert.equal(
    summarizeHydrationMessage(react19Msg),
    'Hydration mismatch in <PriceTable> (server: "CHF 10", client: "$10")',
  );
});

test('Stop hook CLI works via symlinks and spaced paths, merges plugin configs non-destructively, and fails closed on dead servers', async () => {
  await withTempDir(async (dir) => {
    writeFiles(dir, {
      '.agents/hooks.json': JSON.stringify({
        'modern-web-verify': {
          Stop: [
            { type: 'command', command: 'node "/old/stop_hook.mjs"', timeout: 15 },
            { type: 'command', command: 'echo custom-stop-hook', timeout: 5 },
          ],
        },
      }),
      '.claude/settings.json': JSON.stringify({
        permissions: { allow: ['Bash(npm test)'] },
        mcpServers: { localMcp: { command: 'node', args: ['mcp.mjs'] } },
        hooks: {
          PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo ok' }] }],
        },
      }),
    });
    installPluginConfigs('all', dir, VERIFY_CLI);
    installPluginConfigs('all', dir, VERIFY_CLI);

    const mergedAgentHooks = JSON.parse(readFileSync(path.join(dir, '.agents/hooks.json'), 'utf8'));
    assert.equal('modern-web-verify' in mergedAgentHooks, false);
    assert.equal(mergedAgentHooks['modern-web-guidance'].Stop.length, 2);

    const mergedClaude = JSON.parse(readFileSync(path.join(dir, '.claude/settings.json'), 'utf8'));
    assert.deepEqual(mergedClaude.permissions, { allow: ['Bash(npm test)'] });
    assert.ok(mergedClaude.mcpServers?.localMcp);
    assert.equal(mergedClaude.hooks.PreToolUse.length, 1);
    assert.equal(mergedClaude.hooks.Stop.length, 1);

    const antigravityCritic = readFileSync(
      path.join(dir, '.agents/agents/modern_web_critic/agent.md'),
      'utf8',
    );
    const claudeCritic = readFileSync(
      path.join(dir, '.claude/agents/modern-web-critic.md'),
      'utf8',
    );
    const cursorCritic = readFileSync(
      path.join(dir, '.cursor/agents/modern-web-critic.md'),
      'utf8',
    );
    assert.match(antigravityCritic, /^---\nname: modern-web-critic/m);
    assert.match(
      claudeCritic,
      /^---\nname: modern-web-critic\ndescription: .+\ntools: Read, Grep, Glob, Bash\n---/m,
    );
    assert.match(claudeCritic, /context-guides/);
    assert.match(cursorCritic, /^---\nname: modern-web-critic\ndescription: .+\nreadonly: true\n---/m);

    assert.throws(() => installPluginConfigs('unknown-host', dir), /Invalid --target/);

    await withTempDir(async (spaceDir) => {
      const linkParent = path.join(spaceDir, 'plugin with spaces');
      mkdirSync(linkParent, { recursive: true });
      const symlinkedVerify = path.join(linkParent, 'verify-link.ts');
      symlinkSync(VERIFY_CLI, symlinkedVerify);

      const res = spawnSync(process.execPath, [symlinkedVerify, 'stop-hook'], {
        cwd: REPO_ROOT,
        input: JSON.stringify({
          workspacePaths: [spaceDir],
          terminationReason: 'NO_TOOL_CALL',
          executionNum: 1,
        }),
        encoding: 'utf8',
        timeout: 5000,
      });
      assert.equal(res.status, 0);
      assert.deepEqual(JSON.parse(res.stdout), { decision: 'stop' });

      const cliDir = path.join(spaceDir, 'node-cli');
      writeFiles(cliDir, {
        'package.json': JSON.stringify({
          name: 'data-cli',
          bin: { cli: './src/cli.mjs' },
          scripts: { test: 'node --test' },
        }),
        'src/cli.mjs': 'export const run = () => 42;\n',
      });
      const cliHookOut = await runStopHook(
        JSON.stringify({
          workspacePaths: [cliDir],
          terminationReason: 'NO_TOOL_CALL',
          executionNum: 1,
        }),
      );
      assert.deepEqual(cliHookOut, { decision: 'stop' });
    }, 'mw-space test-');

    writeFiles(dir, {
      'package.json': JSON.stringify({
        name: 'demo',
        dependencies: { react: '19.0.0' },
        scripts: { dev: 'node -e "process.exit(1)"' },
      }),
      'src/App.tsx': 'export const App = () => <main>Hi</main>;\n',
    });

    const failingVerify = async () => ({
      passed: false,
      formatted: '❌ [RUNTIME] /: Hydration mismatch in <PriceTable>',
    });

    const agyBlock = await runStopHook(
      JSON.stringify({ workspacePaths: [dir], terminationReason: 'NO_TOOL_CALL', executionNum: 1 }),
      failingVerify,
    );
    assert.equal(agyBlock.decision, 'continue');
    assert.match(String(agyBlock.reason), /Hydration mismatch/);

    const agyCapped = await runStopHook(
      JSON.stringify({ workspacePaths: [dir], terminationReason: 'NO_TOOL_CALL', executionNum: 3 }),
      failingVerify,
    );
    assert.deepEqual(agyCapped, { decision: 'stop' });

    const claudeReentry = await runStopHook(
      JSON.stringify({ cwd: dir, hook_event_name: 'Stop', stop_hook_active: true }),
      failingVerify,
    );
    assert.deepEqual(claudeReentry, {});

    const cursorBlock = await runStopHook(
      JSON.stringify({
        workspace_roots: [dir],
        hook_event_name: 'stop',
        status: 'completed',
        loop_count: 0,
      }),
      failingVerify,
    );
    assert.match(String(cursorBlock.followup_message), /Hydration mismatch/);

    const missingWsReport = await runVerification({
      workspaceDir: path.join(dir, 'does-not-exist-subdir'),
      staticOnly: true,
    });
    assert.equal(missingWsReport.passed, false);
    assert.equal(missingWsReport.infraFailed, true);

    const deadSrvReport = await runVerification({
      workspaceDir: dir,
      boot: false,
      port: 59999,
    });
    assert.equal(deadSrvReport.passed, false);
    assert.equal(deadSrvReport.infraFailed, true);
    assert.doesNotMatch(deadSrvReport.formatted, /✓ Runtime & Hydration/);
    assert.match(deadSrvReport.formatted, /❌ \[INFRA\]/);
  });
});

test(
  'End-to-end 4-in-1 live verification (<5s): catches hydration, async 500s, WCAG Tier-1 + geometry + CDP click divs, trapped <dialog>, form crashes, and passes cleanly with native <dialog> + [popover]',
  {
    skip: !chromeBinary ? 'No Chromium executable available in sandbox' : false,
  },
  async () => {
    await withTempDir(async (dir) => {
      const axeInstalled = Boolean(resolveAxeScriptSource(dir));
      writeFiles(dir, {
        'package.json': JSON.stringify({
          name: 'checkout-app',
          type: 'module',
          dependencies: { next: '15.0.0', react: '19.0.0' },
          scripts: {
            dev: 'node server.mjs',
          },
        }),
        'src/app/checkout/page.tsx': [
          'import { CouponModal } from "../../components/CouponModal";',
          'import { Tooltip } from "../../components/Tooltip";',
          'export default function CheckoutPage() {',
          '  return <main><h1>Checkout</h1><PriceTable /><CouponModal /><Tooltip /></main>;',
          '}',
        ].join('\n'),
        'src/components/CouponModal.tsx': [
          'export function CouponModal() {',
          '  return (',
          '    <section>',
          '      <div className="modal" id="coupon-modal">Checkout</div>',
          '      <div id="clickable-chip" className="quick-chip">Apply 10%</div>',
          '    </section>',
          '  );',
          '}',
        ].join('\n'),
        'src/components/Tooltip.tsx': [
          'export function Tooltip({ btn, tip }: { btn: HTMLElement; tip: HTMLElement }) {',
          '  window.addEventListener("scroll", () => {',
          '    const rect = btn.getBoundingClientRect();',
          '    tip.style.top = (rect.bottom + window.innerHeight) + "px";',
          '  });',
          '  return null;',
          '}',
        ].join('\n'),
        'server.mjs': `
          import http from 'node:http';
          const port = Number(process.env.PORT || 0);
          const vendorJs = \`
            export function simulateVendorHydrationError() {
              console.error("Hydration failed because the server rendered HTML didn't match the client." + String.fromCharCode(10) + "  <PriceTable>" + String.fromCharCode(10) + "+   $10" + String.fromCharCode(10) + "-   CHF 10");
            }
          \`;
          const html = \`<!doctype html>
          <html>
            <head><meta charset="utf-8"></head>
            <body>
              <div id="root">
              <main>
                <h1>Checkout</h1>
                <div id="price-table">CHF 10</div>
                <div id="delegated-list">
                  <button type="button" data-item="1">Remove item</button>
                </div>
                <div class="modal" id="coupon-modal">Checkout</div>
                <div id="clickable-chip" class="quick-chip">Apply 10%</div>
                <button type="button" style="width:0;height:0;padding:0;border:0">Zero</button>
                <button type="button" id="open-trap-dlg">Open Trapped</button>
                <dialog id="trap-dlg" aria-label="Trap"><p>Trapped</p></dialog>
                <form id="promo-form">
                  <label for="promo-input">Code</label>
                  <input id="promo-input" type="text" value="SAVE10">
                  <input type="submit" value="Apply Promo">
                </form>
              </main>
              </div>
              <script type="module">
                import { simulateVendorHydrationError } from '/node_modules/.vite/deps/react-dom_client.js';
                simulateVendorHydrationError();
                for (let i = 0; i < 6; i++) {
                  console.error("[vite] failed to connect to websocket (ws://localhost:24678/).");
                }
                setTimeout(() => {
                  fetch('/api/coupons');
                  Promise.reject('Delayed coupon sync rejection');
                }, 200);
                document.getElementById('clickable-chip').addEventListener('click', () => {
                  window.__chipClicked = true;
                });
                document.getElementById('open-trap-dlg').addEventListener('click', () => {
                  const dlg = document.getElementById('trap-dlg');
                  dlg.addEventListener('cancel', (e) => e.preventDefault());
                  dlg.showModal();
                });
                document.getElementById('promo-form').addEventListener('submit', (e) => {
                  e.preventDefault();
                  const coupon = undefined;
                  return coupon.code.toUpperCase();
                });
              </script>
            </body>
          </html>\`;

          const srv = http.createServer((req, res) => {
            if (req.url === '/node_modules/.vite/deps/react-dom_client.js') {
              res.writeHead(200, { 'Content-Type': 'application/javascript' });
              res.end(vendorJs);
              return;
            }
            if (req.url === '/api/coupons') {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Coupon DB offline' }));
              return;
            }
            if (req.url === '/checkout' || req.url === '/') {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(html);
              return;
            }
            res.writeHead(404);
            res.end('Not found');
          });
          srv.listen(port, '127.0.0.1', () => {
            console.log('Ready on http://localhost:' + srv.address().port);
          });
        `,
      });

      if (gitAvailable) {
        execFileSync('git', ['init', '-q'], { cwd: dir });
        execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
        execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
        execFileSync('git', ['add', 'package.json', 'server.mjs', 'src/components/CouponModal.tsx'], {
          cwd: dir,
        });
        execFileSync('git', ['commit', '-q', '-m', 'base'], { cwd: dir });
      }

      const badReport = await runVerification({
        workspaceDir: dir,
        forceBoot: true,
      });

      assert.equal(badReport.passed, false);
      assert.equal(badReport.passes.browser?.axeInjected, axeInstalled);
      assert.ok(
        badReport.durationMs < 5000,
        `Expected <5000ms verification pass, took ${badReport.durationMs}ms`,
      );
      assert.deepEqual(badReport.routes, ['/checkout']);

      const out = badReport.formatted;
      assert.match(
        out,
        /\[RUNTIME\] \/checkout: Hydration mismatch in <PriceTable> \(server: "CHF 10", client: "\$10"\)/,
      );
      assert.match(out, /\[RUNTIME\] \/checkout: HTTP 500 on \/api\/coupons/);
      assert.match(out, /Delayed coupon sync rejection/);
      assert.match(out, /Coalesced 6 Vite HMR WebSocket connection failures/);
      assert.match(
        out,
        /\[A11Y\] \/checkout \(src\/components\/CouponModal\.tsx:4\): <div class="modal" id="coupon-modal"> lacks dialog role & focus trap\./,
      );
      assert.match(
        out,
        /\[A11Y\] \/checkout \(src\/components\/CouponModal\.tsx:5\): <div id="clickable-chip" class="quick-chip"> has click listener/,
      );
      assert.match(out, /<html> element must have a lang attribute/);
      assert.match(out, /renders with zero interactive dimensions/);
      assert.match(out, /Modal opened by "Open Trapped" ignores Escape key dismissal/);
      assert.match(out, /\[SMOKE\] \/checkout.*Clicking "Apply Promo" threw:/);
      assert.match(
        out,
        /\[MODERNITY\] src\/components\/Tooltip\.tsx:2: Manual getBoundingClientRect\(\)/,
      );

      writeFiles(dir, {
        'src/app/checkout/page.tsx': [
          'import { CouponModal } from "../../components/CouponModal";',
          'import { Tooltip } from "../../components/Tooltip";',
          'function PriceTable() { return <div id="price-table">CHF 10</div>; }',
          'export default function CheckoutPage() {',
          '  return <main><h1>Checkout</h1><PriceTable /><CouponModal /><Tooltip /></main>;',
          '}',
        ].join('\n'),
        'src/components/CouponModal.tsx': [
          'export function CouponModal() {',
          '  return (',
          '    <section>',
          '      <button type="button" command="show-modal" commandfor="coupon-dialog">Enter promo</button>',
          '      <dialog id="coupon-dialog" closedby="any" aria-labelledby="coupon-title">',
          '        <h2 id="coupon-title">Enter promo code</h2>',
          '      </dialog>',
          '      <button type="button" className="quick-chip">Apply 10%</button>',
          '    </section>',
          '  );',
          '}',
        ].join('\n'),
        'src/components/Tooltip.tsx': [
          'export function Tooltip() {',
          '  return (',
          '    <>',
          '      <button type="button" interestfor="vat-tip" style={{ anchorName: "--vat-btn" }}>VAT</button>',
          '      <div id="vat-tip" popover="hint" role="tooltip" style={{ positionAnchor: "--vat-btn", positionArea: "block-end", positionTryFallbacks: "flip-block" }}>',
          '        CHF includes 8.1% VAT',
          '      </div>',
          '    </>',
          '  );',
          '}',
        ].join('\n'),
        'server.mjs': `
          import http from 'node:http';
          const port = Number(process.env.PORT || 0);
          const html = \`<!doctype html>
          <html lang="en">
            <head><meta charset="utf-8"><title>Checkout</title><style>button, input { min-height: 28px; margin: 4px; }</style></head>
            <body>
              <div id="root">
              <main>
                <h1>Checkout</h1>
                <div id="price-table">CHF 10</div>
                <div id="delegated-list">
                  <button type="button" data-item="1">Remove item</button>
                </div>
                <button type="button" id="open-coupon" command="show-modal" commandfor="coupon-dialog">Enter promo</button>
                <dialog id="coupon-dialog" closedby="any" aria-labelledby="coupon-title">
                  <h2 id="coupon-title">Enter promo code</h2>
                  <form method="dialog"><button type="submit" value="close">Close</button></form>
                </dialog>
                <button type="button" popovertarget="more-actions">More Actions</button>
                <div id="more-actions" popover="auto">
                  <button type="button">Save for Later</button>
                  <a href="/terms">Promo Terms</a>
                </div>
                <form id="promo-form">
                  <label for="promo-input">Code</label>
                  <input id="promo-input" type="text" value="SAVE10">
                  <input type="submit" value="Apply Promo">
                </form>
              </main>
              </div>
              <script>
                document.getElementById('root').addEventListener('click', () => {});
                document.getElementById('delegated-list').addEventListener('click', (e) => {
                  const btn = e.target.closest('button[data-item]');
                  if (btn) window.__delegated = true;
                });
                fetch('/api/coupons');
                document.getElementById('promo-form').addEventListener('submit', (e) => {
                  e.preventDefault();
                  document.getElementById('price-table').textContent = 'CHF 9';
                });
              </script>
            </body>
          </html>\`;

          const srv = http.createServer((req, res) => {
            if (req.url === '/api/coupons') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ coupons: ['SAVE10'] }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
          });
          srv.listen(port, '127.0.0.1', () => {
            console.log('Ready on http://localhost:' + srv.address().port);
          });
        `,
      });

      const cleanReport = await runVerification({
        workspaceDir: dir,
        forceBoot: true,
        strict: true,
      });

      assert.equal(
        cleanReport.passed,
        true,
        `Expected clean pass, got:\n${cleanReport.formatted}`,
      );
      assert.equal(cleanReport.errorCount, 0);
      assert.equal(cleanReport.warningCount, 0);
      assert.match(cleanReport.formatted, /^✅ PASS modern-web-guidance verify/);

      const stillListening = await probeHttpServer('http://127.0.0.1:3000', 150);
      assert.equal(stillListening, false);
    });
  },
);

test('context-guides maps git diff + bespoke glue to verified MWG guide IDs via in-process legacy-scan & search and inlines guide markdown', async () => {
  await withTempDir(async (dir) => {
    writeFiles(dir, {
      'package.json': JSON.stringify({
        name: 'shop-ui',
        dependencies: { react: '19.0.0', stripe: '17.0.0' },
      }),
      'src/components/OverlayModal.tsx': [
        'import { useEffect } from "react";',
        'export function OverlayModal({ triggerEl, tipEl, onClose }: { triggerEl: HTMLElement; tipEl: HTMLElement; onClose: () => void }) {',
        '  useEffect(() => {',
        '    const onDown = (e: MouseEvent) => { if (!tipEl.contains(e.target as Node)) onClose(); };',
        '    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };',
        '    document.addEventListener("mousedown", onDown);',
        '    document.addEventListener("keydown", onKey);',
        '    const r = triggerEl.getBoundingClientRect();',
        '    const ro = new ResizeObserver(() => { tipEl.style.top = r.bottom + "px"; });',
        '    ro.observe(triggerEl);',
        '  }, []);',
        '  return <div className="modal"><input name="cc-number" /></div>;',
        '}',
      ].join('\n'),
    });

    if (gitAvailable) {
      execFileSync('git', ['init', '-q'], { cwd: dir });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
      execFileSync('git', ['add', 'package.json'], { cwd: dir });
      execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir });
    }

    const res = await resolveContextGuides({
      workspaceDir: dir,
      includeContent: true,
      limit: 10,
    });

    const mwgGuideSet = getVerifiedMwgGuideSet();
    assert.equal(res.pack, 'commerce');
    assert.ok(res.guideIds.includes('dialog'));
    assert.ok(res.guideIds.includes('light-dismiss-a-dialog'));
    assert.ok(res.guideIds.includes('position-aware-tooltips'));
    assert.ok(res.guideIds.includes('autofill-payment-form'));
    for (const gid of res.guideIds) {
      assert.ok(mwgGuideSet.has(gid), `Expected verified MWG guide ID, got ${gid}`);
    }
    assert.match(res.retrieveCommand ?? '', /^npx -y modern-web-guidance@latest retrieve "/);
    assert.ok(res.maintainabilityHints.some((h) => h.ruleId === 'bespoke-outside-click-escape'));
    assert.ok(res.maintainabilityHints.some((h) => h.ruleId === 'bespoke-floating-geometry'));
    const dialogEntry = res.guides.find((g) => g.id === 'dialog');
    assert.ok((dialogEntry?.content ?? '').length > 100, 'Expected real dialog.md content');

    const cliOut = spawnSync(
      process.execPath,
      [MODERN_WEB_CLI, 'context-guides', '--workspace', dir, '--json'],
      {
        encoding: 'utf8',
        timeout: 8000,
        env: { ...process.env, DISABLE_TELEMETRY: '1', NO_COLOR: '1' },
      },
    );
    assert.equal(cliOut.status, 0, cliOut.stderr);
    const parsedCli = JSON.parse(cliOut.stdout) as { guideIds: string[] };
    assert.ok(Array.isArray(parsedCli.guideIds) && parsedCli.guideIds.includes('dialog'));
  });
});

test(
  'Vertical Packs (--pack commerce | media | saas) & --perf CDP pass detect live domain/perf defects and pass when remediated',
  {
    skip: !chromeBinary ? 'No Chromium executable available in sandbox' : false,
  },
  async () => {
    const mwgGuideSet = getVerifiedMwgGuideSet();

    assert.equal(
      resolveVerticalPack({ pkg: { dependencies: { stripe: '17.0.0' } } }).pack,
      'commerce',
    );
    assert.equal(
      resolveVerticalPack({ pkg: { dependencies: { 'hls.js': '1.5.0' } } }).pack,
      'media',
    );
    assert.equal(
      resolveVerticalPack({ pkg: { dependencies: { '@tanstack/react-table': '8.0.0' } } }).pack,
      'saas',
    );
    assert.equal(
      resolveVerticalPack({ explicitPack: 'none', pkg: { dependencies: { stripe: '17.0.0' } } })
        .pack,
      null,
    );
    assert.throws(() => resolveVerticalPack({ explicitPack: 'gaming' }), /Invalid vertical pack/);

    await withTempDir(async (commerceDir) => {
      writeFiles(commerceDir, {
        'package.json': JSON.stringify({
          name: 'storefront',
          type: 'module',
          dependencies: { react: '19.0.0', stripe: '17.0.0' },
          scripts: { dev: 'node server.mjs' },
        }),
        'src/CheckoutForm.tsx': [
          'export function CheckoutForm() {',
          '  return <input name="cc-number" onPaste={(e) => e.preventDefault()} />;',
          '}',
        ].join('\n'),
        'server.mjs': `
          import http from 'node:http';
          const html = \`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Pay</title></head>
          <body>
            <main>
              <h1>Checkout</h1>
              <div id="late-banner"></div>
              <div id="price-summary" style="font-size:24px;">CHF 99.00</div>
              <form>
                <label for="card-num">Card Number</label>
                <input id="card-num" name="cc-number" type="text" autocomplete="off">
                <button type="button" id="pay-now-btn" tabindex="-1">Complete Purchase</button>
              </form>
            </main>
            <script>
              setTimeout(() => {
                const b = document.getElementById('late-banner');
                b.style.height = '180px';
                b.textContent = 'Flash Sale!';
              }, 80);
            </script>
          </body></html>\`;
          const srv = http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
          });
          srv.listen(Number(process.env.PORT || 0), '127.0.0.1', () => {
            console.log('Ready on http://localhost:' + srv.address().port);
          });
        `,
      });

      const badCommerce = await runVerification({
        workspaceDir: commerceDir,
        forceBoot: true,
        allFiles: true,
      });
      assert.equal(badCommerce.pack, 'commerce');
      assert.equal(badCommerce.passed, false);
      assert.equal(badCommerce.passes.perf, null);
      const cRules = new Set(badCommerce.findings.map((f) => f.ruleId));
      assert.ok(cRules.has('PACK-COMMERCE-NO-PASTE-BLOCK'));
      assert.ok(cRules.has('commerce-autofill-missing'));
      assert.ok(cRules.has('commerce-cta-keyboard-unreachable'));
      assert.ok(cRules.has('commerce-price-cta-cls'));
      for (const f of badCommerce.findings) {
        for (const g of f.guides) assert.ok(mwgGuideSet.has(g));
      }
    });

    await withTempDir(async (mediaDir) => {
      const onePxGif =
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      writeFiles(mediaDir, {
        'package.json': JSON.stringify({
          name: 'newsroom',
          type: 'module',
          modernWeb: { pack: 'media' },
          scripts: { dev: 'node server.mjs' },
        }),
        'src/Article.tsx':
          'export function Article() { return <article><h1>News</h1></article>; }\n',
        'server.mjs': `
          import http from 'node:http';
          const html = \`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>News</title></head>
          <body style="margin:0;">
            <div class="sticky-header" style="position:fixed;top:0;left:0;right:0;height:160px;background:#111;color:#fff;">Top Sticky Promo</div>
            <main style="padding-top:170px;min-height:2400px;">
              <h1>Breaking Story</h1>
              <div id="ad-top-slot" data-ad-slot="top"></div>
              <img src="${onePxGif}" alt="Hero" loading="lazy" style="width:600px;height:320px;display:block;">
              <div style="height:1400px;">Article body</div>
              <img src="${onePxGif}" alt="Footer graphic" style="width:300px;height:200px;display:block;">
            </main>
            <div id="ad-sticky-bottom" data-ad="true" style="position:fixed;bottom:0;left:0;right:0;height:200px;background:#222;color:#fff;">Sticky Video Ad</div>
          </body></html>\`;
          const srv = http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
          });
          srv.listen(Number(process.env.PORT || 0), '127.0.0.1', () => {
            console.log('Ready on http://localhost:' + srv.address().port);
          });
        `,
      });

      const badMedia = await runVerification({
        workspaceDir: mediaDir,
        forceBoot: true,
        allFiles: true,
      });
      assert.equal(badMedia.pack, 'media');
      const mRules = new Set(badMedia.findings.map((f) => f.ruleId));
      assert.ok(mRules.has('media-viewport-occlusion-density'));
      assert.ok(mRules.has('media-unreserved-ad-box'));
      assert.ok(mRules.has('media-hero-lazy-antipattern'));
      assert.ok(mRules.has('media-below-fold-eager-img'));
      for (const f of badMedia.findings) {
        for (const g of f.guides) assert.ok(mwgGuideSet.has(g));
      }
    });

    await withTempDir(async (saasDir) => {
      writeFiles(saasDir, {
        'package.json': JSON.stringify({
          name: 'ops-console',
          type: 'module',
          dependencies: { react: '19.0.0' },
          scripts: { dev: 'node server.mjs' },
        }),
        'src/Grid.tsx': [
          'export function Grid() {',
          '  window.addEventListener("keydown", () => {});',
          '  return <main><h1>Ops</h1></main>;',
          '}',
        ].join('\n'),
        'server.mjs': `
          import http from 'node:http';
          const manySpans = Array.from({ length: 1600 }, (_, i) => '<span>' + i + '</span>').join('');
          const html = \`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ops</title></head>
          <body>
            <main>
              <h1>Accounts</h1>
              <button type="button" id="heavy-btn">Recalculate Grid</button>
              <button type="button" id="open-custom-pop">Row Actions</button>
              <div id="custom-modal" role="dialog" aria-label="Actions" hidden>
                <button type="button" id="inner-act">Archive</button>
              </div>
              <table>
                <tbody>
                  <tr><td>Acme</td><td>Active</td></tr>
                  <tr><td>Globex</td><td>Trial</td></tr>
                </tbody>
              </table>
              <div id="bulk-dom">\${manySpans}</div>
            </main>
            <script>
              for (let i = 0; i < 10; i++) {
                window.addEventListener('resize', () => {});
              }
              window.addEventListener('wheel', () => {}, { passive: false });
              document.getElementById('heavy-btn').addEventListener('click', () => {
                const start = performance.now();
                while (performance.now() - start < 140) {}
              });
              const pop = document.getElementById('custom-modal');
              document.getElementById('open-custom-pop').addEventListener('click', () => {
                pop.hidden = false;
                document.getElementById('inner-act').focus();
              });
              document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !pop.hidden) {
                  document.activeElement?.blur?.();
                  pop.hidden = true;
                }
              });
            </script>
          </body></html>\`;
          const srv = http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
          });
          srv.listen(Number(process.env.PORT || 0), '127.0.0.1', () => {
            console.log('Ready on http://localhost:' + srv.address().port);
          });
        `,
      });

      const badSaasPerf = await runVerification({
        workspaceDir: saasDir,
        pack: 'saas',
        perf: true,
        forceBoot: true,
        allFiles: true,
      });

      assert.equal(badSaasPerf.pack, 'saas');
      assert.ok(badSaasPerf.passes.perf, 'Expected passes.perf summary when perf: true');
      assert.ok(badSaasPerf.passes.perf.maxDomNodes >= 1600);
      assert.ok(badSaasPerf.passes.perf.maxGlobalListeners >= 10);

      const spRules = new Set(badSaasPerf.findings.map((f) => f.ruleId));
      assert.ok(spRules.has('PACK-SAAS-GLOBAL-LISTENER-NO-SIGNAL'));
      assert.ok(spRules.has('saas-table-missing-headers'));
      assert.ok(spRules.has('saas-focus-restoration'));
      assert.ok(spRules.has('perf-interaction-loaf'));
      assert.ok(spRules.has('perf-listener-accumulation'));
      assert.ok(spRules.has('perf-non-passive-scroll'));
      assert.ok(spRules.has('perf-dom-size'));
      for (const f of badSaasPerf.findings) {
        for (const g of f.guides) assert.ok(mwgGuideSet.has(g));
      }

      writeFiles(saasDir, {
        'src/Grid.tsx': [
          'export function Grid() {',
          '  const ctrl = new AbortController();',
          '  window.addEventListener("keydown", () => {}, { signal: ctrl.signal });',
          '  return <main><h1>Ops</h1></main>;',
          '}',
        ].join('\n'),
        'server.mjs': `
          import http from 'node:http';
          const html = \`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ops</title><style>button { min-height: 28px; margin: 4px; }</style></head>
          <body>
            <main>
              <h1>Accounts</h1>
              <button type="button" id="open-native-pop" popovertarget="native-pop">Row Actions</button>
              <div id="native-pop" popover="auto">
                <button type="button">Archive</button>
              </div>
              <table aria-label="Accounts">
                <thead><tr><th scope="col" aria-sort="ascending"><button type="button">Name</button></th><th scope="col">Plan</th></tr></thead>
                <tbody>
                  <tr><td>Acme</td><td>Active</td></tr>
                  <tr><td>Globex</td><td>Trial</td></tr>
                </tbody>
              </table>
            </main>
          </body></html>\`;
          const srv = http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
          });
          srv.listen(Number(process.env.PORT || 0), '127.0.0.1', () => {
            console.log('Ready on http://localhost:' + srv.address().port);
          });
        `,
      });

      const cleanSaasPerf = await runVerification({
        workspaceDir: saasDir,
        pack: 'saas',
        perf: true,
        strict: true,
        forceBoot: true,
        allFiles: true,
      });

      assert.equal(
        cleanSaasPerf.passed,
        true,
        `Expected clean SaaS+Perf pass, got:\n${cleanSaasPerf.formatted}`,
      );
      assert.match(cleanSaasPerf.formatted, /✓ Pack:saas/);
      assert.match(cleanSaasPerf.formatted, /✓ Perf \(CLS/);
    });
  },
);
