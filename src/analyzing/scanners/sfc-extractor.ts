import { SyntaxKind, ts } from 'ts-morph';

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

const SCRIPT_TAG_REGEX = /<script(?=[\s/>])([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const STYLE_TAG_REGEX = /<style(?=[\s/>])([^>]*)>([\s\S]*?)<\/style\s*>/gi;
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
}

// After these tokens a `/` is division; after any other token it starts a regex literal.
const VALUE_END_TOKENS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.Identifier,
  SyntaxKind.PrivateIdentifier,
  SyntaxKind.NumericLiteral,
  SyntaxKind.BigIntLiteral,
  SyntaxKind.StringLiteral,
  SyntaxKind.NoSubstitutionTemplateLiteral,
  SyntaxKind.TemplateTail,
  SyntaxKind.RegularExpressionLiteral,
  SyntaxKind.CloseParenToken,
  SyntaxKind.CloseBracketToken,
  SyntaxKind.PlusPlusToken,
  SyntaxKind.MinusMinusToken,
  SyntaxKind.ThisKeyword,
  SyntaxKind.SuperKeyword,
  SyntaxKind.NullKeyword,
  SyntaxKind.TrueKeyword,
  SyntaxKind.FalseKeyword,
]);

/**
 * Finds the `<template>…</template>` blocks of a .gts/.gjs file. The TypeScript scanner
 * skips strings, comments, template literals and regex literals. Like content-tag, a block
 * opens on exactly `<template>` and ends at the first `</template>`.
 */
function findGlimmerTemplateRanges(content: string): readonly GlimmerTemplateRange[] {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, content);
  const ranges: GlimmerTemplateRange[] = [];
  // One entry per open `{`: true when it is the `${` of a template literal.
  const braceStack: boolean[] = [];
  let previous = SyntaxKind.Unknown;
  for (let token = scanner.scan(); token !== SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    const start = scanner.getTokenStart();
    if (token === SyntaxKind.LessThanToken && content.startsWith('<template>', start)) {
      const innerStart = start + '<template>'.length;
      const innerEnd = content.indexOf('</template>', innerStart);
      if (innerEnd === -1) {
        break;
      }
      const end = innerEnd + '</template>'.length;
      ranges.push({ start, end, innerStart, innerEnd });
      scanner.resetTokenState(end);
      previous = SyntaxKind.CloseBracketToken;
      continue;
    }
    if (
      (token === SyntaxKind.SlashToken || token === SyntaxKind.SlashEqualsToken) &&
      !VALUE_END_TOKENS.has(previous)
    ) {
      token = scanner.reScanSlashToken();
    } else if (token === SyntaxKind.OpenBraceToken || token === SyntaxKind.TemplateHead) {
      braceStack.push(token === SyntaxKind.TemplateHead);
    } else if (token === SyntaxKind.CloseBraceToken && braceStack.pop() === true) {
      token = scanner.reScanTemplateToken(false);
      if (token === SyntaxKind.TemplateMiddle) {
        braceStack.push(true);
      }
    }
    previous = token;
  }
  return ranges;
}

/**
 * Replaces each Glimmer template with a same-length `[`…`]`, as ember-template-imports v3 did.
 * The brackets are valid both as a class member (a computed key) and as an expression
 * (an array literal), so the code around the template still parses.
 */
