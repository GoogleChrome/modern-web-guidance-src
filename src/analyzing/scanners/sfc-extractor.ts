export interface ScriptBlock {
  readonly virtualPath: string;
  readonly blankedContent: string;
}

const NON_JS_SCRIPT_TYPES: ReadonlySet<string> = new Set([
  'text/template',
  'text/html',
  'text/x-template',
  'text/x-handlebars-template',
  'application/json',
  'application/ld+json',
  'importmap',
  'speculationrules',
]);

const SCRIPT_TAG_REGEX = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const STYLE_TAG_REGEX = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi;
const ASTRO_FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;
const TAG_ATTR_REGEX = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
const GLIMMER_COMMENT_REGEX = /\{\{~?!--[\s\S]*?--~?\}\}|\{\{~?![\s\S]*?\}\}/g;

export function isGlimmerPath(relPath: string): boolean {
  const lowerPath = relPath.toLowerCase();
  return lowerPath.endsWith('.gts') || lowerPath.endsWith('.gjs');
}

interface GlimmerTemplateRange {
  readonly start: number;
  readonly end: number;
  readonly innerStart: number;
  readonly innerEnd: number;
  readonly isClassMember: boolean;
}

const TEMPLATE_OPEN_TAG_REGEX = /<template\b(?:"[^"]*"|'[^']*'|[^'">])*>/y;
const EXPRESSION_PUNCTUATORS = new Set(['=', '(', ',', ':', '?', '[', '!', '&', '|']);
// After these, a `/` starts a regex literal rather than a division.
const REGEX_PRECEDING_PUNCTUATORS = new Set([...EXPRESSION_PUNCTUATORS, '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const REGEX_PRECEDING_KEYWORD_REGEX = /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|void|yield|await|delete|throw|new)$/;

/** Whether the code before a template expects a value, so the template is an expression. */
function expectsExpression(code: string): boolean {
  return EXPRESSION_PUNCTUATORS.has(code.at(-1) ?? '') || code.endsWith('=>');
}

function startsRegexLiteral(code: string): boolean {
  return code === '' || REGEX_PRECEDING_PUNCTUATORS.has(code.at(-1) ?? '') || REGEX_PRECEDING_KEYWORD_REGEX.test(code);
}

/** The code after the last `class` keyword in `header`, or `null` when there is none. */
function classHeaderTail(header: string): string | null {
  const match = /\bclass\b(?![\s\S]*\bclass\b)([\s\S]*)$/.exec(header);
  return match ? (match[1] ?? '') : null;
}

/** `<` minus `>` in a class header, so the braces of `extends Base<{ … }>` are not the body. */
function openTypeArguments(classTail: string): number {
  const withoutArrows = classTail.replaceAll('=>', '');
  return (withoutArrows.match(/</g) ?? []).length - (withoutArrows.match(/>/g) ?? []).length;
}

/**
 * Finds the `<template>…</template>` blocks of a .gts/.gjs file, skipping JS comments and
 * strings. A template directly in a class body, not after `=` or similar, is a class member.
 */
function findGlimmerTemplateRanges(content: string): readonly GlimmerTemplateRange[] {
  const ranges: GlimmerTemplateRange[] = [];
  const blockStack: { isClassBody: boolean; outerHeader: string }[] = [];
  // Code since the last statement boundary at the current brace depth.
  let header = '';
  let i = 0;
  while (i < content.length) {
    const char = content[i] ?? '';
    const next = content[i + 1];
    if (char === '/' && (next === '/' || next === '*')) {
      const end = next === '/' ? content.indexOf('\n', i) : content.indexOf('*/', i + 2) + 2;
      if (end < 2) {
        break;
      }
      i = end;
    } else if (char === '"' || char === "'" || char === '`') {
      i = skipString(content, i);
      header += 'x';
    } else if (char === '/' && startsRegexLiteral(header.trimEnd())) {
      i = skipRegexLiteral(content, i);
      header += 'x';
    } else if (char === '<' && isTemplateOpenTagAt(content, i)) {
      const closeStart = content.indexOf('</template>', i);
      if (closeStart === -1) {
        break;
      }
      const end = closeStart + '</template>'.length;
      ranges.push({
        start: i,
        end,
        innerStart: content.indexOf('>', i) + 1,
        innerEnd: closeStart,
        isClassMember: blockStack.at(-1)?.isClassBody === true && !expectsExpression(header.trimEnd()),
      });
      i = end;
      header += 'x';
    } else {
      if (char === '{') {
        const classTail = classHeaderTail(header);
        blockStack.push({
          isClassBody: classTail !== null && openTypeArguments(classTail) === 0,
          outerHeader: header,
        });
        header = '';
      } else if (char === '}') {
        const outerHeader = blockStack.pop()?.outerHeader ?? '';
        const classTail = classHeaderTail(outerHeader);
        header = classTail !== null && openTypeArguments(classTail) > 0 ? `${outerHeader}{}` : '';
      } else if (char === ';') {
        header = '';
      } else {
        header += char;
      }
      i++;
    }
  }
  return ranges;
}

function isTemplateOpenTagAt(content: string, index: number): boolean {
  TEMPLATE_OPEN_TAG_REGEX.lastIndex = index;
  return TEMPLATE_OPEN_TAG_REGEX.test(content);
}

/** Returns the index after the string or template literal that starts at `start`. */
function skipString(content: string, start: number): number {
  const quote = content[start];
  let interpolationDepth = 0;
  let i = start + 1;
  while (i < content.length) {
    const char = content[i];
    if (char === '\\') {
      i += 2;
      continue;
    }
    if (interpolationDepth > 0) {
      if (char === '"' || char === "'" || char === '`') {
        i = skipString(content, i);
        continue;
      }
      if (char === '{') {
        interpolationDepth++;
      } else if (char === '}') {
        interpolationDepth--;
      }
    } else if (char === quote) {
      return i + 1;
    } else if (quote === '`' && char === '$' && content[i + 1] === '{') {
      interpolationDepth = 1;
      i++;
    }
    i++;
  }
  return i;
}

/** Returns the index after the regex literal (and its flags) that starts at `start`. */
function skipRegexLiteral(content: string, start: number): number {
  let inCharacterClass = false;
  let i = start + 1;
  while (i < content.length && content[i] !== '\n') {
    const char = content[i];
    if (char === '\\') {
      i++;
    } else if (char === '[') {
      inCharacterClass = true;
    } else if (char === ']') {
      inCharacterClass = false;
    } else if (char === '/' && !inCharacterClass) {
      i++;
      while (i < content.length && /[a-z]/i.test(content[i] ?? '')) {
        i++;
      }
      return i;
    }
    i++;
  }
  return i;
}

/**
 * Blanks Glimmer templates out of a .gts/.gjs file. A class-member template becomes spaces;
 * any other becomes a same-length template literal, which is valid as an expression
 * (`const Row = <template>…</template>;`) and as a statement (`<template>…</template> satisfies T`).
 */
function blankGlimmerTemplates(content: string): string {
  let result = '';
  let lastIndex = 0;
  for (const { start, end, isClassMember } of findGlimmerTemplateRanges(content)) {
    const blanked = content.slice(start, end).replace(/[^\r\n]/g, ' ');
    result += content.slice(lastIndex, start) + (isClassMember ? blanked : `\`${blanked.slice(1, -1)}\``);
    lastIndex = end;
  }
  return result + content.slice(lastIndex);
}

/**
 * Keeps only the markup inside Glimmer templates, with Handlebars comments blanked,
 * at the original offsets.
 */
function glimmerTemplateMarkup(content: string): string {
  const templateRanges = findGlimmerTemplateRanges(content);
  const rangesToBlank: { start: number; end: number }[] = [];
  let lastIndex = 0;
  for (const { innerStart, innerEnd } of templateRanges) {
    rangesToBlank.push({ start: lastIndex, end: innerStart });
    for (const { start, end } of findTagRanges(content.slice(innerStart, innerEnd), GLIMMER_COMMENT_REGEX)) {
      rangesToBlank.push({ start: innerStart + start, end: innerStart + end });
    }
    lastIndex = innerEnd;
  }
  rangesToBlank.push({ start: lastIndex, end: content.length });
  return blankRanges(content, rangesToBlank);
}

/** Template markup of a .gts/.gjs file with `<script>`/`<style>` blocks blanked, for linkedom. */
function prepareGlimmerForDomScan(content: string): string {
  const markup = glimmerTemplateMarkup(content);
  return blankRanges(markup, [
    ...findTagRanges(markup, SCRIPT_TAG_REGEX),
    ...findTagRanges(markup, STYLE_TAG_REGEX),
  ]);
}

/**
 * Replaces characters in specified index ranges with spaces, preserving all newlines.
 */
export function blankRanges(
  content: string,
  ranges: readonly { start: number; end: number }[],
): string {
  if (ranges.length === 0) {
    return content;
  }

  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  let result = '';
  let lastIndex = 0;

  for (const { start, end } of sorted) {
    if (start > lastIndex) {
      result += content.slice(lastIndex, start);
    }
    const clampedStart = Math.max(lastIndex, start);
    if (end > clampedStart) {
      result += content.slice(clampedStart, end).replace(/[^\r\n]/g, ' ');
    }
    lastIndex = Math.max(lastIndex, end);
  }

  if (lastIndex < content.length) {
    result += content.slice(lastIndex);
  }

  return result;
}

/**
 * Preserves characters within [startOffset, endOffset) and replaces all characters
 * outside this range with spaces (preserving all \r and \n).
 */
export function blankOutsideRange(
  content: string,
  startOffset: number,
  endOffset: number,
): string {
  const ranges: { start: number; end: number }[] = [];
  if (startOffset > 0) {
    ranges.push({ start: 0, end: startOffset });
  }
  if (endOffset < content.length) {
    ranges.push({ start: endOffset, end: content.length });
  }
  return blankRanges(content, ranges);
}

/**
 * Extracts a map of lowercase attribute names to attribute values from a tag attribute string.
 */
function parseTagAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of attrString.matchAll(TAG_ATTR_REGEX)) {
    const name = match[1]?.toLowerCase();
    if (name) {
      attrs[name] = match[2] ?? match[3] ?? match[4] ?? '';
    }
  }
  return attrs;
}

