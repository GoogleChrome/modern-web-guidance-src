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
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parseHTML } from 'linkedom';
import {
  auditElement,
  isRuleIgnored,
  runPageAudit,
} from './browser-audit.ts';
import { findPlaywrightChromiumExecutable } from './cdp.ts';
import { formatGithubAnnotations, runVerifyingCli } from './cli.ts';
import { LIVE_CSS_RULES, LIVE_DOM_RULES } from './live-rule-adapter.ts';
import { normalizeSourceFilePath, resolveElementSource } from './source-locator.ts';
import type { VerificationFinding } from './types.ts';
import { buildFingerprint, filterAgainstBaseline, runVerify } from './verify.ts';

function createDom(html: string) {
  const dom = parseHTML(html);
  const win = dom.window as unknown as Window;
  return { dom, win, document: dom.document as unknown as Document };
}

describe('source-locator', () => {
  it('normalizes Vite, webpack, and absolute filesystem URLs to workspace paths', () => {
    assert.equal(
      normalizeSourceFilePath('webpack-internal:///(app-pages-browser)/./src/components/Menu.tsx?t=123'),
      'src/components/Menu.tsx',
    );
    assert.equal(
      normalizeSourceFilePath('http://localhost:5173/@fs/Users/dev/app/src/Modal.tsx?import'),
      'src/Modal.tsx',
    );
    assert.equal(
      normalizeSourceFilePath('file:///workspace/pages/checkout.tsx#L10'),
      'pages/checkout.tsx',
    );
  });

  it('resolves React 16-18 _debugSource, React 19 _debugStack, Vue, Svelte, Angular, and Astro', () => {
    const { win, document } = createDom(`<!doctype html><html lang="en"><body>
      <button id="r18">R18</button>
      <button id="r19">R19</button>
      <div id="vue">Vue</div>
      <div id="svelte">Svelte</div>
      <div id="ng">Ng</div>
      <section data-astro-source-file="/repo/src/Hero.astro" data-astro-source-loc="14:3"><p id="astro">Hi</p></section>
    </body></html>`);

    const r18 = document.getElementById('r18')!;
    Object.assign(r18, {
      __reactFiber$abc: {
        type: 'button',
        _debugOwner: { type: { displayName: 'Memo(SaveButton)' } },
        _debugSource: { fileName: '/repo/src/SaveButton.tsx', lineNumber: 22, columnNumber: 7 },
      },
    });
    assert.deepEqual(resolveElementSource(r18, win), {
      framework: 'react',
      component: 'SaveButton',
      file: 'src/SaveButton.tsx',
      line: 22,
      column: 7,
    });

    const r19 = document.getElementById('r19')!;
    Object.assign(r19, {
      __reactFiber$xyz: {
        type: 'button',
        _debugStack: new Error('react-stack-top-frame'),
      },
    });
    (r19 as unknown as { __reactFiber$xyz: { _debugStack: Error } }).__reactFiber$xyz._debugStack.stack =
      'Error\n  at jsxDEV (http://localhost:5173/node_modules/react/jsx-dev-runtime.js:1:1)\n  at DialogTrigger (http://localhost:5173/src/DialogTrigger.tsx:41:12)';
    assert.deepEqual(resolveElementSource(r19, win), {
      framework: 'react',
      component: 'DialogTrigger',
      file: 'src/DialogTrigger.tsx',
      line: 41,
      column: 12,
    });

    const vue = document.getElementById('vue')!;
    Object.assign(vue, {
      __vueParentComponent: { type: { __name: 'FilterBar', __file: '/repo/src/FilterBar.vue', __line: 9 } },
    });
    assert.equal(resolveElementSource(vue, win).file, 'src/FilterBar.vue');
    assert.equal(resolveElementSource(vue, win).framework, 'vue');

    const svelte = document.getElementById('svelte')!;
    Object.assign(svelte, { __svelte_meta: { loc: { file: 'src/Card.svelte', line: 17, char: 4 } } });
    assert.deepEqual(resolveElementSource(svelte, win), {
      framework: 'svelte',
      component: 'Card',
      file: 'src/Card.svelte',
      line: 17,
      column: 4,
    });

    const ngEl = document.getElementById('ng')!;
    class CheckoutPanelComponent {}
    Object.assign(win, {
      ng: {
        getComponent: (el: Element) => (el === ngEl ? new CheckoutPanelComponent() : null),
        getDirectiveMetadata: () => ({ templateUrl: 'src/app/checkout-panel.html', line: 31, column: 2 }),
      },
    });
    const ngLoc = resolveElementSource(ngEl, win);
    assert.equal(ngLoc.framework, 'angular');
    assert.equal(ngLoc.file, 'src/app/checkout-panel.html');
    assert.equal(ngLoc.line, 31);

    const astroLoc = resolveElementSource(document.getElementById('astro')!, win);
    assert.equal(astroLoc.framework, 'astro');
    assert.equal(astroLoc.file, 'src/Hero.astro');
    assert.equal(astroLoc.line, 14);
  });
});

