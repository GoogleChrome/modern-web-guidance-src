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

import type {
  ActivePackName,
  FileRecord,
  FindingCategory,
  FindingSeverity,
  NodeHint,
  PackSource,
  VerificationFinding,
} from './types.ts';

declare global {
  interface Window {
    __mwVerifyIsVisuallyRendered?: (el: Element) => boolean;
    __mwVerifyNodeHint?: (el: Element) => NodeHint;
    __mwPerfTelemetry?: {
      cls?: number;
      lcpMs?: number;
      shifts?: Array<{
        value: number;
        touchesPriceOrCta?: boolean;
        selector?: string;
        html?: string;
      }>;
      loafs?: Array<{
        type: string;
        duration: number;
        blockingDuration: number;
        phase: string;
        control: string | null;
      }>;
    };
  }
}

export const VALID_PACK_INPUTS = new Set(['commerce', 'media', 'saas', 'auto', 'none']);
export const ACTIVE_PACK_NAMES = new Set<ActivePackName>(['commerce', 'media', 'saas']);

const COMMERCE_DEPS = new Set([
  'stripe',
  '@stripe/stripe-js',
  '@stripe/react-stripe-js',
  '@paypal/react-paypal-js',
  '@shopify/hydrogen',
  '@shopify/hydrogen-react',
  '@medusajs/js-sdk',
  '@medusajs/medusa',
  'snipcart',
]);

const MEDIA_DEPS = new Set([
  'hls.js',
  'video.js',
  'shaka-player',
  'dashjs',
  '@mux/mux-player',
  '@mux/mux-player-react',
  'plyr',
]);

const SAAS_DEPS = new Set([
  '@tanstack/react-table',
  '@tanstack/vue-table',
  '@tanstack/svelte-table',
  'ag-grid-community',
  'ag-grid-react',
  'ag-grid-vue3',
  'ag-grid-angular',
  'handsontable',
]);

export interface PackageManifestLike {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  keywords?: unknown[];
  modernWeb?: { pack?: unknown };
  'modern-web'?: { pack?: unknown };
}

function isActivePackName(val: string): val is ActivePackName {
  return val === 'commerce' || val === 'media' || val === 'saas';
}

export function resolveVerticalPack(
  options: { explicitPack?: string; pkg?: PackageManifestLike } = {},
): { pack: ActivePackName | null; packSource: PackSource } {
  const { explicitPack, pkg = {} } = options;
  if (explicitPack !== undefined && explicitPack !== null && String(explicitPack).trim() !== '') {
    const normalized = String(explicitPack).trim().toLowerCase();
    if (!VALID_PACK_INPUTS.has(normalized)) {
      throw new Error(
        `Invalid vertical pack "${explicitPack}". Expected one of: commerce, media, saas, auto, none.`,
      );
    }
    if (normalized === 'none') {
      return { pack: null, packSource: 'explicit' };
    }
    if (isActivePackName(normalized)) {
      return { pack: normalized, packSource: 'explicit' };
    }
  }

  const pkgConfigPack = pkg.modernWeb?.pack ?? pkg['modern-web']?.pack ?? null;
  if (typeof pkgConfigPack === 'string' && pkgConfigPack.trim()) {
    const normalized = pkgConfigPack.trim().toLowerCase();
    if (!VALID_PACK_INPUTS.has(normalized)) {
      throw new Error(
        `Invalid package.json modernWeb.pack "${pkgConfigPack}". Expected one of: commerce, media, saas, none.`,
      );
    }
    if (normalized === 'none') {
      return { pack: null, packSource: 'package.json' };
    }
    if (isActivePackName(normalized)) {
      return { pack: normalized, packSource: 'package.json' };
    }
  }

  const allDeps = Object.keys({
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  });

  if (allDeps.some((d) => COMMERCE_DEPS.has(d))) {
    return { pack: 'commerce', packSource: 'auto' };
  }
  if (allDeps.some((d) => MEDIA_DEPS.has(d))) {
    return { pack: 'media', packSource: 'auto' };
  }
  if (allDeps.some((d) => SAAS_DEPS.has(d))) {
    return { pack: 'saas', packSource: 'auto' };
  }

  const keywords = Array.isArray(pkg.keywords)
    ? pkg.keywords.map((k) => String(k).toLowerCase())
    : [];
  if (
    keywords.some(
      (k) => k === 'ecommerce' || k === 'e-commerce' || k === 'checkout' || k === 'storefront',
    )
  ) {
    return { pack: 'commerce', packSource: 'auto' };
  }
  if (
    keywords.some(
      (k) => k === 'publisher' || k === 'newsroom' || k === 'streaming' || k === 'editorial',
    )
  ) {
    return { pack: 'media', packSource: 'auto' };
  }
  if (keywords.some((k) => k === 'saas' || k === 'admin-dashboard' || k === 'datagrid')) {
    return { pack: 'saas', packSource: 'auto' };
  }

  return { pack: null, packSource: 'none' };
}

