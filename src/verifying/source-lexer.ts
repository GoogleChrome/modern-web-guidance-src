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

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { ProjectConfig, VerificationFinding } from './types.ts';

const HTML_EXTS = new Set(['.html', '.htm']);
const CSS_EXTS = new Set(['.css', '.scss', '.sass', '.less']);
const SFC_EXTS = new Set(['.vue', '.svelte', '.astro']);
const JSX_EXTS = new Set(['.jsx', '.tsx', '.vue', '.svelte', '.astro']);

const REGEX_PRECEDING_KEYWORDS = new Set([
  'return',
  'throw',
  'case',
  'typeof',
  'void',
  'delete',
  'in',
  'instanceof',
  'of',
  'await',
  'yield',
  'else',
  'from',
  'import',
  'export',
  'default',
]);

const JSX_PRECEDING_KEYWORDS = new Set([
  'return',
  'yield',
  'await',
  'throw',
  'case',
  'default',
  'else',
]);

function lexCssRange(
  content: string,
  start: number,
  end: number,
  strippedArr: string[],
): void {
  let i = start;
  while (i < end) {
    const ch = content[i];
    const next = content[i + 1];
    if (ch === '/' && next === '*' && i + 1 < end) {
      strippedArr[i] = ' ';
      strippedArr[i + 1] = ' ';
      i += 2;
      while (i < end && !(content[i] === '*' && content[i + 1] === '/')) {
        if (content[i] !== '\n') strippedArr[i] = ' ';
        i += 1;
      }
      if (i < end) {
        strippedArr[i] = ' ';
        if (i + 1 < end) strippedArr[i + 1] = ' ';
        i += 2;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i += 1;
      while (i < end && content[i] !== quote && content[i] !== '\n') {
        i += content[i] === '\\' && i + 1 < end ? 2 : 1;
      }
      if (i < end && content[i] === quote) i += 1;
      continue;
    }
    i += 1;
  }
}

function findJsxOpeningTagEnd(
  content: string,
  ltIdx: number,
  end: number,
): { tagName: string; gtIdx: number; selfClosing: boolean } | null {
  let j = ltIdx + 1;
  if (j >= end) return null;
  let tagName = '';
  if (content[j] === '>') {
    return { tagName: '', gtIdx: j, selfClosing: false };
  }
  if (!/[A-Za-z_$]/.test(content[j])) return null;
  while (j < end && /[A-Za-z0-9_$.:-]/.test(content[j])) {
    tagName += content[j];
    j += 1;
  }
  if (j < end && !/[\s/>]/.test(content[j])) return null;

  let braceDepth = 0;
  while (j < end) {
    const ch = content[j];
    if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch;
      j += 1;
      while (j < end && content[j] !== q) {
        j += content[j] === '\\' ? 2 : 1;
      }
      j += 1;
      continue;
    }
    if (ch === '{') {
      braceDepth += 1;
      j += 1;
      continue;
    }
    if (ch === '}') {
      if (braceDepth > 0) braceDepth -= 1;
      j += 1;
      continue;
    }
    if (braceDepth === 0) {
      if (ch === '/' && content[j + 1] === '>') {
        return { tagName, gtIdx: j + 1, selfClosing: true };
      }
      if (ch === '>') {
        return { tagName, gtIdx: j, selfClosing: false };
      }
      if (ch === '<' || ch === ';') return null;
    }
    j += 1;
  }
  return null;
}

