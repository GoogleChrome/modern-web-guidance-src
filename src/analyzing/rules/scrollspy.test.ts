import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml } from '../scanners/dom-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import type { DomRuleMatcher, JsRuleMatcher } from '../schema.ts';
import {
  scrollspyJsRule,
  scrollspyRule,
} from './scrollspy.ts';

const domMatcher = scrollspyRule.matcher as DomRuleMatcher;
const jsMatcher = scrollspyJsRule.matcher as JsRuleMatcher;

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

void test('scrollspy JS: positive brownfield matches', async (t) => {
  await t.test('flags jQuery .scrollspy() plugin call', () => {
    const project = createInMemoryProject();
    const code = `
      $(document).ready(function() {
        $('body').scrollspy({ target: '#navbar-example', offset: 50 });
      });
    `;
    const sourceFile = project.createSourceFile('app.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'app.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /Legacy scrollspy plugin/);
  });

  await t.test('flags Bootstrap new ScrollSpy constructor invocation', () => {
    const project = createInMemoryProject();
    const code = `
      import { ScrollSpy } from 'bootstrap';
      const spy = new ScrollSpy(document.body, {
        target: '#main-nav'
      });
    `;
    const sourceFile = project.createSourceFile('main.ts', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'main.ts',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /Legacy scrollspy plugin/);
  });

  await t.test('flags manual scroll event listener calculating section offsetTop for active nav', () => {
    const project = createInMemoryProject();
    const code = `
      window.addEventListener('scroll', () => {
        const sections = document.querySelectorAll('section');
        const navLinks = document.querySelectorAll('nav a');
        sections.forEach(sec => {
          const top = sec.offsetTop;
          if (window.scrollY >= top - 60) {
            navLinks.forEach(link => link.classList.remove('active'));
            document.querySelector('nav a[href="#' + sec.id + '"]')?.classList.add('active');
          }
        });
      });
    `;
    const sourceFile = project.createSourceFile('scroll-nav.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'scroll-nav.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /Manual scroll listener calculates section positions/);
  });
});

void test('scrollspy JS: negative / exempt cases', async (t) => {
  await t.test('exempts scroll listener guarded by CSS.supports for scroll-target-group', () => {
    const project = createInMemoryProject();
    const code = `
      if (!CSS.supports('scroll-target-group: auto')) {
        $('body').scrollspy({ target: '#nav' });
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts scroll listener handling infinite scroll or window scroll position', () => {
    const project = createInMemoryProject();
    const code = `
      window.addEventListener('scroll', () => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
          loadMorePosts();
        }
      });
    `;
    const sourceFile = project.createSourceFile('infinite.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'infinite.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
