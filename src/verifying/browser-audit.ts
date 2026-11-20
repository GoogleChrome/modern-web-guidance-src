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

import { resolveElementSource } from './source-locator.ts';
import type {
  BrowserAuditFinding,
  FindingCategory,
  FindingSeverity,
  InteractiveCandidate,
  PageAuditOptions,
  PageAuditResult,
} from './types.ts';

interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface CwvSnapshot {
  cls: number;
  clsElement: Element | null;
  lcpMs: number | null;
  lcpElement: Element | null;
  nodeCls?: WeakMap<Element, number>;
  observerInstalled?: boolean;
}

/** WCAG luminance contrast ratio and composited background luminance. */
export interface ContrastDetails {
  ratio: number;
  bgLuminance: number;
}

const DESTRUCTIVE_LABEL_RE =
  /\b(delete|remove|destroy|purge|reset|logout|log out|sign out|pay|purchase|checkout|charge|unsubscribe)\b/i;

const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'menuitem',
  'tab',
  'option',
  'switch',
  'checkbox',
  'radio',
  'combobox',
  'treeitem',
]);

/** Builds a compact, deterministic CSS selector for a DOM element. */
export function buildCompactSelector(el: Element): string {
  const doc = el.ownerDocument;
  if (!doc || el === doc.body) return 'body';
  if (el === doc.documentElement) return 'html';

  const testId = el.getAttribute('data-testid');
  if (testId) {
    const sel = `[data-testid="${escapeCss(testId)}"]`;
    if (isUnique(doc, sel)) return sel;
  }
  const id = el.getAttribute('id');
  if (id && !/^\d/.test(id) && !/\s/.test(id)) {
    const sel = `#${escapeCss(id)}`;
    if (isUnique(doc, sel)) return sel;
  }

  const segments: string[] = [];
  let cursor: Element | null = el;
  for (let depth = 0; cursor && cursor !== doc.body && depth < 5; depth++) {
    const tag = cursor.tagName.toLowerCase();
    const cid = cursor.getAttribute('id');
    if (cid && !/^\d/.test(cid) && !/\s/.test(cid)) {
      segments.unshift(`#${escapeCss(cid)}`);
      break;
    }
    const classes = Array.from(cursor.classList ?? [])
      .filter((c) => c.length < 36)
      .slice(0, 2);
    let part = classes.length > 0 ? `${tag}.${classes.map(escapeCss).join('.')}` : tag;
    let nth = 1;
    let prev = cursor.previousElementSibling;
    while (prev) {
      if (prev.tagName === cursor.tagName) nth++;
      prev = prev.previousElementSibling;
    }
    if (nth > 1 || cursor.nextElementSibling?.tagName === cursor.tagName) {
      part += `:nth-of-type(${nth})`;
    }
    segments.unshift(part);
    cursor = cursor.parentElement;
  }
  return segments.join(' > ') || el.tagName.toLowerCase();
}

/**
 * Checks whether `ruleId` is waived on `el` or an ancestor via
 * `data-mwg-ignore` or `data-gleam-ignore` (`""`, `"*"`, `"all"`, or rule IDs).
 */
export function isRuleIgnored(el: Element, ruleId: string): boolean {
  const normalized = ruleId.trim().toLowerCase();
  let cursor: Element | null = el;
  while (cursor) {
    for (const attr of ['data-mwg-ignore', 'data-gleam-ignore']) {
      if (!cursor.hasAttribute(attr)) continue;
      const raw = (cursor.getAttribute(attr) ?? '').trim().toLowerCase();
      if (!raw || raw === '*' || raw === 'all') return true;
      const tokens = raw.split(/[\s,]+/).filter(Boolean);
      if (tokens.includes('*') || tokens.includes('all') || tokens.includes(normalized)) {
        return true;
      }
    }
    cursor = cursor.parentElement;
  }
  return false;
}

/** Returns whether `el` is visually rendered (not hidden, display:none, or transparent). */
export function isVisuallyRendered(el: Element, win: Window = window): boolean {
  if (el.hasAttribute('hidden')) return false;
  const cs = safeStyle(el, win);
  if (!cs) return true;
  if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) {
    return false;
  }
  return true;
}

/**
 * Parses `#hex`, `rgb()`, `rgba()`, `color(srgb|display-p3|srgb-linear ...)`,
 * `oklab()`, and `oklch()` computed CSS colors into RGBA (`0..255`, `0..1`).
 */
