import { test as base } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, spawnSync } from 'child_process';
import * as net from 'net';

export type ServerWorkerFixtures = {
  TARGET_URL: string;
};

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, () => {
      const addr = srv.address() as net.AddressInfo;
      const port = addr.port;
      srv.close(() => resolve(port));
    });
  });
}

export const test = base.extend<{}, ServerWorkerFixtures>({
  // eslint-disable-next-line no-empty-pattern
  TARGET_URL: [async ({}, use) => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable not set.');
    }
    
    if (!fs.existsSync(targetFile)) {
      throw new Error(`Target file not found: ${targetFile}`);
    }
    
    const targetDir = path.dirname(targetFile);
    const pkgJsonPath = path.join(targetDir, 'package.json');
    const demoName = path.basename(targetFile);

    console.log(`[TEST-FIXTURE] targetFile: ${targetFile}`);
    console.log(`[TEST-FIXTURE] targetDir: ${targetDir}`);
    console.log(`[TEST-FIXTURE] pkgJsonPath: ${pkgJsonPath}`);
    console.log(`[TEST-FIXTURE] pkgJsonExists: ${fs.existsSync(pkgJsonPath)}`);

    if (!fs.existsSync(pkgJsonPath)) {
      await use(`http://localhost/${demoName}`);
      return;
    }

    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

    if (pkgJson.scripts && pkgJson.scripts.build) {
      const buildResult = spawnSync('pnpm', ['run', 'build'], {
        cwd: targetDir,
        stdio: 'ignore',
        shell: true
      });
      if (buildResult.status !== 0) {
        throw new Error(`pnpm build failed in ${targetDir}`);
      }
    }

    if (!pkgJson.scripts || !pkgJson.scripts.start) {
      await use(`http://localhost/${demoName}`);
      return;
    }

    const port = await getFreePort();
    const serverProcess = spawn('pnpm', ['run', 'start'], {
      cwd: targetDir,
      env: { ...process.env, PORT: port.toString() },
      detached: true,
      stdio: 'ignore'
    });

    let isReady = false;
    const url = `http://localhost:${port}`;
    for (let i = 0; i < 60; i++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          isReady = true;
          break;
        }
      } catch (e) {
        // ignore
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!isReady) {
      if (serverProcess.pid) {
        try { process.kill(-serverProcess.pid); } catch (e) {}
      }
      throw new Error(`Server failed to start on port ${port} within 60s`);
    }

    process.env.TARGET_URL = url; // Exporting so legacy tests might use it if they read from process.env

    await use(url);

    if (serverProcess.pid) {
      try { process.kill(-serverProcess.pid); } catch (e) {}
    }
  }, { scope: 'worker', timeout: 120000 }]
});

export { expect } from '@playwright/test';