/**
 * Determines virtual TypeScript/JavaScript path based on script tag attributes.
 */
function determineScriptVirtualPath(
  relPath: string,
  attrs: Record<string, string>,
  blockIndex = 0,
): string {
  const lang = attrs.lang?.toLowerCase();
  let ext = '.js';
  if (lang === 'ts' || lang === 'typescript') {
    ext = '.ts';
  } else if (lang === 'tsx') {
    ext = '.tsx';
  } else if (lang === 'jsx') {
    ext = '.jsx';
  } else if (relPath.endsWith('.ts') || relPath.endsWith('.mts')) {
    return blockIndex > 0 ? `${relPath}.block${blockIndex}.ts` : relPath;
  }
  return blockIndex > 0 ? `${relPath}.block${blockIndex}${ext}` : `${relPath}${ext}`;
}

/**
 * Determines whether a script tag should be skipped (e.g. template or empty external script).
 */
function shouldSkipScript(attrs: Record<string, string>, body: string): boolean {
  const type = attrs.type?.toLowerCase();
  return Boolean(
    (type && NON_JS_SCRIPT_TYPES.has(type)) || (attrs.src && body.trim().length === 0),
  );
}

/**
 * Extracts script blocks from HTML, Vue, Svelte, and Astro files as blanked virtual files.
 */
