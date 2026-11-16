import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { startTargetServer } from './target-server.ts';

describe('startTargetServer', () => {
  test('serves plain statikk targets via statikk JS API with index, nested index, and 404 for missing/parent/dotfiles', async () => {
    const outer = fs.mkdtempSync(path.join(os.tmpdir(), 'target-server-static-'));
    const dir = path.join(outer, 'app');
    fs.mkdirSync(dir);
    try {
      fs.writeFileSync(path.join(outer, 'secret.txt'), 'secret');
      fs.writeFileSync(path.join(dir, '.env'), 'SECRET=1');
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({ scripts: { start: 'pnpm dlx statikk --port ${PORT:-11222}' } })
      );
      fs.writeFileSync(path.join(dir, 'index.html'), '<h1>Home</h1>');
      fs.writeFileSync(path.join(dir, 'about.html'), '<h1>About</h1>');
      fs.mkdirSync(path.join(dir, 'nested'));
      fs.writeFileSync(path.join(dir, 'nested', 'index.html'), '<h1>Nested</h1>');
      fs.writeFileSync(path.join(dir, 'app.js'), 'console.log(1);');

      const server = await startTargetServer(dir, { quiet: true });
      try {
        const home = await fetch(server.url);
        assert.strictEqual(home.status, 200);
        assert.match(home.headers.get('content-type') || '', /^text\/html\b/);
        assert.strictEqual(await home.text(), '<h1>Home</h1>');

        const about = await fetch(new URL('/about.html', server.url));
        assert.strictEqual(about.status, 200);
        assert.strictEqual(await about.text(), '<h1>About</h1>');

        const nested = await fetch(new URL('/nested/', server.url));
        assert.strictEqual(nested.status, 200);
        assert.strictEqual(await nested.text(), '<h1>Nested</h1>');

        const js = await fetch(new URL('/app.js', server.url));
        assert.strictEqual(js.status, 200);
        assert.match(js.headers.get('content-type') || '', /^text\/javascript\b/);

        const missing = await fetch(new URL('/nope', server.url));
        assert.strictEqual(missing.status, 404);

        const traversal = await fetch(new URL('/..%2Fsecret.txt', server.url));
        assert.strictEqual(traversal.status, 404);

        const dotfile = await fetch(new URL('/.env', server.url));
        assert.strictEqual(dotfile.status, 404);
      } finally {
        await server.stop();
      }
    } finally {
      fs.rmSync(outer, { recursive: true, force: true });
    }
  });

  test('falls back to localhost target file URL when package.json is absent, or throws without targetFile', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'target-server-no-pkg-'));
    try {
      const server = await startTargetServer(dir, { targetFile: path.join(dir, 'demo.html') });
      assert.strictEqual(server.url, 'http://localhost/demo.html');
      await server.stop();

      await assert.rejects(() => startTargetServer(dir), /package\.json not found/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('throws when package.json lacks a start script', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'target-server-no-start-'));
    try {
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'broken', scripts: {} }));
      await assert.rejects(() => startTargetServer(dir), /missing a "start" script/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
