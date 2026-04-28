import test from 'node:test';
import assert from 'node:assert';
import { getMdnUrlsForFeature } from './guide-gen.ts';

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
