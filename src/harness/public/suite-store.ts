import fs from 'node:fs';
import path from 'node:path';
import { Storage } from '@google-cloud/storage';
import { mapWithConcurrency } from '../../core/concurrency.ts';

/**
 * Read-only access to raw eval suites. The builder only needs two operations,
 * so both the GCS bucket and a local directory (for tests and offline runs)
 * implement this interface.
 */
export interface SuiteStore {
  /** Every suite that has an `evals.json`, with enough metadata to skip unchanged ones. */
  listSuites(): Promise<SuiteRef[]>;
  /** File contents, or `undefined` if the file does not exist. */
  readFile(relPath: string): Promise<Buffer | undefined>;
}

export interface SuiteRef {
  id: string;
  /** Changes whenever the suite's `evals.json` is rewritten; opaque. */
  generation: string;
  /** When the suite's `evals.json` was written. Used for retention. */
  createdAt: Date;
}

const PROJECT_ID = 'chrome-kiwi-air-force-dev';
const BUCKET_NAME = 'guidance-evals';

/** Reads suites from `gs://guidance-evals` using Application Default Credentials. */
export class GcsSuiteStore implements SuiteStore {
  private readonly bucket;

  constructor(bucketName = BUCKET_NAME) {
    this.bucket = new Storage({ projectId: PROJECT_ID }).bucket(bucketName);
  }

  /**
   * Lists top-level prefixes, then reads each suite's `evals.json` metadata
   * concurrently. A `matchGlob` listing would be one call but makes GCS scan
   * every object in the bucket (~16 s for ~1.5M objects); this takes well
   * under a second for a few hundred suites.
   */
  async listSuites(): Promise<SuiteRef[]> {
    const prefixes: string[] = [];
    let pageToken: string | undefined;
    do {
      const [, nextQuery, apiResponse] = await this.bucket.getFiles({ delimiter: '/', autoPaginate: false, pageToken });
      prefixes.push(...((apiResponse as { prefixes?: string[] } | undefined)?.prefixes ?? []));
      pageToken = (nextQuery as { pageToken?: string } | undefined)?.pageToken;
    } while (pageToken);

    const refs = await mapWithConcurrency(prefixes, 64, async prefix => {
      try {
        const [metadata] = await this.bucket.file(`${prefix}evals.json`).getMetadata();
        return {
          id: prefix.replace(/\/$/, ''),
          generation: String(metadata.generation ?? ''),
          createdAt: new Date(String(metadata.timeCreated ?? 0)),
        };
      } catch (err) {
        if (isNotFound(err)) {
          return undefined; // A folder with no evals.json is not a suite.
        }
        throw err;
      }
    });
    return refs.filter((ref): ref is SuiteRef => ref !== undefined);
  }

  async readFile(relPath: string): Promise<Buffer | undefined> {
    try {
      const [contents] = await this.bucket.file(relPath).download();
      return contents;
    } catch (err) {
      if (isNotFound(err)) {
        return undefined;
      }
      throw err;
    }
  }
}

function isNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 404;
}

/** Reads suites from a directory laid out like the bucket (`<root>/<suiteId>/...`). */
export class LocalSuiteStore implements SuiteStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  async listSuites(): Promise<SuiteRef[]> {
    const refs: SuiteRef[] = [];
    for (const entry of fs.readdirSync(this.root, { withFileTypes: true })) {
      const evalsPath = path.join(this.root, entry.name, 'evals.json');
      if (entry.isDirectory() && fs.existsSync(evalsPath)) {
        const stat = fs.statSync(evalsPath);
        refs.push({ id: entry.name, generation: String(stat.mtimeMs), createdAt: stat.mtime });
      }
    }
    return refs;
  }

  async readFile(relPath: string): Promise<Buffer | undefined> {
    const absolute = path.join(this.root, relPath);
    if (!absolute.startsWith(this.root + path.sep)) {
      throw new Error(`Refusing to read outside the store root: ${relPath}`);
    }
    return fs.existsSync(absolute) ? fs.readFileSync(absolute) : undefined;
  }
}
