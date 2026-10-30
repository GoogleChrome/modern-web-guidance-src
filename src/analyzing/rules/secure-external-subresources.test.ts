import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { withVirtualSourceFile } from '../scanners/js-scanner.ts';
import { secureExternalSubresourcesMatcher } from './secure-external-subresources.ts';

void test('secure-external-subresources DOM matcher', async (t) => {
  await t.test('flags versioned third-party CDN <script> and <link rel="stylesheet"> missing integrity and deduplicates to 1 finding per file', () => {
    const html = `
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
        <script src="https://cdn.jsdelivr.net/npm/htmx.org@1.9.12/dist/htmx.min.js"></script>
        <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
      </head>
    `;
    const matches = scanHtml('index.html', html, [secureExternalSubresourcesMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
  });

  await t.test('flags external cross-origin <script> or <link> with integrity="sha..." when crossorigin is missing', () => {
    const html = `
      <head>
        <script
          src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"
          integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
        ></script>
      </head>
    `;
    const matches = scanHtml('missing-cors.html', html, [secureExternalSubresourcesMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
  });

  await t.test('flags JSX CDN <script> missing integrity', () => {
    const code = `
      export function MathJaxScript() {
        return <script src="https://unpkg.com/katex@0.16.9/dist/katex.min.js" crossOrigin="anonymous" />;
      }
    `;
    const matches = withVirtualSourceFile('MathJaxScript.tsx', code, (sourceFile) =>
      scanJsx('MathJaxScript.tsx', sourceFile, [secureExternalSubresourcesMatcher]),
    );
    assert.equal(matches.length, 1);
  });

  await t.test('exempts CDN resources that already have integrity+crossorigin, importance attributes, or unversioned/same-origin URLs', () => {
    const html = `
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css"
          integrity="sha384-bs0EksOYBbU/g0IAHMXbSyH1Mgw83GKn+EZlSI+VE+zVchXmSbLwhVLrPzsOWnc5"
          crossorigin="anonymous"
          referrerpolicy="no-referrer"
        >
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css" importance="high">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js" importance="low"></script>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap">
        <script src="https://cdn.jsdelivr.net/npm/vue@latest/dist/vue.global.js"></script>
        <script src="/assets/app.bundle.js"></script>
      </head>
    `;
    const matches = scanHtml('modern.html', html, [secureExternalSubresourcesMatcher]);
    assert.equal(matches.length, 0);
  });
});