function lexJsRange(
  content: string,
  start: number,
  end: number,
  strippedArr: string[],
  options: { allowJsx?: boolean; isSfc?: boolean } = {},
): void {
  const { allowJsx = false, isSfc = false } = options;
  const templateBraceDepthStack: number[] = [];
  const jsxTagStack: string[] = [];
  const jsxExprBraceStack: number[] = [];
  let inJsxTagHead = false;
  let pendingJsxPushTag: string | null = null;
  let lastNonWsChar = ';';
  let lastWord = '';
  let i = start;

  const canStartRegex = (): boolean => {
    if (REGEX_PRECEDING_KEYWORDS.has(lastWord)) return true;
    return '([{:;,=!&|?+-*%^~<>'.includes(lastNonWsChar);
  };

  const canStartJsx = (): boolean => {
    if (!allowJsx) return false;
    if (jsxTagStack.length > 0 && jsxExprBraceStack.length === 0 && !inJsxTagHead) return true;
    if (JSX_PRECEDING_KEYWORDS.has(lastWord)) return true;
    if (lastWord) return false;
    return '=([{:?,;!|&>'.includes(lastNonWsChar);
  };

  while (i < end) {
    const ch = content[i];
    const next = content[i + 1] || '';
    const inJsxChildren =
      allowJsx && jsxTagStack.length > 0 && jsxExprBraceStack.length === 0 && !inJsxTagHead;

    if (inJsxChildren) {
      if (isSfc && ch === '<' && content.slice(i, i + 4) === '<!--') {
        for (let k = 0; k < 4 && i + k < end; k++) strippedArr[i + k] = ' ';
        i += 4;
        while (i < end && content.slice(i, i + 3) !== '-->') {
          if (content[i] !== '\n') strippedArr[i] = ' ';
          i += 1;
        }
        if (i < end) {
          for (let k = 0; k < 3 && i + k < end; k++) strippedArr[i + k] = ' ';
          i += 3;
        }
        continue;
      }

      if (ch === '{') {
        jsxExprBraceStack.push(0);
        lastNonWsChar = '{';
        lastWord = '';
        i += 1;
        continue;
      }

      if (ch === '<' && next === '/') {
        let closeEnd = i + 2;
        while (closeEnd < end && content[closeEnd] !== '>') closeEnd += 1;
        if (closeEnd < end) {
          jsxTagStack.pop();
          lastNonWsChar = '>';
          lastWord = '';
          i = closeEnd + 1;
          continue;
        }
      }

      if (ch === '<') {
        const tagInfo = findJsxOpeningTagEnd(content, i, end);
        if (tagInfo) {
          const closeNeedle = tagInfo.tagName ? `</${tagInfo.tagName}` : '</>';
          const hasClose =
            !tagInfo.selfClosing &&
            tagInfo.tagName.toLowerCase() !== 'script' &&
            tagInfo.tagName.toLowerCase() !== 'style' &&
            content.indexOf(closeNeedle, tagInfo.gtIdx + 1) !== -1;
          inJsxTagHead = true;
          pendingJsxPushTag = hasClose ? tagInfo.tagName : null;
          lastNonWsChar = '<';
          lastWord = '';
          i += 1;
          continue;
        }
      }

      i += 1;
      continue;
    }

    if (inJsxTagHead && jsxExprBraceStack.length === 0) {
      if (ch === '/' && next === '>') {
        inJsxTagHead = false;
        pendingJsxPushTag = null;
        lastNonWsChar = '>';
        lastWord = '';
        i += 2;
        continue;
      }
      if (ch === '>') {
        inJsxTagHead = false;
        if (pendingJsxPushTag !== null) {
          jsxTagStack.push(pendingJsxPushTag);
          pendingJsxPushTag = null;
        }
        lastNonWsChar = '>';
        lastWord = '';
        i += 1;
        continue;
      }
      if (ch === '{') {
        jsxExprBraceStack.push(0);
        lastNonWsChar = '{';
        lastWord = '';
        i += 1;
        continue;
      }
    }

    if (isSfc && ch === '<' && content.slice(i, i + 4) === '<!--') {
      for (let k = 0; k < 4 && i + k < end; k++) strippedArr[i + k] = ' ';
      i += 4;
      while (i < end && content.slice(i, i + 3) !== '-->') {
        if (content[i] !== '\n') strippedArr[i] = ' ';
        i += 1;
      }
      if (i < end) {
        for (let k = 0; k < 3 && i + k < end; k++) strippedArr[i + k] = ' ';
        i += 3;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      strippedArr[i] = ' ';
      strippedArr[i + 1] = ' ';
      i += 2;
      while (i < end && content[i] !== '\n') {
        strippedArr[i] = ' ';
        i += 1;
      }
      continue;
    }

    if (ch === '/' && next === '*') {
      strippedArr[i] = ' ';
      strippedArr[i + 1] = ' ';
      i += 2;
      while (i < end && !(content[i] === '*' && content[i + 1] === '/')) {
        if (content[i] !== '\n') strippedArr[i] = ' ';
        i += 1;
      }
      if (i < end) {
        strippedArr[i] = ' ';
        if (i + 1 < end) strippedArr[i + 1] = ' ';
        i += 2;
      }
      continue;
    }

    if (ch === '<' && next !== '/' && next !== '!' && !inJsxTagHead && canStartJsx()) {
      const tagInfo = findJsxOpeningTagEnd(content, i, end);
      if (tagInfo) {
        const closeNeedle = tagInfo.tagName ? `</${tagInfo.tagName}` : '</>';
        const hasClose =
          !tagInfo.selfClosing &&
          tagInfo.tagName.toLowerCase() !== 'script' &&
          tagInfo.tagName.toLowerCase() !== 'style' &&
          content.indexOf(closeNeedle, tagInfo.gtIdx + 1) !== -1;
        if (tagInfo.selfClosing || hasClose) {
          inJsxTagHead = true;
          pendingJsxPushTag = hasClose ? tagInfo.tagName : null;
          lastNonWsChar = '<';
          lastWord = '';
          i += 1;
          continue;
        }
      }
    }

    if (ch === '"' || ch === "'") {
      if (
        ch === "'" &&
        i > start &&
        /[A-Za-z0-9_]/.test(content[i - 1]) &&
        !REGEX_PRECEDING_KEYWORDS.has(lastWord)
      ) {
        i += 1;
        continue;
      }
      const quote = ch;
      i += 1;
      while (i < end && content[i] !== quote && content[i] !== '\n') {
        i += content[i] === '\\' && i + 1 < end ? 2 : 1;
      }
      if (i < end && content[i] === quote) i += 1;
      lastNonWsChar = quote;
      lastWord = '';
      continue;
    }

    if (ch === '`') {
      i += 1;
      while (i < end) {
        if (content[i] === '\\' && i + 1 < end) {
          i += 2;
          continue;
        }
        if (content[i] === '`') {
          i += 1;
          lastNonWsChar = '`';
          lastWord = '';
          break;
        }
        if (content[i] === '$' && content[i + 1] === '{') {
          templateBraceDepthStack.push(0);
          i += 2;
          lastNonWsChar = '{';
          lastWord = '';
          break;
        }
        i += 1;
      }
      continue;
    }

    if (templateBraceDepthStack.length > 0) {
      if (ch === '{') {
        templateBraceDepthStack[templateBraceDepthStack.length - 1] += 1;
      } else if (ch === '}') {
        const topDepth = templateBraceDepthStack[templateBraceDepthStack.length - 1];
        if (topDepth === 0) {
          templateBraceDepthStack.pop();
          i += 1;
          while (i < end) {
            if (content[i] === '\\' && i + 1 < end) {
              i += 2;
              continue;
            }
            if (content[i] === '`') {
              i += 1;
              lastNonWsChar = '`';
              lastWord = '';
              break;
            }
            if (content[i] === '$' && content[i + 1] === '{') {
              templateBraceDepthStack.push(0);
              i += 2;
              lastNonWsChar = '{';
              lastWord = '';
              break;
            }
            i += 1;
          }
          continue;
        }
        templateBraceDepthStack[templateBraceDepthStack.length - 1] -= 1;
      }
    }

    if (jsxExprBraceStack.length > 0 && templateBraceDepthStack.length === 0) {
      if (ch === '{') {
        jsxExprBraceStack[jsxExprBraceStack.length - 1] += 1;
      } else if (ch === '}') {
        const topDepth = jsxExprBraceStack[jsxExprBraceStack.length - 1];
        if (topDepth === 0) {
          jsxExprBraceStack.pop();
          lastNonWsChar = '}';
          lastWord = '';
          i += 1;
          continue;
        }
        jsxExprBraceStack[jsxExprBraceStack.length - 1] -= 1;
      }
    }

    if (ch === '/' && next !== '/' && next !== '*' && lastNonWsChar !== '<' && canStartRegex()) {
      let j = i + 1;
      let inClass = false;
      let validRegex = false;
      while (j < end && content[j] !== '\n') {
        if (content[j] === '\\' && j + 1 < end) {
          j += 2;
          continue;
        }
        if (content[j] === '[') {
          inClass = true;
          j += 1;
          continue;
        }
        if (content[j] === ']') {
          inClass = false;
          j += 1;
          continue;
        }
        if (content[j] === '/' && !inClass) {
          validRegex = true;
          break;
        }
        j += 1;
      }
      if (validRegex && j > i + 1) {
        j += 1;
        while (j < end && /[dgimsuvy]/.test(content[j])) j += 1;
        i = j;
        lastNonWsChar = '/';
        lastWord = '';
        continue;
      }
    }

    if (/[A-Za-z_$]/.test(ch)) {
      let wordEnd = i + 1;
      while (wordEnd < end && /[A-Za-z0-9_$]/.test(content[wordEnd])) wordEnd += 1;
      lastWord = content.slice(i, wordEnd);
      lastNonWsChar = content[wordEnd - 1];
      i = wordEnd;
      continue;
    }

    if (!/\s/.test(ch)) {
      lastNonWsChar = ch;
      lastWord = '';
    }
    i += 1;
  }
}

export function stripCommentsPreservingLines(content: string, ext = '.tsx'): string {
  const lowerExt = (ext || '').toLowerCase();
  const len = content.length;

  if (CSS_EXTS.has(lowerExt)) {
    const strippedArr = content.split('');
    lexCssRange(content, 0, len, strippedArr);
    return strippedArr.join('');
  }

  if (HTML_EXTS.has(lowerExt)) {
    const strippedArr = content.split('');
    for (const m of content.matchAll(/<!--[\s\S]*?-->/g)) {
      const startIdx = m.index ?? 0;
      for (let k = startIdx; k < startIdx + m[0].length; k++) {
        if (content[k] !== '\n') strippedArr[k] = ' ';
      }
    }
    const cleanHtml = strippedArr.join('');
    for (const m of cleanHtml.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
      if (!m[1]) continue;
      const bodyStart = (m.index ?? 0) + m[0].indexOf(m[1]);
      lexCssRange(cleanHtml, bodyStart, bodyStart + m[1].length, strippedArr);
    }
    for (const m of cleanHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      if (!m[2]) continue;
      const bodyStart = (m.index ?? 0) + m[0].indexOf(m[2]);
      lexJsRange(cleanHtml, bodyStart, bodyStart + m[2].length, strippedArr, {
        allowJsx: false,
        isSfc: false,
      });
    }
    return strippedArr.join('');
  }

  const strippedArr = content.split('');
  lexJsRange(content, 0, len, strippedArr, {
    allowJsx: JSX_EXTS.has(lowerExt),
    isSfc: SFC_EXTS.has(lowerExt),
  });
  return strippedArr.join('');
}

const ESLINT_RULE_TO_GUIDES: Array<{ test: RegExp; guides: string[] }> = [
  {
    test: /inner-html|at-html|v-html|set-html|bypass-sanitizer|no-danger/i,
    guides: ['sanitize-untrusted-html', 'trusted-types'],
  },
  { test: /postmessage/i, guides: ['validate-origins', 'security'] },
  { test: /security|sdl|eval|script-url|csrf|target-blank|sandbox/i, guides: ['security'] },
  { test: /a11y|alt-text|aria|role/i, guides: ['accessibility'] },
  { test: /img-element/i, guides: ['optimize-image-priority', 'performance'] },
  {
    test: /sync-scripts|script-id|before-interactive/i,
    guides: ['optimize-script-priority', 'performance'],
  },
];

function guidesForEslintRule(ruleId: string): string[] {
  for (const entry of ESLINT_RULE_TO_GUIDES) {
    if (entry.test.test(ruleId)) return entry.guides;
  }
  return [];
}

interface EslintMessageLike {
  severity?: number;
  fatal?: boolean;
  ruleId?: string | null;
  line?: number;
  message?: string;
}

interface EslintFileResultLike {
  filePath: string;
  messages?: EslintMessageLike[];
}

interface EslintConstructorLike {
  new (options: { cwd: string; errorOnUnmatchedPattern: boolean }): {
    lintFiles(patterns: string[]): Promise<EslintFileResultLike[]>;
  };
}

/**
 * Runs the target workspace's own ESLint flat configuration when `eslint` and an
 * `eslint.config.*` file are present in the project.
 */
export async function runWorkspaceEslintIfConfigured(
  workspaceDir: string,
  touchedFiles: readonly string[],
  project: ProjectConfig,
): Promise<VerificationFinding[]> {
  const lintableFiles = touchedFiles.filter((f) =>
    /\.(?:js|mjs|cjs|ts|mts|cts|jsx|tsx|vue|svelte)$/i.test(f),
  );
  if (lintableFiles.length === 0) return [];

  const hasWorkspaceFlatConfig = [
    'eslint.config.js',
    'eslint.config.mjs',
    'eslint.config.cjs',
    'eslint.config.ts',
    'eslint.config.mts',
  ].some((cfg) => existsSync(path.join(workspaceDir, cfg)));
  if (!hasWorkspaceFlatConfig) return [];

  const workspacePkg = path.join(workspaceDir, 'package.json');
  if (!existsSync(workspacePkg)) return [];

  let ESLintClass: EslintConstructorLike | null = null;
  try {
    const req = createRequire(workspacePkg);
    const mod = req('eslint') as { ESLint?: EslintConstructorLike } | undefined;
    ESLintClass = mod?.ESLint ?? null;
  } catch {
    return [];
  }
  if (!ESLintClass) return [];

  let results: EslintFileResultLike[] = [];
  try {
    const eslint = new ESLintClass({
      cwd: workspaceDir,
      errorOnUnmatchedPattern: false,
    });
    const absTargets = lintableFiles.map((rel) => path.join(workspaceDir, rel));
    results = await eslint.lintFiles(absTargets);
  } catch {
    return [];
  }

  const findings: VerificationFinding[] = [];
  for (const fileRes of results) {
    const relFile = path.relative(workspaceDir, fileRes.filePath).split(path.sep).join('/');
    for (const msg of fileRes.messages ?? []) {
      if (!msg.severity || msg.severity < 1 || msg.fatal) continue;
      const ruleId = msg.ruleId || 'eslint-syntax';
      findings.push({
        category: 'MODERNITY',
        severity: msg.severity >= 2 ? 'error' : 'warning',
        file: relFile,
        line: msg.line || 1,
        ruleId,
        message: `${(msg.message || '').split('\n')[0]} (${ruleId})`,
        guides: guidesForEslintRule(ruleId),
        fix: `Resolve ESLint ${project.frameworkName} rule \`${ruleId}\` at \`${relFile}:${msg.line || 1}\`.`,
      });
    }
  }
  return findings;
}
