import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Storage } from "@google-cloud/storage";
import { outDir, rootDir } from "../../core/paths.ts";
import { Agents } from "../../harness/config.ts";

export type Grade = 0 | 1 | 2;
export type QueryScope = "in_domain" | "out_of_domain";
export type PublicDatasetName = "harness" | "oos";
export type QueryStratum = "traffic" | "lowsim" | "head" | "tail" | "traffic2" | "far" | "near" | Agents | (string & {});

export interface QueryRecord {
  qid: string;
  query: string;
  stratum?: QueryStratum;
  split?: "dev" | "test";
  freq?: number;
  words?: number;
  expectedGuide?: string;
  agent?: Agents;
  runDate?: string;
  calledList?: boolean;
  retriedSearch?: boolean;
  retrievedGuides?: string[];
}

export interface GuideGrade {
  id: string;
  grade: Grade;
  reason?: string;
}

export interface QrelRecord {
  qid: string;
  query: string;
  scope: QueryScope;
  needs: string[];
  grades: GuideGrade[];
  judgeModel: string;
  rubricVersion: string;
}

export interface DatasetFileEntry {
  rows: number;
  sha256: string;
}

export interface DatasetManifest {
  version: string;
  createdAt: string;
  window?: string;
  judgeModel: string;
  rubricVersion: string;
  files: Record<string, DatasetFileEntry>;
}

export interface LoadedDataset {
  name: string;
  queries: QueryRecord[];
  qrels: Map<string, QrelRecord>;
  manifest?: DatasetManifest;
}

export const DEFAULT_WILD_VERSION = "v2";
export const DEFAULT_RAG_EVALS_BUCKET = process.env.RAG_EVALS_BUCKET || "guidance-rag-evals";
export const DEFAULT_GCP_PROJECT = process.env.RAG_EVALS_GCP_PROJECT || "chrome-kiwi-air-force-dev";
export const DEFAULT_PUBLIC_DATA_DIR = path.join(rootDir, "src/rag/benchmarks/data");
export const DEFAULT_WILD_CACHE_DIR = path.join(outDir, "benchmarks/wild");
export const WILD_DATASET_FILES = ["manifest.json", "wild-queries.jsonl", "wild-qrels.jsonl"] as const;

const VALID_AGENTS = new Set<string>(Object.values(Agents));

export function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

export function isGrade(val: unknown): val is Grade {
  return val === 0 || val === 1 || val === 2;
}

export function isQueryScope(val: unknown): val is QueryScope {
  return val === "in_domain" || val === "out_of_domain";
}

function isAgent(val: unknown): val is Agents {
  return typeof val === "string" && VALID_AGENTS.has(val);
}

export function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function countWords(query: string): number {
  return query.trim().split(/\s+/).filter(Boolean).length;
}

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export function createQueryRecord(
  fields: Omit<QueryRecord, "words"> & { words?: number }
): QueryRecord {
  const rec: QueryRecord = {
    ...fields,
    words: fields.words ?? countWords(fields.query),
  };
  if (fields.split !== undefined) rec.split = fields.split;
  return rec;
}