export function parseCssColor(input: string): RgbaColor | null {
  const value = input.trim().toLowerCase();
  if (!value || value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  const hex = value.match(/^#([0-9a-f]{3,8})$/)?.[1];
  if (hex) {
    if (hex.length === 3 || hex.length === 4) {
      return {
        r: Number(`0x${hex[0]}${hex[0]}`),
        g: Number(`0x${hex[1]}${hex[1]}`),
        b: Number(`0x${hex[2]}${hex[2]}`),
        a: hex.length === 4 ? Number(`0x${hex[3]}${hex[3]}`) / 255 : 1,
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: Number(`0x${hex.slice(0, 2)}`),
        g: Number(`0x${hex.slice(2, 4)}`),
        b: Number(`0x${hex.slice(4, 6)}`),
        a: hex.length === 8 ? Number(`0x${hex.slice(6, 8)}`) / 255 : 1,
      };
    }
  }

  const fnMatch = value.match(/^([a-z0-9-]+)\((.+)\)$/);
  if (!fnMatch) return null;
  const [, fn, inner] = fnMatch;
  const [chansPart, slashAlpha] = inner.split('/').map((s) => s.trim());

  if (fn === 'rgb' || fn === 'rgba') {
    const parts = chansPart.split(/[\s,]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const r = parseChannel(parts[0], 255);
    const g = parseChannel(parts[1], 255);
    const b = parseChannel(parts[2], 255);
    if (r === null || g === null || b === null) return null;
    return { r: clampByte(r), g: clampByte(g), b: clampByte(b), a: parseAlpha(slashAlpha ?? parts[3]) };
  }

  if (fn === 'color') {
    const tokens = chansPart.split(/\s+/).filter(Boolean);
    const space = tokens[0] ?? '';
    if (tokens.length >= 4 && (space === 'srgb' || space === 'display-p3' || space === 'srgb-linear')) {
      const c1 = parseChannel(tokens[1], 1);
      const c2 = parseChannel(tokens[2], 1);
      const c3 = parseChannel(tokens[3], 1);
      if (c1 === null || c2 === null || c3 === null) return null;
      const toSrgb = (v: number) => (space === 'srgb-linear' ? linearToSrgb(v) : v);
      return {
        r: clampByte(toSrgb(c1) * 255),
        g: clampByte(toSrgb(c2) * 255),
        b: clampByte(toSrgb(c3) * 255),
        a: parseAlpha(slashAlpha),
      };
    }
    return null;
  }

  if (fn === 'oklch' || fn === 'oklab') {
    const tokens = chansPart.split(/\s+/).filter(Boolean);
    if (tokens.length < 3) return null;
    const L = parseChannel(tokens[0], 1);
    if (L === null) return null;
    let aLab: number | null;
    let bLab: number | null;
    if (fn === 'oklch') {
      const C = parseChannel(tokens[1], 0.4);
      const h = parseHueRad(tokens[2]);
      if (C === null || h === null) return null;
      aLab = C * Math.cos(h);
      bLab = C * Math.sin(h);
    } else {
      aLab = parseChannel(tokens[1], 0.4);
      bLab = parseChannel(tokens[2], 0.4);
      if (aLab === null || bLab === null) return null;
    }
    const l3 = (L + 0.3963377774 * aLab + 0.2158037573 * bLab) ** 3;
    const m3 = (L - 0.1055613458 * aLab - 0.0638541728 * bLab) ** 3;
    const s3 = (L - 0.0894841775 * aLab - 1.291485548 * bLab) ** 3;
    const rLin = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
    const gLin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
    const bLin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
    return {
      r: clampByte(linearToSrgb(rLin) * 255),
      g: clampByte(linearToSrgb(gLin) * 255),
      b: clampByte(linearToSrgb(bLin) * 255),
      a: parseAlpha(slashAlpha),
    };
  }
  return null;
}

/** Computes WCAG 2.1 contrast ratio and composited background luminance for `el`. */
export function computeContrastDetails(el: Element, win: Window = window): ContrastDetails | null {
  const cs = safeStyle(el, win);
  if (!cs) return null;
  const fg = parseCssColor(cs.color);
  if (!fg || fg.a === 0) return null;

  const layers: RgbaColor[] = [];
  let cursor: Element | null = el;
  while (cursor) {
    const bg = parseCssColor(safeStyle(cursor, win)?.backgroundColor ?? '');
    if (bg && bg.a > 0) {
      layers.push(bg);
      if (bg.a >= 0.999) break;
    }
    cursor = cursor.parentElement;
  }

  let backdrop: RgbaColor = { r: 255, g: 255, b: 255, a: 1 };
  for (let i = layers.length - 1; i >= 0; i--) {
    backdrop = compositeOver(layers[i], backdrop);
  }
  const effectiveFg = compositeOver(fg, backdrop);
  const l1 = luminance(effectiveFg);
  const l2 = luminance(backdrop);
  return {
    ratio: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05),
    bgLuminance: l2,
  };
}

/** Computes WCAG 2.1 contrast ratio (`1..21`) for `el` against composited ancestor backgrounds. */
export function computeContrastRatio(el: Element, win: Window = window): number | null {
  return computeContrastDetails(el, win)?.ratio ?? null;
}

/** Installs idempotent buffered LCP and CLS PerformanceObservers on `win`. */
export function ensureCwvObserver(win: Window = window): void {
  const host = win as unknown as Record<string, unknown>;
  let state = host['__mwgCwv'] as CwvSnapshot | undefined;
  if (!state || typeof state !== 'object') {
    state = {
      cls: 0,
      clsElement: null,
      lcpMs: null,
      lcpElement: null,
      nodeCls: new WeakMap<Element, number>(),
      observerInstalled: false,
    };
    host['__mwgCwv'] = state;
  }
  if (!state.nodeCls) {
    state.nodeCls = new WeakMap<Element, number>();
  }
  if (state.observerInstalled || typeof PerformanceObserver === 'undefined') {
    return;
  }
  state.observerInstalled = true;
  const cwvState = state;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<
        PerformanceEntry & { element?: Element | null; renderTime?: number }
      >) {
        if (entry.element) {
          cwvState.lcpElement = entry.element;
          cwvState.lcpMs = Math.round(entry.renderTime || entry.startTime);
        }
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // Browser context does not support buffered LCP entries.
  }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<
        PerformanceEntry & {
          value?: number;
          hadRecentInput?: boolean;
          sources?: Array<{ node?: Node | null }>;
        }
      >) {
        if (entry.hadRecentInput || !(entry.value && entry.value > 0)) continue;
        cwvState.cls += entry.value;
        for (const src of entry.sources ?? []) {
          const node = src.node;
          if (node && node.nodeType === 1) {
            const el = node as Element;
            cwvState.clsElement = el;
            const prev = cwvState.nodeCls?.get(el) ?? 0;
            cwvState.nodeCls?.set(el, prev + entry.value);
          }
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {
    // Browser context does not support buffered LayoutShift entries.
  }
}

/** Computes the accessible name of `el` following ARIA/HTML labeling precedence. */
export function computeAccessibleName(el: Element): string {
  const doc = el.ownerDocument;
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy && doc) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => doc.getElementById(id)?.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
    if (text) return text;
  }
  const ariaLabel = el.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ariaLabel;

  const tag = el.tagName.toLowerCase();
  if (tag === 'img') return el.getAttribute('alt')?.trim() ?? '';
  if (tag === 'input') {
    const type = (el.getAttribute('type') ?? 'text').toLowerCase();
    if (type === 'submit' || type === 'reset' || type === 'button') {
      return el.getAttribute('value')?.trim() || el.getAttribute('title')?.trim() || (type === 'button' ? '' : type);
    }
    if (type === 'image') return el.getAttribute('alt')?.trim() ?? '';
  }
  if ((tag === 'input' || tag === 'select' || tag === 'textarea') && doc) {
    const id = el.getAttribute('id');
    if (id) {
      const label = doc.querySelector(`label[for="${escapeCss(id)}"]`)?.textContent?.trim();
      if (label) return label;
    }
    const wrapping = el.closest('label')?.textContent?.trim();
    if (wrapping) return wrapping;
  }

  const svgTitle = el.querySelector('svg title')?.textContent?.trim();
  const imgAlt = el.querySelector('img[alt]')?.getAttribute('alt')?.trim();
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  return text || svgTitle || imgAlt || el.getAttribute('title')?.trim() || '';
}

