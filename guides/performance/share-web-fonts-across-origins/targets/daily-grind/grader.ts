import { pathToFileURL } from 'node:url';
import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
} from '../../../../test-fixture.ts';
import { CSSFontFaceRule, CSSRule } from 'cssomnom';

function getCallerFileUrl(): string {
  try {
    return (new Function('return import.meta.url'))() as string;
  } catch {
    return typeof __filename !== 'undefined'
      ? pathToFileURL(__filename).toString()
      : pathToFileURL(process.cwd() + '/grader.ts').toString();
  }
}

const targetFiles: string[] = getTargetFiles(getCallerFileUrl());

interface ParsedUrlModifier {
  urlValue: string | null;
  hasIntegrity: boolean;
  integrityHash: string | null;
  hasCos: boolean;
  cosArgs: any[];
  hasCrossOrigin: boolean;
}

interface ParsedFontFace {
  rule: CSSFontFaceRule;
  fontFamily: string;
  urls: ParsedUrlModifier[];
}

function extractFontFaceRules(rules: CSSRule[]): CSSFontFaceRule[] {
  const result: CSSFontFaceRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSFontFaceRule) {
      result.push(rule);
    } else if ('cssRules' in rule && (rule as any).cssRules) {
      result.push(...extractFontFaceRules(Array.from((rule as any).cssRules)));
    }
  }
  return result;
}

function parseUrlTokens(urlToken: any): ParsedUrlModifier {
  const innerTokens: any[] = urlToken.value || [];
  const stringToken = innerTokens.find(
    (t: any) => t.type === 'string' || t.type === 'url' || t.type === 'ident'
  );
  const urlValue = stringToken ? String(stringToken.value) : null;

  const integrityToken = innerTokens.find(
    (t: any) => t.type === 'function' && t.name === 'integrity'
  );
  let integrityHash: string | null = null;
  if (integrityToken && Array.isArray(integrityToken.value)) {
    const hashToken = integrityToken.value.find(
      (t: any) => t.type === 'string' || t.type === 'ident'
    );
    if (hashToken) {
      integrityHash = String(hashToken.value);
    }
  }

  const cosToken = innerTokens.find(
    (t: any) => t.type === 'function' && t.name === 'cross-origin-storage'
  );
  const cosArgs = cosToken && Array.isArray(cosToken.value) ? cosToken.value : [];

  const crossOriginToken = innerTokens.find(
    (t: any) => t.type === 'function' && t.name === 'cross-origin'
  );

  return {
    urlValue,
    hasIntegrity: Boolean(integrityToken),
    integrityHash,
    hasCos: Boolean(cosToken),
    cosArgs,
    hasCrossOrigin: Boolean(crossOriginToken),
  };
}

