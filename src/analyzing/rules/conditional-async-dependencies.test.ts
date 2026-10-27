import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  conditionalAsyncDependenciesJsMatcher,
  conditionalAsyncDependenciesPackageMatcher
} from './conditional-async-dependencies.ts';
void test('conditional-async-dependencies dependency matcher', async (t) => {
  await t.test('flags loadjs and scriptjs', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          loadjs: '^4.2.0',
          scriptjs: '^2.5.9',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      conditionalAsyncDependenciesPackageMatcher,
    ]);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts unrelated packages', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          vite: '^5.0.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      conditionalAsyncDependenciesPackageMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});

void test('conditional-async-dependencies JS matcher', async (t) => {
  await t.test('flags loadjs(), $script(), and conditional document.createElement("script")', () => {
    const code = `
      import loadjs from 'loadjs';
      import $script from 'scriptjs';

      if (!('popover' in HTMLElement.prototype)) {
        loadjs('/polyfills/popover.js', () => {
          initApp();
        });
      }

      $script('/vendor/chart-plugin.js', () => {
        renderChart();
      });

      function loadPolyfill(url, callback) {
        if (!window.IntersectionObserver) {
          const script = document.createElement('script');
          script.src = url;
          script.onload = callback;
          document.head.appendChild(script);
        }
      }
    `;
    const matches = matchJsRule(conditionalAsyncDependenciesJsMatcher, 'loader.js', code);
    assert.equal(matches.length, 3);
  });

  await t.test('exempts third-party analytics/ads/Stripe snippets and JSON-LD scripts', () => {
    const code = `
      function injectAnalytics() {
        const ga = document.createElement('script');
        ga.src = 'https://www.googletagmanager.com/gtag/js?id=UA-12345';
        ga.onload = () => {};
        document.head.appendChild(ga);
      }

      function injectJsonLd(data) {
        const ld = document.createElement('script');
        ld.type = 'application/ld+json';
        ld.textContent = JSON.stringify(data);
        document.head.appendChild(ld);
      }

      function fetchJsonp(endpoint) {
        const s = document.createElement('script');
        s.src = endpoint + '?callback=handleResponse';
        s.onload = () => s.remove();
        document.body.appendChild(s);
      }

      function injectStripe() {
        const s = document.createElement('script');
        s.src = 'https://js.stripe.com/v3/';
        s.onload = () => {};
        document.head.appendChild(s);
      }
    `;
    const matches = matchJsRule(conditionalAsyncDependenciesJsMatcher, 'analytics.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts shadowed local loadjs or $script functions', () => {
    const code = `
      import loadjs from 'loadjs';

      function wrapper() {
        function loadjs(name) { return name; }
        loadjs('/local/module.js');
      }
    `;
    const matches = matchJsRule(conditionalAsyncDependenciesJsMatcher, 'shadowed.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts script elements without src or without async load handlers', () => {
    const code = `
      function insertRawScript() {
        const script = document.createElement('script');
        script.textContent = 'window.__INITIAL_DATA__ = {}';
        document.body.appendChild(script);
      }
    `;
    const matches = matchJsRule(conditionalAsyncDependenciesJsMatcher, 'raw-script.js', code);
    assert.equal(matches.length, 0);
  });
});
