import fs from 'node:fs';
import path from 'node:path';
import { Storage } from '@google-cloud/storage';

/**
 * Read-only access to raw eval suites. The builder only needs three
 * operations, so both the GCS bucket and a local directory (for tests and
 * offline runs) implement this interface.
 */
export interface SuiteStore {
  /** Top-level suite folder names. */
  listSuiteIds(): Promise<string[]>;
  /** File contents, or `undefined` if the file does not exist. */
  readFile(relPath: string): Promise<Buffer | undefined>;
}

const PROJECT_ID = 'chrome-kiwi-air-force-dev';
const BUCKET_NAME = 'guidance-evals';

/** Reads suites from `gs://guidance-evals` using Application Default Credentials. */
export class GcsSuiteStore implements SuiteStore {
  private readonly bucket;

  constructor(bucketName = BUCKET_NAME) {
    this.bucket = new Storage({ projectId: PROJECT_ID }).bucket(bucketName);
  }

  async listSuiteIds(): Promise<string[]> {
    const prefixes: string[] = [];
    let pageToken: string | undefined;
    do {
      const [, nextQuery, apiResponse] = await this.bucket.getFiles({
        delimiter: '/',
        autoPaginate: false,
        pageToken,
      });
      const page = (apiResponse as { prefixes?: string[] } | undefined)?.prefixes ?? [];
      prefixes.push(...page);
      pageToken = (nextQuery as { pageToken?: string } | undefined)?.pageToken;
    } while (pageToken);
    return prefixes.map(prefix => prefix.replace(/\/$/, ''));
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

  async listSuiteIds(): Promise<string[]> {
    return fs
      .readdirSync(this.root, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  }

  async readFile(relPath: string): Promise<Buffer | undefined> {
    const absolute = path.join(this.root, relPath);
    if (!absolute.startsWith(this.root + path.sep)) {
      throw new Error(`Refusing to read outside the store root: ${relPath}`);
    }
    return fs.existsSync(absolute) ? fs.readFileSync(absolute) : undefined;
  }
}