function parseFontFaceRule(rule: CSSFontFaceRule): ParsedFontFace {
  const fontFamily = rule.style.getPropertyValue('font-family').replace(/^['"]|['"]$/g, '');
  const srcDecl = (rule.style as any)._declarations?.find((d: any) => d.name === 'src');
  if (!srcDecl || !Array.isArray(srcDecl.value)) {
    return { rule, fontFamily, urls: [] };
  }

  const urlTokens = srcDecl.value.filter(
    (t: any) => t.type === 'function' && t.name === 'url'
  );
  const urls = urlTokens.map(parseUrlTokens);
  return { rule, fontFamily, urls };
}

function getParsedFontFaces(): ParsedFontFace[] {
  const stylesheet = getCssStyleSheet(targetFiles);
  const rules = extractFontFaceRules(Array.from(stylesheet.cssRules));
  return rules.map(parseFontFaceRule);
}

function isValidCosScope(args: any[]): boolean {
  const meaningfulTokens = args.filter(
    (t: any) => t.type !== 'whitespace' && t.type !== 'comment'
  );

  // Case 1: no arguments (same-site-only sharing)
  if (meaningfulTokens.length === 0) {
    return true;
  }

  // Case 2: global availability (*)
  if (
    meaningfulTokens.length === 1 &&
    (meaningfulTokens[0].value === '*' || meaningfulTokens[0].originalText?.trim() === '*')
  ) {
    return true;
  }

  // Case 3: comma-separated list of origin strings
  const contentTokens = meaningfulTokens.filter((t: any) => t.type !== 'comma');
  if (contentTokens.length === 0) {
    return false;
  }

  return contentTokens.every((t: any) => {
    if (t.type === 'string' && typeof t.value === 'string') {
      const val = t.value.trim();
      return /^(https?:\/\/|\/|\*)/.test(val);
    }
    return false;
  });
}

test.describe('share-web-fonts-across-origins Target Grader', () => {
  test('An @font-face rule uses cross-origin-storage() alongside integrity() inside src: url(...)', () => {
    const fontFaces = getParsedFontFaces();
    const hasCosWithIntegrity = fontFaces.some((ff) =>
      ff.urls.some((u) => u.hasCos && u.hasIntegrity)
    );
    expect(hasCosWithIntegrity).toBe(true);
  });

  test('cross-origin-storage() is called with a valid sharing scope matching the distribution scope', () => {
    const fontFaces = getParsedFontFaces();
    const cosUrls = fontFaces.flatMap((ff) => ff.urls).filter((u) => u.hasCos);
    const hasValidScope = cosUrls.length > 0 && cosUrls.every((u) => isValidCosScope(u.cosArgs));
    expect(hasValidScope).toBe(true);
  });

  test('cross-origin-storage() never appears without integrity() on the same url()', () => {
    const fontFaces = getParsedFontFaces();
    const cosUrls = fontFaces.flatMap((ff) => ff.urls).filter((u) => u.hasCos);
    const allCosHaveIntegrity =
      cosUrls.length > 0 && cosUrls.every((u) => u.hasIntegrity && Boolean(u.integrityHash));
    expect(allCosHaveIntegrity).toBe(true);
  });

  test('The url() points at a real, working network location for the font resource', () => {
    const fontFaces = getParsedFontFaces();
    const cosUrls = fontFaces.flatMap((ff) => ff.urls).filter((u) => u.hasCos);
    const allPointToNetworkLocation =
      cosUrls.length > 0 &&
      cosUrls.every((u) => {
        if (!u.urlValue || typeof u.urlValue !== 'string') return false;
        const trimmed = u.urlValue.trim();
        return (
          (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('/')) &&
          !trimmed.startsWith('data:') &&
          trimmed.length > 10
        );
      });
    expect(allPointToNetworkLocation).toBe(true);
  });

  test('cross-origin-storage() is used and not confused with the cross-origin() modifier', () => {
    const fontFaces = getParsedFontFaces();
    const cosUrls = fontFaces.flatMap((ff) => ff.urls).filter((u) => u.hasCos);
    const crossOriginUrls = fontFaces.flatMap((ff) => ff.urls).filter((u) => u.hasCrossOrigin);
    const usesCosWithoutConfusion = cosUrls.length > 0 && crossOriginUrls.length === 0;
    expect(usesCosWithoutConfusion).toBe(true);
  });

  test('The @font-face src descriptor lists the cross-origin-storage source before a fallback url()', () => {
    const fontFaces = getParsedFontFaces();
    const cosFontFaces = fontFaces.filter((ff) => ff.urls.some((u) => u.hasCos));
    const hasProperFallbackOrdering =
      cosFontFaces.length > 0 &&
      cosFontFaces.every((ff) => {
        const firstCosIndex = ff.urls.findIndex((u) => u.hasCos);
        const fallbackIndex = ff.urls.findIndex((u, idx) => idx > firstCosIndex && !u.hasCos);
        return firstCosIndex >= 0 && fallbackIndex > firstCosIndex;
      });
    expect(hasProperFallbackOrdering).toBe(true);
  });
});