export function extractScriptBlocks(
  relPath: string,
  content: string,
): readonly ScriptBlock[] {
  if (isGlimmerPath(relPath)) {
    return [
      {
        virtualPath: `${relPath}${relPath.toLowerCase().endsWith('.gts') ? '.ts' : '.js'}`,
        blankedContent: blankGlimmerTemplates(content),
      },
    ];
  }

  const blocks: ScriptBlock[] = [];
  const lowerPath = relPath.toLowerCase();

  // Astro frontmatter fence (--- ... ---)
  if (lowerPath.endsWith('.astro')) {
    const fmMatch = ASTRO_FRONTMATTER_REGEX.exec(content);
    if (fmMatch && fmMatch[1]) {
      const firstNewline = content.indexOf('\n');
      const startOffset = firstNewline !== -1 ? firstNewline + 1 : 4;
      const endOffset = startOffset + fmMatch[1].length;
      if (endOffset > startOffset) {
        blocks.push({
          virtualPath: `${relPath}.ts`,
          blankedContent: blankOutsideRange(content, startOffset, endOffset),
        });
      }
    }
  }

  for (const match of content.matchAll(SCRIPT_TAG_REGEX)) {
    const attrStr = match[1] ?? '';
    const body = match[2] ?? '';
    const attrs = parseTagAttributes(attrStr);

    if (!shouldSkipScript(attrs, body) && body.trim().length > 0 && match.index !== undefined) {
      const openTagLen = match[0].indexOf('>') + 1;
      const startOffset = match.index + openTagLen;
      const endOffset = startOffset + body.length;
      const virtualPath = determineScriptVirtualPath(relPath, attrs, blocks.length);

      blocks.push({
        virtualPath,
        blankedContent: blankOutsideRange(content, startOffset, endOffset),
      });
    }
  }

  return blocks;
}

/**
 * Sanitizes template expressions (${...}) in Lit css template literals
 * by replacing non-newline characters with '_' to ensure CSS parseability.
 */