function blankGlimmerTemplates(content: string): string {
  let result = '';
  let lastIndex = 0;
  for (const { start, end } of findGlimmerTemplateRanges(content)) {
    const blanked = content.slice(start, end).replace(/[^\r\n]/g, ' ');
    result += `${content.slice(lastIndex, start)}[\`${blanked.slice(2, -2)}\`]`;
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
function prepareGlimmerForDomScan(relPath: string, content: string): string {
  const markup = glimmerTemplateMarkup(content);
  const uncommented = blankHtmlComments(relPath, markup);
  return blankRanges(markup, [
    ...findTagRanges(uncommented, SCRIPT_TAG_REGEX),
    ...findTagRanges(uncommented, STYLE_TAG_REGEX),
  ]);
}

interface MaskedRange {
  readonly start: number;
  readonly end: number;
  readonly fillChar?: string;
}

function maskRanges(content: string, ranges: readonly MaskedRange[]): string {
  if (ranges.length === 0) {
    return content;
  }

  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  let result = '';
  let lastIndex = 0;

  for (const { start, end, fillChar = ' ' } of sorted) {
    if (start > lastIndex) {
      result += content.slice(lastIndex, start);
    }
    const clampedStart = Math.max(lastIndex, start);
    if (end > clampedStart) {
      result += content.slice(clampedStart, end).replace(/[^\r\n]/g, fillChar);
    }
    lastIndex = Math.max(lastIndex, end);
  }

  if (lastIndex < content.length) {
    result += content.slice(lastIndex);
  }

  return result;
}

// Elements whose content the HTML tokenizer reads as text up to the matching end tag (RCDATA,
// RAWTEXT and script data). `noscript` is left out: its content is only text while scripting
// is enabled, i.e. when it is not rendered; where it renders, its comments are comments.
const RAW_TEXT_END_TAG_REGEXES: ReadonlyMap<string, RegExp> = new Map(
  ['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes'].map((name) => [
    name,
    new RegExp(`</${name}[\\t\\n\\f\\r />]`, 'gi'),
  ]),
);
const TAG_NAME_REGEX = /[a-zA-Z][^\t\n\f\r />]*/y;
const COMMENT_END_REGEX = /--!?>/g;

/** HTML ASCII whitespace: tab, LF, FF, CR and space. */
function isHtmlSpace(ch: string | undefined): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f';
}

/** Index just past the `>` that closes a tag, skipping quoted attribute values. */
function findTagEnd(markup: string, index: number): number {
  let i = index;
  while (i < markup.length) {
    const ch = markup[i];
    if (ch === '>') {
      return i + 1;
    }
    i++;
    if (ch === '=') {
      while (isHtmlSpace(markup[i])) {
        i++;
      }
      const quote = markup[i];
      if (quote === '"' || quote === "'") {
        const close = markup.indexOf(quote, i + 1);
        if (close === -1) {
          return markup.length;
        }
        i = close + 1;
      }
    }
  }
  return markup.length;
}

/** Index just past a comment whose `<!--` ends at `bodyStart`, or the end of the markup. */
function findCommentEnd(markup: string, bodyStart: number): number {
  // `<!-->` and `<!--->` are complete (abruptly closed) empty comments.
  if (markup[bodyStart] === '>') {
    return bodyStart + 1;
  }
  if (markup.startsWith('->', bodyStart)) {
    return bodyStart + 2;
  }
  COMMENT_END_REGEX.lastIndex = bodyStart;
  const match = COMMENT_END_REGEX.exec(markup);
  return match ? match.index + match[0].length : markup.length;
}

/**
 * Index just past a `<!…>` or `<?…>` that is not a comment. A bogus comment or DOCTYPE ends at
 * the next `>`, a CDATA section (SVG/MathML) at `]]>`, and PHP code or an XML declaration at
 * `?>`. Unterminated, it runs to the end: that can leave later comments in place, never hide
 * live code.
 */
function findDeclarationEnd(markup: string, lt: number): number {
  let terminator = '>';
  if (markup.startsWith('<![CDATA[', lt)) {
    // Outside SVG/MathML this is a bogus comment ending at `>`; `]]>` is deliberately conservative.
    terminator = ']]>';
  } else if (markup[lt + 1] === '?') {
    terminator = '?>';
  }
  const close = markup.indexOf(terminator, lt + 2);
  return close === -1 ? markup.length : close + terminator.length;
}

/**
 * Finds the `<!-- … -->` comments of HTML-like markup from `fromIndex` on, in one linear,
 * in-order pass that follows the HTML tokenizer closely enough not to mistake live code for
 * a comment: `<!--` inside a quoted attribute value or the text of a raw text element (e.g. a
 * legacy `<script><!-- … //--></script>` wrapper) does not open one, and a comment ends at
 * the first `-->` (so downlevel-revealed `<!--[if !IE]><!-->…<!--<![endif]-->` leaves its
 * content live). An unterminated comment runs to the end, as in the tokenizer. Other `<!…>`
 * and `<?…?>` constructs (DOCTYPE, CDATA, PHP code) are skipped whole.
 */
function findHtmlCommentRanges(markup: string, fromIndex = 0): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  let i = fromIndex;
  while (i < markup.length) {
    const lt = markup.indexOf('<', i);
    if (lt === -1) {
      break;
    }
    if (markup.startsWith('<!--', lt)) {
      i = findCommentEnd(markup, lt + 4);
      ranges.push({ start: lt, end: i });
      continue;
    }
    if (markup[lt + 1] === '!' || markup[lt + 1] === '?') {
      i = findDeclarationEnd(markup, lt);
      continue;
    }
    const isEndTag = markup[lt + 1] === '/';
    TAG_NAME_REGEX.lastIndex = isEndTag ? lt + 2 : lt + 1;
    const tagName = TAG_NAME_REGEX.exec(markup)?.[0];
    if (!tagName) {
      // Not a tag (`a < b`): plain text.
      i = lt + 1;
      continue;
    }
    i = findTagEnd(markup, TAG_NAME_REGEX.lastIndex);
    const rawTextEnd = isEndTag ? undefined : RAW_TEXT_END_TAG_REGEXES.get(tagName.toLowerCase());
    if (rawTextEnd) {
      rawTextEnd.lastIndex = i;
      i = rawTextEnd.exec(markup)?.index ?? markup.length;
    }
  }
  return ranges;
}

