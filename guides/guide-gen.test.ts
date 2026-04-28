import test from 'node:test';
import assert from 'node:assert';
import { mdnUrlFromCompatKey, getMdnUrlsForFeature } from './guide-gen.ts';

test('mdnUrlFromCompatKey handles CSS properties using BCD', () => {
  const url = mdnUrlFromCompatKey('css.properties.appearance');
  assert.strictEqual(url, 'https://developer.mozilla.org/docs/Web/CSS/Reference/Properties/appearance');
});

test('mdnUrlFromCompatKey handles CSS at-rules using BCD', () => {
  const url = mdnUrlFromCompatKey('css.at-rules.charset');
  assert.strictEqual(url, 'https://developer.mozilla.org/docs/Web/CSS/Reference/At-rules/@charset');
});

test('mdnUrlFromCompatKey handles JavaScript builtins using BCD', () => {
  const url = mdnUrlFromCompatKey('javascript.builtins.Array.find');
  assert.strictEqual(url, 'https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/find');
});

test('mdnUrlFromCompatKey handles API keys using BCD', () => {
  const url = mdnUrlFromCompatKey('api.Document.querySelector');
  assert.strictEqual(url, 'https://developer.mozilla.org/docs/Web/API/Document/querySelector');
});

test('mdnUrlFromCompatKey handles HTML elements using BCD', () => {
  const url = mdnUrlFromCompatKey('html.elements.div');
  assert.strictEqual(url, 'https://developer.mozilla.org/docs/Web/HTML/Reference/Elements/div');
});

test('mdnUrlFromCompatKey returns null for unknown keys', () => {
  const url = mdnUrlFromCompatKey('unknown.key');
  assert.strictEqual(url, null);
});

test('getMdnUrlsForFeature returns arrays of URLs for a feature', () => {
  const mockFeature: any = {
    compat_features: [
      'css.properties.appearance',
      'api.Document.querySelector',
      'unknown.key'
    ]
  };
  
  const urls = getMdnUrlsForFeature(mockFeature);
  assert.deepStrictEqual(urls, [
    'https://developer.mozilla.org/docs/Web/CSS/Reference/Properties/appearance',
    'https://developer.mozilla.org/docs/Web/API/Document/querySelector'
  ]);
});