type PushFinding = (
  el: Element,
  id: string,
  category: FindingCategory,
  severity: FindingSeverity,
  message: string,
  fix: string,
  guides: string[],
  culpritSelector?: string,
) => void;

interface InteractiveCollector {
  smokeElements: Element[];
  interactiveCandidates: InteractiveCandidate[];
  openModalCount: number;
}

function isExcludedNode(el: Element, excludeRoots: ReadonlySet<string>): boolean {
  let cursor: Element | null = el;
  while (cursor) {
    if (cursor.id && excludeRoots.has(cursor.id)) return true;
    if (
      cursor.getAttribute('data-builder-lens-exclude') === 'true' ||
      cursor.getAttribute('data-bibifrost-exclude') === 'true'
    ) {
      return true;
    }
    cursor = cursor.parentElement;
  }
  return false;
}

function isInteractiveElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  const role = (el.getAttribute('role') ?? '').trim().toLowerCase();
  const inputType = tag === 'input' ? (el.getAttribute('type') ?? 'text').toLowerCase() : '';
  return (
    tag === 'button' ||
    (tag === 'a' && el.hasAttribute('href')) ||
    (tag === 'input' && inputType !== 'hidden') ||
    tag === 'select' ||
    tag === 'textarea' ||
    INTERACTIVE_ROLES.has(role)
  );
}

function createFindingPusher(
  win: Window,
  findings: BrowserAuditFinding[],
  seen: Set<string>,
): PushFinding {
  return (el, id, category, severity, message, fix, guides, culpritSelector) => {
    if (isRuleIgnored(el, id)) return;
    const selector = buildCompactSelector(el);
    const src = resolveElementSource(el, win);
    const key = `${id}::${src.file ? `${src.file}:${src.line}` : selector}`;
    if (seen.has(key)) return;
    seen.add(key);
    const entry: BrowserAuditFinding = {
      id,
      category,
      severity,
      selector,
      file: src.file,
      line: src.line,
      column: src.column,
      framework: src.framework,
      message,
      fix,
      guides,
    };
    if (culpritSelector) {
      entry.culpritSelector = culpritSelector;
    }
    findings.push(entry);
  };
}

