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
import { createRequire } from 'node:module';
import path from 'node:path';
import type { HeadlessBrowser, PageSession } from './cdp.ts';
import { listWorkspaceFiles, TEST_FILE_RE } from './discovery.ts';
import { buildInPagePackAuditExpression, type PackBrowserResult } from './packs.ts';
import type {
  ActivePackName,
  FindingCategory,
  NodeHint,
  PerfRouteMetrics,
  PerfSummary,
  VerificationFinding,
} from './types.ts';

const cachedAxeSourceByPath = new Map<string, string>();

const VITE_HMR_NOISE_RE =
  /\[vite\]\s*(?:failed to connect to websocket|connecting|connected|server connection lost)|websocket closed without opened|ws:\/\/(?:localhost|127\.0\.0\.1):24678\b|\/@vite\/client|\[webpack\]\s*hot/i;

const HYDRATION_MESSAGE_RE =
  /hydration failed|hydrated but some attributes|text content does not match server-rendered html|hydration mismatch|hydration completed but contains mismatches|did not match\.\s*server:|server rendered html didn't match|minified react error #(?:418|423|425)\b/i;

const A11Y_RULE_TO_GUIDES: Record<string, { guides: string[]; fix: string }> = {
  'modal-missing-dialog-role': {
    guides: ['dialog', 'light-dismiss-a-dialog'],
    fix: 'Use native `<dialog closedby="any">` (opened via `command="show-modal"` or `.showModal()`) for built-in dialog role, inert background, focus trap, and Escape dismissal.',
  },
  'interactive-non-semantic-element': {
    guides: ['html', 'accessibility'],
    fix: 'Replace clickable `<div>`/`<span>` with a native `<button type="button">` so keyboard Enter/Space activation and focus ring work automatically.',
  },
  'aria-hidden-focus': {
    guides: ['accessibility', 'html'],
    fix: 'Do not place `aria-hidden="true"` on containers holding focusable elements; use `inert` or `[hidden]` when hiding interactive subtrees.',
  },
  'nested-interactive': {
    guides: ['html', 'accessibility'],
    fix: 'Do not nest interactive controls (e.g. `<a href>` inside `<button>`); separate sibling actions cleanly.',
  },
  'html-has-lang': {
    guides: ['html', 'accessibility'],
    fix: 'Add a valid BCP-47 `lang` attribute to the root `<html lang="en">` element.',
  },
  'document-title': {
    guides: ['html', 'accessibility'],
    fix: 'Provide a descriptive non-empty `<title>` element inside `<head>`.',
  },
  'input-button-name': {
    guides: ['forms', 'accessibility'],
    fix: 'Provide a non-empty `value` or `aria-label` on `<input type="button|submit|reset">` (or prefer `<button type="button">`).',
  },
  'button-name': {
    guides: ['accessibility', 'icons'],
    fix: 'Give every `<button>` discernible text or `aria-label` (and `aria-hidden="true"` on decorative SVG icons).',
  },
  label: {
    guides: ['forms', 'accessibility'],
    fix: 'Associate every `<input>`, `<select>`, and `<textarea>` with an explicit `<label for="...">` or `aria-label`.',
  },
  'image-alt': {
    guides: ['accessibility', 'html'],
    fix: 'Provide a descriptive `alt` attribute on `<img>` (or `alt=""` for purely decorative images).',
  },
  'link-name': {
    guides: ['accessibility', 'html'],
    fix: 'Provide discernible link text or `aria-label` on `<a href="...">` elements.',
  },
  'aria-dialog-name': {
    guides: ['dialog', 'accessibility'],
    fix: 'Label `<dialog>` / `[role="dialog"]` via `aria-labelledby` pointing to its visible heading.',
  },
  'meta-viewport': {
    guides: ['accessibility', 'responsive-design'],
    fix: 'Remove `user-scalable=no` and `maximum-scale=1` from `<meta name="viewport">` so users can pinch-zoom to 200%.',
  },
  'zero-size-interactive': {
    guides: ['accessibility', 'css-layout'],
    fix: 'Interactive control renders with 0px width or height; ensure visible sizing (`min-width`/`min-height` >= 24px) or mark hidden controls with `hidden`.',
  },
  'fixed-element-occlusion': {
    guides: ['css-layout', 'persistent-top-layer-ui'],
    fix: 'A `position: fixed`/`sticky` overlay intercepts clicks over this interactive control; use top-layer `<dialog>`/`[popover]`, `pointer-events: none` on pass-through wrappers, or `scroll-padding-top`.',
  },
};

function guidanceForA11yRule(
  ruleId: string,
  fallbackHelp?: string,
): { guides: string[]; fix: string } {
  if (A11Y_RULE_TO_GUIDES[ruleId]) return A11Y_RULE_TO_GUIDES[ruleId];
  if (ruleId.includes('dialog')) {
    return A11Y_RULE_TO_GUIDES['aria-dialog-name'];
  }
  if (
    ruleId.includes('form') ||
    ruleId.includes('select') ||
    ruleId.includes('input') ||
    ruleId.includes('autocomplete')
  ) {
    return {
      guides: ['forms', 'accessibility'],
      fix: `${fallbackHelp || `Fix WCAG rule \`${ruleId}\``} using native semantic form associations.`,
    };
  }
  return {
    guides: ['accessibility'],
    fix: fallbackHelp || `Resolve WCAG 2.2 AA accessibility violation \`${ruleId}\`.`,
  };
}

export function resolveAxeScriptSource(workspaceDir?: string): string | null {
  const explicit = process.env.MODERN_WEB_AXE_PATH;
  if (explicit && existsSync(explicit)) {
    let cached = cachedAxeSourceByPath.get(explicit);
    if (!cached) {
      cached = readFileSync(explicit, 'utf8');
      cachedAxeSourceByPath.set(explicit, cached);
    }
    return cached;
  }

  const anchors: Array<string | URL> = [
    ...(workspaceDir ? [path.join(workspaceDir, 'package.json')] : []),
    path.join(process.cwd(), 'package.json'),
    ...(process.env.MODERN_WEB_ESLINT_DIR
      ? [path.join(process.env.MODERN_WEB_ESLINT_DIR, 'package.json')]
      : []),
    import.meta.url,
  ];

  for (const anchor of anchors) {
    if (typeof anchor === 'string' && !existsSync(anchor)) continue;
    try {
      const req = createRequire(anchor);
      const axeMin = req.resolve('axe-core/axe.min.js');
      if (existsSync(axeMin)) {
        let cached = cachedAxeSourceByPath.get(axeMin);
        if (!cached) {
          cached = readFileSync(axeMin, 'utf8');
          cachedAxeSourceByPath.set(axeMin, cached);
        }
        return cached;
      }
    } catch {
      // Check next resolution anchor
    }
  }
  return null;
}

interface CdpRemoteObject {
  type?: string;
  value?: unknown;
  description?: string;
  objectId?: string;
  preview?: {
    properties?: Array<{ name: string; value?: unknown }>;
  };
}

interface CdpExceptionDetails {
  text?: string;
  url?: string;
  exception?: CdpRemoteObject;
}

function formatCdpRemoteObject(arg: CdpRemoteObject | undefined): string {
  if (!arg) return '';
  if (typeof arg.value === 'string') return arg.value;
  if (arg.value !== undefined) return JSON.stringify(arg.value);
  if (Array.isArray(arg.preview?.properties) && arg.description === 'Object') {
    const pairs = arg.preview.properties
      .slice(0, 5)
      .map((p) => `${p.name}: ${JSON.stringify(p.value)}`);
    return `{ ${pairs.join(', ')} }`;
  }
  if (typeof arg.description === 'string') return arg.description;
  return String(arg.type || '');
}

function formatExceptionDetails(details: CdpExceptionDetails): string {
  const exc = details.exception;
  const prefix = details.text ? details.text.replace(/:\s*$/, '') : 'Uncaught exception';
  if (exc) {
    if (typeof exc.description === 'string' && exc.description !== 'Object') {
      return exc.description;
    }
    if (exc.value !== undefined) {
      const valStr = typeof exc.value === 'string' ? exc.value : JSON.stringify(exc.value);
      return prefix.toLowerCase().includes('uncaught') ? `${prefix}: ${valStr}` : valStr;
    }
    if (Array.isArray(exc.preview?.properties)) {
      const objStr = formatCdpRemoteObject(exc);
      return `${prefix}: ${objStr}`;
    }
  }
  return details.text || 'Uncaught runtime exception';
}

