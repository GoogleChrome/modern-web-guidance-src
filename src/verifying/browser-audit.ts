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

import { runLiveAnalyzerRules } from './live-rule-adapter.ts';
import { resolveElementSource } from './source-locator.ts';
import type {
  BrowserAuditFinding,
  FindingCategory,
  FindingSeverity,
  InteractiveCandidate,
  PageAuditOptions,
  PageAuditResult,
} from './types.ts';

interface CwvSnapshot {
  cls: number;
  clsElement: Element | null;
  lcpMs: number | null;
  lcpElement: Element | null;
  nodeCls?: WeakMap<Element, number>;
  clsElements?: Set<Element>;
  observerInstalled?: boolean;
  lastResizeAt?: number | null;
  lastViewportWidth?: number;
  lastViewportHeight?: number;
}

const RESIZE_CLS_PRE_WINDOW_MS = 200;
const RESIZE_CLS_SUPPRESSION_MS = 500;

function getPerfNow(win: Window): number {
  return typeof win.performance?.now === 'function' ? win.performance.now() : Date.now();
}

function getViewportSize(win: Window): { width: number; height: number } {
  return {
    width: typeof win.innerWidth === 'number' ? win.innerWidth : 0,
    height: typeof win.innerHeight === 'number' ? win.innerHeight : 0,
  };
}