/** Deterministic Mulberry32 PRNG returning values in [0, 1). */
export function createPrng(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function validateQueryRecord(
  raw: unknown,
  sourceLabel = "queries.jsonl",
  line?: number
): QueryRecord {
  const loc = line !== undefined ? `${sourceLabel}:${line}` : sourceLabel;
  if (!isRecord(raw) || typeof raw.qid !== "string" || !raw.qid || typeof raw.query !== "string" || !raw.query.trim()) {
    throw new Error(`Invalid query record at ${loc}: missing qid or query`);
  }
  if (raw.agent !== undefined && !isAgent(raw.agent)) {
    throw new Error(`Invalid agent "${String(raw.agent)}" at ${loc}`);
  }
  if (raw.split !== undefined && raw.split !== "dev" && raw.split !== "test") {
    throw new Error(`Invalid split "${String(raw.split)}" at ${loc}: expected "dev" or "test"`);
  }
  if (raw.calledList !== undefined && typeof raw.calledList !== "boolean") {
    throw new Error(`Invalid calledList at ${loc}: expected boolean`);
  }
  if (raw.retriedSearch !== undefined && typeof raw.retriedSearch !== "boolean") {
    throw new Error(`Invalid retriedSearch at ${loc}: expected boolean`);
  }
  if (
    raw.retrievedGuides !== undefined &&
    (!Array.isArray(raw.retrievedGuides) ||
      !raw.retrievedGuides.every((guide: unknown) => typeof guide === "string" && guide.trim().length > 0))
  ) {
    throw new Error(`Invalid retrievedGuides at ${loc}: expected array of non-empty strings`);
  }

  const fields: Omit<QueryRecord, "words"> & { words?: number } = {
    qid: raw.qid,
    query: raw.query,
    stratum: typeof raw.stratum === "string" ? raw.stratum : undefined,
    freq: typeof raw.freq === "number" ? raw.freq : undefined,
    words: typeof raw.words === "number" ? raw.words : undefined,
    expectedGuide: typeof raw.expectedGuide === "string" ? raw.expectedGuide : undefined,
    agent: raw.agent,
    runDate: typeof raw.runDate === "string" ? raw.runDate : undefined,
    split: raw.split === "dev" || raw.split === "test" ? raw.split : undefined,
  };
  if (typeof raw.calledList === "boolean") fields.calledList = raw.calledList;
  if (typeof raw.retriedSearch === "boolean") fields.retriedSearch = raw.retriedSearch;
  if (Array.isArray(raw.retrievedGuides)) {
    fields.retrievedGuides = raw.retrievedGuides.map((guide) => String(guide));
  }

  return createQueryRecord(fields);
}

export function parseQueriesJsonl(content: string, sourceLabel = "queries.jsonl"): QueryRecord[] {
  const lines = content.trim().split("\n").filter(Boolean);
  const seenQids = new Set<string>();
  const records: QueryRecord[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw: unknown = JSON.parse(lines[i]);
    const record = validateQueryRecord(raw, sourceLabel, i + 1);
    if (seenQids.has(record.qid)) {
      throw new Error(`Duplicate qid "${record.qid}" at ${sourceLabel}:${i + 1}`);
    }
    seenQids.add(record.qid);
    records.push(record);
  }

  return records;
}

export function parseQrelsJsonl(content: string, sourceLabel = "qrels.jsonl"): Map<string, QrelRecord> {
  const lines = content.trim().split("\n").filter(Boolean);
  const qrels = new Map<string, QrelRecord>();

  for (let i = 0; i < lines.length; i++) {
    const raw: unknown = JSON.parse(lines[i]);
    if (
      !isRecord(raw) ||
      typeof raw.qid !== "string" ||
      !raw.qid ||
      typeof raw.query !== "string" ||
      !isQueryScope(raw.scope) ||
      !Array.isArray(raw.needs) ||
      !Array.isArray(raw.grades) ||
      typeof raw.judgeModel !== "string" ||
      typeof raw.rubricVersion !== "string"
    ) {
      throw new Error(`Invalid qrel record at ${sourceLabel}:${i + 1}`);
    }
    if (qrels.has(raw.qid)) {
      throw new Error(`Duplicate qid "${raw.qid}" in ${sourceLabel}:${i + 1}`);
    }

    const seenGuides = new Set<string>();
    const grades: GuideGrade[] = raw.grades.map((g: unknown) => {
      if (!isRecord(g) || typeof g.id !== "string" || !g.id || !isGrade(g.grade)) {
        throw new Error(`Invalid grade entry for qid "${raw.qid}" at ${sourceLabel}:${i + 1}`);
      }
      if (seenGuides.has(g.id)) {
        throw new Error(`Duplicate grade for guide "${g.id}" in qid "${raw.qid}" at ${sourceLabel}:${i + 1}`);
      }
      seenGuides.add(g.id);
      return {
        id: g.id,
        grade: g.grade,
        reason: typeof g.reason === "string" ? g.reason : undefined,
      };
    });

    const needs = raw.needs.map((n: unknown) => {
      if (typeof n !== "string") throw new Error(`Invalid need entry for qid "${raw.qid}" at ${sourceLabel}:${i + 1}`);
      return n;
    });

    qrels.set(raw.qid, {
      qid: raw.qid,
      query: raw.query,
      scope: raw.scope,
      needs,
      grades,
      judgeModel: raw.judgeModel,
      rubricVersion: raw.rubricVersion,
    });
  }

  return qrels;
}

export function parseManifestJson(content: string, sourceLabel = "manifest.json"): DatasetManifest {
  const raw: unknown = JSON.parse(content);
  if (
    !isRecord(raw) ||
    typeof raw.version !== "string" ||
    typeof raw.createdAt !== "string" ||
    typeof raw.judgeModel !== "string" ||
    typeof raw.rubricVersion !== "string" ||
    !isRecord(raw.files)
  ) {
    throw new Error(`Invalid dataset manifest in ${sourceLabel}`);
  }
  const files: Record<string, DatasetFileEntry> = {};
  for (const [name, entry] of Object.entries(raw.files)) {
    if (!isRecord(entry) || typeof entry.rows !== "number" || typeof entry.sha256 !== "string") {
      throw new Error(`Invalid file entry "${name}" in ${sourceLabel}`);
    }
    files[name] = { rows: entry.rows, sha256: entry.sha256 };
  }
  return {
    version: raw.version,
    createdAt: raw.createdAt,
    window: typeof raw.window === "string" ? raw.window : undefined,
    judgeModel: raw.judgeModel,
    rubricVersion: raw.rubricVersion,
    files,
  };
}

export function serializeJsonl<T>(records: Iterable<T>): string {
  return Array.from(records, (r) => JSON.stringify(r)).join("\n") + "\n";
}

export function serializeQueriesJsonl(records: Iterable<QueryRecord>): string {
  return serializeJsonl(records);
}

export function serializeQrelsJsonl(records: Iterable<QrelRecord>): string {
  return serializeJsonl(records);
}

export function loadDatasetFromFiles(name: string, queriesPath: string, qrelsPath: string): LoadedDataset {
  const queries = parseQueriesJsonl(fs.readFileSync(queriesPath, "utf8"), queriesPath);
  const qrels = parseQrelsJsonl(fs.readFileSync(qrelsPath, "utf8"), qrelsPath);
  return { name, queries, qrels };
}

export function loadPublicDataset(name: PublicDatasetName, dataDir = DEFAULT_PUBLIC_DATA_DIR): LoadedDataset {
  return loadDatasetFromFiles(
    name,
    path.join(dataDir, `${name}-queries.jsonl`),
    path.join(dataDir, `${name}-qrels.jsonl`)
  );
}

function verifyAndLoadWildCache(versionDir: string, version: string): LoadedDataset {
  const manifestPath = path.join(versionDir, "manifest.json");
  const queriesPath = path.join(versionDir, "wild-queries.jsonl");
  const qrelsPath = path.join(versionDir, "wild-qrels.jsonl");

  const manifest = parseManifestJson(fs.readFileSync(manifestPath, "utf8"), manifestPath);
  const queriesContent = fs.readFileSync(queriesPath, "utf8");
  const qrelsContent = fs.readFileSync(qrelsPath, "utf8");

  const expectedQueriesHash = manifest.files["wild-queries.jsonl"]?.sha256;
  const expectedQrelsHash = manifest.files["wild-qrels.jsonl"]?.sha256;
  if (!expectedQueriesHash || sha256(queriesContent) !== expectedQueriesHash) {
    throw new Error(`SHA-256 mismatch for ${queriesPath}`);
  }
  if (!expectedQrelsHash || sha256(qrelsContent) !== expectedQrelsHash) {
    throw new Error(`SHA-256 mismatch for ${qrelsPath}`);
  }

  return {
    name: `wild-${version}`,
    queries: parseQueriesJsonl(queriesContent, queriesPath),
    qrels: parseQrelsJsonl(qrelsContent, qrelsPath),
    manifest,
  };
}

export function filterDatasetBySplit(dataset: LoadedDataset, split: "dev" | "test"): LoadedDataset {
  const queries = dataset.queries.filter((q) => q.split === split);
  const qids = new Set(queries.map((q) => q.qid));
  const qrels = new Map<string, QrelRecord>();
  for (const [qid, r] of dataset.qrels) {
    if (qids.has(qid)) qrels.set(qid, r);
  }
  return {
    name: `${dataset.name}-${split}`,
    queries,
    qrels,
    manifest: dataset.manifest,
  };
}

/**
 * Loads the restricted Wild benchmark set (`wild-queries.jsonl` + `wild-qrels.jsonl`),
 * reading from the local gitignored cache (`out/benchmarks/wild/<version>/`) when valid
 * and downloading from `gs://guidance-rag-evals/<version>/` otherwise.
 */
export async function ensureWildDataset(
  version = DEFAULT_WILD_VERSION,
  options: { cacheDir?: string; bucketName?: string; projectId?: string; allowDownload?: boolean } = {}
): Promise<LoadedDataset> {
  const cacheDir = options.cacheDir ?? DEFAULT_WILD_CACHE_DIR;
  const bucketName = options.bucketName ?? DEFAULT_RAG_EVALS_BUCKET;
  const projectId = options.projectId ?? DEFAULT_GCP_PROJECT;
  const allowDownload = options.allowDownload ?? true;
  const versionDir = path.join(cacheDir, version);

  try {
    return verifyAndLoadWildCache(versionDir, version);
  } catch (err) {
    if (!allowDownload) throw err;
  }

  fs.mkdirSync(versionDir, { recursive: true });
  const storage = new Storage({ projectId });
  const bucket = storage.bucket(bucketName);

  for (const fileName of WILD_DATASET_FILES) {
    const destPath = path.join(versionDir, fileName);
    const [bytes] = await bucket.file(`${version}/${fileName}`).download();
    fs.writeFileSync(destPath, bytes);
  }

  return verifyAndLoadWildCache(versionDir, version);
}
