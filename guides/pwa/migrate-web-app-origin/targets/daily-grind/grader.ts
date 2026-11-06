import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  test,
  expect,
  getTargetFiles,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function parseJsonSafe(filePath: string): any {
  try {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function getManifestFiles(): Array<{ file: string; content: any }> {
  const manifests: Array<{ file: string; content: any }> = [];
  for (const file of targetFiles) {
    if (file.endsWith('package.json') || file.includes('.well-known')) continue;
    if (file.endsWith('.json') || file.endsWith('.webmanifest')) {
      const parsed = parseJsonSafe(file);
      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        (parsed.name ||
          parsed.start_url ||
          parsed.migrate_to ||
          parsed.migrate_from ||
          parsed.display ||
          file.includes('manifest'))
      ) {
        manifests.push({ file, content: parsed });
      }
    }
  }
  return manifests;
}

function getOldManifest(): any {
  const manifests = getManifestFiles();
  if (manifests.length === 0) return null;

  // 1. Referenced in HTML <link rel="manifest">
  const docs = getHtmlDocuments(targetFiles);
  for (const doc of docs) {
    const link = doc.document.querySelector('link[rel="manifest"]');
    const href = link?.getAttribute('href');
    if (href) {
      const clean = href.replace(/^\//, '');
      const matched = manifests.find(
        (m) => m.file.endsWith(clean) || path.basename(m.file) === path.basename(clean)
      );
      if (matched) return matched.content;
    }
  }

  // 2. Manifest with migrate_to
  const withMigrateTo = manifests.find((m) => m.content.migrate_to);
  if (withMigrateTo) return withMigrateTo.content;

  // 3. Manifest in root app directory
  const rootDir = process.cwd();
  const rootManifest = manifests.find((m) => path.dirname(m.file) === rootDir);
  if (rootManifest) return rootManifest.content;

  return manifests[0]?.content;
}

function getNewManifest(): any {
  const manifests = getManifestFiles();
  if (manifests.length === 0) return null;

  // 1. Manifest in a subdirectory or with 'new' in path
  const subManifest = manifests.find((m) => {
    const rel = path.relative(process.cwd(), m.file);
    return rel.includes(path.sep) || rel.includes('new');
  });
  if (subManifest) return subManifest.content;

  // 2. Manifest with migrate_from
  const withMigrateFrom = manifests.find((m) => m.content.migrate_from);
  if (withMigrateFrom) return withMigrateFrom.content;

  // 3. Any manifest that is not the old manifest
  const oldContent = getOldManifest();
  const otherManifest = manifests.find((m) => m.content !== oldContent);
  if (otherManifest) return otherManifest.content;

  return null;
}

test.describe('Migrate Web App Origin Target Grader', () => {
  // Requirement 1: The old origin's manifest contains a migrate_to field pointing to the new origin.
  test("The old origin's manifest contains a migrate_to field pointing to the new origin", () => {
    const oldManifest = getOldManifest();
    const items = Array.isArray(oldManifest?.migrate_to)
      ? oldManifest.migrate_to
      : oldManifest?.migrate_to
        ? [oldManifest.migrate_to]
        : [];
    const hasMigrateToNewOrigin = items.some((item: any) => {
      if (typeof item === 'string') {
        return item.includes('new') || item.startsWith('http');
      }
      if (item && typeof item === 'object') {
        const target = item.id || item.install_url;
        return typeof target === 'string' && (target.includes('new') || target.startsWith('http'));
      }
      return false;
    });
    expect(hasMigrateToNewOrigin).toBe(true);
  });

  // Requirement 2: The new origin's manifest contains a migrate_from field pointing back to the old origin.
  test("The new origin's manifest contains a migrate_from field pointing back to the old origin", () => {
    const newManifest = getNewManifest();
    const items = Array.isArray(newManifest?.migrate_from)
      ? newManifest.migrate_from
      : newManifest?.migrate_from
        ? [newManifest.migrate_from]
        : [];
    const hasMigrateFromOldOrigin = items.some((item: any) => {
      if (typeof item === 'string') {
        return item.includes('old') || item.startsWith('http');
      }
      if (item && typeof item === 'object') {
        const target = item.id;
        return typeof target === 'string' && (target.includes('old') || target.startsWith('http'));
      }
      return false;
    });
    expect(hasMigrateFromOldOrigin).toBe(true);
  });

  // Requirement 3: The new origin's manifest contains an id.
  test("The new origin's manifest contains an id", () => {
    const newManifest = getNewManifest();
    const hasId = typeof newManifest?.id === 'string' && newManifest.id.trim().length > 0;
    expect(hasId).toBe(true);
  });

  // Requirement 4: A .well-known/web-app-origin-association file exists on the old origin and explicitly allows migration to the new manifest URL.
  test('A .well-known/web-app-origin-association file exists on the old origin and explicitly allows migration to the new manifest URL', () => {
    const rootDir = process.cwd();
    const assocFile =
      targetFiles.find(
        (f) => f.includes('.well-known') && f.includes('web-app-origin-association')
      ) || path.resolve(rootDir, '.well-known', 'web-app-origin-association');
    let allowsMigration = false;
    if (assocFile && fs.existsSync(assocFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(assocFile, 'utf8'));
        if (data && typeof data === 'object') {
          allowsMigration = Object.entries(data).some(([url, config]: [string, any]) => {
            const isUrl = url.startsWith('http://') || url.startsWith('https://');
            const allows =
              config && typeof config === 'object' && config.allow_migration === true;
            return isUrl && allows;
          });
        }
      } catch {
        allowsMigration = false;
      }
    }
    expect(allowsMigration).toBe(true);
  });

  // Requirement 5: The old app has a fallback UI with a link to the new app for browsers that do not support automatic migration.
  test('The old app has a fallback UI with a link to the new app for browsers that do not support automatic migration', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasFallbackLink = docs.some((d) => {
      const anchors = Array.from(d.document.querySelectorAll('a')) as any[];
      return anchors.some((a) => {
        const href = a.getAttribute('href') || '';
        const text = (a.textContent || '').toLowerCase();
        const container =
          a.closest('[role="region"], aside, [class*="migration"], [class*="banner"]') ||
          a.parentElement;
        const containerText = (
          (container?.textContent || '') +
          ' ' +
          (a.getAttribute('aria-label') || '')
        ).toLowerCase();

        const pointsToNewApp =
          href.includes('new-app') ||
          href.includes('new.') ||
          (href.startsWith('http') && !href.includes('unsplash'));
        const mentionsMigrationOrNew =
          containerText.includes('migrat') ||
          containerText.includes('moved') ||
          containerText.includes('new') ||
          text.includes('new');

        return pointsToNewApp && mentionsMigrationOrNew;
      });
    });
    expect(hasFallbackLink).toBe(true);
  });
});