/**
 * Markup of a file with its HTML comments blanked (offsets and newlines preserved), so that
 * commented-out `<script>`/`<style>` blocks are not extracted. Astro frontmatter is not markup
 * and is left as is.
 */
function blankHtmlComments(relPath: string, markup: string): string {
  const frontmatterEnd = relPath.toLowerCase().endsWith('.astro')
    ? (ASTRO_FRONTMATTER_REGEX.exec(markup)?.[0].length ?? 0)
    : 0;
  return blankRanges(markup, findHtmlCommentRanges(markup, frontmatterEnd));
}

/**
 * Replaces characters in specified index ranges with spaces, preserving all newlines.
 */
export function blankRanges(
  content: string,
  ranges: readonly { start: number; end: number }[],
): string {
  return maskRanges(content, ranges);
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

  const markup = blankHtmlComments(relPath, content);
  for (const match of markup.matchAll(SCRIPT_TAG_REGEX)) {
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
        blankedContent: blankOutsideRange(markup, startOffset, endOffset),
      });
    }
  }

  return blocks;
}

function scriptKindForPath(relPath: string): ts.ScriptKind {
  const lower = relPath.toLowerCase();
  if (lower.endsWith('.tsx')) {
    return ts.ScriptKind.TSX;
  }
  if (lower.endsWith('.jsx') || lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
    return ts.ScriptKind.JSX;
  }
  if (lower.endsWith('.ts') || lower.endsWith('.mts') || lower.endsWith('.cts')) {
    return ts.ScriptKind.TS;
  }
  return ts.ScriptKind.TSX;
}

function maskLitCssTemplate(
  content: string,
  sourceFile: ts.SourceFile,
  template: ts.TemplateLiteral,
  innerStart: number,
  innerEnd: number,
): string {
  const ranges: MaskedRange[] = [];
  if (innerStart > 0) {
    ranges.push({ start: 0, end: innerStart });
  }
  if (ts.isTemplateExpression(template)) {
    let exprStart = template.head.getEnd() - 2;
    for (const span of template.templateSpans) {
      // span.literal starts at the closing `}` of `${...}`
      const exprEnd = span.literal.getStart(sourceFile) + 1;
      if (exprEnd > exprStart && exprStart >= innerStart && exprEnd <= innerEnd) {
        ranges.push({ start: exprStart, end: exprEnd, fillChar: '_' });
      }
      exprStart = span.literal.getEnd() - 2;
    }
  }
  if (innerEnd < content.length) {
    ranges.push({ start: innerEnd, end: content.length });
  }
  return maskRanges(content, ranges);
}

/**
 * Extracts Lit css`...` tagged template literal blocks from JS/TS content using the TypeScript AST,
 * ignoring comments, strings, and untagged template literals while preserving source offsets.
 */