function auditSingleElement(
  el: Element,
  win: Window,
  cwv: CwvSnapshot,
  push: PushFinding,
  collector?: InteractiveCollector,
): void {
  if (!isVisuallyRendered(el, win)) return;
  const tag = el.tagName.toLowerCase();
  if (tag === 'script' || tag === 'style' || tag === 'noscript') return;
  const cs = safeStyle(el, win);
  const parent = el.parentElement;
  const parentCs = parent ? safeStyle(parent, win) : null;
  const role = (el.getAttribute('role') ?? '').trim().toLowerCase();
  const cls = `${typeof el.className === 'string' ? el.className : ''} ${el.id ?? ''}`.toLowerCase();
  const rect = safeRect(el);

  if (
    collector &&
    ((tag === 'dialog' && el.hasAttribute('open')) ||
      role === 'dialog' ||
      role === 'alertdialog' ||
      /\bmodal\b/.test(cls))
  ) {
    if (!el.hasAttribute('hidden')) collector.openModalCount++;
  }

  // --- Layout container diagnostics ---
  if (cs?.position === 'sticky') {
    if (cs.top === 'auto' && cs.bottom === 'auto' && cs.left === 'auto' && cs.right === 'auto') {
      push(
        el,
        'sticky-missing-inset',
        'LAYOUT',
        'warning',
        'position: sticky element has no inset threshold (top/bottom/left/right are auto).',
        'Add an explicit inset such as `top: 0` on the sticky element.',
        ['css-layout'],
      );
    }
    const blocker = findStickyBreakingAncestor(el, win);
    if (blocker) {
      const bcs = safeStyle(blocker, win);
      const blockerSel = buildCompactSelector(blocker);
      push(
        el,
        'sticky-overflow-ancestor',
        'LAYOUT',
        'error',
        `position: sticky on ${buildCompactSelector(el)} is defeated by ancestor ${blockerSel} overflow (${bcs?.overflowX}/${bcs?.overflowY}).`,
        'Replace `overflow: hidden` on the ancestor with `overflow: clip` (clips paint without creating a scroll container) or `overflow: visible`.',
        ['css-layout'],
        blockerSel,
      );
    }
  }

  const isFlexOrGridItem = Boolean(
    parentCs && (parentCs.display.includes('flex') || parentCs.display.includes('grid')),
  );
  if (cs && cs.position === 'static' && cs.zIndex && cs.zIndex !== 'auto' && !isFlexOrGridItem) {
    push(
      el,
      'inert-z-index',
      'LAYOUT',
      'warning',
      `z-index: ${cs.zIndex} has no effect on position: static.`,
      'Set `position: relative` (or `isolation: isolate`) if a stacking context is needed, or remove the dead `z-index`.',
      ['css-layout'],
    );
  }

  if (
    isFlexOrGridItem &&
    cs?.overflowX === 'visible' &&
    el.clientWidth > 0 &&
    el.scrollWidth > el.clientWidth + 4
  ) {
    push(
      el,
      'flex-grid-min-width-overflow',
      'LAYOUT',
      'error',
      `Flex/Grid item overflows container by ${Math.round(el.scrollWidth - el.clientWidth)}px (min-width: auto).`,
      'Add `min-width: 0` on the flex/grid child (or `flex-wrap: wrap` on the parent) so content can shrink or wrap cleanly.',
      ['css-layout'],
    );
  }

  // --- Live MWG platform modernization ---
  const isDropdownWrapperWithMenuTrigger =
    /\b(dropdown|popover|context-menu|action-menu|flyout)\b/.test(cls) &&
    role !== 'menu' &&
    el.getAttribute('aria-haspopup') !== 'menu' &&
    Boolean(el.querySelector('[aria-haspopup="menu"]'));
  if (
    !el.hasAttribute('popover') &&
    tag !== 'dialog' &&
    !isDropdownWrapperWithMenuTrigger &&
    (/\b(dropdown|popover|context-menu|action-menu|flyout)\b/.test(cls) ||
      role === 'menu' ||
      (el.getAttribute('aria-haspopup') === 'menu' &&
        !el.hasAttribute('commandfor') &&
        !el.hasAttribute('popovertarget')))
  ) {
    push(
      el,
      'mwg-native-popover-menu',
      'MODERNITY',
      'info',
      `Custom <${tag}> menu/dropdown instead of native [popover] + CSS Anchor Positioning.`,
      'Use `popover="auto"` triggered with `commandfor`/`command="toggle-popover"` (or `popovertarget`) and CSS Anchor Positioning (`position-area`, `position-try-fallbacks`).',
      ['menu', 'viewport-aware-dropdowns', 'declarative-dialog-popover-control'],
    );
  }

  if (
    tag !== 'dialog' &&
    (el.getAttribute('aria-modal') === 'true' ||
      role === 'dialog' ||
      role === 'alertdialog' ||
      /\b(modal-backdrop|modal-overlay|custom-modal)\b/.test(cls))
  ) {
    push(
      el,
      'mwg-native-dialog',
      'MODERNITY',
      'info',
      `Custom modal <${tag}> re-implements top-layer modal semantics manually.`,
      'Replace with native `<dialog>` opened via `showModal()` (or `command="show-modal"`) with `closedby="any"` and `::backdrop`.',
      ['dialog', 'light-dismiss-a-dialog'],
    );
  }

  if (tag !== 'details' && tag !== 'summary' && /\b(accordion-item|accordion-panel|collapsible-card)\b/.test(cls)) {
    push(
      el,
      'mwg-native-accordion',
      'MODERNITY',
      'info',
      `Custom accordion <${tag}> toggles disclosure in JS instead of native <details>.`,
      'Use semantic `<details>` + `<summary>` (with shared `name` for exclusive groups) animated via `::details-content` and `interpolate-size: allow-keywords`.',
      ['accordion', 'animate-to-intrinsic-sizes'],
    );
  }

  if (
    !(tag === 'input' && el.hasAttribute('switch')) &&
    (role === 'switch' || /\b(toggle-switch|custom-switch)\b/.test(cls))
  ) {
    push(
      el,
      'mwg-native-switch',
      'MODERNITY',
      'info',
      `Custom switch <${tag}> re-implements checkbox toggle behavior in script.`,
      'Use `<input type="checkbox" switch>` paired with a `<label>` for native semantics and progressive fallback.',
      ['switch'],
    );
  }

  if (tag === 'textarea' && cs && cs.getPropertyValue('field-sizing').trim() !== 'content') {
    push(
      el,
      'mwg-field-sizing',
      'MODERNITY',
      'info',
      'Textarea uses fixed sizing or JS auto-resize instead of CSS field-sizing: content.',
      'Add `field-sizing: content` with `min-block-size`/`max-block-size` bounds and remove JS scrollHeight resize listeners.',
      ['form-fields-automatically-fit-contents'],
    );
  }

  // --- Accessibility & target size ---
  const isHiddenFromAt = Boolean(el.closest('[aria-hidden="true"]'));
  const isInteractive = isInteractiveElement(el);

  if (el.getAttribute('aria-hidden') === 'true') {
    const focusable = el.querySelector('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (focusable) {
      push(
        focusable,
        'aria-hidden-focus',
        'A11Y',
        'error',
        'Focusable element is nested inside an aria-hidden="true" container.',
        'Remove `aria-hidden="true"` from the ancestor or add `inert` so hidden controls cannot receive keyboard focus.',
        ['accessibility'],
      );
    }
  }

  if (!isHiddenFromAt && isInteractive) {
    if (!computeAccessibleName(el)) {
      push(
        el,
        'a11y-missing-name',
        'A11Y',
        'error',
        `Interactive <${tag}> is missing an accessible name.`,
        'Provide visible text, an associated `<label>`, or a concise `aria-label` (with `aria-hidden="true"` on decorative SVGs).',
        ['accessibility'],
      );
    }
    if (rect && rect.width === 0 && rect.height === 0 && (tag === 'button' || tag === 'a')) {
      push(
        el,
        'zero-size-interactive',
        'LAYOUT',
        'error',
        `Visible interactive <${tag}> rendered at 0x0px.`,
        'Ensure the control has non-zero dimensions or remove it from the tab order when collapsed.',
        ['accessibility', 'css-layout'],
      );
    } else if (rect && rect.width > 0 && rect.height > 0 && (rect.width < 24 || rect.height < 24)) {
      push(
        el,
        'a11y-target-size',
        'A11Y',
        'warning',
        `Interactive hit target is ${Math.round(rect.width)}x${Math.round(rect.height)}px (< 24x24px WCAG 2.2 AA).`,
        'Expand clickable hit area to at least 24x24px (44x44px recommended on touch viewports).',
        ['accessibility'],
      );
    }

    // Collect up to 6 safe interactive triggers for CDP smoke probing.
    if (
      collector &&
      collector.interactiveCandidates.length < 6 &&
      (tag === 'button' || role === 'button' || el.hasAttribute('popovertarget') || el.hasAttribute('commandfor')) &&
      !el.hasAttribute('disabled')
    ) {
      const label = computeAccessibleName(el) || buildCompactSelector(el);
      if (!DESTRUCTIVE_LABEL_RE.test(label)) {
        const src = resolveElementSource(el, win);
        collector.smokeElements.push(el);
        collector.interactiveCandidates.push({
          smokeIdx: collector.smokeElements.length - 1,
          selector: buildCompactSelector(el),
          label: label.slice(0, 60),
          file: src.file,
          line: src.line,
          column: src.column,
          framework: src.framework,
        });
      }
    }
  }

  // WCAG 2.1 AA contrast check on elements with direct visible text or currentColor SVG icons.
  const hasText = hasDirectText(el);
  const hasIcon = !hasText && hasDirectIconChild(el);
  if (!isHiddenFromAt && (hasText || hasIcon) && cs) {
    const ratio = computeContrastRatio(el, win);
    if (ratio !== null) {
      const fontPx = Number(cs.fontSize.replace(/px$/i, '')) || 16;
      const weight = Number(cs.fontWeight) || 400;
      const isLargeText = fontPx >= 24 || (fontPx >= 18.66 && weight >= 700);
      const required = isLargeText || hasIcon ? 3.0 : 4.5;
      if (ratio < required) {
        push(
          el,
          'a11y-low-contrast',
          'A11Y',
          'error',
          `${hasIcon ? 'Icon' : 'Text'} contrast ratio is ${ratio.toFixed(1)}:1 (WCAG AA requires >= ${required}:1).`,
          'Adjust foreground/background color tokens to meet WCAG AA contrast across light and dark themes.',
          ['accessibility', 'contrast-color', 'color'],
        );
      }
    }
  }

  // --- CWV / LCP image priority check ---
  if (tag === 'img') {
    const fetchPriority = (el.getAttribute('fetchpriority') ?? '').toLowerCase();
    const loading = (el.getAttribute('loading') ?? '').toLowerCase();
    const isRecordedLcp = cwv.lcpElement === el;
    const isLikelyHero =
      !cwv.lcpElement &&
      rect !== null &&
      rect.top >= 0 &&
      rect.top < (win.innerHeight || 800) * 0.75 &&
      rect.width * rect.height >= 120_000;
    if ((isRecordedLcp || isLikelyHero) && (fetchPriority !== 'high' || loading === 'lazy')) {
      push(
        el,
        'perf-lcp-image',
        'PERF',
        loading === 'lazy' ? 'error' : 'warning',
        loading === 'lazy'
          ? 'LCP/hero image sets loading="lazy", delaying Largest Contentful Paint.'
          : 'LCP/hero image is missing fetchpriority="high".',
        'Remove `loading="lazy"` and set `fetchpriority="high"` on the hero/LCP `<img>`.',
        ['optimize-image-priority', 'optimize-preload-priority', 'performance'],
      );
    }
  }
}

