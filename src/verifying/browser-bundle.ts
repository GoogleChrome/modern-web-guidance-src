/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import path from 'node:path';

let cachedBundle: string | null = null;

/**
 * Loads the browser-side audit IIFE bundle (`window.__mwgAudit`).
 *
 * In source mode (`node --test` / `gd verify`), compiles `browser-audit.ts`
 * on the fly via esbuild. In `dist/skills-cli`, `build-dist.ts` replaces this
 * module at bundle time with the pre-minified IIFE string so `verify.mjs` has
 * zero runtime dependency on esbuild.
 */
export async function loadBrowserAuditBundle(): Promise<string> {
  if (cachedBundle) return cachedBundle;
  const esbuildPkg = 'esbuild';
  const esbuild = (await import(esbuildPkg)) as typeof import('esbuild');
  const entry = path.join(import.meta.dirname, 'browser-audit.ts');
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: '__mwgAudit',
    minify: true,
    write: false,
    legalComments: 'none',
  });
  cachedBundle = result.outputFiles[0].text;
  return cachedBundle;
}
