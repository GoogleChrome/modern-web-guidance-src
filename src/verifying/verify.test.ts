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
  computeContrastRatio,
  isRuleIgnored,
  parseCssColor,
  runPageAudit,
} from './browser-audit.ts';
import { findPlaywrightChromiumExecutable } from './cdp.ts';
import { formatGithubAnnotations, runVerifyingCli } from './cli.ts';
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
        _debugStack: new Error(
          'react-stack-top-frame',
        ),
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
  it('parses hex, rgb, srgb, and oklch CSS colors and computes composited WCAG contrast', () => {
    assert.deepEqual(parseCssColor('#fff'), { r: 255, g: 255, b: 255, a: 1 });
    const oklchWhite = parseCssColor('oklch(1 0 0)');
    assert.ok(oklchWhite && oklchWhite.r === 255 && oklchWhite.g === 255 && oklchWhite.b === 255);
    const oklchDark = parseCssColor('oklch(0.2 0 0)');
    assert.ok(oklchDark && oklchDark.r < 50 && oklchDark.g < 50 && oklchDark.b < 50);

    const { win, document } = createDom('<html lang="en"><body><div id="box"><span id="txt">Low</span></div></body></html>');
    const txt = document.getElementById('txt')!;
    const box = document.getElementById('box')!;
    (win as unknown as Record<string, unknown>).getComputedStyle = (el: Element) =>
      ({
        color: el === txt ? 'oklch(0.82 0 0)' : '#000',
        backgroundColor: el === box ? '#ffffff' : 'transparent',
      }) as CSSStyleDeclaration;
    const ratio = computeContrastRatio(txt, win);
    assert.ok(ratio !== null && ratio < 2.5, `Expected low contrast ratio, got ${ratio}`);
  });

  it('detects broken sticky overflow, inert z-index, live MWG patterns, and honors ignore waivers', () => {
    const { win, document } = createDom(`<!doctype html><html lang="en"><head><title>Audit</title></head><body>
      <div id="clip-wrap"><header id="sticky-hdr">Nav</header></div>
      <div id="static-z">Badge</div>
      <div class="dropdown" role="menu">Menu</div>
      <div role="dialog" aria-modal="true">Custom Modal</div>
      <div class="accordion-item">Accordion</div>
      <div role="switch">Toggle</div>
      <textarea id="notes" aria-label="Notes"></textarea>
      <div data-mwg-ignore="mwg-native-dialog"><div role="dialog" aria-modal="true">Waived</div></div>
      <div data-gleam-ignore="*"><button id="waived-btn"></button></div>
    </body></html>`);

    const clipWrap = document.getElementById('clip-wrap')!;
    const stickyHdr = document.getElementById('sticky-hdr')!;
    const staticZ = document.getElementById('static-z')!;
    const notes = document.getElementById('notes')!;

    assert.equal(isRuleIgnored(document.getElementById('waived-btn')!, 'a11y-missing-name'), true);

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
        zIndex: el === staticZ ? '10' : 'auto',
        color: '#111111',
        backgroundColor: '#ffffff',
        fontSize: '16px',
        fontWeight: '400',
        aspectRatio: 'auto',
        getPropertyValue: (prop: string) => (prop === 'field-sizing' && el === notes ? 'fixed' : ''),
      }) as unknown as CSSStyleDeclaration;

    const result = runPageAudit(win);
    const ids = new Set(result.findings.map((f) => f.id));

    assert.ok(ids.has('sticky-overflow-ancestor'), 'Expected broken sticky ancestor detection');
    assert.ok(ids.has('inert-z-index'), 'Expected inert z-index detection');
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
    assert.equal(ids.has('a11y-missing-name'), false, 'data-gleam-ignore="*" should waive icon button');
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
      guides: ['css-layout'],
    };
    const f2: VerificationFinding = {
      id: 'inert-z-index',
      fingerprint: buildFingerprint({ id: 'inert-z-index', file: 'src/Badge.tsx', line: 5, message: 'z' }),
      category: 'LAYOUT',
      severity: 'warning',
      file: 'src/Badge.tsx',
      line: 5,
      message: 'z-index inert',
      fix: 'Remove z-index',
      guides: ['css-layout'],
    };

    const filtered = filterAgainstBaseline([f1, f2], { findings: [f1] });
    assert.equal(filtered.suppressedCount, 1);
    assert.deepEqual(
      filtered.findings.map((f) => f.id),
      ['inert-z-index'],
    );

    const gh = formatGithubAnnotations([f1]);
    assert.ok(gh.startsWith('::error title=LAYOUT sticky-overflow-ancestor,file=src/Layout.tsx,line=12,col=4::'));
    assert.ok(gh.includes('100%25%2C%0Afix it') || gh.includes('100%25,%0Afix it'));
    assert.ok(gh.includes('npx modern-web-guidance retrieve css-layout'));
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
  it('catches mobile overflow, broken sticky, CDP click listeners, Escape focus traps, and supports --baseline', async () => {
    const html = `<!doctype html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { margin: 0; font-family: sans-serif; }
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
      assert.ok(ids.has('a11y-non-semantic-click'), `Expected CDP click listener finding; got ${[...ids]}`);
      assert.ok(ids.has('ssr-hydration-mismatch'), `Expected SSR hydration mismatch; got ${[...ids]}`);
      assert.ok(ids.has('smoke-modal-focus-trap'), `Expected Escape modal focus trap; got ${[...ids]}`);
      assert.ok(ids.has('html-has-lang'), `Expected missing html lang; got ${[...ids]}`);

      // Verify --baseline suppresses all known findings on the next run.
      fs.writeFileSync(baselinePath, JSON.stringify(report));
      const second = await runVerify({ url, mobile: true, baselinePath, smokeProbe: true });
      assert.equal(second.passed, true);
      assert.equal(second.findingsCount, 0);
      assert.ok(second.suppressedCount >= 5);
    } finally {
      fs.rmSync(baselinePath, { force: true });
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
