import assert from 'node:assert/strict';
import test from 'node:test';
import { scanFiles } from '../../scanners/index.ts';
import { matchJsRuleWithFastTokens as matchJsRule } from '../../scanners/js-scanner.ts';
import type { JsRuleMatcher } from '../../schema.ts';
import { JS_GUIDE_HASH, jsUrlSearchParamsMatcher, jsUrlSearchParamsRule } from './url-search-params.ts';

const jsMatcher: JsRuleMatcher = jsUrlSearchParamsMatcher;

void test('js/url-search-params: rule metadata & rubric structure', () => {
  assert.equal(jsUrlSearchParamsRule.id, 'js/url-search-params');
  assert.equal(jsUrlSearchParamsRule.guideId, 'js');
  assert.equal(jsUrlSearchParamsRule.guideHash, JS_GUIDE_HASH);
  assert.ok(jsUrlSearchParamsRule.verifierRubric.keepWhen.length > 0);
  const dropText = jsUrlSearchParamsRule.verifierRubric.dropWhen.join('\n');
  assert.match(dropText, /full URL/i);
  assert.match(dropText, /unkeyed/i);
  assert.match(dropText, /Base64/i);
  assert.match(dropText, /polyfill/i);
  assert.match(dropText, /Object\.fromEntries/);
  assert.match(dropText, /getUrlVars/);
  assert.match(dropText, /user-agent|isIE|MSIE/i);
});

void test('js/url-search-params: verified platform behavior claims', async (t) => {
  await t.test('decodes "+" as space (x-www-form-urlencoded), unlike decodeURIComponent', () => {
    const raw = '?email=alice+work@example.com&encoded=alice%2Bwork@example.com';
    const params = new URLSearchParams(raw);
    assert.equal(params.get('email'), 'alice work@example.com');
    assert.equal(params.get('encoded'), 'alice+work@example.com');
    assert.equal(decodeURIComponent('alice+work@example.com'), 'alice+work@example.com');
  });

  await t.test('returns "" for keys without "=" (vs undefined / "undefined" in split parsers)', () => {
    const params = new URLSearchParams('?flag&empty=&present=1');
    assert.equal(params.has('flag'), true);
    assert.equal(params.get('flag'), '');
    assert.equal(params.get('empty'), '');
    assert.equal(params.has('missing'), false);
    assert.equal(params.get('missing'), null);

    const pair = 'flag'.split('=');
    assert.equal(pair[1], undefined);
    assert.equal(unescape(String(pair[1])), 'undefined');
  });

  await t.test('preserves "=" inside parameter values (e.g. base64 tokens)', () => {
    const raw = '?token=abc==&next=/home';
    const params = new URLSearchParams(raw);
    assert.equal(params.get('token'), 'abc==');
    assert.equal(raw.slice(1).split('&')[0]?.split('=')[1], 'abc');
  });

  await t.test('get() returns first occurrence while getAll() returns all repeated values', () => {
    const raw = '?tag=alpha&tag=beta';
    const params = new URLSearchParams(raw);
    assert.equal(params.get('tag'), 'alpha');
    assert.deepEqual(params.getAll('tag'), ['alpha', 'beta']);

    const lastWins = Object.fromEntries(raw.slice(1).split('&').map((p) => p.split('=')));
    assert.equal(lastWins.tag, 'beta');
  });

  await t.test('never throws URIError on malformed percent-encoding (substitutes U+FFFD)', () => {
    assert.throws(() => decodeURIComponent('%E0%A4%A'), URIError);
    assert.equal(new URLSearchParams('?q=%E0%A4%A').get('q'), '\uFFFD%A');

    assert.throws(() => decodeURIComponent('%E0%80%80'), URIError);
    assert.equal(new URLSearchParams('?q=%E0%80%80').get('q'), '\uFFFD\uFFFD\uFFFD');

    assert.equal(new URLSearchParams('?q=%ZZ').get('q'), '%ZZ');
  });

  await t.test('full URL strings require new URL(str).searchParams, not new URLSearchParams(str)', () => {
    const fullUrl = 'https://example.com/path?foo=bar';
    assert.equal(new URLSearchParams(fullUrl).get('foo'), null);
    assert.equal(new URLSearchParams(fullUrl).get('https://example.com/path?foo'), 'bar');
    assert.equal(new URL(fullUrl).searchParams.get('foo'), 'bar');
    assert.equal(new URLSearchParams('?foo=bar').get('foo'), 'bar');
  });

  await t.test('location.hash keeps leading "#" unless sliced', () => {
    assert.equal(new URLSearchParams('#token=xyz&mode=dark').get('token'), null);
    assert.equal(new URLSearchParams('#token=xyz&mode=dark').get('#token'), 'xyz');
    assert.equal(new URLSearchParams('#token=xyz&mode=dark'.slice(1)).get('token'), 'xyz');
  });

  await t.test('semicolon ";" is not treated as a pair delimiter by URLSearchParams', () => {
    const params = new URLSearchParams('?a=1;b=2');
    assert.equal(params.get('a'), '1;b=2');
    assert.equal(params.get('b'), null);
  });
});