function extractLitCssBlocks(relPath: string, content: string): readonly string[] {
  const sourceFile = ts.createSourceFile(
    relPath,
    content,
    ts.ScriptTarget.Latest,
    false,
    scriptKindForPath(relPath),
  );
  const blocks: string[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isTaggedTemplateExpression(node) &&
      ts.isIdentifier(node.tag) &&
      node.tag.text === 'css'
    ) {
      const { template } = node;
      const openQuote = template.getStart(sourceFile);
      const templateEnd = template.getEnd();
      if (
        content[openQuote] === '`' &&
        templateEnd > openQuote + 1 &&
        content[templateEnd - 1] === '`'
      ) {
        const innerStart = openQuote + 1;
        const innerEnd = templateEnd - 1;
        if (content.slice(innerStart, innerEnd).trim().length > 0) {
          blocks.push(maskLitCssTemplate(content, sourceFile, template, innerStart, innerEnd));
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
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

const PREPROCESSOR_STYLE_LANGS: ReadonlySet<string> = new Set(['scss', 'less']);

function scanQuotedStringEnd(content: string, quoteIndex: number, limit: number): number {
  const quote = content[quoteIndex];
  let i = quoteIndex + 1;
  while (i < limit) {
    const ch = content[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) {
      return i + 1;
    }
    if (ch === '\n' || ch === '\r') {
      return i;
    }
    i++;
  }
  return limit;
}

function scanUrlFunctionEnd(content: string, urlStart: number, limit: number): number | null {
  let j = urlStart + 4;
  while (j < limit) {
    const ch = content[j];
    if (ch === '"' || ch === "'") {
      j = scanQuotedStringEnd(content, j, limit);
      continue;
    }
    if (ch === '\\') {
      j += 2;
      continue;
    }
    if (ch === ')') {
      return j + 1;
    }
    if (ch === ';' || ch === '{' || ch === '}') {
      return null;
    }
    j++;
  }
  return null;
}

/**
 * Replaces `//` single-line comments inside [startOffset, endOffset) with spaces while
 * preserving line/column offsets. Leaves `/* ... *\/` block comments, quoted strings,
 * `url(...)` bodies, and `scheme://\S` URLs untouched.
 */
export function blankPreprocessorLineComments(
  content: string,
  startOffset = 0,
  endOffset = content.length,
): string {
  const start = Math.max(0, startOffset);
  const end = Math.min(content.length, endOffset);
  if (end <= start) {
    return content;
  }

  const commentRanges: { start: number; end: number }[] = [];
  let i = start;
  while (i < end) {
    const ch = content[i];
    const next = content[i + 1];
    if (ch === '/' && next === '*') {
      const close = content.indexOf('*/', i + 2);
      i = close === -1 ? end : Math.min(end, close + 2);
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      i = scanQuotedStringEnd(content, i, end);
      continue;
    }
    if (
      (ch === 'u' || ch === 'U') &&
      content.slice(i, i + 4).toLowerCase() === 'url(' &&
      (i === start || !/[a-zA-Z0-9_-]/.test(content[i - 1] ?? ''))
    ) {
      const urlEnd = scanUrlFunctionEnd(content, i, end);
      if (urlEnd !== null) {
        i = urlEnd;
        continue;
      }
      i += 4;
      continue;
    }
    if (ch === '/' && next === '/') {
      const prefix = content.slice(Math.max(start, i - 32), i);
      const after = content[i + 2] ?? '';
      const isSchemeUrl =
        content[i - 1] === ':' &&
        /(?:^|[^a-zA-Z0-9_.-])[a-zA-Z][a-zA-Z0-9+.-]*:$/.test(prefix) &&
        after !== '' &&
        !/\s/.test(after);
      if (!isSchemeUrl) {
        let lineEnd = i + 2;
        while (lineEnd < end && content[lineEnd] !== '\n' && content[lineEnd] !== '\r') {
          lineEnd++;
        }
        commentRanges.push({ start: i, end: lineEnd });
        i = lineEnd;
        continue;
      }
    }
    i++;
  }

  return blankRanges(content, commentRanges);
}

/**
 * Extracts style blocks from HTML, Vue, Svelte, and Astro files,
 * or Lit css`...` tagged template literals from JS/TS files.
 */
export function extractStyleBlocks(relPath: string, content: string): readonly string[] {
  if (!isMarkupPath(relPath)) {
    return /\bcss\b/.test(content) && content.includes('`')
      ? extractLitCssBlocks(relPath, content)
      : [];
  }

  const markup = blankHtmlComments(
    relPath,
    isGlimmerPath(relPath) ? glimmerTemplateMarkup(content) : content,
  );
  const blocks: string[] = [];
  for (const match of markup.matchAll(STYLE_TAG_REGEX)) {
    const attrStr = match[1] ?? '';
    const body = match[2] ?? '';
    if (body.trim().length > 0 && match.index !== undefined) {
      const openTagLen = match[0].indexOf('>') + 1;
      const startOffset = match.index + openTagLen;
      const endOffset = startOffset + body.length;
      const blanked = blankOutsideRange(markup, startOffset, endOffset);
      const lang = parseTagAttributes(attrStr).lang?.toLowerCase();
      blocks.push(
        lang !== undefined && PREPROCESSOR_STYLE_LANGS.has(lang)
          ? blankPreprocessorLineComments(blanked, startOffset, endOffset)
          : blanked,
      );
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
    return prepareGlimmerForDomScan(relPath, content);
  }
  const lowerPath = relPath.toLowerCase();
  if (
    !lowerPath.endsWith('.vue') &&
    !lowerPath.endsWith('.svelte') &&
    !lowerPath.endsWith('.astro')
  ) {
    return content;
  }

  // Blocks are found outside comments, but the comments stay: linkedom skips them itself.
  const uncommented = blankHtmlComments(relPath, content);
  const rangesToBlank: { start: number; end: number }[] = [
    ...findTagRanges(uncommented, SCRIPT_TAG_REGEX),
    ...findTagRanges(uncommented, STYLE_TAG_REGEX),
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