function sanitizeLitExpressions(rawSlice: string): string {
  let result = '';
  let i = 0;
  const len = rawSlice.length;

  while (i < len) {
    if (rawSlice[i] === '$' && rawSlice[i + 1] === '{') {
      result += '__';
      i += 2;
      let depth = 1;
      while (i < len && depth > 0) {
        const ch = rawSlice[i];
        if (ch === '{') {
          depth++;
        } else if (ch === '}') {
          depth--;
        }
        result += ch === '\n' || ch === '\r' ? ch : '_';
        i++;
      }
      continue;
    }
    result += rawSlice[i];
    i++;
  }

  return result;
}

/**
 * Extracts Lit css`...` tagged template literal blocks from JS/TS content.
 */
function extractLitCssBlocks(content: string): readonly string[] {
  const blocks: string[] = [];

  for (const match of content.matchAll(/\bcss\s*`/g)) {
    if (match.index === undefined) {
      continue;
    }
    const openQuote = match.index + match[0].indexOf('`');
    let i = openQuote + 1;
    let depth = 0;
    let closeQuote = -1;

    while (i < content.length) {
      const ch = content[i];
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '$' && content[i + 1] === '{') {
        depth++;
        i += 2;
        continue;
      }
      if (ch === '}' && depth > 0) {
        depth--;
        i++;
        continue;
      }
      if (ch === '`' && depth === 0) {
        closeQuote = i;
        break;
      }
      i++;
    }

    if (closeQuote !== -1) {
      const rawSlice = content.slice(openQuote + 1, closeQuote);
      if (rawSlice.trim().length > 0) {
        const sanitizedSlice = sanitizeLitExpressions(rawSlice);
        const reconstructed =
          content.slice(0, openQuote + 1) +
          sanitizedSlice +
          content.slice(closeQuote);
        blocks.push(blankOutsideRange(reconstructed, openQuote + 1, closeQuote));
      }
    }
  }

  return blocks;
}

export function isMarkupPath(relPath: string): boolean {
  const lowerPath = relPath.toLowerCase();
  return (
    lowerPath.endsWith('.html') ||
    lowerPath.endsWith('.htm') ||
    lowerPath.endsWith('.php') ||
    lowerPath.endsWith('.vue') ||
    lowerPath.endsWith('.svelte') ||
    lowerPath.endsWith('.astro') ||
    isGlimmerPath(lowerPath)
  );
}

/**
 * Extracts style blocks from HTML, Vue, Svelte, and Astro files,
 * or Lit css`...` tagged template literals from JS/TS files.
 */
export function extractStyleBlocks(relPath: string, content: string): readonly string[] {
  if (!isMarkupPath(relPath)) {
    return content.includes('css`') ? extractLitCssBlocks(content) : [];
  }

  const markup = isGlimmerPath(relPath) ? glimmerTemplateMarkup(content) : content;
  const blocks: string[] = [];
  for (const match of markup.matchAll(STYLE_TAG_REGEX)) {
    const body = match[2] ?? '';
    if (body.trim().length > 0 && match.index !== undefined) {
      const openTagLen = match[0].indexOf('>') + 1;
      const startOffset = match.index + openTagLen;
      const endOffset = startOffset + body.length;
      blocks.push(blankOutsideRange(markup, startOffset, endOffset));
    }
  }

  return blocks;
}

function findTagRanges(content: string, regex: RegExp): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  for (const match of content.matchAll(regex)) {
    if (match.index !== undefined) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  return ranges;
}

const VUE_TEMPLATE_TAG_REGEX = /<\/?template\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;

/**
 * Prepares HTML content for DOM scanning by blanking out non-DOM blocks (scripts, styles)
 * and blanking all <template> tags in Vue SFCs so inner DOM elements remain attached in linkedom.
 */
export function prepareHtmlForDomScan(relPath: string, content: string): string {
  if (isGlimmerPath(relPath)) {
    return prepareGlimmerForDomScan(content);
  }
  const lowerPath = relPath.toLowerCase();
  if (
    !lowerPath.endsWith('.vue') &&
    !lowerPath.endsWith('.svelte') &&
    !lowerPath.endsWith('.astro')
  ) {
    return content;
  }

  const rangesToBlank: { start: number; end: number }[] = [
    ...findTagRanges(content, SCRIPT_TAG_REGEX),
    ...findTagRanges(content, STYLE_TAG_REGEX),
  ];

  if (lowerPath.endsWith('.vue')) {
    rangesToBlank.push(...findTagRanges(content, VUE_TEMPLATE_TAG_REGEX));
  } else if (lowerPath.endsWith('.astro')) {
    const fmMatch = ASTRO_FRONTMATTER_REGEX.exec(content);
    if (fmMatch) {
      rangesToBlank.push({ start: 0, end: fmMatch[0].length });
    }
  }

  return blankRanges(content, rangesToBlank);
}