/** Runs live layout, MWG pattern, a11y, and CWV checks scoped to `element` and its subtree. */
export function auditElement(
  element: Element,
  win: Window = window,
): BrowserAuditFinding[] {
  ensureCwvObserver(win);
  const findings: BrowserAuditFinding[] = [];
  const seen = new Set<string>();
  const push = createFindingPusher(win, findings, seen);
  const cwv = readCwvSnapshot(win);

  const candidates = [element, ...Array.from(element.querySelectorAll('*'))].slice(0, 40);
  for (const node of candidates) {
    auditSingleElement(node, win, cwv, push);
  }

  let subtreeCls = 0;
  if (cwv.nodeCls) {
    for (const node of candidates) {
      subtreeCls += cwv.nodeCls.get(node) ?? 0;
    }
  } else if (cwv.cls >= 0.05 && cwv.clsElement && (cwv.clsElement === element || element.contains(cwv.clsElement))) {
    subtreeCls = cwv.cls;
  }
  if (subtreeCls >= 0.05) {
    push(
      element,
      'perf-cls',
      'PERF',
      subtreeCls >= 0.1 ? 'error' : 'warning',
      `Cumulative Layout Shift reached ${subtreeCls.toFixed(3)} (good threshold is <= 0.100).`,
      'Reserve intrinsic space (`width`/`height`, `aspect-ratio`, `min-height`) and animate only compositor properties (`transform`, `opacity`).',
      ['performance'],
    );
  }

  return findings;
}

