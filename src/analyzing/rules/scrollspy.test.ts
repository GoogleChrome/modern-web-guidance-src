import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml } from '../scanners/dom-scanner.ts';
import type { DomRuleMatcher } from '../schema.ts';
import { scrollspyRule } from './scrollspy.ts';

const domMatcher = scrollspyRule.matcher as DomRuleMatcher;

void test('scrollspy DOM: positive brownfield matches', async (t) => {
  await t.test('flags body element with data-spy="scroll"', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body data-spy="scroll" data-target="#navbar-example">
          <nav id="navbar-example"></nav>
        </body>
      </html>
    `;
    const matches = scanHtml('index.html', html, [domMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /data-spy="scroll"/);
  });

  await t.test('flags container element with data-bs-spy="scroll"', () => {
    const html = `
      <div data-bs-spy="scroll" data-bs-target="#list-example" class="scrollspy-example">
        <h4 id="list-item-1">Item 1</h4>
      </div>
    `;
    const matches = scanHtml('docs.html', html, [domMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /data-bs-spy="scroll"/);
  });

  await t.test('flags element with scrollspy class and data-target', () => {
    const html = `
      <div class="scrollspy-container" data-target="#my-nav">
        <div id="section1"></div>
      </div>
    `;
    const matches = scanHtml('page.html', html, [domMatcher]);
    assert.equal(matches.length, 1);
  });

  await t.test('flags data-scrollspy custom attribute', () => {
    const html = `
      <main data-scrollspy="#toc"></main>
    `;
    const matches = scanHtml('toc.html', html, [domMatcher]);
    assert.equal(matches.length, 1);
  });
});

void test('scrollspy DOM: negative / exempt cases', async (t) => {
  await t.test('exempts element with data-spy="affix" or other data-spy values', () => {
    const html = `
      <nav data-spy="affix" data-offset-top="60"></nav>
    `;
    const matches = scanHtml('affix.html', html, [domMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts plain navigation without scrollspy attributes', () => {
    const html = `
      <nav class="navbar navbar-default">
        <ul class="nav">
          <li class="active"><a href="#home">Home</a></li>
        </ul>
      </nav>
    `;
    const matches = scanHtml('nav.html', html, [domMatcher]);
    assert.equal(matches.length, 0);
  });
});
