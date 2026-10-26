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

/**
 * Replaces non-newline characters in a string with spaces, preserving all \r and \n.
 */
function blankSlicePreservingNewlines(slice: string): string {
  let result = '';
  for (let i = 0; i < slice.length; i++) {
    const ch = slice[i];
    result += ch === '\n' || ch === '\r' ? ch : ' ';
  }
  return result;
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
      result += blankSlicePreservingNewlines(content.slice(clampedStart, end));
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
  const attrRegex = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match = attrRegex.exec(attrString);

  while (match !== null) {
    const name = match[1]?.toLowerCase();
    if (name) {
      const value = match[2] ?? match[3] ?? match[4] ?? '';
      attrs[name] = value;
    }
    match = attrRegex.exec(attrString);
  }

  return attrs;
}

/**
 * Determines virtual TypeScript/JavaScript path based on script tag attributes.
 */
function determineScriptVirtualPath(relPath: string, attrs: Record<string, string>): string {
  const lang = attrs.lang?.toLowerCase();
  if (lang === 'ts' || lang === 'typescript') {
    return `${relPath}.ts`;
  }
  if (lang === 'tsx') {
    return `${relPath}.tsx`;
  }
  if (lang === 'jsx') {
    return `${relPath}.jsx`;
  }
  if (relPath.endsWith('.ts') || relPath.endsWith('.mts')) {
    return relPath;
  }
  return `${relPath}.js`;
}

/**
 * Determines whether a script tag should be skipped (e.g. template or empty external script).
 */
function shouldSkipScript(attrs: Record<string, string>, body: string): boolean {
  const type = attrs.type?.toLowerCase();
  if (type && NON_JS_SCRIPT_TYPES.has(type)) {
    return true;
  }
  if (attrs.src && body.trim().length === 0) {
    return true;
  }
  return false;
}

/**
 * Extracts script blocks from HTML, Vue, Svelte, and Astro files as blanked virtual files.
 */
export function extractScriptBlocks(
  relPath: string,
  content: string,
): readonly ScriptBlock[] {
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

  // <script> tags
  SCRIPT_TAG_REGEX.lastIndex = 0;
  let match = SCRIPT_TAG_REGEX.exec(content);

  while (match !== null) {
    const attrStr = match[1] ?? '';
    const body = match[2] ?? '';
    const attrs = parseTagAttributes(attrStr);

    if (!shouldSkipScript(attrs, body) && body.trim().length > 0) {
      const openTagLen = match[0].indexOf('>') + 1;
      const startOffset = match.index + openTagLen;
      const endOffset = startOffset + body.length;
      const virtualPath = determineScriptVirtualPath(relPath, attrs);

      blocks.push({
        virtualPath,
        blankedContent: blankOutsideRange(content, startOffset, endOffset),
      });
    }

    match = SCRIPT_TAG_REGEX.exec(content);
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
          result += '_';
        } else if (ch === '}') {
          depth--;
          result += '_';
        } else if (ch === '\n' || ch === '\r') {
          result += ch;
        } else {
          result += '_';
        }
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
  const litRegex = /\bcss\s*`/g;
  let match = litRegex.exec(content);

  while (match !== null) {
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

    match = litRegex.exec(content);
  }

  return blocks;
}

/**
 * Extracts style blocks from HTML, Vue, Svelte, and Astro files,
 * or Lit css`...` tagged template literals from JS/TS files.
 */
export function extractStyleBlocks(relPath: string, content: string): readonly string[] {
  const lowerPath = relPath.toLowerCase();
  const isMarkup =
    lowerPath.endsWith('.html') ||
    lowerPath.endsWith('.htm') ||
    lowerPath.endsWith('.php') ||
    lowerPath.endsWith('.vue') ||
    lowerPath.endsWith('.svelte') ||
    lowerPath.endsWith('.astro');

  if (!isMarkup) {
    // Check for Lit css`...` tagged template literals
    if (content.includes('css`')) {
      return extractLitCssBlocks(content);
    }
    return [];
  }

  const blocks: string[] = [];
  STYLE_TAG_REGEX.lastIndex = 0;
  let match = STYLE_TAG_REGEX.exec(content);

  while (match !== null) {
    const body = match[2] ?? '';
    if (body.trim().length > 0) {
      const openTagLen = match[0].indexOf('>') + 1;
      const startOffset = match.index + openTagLen;
      const endOffset = startOffset + body.length;
      blocks.push(blankOutsideRange(content, startOffset, endOffset));
    }
    match = STYLE_TAG_REGEX.exec(content);
  }

  return blocks;
}

/**
 * Finds index ranges for all <script> and <style> tags in markup.
 */
function findTagRanges(content: string, regex: RegExp): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  regex.lastIndex = 0;
  let match = regex.exec(content);
  while (match !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
    match = regex.exec(content);
  }
  return ranges;
}

/**
 * Finds opening and closing tag ranges for the top-level <template> block in a Vue SFC.
 */
function findTopLevelVueTemplateTagRanges(content: string): { start: number; end: number }[] {
  const match = /<template\b[^>]*>/i.exec(content);
  if (!match) {
    return [];
  }

  const openStart = match.index;
  const openEnd = match.index + match[0].length;

  let depth = 1;
  const tagRegex = /<\/?template\b[^>]*>/gi;
  tagRegex.lastIndex = openEnd;
  let closeStart = -1;
  let closeEnd = -1;
  let tagMatch = tagRegex.exec(content);

  while (tagMatch !== null) {
    if (tagMatch[0].startsWith('</')) {
      depth--;
      if (depth === 0) {
        closeStart = tagMatch.index;
        closeEnd = tagMatch.index + tagMatch[0].length;
        break;
      }
    } else if (!tagMatch[0].endsWith('/>')) {
      depth++;
    }
    tagMatch = tagRegex.exec(content);
  }

  const ranges = [{ start: openStart, end: openEnd }];
  if (closeStart !== -1) {
    ranges.push({ start: closeStart, end: closeEnd });
  }
  return ranges;
}

/**
 * Prepares HTML content for DOM scanning by blanking out non-DOM blocks (scripts, styles)
 * and unwrapping the top-level <template> in Vue SFCs so DOM elements can be traversed by linkedom.
 */
export function prepareHtmlForDomScan(relPath: string, content: string): string {
  const lowerPath = relPath.toLowerCase();

  if (lowerPath.endsWith('.vue')) {
    const rangesToBlank: { start: number; end: number }[] = [
      ...findTagRanges(content, SCRIPT_TAG_REGEX),
      ...findTagRanges(content, STYLE_TAG_REGEX),
      ...findTopLevelVueTemplateTagRanges(content),
    ];
    return blankRanges(content, rangesToBlank);
  }

  if (lowerPath.endsWith('.svelte')) {
    const rangesToBlank: { start: number; end: number }[] = [
      ...findTagRanges(content, SCRIPT_TAG_REGEX),
      ...findTagRanges(content, STYLE_TAG_REGEX),
    ];
    return blankRanges(content, rangesToBlank);
  }

  if (lowerPath.endsWith('.astro')) {
    const rangesToBlank: { start: number; end: number }[] = [
      ...findTagRanges(content, SCRIPT_TAG_REGEX),
      ...findTagRanges(content, STYLE_TAG_REGEX),
    ];
    const fmMatch = ASTRO_FRONTMATTER_REGEX.exec(content);
    if (fmMatch) {
      rangesToBlank.push({ start: 0, end: fmMatch[0].length });
    }
    return blankRanges(content, rangesToBlank);
  }

  return content;
}