/** Runs all live DOM, layout, MWG pattern, a11y, and CWV checks on `win.document`. */
export function runPageAudit(
  win: Window = window,
  opts: PageAuditOptions = {},
): PageAuditResult {
  const doc = win.document;
  const findings: BrowserAuditFinding[] = [];
  const seen = new Set<string>();
  const push = createFindingPusher(win, findings, seen);
  const excludeRoots = new Set(opts.excludeRootIds ?? []);

  // 1. Document-level checks.
  const htmlEl = doc.documentElement;
  if (htmlEl && !htmlEl.getAttribute('lang')?.trim()) {
    push(
      htmlEl,
      'html-has-lang',
      'A11Y',
      'error',
      'Document <html> element is missing a lang attribute.',
      'Set `<html lang="en">` (or the page language) for screen readers and translation tools.',
      ['accessibility'],
    );
  }
  if (doc.head && !(doc.title ?? '').trim()) {
    push(
      doc.head,
      'document-title',
      'A11Y',
      'error',
      'Document is missing a non-empty <title> element.',
      'Add a descriptive `<title>` in `<head>`.',
      ['accessibility'],
    );
  }
  const viewportMeta = doc.querySelector('meta[name="viewport"]');
  if (viewportMeta) {
    const content = (viewportMeta.getAttribute('content') ?? '').toLowerCase();
    if (/user-scalable\s*=\s*(no|0)\b/.test(content) || /maximum-scale\s*=\s*1(\.0+)?\b/.test(content)) {
      push(
        viewportMeta,
        'meta-viewport',
        'A11Y',
        'error',
        'Viewport meta tag disables pinch-to-zoom.',
        'Remove `user-scalable=no` and `maximum-scale=1` from `<meta name="viewport">`.',
        ['accessibility', 'responsive-design'],
      );
    }
  }
  const targetWidth =
    typeof opts.viewportWidth === 'number' && opts.viewportWidth > 0
      ? opts.viewportWidth
      : typeof win.innerWidth === 'number' && win.innerWidth > 0
        ? win.innerWidth
        : 0;
  if (htmlEl && targetWidth > 0 && htmlEl.scrollWidth > targetWidth + 4) {
    push(
      htmlEl,
      'horizontal-overflow',
      'LAYOUT',
      'error',
      `Page overflows viewport horizontally (${htmlEl.scrollWidth}px > ${targetWidth}px).`,
      'Fix overflowing fixed widths, add `min-width: 0` on flex/grid children, or wrap responsive tables/media.',
      ['responsive-design', 'css-layout'],
    );
  }

  // 2. Single bounded DOM traversal for layout, MWG patterns, a11y, and CWV.
  const cwv = readCwvSnapshot(win);
  const allElements = Array.from(doc.querySelectorAll('body *')).slice(0, 600);
  const collector: InteractiveCollector = {
    smokeElements: [],
    interactiveCandidates: [],
    openModalCount: 0,
  };

  for (const el of allElements) {
    if (isExcludedNode(el, excludeRoots)) continue;
    auditSingleElement(el, win, cwv, push, collector);
  }

  if (cwv.cls >= 0.05) {
    const clsTarget = cwv.clsElement && cwv.clsElement.isConnected ? cwv.clsElement : doc.body ?? htmlEl;
    if (clsTarget) {
      push(
        clsTarget,
        'perf-cls',
        'PERF',
        cwv.cls >= 0.1 ? 'error' : 'warning',
        `Cumulative Layout Shift reached ${cwv.cls.toFixed(3)} (good threshold is <= 0.100).`,
        'Reserve intrinsic space (`width`/`height`, `aspect-ratio`, `min-height`) and animate only compositor properties (`transform`, `opacity`).',
        ['performance'],
      );
    }
  }

  // Expose lightweight hooks for CDP follow-up calls (DOMDebugger listeners & smoke clicks).
  const host = win as unknown as Record<string, unknown>;
  host['__mwgSmokeElements'] = collector.smokeElements;

  return {
    finalUrl: win.location?.href ?? '',
    findings,
    interactiveCandidates: collector.interactiveCandidates,
    openModalCount: collector.openModalCount,
    cls: Math.round(cwv.cls * 1000) / 1000,
    lcpMs: cwv.lcpMs,
  };
}