function recordViewportResize(cwvState: CwvSnapshot, win: Window, fromResizeEvent: boolean): void {
  const nextViewport = getViewportSize(win);
  const hadNonZeroViewport =
    (cwvState.lastViewportWidth ?? 0) > 0 && (cwvState.lastViewportHeight ?? 0) > 0;
  const changed =
    nextViewport.width !== cwvState.lastViewportWidth ||
    nextViewport.height !== cwvState.lastViewportHeight;
  cwvState.lastViewportWidth = nextViewport.width;
  cwvState.lastViewportHeight = nextViewport.height;
  if (hadNonZeroViewport && (changed || fromResizeEvent)) {
    cwvState.lastResizeAt = getPerfNow(win);
  }
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

const CANDIDATE_CLASS_OR_ID_RE =
  /\b(?:dropdown|popover|context-menu|action-menu|flyout|modal|modal-backdrop|modal-overlay|custom-modal|accordion-item|accordion-panel|collapsible-card|toggle-switch|custom-switch)\b|sticky/i;

const CANDIDATE_TAGS = new Set([
  'table',
  'img',
  'textarea',
  'dialog',
  'header',
  'nav',
  'aside',
  'thead',
  'th',
]);

function isShadowRootNode(node: Node | null | undefined): node is ShadowRoot {
  return Boolean(
    node &&
      node.nodeType === 11 &&
      'host' in node &&
      (node as ShadowRoot).host &&
      (node as ShadowRoot).host.nodeType === 1,
  );
}

function getParentElementCrossingShadow(el: Element): Element | null {
  if (el.parentElement) return el.parentElement;
  const parentNode = el.parentNode;
  if (isShadowRootNode(parentNode)) {
    return parentNode.host;
  }
  return null;
}

function isElementInSubtree(root: Element, node: Element): boolean {
  let cursor: Element | null = node;
  while (cursor) {
    if (cursor === root) return true;
    cursor = getParentElementCrossingShadow(cursor);
  }
  return false;
}

function buildScopedSelector(el: Element, root: Document | ShadowRoot): string {
  const doc = el.ownerDocument;
  if (root === doc) {
    if (!doc || el === doc.body) return 'body';
    if (el === doc.documentElement) return 'html';
  }

  const testId = el.getAttribute('data-testid');
  if (testId) {
    const sel = `[data-testid="${escapeCss(testId)}"]`;
    if (isUnique(root, sel)) return sel;
  }
  const id = el.getAttribute('id');
  if (id && !/^\d/.test(id) && !/\s/.test(id)) {
    const sel = `#${escapeCss(id)}`;
    if (isUnique(root, sel)) return sel;
  }

  const segments: string[] = [];
  let cursor: Element | null = el;
  for (let depth = 0; cursor && cursor !== doc?.body && depth < 5; depth++) {
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

/** Builds a compact, deterministic CSS selector for a DOM element (crossing open Shadow DOM with `>>>`). */
export function buildCompactSelector(el: Element): string {
  const doc = el.ownerDocument;
  if (!doc || el === doc.body) return 'body';
  if (el === doc.documentElement) return 'html';
  const rootNode = typeof el.getRootNode === 'function' ? el.getRootNode() : doc;
  if (isShadowRootNode(rootNode)) {
    return `${buildCompactSelector(rootNode.host)} >>> ${buildScopedSelector(el, rootNode)}`;
  }
  return buildScopedSelector(el, doc);
}

/**
 * Checks whether `ruleId` is waived on `el` or an ancestor via
 * `data-mwg-ignore` (`""`, `"*"`, `"all"`, or rule/guide IDs).
 */
export function isRuleIgnored(el: Element, ruleId: string): boolean {
  const normalized = ruleId.trim().toLowerCase();
  let cursor: Element | null = el;
  while (cursor) {
    if (cursor.hasAttribute('data-mwg-ignore')) {
      const raw = (cursor.getAttribute('data-mwg-ignore') ?? '').trim().toLowerCase();
      if (!raw || raw === '*' || raw === 'all') return true;
      const tokens = raw.split(/[\s,]+/).filter(Boolean);
      if (tokens.includes('*') || tokens.includes('all') || tokens.includes(normalized)) {
        return true;
      }
    }
    cursor = getParentElementCrossingShadow(cursor);
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

/** Installs idempotent buffered LCP and CLS PerformanceObservers on `win`. */
export function ensureCwvObserver(win: Window = window): void {
  const host = win as unknown as Record<string, unknown>;
  let state = host['__mwgCwv'] as CwvSnapshot | undefined;
  const viewport = getViewportSize(win);
  if (!state || typeof state !== 'object') {
    state = {
      cls: 0,
      clsElement: null,
      lcpMs: null,
      lcpElement: null,
      nodeCls: new WeakMap<Element, number>(),
      clsElements: new Set<Element>(),
      observerInstalled: false,
      lastResizeAt: null,
      lastViewportWidth: viewport.width,
      lastViewportHeight: viewport.height,
    };
    host['__mwgCwv'] = state;
  }
  if (!state.nodeCls) {
    state.nodeCls = new WeakMap<Element, number>();
  }
  if (!state.clsElements) {
    state.clsElements = new Set<Element>();
  }
  if (state.lastViewportWidth === undefined) {
    state.lastViewportWidth = viewport.width;
  }
  if (state.lastViewportHeight === undefined) {
    state.lastViewportHeight = viewport.height;
  }
  const observerCtor =
    (win as Window & Partial<typeof globalThis>).PerformanceObserver ??
    (typeof PerformanceObserver !== 'undefined' ? PerformanceObserver : undefined);
  if (state.observerInstalled || !observerCtor) {
    return;
  }
  state.observerInstalled = true;
  const cwvState = state;
  if (typeof win.addEventListener === 'function') {
    win.addEventListener(
      'resize',
      () => {
        recordViewportResize(cwvState, win, true);
      },
      { passive: true },
    );
  }
  try {
    new observerCtor((list) => {
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
    new observerCtor((list) => {
      recordViewportResize(cwvState, win, false);
      for (const entry of list.getEntries() as Array<
        PerformanceEntry & {
          value?: number;
          hadRecentInput?: boolean;
          sources?: Array<{ node?: Node | null }>;
        }
      >) {
        if (entry.hadRecentInput || !(entry.value && entry.value > 0)) continue;
        if (
          cwvState.lastResizeAt != null &&
          entry.startTime >= cwvState.lastResizeAt - RESIZE_CLS_PRE_WINDOW_MS &&
          entry.startTime <= cwvState.lastResizeAt + RESIZE_CLS_SUPPRESSION_MS
        ) {
          continue;
        }
        cwvState.cls += entry.value;
        for (const src of entry.sources ?? []) {
          const node = src.node;
          if (node && node.nodeType === 1) {
            const el = node as Element;
            cwvState.clsElement = el;
            const prev = cwvState.nodeCls?.get(el) ?? 0;
            cwvState.nodeCls?.set(el, prev + entry.value);
            if (cwvState.clsElements && cwvState.clsElements.size < 64) {
              cwvState.clsElements.add(el);
            }
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
    if (cursor.getAttribute('data-mwg-exclude') === 'true') {
      return true;
    }
    cursor = getParentElementCrossingShadow(cursor);
  }
  return false;
}

function categoryForAnalyzerGuide(guideId: string): FindingCategory {
  if (guideId === 'secure-external-subresources') return 'SECURITY';
  if (
    guideId === 'flicker-free-client-side-ab-testing' ||
    guideId === 'deliver-optimized-decorative-images'
  ) {
    return 'PERF';
  }
  return 'MODERNITY';
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
    const key = `${id}::${selector}`;
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

  // --- Runtime MWG layout & clipping checks ---
  if (cs?.position === 'sticky') {
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
        ['overflow-clipping-control', 'css-layout'],
        blockerSel,
      );
    }
  }

  if (
    tag === 'table' &&
    parent &&
    parent.clientWidth > 0 &&
    el.scrollWidth > parent.clientWidth + 4 &&
    parentCs?.overflowX !== 'auto' &&
    parentCs?.overflowX !== 'scroll'
  ) {
    push(
      el,
      'responsive-table',
      'LAYOUT',
      'error',
      `Data table overflows its container by ${Math.round(el.scrollWidth - parent.clientWidth)}px without a scrollable or container-query responsive wrapper.`,
      'Wrap the `<table>` in a keyboard-scrollable container (`<div tabindex="0" role="region" aria-labelledby="...">` with `overflow-x: auto`) or adapt columns with `@container` queries.',
      ['responsive-table'],
    );
  }

  // --- Runtime MWG platform modernization checks ---
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

  // Collect up to 6 safe interactive triggers for CDP smoke probing.
  if (
    collector &&
    collector.interactiveCandidates.length < 6 &&
    !el.closest('[aria-hidden="true"]') &&
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

  // --- Runtime MWG image priority check ---
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
        ['optimize-image-priority', 'optimize-preload-priority'],
      );
    }
  }
}

function collectStickySelectorsFromRuleList(ruleList: CSSRuleList, out: string[]): void {
  for (let i = 0; i < ruleList.length; i++) {
    const rule = ruleList[i];
    if (!rule) continue;
    if ('selectorText' in rule && 'style' in rule) {
      const styleRule = rule as CSSStyleRule;
      const pos = (styleRule.style.position || styleRule.style.getPropertyValue('position') || '')
        .trim()
        .toLowerCase();
      if (pos === 'sticky' && styleRule.selectorText) {
        out.push(styleRule.selectorText);
      }
      continue;
    }
    if ('cssRules' in rule) {
      collectStickySelectorsFromRuleList((rule as CSSGroupingRule).cssRules, out);
    }
  }
}

function collectStickyElementsFromRoot(
  root: Document | ShadowRoot,
  out: Set<Element>,
): void {
  const selectors: string[] = [];
  const styleSheets = Array.from(
    (root as Document & { styleSheets?: StyleSheetList }).styleSheets ?? [],
  );
  const adopted = Array.from(
    (root as Document & { adoptedStyleSheets?: readonly CSSStyleSheet[] }).adoptedStyleSheets ?? [],
  );
  let readAnyCssomRule = false;
  for (const sheet of [...styleSheets, ...adopted]) {
    try {
      const rules = sheet.cssRules;
      if (!rules || rules.length === 0) continue;
      readAnyCssomRule = true;
      collectStickySelectorsFromRuleList(rules, selectors);
    } catch {
      // Cross-origin stylesheet; skip cleanly.
    }
  }
  // Fallback for DOM environments without CSSOM parsing (e.g. linkedom unit tests).
  if (!readAnyCssomRule) {
    for (const styleEl of Array.from(root.querySelectorAll('style'))) {
      const raw = (styleEl.textContent ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
      if (!/position\s*:\s*sticky/i.test(raw)) continue;
      const re = /([^{}@;]+)\{([^{}]*)\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(raw)) !== null) {
        if (/position\s*:\s*sticky\b/i.test(m[2])) {
          selectors.push(m[1].trim());
        }
      }
    }
  }
  for (const rawSel of selectors) {
    for (const part of rawSel.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      try {
        for (const matched of Array.from(root.querySelectorAll(trimmed))) {
          out.add(matched);
        }
      } catch {
        // Ignore unqueryable selector (e.g. vendor pseudo-element).
      }
    }
  }
}

function isRuntimeAuditCandidate(
  el: Element,
  stickySet: ReadonlySet<Element>,
  includeInteractive: boolean,
): boolean {
  if (stickySet.has(el)) return true;
  const tag = el.tagName.toLowerCase();
  if (CANDIDATE_TAGS.has(tag)) return true;
  if (includeInteractive && tag === 'button') return true;
  if (
    el.hasAttribute('role') ||
    el.hasAttribute('aria-modal') ||
    el.hasAttribute('aria-haspopup') ||
    el.hasAttribute('popovertarget') ||
    el.hasAttribute('commandfor')
  ) {
    return true;
  }
  const inlineStyle = el.getAttribute('style');
  if (inlineStyle && inlineStyle.toLowerCase().includes('sticky')) return true;
  const cls = `${typeof el.className === 'string' ? el.className : ''} ${el.id ?? ''}`;
  return cls.trim().length > 0 && CANDIDATE_CLASS_OR_ID_RE.test(cls);
}

function collectAuditCandidates(
  root: Element,
  options: {
    isExcluded?: (el: Element) => boolean;
    includeSelf?: boolean;
    includeInteractive?: boolean;
  },
): Element[] {
  const { isExcluded, includeSelf = false, includeInteractive = false } = options;
  const stickySet = new Set<Element>();
  const doc = root.ownerDocument;
  if (doc) {
    collectStickyElementsFromRoot(doc, stickySet);
  }
  const containingRoot = typeof root.getRootNode === 'function' ? root.getRootNode() : null;
  if (isShadowRootNode(containingRoot)) {
    collectStickyElementsFromRoot(containingRoot, stickySet);
  }

  const candidates: Element[] = [];
  const stack: Element[] = [];
  if (includeSelf) {
    stack.push(root);
  } else {
    const ownShadow = (root as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    if (ownShadow) {
      collectStickyElementsFromRoot(ownShadow, stickySet);
      const shadowChildren = Array.from(ownShadow.children ?? []);
      for (let i = shadowChildren.length - 1; i >= 0; i--) {
        stack.push(shadowChildren[i]);
      }
    }
    const children = Array.from(root.children ?? []);
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push(children[i]);
    }
  }

  while (stack.length > 0) {
    const el = stack.pop()!;
    if (el !== root && isExcluded?.(el)) continue;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'template') {
      continue;
    }
    if ((el === root && includeSelf) || isRuntimeAuditCandidate(el, stickySet, includeInteractive)) {
      candidates.push(el);
    }
    const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    if (shadow) {
      collectStickyElementsFromRoot(shadow, stickySet);
      const shadowChildren = Array.from(shadow.children ?? []);
      for (let i = shadowChildren.length - 1; i >= 0; i--) {
        stack.push(shadowChildren[i]);
      }
    }
    if (tag === 'svg') continue;
    const children = Array.from(el.children ?? []);
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push(children[i]);
    }
  }

  return candidates;
}

/** Runs calibrated MWG DOM/CSS analyzer rules plus live layout and CWV checks scoped to `element`. */
export function auditElement(
  element: Element,
  win: Window = window,
): BrowserAuditFinding[] {
  ensureCwvObserver(win);
  const findings: BrowserAuditFinding[] = [];
  const seen = new Set<string>();
  const push = createFindingPusher(win, findings, seen);
  const cwv = readCwvSnapshot(win);

  const doc = element.ownerDocument;
  if (doc) {
    for (const match of runLiveAnalyzerRules(doc, { scopeElement: element })) {
      if (isRuleIgnored(match.element, match.rule.guideId)) continue;
      push(
        match.element,
        match.rule.id,
        categoryForAnalyzerGuide(match.rule.guideId),
        'warning',
        match.message,
        match.rule.summary,
        [match.rule.guideId],
      );
    }
  }

  const candidates = collectAuditCandidates(element, { includeSelf: true });
  for (const node of candidates) {
    auditSingleElement(node, win, cwv, push);
  }

  let subtreeCls = 0;
  if (cwv.nodeCls && cwv.clsElements && cwv.clsElements.size > 0) {
    for (const shifted of cwv.clsElements) {
      if (isElementInSubtree(element, shifted)) {
        subtreeCls += cwv.nodeCls.get(shifted) ?? 0;
      }
    }
  } else if (cwv.nodeCls) {
    for (const node of candidates) {
      subtreeCls += cwv.nodeCls.get(node) ?? 0;
    }
  } else if (cwv.cls >= 0.05 && cwv.clsElement && isElementInSubtree(element, cwv.clsElement)) {
    subtreeCls = cwv.cls;
  }
  if (subtreeCls >= 0.05) {
    push(
      element,
      'perf-cls',
      'PERF',
      subtreeCls >= 0.1 ? 'error' : 'warning',
      `Cumulative Layout Shift reached ${subtreeCls.toFixed(3)} (good threshold is <= 0.100).`,
      'Reserve intrinsic space (`width`/`height`, `aspect-ratio`, `min-height`) and use metric-matched font fallbacks.',
      ['visually-stable-font-fallbacks', 'performance'],
    );
  }

  return findings;
}

/** Runs all calibrated MWG DOM/CSS analyzer rules plus live layout and CWV checks on `win.document`. */
export function runPageAudit(
  win: Window = window,
  opts: PageAuditOptions = {},
): PageAuditResult {
  const doc = win.document;
  const findings: BrowserAuditFinding[] = [];
  const seen = new Set<string>();
  const push = createFindingPusher(win, findings, seen);
  const excludeRoots = new Set(opts.excludeRootIds ?? []);
  const isExcluded = (el: Element) => isExcludedNode(el, excludeRoots);

  // 1. Document-level MWG checks.
  const htmlEl = doc.documentElement;
  const viewportMeta = doc.querySelector('meta[name="viewport"]');
  if (viewportMeta) {
    const content = (viewportMeta.getAttribute('content') ?? '').toLowerCase();
    if (/user-scalable\s*=\s*(no|0)\b/.test(content) || /maximum-scale\s*=\s*1(\.0+)?\b/.test(content)) {
      push(
        viewportMeta,
        'respect-os-text-scale',
        'A11Y',
        'error',
        'Viewport meta tag disables user pinch-to-zoom and blocks accessible text scaling.',
        'Remove `user-scalable=no` and `maximum-scale=1` from `<meta name="viewport">` and opt into `<meta name="text-scale" content="scale">` with relative `rem`/`em` typography.',
        ['respect-os-text-scale', 'responsive-design'],
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

  // 2. Calibrated MWG DOM + CSS analyzer rules from src/analyzing/rules/.
  for (const match of runLiveAnalyzerRules(doc, { isExcluded })) {
    if (isRuleIgnored(match.element, match.rule.guideId)) continue;
    push(
      match.element,
      match.rule.id,
      categoryForAnalyzerGuide(match.rule.guideId),
      'warning',
      match.message,
      match.rule.summary,
      [match.rule.guideId],
    );
  }

  // 3. Targeted, shadow-DOM-aware traversal for runtime-only MWG layout, component, and CWV checks.
  const cwv = readCwvSnapshot(win);
  const candidates = doc.body
    ? collectAuditCandidates(doc.body, { isExcluded, includeInteractive: true })
    : [];
  const collector: InteractiveCollector = {
    smokeElements: [],
    interactiveCandidates: [],
    openModalCount: 0,
  };

  for (const el of candidates) {
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
        'Reserve intrinsic space (`width`/`height`, `aspect-ratio`, `min-height`) and use metric-matched font fallbacks.',
        ['visually-stable-font-fallbacks', 'performance'],
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
      clsElements: tracked.clsElements,
    };
  }
  return { cls: 0, clsElement: null, lcpMs: null, lcpElement: null };
}

function findStickyBreakingAncestor(stickyEl: Element, win: Window): Element | null {
  const doc = stickyEl.ownerDocument;
  let cursor = getParentElementCrossingShadow(stickyEl);
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
    cursor = getParentElementCrossingShadow(cursor);
  }
  return null;
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

function isUnique(root: Document | ShadowRoot, sel: string): boolean {
  try {
    return root.querySelectorAll(sel).length === 1;
  } catch {
    return false;
  }
}
