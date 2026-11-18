// @ts-check
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createProxyHandler } = require('./index.js');

test('mwg-demo-proxy', async t => {
  const upstream = http.createServer((req, res) => {
    if (
      req.url === '/GoogleChrome/modern-web-guidance-src/abc1234/guides/css/subgrid/demo.html' ||
      req.url === '/GoogleChrome/modern-web-guidance-src/guides/ui-components/dialog/guides/ui-components/dialog/demo.html'
    ) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('<!doctype html><html><body><h1>Hello</h1></body></html>');
      return;
    }
    res.writeHead(404);
    res.end('Not found');
  });

  await new Promise(resolve => upstream.listen(0, '127.0.0.1', () => resolve(undefined)));
  const upstreamPort = /** @type {import('node:net').AddressInfo} */ (upstream.address()).port;

  const proxyServer = http.createServer(createProxyHandler({ rawBaseUrl: `http://127.0.0.1:${upstreamPort}` }));
  await new Promise(resolve => proxyServer.listen(0, '127.0.0.1', () => resolve(undefined)));
  const proxyPort = /** @type {import('node:net').AddressInfo} */ (proxyServer.address()).port;
  const fetchProxy = (/** @type {string} */ p, /** @type {RequestInit} */ opts = {}) => fetch(`http://127.0.0.1:${proxyPort}${p}`, opts);

  t.after(() => {
    proxyServer.close();
    upstream.close();
  });

  await t.test('serves valid demo.html swaps with proper MIME type and security headers', async () => {
    for (const p of [
      '/GoogleChrome/modern-web-guidance-src/blob/abc1234/guides/css/subgrid/demo.html',
      '/GoogleChrome/modern-web-guidance-src/blob/guides/ui-components/dialog/guides/ui-components/dialog/demo.html',
    ]) {
      const res = await fetchProxy(p);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.ok((await res.text()).includes('<h1>Hello</h1>'));
    }
  });

  await t.test('redirects guide folder and guide.md URLs to demo.html', async () => {
    for (const p of [
      '/GoogleChrome/modern-web-guidance-src/tree/feat/my-branch/guides/css/subgrid',
      '/GoogleChrome/modern-web-guidance-src/blob/feat/my-branch/guides/css/subgrid/guide.md',
    ]) {
      const res = await fetchProxy(p, { redirect: 'manual' });
      assert.equal(res.status, 302);
      assert.equal(res.headers.get('location'), '/GoogleChrome/modern-web-guidance-src/blob/feat/my-branch/guides/css/subgrid/demo.html');
    }
  });

  await t.test('rejects untrusted repos, path traversal, targets, dotfiles, and non-static extensions', async () => {
    /** @type {[string, number][]} */
    const cases = [
      ['/attacker/evil-repo/blob/main/guides/css/subgrid/demo.html', 404],
      ['/paulirish/dotfiles/blob/main/guides/css/subgrid/demo.html', 404],
      ['/GoogleChrome/modern-web-guidance-src/blob/main/guides/css/%2e%2e/package.json', 404],
      ['/GoogleChrome/modern-web-guidance-src/blob/main%2f..%2f../guides/css/subgrid/demo.html', 400],
      ['/GoogleChrome/modern-web-guidance-src/blob/main/guides/css/subgrid/targets/app/index.html', 403],
      ['/GoogleChrome/modern-web-guidance-src/blob/main/guides/css/subgrid/.env', 403],
      ['/GoogleChrome/modern-web-guidance-src/blob/main/guides/css/subgrid/grader.ts', 403],
      ['/GoogleChrome/modern-web-guidance-src/blob/main/package.json', 404],
    ];
    for (const [p, expected] of cases) {
      const res = await fetchProxy(p);
      assert.equal(res.status, expected, `Expected ${expected} for ${p}`);
    }
  });

  await t.test('rejects POST requests with 405', async () => {
    const res = await fetchProxy('/GoogleChrome/modern-web-guidance-src/blob/abc1234/guides/css/subgrid/demo.html', { method: 'POST' });
    assert.equal(res.status, 405);
  });
});
