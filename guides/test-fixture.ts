import { test as base } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, spawnSync } from 'child_process';
import * as net from 'net';
import { fileURLToPath } from 'url';
import { parseHTML } from 'linkedom';
import { Project } from 'ts-morph';
import { extractTargetFilesFromPatch } from '../lib/patch-utils.ts';

export { expect } from '@playwright/test';

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
    const targetDir = process.cwd();

    const pkgJsonPath = path.join(targetDir, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
      throw new Error(`package.json not found in target directory: ${targetDir}`);
    }

    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

    if (pkgJson.scripts && pkgJson.scripts.build) {
      // Running install on base app
      const repoRoot = path.resolve(import.meta.dirname, '..');
      const lockfilePath = path.join(repoRoot, 'pnpm-lock.yaml');
      if (fs.existsSync(lockfilePath)) {
        fs.copyFileSync(lockfilePath, path.join(targetDir, 'pnpm-lock.yaml'));
      }
      console.log(`[TEST-FIXTURE] Running pnpm install in ${targetDir}`);
      const installResult = spawnSync('pnpm', ['--ignore-workspace', 'install', '--force'], {
        cwd: targetDir,
        stdio: 'ignore',
        shell: process.platform === 'win32'
      });
      if (installResult.status !== 0) {
        console.warn(`[TEST-FIXTURE] pnpm install failed in ${targetDir}`);
      }

      const buildResult = spawnSync('pnpm', ['--ignore-workspace', 'run', 'build'], {
        cwd: targetDir,
        stdio: 'ignore',
        shell: process.platform === 'win32'
      });
      if (buildResult.status !== 0) {
        throw new Error(`Failed to build target app in ${targetDir}`);
      }
    }

    if (!pkgJson.scripts || !pkgJson.scripts.start) {
      throw new Error(`package.json in ${targetDir} is missing a "start" script.`);
    }

    const port = await getFreePort();
    const serverProcess = spawn('pnpm', ['--ignore-workspace', 'run', 'start'], {
      cwd: targetDir,
      env: { ...process.env, PORT: port.toString() },
      detached: true,
      stdio: 'ignore',
      shell: process.platform === 'win32'
    });

    let isReady = false;
    let baseUrlPath = '/';
    const configPath = path.join(targetDir, 'astro.config.mjs');
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const baseMatch = configContent.match(/base:\s*['"`](.*?)['"`]/);
      if (baseMatch) {
        baseUrlPath = '/' + baseMatch[1].replace(/^\/|\/$/g, '') + '/';
      }
    }

    const url = `http://localhost:${port}${baseUrlPath}`;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
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
      throw new Error(`Server in ${targetDir} failed to start on port ${port}`);
    }

    process.env.TARGET_URL = url; // Exporting so legacy tests might use it if they read from process.env

    await use(url);

    if (serverProcess.pid) {
      try { process.kill(-serverProcess.pid); } catch (e) {}
    }
  }, { scope: 'worker', timeout: 60000 }]
});

const BASE_APP_DEFAULT_FILES: Record<string, string[]> = {
  'daily-grind': ['index.html'],
  'devtools-times': [
    'src/components/ArticleTeaser.astro',
    'src/layouts/Layout.astro',
    'src/styles/global.css',
    'src/components/SearchFlyout.tsx',
    'src/components/ReadingListFlyout.tsx',
  ],
};

export function getTargetFiles(testFileUrl: string): string[] {
  const patchFile = process.env.PATCH_FILE;
  if (!patchFile) {
    throw new Error('PATCH_FILE environment variable not set.');
  }

  const rootDir = process.cwd();
  const baseAppName = path.basename(path.dirname(fileURLToPath(testFileUrl)));
  const patchTargetFiles = extractTargetFilesFromPatch(patchFile);
  const defaultFiles = BASE_APP_DEFAULT_FILES[baseAppName] || [];
  const targetFiles = Array.from(new Set([...patchTargetFiles, ...defaultFiles]));
  return targetFiles.map((f: string) => path.resolve(rootDir, f));
}

const HTML_EXTS = /\.(html|htm|astro)$/i;
const CSS_EXTS = /\.css$/i;
const JS_EXTS = /\.(js|ts|tsx|jsx)$/i;

export function extractAllCss(files: string[]): string {
  const cssBlocks: string[] = [];
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    const content = fs.readFileSync(file, 'utf8');

    if (CSS_EXTS.test(file)) {
      cssBlocks.push(content);
    } else if (HTML_EXTS.test(file)) {
      try {
        const { document } = parseHTML(content);
        document.querySelectorAll('style').forEach((style: any) => {
          if (style.textContent) cssBlocks.push(style.textContent);
        });
        document.querySelectorAll('[style]').forEach((el: any) => {
          const inlineStyle = el.getAttribute('style');
          if (inlineStyle) cssBlocks.push(inlineStyle);
        });
      } catch {
        const styleMatches = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
        if (styleMatches) cssBlocks.push(...styleMatches);
      }
    } else if (JS_EXTS.test(file)) {
      const styleMatches = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
      if (styleMatches) {
        for (const match of styleMatches) {
          cssBlocks.push(match.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, ''));
        }
      }
    }
  }
  return cssBlocks.join('\n').replace(/\s+/g, ' ');
}

export function populateJsProject(project: Project, files: string[]): void {
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    const content = fs.readFileSync(file, 'utf8');

    if (JS_EXTS.test(file) && !HTML_EXTS.test(file)) {
      project.createSourceFile(file, content, { overwrite: true });
    } else if (HTML_EXTS.test(file)) {
      try {
        if (file.endsWith('.astro')) {
          const frontmatter = content.match(/^---[\r\n]+([\s\S]*?)[\r\n]+---/);
          if (frontmatter && frontmatter[1]) {
            project.createSourceFile(`${file}_frontmatter.ts`, frontmatter[1], { overwrite: true });
          }
        }
        const { document } = parseHTML(content);
        document.querySelectorAll('script').forEach((script: any, idx: number) => {
          if (script.textContent) {
            project.createSourceFile(`${file}_script_${idx}.ts`, script.textContent, { overwrite: true });
          }
        });
      } catch {
        // Fallback for non-standard HTML fragments
      }
    }
  }
}

export function getJsProject(files: string[]): Project {
  const project = new Project({ useInMemoryFileSystem: true });
  populateJsProject(project, files);
  return project;
}

export function getHtmlDocuments(files: string[]): Array<{ file: string; document: any }> {
  const docs: Array<{ file: string; document: any }> = [];
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    if (HTML_EXTS.test(file)) {
      const content = fs.readFileSync(file, 'utf8');
      docs.push({ file, document: parseHTML(content).document });
    }
  }
  return docs;
}
