import test from 'node:test';
import assert from 'node:assert';
import { getMdnUrlsForFeature, getSkillContent } from './guide-gen.ts';
import { features } from 'web-features';

test('getMdnUrlsForFeature returns arrays of URLs for a feature by tag', () => {
  const urls = getMdnUrlsForFeature('subgrid');
  assert.ok(urls.length > 0);
  assert.ok(urls.includes('https://developer.mozilla.org/docs/Web/CSS/Guides/Grid_layout/Subgrid'));
});

test('web-features coverage to MDN URLs is above threshold', () => {
  const featureIds = Object.keys(features).filter(k => features[k].kind === 'feature');
  let foundUrls = 0;
  for (const featureId of featureIds) {
    const urls = getMdnUrlsForFeature(featureId);
    if (urls.length > 0) foundUrls++;
  }
  const percentage = (foundUrls / featureIds.length) * 100;
  console.log(`Feature coverage: ${percentage.toFixed(2)}% (${foundUrls}/${featureIds.length})`);
  assert.ok(percentage > 84, `Coverage was ${percentage.toFixed(2)}%`);
});

test('getSkillContent applies replacement for project-use-cases', () => {
  const content = getSkillContent('project-use-cases');
  assert.ok(content.includes('## Research and discovery'));
  assert.ok(content.includes('In this automated pipeline, the research has already been conducted'));
  assert.ok(content.includes('## Identifying action-oriented tasks'));
});