/** Returns visible non-semantic elements to inspect via `DOMDebugger.getEventListeners`. */
export function collectCdpClickCandidates(win: Window = window): Element[] {
  const out: Element[] = [];
  for (const el of Array.from(win.document.querySelectorAll('div, span, li, p'))) {
    if (out.length >= 100) break;
    if (!isVisuallyRendered(el, win) || el.closest('[aria-hidden="true"]')) continue;
    if (el.closest('button, a[href], summary, label')) continue;
    if (el.id === 'root' || el.id === 'app' || el.id === '__next' || el.id === '__nuxt') continue;
    const cls = typeof el.className === 'string' ? el.className : '';
    if (/(?:backdrop|overlay|modal)/i.test(cls)) continue;
    const role = (el.getAttribute('role') ?? '').trim().toLowerCase();
    const tabIdx = el.getAttribute('tabindex');
    if (INTERACTIVE_ROLES.has(role) && tabIdx !== null && Number(tabIdx) >= 0) continue;
    out.push(el);
  }
  return out;
}

/** Resolves selector + framework source location for a single element (used by CDP probes). */
export function describeElement(el: Element, win: Window = window) {
  const src = resolveElementSource(el, win);
  return {
    selector: buildCompactSelector(el),
    tag: el.tagName.toLowerCase(),
    role: (el.getAttribute('role') ?? '').trim().toLowerCase(),
    tabIndex: el.getAttribute('tabindex'),
    ignored: isRuleIgnored(el, 'a11y-non-semantic-click'),
    ...src,
  };
}

