import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { scanJsSource, withVirtualSourceFile } from '../scanners/js-scanner.ts';
import type { DomRuleMatcher, JsRuleMatcher } from '../schema.ts';
import {
  navigationDrawerDomRule,
  navigationDrawerRule,
} from './navigation-drawer.ts';

const jsMatcher = navigationDrawerRule.matcher as JsRuleMatcher;
const domMatcher = navigationDrawerDomRule.matcher as DomRuleMatcher;

void test('navigation-drawer: JS positive brownfield matches', async (suiteContext) => {
  await suiteContext.test('flags drawer controller toggling open class and backdrop click listener', () => {
    const code = `
      function setupDrawer(drawerElement: HTMLElement, backdropElement: HTMLElement) {
        function openDrawer() {
          drawerElement.classList.add('is-open');
          backdropElement.classList.add('visible');
          document.body.style.overflow = 'hidden';
        }
        function closeDrawer() {
          drawerElement.classList.remove('is-open');
          backdropElement.classList.remove('visible');
          document.body.style.overflow = '';
        }
        backdropElement.addEventListener('click', closeDrawer);
      }
    `;
    const { matches } = scanJsSource('drawerController.ts', code, [jsMatcher]);
    assert.ok(matches.length >= 1);
    assert.match(matches[0]?.message ?? '', /popover="manual"/);
  });

  await suiteContext.test('flags sidenav toggle with Escape key listener', () => {
    const code = `
      function initSidenav(sidenav: HTMLElement) {
        function close() {
          sidenav.classList.remove('active');
        }
        window.addEventListener('keydown', (event: KeyboardEvent) => {
          if (event.key === 'Escape') {
            close();
          }
        });
      }
    `;
    const { matches } = scanJsSource('sidenav.ts', code, [jsMatcher]);
    assert.ok(matches.length >= 1);
  });
});

void test('navigation-drawer: DOM positive brownfield matches', async (suiteContext) => {
  await suiteContext.test('flags div.drawer without popover attribute', () => {
    const html = `
      <div class="drawer" id="main-drawer">
        <nav>
          <ul>
            <li><a href="/home">Home</a></li>
          </ul>
        </nav>
      </div>
    `;
    const matches = scanHtml('index.html', html, [domMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /popover="manual"/);
  });

  await suiteContext.test('flags nav.offcanvas without popover attribute', () => {
    const html = `
      <nav class="offcanvas" id="mobile-menu">
        <a href="/about">About</a>
      </nav>
    `;
    const matches = scanHtml('menu.html', html, [domMatcher]);
    assert.equal(matches.length, 1);
  });

  await suiteContext.test('flags JSX Sidenav component without popover', () => {
    const code = `
      export function Sidenav() {
        return (
          <aside className="sidenav">
            <ul><li><a href="/settings">Settings</a></li></ul>
          </aside>
        );
      }
    `;
    const matches = withVirtualSourceFile('Sidenav.tsx', code, (sourceFile) =>
            scanJsx('Sidenav.tsx', sourceFile, [domMatcher]),
          );
    assert.equal(matches.length, 1);
  });
});

void test('navigation-drawer: negative / exempt cases', async (suiteContext) => {
  await suiteContext.test('exempts drawer element with popover="manual"', () => {
    const html = `
      <div class="drawer" id="drawer" popover="manual">
        <nav><a href="/home">Home</a></nav>
      </div>
    `;
    const matches = scanHtml('modern.html', html, [domMatcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts persistent static desktop sidebar', () => {
    const html = `
      <aside class="sidebar-static">
        <nav><a href="/dashboard">Dashboard</a></nav>
      </aside>
    `;
    const matches = scanHtml('layout.html', html, [domMatcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts drawer toggle buttons or triggers', () => {
    const html = `
      <button class="drawer-trigger" aria-label="Open menu">Menu</button>
    `;
    const matches = scanHtml('header.html', html, [domMatcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts static admin sidebar-nav', () => {
    const html = `
      <nav class="sidebar-nav">
        <ul><li><a href="/home">Home</a></li></ul>
      </nav>
    `;
    const matches = scanHtml('admin.html', html, [domMatcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts test and fixture files', () => {
    const html = `
      <div class="drawer"><p>Menu</p></div>
    `;
    const matches = scanHtml('tests/fixtures/drawer.html', html, [domMatcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts IIFEs and commented-out style.transform in JS', () => {
    const code = `
      (function(w, d) {
        var drawer = d.getElementById('drawer');
        drawer.classList.add('open');
        d.body.style.overflow = 'hidden';
      })(window, document);

      function openMenu(drawer) {
        // drawer.style.transform = 'translateX(0)';
        const overlay = document.querySelector('.overlay');
        return overlay;
      }
    `;
    const { matches } = scanJsSource('bundle.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts drawer sub-elements, Bootstrap grid columns, and static sidenav divs in HTML', () => {
    const html = `
      <div class="drawer-item">Item</div>
      <div class="offcanvas-header">Header</div>
      <div class="col-sm-3 sidenav">Sidebar</div>
      <div id="notifications" class="tile drawer animated">Alert</div>
    `;
    const matches = scanHtml('page.html', html, [domMatcher]);
    assert.equal(matches.length, 0);
  });
});
