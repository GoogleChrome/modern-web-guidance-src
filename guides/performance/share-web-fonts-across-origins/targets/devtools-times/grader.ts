import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
} from '../../../../test-fixture.ts';
import {
  CSSFontFaceRule,
  CSSGroupingRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

interface ParsedFontUrl {
  rawUrlCall: string;
  urlLocation: string;
  modifiers: Map<string, string>;
}

function parseFontUrls(src: string): ParsedFontUrl[] {
  const urls: ParsedFontUrl[] = [];
  let i = 0;
  while (i < src.length) {
    const urlIdx = src.indexOf('url(', i);
    if (urlIdx === -1) break;

    let depth = 0;
    let endIdx = -1;
    let inQuote: string | null = null;
    for (let j = urlIdx; j < src.length; j++) {
      const ch = src[j];
      if (inQuote) {
        if (ch === inQuote && src[j - 1] !== '\\') {
          inQuote = null;
        }
      } else if (ch === '"' || ch === "'") {
        inQuote = ch;
      } else if (ch === '(') {
        depth++;
      } else if (ch === ')') {
        depth--;
        if (depth === 0) {
          endIdx = j;
          break;
        }
      }
    }
    if (endIdx === -1) break;

    const rawUrlCall = src.slice(urlIdx, endIdx + 1);
    const inner = src.slice(urlIdx + 4, endIdx).trim();

    let urlLocation = '';
    let rest = '';
    if (inner.startsWith('"') || inner.startsWith("'")) {
      const quoteChar = inner[0];
      const closeQuote = inner.indexOf(quoteChar, 1);
      if (closeQuote !== -1) {
        urlLocation = inner.slice(1, closeQuote);
        rest = inner.slice(closeQuote + 1).trim();
      }
    } else {
      const firstSpace = inner.search(/\s/);
      if (firstSpace === -1) {
        urlLocation = inner;
        rest = '';
      } else {
        urlLocation = inner.slice(0, firstSpace);
        rest = inner.slice(firstSpace).trim();
      }
    }

    const modifiers = new Map<string, string>();
    const modifierRegex = /([a-zA-Z0-9_-]+)\s*\(([^)]*)\)/g;
    let match: RegExpExecArray | null;
    while ((match = modifierRegex.exec(rest)) !== null) {
      modifiers.set(match[1].toLowerCase(), match[2].trim());
    }

    urls.push({ rawUrlCall, urlLocation, modifiers });
    i = endIdx + 1;
  }
  return urls;
}

function findAllFontFaceRules(rules: Iterable<CSSRule>): CSSFontFaceRule[] {
  const result: CSSFontFaceRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSFontFaceRule) {
      result.push(rule);
    } else if (rule instanceof CSSGroupingRule) {
      result.push(...findAllFontFaceRules(Array.from(rule.cssRules)));
    }
  }
  return result;
}

test.describe('share-web-fonts-across-origins Target Grader', () => {

  // Requirement 1: An @font-face rule for a shared, popular web font uses the cross-origin-storage() request-url-modifier
  // alongside integrity() inside the src: url(...) descriptor, rather than a bare CDN URL.
  test('An @font-face rule uses cross-origin-storage() alongside integrity() inside the src url() descriptor', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const fontFaceRules = findAllFontFaceRules(Array.from(stylesheet.cssRules));

    const hasCosWithIntegrity = fontFaceRules.some(rule => {
      const urls = parseFontUrls(rule.style.getPropertyValue('src'));
      const cosIdx = urls.findIndex(u => u.modifiers.has('cross-origin-storage') && u.modifiers.has('integrity'));
      const plainIdx = urls.findIndex(u => !u.modifiers.has('cross-origin-storage'));
      return cosIdx !== -1 && (plainIdx === -1 || cosIdx < plainIdx);
    });

    expect(hasCosWithIntegrity).toBe(true);
  });

  // Requirement 2: cross-origin-storage() is called with no arguments for same-site-only sharing,
  // cross-origin-storage(*) for global availability, or a comma-separated list of origin strings matching the font's distribution scope.
  test('cross-origin-storage() specifies a valid sharing scope matching the font distribution scope', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const fontFaceRules = findAllFontFaceRules(Array.from(stylesheet.cssRules));
    const allUrls = fontFaceRules.flatMap(r => parseFontUrls(r.style.getPropertyValue('src')));
    const cosUrls = allUrls.filter(u => u.modifiers.has('cross-origin-storage'));

    const hasValidScope = cosUrls.length > 0 && cosUrls.every(u => {
      const rawArg = u.modifiers.get('cross-origin-storage') || '';
      const arg = rawArg.replace(/^['"]|['"]$/g, '').trim();
      if (arg === '' || arg === '*') return true;
      const origins = rawArg.split(',').map(o => o.trim().replace(/^['"]|['"]$/g, ''));
      return origins.length > 0 && origins.every(o => o === '*' || /^https?:\/\//i.test(o));
    });

    expect(hasValidScope).toBe(true);
  });

  // Requirement 3: cross-origin-storage() never appears without integrity() on the same url(),
  // since the integrity hash is what identifies the font file in the shared cache.
  test('cross-origin-storage() never appears without integrity() on the same url()', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const fontFaceRules = findAllFontFaceRules(Array.from(stylesheet.cssRules));
    const allUrls = fontFaceRules.flatMap(r => parseFontUrls(r.style.getPropertyValue('src')));
    const cosUrls = allUrls.filter(u => u.modifiers.has('cross-origin-storage'));

    const allCosHaveIntegrity = cosUrls.length > 0 && cosUrls.every(u => {
      const integrity = u.modifiers.get('integrity');
      if (!integrity) return false;
      const hash = integrity.replace(/^['"]|['"]$/g, '').trim();
      return hash.length > 0 && /^sha(256|384|512)-/i.test(hash);
    });

    expect(allCosHaveIntegrity).toBe(true);
  });

  // Requirement 4: The url() still points at the font's real, working network location,
  // since a cache lookup that doesn't succeed falls back to fetching from that URL.
  test('The url() still points at the font real, working network location', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const fontFaceRules = findAllFontFaceRules(Array.from(stylesheet.cssRules));
    const allUrls = fontFaceRules.flatMap(r => parseFontUrls(r.style.getPropertyValue('src')));
    const cosUrls = allUrls.filter(u => u.modifiers.has('cross-origin-storage'));

    const allCosPointToNetworkLocation = cosUrls.length > 0 && cosUrls.every(u => {
      const loc = u.urlLocation.trim();
      return /^https?:\/\//i.test(loc) || /\.(woff2?|ttf|otf|eot)(\?.*)?$/i.test(loc);
    });

    expect(allCosPointToNetworkLocation).toBe(true);
  });

  // Requirement 5: cross-origin-storage() is not confused with the unrelated CSS cross-origin() modifier,
  // which controls CORS request mode rather than shared-cache participation.
  test('cross-origin-storage() is not confused with the unrelated CSS cross-origin() modifier', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const fontFaceRules = findAllFontFaceRules(Array.from(stylesheet.cssRules));
    const allUrls = fontFaceRules.flatMap(r => parseFontUrls(r.style.getPropertyValue('src')));
    const cosUrls = allUrls.filter(u => u.modifiers.has('cross-origin-storage'));
    const hasCrossOriginConfusion = allUrls.some(u => u.modifiers.has('cross-origin'));

    const isValidAndNotConfused = cosUrls.length > 0 && !hasCrossOriginConfusion;

    expect(isValidAndNotConfused).toBe(true);
  });

});