void test('js/url-search-params: positive matches across observed shapes', async (t) => {
  await t.test('flags strip-question-mark + split("&") + loop split("=") without duplicate on pair.split', () => {
    const code = `
      function getQueryParam(key) {
        var currentUri = window.location.search.substring(1);
        var vars = currentUri.split('&');
        for (var i = 0; i < vars.length; i++) {
          var pair = vars[i].split('=');
          if (pair[0] === key) {
            return pair[1] === undefined ? true : decodeURIComponent(pair[1]);
          }
        }
        return false;
      }
    `;
    const matches = matchJsRule(jsMatcher, 'query.js', code);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 4);
    assert.match(matches[0]?.message ?? '', /URLSearchParams/);
  });

  await t.test('flags reduce and Object.fromEntries split parsers on location.search', () => {
    const code = `
      const dict = location.search
        .substr(1)
        .split('&')
        .reduce((acc, item) => {
          const [k, v] = item.split('=');
          return { ...acc, [k]: v };
        }, {});

      const mapped = Object.fromEntries(
        window.location.search.replace(/^\\?/, '').split('&').map((kv) => kv.split('='))
      );
    `;
    const matches = matchJsRule(jsMatcher, 'functional.js', code);
    assert.equal(matches.length, 2);
    assert.equal(matches[0]?.line, 2);
    assert.equal(matches[1]?.line, 11);
  });

  await t.test('flags getParameterByName helpers with default/fallback url and emits new URL(url, location.href).searchParams', () => {
    const code = `
      function getParameterByName(name, url) {
        if (!url) url = window.location.href;
        name = name.replace(/[\\[\\]]/g, '\\\\$&');
        var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
        var results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\\+/g, ' '));
      }

      const getModernHelper = (key, target = window.location.href) => {
        const re = new RegExp('[?&]' + key + '=([^&#]*)');
        return re.exec(target)?.[1] ?? null;
      };

      function getWithOrAssign(key, url) {
        url ||= window.location.href;
        return new RegExp('(\\\\?|&)' + key + '=([^&]*)').exec(url)?.[2] ?? null;
      }
    `;
    const matches = matchJsRule(jsMatcher, 'helpers.js', code);
    assert.equal(matches.length, 3);
    assert.equal(matches[0]?.line, 6);
    assert.equal(matches[1]?.line, 14);
    assert.equal(matches[2]?.line, 19);
    for (const m of matches) {
      assert.match(m.message, /new URL\(url, location\.href\)\.searchParams/);
    }
  });

  await t.test('flags forEach pair splitting and indexOf("=") + slice() parsers on location.search', () => {
    const code = `
      const out = {};
      location.search.slice(1).split('&').forEach((pair) => {
        const [k, v] = pair.split('=');
        out[k] = v;
      });

      const sliced = {};
      window.location.search.substr(1).split('&').forEach(function (entry) {
        var eq = entry.indexOf('=');
        if (eq >= 0) {
          sliced[decodeURIComponent(entry.slice(0, eq))] = decodeURIComponent(entry.slice(eq + 1));
        }
      });
    `;
    const matches = matchJsRule(jsMatcher, 'foreach.js', code);
    assert.equal(matches.length, 2);
    assert.equal(matches[0]?.line, 3);
    assert.equal(matches[1]?.line, 9);
  });

  await t.test('flags regex .match() and callback .replace() value extractors on location.search and IIFE window alias', () => {
    const code = `
      (function (w) {
        const m = w.location.search.match(/[?&]pixlr=([^&]+)/);
        window.location.search.replace(/stream=(.+?)\\b/, function (_, key) {
          joinStream(key);
        });
        const vars = {};
        const parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (_, k, v) {
          vars[k] = v;
        });
      })(window);
    `;
    const matches = matchJsRule(jsMatcher, 'regex.js', code);
    assert.equal(matches.length, 3);
    assert.equal(matches[0]?.line, 3);
    assert.equal(matches[1]?.line, 4);
    assert.equal(matches[2]?.line, 8);
  });

  await t.test('flags location.href query tail split on "&" with pair parsing, split("key=")[1], and query-bounded regex', () => {
    const code = `
      const hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&').map((p) => p.split('='));
      const args = location.href.split('?')[1].split('&').reduce((acc, p) => {
        const [k, v] = p.split('=');
        acc[k] = v;
        return acc;
      }, {});
      const sess = window.location.href.split('local=')[1];
      const tabMatch = /[?&]tab=([^&#]+)/.exec(location.href);
    `;
    const matches = matchJsRule(jsMatcher, 'href-query.js', code);
    assert.equal(matches.length, 4);
    assert.deepEqual(
      matches.map((m) => m.line),
      [2, 3, 8, 9],
    );
    for (const m of matches) {
      assert.match(m.message, /new URL\(url, location\.href\)\.searchParams/);
    }
  });

  await t.test('flags startsWith("?") ? slice(1) : search ternary and plain object map loops', () => {
    const code = `
      const qs = location.search.startsWith('?') ? location.search.slice(1) : location.search;
      const pairs = Object.fromEntries(qs.split('&').map((p) => p.split('=')));

      function parseToObject() {
        const vars = {};
        for (const piece of window.location.search.substring(1).split('&')) {
          const [k, v = ''] = piece.split('=');
          vars[k] = decodeURIComponent(v);
        }
        return vars;
      }

      function parseHelperTernary(url = window.location.href) {
        const raw = url.startsWith('?') ? url.slice(1) : url;
        return raw.split('&').map((kv) => kv.split('='));
      }
    `;
    const matches = matchJsRule(jsMatcher, 'ternary-and-map.js', code);
    assert.equal(matches.length, 3);
    assert.equal(matches[0]?.line, 3);
    assert.match(matches[0]?.message ?? '', /new URLSearchParams\(location\.search\)/);
    assert.equal(matches[1]?.line, 7);
    assert.match(matches[1]?.message ?? '', /new URLSearchParams\(location\.search\)/);
    assert.equal(matches[2]?.line, 16);
    assert.match(matches[2]?.message ?? '', /new URL\(url, location\.href\)\.searchParams/);
  });

  await t.test('flags key-prefix split("key=")[1] value extraction on location.search', () => {
    const code = `
      const recipeId = location.search.split('recipe=')[1];
      const val = window.location.search.split(paramName + '=')[1]?.split('&')[0];
    `;
    const matches = matchJsRule(jsMatcher, 'split-key.js', code);
    assert.equal(matches.length, 2);
    assert.equal(matches[0]?.line, 2);
    assert.equal(matches[1]?.line, 3);
  });

  await t.test('flags inline script blocks inside HTML files via scanFiles', () => {
    const html = `
      <!doctype html>
      <html>
        <body>
          <script>
            var pairs = window.location.search.substring(1).split('&').map(function (p) { return p.split('='); });
          </script>
        </body>
      </html>
    `;
    const findings = scanFiles(new Map([['loader.html', html]]), [jsUrlSearchParamsRule]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.line, 6);
    assert.match(findings[0]?.message ?? '', /URLSearchParams/);
  });

  await t.test('flags nested arrow helper with default location.href inside outer function', () => {
    const code = `
      function setupWidget() {
        const readParam = (name, url = window.location.href) =>
          new RegExp('[?&]' + name + '=([^&#]*)').exec(url);
        return readParam('tab');
      }
    `;
    const matches = matchJsRule(jsMatcher, 'nested-arrow.js', code);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 4);
  });
});