export function summarizeHydrationMessage(rawMessage: string): string {
  const clean = rawMessage.replace(/\s+/g, ' ').trim();

  const compMatch =
    rawMessage.match(/in\s+<([A-Z][A-Za-z0-9_.]*)>/) ||
    rawMessage.match(/<([A-Z][A-Za-z0-9_.]*)\b/) ||
    rawMessage.match(/\bat\s+([A-Z][A-Za-z0-9_]*)\s*\(/);
  const compPart = compMatch ? ` in <${compMatch[1]}>` : '';

  const serverClientExplicit =
    rawMessage.match(
      /server\s*:\s*["']?([^"'\n,)]+)["']?[\s,;]+client\s*:\s*["']?([^"'\n,)]+)["']?/i,
    ) ||
    rawMessage.match(
      /rendered on server:\s*["']?([^"'\n]+)["']?[\s\S]*?expected on client:\s*["']?([^"'\n]+)["']?/i,
    );
  if (serverClientExplicit) {
    return `Hydration mismatch${compPart} (server: "${serverClientExplicit[1].trim()}", client: "${serverClientExplicit[2].trim()}")`;
  }

  const plusMatch = rawMessage.match(/^\s*\+\s*(.+)$/m);
  const minusMatch = rawMessage.match(/^\s*-\s*(.+)$/m);
  if (plusMatch && minusMatch) {
    const clientVal = plusMatch[1].trim().replace(/^["']|["']$/g, '').slice(0, 60);
    const serverVal = minusMatch[1].trim().replace(/^["']|["']$/g, '').slice(0, 60);
    return `Hydration mismatch${compPart} (server: "${serverVal}", client: "${clientVal}")`;
  }

  const firstSentence = clean.split(/(?<=\.)\s+/)[0] || clean;
  return compPart && !firstSentence.includes(compPart.trim())
    ? `Hydration mismatch${compPart}: ${firstSentence.slice(0, 140)}`
    : firstSentence.slice(0, 160);
}

function lineOfIndex(text: string, idx: number): number {
  let line = 1;
  for (let i = 0; i < idx && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

interface SourceFileCacheRecord {
  rel: string;
  text: string;
  ownerStem: string;
}

function buildSourceFileCache(
  workspaceDir: string,
  touchedFiles: readonly string[],
): SourceFileCacheRecord[] {
  const orderedPaths: string[] = [];
  const seen = new Set<string>();

  const addFile = (rel: string): void => {
    if (!rel || seen.has(rel) || TEST_FILE_RE.test(rel)) return;
    const base = path.posix.basename(rel).toLowerCase();
    if (
      /^(?:server|vite\.config|next\.config|astro\.config|svelte\.config|nuxt\.config|playwright\.config)\./.test(
        base,
      )
    ) {
      return;
    }
    seen.add(rel);
    orderedPaths.push(rel);
  };

  for (const rel of touchedFiles) addFile(rel);
  for (const rel of listWorkspaceFiles(workspaceDir)) addFile(rel);

  const records: SourceFileCacheRecord[] = [];
  for (const rel of orderedPaths) {
    const abs = path.join(workspaceDir, rel);
    if (!existsSync(abs)) continue;
    try {
      const text = readFileSync(abs, 'utf8');
      const ext = path.posix.extname(rel);
      const rawStem = path.posix.basename(rel, ext);
      const ownerStem =
        rawStem === 'index' ? path.posix.basename(path.posix.dirname(rel)) : rawStem;
      records.push({ rel, text, ownerStem });
    } catch {
      // Ignore unreadable files
    }
  }
  return records;
}

function locateInWorkspaceFiles(
  nodeHint: NodeHint,
  workspaceDir: string,
  sourceRecords: readonly SourceFileCacheRecord[],
): { file: string; line: number } | null {
  if (nodeHint.debugFile) {
    const rel = path.isAbsolute(nodeHint.debugFile)
      ? path.relative(workspaceDir, nodeHint.debugFile).split(path.sep).join('/')
      : nodeHint.debugFile;
    if (!rel.startsWith('..') && !rel.includes('node_modules')) {
      return { file: rel, line: nodeHint.debugLine || 1 };
    }
  }

  const uniqueAttrNeedles: string[] = [];
  if (nodeHint.testId) {
    uniqueAttrNeedles.push(`data-testid="${nodeHint.testId}"`, `data-testid='${nodeHint.testId}'`);
  }
  if (nodeHint.id) {
    uniqueAttrNeedles.push(`id="${nodeHint.id}"`, `id='${nodeHint.id}'`);
  }

  const classNeedles: string[] = [];
  if (nodeHint.className && typeof nodeHint.className === 'string') {
    const tokens = nodeHint.className.trim().split(/\s+/).filter(Boolean);
    if (tokens.length > 0) {
      const fullCls = tokens.join(' ');
      classNeedles.push(
        `className="${fullCls}"`,
        `class="${fullCls}"`,
        `className='${fullCls}'`,
        `class='${fullCls}'`,
      );
      if (tokens[0].length >= 4) {
        classNeedles.push(`className="${tokens[0]}`, `class="${tokens[0]}`);
      }
    }
  }

  const tagTextRegexes: RegExp[] = [];
  if (nodeHint.tag && nodeHint.text && nodeHint.text.length >= 3 && nodeHint.text.length <= 48) {
    const escapedTag = nodeHint.tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedText = nodeHint.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      tagTextRegexes.push(
        new RegExp(`<${escapedTag}\\b[^>]*>\\s*${escapedText}\\s*</${escapedTag}>`, 'i'),
      );
    } catch {
      // Ignore malformed pattern
    }
  }

  if (nodeHint.ownerComponent) {
    for (const rec of sourceRecords) {
      if (rec.ownerStem === nodeHint.ownerComponent) {
        for (const needle of [...uniqueAttrNeedles, ...classNeedles]) {
          const idx = rec.text.indexOf(needle);
          if (idx !== -1) return { file: rec.rel, line: lineOfIndex(rec.text, idx) };
        }
        for (const re of tagTextRegexes) {
          const m = re.exec(rec.text);
          if (m) return { file: rec.rel, line: lineOfIndex(rec.text, m.index) };
        }
        return { file: rec.rel, line: 1 };
      }
    }
  }

  for (const tier of [uniqueAttrNeedles, classNeedles]) {
    if (tier.length === 0) continue;
    for (const rec of sourceRecords) {
      for (const needle of tier) {
        const idx = rec.text.indexOf(needle);
        if (idx !== -1) {
          return { file: rec.rel, line: lineOfIndex(rec.text, idx) };
        }
      }
    }
  }

  if (tagTextRegexes.length > 0) {
    for (const rec of sourceRecords) {
      for (const re of tagTextRegexes) {
        const m = re.exec(rec.text);
        if (m) {
          return { file: rec.rel, line: lineOfIndex(rec.text, m.index) };
        }
      }
    }
  }

  return null;
}

/**
 * Self-contained DOM + Layout + Interaction metadata script evaluated inside the page via CDP.
 */
const IN_PAGE_AUDIT_EXPRESSION = `(async () => {
  const isVisuallyRendered = (el) => {
    if (!(el instanceof Element)) return false;
    if (el.closest('[hidden], [inert], dialog:not([open]), [popover]:not(:popover-open), template')) {
      return false;
    }
    const closedDetails = el.closest('details:not([open])');
    if (closedDetails) {
      const summary = closedDetails.querySelector(':scope > summary');
      if (!summary || !summary.contains(el)) return false;
    }
    if (typeof el.checkVisibility === 'function') {
      try {
        if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })) {
          return false;
        }
      } catch {}
    }
    let cur = el;
    while (cur && cur.nodeType === 1) {
      const style = window.getComputedStyle(cur);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse' ||
        Number(style.opacity) === 0
      ) {
        return false;
      }
      cur = cur.parentElement;
    }
    return true;
  };

  const isExposedToA11y = (el) => isVisuallyRendered(el) && !el.closest('[aria-hidden="true"]');

  const getFiberMeta = (el) => {
    let debugFile = null;
    let debugLine = null;
    let ownerComponent = null;
    let hasFrameworkClick = false;

    for (const key of Object.keys(el)) {
      if (key.startsWith('__reactProps$') || key.startsWith('__reactEventHandlers$')) {
        const props = el[key];
        if (props && typeof props.onClick === 'function') hasFrameworkClick = true;
      }
      if (key.startsWith('__reactFiber$')) {
        let fiber = el[key];
        if (fiber?.memoizedProps && typeof fiber.memoizedProps.onClick === 'function') {
          hasFrameworkClick = true;
        }
        let depth = 0;
        while (fiber && depth < 8) {
          if (!debugFile && fiber._debugSource) {
            debugFile = fiber._debugSource.fileName || null;
            debugLine = fiber._debugSource.lineNumber || null;
          }
          if (!ownerComponent && typeof fiber.type === 'function') {
            const name = fiber.type.displayName || fiber.type.name;
            if (name && /^[A-Z]/.test(name)) ownerComponent = name;
          }
          fiber = fiber.return;
          depth += 1;
        }
      }
    }

    if (el._vei && typeof el._vei.onClick === 'function') hasFrameworkClick = true;
    if (el.__vnode?.props && typeof el.__vnode.props.onClick === 'function') hasFrameworkClick = true;
    if (typeof el.__click === 'function' || typeof el.$$click === 'function') hasFrameworkClick = true;

    if (el.__vueParentComponent?.type) {
      ownerComponent = ownerComponent || el.__vueParentComponent.type.name || el.__vueParentComponent.type.__name || null;
      debugFile = debugFile || el.__vueParentComponent.type.__file || null;
    }
    if (el.__svelte_meta?.loc) {
      debugFile = debugFile || el.__svelte_meta.loc.file || null;
      debugLine = debugLine || el.__svelte_meta.loc.line || null;
    }
    if (el.dataset?.astroSourceFile) {
      debugFile = debugFile || el.dataset.astroSourceFile;
      const loc = el.dataset.astroSourceLoc;
      if (loc) debugLine = Number(loc.split(':')[0]) || null;
    }

    return { debugFile, debugLine, ownerComponent, hasFrameworkClick };
  };

  const getAccessibleName = (el) => {
    const ariaLabel = (el.getAttribute('aria-label') || '').trim();
    if (ariaLabel) return ariaLabel;
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const parts = labelledBy
        .split(/\\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() || '')
        .filter(Boolean);
      if (parts.length > 0) return parts.join(' ');
    }
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
      if (el.labels && el.labels.length > 0) {
        const labelTxt = Array.from(el.labels).map((l) => l.textContent?.trim() || '').join(' ').trim();
        if (labelTxt) return labelTxt;
      }
      if (el instanceof HTMLInputElement && ['submit', 'button', 'reset'].includes(el.type)) {
        if (el.value?.trim()) return el.value.trim();
      }
    }
    const imgWithAlt = el.querySelector?.('img[alt]');
    if (imgWithAlt && imgWithAlt.getAttribute('alt')?.trim()) {
      return imgWithAlt.getAttribute('alt').trim();
    }
    const text = (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
    if (text) return text;
    const title = (el.getAttribute('title') || '').trim();
    return title;
  };

  const compactHtml = (el) => {
    const clone = el.cloneNode(false);
    const outer = clone.outerHTML || ('<' + el.tagName.toLowerCase() + '>');
    const closeIdx = outer.indexOf('>');
    const openTag = closeIdx !== -1 ? outer.slice(0, closeIdx + 1) : outer;
    return openTag.slice(0, 120);
  };

  const selectorFor = (el) => {
    if (el.id) {
      const idSel = '#' + CSS.escape(el.id);
      try {
        if (document.querySelectorAll(idSel).length === 1) return idSel;
      } catch {}
    }
    const testId = el.getAttribute('data-testid');
    if (testId) {
      const tidSel = '[data-testid="' + testId.replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"') + '"]';
      try {
        if (document.querySelectorAll(tidSel).length === 1) return tidSel;
      } catch {}
    }
    const parts = [];
    let cur = el;
    let depth = 0;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement && depth < 48) {
      if (cur !== el && cur.id) {
        const ancId = '#' + CSS.escape(cur.id);
        try {
          if (document.querySelectorAll(ancId).length === 1) {
            parts.unshift(ancId);
            return parts.join(' > ');
          }
        } catch {}
      }
      if (cur === document.body) {
        parts.unshift('body');
        break;
      }
      let part = cur.tagName.toLowerCase();
      const parent = cur.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const sameTag = siblings.filter((c) => c.tagName === cur.tagName);
        if (sameTag.length > 1) {
          part += ':nth-child(' + (siblings.indexOf(cur) + 1) + ')';
        }
      }
      parts.unshift(part);
      cur = parent;
      depth += 1;
    }
    return parts.join(' > ');
  };

  const isMountOrDelegationContainer = (el) => {
    if (!(el instanceof Element)) return true;
    for (const k of Object.keys(el)) {
      if (k.startsWith('__reactContainer$') || k === '_reactRootContainer' || k === '__vue_app__') {
        return true;
      }
    }
    if (el.hasAttribute('data-reactroot') || el.hasAttribute('ng-version')) return true;
    if (
      el.parentElement === document.body &&
      /^(?:root|app|__next|__nuxt|svelte|main-app)$/i.test(el.id || '')
    ) {
      return true;
    }
    if (
      el.querySelector(
        'main, nav, header, footer, form, dialog, button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [role="option"], [role="switch"], [role="checkbox"], [role="radio"]'
      )
    ) {
      return true;
    }
    return false;
  };

  const nodeHint = (el) => {
    const meta = getFiberMeta(el);
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      testId: el.getAttribute('data-testid') || null,
      className: typeof el.className === 'string' ? el.className : null,
      text: (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 48),
      html: compactHtml(el),
      selector: selectorFor(el),
      ...meta,
    };
  };

  window.__mwVerifyNodeHint = nodeHint;
  window.__mwVerifyIsVisuallyRendered = isVisuallyRendered;
  window.__mwVerifyIsMountOrDelegation = isMountOrDelegationContainer;
  window.__mwVerifySmokeEls = [];

  const customViolations = [];

  for (const el of document.querySelectorAll('div, section, aside')) {
    if (!isExposedToA11y(el)) continue;
    const cls = typeof el.className === 'string' ? el.className : '';
    const id = el.id || '';
    const isModalLike = /(?:^|[\\s_-])(?:modal|dialog|lightbox)(?:$|[\\s_-])/i.test(cls + ' ' + id);
    if (!isModalLike) continue;
    if (el.closest('dialog, [role="dialog"], [role="alertdialog"]')) continue;
    customViolations.push({
      id: 'modal-missing-dialog-role',
      impact: 'serious',
      message: compactHtml(el) + ' lacks dialog role & focus trap.',
      node: nodeHint(el),
    });
  }

  const INTERACTIVE_ROLES = new Set([
    'button', 'link', 'menuitem', 'tab', 'option', 'switch', 'checkbox', 'radio', 'combobox', 'treeitem'
  ]);
  for (const el of document.querySelectorAll('div, span, li, p')) {
    if (!isExposedToA11y(el)) continue;
    if (isMountOrDelegationContainer(el)) continue;
    const meta = getFiberMeta(el);
    const hasInlineClick = el.hasAttribute('onclick') || typeof el.onclick === 'function';
    if (!meta.hasFrameworkClick && !hasInlineClick) continue;
    const cls = typeof el.className === 'string' ? el.className : '';
    if (/(?:backdrop|overlay|modal)/i.test(cls)) continue;
    const role = (el.getAttribute('role') || '').trim().toLowerCase();
    const tabIdx = el.getAttribute('tabindex');
    const hasValidKeyboardSemantics = INTERACTIVE_ROLES.has(role) && tabIdx !== null && Number(tabIdx) >= 0;
    if (!hasValidKeyboardSemantics) {
      customViolations.push({
        id: 'interactive-non-semantic-element',
        impact: 'serious',
        message: compactHtml(el) + ' has click handler without keyboard button semantics or tabIndex.',
        node: nodeHint(el),
      });
    }
  }

  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (viewportMeta) {
    const content = (viewportMeta.getAttribute('content') || '').toLowerCase();
    if (/user-scalable\\s*=\\s*(?:no|0)/.test(content) || /maximum-scale\\s*=\\s*1(?:\\.0)?(?:\\b|$)/.test(content)) {
      customViolations.push({
        id: 'meta-viewport',
        impact: 'critical',
        message: '<meta name="viewport"> disables user zooming.',
        node: nodeHint(viewportMeta),
      });
    }
  }

  if (!(document.documentElement.getAttribute('lang') || '').trim()) {
    customViolations.push({
      id: 'html-has-lang',
      impact: 'serious',
      message: '<html> element must have a lang attribute (<html>).',
      node: { tag: 'html', html: '<html>', selector: 'html' },
    });
  }

  if (!(document.title || '').trim()) {
    customViolations.push({
      id: 'document-title',
      impact: 'serious',
      message: 'Documents must have <title> element to aid in navigation (<head>).',
      node: { tag: 'head', html: '<head>', selector: 'head' },
    });
  }

  for (const img of document.querySelectorAll('img')) {
    if (!isExposedToA11y(img)) continue;
    const role = img.getAttribute('role');
    if (role === 'presentation' || role === 'none') continue;
    if (!img.hasAttribute('alt')) {
      customViolations.push({
        id: 'image-alt',
        impact: 'critical',
        message: compactHtml(img) + ' is missing an alt attribute.',
        node: nodeHint(img),
      });
    }
  }

  for (const ctrl of document.querySelectorAll('input, select, textarea')) {
    if (!isExposedToA11y(ctrl)) continue;
    if (ctrl instanceof HTMLInputElement && ['hidden', 'submit', 'button', 'reset', 'image'].includes(ctrl.type)) {
      continue;
    }
    if (!getAccessibleName(ctrl)) {
      customViolations.push({
        id: 'label',
        impact: 'critical',
        message: compactHtml(ctrl) + ' lacks an associated <label> or accessible name.',
        node: nodeHint(ctrl),
      });
    }
  }

  for (const dlg of document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"]')) {
    if (!isExposedToA11y(dlg)) continue;
    if (!getAccessibleName(dlg)) {
      customViolations.push({
        id: 'aria-dialog-name',
        impact: 'serious',
        message: compactHtml(dlg) + ' lacks an accessible dialog name (aria-labelledby / aria-label).',
        node: nodeHint(dlg),
      });
    }
  }

  const interactiveCandidates = [];
  const interactiveElements = document.querySelectorAll(
    'button, a[href], input, select, textarea, summary, [role="button"], [commandfor], [popovertarget], [tabindex]'
  );

  for (const el of interactiveElements) {
    if (!isVisuallyRendered(el)) continue;
    if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') continue;
    if (el instanceof HTMLInputElement && el.type === 'hidden') continue;

    if (el.closest('[aria-hidden="true"]')) {
      if (el.tabIndex >= 0) {
        customViolations.push({
          id: 'aria-hidden-focus',
          impact: 'serious',
          message: compactHtml(el) + ' is focusable inside an aria-hidden="true" container.',
          node: nodeHint(el),
        });
      }
      continue;
    }

    if ((el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') && !getAccessibleName(el)) {
      customViolations.push({
        id: 'button-name',
        impact: 'critical',
        message: compactHtml(el) + ' has no discernible accessible text or aria-label.',
        node: nodeHint(el),
      });
    }
    if (el instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(el.type) && !getAccessibleName(el)) {
      customViolations.push({
        id: 'input-button-name',
        impact: 'critical',
        message: compactHtml(el) + ' input button lacks discernible value or aria-label.',
        node: nodeHint(el),
      });
    }
    if (el.tagName === 'A' && el.hasAttribute('href') && !getAccessibleName(el)) {
      customViolations.push({
        id: 'link-name',
        impact: 'serious',
        message: compactHtml(el) + ' link has no discernible accessible text.',
        node: nodeHint(el),
      });
    }

    const isInteractiveControl =
      el.tagName === 'BUTTON' ||
      (el.tagName === 'A' && el.hasAttribute('href')) ||
      el.tagName === 'INPUT' ||
      el.tagName === 'SELECT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SUMMARY' ||
      el.getAttribute('role') === 'button' ||
      el.hasAttribute('commandfor') ||
      el.hasAttribute('popovertarget');

    if (!isInteractiveControl) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      customViolations.push({
        id: 'zero-size-interactive',
        impact: 'serious',
        message: compactHtml(el) + ' renders with zero interactive dimensions (' + Math.round(rect.width) + 'x' + Math.round(rect.height) + 'px).',
        node: nodeHint(el),
      });
      continue;
    }

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    if (cx >= 0 && cy >= 0 && cx <= window.innerWidth && cy <= window.innerHeight) {
      const hitStack = document.elementsFromPoint(cx, cy);
      const topEl = hitStack[0];
      if (topEl && topEl !== el && !el.contains(topEl) && !topEl.contains(el)) {
        let cur = topEl;
        let fixedBlocker = null;
        while (cur && cur !== document.body) {
          const pos = window.getComputedStyle(cur).position;
          if ((pos === 'fixed' || pos === 'sticky') && !cur.contains(el)) {
            fixedBlocker = cur;
            break;
          }
          cur = cur.parentElement;
        }
        if (fixedBlocker) {
          customViolations.push({
            id: 'fixed-element-occlusion',
            impact: 'serious',
            message: compactHtml(el) + ' is occluded by fixed/sticky overlay ' + compactHtml(fixedBlocker) + '.',
            node: nodeHint(el),
          });
        }
      }
    }

    const isSafeButton =
      el.tagName === 'BUTTON' ||
      el.getAttribute('role') === 'button' ||
      el.tagName === 'SUMMARY' ||
      el.hasAttribute('commandfor') ||
      el.hasAttribute('popovertarget') ||
      (el instanceof HTMLInputElement && ['button', 'submit', 'image'].includes(el.type));

    if (isSafeButton) {
      const label = getAccessibleName(el) || compactHtml(el);
      if (!/\\b(?:logout|log out|sign out|delete account|destroy|drop)\\b/i.test(label)) {
        const smokeIdx = window.__mwVerifySmokeEls.length;
        window.__mwVerifySmokeEls.push(el);
        interactiveCandidates.push({
          smokeIdx,
          label: label.slice(0, 50),
          selector: selectorFor(el),
          x: Math.round(cx),
          y: Math.round(cy),
          node: nodeHint(el),
        });
      }
    }
  }

  let axeViolations = [];
  let wcagRulesEvaluatedCount = 0;
  if (typeof window.axe !== 'undefined' && typeof window.axe.run === 'function') {
    try {
      const axeRes = await window.axe.run(document, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
        },
      });
      const evaluatedRuleIds = new Set();
      for (const bucket of [axeRes.passes, axeRes.violations, axeRes.incomplete, axeRes.inapplicable]) {
        for (const r of bucket || []) {
          if (r?.id) evaluatedRuleIds.add(r.id);
        }
      }
      wcagRulesEvaluatedCount = evaluatedRuleIds.size;

      axeViolations = (axeRes.violations || []).map((v) => {
        const mappedNodes = (v.nodes || []).slice(0, 12).map((n) => {
          const rawTarget = Array.isArray(n.target) ? n.target[n.target.length - 1] : null;
          const sel = typeof rawTarget === 'string' ? rawTarget : null;
          let domNode = null;
          if (sel) {
            try {
              domNode = document.querySelector(sel);
            } catch {}
          }
          return {
            html: n.html || '',
            node: domNode ? nodeHint(domNode) : { html: n.html || '', selector: sel || '' },
          };
        });
        const first = mappedNodes[0] || { html: '', node: { html: '' } };
        return {
          id: v.id,
          impact: v.impact || 'moderate',
          help: v.help,
          description: v.description,
          nodeCount: v.nodes?.length || 1,
          html: first.html,
          node: first.node,
          nodes: mappedNodes,
        };
      });
    } catch {}
  }

  const openModalCount = Array.from(
    document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], .modal')
  ).filter(isVisuallyRendered).length;

  return {
    finalUrl: window.location.href,
    openModalCount,
    wcagRulesEvaluatedCount,
    customViolations,
    axeViolations,
    interactiveCandidates: interactiveCandidates.slice(0, 8),
  };
})()`;

interface CustomDomViolation {
  id: string;
  impact?: string;
  message: string;
  node?: NodeHint;
}

interface AxeViolationNode {
  html?: string;
  node?: NodeHint;
}

interface AxeViolation {
  id: string;
  impact?: string;
  help?: string;
  description?: string;
  nodeCount?: number;
  html?: string;
  node?: NodeHint;
  nodes?: AxeViolationNode[];
}

interface InteractiveCandidate {
  smokeIdx?: number;
  label: string;
  selector: string;
  x: number;
  y: number;
  node?: NodeHint;
}

interface InPageAuditPayload {
  finalUrl?: string;
  openModalCount?: number;
  wcagRulesEvaluatedCount?: number;
  customViolations?: CustomDomViolation[];
  axeViolations?: AxeViolation[];
  interactiveCandidates?: InteractiveCandidate[];
}

async function detectCdpClickListenerViolations(
  session: PageSession,
): Promise<CustomDomViolation[]> {
  const objectGroup = 'mw-verify-click-scan';
  try {
    const arrEval = await session.send<{ result?: CdpRemoteObject }>('Runtime.evaluate', {
      objectGroup,
      returnByValue: false,
      expression: `(() => {
        const ROLES = new Set([
          'button', 'link', 'menuitem', 'tab', 'option', 'switch', 'checkbox', 'radio', 'combobox', 'treeitem'
        ]);
        const isVis = window.__mwVerifyIsVisuallyRendered;
        const isContainer = window.__mwVerifyIsMountOrDelegation;
        if (typeof isVis !== 'function') return [];
        const out = [];
        for (const el of document.querySelectorAll('div, span, li, p')) {
          if (out.length >= 120) break;
          if (!isVis(el) || el.closest('[aria-hidden="true"]')) continue;
          if (typeof isContainer === 'function' && isContainer(el)) continue;
          if (el.closest('button, a[href], summary, label')) continue;
          const cls = typeof el.className === 'string' ? el.className : '';
          if (/(?:backdrop|overlay|modal)/i.test(cls)) continue;
          const role = (el.getAttribute('role') || '').trim().toLowerCase();
          const tabIdx = el.getAttribute('tabindex');
          if (ROLES.has(role) && tabIdx !== null && Number(tabIdx) >= 0) continue;
          out.push(el);
        }
        return out;
      })()`,
    });

    const arrayObjectId = arrEval.result?.objectId;
    if (!arrayObjectId) return [];

    const propsRes = await session.send<{
      result?: Array<{ name: string; value?: CdpRemoteObject }>;
    }>('Runtime.getProperties', {
      objectId: arrayObjectId,
      ownProperties: true,
    });

    const elementEntries = (propsRes.result ?? []).filter(
      (p) => /^\d+$/.test(p.name) && Boolean(p.value?.objectId),
    );
    if (elementEntries.length === 0) return [];

    const listenerChecks = await Promise.all(
      elementEntries.map(async (entry): Promise<CustomDomViolation | null> => {
        const objectId = entry.value?.objectId;
        if (!objectId) return null;
        try {
          const { listeners = [] } = await session.send<{
            listeners?: Array<{ type?: string }>;
          }>('DOMDebugger.getEventListeners', {
            objectId,
          });
          const hasClick = listeners.some((l) => l.type === 'click');
          if (!hasClick) return null;
          const hasKeyHandler = listeners.some(
            (l) => l.type === 'keydown' || l.type === 'keyup' || l.type === 'keypress',
          );
          const metaRes = await session.send<{
            result?: { value?: { role: string; tabIdx: string | null; hint: NodeHint } };
          }>('Runtime.callFunctionOn', {
            objectId,
            returnByValue: true,
            functionDeclaration: `function() {
              const role = (this.getAttribute('role') || '').trim().toLowerCase();
              const tabIdx = this.getAttribute('tabindex');
              const hint = typeof window.__mwVerifyNodeHint === 'function'
                ? window.__mwVerifyNodeHint(this)
                : { html: '<' + this.tagName.toLowerCase() + '>' };
              return { role, tabIdx, hint };
            }`,
          });
          const val = metaRes.result?.value;
          if (!val) return null;
          if (hasKeyHandler && val.role && val.tabIdx !== null && Number(val.tabIdx) >= 0) {
            return null;
          }
          return {
            id: 'interactive-non-semantic-element',
            impact: 'serious',
            message: `${val.hint.html || '<div>'} has click listener without keyboard button semantics or tabIndex.`,
            node: val.hint,
          };
        } catch {
          return null;
        }
      }),
    );

    return listenerChecks.filter((item): item is CustomDomViolation => item !== null);
  } catch {
    return [];
  } finally {
    await session.send('Runtime.releaseObjectGroup', { objectGroup }).catch(() => {});
  }
}

async function waitForPostLoadAndNetworkIdle(
  inFlightRequests: ReadonlySet<string>,
  minSettleMs = 300,
  maxExtraIdleMs = 700,
): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, minSettleMs));
  const deadline = Date.now() + maxExtraIdleMs;
  let idleSince: number | null = inFlightRequests.size === 0 ? Date.now() : null;
  while (Date.now() < deadline) {
    if (inFlightRequests.size === 0) {
      if (idleSince === null) idleSince = Date.now();
      if (Date.now() - idleSince >= 50) break;
    } else {
      idleSince = null;
    }
    await new Promise<void>((r) => setTimeout(r, 25));
  }
}

const PERF_AND_CLS_INIT_SCRIPT = `(() => {
  if (window.__mwPerfTelemetry) return;
  const state = {
    cls: 0,
    lcpMs: 0,
    shifts: [],
    loafs: [],
  };
  window.__mwPerfPhase = 'load';
  window.__mwPerfActiveControl = null;
  window.__mwPerfTelemetry = state;

  const isPriceOrCtaNode = (node) => {
    if (!(node instanceof Element)) return false;
    const hit = node.closest(
      '[id*="price" i], [class*="price" i], [data-price], button[type="submit"], [id*="pay" i], [id*="checkout" i], .cta, .cta-btn'
    );
    if (hit) return hit;
    return node.querySelector?.(
      '[id*="price" i], [class*="price" i], [data-price], button[type="submit"], [id*="pay" i], [id*="checkout" i], .cta, .cta-btn'
    ) || null;
  };

  if (typeof PerformanceObserver === 'function') {
    const supported = Array.isArray(PerformanceObserver.supportedEntryTypes)
      ? PerformanceObserver.supportedEntryTypes
      : [];

    if (supported.includes('layout-shift')) {
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.hadRecentInput) continue;
            const val = Number(entry.value) || 0;
            state.cls += val;
            let priceTarget = null;
            let firstEl = null;
            for (const src of entry.sources || []) {
              if (src?.node instanceof Element) {
                if (!firstEl) firstEl = src.node;
                const matched = isPriceOrCtaNode(src.node);
                if (matched) {
                  priceTarget = matched;
                  break;
                }
              }
            }
            const refEl = priceTarget || firstEl;
            state.shifts.push({
              value: val,
              touchesPriceOrCta: Boolean(priceTarget),
              selector: refEl?.id ? '#' + refEl.id : refEl ? refEl.tagName.toLowerCase() : '',
              html: refEl ? (refEl.cloneNode(false).outerHTML || '').slice(0, 100) : '',
            });
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch {}
    }

    if (supported.includes('largest-contentful-paint')) {
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            state.lcpMs = Math.max(state.lcpMs, Number(entry.startTime) || 0);
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {}
    }

    const loafType = supported.includes('long-animation-frame')
      ? 'long-animation-frame'
      : supported.includes('longtask')
        ? 'longtask'
        : null;
    if (loafType) {
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const dur = Math.round(Number(entry.duration) || 0);
            if (dur < 50) continue;
            state.loafs.push({
              type: loafType,
              duration: dur,
              blockingDuration: Math.round(Number(entry.blockingDuration ?? Math.max(0, dur - 50))),
              phase: window.__mwPerfPhase || 'load',
              control: window.__mwPerfActiveControl || null,
            });
          }
        }).observe({ type: loafType, buffered: true });
      } catch {}
    }
  }
})();`;

interface InPagePerfValue {
  cls: number;
  lcpMs: number;
  loafs: Array<{
    type: string;
    duration: number;
    blockingDuration: number;
    phase: string;
    control: string | null;
  }>;
  connectedDomNodes: number;
  hasContentVisibility: boolean;
}

async function collectCdpPerfAndMemoryAudit(
  session: PageSession,
  route: string,
): Promise<{ metrics: PerfRouteMetrics; findings: VerificationFinding[] }> {
  const objectGroup = 'mw-verify-global-listeners';
  const findings: VerificationFinding[] = [];
  try {
    await session.send('HeapProfiler.collectGarbage').catch(() => {});

    const [metricsRes, heapRes, inPageRes, targetsEval] = await Promise.all([
      session
        .send<{ metrics?: Array<{ name: string; value: number }> }>('Performance.getMetrics')
        .catch(() => ({ metrics: [] })),
      session
        .send<{ usedSize?: number; totalSize?: number }>('Runtime.getHeapUsage')
        .catch(() => ({ usedSize: 0, totalSize: 0 })),
      session
        .send<{ result?: { value?: InPagePerfValue | null } }>('Runtime.evaluate', {
          returnByValue: true,
          expression: `(() => {
            const t = window.__mwPerfTelemetry || { cls: 0, lcpMs: 0, shifts: [], loafs: [] };
            const allEls = document.getElementsByTagName('*');
            const connectedDomNodes = allEls.length;
            let hasContentVisibility = false;
            const sampleStep = Math.max(1, Math.floor(connectedDomNodes / 200));
            for (let i = 0; i < connectedDomNodes; i += sampleStep) {
              if (window.getComputedStyle(allEls[i]).contentVisibility === 'auto') {
                hasContentVisibility = true;
                break;
              }
            }
            return {
              cls: Math.round((Number(t.cls) || 0) * 10000) / 10000,
              lcpMs: Math.round(Number(t.lcpMs) || 0),
              loafs: Array.isArray(t.loafs) ? t.loafs : [],
              connectedDomNodes,
              hasContentVisibility,
            };
          })()`,
        })
        .catch(() => ({ result: { value: null } })),
      session
        .send<{ result?: CdpRemoteObject }>('Runtime.evaluate', {
          objectGroup,
          returnByValue: false,
          expression: '[window, document]',
        })
        .catch(() => null),
    ]);

    const cdpMetricMap = new Map<string, number>(
      (metricsRes.metrics ?? []).map((m) => [m.name, Number(m.value) || 0]),
    );
    const inPage: InPagePerfValue = inPageRes.result?.value ?? {
      cls: 0,
      lcpMs: 0,
      loafs: [],
      connectedDomNodes: 0,
      hasContentVisibility: false,
    };

    const cdpNodes = Math.round(cdpMetricMap.get('Nodes') || inPage.connectedDomNodes);
    const domNodes = inPage.connectedDomNodes;
    const detachedDomNodes = Math.max(0, cdpNodes - domNodes);
    const usedBytes = Number(heapRes.usedSize || cdpMetricMap.get('JSHeapUsedSize') || 0);
    const totalBytes = Number(heapRes.totalSize || cdpMetricMap.get('JSHeapTotalSize') || 0);
    const jsHeapUsedMb = Math.round((usedBytes / (1024 * 1024)) * 100) / 100;
    const jsHeapTotalMb = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;

    let globalWindowListeners = 0;
    let globalDocumentListeners = 0;
    const byType = new Map<string, number>();
    const nonPassiveScrollTypes = new Set<string>();

    const arrObjId = targetsEval?.result?.objectId;
    if (arrObjId) {
      const props = await session
        .send<{ result?: Array<{ name: string; value?: CdpRemoteObject }> }>(
          'Runtime.getProperties',
          { objectId: arrObjId, ownProperties: true },
        )
        .catch(() => ({ result: [] }));
      for (const prop of props.result ?? []) {
        if ((prop.name !== '0' && prop.name !== '1') || !prop.value?.objectId) continue;
        const { listeners = [] } = await session
          .send<{ listeners?: Array<{ type?: string; passive?: boolean }> }>(
            'DOMDebugger.getEventListeners',
            { objectId: prop.value.objectId },
          )
          .catch(() => ({ listeners: [] }));
        if (prop.name === '0') globalWindowListeners = listeners.length;
        else globalDocumentListeners = listeners.length;

        for (const l of listeners) {
          const type = String(l.type || '');
          if (!type) continue;
          const targetLabel = prop.name === '0' ? 'window' : 'document';
          const key = `${targetLabel}:${type}`;
          byType.set(key, (byType.get(key) || 0) + 1);
          if (
            (type === 'wheel' ||
              type === 'mousewheel' ||
              type === 'touchstart' ||
              type === 'touchmove') &&
            l.passive === false
          ) {
            nonPassiveScrollTypes.add(`${targetLabel}.${type}`);
          }
        }
      }
    }

    let worstListenerKey: string | null = null;
    let maxListenerTypeCount = 0;
    for (const [k, count] of byType.entries()) {
      if (count > maxListenerTypeCount) {
        maxListenerTypeCount = count;
        worstListenerKey = k;
      }
    }

    const loafs = inPage.loafs ?? [];
    const maxLoafMs = loafs.reduce((m, l) => Math.max(m, l.duration || 0), 0);
    const worstInteractionLoaf =
      loafs.filter((l) => l.phase === 'interaction').sort((a, b) => b.duration - a.duration)[0] ??
      null;
    const worstLoadLoaf =
      loafs.filter((l) => l.phase !== 'interaction').sort((a, b) => b.duration - a.duration)[0] ??
      null;

    if (worstInteractionLoaf && worstInteractionLoaf.duration >= 100) {
      const dur = worstInteractionLoaf.duration;
      findings.push({
        category: 'PERF',
        severity: dur >= 200 ? 'error' : 'warning',
        route,
        ruleId: 'perf-interaction-loaf',
        message: `Long Animation Frame (${dur}ms) blocked main thread while interacting with "${worstInteractionLoaf.control || 'control'}".`,
        guides: ['identify-inp-causes', 'break-up-long-tasks', 'schedule-tasks-by-priority'],
        fix: 'Yield to the main thread (`await scheduler.yield()`) after immediate UI feedback and defer non-urgent work.',
      });
    } else if (worstLoadLoaf && worstLoadLoaf.duration >= 150) {
      const dur = worstLoadLoaf.duration;
      findings.push({
        category: 'PERF',
        severity: dur >= 300 ? 'error' : 'warning',
        route,
        ruleId: 'perf-load-loaf',
        message: `Long Animation Frame (${dur}ms) blocked main thread during initial route load.`,
        guides: ['break-up-long-tasks', 'optimize-script-priority', 'identify-heavy-scripts'],
        fix: 'Split synchronous boot work with `scheduler.yield()` or lazy `import()` non-critical modules.',
      });
    }

    if (inPage.cls > 0.1) {
      findings.push({
        category: 'PERF',
        severity: inPage.cls > 0.25 ? 'error' : 'warning',
        route,
        ruleId: 'perf-cls',
        message: `Cumulative Layout Shift (CLS ${inPage.cls.toFixed(3)}) exceeds Core Web Vitals threshold (0.10).`,
        guides: ['performance', 'css-layout', 'visually-stable-font-fallbacks'],
        fix: 'Reserve explicit `width`/`height`, `aspect-ratio`, or `min-height` on late-loading media, banners, and dynamic slots.',
      });
    }

    if (inPage.lcpMs > 2500) {
      findings.push({
        category: 'PERF',
        severity: inPage.lcpMs > 4000 ? 'error' : 'warning',
        route,
        ruleId: 'perf-lcp',
        message: `Largest Contentful Paint (${inPage.lcpMs}ms) exceeds 2,500ms budget.`,
        guides: ['optimize-image-priority', 'optimize-preload-priority', 'performance'],
        fix: 'Add `fetchpriority="high"` (without `loading="lazy"`) on hero media and eliminate render-blocking requests.',
      });
    }

    const totalGlobalListeners = globalWindowListeners + globalDocumentListeners;
    if (maxListenerTypeCount >= 8 || totalGlobalListeners >= 30) {
      findings.push({
        category: 'PERF',
        severity: maxListenerTypeCount >= 15 || totalGlobalListeners >= 50 ? 'error' : 'warning',
        route,
        ruleId: 'perf-listener-accumulation',
        message: `Global event listener accumulation detected (${totalGlobalListeners} total on window/document; ${maxListenerTypeCount}× ${worstListenerKey || 'listener'}).`,
        guides: ['coordinate-global-events', 'performance'],
        fix: 'Consolidate global listeners or pass `{ signal: abortController.signal }` so effect/component cleanups never leak listeners.',
      });
    }

    if (nonPassiveScrollTypes.size > 0) {
      findings.push({
        category: 'PERF',
        severity: 'warning',
        route,
        ruleId: 'perf-non-passive-scroll',
        message: `Non-passive scroll-blocking listener(s) registered on ${[...nonPassiveScrollTypes].join(', ')}.`,
        guides: ['defer-work-until-scroll-ends', 'coordinate-global-events', 'performance'],
        fix: 'Pass `{ passive: true }` on `wheel`/`touchstart`/`touchmove` listeners so compositor scrolling never stalls on JS.',
      });
    }

    if (domNodes > 1500 && !inPage.hasContentVisibility) {
      findings.push({
        category: 'PERF',
        severity: domNodes > 3000 ? 'error' : 'warning',
        route,
        ruleId: 'perf-dom-size',
        message: `Route renders ${domNodes} live DOM nodes without \`content-visibility: auto\` containment.`,
        guides: ['defer-rendering-heavy-content', 'performance'],
        fix: 'Apply `content-visibility: auto; contain-intrinsic-size: auto <height>;` to offscreen sections or virtualize large lists.',
      });
    }

    if (detachedDomNodes >= 150 && detachedDomNodes > domNodes * 0.5) {
      findings.push({
        category: 'PERF',
        severity: 'warning',
        route,
        ruleId: 'perf-detached-dom',
        message: `Retained ${detachedDomNodes} detached Blink nodes vs. ${domNodes} connected DOM nodes (potential detached DOM memory leak).`,
        guides: ['coordinate-global-events', 'efficient-background-processing', 'performance'],
        fix: 'Clear stale DOM element references and remove global listeners with `AbortController` when unmounting views.',
      });
    }

    if (jsHeapUsedMb > 80) {
      findings.push({
        category: 'PERF',
        severity: jsHeapUsedMb > 160 ? 'error' : 'warning',
        route,
        ruleId: 'perf-heap-usage',
        message: `Client JS heap usage is ${jsHeapUsedMb} MB on \`${route}\`.`,
        guides: ['identify-heavy-scripts', 'efficient-background-processing', 'performance'],
        fix: 'Lazy-load heavy client libraries and release large in-memory caches or detached structures.',
      });
    }

    return {
      metrics: {
        route,
        cls: inPage.cls,
        lcpMs: inPage.lcpMs,
        loafCount: loafs.length,
        maxLoafMs,
        interactionLoafMs: worstInteractionLoaf?.duration || 0,
        domNodes,
        detachedDomNodes,
        jsHeapUsedMb,
        jsHeapTotalMb,
        globalWindowListeners,
        globalDocumentListeners,
        maxListenerTypeCount,
      },
      findings,
    };
  } finally {
    await session.send('Runtime.releaseObjectGroup', { objectGroup }).catch(() => {});
  }
}

interface SingleRouteResult {
  route: string;
  findings: VerificationFinding[];
  wcagRulesEvaluatedCount: number;
  packMetrics: Record<string, number> | null;
  perfMetrics: PerfRouteMetrics | null;
}

function packCategory(pack: ActivePackName): FindingCategory {
  if (pack === 'commerce') return 'PACK:COMMERCE';
  if (pack === 'media') return 'PACK:MEDIA';
  return 'PACK:SAAS';
}

async function auditSingleRoute(params: {
  browser: HeadlessBrowser;
  baseUrl: string;
  route: string;
  workspaceDir: string;
  sourceRecords: readonly SourceFileCacheRecord[];
  axeSource: string | null;
  smokeProbe: boolean;
  pack: ActivePackName | null;
  perf: boolean;
}): Promise<SingleRouteResult> {
  const {
    browser,
    baseUrl,
    route,
    workspaceDir,
    sourceRecords,
    axeSource,
    smokeProbe,
    pack,
    perf,
  } = params;

  return browser.withPageSession(async (session) => {
    const enableCalls: Array<Promise<unknown>> = [
      session.send('Page.enable'),
      session.send('Runtime.enable'),
      session.send('Log.enable'),
      session.send('Network.enable'),
      session
        .send<{ frameTree?: { frame?: { id?: string } } }>('Page.getFrameTree')
        .catch(() => null),
    ];
    if (perf) {
      enableCalls.push(session.send('Performance.enable').catch(() => null));
    }
    if (perf || pack === 'commerce') {
      enableCalls.push(
        session
          .send('Page.addScriptToEvaluateOnNewDocument', { source: PERF_AND_CLS_INIT_SCRIPT })
          .catch(() => null),
      );
    }
    const settledEnable = await Promise.all(enableCalls);
    const frameTreeRes = settledEnable[4] as { frameTree?: { frame?: { id?: string } } } | null;

    const runtimeEvents: Array<{ kind: string; message: string; url: string | null }> = [];
    const hydrationFindings: string[] = [];
    const inFlightRequests = new Set<string>();
    let viteHmrErrorCount = 0;
    let mainDocStatus: number | null = null;
    let mainFrameId: string | null = frameTreeRes?.frameTree?.frame?.id ?? null;
    const targetUrl = new URL(route, baseUrl).href;
    const targetOrigin = new URL(targetUrl).origin;

    const recordRuntimeIssue = (kind: string, rawText: string, url: string | null = null): void => {
      if (!rawText) return;
      if (VITE_HMR_NOISE_RE.test(rawText) || VITE_HMR_NOISE_RE.test(url || '')) {
        viteHmrErrorCount += 1;
        return;
      }
      if (HYDRATION_MESSAGE_RE.test(rawText)) {
        hydrationFindings.push(summarizeHydrationMessage(rawText));
        return;
      }
      if (rawText.includes('axe.run') && (url || '').includes('axe')) return;
      const firstLine = rawText.split('\n')[0].trim().slice(0, 220);
      if (firstLine) {
        runtimeEvents.push({ kind, message: firstLine, url });
      }
    };

    session.on('Runtime.consoleAPICalled', (evParams) => {
      const type = typeof evParams.type === 'string' ? evParams.type : '';
      if (type !== 'error' && type !== 'warning') return;
      const args = Array.isArray(evParams.args) ? (evParams.args as CdpRemoteObject[]) : [];
      const joined = args.map(formatCdpRemoteObject).join(' ').trim();
      if (!joined) return;
      if (type === 'warning' && !HYDRATION_MESSAGE_RE.test(joined)) return;
      const stackTrace = evParams.stackTrace as
        | { callFrames?: Array<{ url?: string }> }
        | undefined;
      const frameUrl = stackTrace?.callFrames?.[0]?.url ?? null;
      recordRuntimeIssue('console.error', joined, frameUrl);
    });

    session.on('Runtime.exceptionThrown', (evParams) => {
      const details = (evParams.exceptionDetails ?? {}) as CdpExceptionDetails;
      const desc = formatExceptionDetails(details);
      recordRuntimeIssue('pageerror', String(desc), details.url ?? null);
    });

    session.on('Log.entryAdded', (evParams) => {
      const entry = (evParams.entry ?? {}) as {
        level?: string;
        source?: string;
        text?: string;
        url?: string;
      };
      if (entry.level !== 'error') return;
      if (entry.source === 'network') return;
      recordRuntimeIssue('browser-log', entry.text || '', entry.url ?? null);
    });

    session.on('Network.requestWillBeSent', (evParams) => {
      const type = typeof evParams.type === 'string' ? evParams.type : '';
      const req = evParams.request as { url?: string } | undefined;
      const reqUrl = req?.url ?? '';
      const requestId = typeof evParams.requestId === 'string' ? evParams.requestId : '';
      if (
        requestId &&
        type !== 'WebSocket' &&
        type !== 'EventSource' &&
        !VITE_HMR_NOISE_RE.test(reqUrl)
      ) {
        inFlightRequests.add(requestId);
      }
    });

    session.on('Network.loadingFinished', (evParams) => {
      if (typeof evParams.requestId === 'string') {
        inFlightRequests.delete(evParams.requestId);
      }
    });

    session.on('Network.responseReceived', (evParams) => {
      const res = (evParams.response ?? {}) as { url?: string; status?: number };
      const resUrl = res.url ?? '';
      const status = typeof res.status === 'number' ? res.status : 0;
      const isTopFrameDoc =
        evParams.type === 'Document' &&
        resUrl.startsWith(targetOrigin) &&
        (mainFrameId ? evParams.frameId === mainFrameId : mainDocStatus === null);
      if (isTopFrameDoc) {
        mainDocStatus = status;
      }
      if (status >= 400 && !resUrl.endsWith('/favicon.ico')) {
        if (VITE_HMR_NOISE_RE.test(resUrl)) {
          viteHmrErrorCount += 1;
          return;
        }
        const shortPath = resUrl.startsWith(targetOrigin)
          ? resUrl.slice(targetOrigin.length) || '/'
          : resUrl;
        runtimeEvents.push({
          kind: 'network',
          message: `HTTP ${status} on ${shortPath}`,
          url: resUrl,
        });
      }
    });

    session.on('Network.loadingFailed', (evParams) => {
      if (typeof evParams.requestId === 'string') {
        inFlightRequests.delete(evParams.requestId);
      }
      if (evParams.canceled) return;
      const errText = typeof evParams.errorText === 'string' ? evParams.errorText : '';
      if (errText.includes('ERR_ABORTED')) return;
      if (evParams.type === 'WebSocket' || VITE_HMR_NOISE_RE.test(errText)) {
        viteHmrErrorCount += 1;
        return;
      }
      runtimeEvents.push({
        kind: 'network',
        message: `Network request failed (${errText || 'unknown'})`,
        url: null,
      });
    });

    const loadDone = new Promise<void>((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsub();
        resolve();
      };
      const unsub = session.on('Page.loadEventFired', finish);
      const timer = setTimeout(finish, 4000);
    });

    const navRes = await session.send<{ frameId?: string }>('Page.navigate', { url: targetUrl });
    if (!mainFrameId && navRes.frameId) mainFrameId = navRes.frameId;
    await loadDone;
    await waitForPostLoadAndNetworkIdle(inFlightRequests, 300, 700);

    const findings: VerificationFinding[] = [];
    const seenHydration = new Set<string>();
    const seenRuntime = new Set<string>();
    const smokeConsumedRuntimeIndices = new Set<number>();

    const flushHydrationAndRuntime = (): void => {
      for (const msg of hydrationFindings) {
        if (seenHydration.has(msg)) continue;
        seenHydration.add(msg);
        findings.push({
          category: 'RUNTIME',
          severity: 'error',
          route,
          message: msg,
          guides: [],
          fix: 'Ensure SSR and initial client render are deterministic (avoid locale/timezone drift, `Date.now()`, `Math.random()`, or `window` branching during initial render).',
        });
      }
      for (let idx = 0; idx < runtimeEvents.length; idx++) {
        if (smokeConsumedRuntimeIndices.has(idx)) continue;
        const evt = runtimeEvents[idx];
        if (seenRuntime.has(evt.message)) continue;
        seenRuntime.add(evt.message);
        findings.push({
          category: 'RUNTIME',
          severity: 'error',
          route,
          message: evt.message,
          guides: [],
          fix: 'Inspect the stack trace / failing endpoint and ensure uncaught exceptions, unhandled promise rejections, and 4xx/5xx fetches are handled.',
        });
      }
    };

    if (mainDocStatus !== null && mainDocStatus >= 400) {
      findings.push({
        category: 'RUNTIME',
        severity: 'error',
        route,
        message: `Route returned HTTP ${mainDocStatus}.`,
        guides: [],
        fix: `Verify route handler / page file exists for \`${route}\` and does not throw during SSR.`,
      });
      return {
        route,
        findings,
        wcagRulesEvaluatedCount: 0,
        packMetrics: null,
        perfMetrics: null,
      };
    }

    flushHydrationAndRuntime();

    if (axeSource) {
      await session
        .send('Runtime.evaluate', {
          expression: axeSource,
          returnByValue: false,
        })
        .catch(() => {});
    }

    const evalRes = await session.send<{ result?: { value?: InPageAuditPayload } }>(
      'Runtime.evaluate',
      {
        expression: IN_PAGE_AUDIT_EXPRESSION,
        awaitPromise: true,
        returnByValue: true,
      },
    );

    const pageAudit: InPageAuditPayload = evalRes.result?.value ?? {
      customViolations: [],
      axeViolations: [],
      interactiveCandidates: [],
      openModalCount: 0,
      wcagRulesEvaluatedCount: 0,
    };

    const cdpClickViolations = await detectCdpClickListenerViolations(session);
    const allCustomViolations = [...(pageAudit.customViolations ?? []), ...cdpClickViolations];

    if (route !== '/' && pageAudit.finalUrl) {
      const finalPath = new URL(pageAudit.finalUrl).pathname.replace(/\/+$/, '') || '/';
      if (finalPath === '/') {
        findings.push({
          category: 'RUNTIME',
          severity: 'error',
          route,
          message: `Sub-route \`${route}\` redirected back to root \`/\`.`,
          guides: [],
          fix: `Register \`${route}\` in your router or remove unintended redirect guards.`,
        });
      }
    }

    const seenA11yKeys = new Set<string>();
    const seenAxeSelectors = new Set<string>();
    const AXE_SUPERSEDED_FALLBACK_RULES = new Set([
      'aria-hidden-focus',
      'input-button-name',
      'button-name',
      'image-alt',
      'label',
      'link-name',
      'meta-viewport',
      'aria-dialog-name',
      'html-has-lang',
      'document-title',
    ]);

    for (const v of pageAudit.axeViolations ?? []) {
      const meta = guidanceForA11yRule(v.id, v.help);

      const nodeList: AxeViolationNode[] =
        Array.isArray(v.nodes) && v.nodes.length > 0
          ? v.nodes
          : [{ html: v.html || '', node: v.node ?? {} }];

      for (const entry of nodeList) {
        const hint = entry.node ?? {};
        const htmlSnippet = entry.html || hint.html || '';
        if (hint.selector) seenAxeSelectors.add(`${v.id}:${hint.selector}`);
        const loc = locateInWorkspaceFiles(hint, workspaceDir, sourceRecords);
        const dedupKey = loc
          ? `${v.id}:${loc.file}:${loc.line}`
          : `${v.id}:${hint.selector || htmlSnippet}`;
        if (seenA11yKeys.has(dedupKey)) continue;
        seenA11yKeys.add(dedupKey);

        findings.push({
          category: 'A11Y',
          severity: v.impact === 'minor' ? 'warning' : 'error',
          route,
          file: loc?.file ?? null,
          line: loc?.line ?? null,
          ruleId: v.id,
          message: `${v.help || v.description || v.id}${htmlSnippet ? ` (${htmlSnippet.slice(0, 80)})` : ''}`,
          guides: meta.guides,
          fix: meta.fix,
        });
      }
    }

    for (const v of allCustomViolations) {
      const hint = v.node ?? {};
      if (
        AXE_SUPERSEDED_FALLBACK_RULES.has(v.id) &&
        hint.selector &&
        seenAxeSelectors.has(`${v.id}:${hint.selector}`)
      ) {
        continue;
      }
      const loc = locateInWorkspaceFiles(hint, workspaceDir, sourceRecords);
      const dedupKey = loc
        ? `${v.id}:${loc.file}:${loc.line}`
        : `${v.id}:${hint.selector || v.message}`;
      if (seenA11yKeys.has(dedupKey)) continue;
      seenA11yKeys.add(dedupKey);

      const meta = guidanceForA11yRule(v.id, v.message);

      findings.push({
        category: 'A11Y',
        severity: 'error',
        route,
        file: loc?.file ?? null,
        line: loc?.line ?? null,
        ruleId: v.id,
        message: v.message,
        guides: meta.guides,
        fix: meta.fix,
      });
    }

    flushHydrationAndRuntime();

    let packTelemetry: PackBrowserResult | null = null;
    if (pack) {
      const packExpr = buildInPagePackAuditExpression(pack);
      const packRes = await session
        .send<{ result?: { value?: PackBrowserResult } }>('Runtime.evaluate', {
          expression: packExpr,
          returnByValue: true,
        })
        .catch(() => null);
      packTelemetry = packRes?.result?.value ?? null;
      if (packTelemetry && Array.isArray(packTelemetry.violations)) {
        const packCat = packCategory(pack);
        const seenPackKeys = new Set<string>();
        for (const pv of packTelemetry.violations) {
          const loc = locateInWorkspaceFiles(pv.node ?? {}, workspaceDir, sourceRecords);
          const key = loc
            ? `${pv.id}:${loc.file}:${loc.line}`
            : `${pv.id}:${pv.node?.selector || pv.message}`;
          if (seenPackKeys.has(key)) continue;
          seenPackKeys.add(key);
          findings.push({
            category: packCat,
            severity: pv.severity || 'warning',
            route,
            file: loc?.file ?? null,
            line: loc?.line ?? null,
            ruleId: pv.id,
            message: pv.message,
            guides: pv.guides ?? [],
            fix: pv.fix || '',
          });
        }
      }
    }

    if (smokeProbe) {
      const candidates = pageAudit.interactiveCandidates ?? [];
      let prevModalCount = pageAudit.openModalCount || 0;
      let prevPopoverCount = await session
        .send<{ result?: { value?: number } }>('Runtime.evaluate', {
          expression: `document.querySelectorAll('[popover]:popover-open').length`,
          returnByValue: true,
        })
        .then((r) => r.result?.value ?? 0)
        .catch(() => 0);

      for (let cIdx = 0; cIdx < Math.min(candidates.length, 6); cIdx++) {
        const ctrl = candidates[cIdx];
        const beforeRuntimeLen = runtimeEvents.length;

        await session
          .send('Runtime.evaluate', {
            userGesture: true,
            expression: `(() => {
              window.__mwPerfPhase = 'interaction';
              window.__mwPerfActiveControl = ${JSON.stringify(ctrl.label)};
              const direct = Array.isArray(window.__mwVerifySmokeEls) ? window.__mwVerifySmokeEls[${Number(ctrl.smokeIdx ?? -1)}] : null;
              const el = (direct && direct.isConnected) ? direct : document.querySelector(${JSON.stringify(ctrl.selector)});
              window.__mwLastClickedTrigger = el || null;
              if (el && typeof el.focus === 'function') {
                try { el.focus({ preventScroll: true }); } catch {}
              }
              if (el && typeof el.click === 'function') el.click();
            })()`,
            returnByValue: true,
          })
          .catch(() => {});

        await new Promise<void>((r) => setTimeout(r, 110));

        for (let idx = beforeRuntimeLen; idx < runtimeEvents.length; idx++) {
          smokeConsumedRuntimeIndices.add(idx);
          const err = runtimeEvents[idx];
          const loc = locateInWorkspaceFiles(ctrl.node ?? {}, workspaceDir, sourceRecords);
          findings.push({
            category: 'SMOKE',
            severity: 'error',
            route,
            file: loc?.file ?? null,
            line: loc?.line ?? null,
            message: `Clicking "${ctrl.label}" threw: ${err.message}`,
            guides: [],
            fix: `Guard click/submit handler on "${ctrl.label}" against null/undefined state and failed async calls.`,
          });
        }

        const postClickState = await session
          .send<{
            result?: {
              value?: {
                href?: string;
                count: number;
                popoverCount: number;
                tag?: string | null;
                role?: string | null;
                closedby?: string | null;
              };
            };
          }>('Runtime.evaluate', {
            expression: `(() => {
              const isVis = window.__mwVerifyIsVisuallyRendered || ((el) => {
                const s = window.getComputedStyle(el);
                return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0;
              });
              const visibleModals = Array.from(
                document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], .modal')
              ).filter(isVis);
              const openPopovers = Array.from(document.querySelectorAll('[popover]:popover-open'));
              const top = visibleModals[visibleModals.length - 1] || null;
              return {
                href: window.location.href,
                count: visibleModals.length,
                popoverCount: openPopovers.length,
                tag: top ? top.tagName.toLowerCase() : null,
                role: top ? top.getAttribute('role') : null,
                closedby: top ? top.getAttribute('closedby') : null,
              };
            })()`,
            returnByValue: true,
          })
          .then((r) => r.result?.value ?? { count: 0, popoverCount: 0 })
          .catch(() => ({ count: 0, popoverCount: 0 }));

        const openedNewModal = postClickState.count > prevModalCount;
        const openedNewPopover = (postClickState.popoverCount || 0) > prevPopoverCount;

        if (openedNewModal || (pack === 'saas' && openedNewPopover)) {
          const isIntentionalBlocking =
            openedNewModal &&
            ('closedby' in postClickState &&
              (postClickState.closedby === 'none' || postClickState.role === 'alertdialog'));

          if (!isIntentionalBlocking) {
            await session.send('Input.dispatchKeyEvent', {
              type: 'keyDown',
              key: 'Escape',
              code: 'Escape',
              windowsVirtualKeyCode: 27,
              nativeVirtualKeyCode: 27,
            });
            await session.send('Input.dispatchKeyEvent', {
              type: 'keyUp',
              key: 'Escape',
              code: 'Escape',
              windowsVirtualKeyCode: 27,
              nativeVirtualKeyCode: 27,
            });
            await new Promise<void>((r) => setTimeout(r, 80));

            const afterEsc = await session
              .send<{
                result?: {
                  value?: {
                    modalCount: number;
                    popoverCount: number;
                    restoredToTrigger: boolean;
                  };
                };
              }>('Runtime.evaluate', {
                expression: `(() => {
                  const isVis = window.__mwVerifyIsVisuallyRendered || ((el) => {
                    const s = window.getComputedStyle(el);
                    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0;
                  });
                  const modalCount = Array.from(
                    document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], .modal')
                  ).filter(isVis).length;
                  const popoverCount = document.querySelectorAll('[popover]:popover-open').length;
                  const trig = window.__mwLastClickedTrigger;
                  const active = document.activeElement;
                  const triggerStillFocusable = Boolean(trig && trig.isConnected && isVis(trig));
                  const restoredToTrigger = Boolean(
                    !triggerStillFocusable ||
                    (active && trig && (active === trig || trig.contains(active)))
                  );
                  return { modalCount, popoverCount, restoredToTrigger };
                })()`,
                returnByValue: true,
              })
              .then(
                (r) =>
                  r.result?.value ?? {
                    modalCount: 0,
                    popoverCount: 0,
                    restoredToTrigger: true,
                  },
              )
              .catch(() => ({ modalCount: 0, popoverCount: 0, restoredToTrigger: true }));

            if (openedNewModal && afterEsc.modalCount >= postClickState.count) {
              const loc = locateInWorkspaceFiles(ctrl.node ?? {}, workspaceDir, sourceRecords);
              findings.push({
                category: 'SMOKE',
                severity: 'error',
                route,
                file: loc?.file ?? null,
                line: loc?.line ?? null,
                message: `Modal opened by "${ctrl.label}" ignores Escape key dismissal (potential focus trap).`,
                guides: ['dialog', 'light-dismiss-a-dialog'],
                fix: 'Use native `<dialog closedby="any">` opened with `.showModal()` / `command="show-modal"` (without canceling the `cancel` event) for automatic Escape dismissal and focus return.',
              });
            } else if (
              pack === 'saas' &&
              afterEsc.modalCount === 0 &&
              afterEsc.popoverCount === 0 &&
              !afterEsc.restoredToTrigger
            ) {
              const loc = locateInWorkspaceFiles(ctrl.node ?? {}, workspaceDir, sourceRecords);
              findings.push({
                category: 'PACK:SAAS',
                severity: 'error',
                route,
                file: loc?.file ?? null,
                line: loc?.line ?? null,
                ruleId: 'saas-focus-restoration',
                message: `Dismissing overlay opened by "${ctrl.label}" with Escape lost keyboard focus to <body> instead of restoring trigger focus.`,
                guides: [
                  'declarative-dialog-popover-control',
                  'dialog',
                  'light-dismiss-a-dialog',
                ],
                fix: 'Use native `<dialog>` (`command="show-modal"`) or `[popover="auto"]` (`popovertarget`), which restore focus to the invoking trigger automatically on Escape.',
              });
            }
            prevModalCount = afterEsc.modalCount;
            prevPopoverCount = afterEsc.popoverCount;
          } else {
            prevModalCount = postClickState.count;
            prevPopoverCount = postClickState.popoverCount || 0;
          }
        } else {
          prevModalCount = postClickState.count;
          prevPopoverCount = postClickState.popoverCount || 0;
        }

        if (
          'href' in postClickState &&
          postClickState.href &&
          postClickState.href !== pageAudit.finalUrl &&
          cIdx + 1 < Math.min(candidates.length, 6)
        ) {
          await session.send('Page.navigate', { url: targetUrl }).catch(() => {});
          await new Promise<void>((r) => setTimeout(r, 120));
        }
      }
    }

    let perfMetrics: PerfRouteMetrics | null = null;
    if (perf) {
      const perfAudit = await collectCdpPerfAndMemoryAudit(session, route);
      perfMetrics = perfAudit.metrics;
      findings.push(...perfAudit.findings);
    }

    flushHydrationAndRuntime();

    if (viteHmrErrorCount >= 2) {
      findings.push({
        category: 'RUNTIME',
        severity: 'warning',
        route,
        message: `Coalesced ${viteHmrErrorCount} Vite HMR WebSocket connection failures (Express SSR middleware mode without an attached HMR server).`,
        guides: [],
        fix: 'Configure Vite `createServer({ server: { middlewareMode: true, hmr: { server: httpServer } } })` (or `hmr: false` in headless test harnesses).',
      });
    }

    return {
      route,
      findings,
      wcagRulesEvaluatedCount: pageAudit.wcagRulesEvaluatedCount || 0,
      packMetrics: packTelemetry?.metrics ?? null,
      perfMetrics,
    };
  });
}

export interface BrowserPassResult {
  durationMs: number;
  axeInjected: boolean;
  wcagRulesEvaluatedCount: number;
  routes: string[];
  packMetrics: Array<Record<string, unknown>>;
  perfSummary: PerfSummary | null;
  findings: VerificationFinding[];
}

export async function runBrowserPass(params: {
  browser: HeadlessBrowser;
  baseUrl: string;
  routes: readonly string[];
  workspaceDir: string;
  touchedFiles: readonly string[];
  smokeProbe?: boolean;
  pack?: ActivePackName | null;
  perf?: boolean;
}): Promise<BrowserPassResult> {
  const {
    browser,
    baseUrl,
    routes,
    workspaceDir,
    touchedFiles,
    smokeProbe = true,
    pack = null,
    perf = false,
  } = params;

  const startedAt = performance.now();
  const axeSource = resolveAxeScriptSource(workspaceDir);
  const sourceRecords = buildSourceFileCache(workspaceDir, touchedFiles);

  const routeResults: SingleRouteResult[] = [];
  const batchSize = 3;
  for (let i = 0; i < routes.length; i += batchSize) {
    const slice = routes.slice(i, i + batchSize);
    const batchRes = await Promise.all(
      slice.map((route) =>
        auditSingleRoute({
          browser,
          baseUrl,
          route,
          workspaceDir,
          sourceRecords,
          axeSource,
          smokeProbe,
          pack,
          perf,
        }),
      ),
    );
    routeResults.push(...batchRes);
  }

  const findings = routeResults.flatMap((r) => r.findings);
  const maxWcagRules = routeResults.reduce(
    (m, r) => Math.max(m, r.wcagRulesEvaluatedCount || 0),
    0,
  );

  const routePerfList = routeResults
    .map((r) => r.perfMetrics)
    .filter((m): m is PerfRouteMetrics => m !== null);
  const perfSummary: PerfSummary | null =
    perf && routePerfList.length > 0
      ? {
          maxCls: Math.max(...routePerfList.map((p) => p.cls || 0)),
          maxLcpMs: Math.max(...routePerfList.map((p) => p.lcpMs || 0)),
          maxLoafMs: Math.max(...routePerfList.map((p) => p.maxLoafMs || 0)),
          maxInteractionLoafMs: Math.max(...routePerfList.map((p) => p.interactionLoafMs || 0)),
          maxDomNodes: Math.max(...routePerfList.map((p) => p.domNodes || 0)),
          maxDetachedDomNodes: Math.max(...routePerfList.map((p) => p.detachedDomNodes || 0)),
          maxJsHeapUsedMb: Math.max(...routePerfList.map((p) => p.jsHeapUsedMb || 0)),
          maxGlobalListeners: Math.max(
            ...routePerfList.map(
              (p) => (p.globalWindowListeners || 0) + (p.globalDocumentListeners || 0),
            ),
          ),
          routes: routePerfList,
        }
      : null;

  return {
    durationMs: Math.round(performance.now() - startedAt),
    axeInjected: Boolean(axeSource),
    wcagRulesEvaluatedCount: maxWcagRules,
    routes: routeResults.map((r) => r.route),
    packMetrics: routeResults.map((r) => ({ route: r.route, ...r.packMetrics })),
    perfSummary,
    findings,
  };
}