describe('browser-audit', () => {
  it('runs calibrated MWG DOM and CSS analyzer rules live and filters unused CSS selectors', () => {
    assert.equal(LIVE_DOM_RULES.length, 6);
    assert.equal(LIVE_CSS_RULES.length, 15);

    const { win, document } = createDom(`<!doctype html><html lang="en"><head>
      <title>Live MWG Rules</title>
      <script src="https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js"></script>
      <style>
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: #888; }
        input:not(:focus):invalid { border-color: red; }
        .unused-accordion { max-height: 0; transition: max-height 0.3s ease; }
        .used-drawer { max-height: 0; transition: max-height 0.3s ease; }
        @media (prefers-color-scheme: dark) {
          body { background: #111; color: #eee; }
        }
      </style>
    </head><body>
      <form id="login-form">
        <input id="email" type="email" name="email">
        <input id="pwd" type="password" name="password">
      </form>
      <div id="custom-prog" role="progressbar" aria-valuenow="42" aria-valuemin="0" aria-valuemax="100"></div>
      <div class="used-drawer">Drawer</div>
      <div id="overlay-root"><div role="progressbar" aria-valuenow="10"></div></div>
    </body></html>`);

    const result = runPageAudit(win, { excludeRootIds: ['overlay-root'] });
    const ids = new Set(result.findings.map((f) => f.id));

    assert.ok(ids.has('autofill-sign-in-form'), `Expected autofill-sign-in-form; got ${[...ids]}`);
    assert.ok(ids.has('progress'), `Expected progress rule; got ${[...ids]}`);
    assert.ok(ids.has('secure-external-subresources'), `Expected SRI rule; got ${[...ids]}`);
    assert.ok(
      ids.has('customize-scrollbar-color-and-thickness'),
      `Expected scrollbar CSS rule; got ${[...ids]}`,
    );
    assert.ok(
      ids.has('validate-input-after-interaction'),
      `Expected :user-invalid CSS rule; got ${[...ids]}`,
    );
    assert.ok(ids.has('dark-mode'), `Expected dark-mode CSS rule; got ${[...ids]}`);
    assert.ok(
      ids.has('animate-to-intrinsic-sizes'),
      `Expected animate-to-intrinsic-sizes on .used-drawer; got ${[...ids]}`,
    );
    assert.equal(
      result.findings.filter((f) => f.id === 'animate-to-intrinsic-sizes').length,
      1,
      'Unused .unused-accordion selector should not emit a finding',
    );
    assert.equal(
      result.findings.filter((f) => f.id === 'progress').length,
      1,
      'excludeRootIds should skip progressbar inside overlay-root',
    );

    const pwd = document.getElementById('pwd')!;
    const scopedPwd = auditElement(pwd, win);
    const scopedIds = new Set(scopedPwd.map((f) => f.id));
    assert.ok(scopedIds.has('autofill-sign-in-form'), 'Scoped auditElement runs DOM rules on input');
    assert.ok(
      scopedIds.has('validate-input-after-interaction'),
      'Scoped auditElement runs matching CSS rules on input',
    );
  });

  it('skips dark-mode when document declares meta color-scheme dark', () => {
    const { win } = createDom(`<!doctype html><html lang="en"><head>
      <meta name="color-scheme" content="light dark">
      <style>
        @media (prefers-color-scheme: dark) {
          body { background: #111; color: #eee; }
        }
      </style>
    </head><body><p>Hello</p></body></html>`);

    const result = runPageAudit(win);
    assert.equal(
      result.findings.some((f) => f.id === 'dark-mode'),
      false,
      'meta[name="color-scheme"] dark opt-in should suppress dark-mode finding',
    );
  });

  it('detects runtime MWG checks (sticky clipping, responsive tables, text scale, native UI) and honors ignore waivers', () => {
    const { win, document } = createDom(`<!doctype html><html lang="en"><head>
      <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
      <title>Audit</title>
    </head><body>
      <div id="clip-wrap"><header id="sticky-hdr">Nav</header></div>
      <div id="table-parent"><table id="wide-table"><tr><td>Cell</td></tr></table></div>
      <div class="dropdown" role="menu">Menu</div>
      <div role="dialog" aria-modal="true">Custom Modal</div>
      <div class="accordion-item">Accordion</div>
      <div role="switch">Toggle</div>
      <textarea id="notes" aria-label="Notes"></textarea>
      <div data-mwg-ignore="mwg-native-dialog"><div role="dialog" aria-modal="true">Waived</div></div>
      <div data-mwg-ignore="*"><div id="waived-prog" role="progressbar" aria-valuenow="50"></div></div>
    </body></html>`);

    const clipWrap = document.getElementById('clip-wrap')!;
    const stickyHdr = document.getElementById('sticky-hdr')!;
    const tableParent = document.getElementById('table-parent')!;
    const wideTable = document.getElementById('wide-table')!;
    const notes = document.getElementById('notes')!;

    Object.defineProperty(tableParent, 'clientWidth', { value: 320, configurable: true });
    Object.defineProperty(wideTable, 'scrollWidth', { value: 640, configurable: true });

    assert.equal(isRuleIgnored(document.getElementById('waived-prog')!, 'progress'), true);

    (win as unknown as Record<string, unknown>).getComputedStyle = (el: Element) =>
      ({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        position: el === stickyHdr ? 'sticky' : 'static',
        top: el === stickyHdr ? '0px' : 'auto',
        bottom: 'auto',
        left: 'auto',
        right: 'auto',
        overflowX: el === clipWrap ? 'hidden' : 'visible',
        overflowY: el === clipWrap ? 'hidden' : 'visible',
        getPropertyValue: (prop: string) => (prop === 'field-sizing' && el === notes ? 'fixed' : ''),
      }) as unknown as CSSStyleDeclaration;

    const result = runPageAudit(win);
    const ids = new Set(result.findings.map((f) => f.id));
    const stickyFinding = result.findings.find((f) => f.id === 'sticky-overflow-ancestor');

    assert.ok(stickyFinding, 'Expected broken sticky ancestor detection');
    assert.equal(stickyFinding.selector, '#sticky-hdr');
    assert.equal(stickyFinding.culpritSelector, '#clip-wrap');
    assert.deepEqual(stickyFinding.guides, ['overflow-clipping-control', 'css-layout']);
    assert.ok(ids.has('responsive-table'), 'Expected overflowing table detection');
    assert.ok(ids.has('respect-os-text-scale'), 'Expected viewport zoom-lock detection');
    assert.ok(ids.has('mwg-native-popover-menu'), 'Expected custom dropdown MWG finding');
    assert.ok(ids.has('mwg-native-dialog'), 'Expected custom modal MWG finding');
    assert.ok(ids.has('mwg-native-accordion'), 'Expected custom accordion MWG finding');
    assert.ok(ids.has('mwg-native-switch'), 'Expected custom switch MWG finding');
    assert.ok(ids.has('mwg-field-sizing'), 'Expected textarea field-sizing finding');
    assert.equal(
      result.findings.filter((f) => f.id === 'mwg-native-dialog').length,
      1,
      'data-mwg-ignore should suppress the waived custom modal',
    );
    assert.equal(ids.has('progress'), false, 'data-mwg-ignore="*" should waive progressbar');

    const scoped = auditElement(stickyHdr, win);
    assert.equal(scoped.length, 1);
    assert.equal(scoped[0].id, 'sticky-overflow-ancestor');
    assert.equal(scoped[0].culpritSelector, '#clip-wrap');
  });
});