function lineNumberAt(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

interface StaticPackCheck {
  id: string;
  severity: FindingSeverity;
  pattern: RegExp;
  skipWhen?: RegExp;
  guides: string[];
  message: string;
  fix: string;
}

const STATIC_PACK_CHECKS: Record<ActivePackName, StaticPackCheck[]> = {
  commerce: [
    {
      id: 'PACK-COMMERCE-NO-PASTE-BLOCK',
      severity: 'error',
      pattern:
        /\bonPaste\s*=\s*\{[^}]*\bpreventDefault\s*\(\s*\)|\bonpaste\s*=\s*['"]\s*return\s+false/i,
      guides: ['autofill-payment-form', 'autofill-sign-in-form', 'forms'],
      message:
        'Blocking paste (`onPaste` preventDefault) breaks password managers and payment/address entry.',
      fix: 'Allow paste on all authentication, card, and address inputs and pair with semantic `autocomplete` tokens.',
    },
  ],
  media: [
    {
      id: 'PACK-MEDIA-CONFLICTING-HERO-PRIORITY',
      severity: 'warning',
      pattern:
        /<img\b[^>]*\bloading\s*=\s*['"]lazy['"][^>]*\bfetchpriority\s*=\s*['"]high['"]|<img\b[^>]*\bfetchpriority\s*=\s*['"]high['"][^>]*\bloading\s*=\s*['"]lazy['"]/i,
      guides: ['optimize-image-priority', 'performance'],
      message:
        'Image combines `loading="lazy"` with `fetchpriority="high"`, delaying LCP hero fetch.',
      fix: 'Remove `loading="lazy"` on above-the-fold hero images and reserve `fetchpriority="high"` for eager LCP media.',
    },
  ],
  saas: [
    {
      id: 'PACK-SAAS-GLOBAL-LISTENER-NO-SIGNAL',
      severity: 'warning',
      pattern:
        /\b(?:window|document)\.addEventListener\s*\(\s*['"](?:keydown|resize|scroll|pointermove|mousemove)['"]\s*,\s*[^,)]+\)/,
      skipWhen: /\b(?:removeEventListener|AbortController|signal)\b/,
      guides: ['coordinate-global-events', 'performance'],
      message:
        'Global `window`/`document` listener registered without `AbortController` `signal` or `removeEventListener` cleanup.',
      fix: 'Pass `{ signal: controller.signal }` via `AbortController` so route/panel teardowns never accumulate global listeners.',
    },
  ],
};

function packCategory(pack: ActivePackName): FindingCategory {
  if (pack === 'commerce') return 'PACK:COMMERCE';
  if (pack === 'media') return 'PACK:MEDIA';
  return 'PACK:SAAS';
}

export function runStaticPackChecks(
  pack: ActivePackName | null,
  fileRecords: readonly FileRecord[],
  mwgGuideSet?: ReadonlySet<string> | null,
): VerificationFinding[] {
  if (!pack) return [];
  const checks = STATIC_PACK_CHECKS[pack];
  const category = packCategory(pack);
  const out: VerificationFinding[] = [];

  for (const rec of fileRecords) {
    for (const check of checks) {
      if (check.skipWhen && check.skipWhen.test(rec.stripped)) continue;
      const m = check.pattern.exec(rec.stripped);
      if (!m) continue;
      const line = lineNumberAt(rec.stripped, m.index);
      out.push({
        category,
        severity: check.severity,
        file: rec.relPath,
        line,
        ruleId: check.id,
        message: check.message,
        guides: mwgGuideSet ? check.guides.filter((g) => mwgGuideSet.has(g)) : check.guides,
        fix: check.fix,
      });
    }
  }
  return out;
}

export interface PackBrowserViolation {
  id: string;
  severity: FindingSeverity;
  message: string;
  guides: string[];
  fix: string;
  node: NodeHint;
}

export interface PackBrowserResult {
  pack: string;
  metrics: Record<string, number>;
  violations: PackBrowserViolation[];
}

/**
 * Serialized via `Function.prototype.toString()` and evaluated inside Chromium via CDP.
 * Uses pure runtime `instanceof` checks (no TypeScript casts inside the function body)
 * so both esbuild and Node native type-stripping produce valid browser JS.
 */
function evaluatePackInBrowser(pack: string): PackBrowserResult {
  const isVis = window.__mwVerifyIsVisuallyRendered || ((el: Element) => el instanceof Element);
  const hintOf =
    window.__mwVerifyNodeHint || ((el: Element) => ({ html: el.outerHTML?.slice(0, 100) || '' }));
  const vw = Math.max(1, window.innerWidth || 1280);
  const vh = Math.max(1, window.innerHeight || 800);
  const violations: PackBrowserViolation[] = [];
  const metrics: Record<string, number> = {};

  if (pack === 'commerce') {
    const AUTOFILL_FIELD_RE =
      /(?:^|[\s_-])(email|e-mail|cc-number|card[-_]?number|cardnumber|cc-exp|card[-_]?exp|expiry|cc-csc|cvc|cvv|security[-_]?code|postal[-_]?code|zip[-_]?code|postcode|street[-_]?address|address[-_]?line1|shipping[-_]?address|billing[-_]?address|tel|phone)(?:$|[\s_-])/i;
    const PROMO_EXCLUDE_RE =
      /\b(?:promo|coupon|voucher|discount|gift[-_]?card|search|query|filter|otp)\b/i;

    for (const input of document.querySelectorAll('input, select')) {
      if (!isVis(input)) continue;
      if (
        input instanceof HTMLInputElement &&
        ['hidden', 'submit', 'button', 'reset', 'checkbox', 'radio', 'file'].includes(input.type)
      ) {
        continue;
      }
      const labels =
        input instanceof HTMLInputElement || input instanceof HTMLSelectElement
          ? input.labels
          : null;
      const labelTxt = labels
        ? Array.from(labels)
            .map((l) => l.textContent || '')
            .join(' ')
        : '';
      const descriptor = [
        input.getAttribute('name') || '',
        input.id || '',
        input.getAttribute('placeholder') || '',
        input.getAttribute('aria-label') || '',
        labelTxt,
      ].join(' ');
      if (PROMO_EXCLUDE_RE.test(descriptor)) continue;
      const isEmailType = input instanceof HTMLInputElement && input.type === 'email';
      const isTelType = input instanceof HTMLInputElement && input.type === 'tel';
      if (!isEmailType && !isTelType && !AUTOFILL_FIELD_RE.test(descriptor)) continue;

      const ac = (input.getAttribute('autocomplete') || '').trim().toLowerCase();
      if (!ac || ac === 'off' || ac === 'false') {
        const isPayment = /(?:cc-|card|cvc|cvv|expiry)/i.test(descriptor);
        violations.push({
          id: 'commerce-autofill-missing',
          severity: 'error',
          message: `${hintOf(input).html || '<input>'} checkout/identity field lacks a valid autocomplete token (found "${ac || 'none'}").`,
          guides: isPayment
            ? ['autofill-payment-form', 'forms']
            : ['autofill-address-form', 'forms'],
          fix: isPayment
            ? 'Add semantic payment `autocomplete` tokens (`cc-name`, `cc-number`, `cc-exp`, `cc-csc`) and `inputmode="numeric"`.'
            : 'Add semantic address/contact `autocomplete` tokens (`email`, `shipping street-address`, `postal-code`, `tel`).',
          node: hintOf(input),
        });
      }
    }

    const perfState = window.__mwPerfTelemetry;
    const priceCtaShifts = [];
    let totalCls = 0;
    if (perfState && Array.isArray(perfState.shifts)) {
      for (const s of perfState.shifts) {
        totalCls += s.value || 0;
        if (s.touchesPriceOrCta && s.value >= 0.005) {
          priceCtaShifts.push(s);
        }
      }
    }
    metrics.checkoutCls = Math.round(totalCls * 10000) / 10000;
    if (priceCtaShifts.length > 0) {
      const worst = priceCtaShifts.sort((a, b) => b.value - a.value)[0];
      violations.push({
        id: 'commerce-price-cta-cls',
        severity: 'error',
        message: `Unexpected layout shift (CLS ${worst.value.toFixed(3)}) moved pricing/checkout control ${worst.selector || '<element>'} after paint.`,
        guides: ['performance', 'css-layout', 'visually-stable-font-fallbacks'],
        fix: 'Reserve explicit dimensions (`min-height` / `aspect-ratio`) for async promo/shipping/price slots above primary checkout CTAs.',
        node: { selector: worst.selector || '', html: worst.html || '' },
      });
    }

    for (const btn of document.querySelectorAll('button, [role="button"], input[type="submit"]')) {
      if (!(btn instanceof HTMLElement) || !isVis(btn)) continue;
      const inputVal = btn instanceof HTMLInputElement ? btn.value : '';
      const txt = (
        (btn.innerText || inputVal || btn.getAttribute('aria-label') || '') +
        ' ' +
        (btn.id || '')
      ).toLowerCase();
      if (!/\b(?:checkout|pay|place order|complete purchase|buy now)\b/.test(txt)) continue;
      if (btn.tabIndex < 0) {
        violations.push({
          id: 'commerce-cta-keyboard-unreachable',
          severity: 'error',
          message: `${hintOf(btn).html || '<button>'} primary checkout CTA removes itself from keyboard Tab order (tabIndex < 0).`,
          guides: ['accessibility', 'forms'],
          fix: 'Ensure primary checkout and payment submit buttons remain natively focusable (`tabIndex >= 0`).',
          node: hintOf(btn),
        });
      }
    }
  }

  if (pack === 'media') {
    const COLS = 40;
    const ROWS = 25;
    const occludedGrid = new Uint8Array(COLS * ROWS);
    const adGrid = new Uint8Array(COLS * ROWS);

    const markRect = (grid: Uint8Array, rect: DOMRect): void => {
      const x0 = Math.max(0, Math.min(vw, rect.left));
      const y0 = Math.max(0, Math.min(vh, rect.top));
      const x1 = Math.max(0, Math.min(vw, rect.right));
      const y1 = Math.max(0, Math.min(vh, rect.bottom));
      if (x1 <= x0 || y1 <= y0) return;
      const c0 = Math.floor((x0 / vw) * COLS);
      const c1 = Math.min(COLS, Math.ceil((x1 / vw) * COLS));
      const r0 = Math.floor((y0 / vh) * ROWS);
      const r1 = Math.min(ROWS, Math.ceil((y1 / vh) * ROWS));
      for (let r = r0; r < r1; r++) {
        for (let c = c0; c < c1; c++) {
          grid[r * COLS + c] = 1;
        }
      }
    };

    const AD_SELECTOR = [
      '[data-ad]',
      '[data-ad-slot]',
      '[data-ad-unit]',
      'ins.adsbygoogle',
      '[id^="ad-"]',
      '[id^="ad_"]',
      '[id*="google_ads" i]',
      '[class*="ad-slot" i]',
      '[class*="ad-unit" i]',
      '[class*="ad-banner" i]',
      '[class*="ad-container" i]',
      'iframe[src*="ads" i]',
      'iframe[title*="ad" i]',
      'iframe[title*="sponsor" i]',
    ].join(',');

    const adElements = Array.from(document.querySelectorAll(AD_SELECTOR)).filter(isVis);
    let largestChromeNode: Element | null = null;
    let largestChromeArea = 0;

    for (const adEl of adElements) {
      const r = adEl.getBoundingClientRect();
      markRect(adGrid, r);
      markRect(occludedGrid, r);
      const area =
        Math.max(0, Math.min(vw, r.right) - Math.max(0, r.left)) *
        Math.max(0, Math.min(vh, r.bottom) - Math.max(0, r.top));
      if (area > largestChromeArea) {
        largestChromeArea = area;
        largestChromeNode = adEl;
      }

      const style = window.getComputedStyle(adEl);
      const hasWidthAttr = adEl.hasAttribute('width');
      const hasHeightAttr = adEl.hasAttribute('height');
      const hasAspect = style.aspectRatio && style.aspectRatio !== 'auto';
      const minH = parseFloat(style.minHeight) || 0;
      if ((!hasWidthAttr || !hasHeightAttr) && !hasAspect && minH < 1 && r.height < 20) {
        violations.push({
          id: 'media-unreserved-ad-box',
          severity: 'warning',
          message: `${hintOf(adEl).html || '<div>'} ad/embed slot lacks reserved min-height, width/height, or aspect-ratio (causes CLS on fill).`,
          guides: ['performance', 'css-layout'],
          fix: 'Reserve explicit `min-height` or `aspect-ratio` on ad/embed containers so asynchronous fills never shift article text.',
          node: hintOf(adEl),
        });
      }
    }

    for (const el of document.querySelectorAll('body *')) {
      if (!isVis(el)) continue;
      if (el.tagName === 'MAIN' || el.tagName === 'ARTICLE') continue;
      const style = window.getComputedStyle(el);
      if (style.position !== 'fixed' && style.position !== 'sticky') continue;
      if (style.pointerEvents === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (el.tagName === 'DIALOG' && el.hasAttribute('open')) continue;
      markRect(occludedGrid, r);
      const area =
        Math.max(0, Math.min(vw, r.right) - Math.max(0, r.left)) *
        Math.max(0, Math.min(vh, r.bottom) - Math.max(0, r.top));
      if (area > largestChromeArea) {
        largestChromeArea = area;
        largestChromeNode = el;
      }
    }

    let occludedCells = 0;
    let adCells = 0;
    for (let i = 0; i < COLS * ROWS; i++) {
      occludedCells += occludedGrid[i];
      adCells += adGrid[i];
    }
    const occlusionRatio = occludedCells / (COLS * ROWS);
    const adDensityRatio = adCells / (COLS * ROWS);
    metrics.viewportOcclusionRatio = Math.round(occlusionRatio * 1000) / 1000;
    metrics.adDensityRatio = Math.round(adDensityRatio * 1000) / 1000;

    if (occlusionRatio > 0.25 || adDensityRatio > 0.2) {
      const pct = Math.round(occlusionRatio * 100);
      const adPct = Math.round(adDensityRatio * 100);
      violations.push({
        id: 'media-viewport-occlusion-density',
        severity: occlusionRatio > 0.35 || adDensityRatio > 0.3 ? 'error' : 'warning',
        message: `Excessive ad/sticky viewport occlusion: ${pct}% of viewport (${adPct}% ads) consumed by fixed/sticky chrome & ad slots.`,
        guides: ['css-layout', 'persistent-top-layer-ui', 'responsive-design'],
        fix: 'Cap sticky chrome + ad/embed slots well below 25% of viewport height so primary editorial/media content remains readable.',
        node: largestChromeNode ? hintOf(largestChromeNode) : { html: '' },
      });
    }

    const visibleImgs = Array.from(document.querySelectorAll('img')).filter(isVis);
    let heroCandidate: HTMLImageElement | null = null;
    let heroArea = 0;
    for (const img of visibleImgs) {
      const r = img.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) {
        const area = r.width * r.height;
        if (area >= 40000 && area > heroArea) {
          heroArea = area;
          heroCandidate = img;
        }
      } else if (r.top > vh * 1.25) {
        const loading = (img.getAttribute('loading') || '').toLowerCase();
        if (loading !== 'lazy') {
          violations.push({
            id: 'media-below-fold-eager-img',
            severity: 'warning',
            message: `${hintOf(img).html || '<img>'} below-the-fold image (${Math.round(r.top)}px) omits loading="lazy".`,
            guides: ['optimize-image-priority', 'deliver-optimized-decorative-images'],
            fix: 'Add `loading="lazy"` and `decoding="async"` (with explicit `width` and `height`) on below-the-fold media.',
            node: hintOf(img),
          });
        }
      }
    }

    if (heroCandidate) {
      const loading = (heroCandidate.getAttribute('loading') || '').toLowerCase();
      const fp = (heroCandidate.getAttribute('fetchpriority') || '').toLowerCase();
      if (loading === 'lazy') {
        violations.push({
          id: 'media-hero-lazy-antipattern',
          severity: 'error',
          message: `${hintOf(heroCandidate).html || '<img>'} above-the-fold hero image uses loading="lazy", delaying LCP.`,
          guides: ['optimize-image-priority', 'performance'],
          fix: 'Remove `loading="lazy"` and add `fetchpriority="high"` on the primary above-the-fold LCP hero image.',
          node: hintOf(heroCandidate),
        });
      } else if (fp !== 'high') {
        violations.push({
          id: 'media-hero-missing-fetchpriority',
          severity: 'warning',
          message: `${hintOf(heroCandidate).html || '<img>'} primary hero image (${Math.round(heroArea / 1000)}k px²) omits fetchpriority="high".`,
          guides: ['optimize-image-priority', 'optimize-preload-priority'],
          fix: 'Set `fetchpriority="high"` on the primary above-the-fold hero `<img>` so the browser prioritizes LCP media.',
          node: hintOf(heroCandidate),
        });
      }
    }
  }

  if (pack === 'saas') {
    for (const table of document.querySelectorAll('table')) {
      if (!isVis(table)) continue;
      const bodyRows = table.querySelectorAll('tbody tr, tr');
      if (bodyRows.length < 2) continue;
      const headers = table.querySelectorAll('th');
      if (headers.length === 0) {
        violations.push({
          id: 'saas-table-missing-headers',
          severity: 'error',
          message: `${hintOf(table).html || '<table>'} data table lacks semantic <th> column headers.`,
          guides: ['responsive-table', 'sortable-table', 'accessibility'],
          fix: 'Provide `<thead><tr><th scope="col">...</th></tr></thead>` (and `<caption class="sr-only">` or `aria-label`) on data tables.',
          node: hintOf(table),
        });
        continue;
      }
      for (const th of headers) {
        const cls = typeof th.className === 'string' ? th.className : '';
        const isSortable =
          th.hasAttribute('data-sort') ||
          /\bsort(?:able)?\b/i.test(cls) ||
          th.hasAttribute('onclick');
        if (!isSortable) continue;
        const hasAriaSort = th.hasAttribute('aria-sort');
        const hasButton = Boolean(th.querySelector('button'));
        if (!hasAriaSort || !hasButton) {
          violations.push({
            id: 'saas-sortable-th-a11y',
            severity: 'error',
            message: `${hintOf(th).html || '<th>'} sortable column header lacks \`<button>\` trigger or \`aria-sort\` state.`,
            guides: ['sortable-table', 'accessibility'],
            fix: 'Place a native `<button type="button">` inside sortable `<th scope="col" aria-sort="ascending|descending|none">`.',
            node: hintOf(th),
          });
        }
      }
    }

    for (const grid of document.querySelectorAll(
      '[class*="datagrid" i], [class*="data-table" i], [data-testid*="table" i]',
    )) {
      if (!isVis(grid)) continue;
      if (grid.tagName === 'TABLE' || grid.querySelector('table')) continue;
      const role = (grid.getAttribute('role') || '').toLowerCase();
      if (role === 'table' || role === 'grid' || role === 'treegrid') continue;
      violations.push({
        id: 'saas-div-grid-missing-semantics',
        severity: 'error',
        message: `${hintOf(grid).html || '<div>'} renders a data-grid container without native <table> or role="table"/"grid" semantics.`,
        guides: ['responsive-table', 'sortable-table', 'accessibility'],
        fix: 'Use semantic `<table>` (`<thead>`, `<th scope="col">`, `<tbody>`) or complete ARIA `role="grid"` / `role="table"` hierarchy.',
        node: hintOf(grid),
      });
    }

    const totalDomNodes = document.getElementsByTagName('*').length;
    const renderedRows = document.querySelectorAll('tbody tr, [role="row"]').length;
    metrics.domNodes = totalDomNodes;
    metrics.renderedRows = renderedRows;
    if (renderedRows > 150) {
      const sampleRow = document.querySelector('tbody tr, [role="row"]');
      const cv = sampleRow ? window.getComputedStyle(sampleRow).contentVisibility : 'visible';
      if (cv !== 'auto') {
        violations.push({
          id: 'saas-unvirtualized-rows',
          severity: 'warning',
          message: `Rendered ${renderedRows} table/grid rows eagerly without \`content-visibility: auto\` or row virtualization.`,
          guides: ['defer-rendering-heavy-content', 'responsive-table', 'performance'],
          fix: 'Apply `content-visibility: auto; contain-intrinsic-size: auto 44px;` on offscreen rows/sections or paginate/virtualize large datasets.',
          node: sampleRow ? hintOf(sampleRow) : { html: '' },
        });
      }
    }
  }

  return { pack, metrics, violations };
}

export function buildInPagePackAuditExpression(pack: ActivePackName | null): string {
  if (!pack || !ACTIVE_PACK_NAMES.has(pack)) return 'null';
  return `(${evaluatePackInBrowser.toString()})(${JSON.stringify(pack)})`;
}
