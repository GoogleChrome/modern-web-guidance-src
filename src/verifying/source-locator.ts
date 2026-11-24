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

import type { ResolvedSourceLocation } from './types.ts';

interface SourceFrame {
  framework: string;
  component: string;
  file: string;
  line: number;
  column: number;
}

const IGNORED_STACK_FN_NAMES = new Set([
  'jsx',
  'jsxs',
  'jsxDEV',
  '_jsx',
  '_jsxs',
  '_jsxDEV',
  'createElement',
  'cloneElement',
  'fakeJSXCallSite',
  'react_stack_bottom_frame',
  'react-stack-bottom-frame',
  'react-stack-top-frame',
  'eval',
  '<anonymous>',
  'Object',
  'Function',
]);

/**
 * Normalizes bundler URLs, filesystem prefixes, and query strings into clean
 * workspace-relative paths such as `src/components/Dropdown.tsx`.
 */
export function normalizeSourceFilePath(rawPath: string): string {
  let cleaned = rawPath.trim();
  if (!cleaned) return '';

  cleaned = cleaned
    .replace(/^webpack-internal:\/\/\/(\([^)]+\)\/)?/, '')
    .replace(/^vite:\/\/\//, '')
    .replace(/^file:\/\//, '');

  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    try {
      cleaned = new URL(cleaned).pathname;
    } catch {
      // Keep original string if URL parsing fails.
    }
  }

  cleaned = cleaned.replace(/[?#].*$/, '');
  const fsPrefixIdx = cleaned.indexOf('/@fs/');
  if (fsPrefixIdx !== -1) {
    cleaned = cleaned.slice(fsPrefixIdx + 5);
  }

  const srcMatch = cleaned.match(/^(?:.*\/)?(src\/.+)$/);
  if (srcMatch) return srcMatch[1];

  const appMatch = cleaned.match(/^(?:.*\/)?((?:app|pages|components|lib)\/.+)$/);
  if (appMatch) return appMatch[1];

  return cleaned.replace(/^\/+/, '');
}

/**
 * Resolves a live DOM element back to its authoring `file:line:column` across
 * React 16-19 (`_debugSource` & `_debugStack`), Vue 2/3 (`__vnode` /
 * `__vueParentComponent`), Svelte (`__svelte_meta`), Angular Ivy (`window.ng`),
 * Astro (`data-astro-source-file`), and explicit bundler attributes, crossing
 * Shadow DOM boundaries.
 */
export function resolveElementSource(
  element: Element,
  win: Window = window,
): ResolvedSourceLocation {
  let cursor: Element | null = element;
  let depth = 0;

  while (cursor && depth < 60) {
    depth++;

    const explicit = readExplicitAttributes(cursor);
    if (explicit) return toResult(explicit);

    const fiber = getReactFiber(cursor, win);
    if (fiber) {
      const frame = resolveReactFiberFrame(fiber);
      if (frame) return toResult(frame);
      const name = resolveReactComponentName(fiber);
      return { framework: 'react', component: name || cursor.tagName.toLowerCase(), file: null, line: null, column: null };
    }

    const vueFrame = resolveVueFrame(cursor, element);
    if (vueFrame) return toResult(vueFrame);

    const svelteFrame = resolveSvelteFrame(cursor);
    if (svelteFrame) return toResult(svelteFrame);

    const ngFrame = resolveAngularFrame(cursor, win, true);
    if (ngFrame) return toResult(ngFrame);

    const astroFile = cursor.getAttribute('data-astro-source-file');
    if (astroFile) {
      const [lineStr, colStr] = (cursor.getAttribute('data-astro-source-loc') ?? '1:1').split(':');
      return toResult({
        framework: 'astro',
        component: deriveComponentName(astroFile, 'AstroComponent'),
        file: astroFile,
        line: Number(lineStr) || 1,
        column: Number(colStr) || 1,
      });
    }

    cursor = getParentAcrossShadow(cursor);
  }

  const fallbackNg = resolveAngularFrame(element, win, false);
  if (fallbackNg) return toResult(fallbackNg);

  return {
    framework: element.tagName.includes('-') ? 'web-components' : 'vanilla',
    component: element.tagName.toLowerCase(),
    file: null,
    line: null,
    column: null,
  };
}

function toResult(frame: SourceFrame): ResolvedSourceLocation {
  const file = normalizeSourceFilePath(frame.file) || null;
  return {
    framework: frame.framework,
    component: frame.component || (file ? deriveComponentName(file, 'Component') : 'element'),
    file,
    line: file ? Math.max(1, Math.trunc(frame.line || 1)) : null,
    column: file ? Math.max(1, Math.trunc(frame.column || 1)) : null,
  };
}

function readProp(target: unknown, key: string): unknown {
  if (target !== null && (typeof target === 'object' || typeof target === 'function')) {
    return (target as Record<string, unknown>)[key];
  }
  return undefined;
}

function readString(target: unknown, key: string): string {
  const val = readProp(target, key);
  return typeof val === 'string' ? val : '';
}

function readNumber(target: unknown, key: string): number {
  const val = readProp(target, key);
  return typeof val === 'number' && Number.isFinite(val) ? val : 0;
}

function parseColonLocation(raw: string): { file: string; line: number; column: number } | null {
  const match = raw.trim().match(/^(.+?):(\d+)(?::(\d+))?$/);
  if (!match) return null;
  return { file: match[1], line: Number(match[2]) || 1, column: Number(match[3]) || 1 };
}

function deriveComponentName(filePath: string, fallback: string): string {
  const base = normalizeSourceFilePath(filePath).split('/').pop() ?? '';
  const stem = base.replace(/\.(tsx|jsx|ts|js|vue|svelte|astro|ng\.html)$/i, '');
  return stem || fallback;
}

function getParentAcrossShadow(el: Element): Element | null {
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode?.();
  if (root && typeof root === 'object' && 'host' in root) {
    const host = (root as { host?: unknown }).host;
    if (host && typeof host === 'object' && 'tagName' in host) {
      return host as Element;
    }
  }
  return null;
}

function readExplicitAttributes(node: Element): SourceFrame | null {
  const vInspector = node.getAttribute('data-v-inspector');
  if (vInspector) {
    const parsed = parseColonLocation(vInspector);
    if (parsed) {
      return {
        framework: 'vue',
        component: deriveComponentName(parsed.file, 'VueComponent'),
        ...parsed,
      };
    }
  }
  const generic =
    node.getAttribute('data-source-loc') ?? node.getAttribute('data-inspector-loc');
  if (generic) {
    const parsed = parseColonLocation(generic);
    if (parsed) {
      return {
        framework: 'web',
        component: deriveComponentName(parsed.file, node.tagName.toLowerCase()),
        ...parsed,
      };
    }
  }
  return null;
}

function getReactFiber(node: Element, win: Window): unknown {
  for (const key of Object.keys(node)) {
    if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
      const fiber = readProp(node, key);
      if (fiber && typeof fiber === 'object') return fiber;
    }
  }
  const renderers = readProp(readProp(win, '__REACT_DEVTOOLS_GLOBAL_HOOK__'), 'renderers');
  if (!renderers || typeof renderers !== 'object') return null;
  const valuesFn = readProp(renderers, 'values');
  const list =
    typeof valuesFn === 'function'
      ? Array.from((valuesFn as () => Iterable<unknown>).call(renderers))
      : Object.values(renderers as Record<string, unknown>);
  for (const renderer of list) {
    const findFiber = readProp(renderer, 'findFiberByHostInstance');
    if (typeof findFiber === 'function') {
      try {
        const found = (findFiber as (el: Element) => unknown).call(renderer, node);
        if (found && typeof found === 'object') return found;
      } catch {
        // Ignore unmounted node lookup errors.
      }
    }
  }
  return null;
}

function resolveReactFiberFrame(fiber: unknown): SourceFrame | null {
  const startedFromHost = typeof readProp(fiber, 'type') === 'string' || readProp(fiber, 'tag') === 5;
  let cursor: unknown = fiber;
  for (let guard = 0; cursor && guard < 35; guard++) {
    const ownName = resolveReactComponentName(cursor);
    const owner = readProp(cursor, '_debugOwner');
    const ownerName = resolveReactComponentName(owner);
    const attributed = startedFromHost ? ownerName || ownName : ownName || ownerName;

    const debugSource = readProp(cursor, '_debugSource');
    if (debugSource && typeof debugSource === 'object') {
      const file = readString(debugSource, 'fileName');
      if (file) {
        return {
          framework: 'react',
          component: attributed || deriveComponentName(file, 'ReactComponent'),
          file,
          line: readNumber(debugSource, 'lineNumber') || 1,
          column: readNumber(debugSource, 'columnNumber') || 1,
        };
      }
    }

    const debugStack = readProp(cursor, '_debugStack');
    const stackText =
      debugStack instanceof Error
        ? (debugStack.stack ?? '')
        : typeof debugStack === 'string'
          ? debugStack
          : readString(debugStack, 'stack');
    if (stackText) {
      const parsed = parseErrorStackFrame(stackText);
      if (parsed) {
        return {
          framework: 'react',
          component: parsed.fn || attributed || deriveComponentName(parsed.file, 'ReactComponent'),
          file: parsed.file,
          line: parsed.line,
          column: parsed.column,
        };
      }
    }
    cursor = owner ?? readProp(cursor, 'return');
  }
  return null;
}

function resolveReactComponentName(fiber: unknown): string {
  const initial = readProp(fiber, 'type') ?? readProp(fiber, 'elementType');
  if (!initial || typeof initial === 'string') return '';
  let current: unknown = initial;
  for (let depth = 0; depth < 6 && current; depth++) {
    if (typeof current !== 'function' && typeof current !== 'object') break;
    const display = readString(current, 'displayName')
      .trim()
      .replace(/^(?:Memo|ForwardRef)\((.+)\)$/, '$1');
    if (display) return display;
    const fnName = readString(current, 'name');
    if (fnName && fnName !== 'Memo' && fnName !== 'ForwardRef') return fnName;
    const renderFn = readProp(current, 'render');
    if (renderFn) {
      const renderName = readString(renderFn, 'displayName') || readString(renderFn, 'name');
      if (renderName) return renderName;
    }
    current = readProp(current, 'type');
  }
  return '';
}

function resolveVueFrame(node: Element, startNode: Element): SourceFrame | null {
  const vnode = readProp(node, '__vnode');
  if (vnode && typeof vnode === 'object') {
    const inspector = readString(readProp(vnode, 'props'), 'data-v-inspector');
    if (inspector) {
      const parsed = parseColonLocation(inspector);
      if (parsed) {
        return { framework: 'vue', component: deriveComponentName(parsed.file, 'VueComponent'), ...parsed };
      }
    }
    const vtype = readProp(vnode, 'type');
    const vfile = readString(vtype, '__file') || readString(vtype, 'file');
    if (vfile) {
      return {
        framework: 'vue',
        component: readString(vtype, '__name') || readString(vtype, 'name') || deriveComponentName(vfile, 'VueComponent'),
        file: vfile,
        line: readNumber(vtype, '__line') || 1,
        column: readNumber(vtype, '__column') || 1,
      };
    }
  }

  let comp =
    readProp(vnode, 'component') ??
    readProp(vnode, 'ctx') ??
    readProp(node, '__vueParentComponent') ??
    readProp(node, '__vue__') ??
    readProp(readProp(node, '__vue_app__'), '_instance');

  if (!comp) return null;
  for (let guard = 0; comp && guard < 25; guard++) {
    const compType = readProp(comp, 'type') ?? readProp(comp, '$options');
    const file = readString(compType, '__file') || readString(compType, 'file');
    if (file) {
      return {
        framework: 'vue',
        component:
          readString(compType, '__name') ||
          readString(compType, 'name') ||
          deriveComponentName(file, startNode.tagName.toLowerCase()),
        file,
        line: readNumber(compType, '__line') || 1,
        column: readNumber(compType, '__column') || 1,
      };
    }
    comp = readProp(comp, 'parent') ?? readProp(comp, '$parent');
  }
  return null;
}

function resolveSvelteFrame(node: Element): SourceFrame | null {
  const meta = readProp(node, '__svelte_meta');
  if (!meta || typeof meta !== 'object') return null;
  const loc = readProp(meta, 'loc');
  const file = readString(loc, 'file') || readString(meta, 'file');
  if (!file) return null;
  return {
    framework: 'svelte',
    component: deriveComponentName(file, 'SvelteComponent'),
    file,
    line: readNumber(loc, 'line') || 1,
    column: readNumber(loc, 'char') || readNumber(loc, 'column') || 1,
  };
}

function resolveAngularFrame(node: Element, win: Window, hostOnly: boolean): SourceFrame | null {
  const ng = readProp(win, 'ng');
  if (!ng || typeof ng !== 'object') return null;
  const getComp = readProp(ng, 'getComponent');
  const getOwning = readProp(ng, 'getOwningComponent');
  let instance: unknown = null;
  if (typeof getComp === 'function') {
    try {
      instance = (getComp as (el: Element) => unknown)(node);
    } catch {
      // Non-Angular node.
    }
  }
  if (!instance && !hostOnly && typeof getOwning === 'function') {
    try {
      instance = (getOwning as (el: Element) => unknown)(node);
    } catch {
      return null;
    }
  }
  if (!instance || typeof instance !== 'object') return null;

  const ctor = readProp(instance, 'constructor');
  let component = readString(ctor, 'name') || 'AngularComponent';
  let file = readString(ctor, '__file') || readString(instance, '__file');
  let line = readNumber(ctor, '__line') || 1;
  let column = readNumber(ctor, '__column') || 1;

  const getMeta = readProp(ng, 'getDirectiveMetadata');
  if (typeof getMeta === 'function') {
    try {
      const meta = (getMeta as (c: unknown) => unknown)(instance);
      component = readString(meta, 'name') || readString(meta, 'selector') || component;
      file ||= readString(meta, 'templateUrl') || readString(meta, 'filePath');
      line = readNumber(meta, 'line') || line;
      column = readNumber(meta, 'column') || column;
    } catch {
      // Production build without Ivy metadata.
    }
  }

  if (!file) {
    const kebab = component
      .replace(/Component$/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase();
    file = `src/app/${kebab || 'app'}.component.ts`;
  }
  return { framework: 'angular', component, file, line, column };
}

function parseErrorStackFrame(
  stackText: string,
): { fn: string; file: string; line: number; column: number } | null {
  for (const rawLine of stackText.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('Error')) continue;

    let fn = '';
    let file = '';
    let lineNum = 1;
    let colNum = 1;

    const v8Paren = line.match(/^at\s+(.+?)\s+\((.+):(\d+):(\d+)\)$/);
    const v8Bare = !v8Paren ? line.match(/^at\s+(.+):(\d+):(\d+)$/) : null;
    const ffMatch = !v8Paren && !v8Bare ? line.match(/^([^@]*)@(.+?):(\d+):(\d+)$/) : null;

    if (v8Paren) {
      fn = v8Paren[1].replace(/^(?:async\s+|new\s+)+/, '').replace(/\s*\[as\s+[^\]]+\]$/, '').trim();
      file = v8Paren[2];
      lineNum = Number(v8Paren[3]) || 1;
      colNum = Number(v8Paren[4]) || 1;
    } else if (v8Bare && !v8Bare[1].includes(' (')) {
      file = v8Bare[1];
      lineNum = Number(v8Bare[2]) || 1;
      colNum = Number(v8Bare[3]) || 1;
    } else if (ffMatch) {
      fn = ffMatch[1].trim();
      file = ffMatch[2];
      lineNum = Number(ffMatch[3]) || 1;
      colNum = Number(ffMatch[4]) || 1;
    }

    const lower = file.toLowerCase();
    if (
      !file ||
      lower.includes('node_modules') ||
      lower.includes('react-dom') ||
      lower.includes('jsx-runtime') ||
      lower.includes('jsx-dev-runtime') ||
      lower === '<anonymous>'
    ) {
      continue;
    }

    if (fn.includes('.')) {
      const parts = fn.split('.').filter(Boolean);
      const last = parts[parts.length - 1] ?? '';
      fn = last === 'render' && parts[parts.length - 2] ? parts[parts.length - 2] : last;
    }
    if (fn && IGNORED_STACK_FN_NAMES.has(fn)) {
      if (fn.includes('jsx') || fn === 'createElement' || fn.startsWith('react')) continue;
      fn = '';
    }
    return { fn, file, line: lineNum, column: colNum };
  }
  return null;
}