describe('verify CLI, baseline filtering, and GitHub annotations', () => {
  it('suppresses baseline findings by fingerprint and escapes GitHub workflow annotations', () => {
    const f1: VerificationFinding = {
      id: 'sticky-overflow-ancestor',
      fingerprint: buildFingerprint({ id: 'sticky-overflow-ancestor', file: 'src/Layout.tsx', line: 12, message: 'sticky' }),
      category: 'LAYOUT',
      severity: 'error',
      selector: '.wrap',
      file: 'src/Layout.tsx',
      line: 12,
      column: 4,
      message: 'Sticky broken: 100%,\nfix it',
      fix: 'Use overflow: clip',
      guides: ['overflow-clipping-control'],
    };
    const f2: VerificationFinding = {
      id: 'autofill-sign-in-form',
      fingerprint: buildFingerprint({ id: 'autofill-sign-in-form', file: 'src/Login.tsx', line: 5, message: 'pwd' }),
      category: 'MODERNITY',
      severity: 'warning',
      file: 'src/Login.tsx',
      line: 5,
      message: 'Password input missing autocomplete',
      fix: 'Add autocomplete="current-password"',
      guides: ['autofill-sign-in-form'],
    };

    const filtered = filterAgainstBaseline([f1, f2], { findings: [f1] });
    assert.equal(filtered.suppressedCount, 1);
    assert.deepEqual(
      filtered.findings.map((f) => f.id),
      ['autofill-sign-in-form'],
    );

    const gh = formatGithubAnnotations([f1]);
    assert.ok(gh.startsWith('::error title=LAYOUT sticky-overflow-ancestor,file=src/Layout.tsx,line=12,col=4::'));
    assert.ok(gh.includes('100%25%2C%0Afix it') || gh.includes('100%25,%0Afix it'));
    assert.ok(gh.includes('npx modern-web-guidance retrieve overflow-clipping-control'));
  });

  it('validates CLI arguments and runs static legacy-scan via --dir', async () => {
    const helpRes = await runVerifyingCli(['--help']);
    assert.equal(helpRes.exitCode, 0);
    assert.ok(helpRes.stdout?.includes('Usage: modern-web-guidance verify <url> [options]'));

    const missingRes = await runVerifyingCli([]);
    assert.equal(missingRes.exitCode, 1);

    const badThrottle = await runVerifyingCli(['http://127.0.0.1:3000', '--cpu-throttle', '0']);
    assert.equal(badThrottle.exitCode, 1);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mwg-verify-static-'));
    try {
      const res = await runVerifyingCli(['--dir', tempDir, '--json']);
      assert.equal(res.exitCode, 0);
      const report = JSON.parse(res.stdout!);
      assert.equal(report.passed, true);
      assert.equal(report.targetDir, tempDir);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

const hasPlaywrightChromium = Boolean(findPlaywrightChromiumExecutable());

describe('verify live headless Chromium E2E', { skip: !hasPlaywrightChromium }, () => {
  it('catches MWG live DOM/CSS rules, mobile overflow, broken sticky, CDP click listeners, Escape traps, and --baseline', async () => {
    const html = `<!doctype html>
      <html lang="en">
      <head>
        <title>Live Verify E2E</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { margin: 0; font-family: sans-serif; }
          ::-webkit-scrollbar { width: 8px; }
          ::-webkit-scrollbar-thumb { background: #888; }
          input:invalid { border-color: red; }
          .wide { width: 900px; height: 20px; }
          .clip { overflow: hidden; height: 200px; }
          .sticky-nav { position: sticky; top: 0; }
          .modal { display: none; position: fixed; inset: 40px; background: #fff; }
          .modal.open { display: block; }
        </style>
      </head>
      <body>
        <div class="wide">Mobile overflow banner</div>
        <div class="clip"><div class="sticky-nav">Sticky Header</div></div>
        <form>
          <input type="email" name="email">
          <input type="password" name="password">
        </form>
        <div role="progressbar" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100"></div>
        <div id="fake-btn">Click me without button semantics</div>
        <button id="open-trap" type="button">Open Trap Modal</button>
        <div id="trap-modal" class="modal" role="dialog" aria-modal="true">Stuck modal</div>
        <script>
          document.getElementById('fake-btn').addEventListener('click', () => {});
          document.getElementById('open-trap').addEventListener('click', () => {
            document.getElementById('trap-modal').classList.add('open');
          });
          console.error('Hydration failed because the initial UI does not match what was rendered on the server.');
        </script>
      </body>
      </html>`;

    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const url = `http://127.0.0.1:${port}/`;
    const baselinePath = path.join(os.tmpdir(), `mwg-baseline-${process.pid}-${Date.now()}.json`);

    try {
      const report = await runVerify({ url, mobile: true, cpuThrottle: 4, smokeProbe: true });
      const ids = new Set(report.findings.map((f) => f.id));

      assert.equal(report.passed, false);
      assert.deepEqual(report.viewport, { width: 390, height: 844, mobile: true });
      assert.equal(report.cpuThrottle, 4);
      assert.ok(ids.has('horizontal-overflow'), `Expected horizontal-overflow in mobile mode; got ${[...ids]}`);
      assert.ok(ids.has('sticky-overflow-ancestor'), `Expected sticky-overflow-ancestor; got ${[...ids]}`);
      assert.ok(ids.has('autofill-sign-in-form'), `Expected live DOM autofill-sign-in-form; got ${[...ids]}`);
      assert.ok(ids.has('progress'), `Expected live DOM progress rule; got ${[...ids]}`);
      assert.ok(
        ids.has('customize-scrollbar-color-and-thickness'),
        `Expected live CSS scrollbar rule; got ${[...ids]}`,
      );
      assert.ok(
        ids.has('validate-input-after-interaction'),
        `Expected live CSS :user-invalid rule; got ${[...ids]}`,
      );
      assert.ok(ids.has('a11y-non-semantic-click'), `Expected CDP click listener finding; got ${[...ids]}`);
      assert.ok(ids.has('ssr-hydration-mismatch'), `Expected SSR hydration mismatch; got ${[...ids]}`);
      assert.ok(ids.has('smoke-modal-focus-trap'), `Expected Escape modal focus trap; got ${[...ids]}`);

      // Verify --baseline suppresses all known findings on the next run.
      fs.writeFileSync(baselinePath, JSON.stringify(report));
      const second = await runVerify({ url, mobile: true, baselinePath, smokeProbe: true });
      assert.equal(second.passed, true);
      assert.equal(second.findingsCount, 0);
      assert.ok(second.suppressedCount >= 8);
    } finally {
      fs.rmSync(baselinePath, { force: true });
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
