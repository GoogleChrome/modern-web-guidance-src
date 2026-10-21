import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml } from '../scanners/dom-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import type { DomRuleMatcher, JsRuleMatcher } from '../schema.ts';
import {
  scrollspyJsRule,
  scrollspyRule,
  scrollspyRules,
} from './scrollspy.ts';

const domMatcher = scrollspyRule.matcher as DomRuleMatcher;
const jsMatcher = scrollspyJsRule.matcher as JsRuleMatcher;

void test('scrollspy rules array metadata', () => {
  assert.equal(scrollspyRules.length, 1);
});

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

  await t.test('flags named function reference in addEventListener with pageYOffset', () => {
    const project = createInMemoryProject();
    const code = `
      function updateActiveNav() {
        const curY = window.pageYOffset;
        document.querySelectorAll('section').forEach(s => {
          if (curY >= s.offsetTop) {
            $('.nav-link').removeClass('active');
            $('a[href="#' + s.id + '"]').addClass('active');
          }
        });
      }
      window.addEventListener('scroll', updateActiveNav);
    `;
    const sourceFile = project.createSourceFile('named-scroll.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'named-scroll.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });

  await t.test('flags window.onscroll assignment tracking section positions', () => {
    const project = createInMemoryProject();
    const code = `
      window.onscroll = function() {
        const y = window.scrollY;
        const sections = document.querySelectorAll('.content-section');
        sections.forEach(sec => {
          const rect = sec.getBoundingClientRect();
          if (rect.top <= 100) {
            document.querySelector('.toc a.active')?.classList.remove('active');
            document.querySelector('.toc a[href="#' + sec.id + '"]')?.classList.add('active');
          }
        });
      };
    `;
    const sourceFile = project.createSourceFile('onscroll.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'onscroll.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /Manual onscroll assignment/);
  });

  await t.test('flags IntersectionObserver tracking section visibility to toggle active TOC links', () => {
    const project = createInMemoryProject();
    const code = `
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
            document.querySelector('nav a[href="#' + id + '"]')?.classList.add('active');
          }
        });
      }, { threshold: 0.5 });
      document.querySelectorAll('section').forEach(s => observer.observe(s));
    `;
    const sourceFile = project.createSourceFile('observer-scrollspy.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'observer-scrollspy.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /IntersectionObserver/);
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

  await t.test('exempts IntersectionObserver used for lazy loading images', () => {
    const project = createInMemoryProject();
    const code = `
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            observer.unobserve(img);
          }
        });
      });
      document.querySelectorAll('img.lazy').forEach(img => imageObserver.observe(img));
    `;
    const sourceFile = project.createSourceFile('lazy-load.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'lazy-load.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts UIkit.scrollspy or non-nav min/max scrollspy plugins', () => {
    const project = createInMemoryProject();
    const code = `
      UIkit.scrollspy('#target', { cls: 'uk-animation-fade' });
      $('#nav').scrollspy({ min: 100, max: 500, onEnter: function() {} });
    `;
    const sourceFile = project.createSourceFile('uikit.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'uikit.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