void test('js/url-search-params: negative / false-positive / modern / guarded cases', async (t) => {
  await t.test('exempts boolean presence checks (.indexOf, .includes, .search, regex.test, and valueless .match)', () => {
    const code = `
      if (window.location.search.indexOf('&_popup=1') === -1) {
        window.history.back();
      }
      if (location.search.indexOf('preview') > 0) {
        enablePreview();
      }
      const hasDebug = window.location.search.includes('debug=1');
      const hasToken = location.search.search(/[?&]token=/) !== -1;
      (function (w) {
        if (/(^|[?&])skipintro=1(&|$)/.test(w.location.search)) return;
      })(window);
      const hasMode = /(\\?|&)mode=1/.test(window.location.href);
      if (/[?&]lc=[\\w\\-_]+/.test(location.search)) {
        openTab();
      }
      if (window.location.search.match(/(\\?|\\&)notes/gi) !== null) {
        openNotes();
      }
      if (location.search.match(/[?&]lc=[\\w\\-_]+/)) {
        openTab();
      }
      if (location.href.match(/karte\\.php($|\\?z=)/)) {
        renderMap();
      }
    `;
    const matches = matchJsRule(jsMatcher, 'presence-checks.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts unkeyed .split("&") token membership checks and .split("&") without "=" pair parsing', () => {
    const code = `
      const directIncludes = location.search.slice(1).split('&').includes('token');
      const directIndexOf = window.location.search.substring(1).split('&').indexOf('debug') !== -1;

      const tokens = location.search.slice(1).split('&');
      if (tokens.includes('flag') || tokens.indexOf('admin') >= 0) {
        enableAdmin();
      }

      function checkFlags() {
        const parts = window.location.search.substring(1).split('&');
        for (const p of parts) {
          if (p === 'raw') return true;
        }
        return false;
      }

      function rawSegments(url = window.location.href) {
        const raw = url.startsWith('?') ? url.slice(1) : url;
        return raw.split('&');
      }

      if (location.search.split('recipe=').length > 1) {
        hasRecipe();
      }
    `;
    const matches = matchJsRule(jsMatcher, 'unkeyed-split.js', code);
    assert.equal(matches.length, 0);
  });
  await t.test('exempts base URL, path, host, hash, and route operations on location.href', () => {
    const code = `
      const baseUrl = location.href.split('?')[0];
      const host = location.href.replace('://', '').split('/')[0];
      const hashPart = window.location.href.split('#')[1];
      const isWatchPage = /example\\.com\\/watch/i.test(window.location.href);
      const isSameBase = document.location.href.indexOf(baseUrl) >= 0;
    `;
    const matches = matchJsRule(jsMatcher, 'href-non-query.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts forwarding, stripping, and emptiness checks on location.search or location.href', () => {
    const code = `
      const workerUrl = appName + '.js' + location.search;
      const cleanSource = sourceURL.replace(self.location.search, '');
      const fullPath = window.location.pathname + window.location.search + window.location.hash;
      const options = document.location.href.split('?')[1];
      const forwarded = options ? 'next?' + options : 'next';
      const hasQuery = /^\\?/.test(location.search) && location.search.indexOf('?') !== -1;
    `;
    const matches = matchJsRule(jsMatcher, 'forwarding.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts framework router method calls such as AngularJS $location.search()', () => {
    const code = `
      function initController($location) {
        const winId = parseInt($location.search().idChromeWindow, 10);
        const tags = $location.search().tags?.split('&') ?? [];
        return { winId, tags };
      }
    `;
    const matches = matchJsRule(jsMatcher, 'angular-location.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts location.hash parsing, hash routes, and double leading "??"', () => {
    const code = `
      const hashPairs = window.location.hash.replace('#', '').split('&');
      const mapState = window.location.hash.substring(1).split('&');
      const hashRoute = window.location.hash.slice(window.location.hash.indexOf('?') + 1).split('&');
      const combined = document.location.search || document.location.hash;
      const combinedPairs = combined.split('&');
      const doubleQuestion = window.location.search.replace(/^\\?+/, '').split('&');
    `;
    const matches = matchJsRule(jsMatcher, 'hash-and-fallback.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts bracket-key array parsing, hybrid getUrlVars helpers, and try/catch URI validation', () => {
    const code = `
      function parsePhpBrackets() {
        const out = {};
        for (const pair of window.location.search.slice(1).split('&')) {
          const [rawKey, rawVal = ''] = pair.split('=');
          const key = decodeURIComponent(rawKey);
          if (key.endsWith('[]') || key.includes('[')) {
            const base = key.split('[')[0];
            out[base] ??= [];
            out[base].push(decodeURIComponent(rawVal));
          } else {
            out[key] = decodeURIComponent(rawVal);
          }
        }
        return out;
      }

      function getUrlVars() {
        var vars = [], hash;
        var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
        for (var i = 0; i < hashes.length; i++) {
          hash = hashes[i].split('=');
          vars.push(hash[0]);
          vars[hash[0]] = hash[1];
        }
        return vars;
      }

      function parseStrictPercentEncoding() {
        const pairs = location.search.slice(1).split('&');
        const out = {};
        try {
          for (const p of pairs) {
            const [k, v = ''] = p.split('=');
            out[decodeURIComponent(k)] = decodeURIComponent(v);
          }
          return out;
        } catch {
          return null;
        }
      }
    `;
    const matches = matchJsRule(jsMatcher, 'semantic-traps.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts custom semicolon delimiters and unkeyed search payloads', () => {
    const code = `
      const semiPairs = location.search.slice(1).split(';');
      const jQueryQuery = location.search.replace(/^[?#]/, '').split(/[&;]/);
      const queryString = document.location.search.slice(1);
      if (queryString.startsWith('DNR:')) {
        redirectUrl = queryString.slice(4);
      }
      const lang = location.search.substr(1);
      if (lang && locales[lang]) {
        setLang(lang);
      }
    `;
    const matches = matchJsRule(jsMatcher, 'custom-delimiters.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts route/scheme/hash regexes, helper-call literals, and non-callback .replace()', () => {
    const code = `
      function parseQueryString(str) {
        return str.split('&').map((part) => part.split('='));
      }
      const fbVideoRe = /^https?:\\/\\/(?:www\\.)?example\\.com\\/video\\.php.*[\\?&]v=(\\d{5,})(?:$|&)/i;
      const isMatch = fbVideoRe.test(linkHref);
      const schemeMatch = /^https:\\/\\/example\\.com\\/watch\\?v=([^&]+)/.exec(location.href);
      const pathMatch = /\\/items\\?id=(\\d+)/.test(window.location.href);
      const unanchoredHref = /tab=([^&]+)/.exec(location.href);
      const hashAltHref = new RegExp('[&?#]' + 'tab' + '=([^&]*)').exec(location.href);
      const helperCallRe = new RegExp('/api/' + escapeTag('a=1&b=2') + '/items').test(location.href);
      const redacted = location.search.replace(/token=[^&]+/, 'token=redacted');
      const escapedQuery = location.search.replace(/&/g, '&amp;');
      const strippedUrl = window.location.href.replace(/([?&])(?:q|h)=([^&]+)(&|$)/, (_, pre, _v, end) => (end === '&' ? pre : ''));
      function parseLocalObject(location) {
        return location.search.substring(1).split('&');
      }
    `;
    const matches = matchJsRule(jsMatcher, 'arbitrary-and-regex-guards.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts URLSearchParams polyfills (function, class, or window.URLSearchParams assignment)', () => {
    const polyfillFn = `
      function URLSearchParams() {
        const vars = location.search.slice(1).split('&');
        return vars.map((pair) => pair.split('='));
      }
    `;
    const polyfillClass = `
      class URLSearchParams {
        constructor() {
          this.pairs = location.search.slice(1).split('&').map((pair) => pair.split('='));
        }
      }
    `;
    const polyfillAssign = `
      window.URLSearchParams = window.URLSearchParams || function () {
        return location.search.slice(1).split('&').map((pair) => pair.split('='));
      };
    `;
    const polyfillWithTopLevelHelper = `
      function URLSearchParams() {}
      function parseHelper() {
        return location.search.slice(1).split('&').map((pair) => pair.split('='));
      }
    `;
    assert.equal(matchJsRule(jsMatcher, 'polyfill-fn.js', polyfillFn).length, 0);
    assert.equal(matchJsRule(jsMatcher, 'polyfill-class.js', polyfillClass).length, 0);
    assert.equal(matchJsRule(jsMatcher, 'polyfill-assign.js', polyfillAssign).length, 0);
    assert.equal(matchJsRule(jsMatcher, 'polyfill-helper.js', polyfillWithTopLevelHelper).length, 0);
  });

  await t.test('exempts modern URLSearchParams usage and feature-guarded fallbacks', () => {
    const code = `
      const modernParams = new URLSearchParams(window.location.search);
      const id = modernParams.get('id');

      let guardedA;
      if ('URLSearchParams' in window) {
        guardedA = new URLSearchParams(window.location.search).get('a');
      } else {
        guardedA = window.location.search.substring(1).split('&')[0]?.split('=')[1];
      }

      function guardedHelper(key) {
        if (typeof URLSearchParams !== 'undefined') {
          return new URLSearchParams(location.search).get(key);
        }
        const m = location.search.match(new RegExp('[?&]' + key + '=([^&]*)'));
        return m ? decodeURIComponent(m[1]) : null;
      }

      function negativeGuardHelper() {
        if (!window.URLSearchParams) {
          return location.search.slice(1).split('&');
        }
        return [];
      }
    `;
    const matches = matchJsRule(jsMatcher, 'modern-and-guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('does not suppress query parsing when an unrelated array literal and .push() exist in the same function', () => {
    const code = `
      function readPairs() {
        const items = [];
        items.push('header');
        return location.search.slice(1).split('&').map((part) => part.split('='));
      }
    `;
    const matches = matchJsRule(jsMatcher, 'unrelated-array-push.js', code);
    assert.deepEqual(
      matches.map((m) => m.line),
      [5],
    );
  });
});