function readCwvSnapshot(win: Window): CwvSnapshot {
  const tracked = (win as unknown as Record<string, unknown>)['__mwgCwv'] as
    | Partial<CwvSnapshot>
    | undefined;
  if (tracked && typeof tracked === 'object') {
    return {
      cls: typeof tracked.cls === 'number' ? tracked.cls : 0,
      clsElement: tracked.clsElement ?? null,
      lcpMs: typeof tracked.lcpMs === 'number' ? Math.round(tracked.lcpMs) : null,
      lcpElement: tracked.lcpElement ?? null,
      nodeCls: tracked.nodeCls,
    };
  }
  return { cls: 0, clsElement: null, lcpMs: null, lcpElement: null };
}

function findStickyBreakingAncestor(stickyEl: Element, win: Window): Element | null {
  const doc = stickyEl.ownerDocument;
  let cursor = stickyEl.parentElement;
  while (cursor && cursor !== doc.body && cursor !== doc.documentElement) {
    const cs = safeStyle(cursor, win);
    if (cs) {
      const ox = cs.overflowX;
      const oy = cs.overflowY;
      const blocks =
        ox === 'hidden' ||
        oy === 'hidden' ||
        ((ox === 'auto' || ox === 'scroll' || oy === 'auto' || oy === 'scroll') &&
          cursor.scrollHeight <= cursor.clientHeight + 2);
      if (blocks) return cursor;
    }
    cursor = cursor.parentElement;
  }
  return null;
}

function hasDirectText(el: Element): boolean {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3 && (node.textContent ?? '').trim().length > 0) {
      return true;
    }
  }
  return false;
}

function hasDirectIconChild(el: Element): boolean {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 1 && (node as Element).tagName.toLowerCase() === 'svg') {
      const svg = node as Element;
      if (svg.getAttribute('aria-hidden') === 'true' && !isInteractiveElement(el)) {
        continue;
      }
      const fill = (svg.getAttribute('fill') ?? '').toLowerCase();
      const stroke = (svg.getAttribute('stroke') ?? '').toLowerCase();
      if (
        fill === 'currentcolor' ||
        stroke === 'currentcolor' ||
        (!fill && !stroke) ||
        (fill === 'none' && !stroke)
      ) {
        return true;
      }
    }
  }
  return false;
}

function safeStyle(el: Element, win: Window): CSSStyleDeclaration | null {
  try {
    return typeof win.getComputedStyle === 'function' ? win.getComputedStyle(el) : null;
  } catch {
    return null;
  }
}

function safeRect(el: Element): DOMRect | null {
  try {
    return typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
  } catch {
    return null;
  }
}

function escapeCss(val: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(val);
  }
  return val.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
}

function isUnique(doc: Document, sel: string): boolean {
  try {
    return doc.querySelectorAll(sel).length === 1;
  } catch {
    return false;
  }
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseChannel(token: string, pctScale: number): number | null {
  if (!token) return null;
  if (token === 'none') return 0;
  if (token.endsWith('%')) {
    const pct = Number(token.slice(0, -1));
    return Number.isFinite(pct) ? (pct / 100) * pctScale : null;
  }
  const num = Number(token);
  return Number.isFinite(num) ? num : null;
}

function parseHueRad(token: string): number | null {
  if (!token) return null;
  if (token === 'none') return 0;
  if (token.endsWith('turn')) return Number(token.slice(0, -4)) * 2 * Math.PI;
  if (token.endsWith('grad')) {
    return (Number(token.slice(0, -4)) * Math.PI) / 200;
  }
  if (token.endsWith('rad')) return Number(token.slice(0, -3));
  const deg = Number(token.endsWith('deg') ? token.slice(0, -3) : token);
  return Number.isFinite(deg) ? (deg * Math.PI) / 180 : null;
}

function parseAlpha(raw: string | undefined): number {
  if (!raw) return 1;
  if (raw === 'none') return 0;
  if (raw.endsWith('%')) {
    const pct = Number(raw.slice(0, -1));
    return Number.isFinite(pct) ? Math.max(0, Math.min(1, pct / 100)) : 1;
  }
  const num = Number(raw);
  return Number.isFinite(num) ? Math.max(0, Math.min(1, num)) : 1;
}

function linearToSrgb(c: number): number {
  const clamped = Math.max(0, Math.min(1, c));
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

function srgbToLinear(byteVal: number): number {
  const s = byteVal / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(c: RgbaColor): number {
  return 0.2126 * srgbToLinear(c.r) + 0.7152 * srgbToLinear(c.g) + 0.0722 * srgbToLinear(c.b);
}

function compositeOver(fg: RgbaColor, bg: RgbaColor): RgbaColor {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a <= 0) return { r: 255, g: 255, b: 255, a: 0 };
  return {
    r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
    g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
    b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
    a,
  };
}
