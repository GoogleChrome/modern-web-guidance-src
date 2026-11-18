// @ts-check
const http = require('node:http');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { URLPattern } = require('node:url');

const HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
const ROUTE = new URLPattern(
  { pathname: '/:owner(googlechrome|paulirish)/modern-web-guidance-src/:mode(blob|raw|tree)/:ref+/guides/:category/:guide/:asset*' },
  { ignoreCase: true }
);

/** @type {Record<string, string>} */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

/** @param {http.ServerResponse} res @param {number} status @param {string} body */
function send(res, status, body) {
  res.writeHead(status, { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}

/** @param {{ rawBaseUrl?: string }} [overrides] */
function createProxyHandler(overrides = {}) {
  const rawBaseUrl = overrides.rawBaseUrl || process.env.GITHUB_RAW_BASE_URL || 'https://raw.githubusercontent.com';
  /** @param {http.IncomingMessage} req @param {http.ServerResponse} res */
  return async function proxy(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed');
    const rawPath = (req.url || '/').split('?')[0];
    if (/(?:^|\/)\.\.?(?:\/|$)|%2e|%2f|%5c|%00|\\/i.test(rawPath) || rawPath.includes('\0')) return send(res, 400, 'Invalid path');

    const match = ROUTE.exec({ pathname: rawPath });
    if (!match) return send(res, 404, 'Swap github.com with mwg-demos.web.app on any /blob/{ref}/guides/{category}/{guide}/demo.html URL.');

    const { owner = '', ref = '', category = '', guide = '', asset = '' } = match.pathname.groups;
    const segments = [category, guide, ...asset.split('/').filter(Boolean)];
    if (!/^[\w./-]+$/.test(ref) || segments.some(s => s.startsWith('.') || s === 'targets')) {
      return send(res, 403, 'Forbidden path');
    }

    if (!asset || asset === 'guide.md' || asset === 'expectations.md') {
      res.writeHead(302, { ...HEADERS, Location: `/${owner}/modern-web-guidance-src/blob/${ref}/guides/${category}/${guide}/demo.html` });
      return res.end();
    }

    const contentType = MIME_TYPES[path.posix.extname(asset).toLowerCase()];
    if (!contentType) return send(res, 403, 'Unsupported file extension');

    try {
      const upstream = await fetch(`${rawBaseUrl}/${owner}/modern-web-guidance-src/${ref}/guides/${segments.join('/')}`, {
        method: req.method,
        headers: { 'User-Agent': 'mwg-demo-proxy' },
      });
      if (!upstream.ok) return send(res, upstream.status, `Upstream returned ${upstream.status}`);
      res.writeHead(200, { ...HEADERS, 'Content-Type': contentType, 'Cache-Control': 'public, max-age=60' });
      if (req.method === 'HEAD' || !upstream.body) return res.end();
      await pipeline(upstream.body, res);
    } catch {
      send(res, 502, 'Bad Gateway');
    }
  };
}

const proxy = createProxyHandler();
module.exports = { proxy, createProxyHandler };

if (require.main === module) {
  const port = Number(process.env.PORT) || 8080;
  http.createServer(proxy).listen(port, () => console.log(`mwg-demo-proxy listening on http://localhost:${port}`));
}
