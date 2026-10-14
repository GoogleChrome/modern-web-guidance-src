import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { Storage } from "@google-cloud/storage";
import { outDir } from "../../core/paths.ts";
import {
  createPrng,
  createQueryRecord,
  DEFAULT_GCP_PROJECT,
  DEFAULT_RAG_EVALS_BUCKET,
  DEFAULT_WILD_CACHE_DIR,
  isRecord,
  normalizeQuery,
  parseQueriesJsonl,
  serializeQrelsJsonl,
  serializeQueriesJsonl,
  sha256,
  WILD_DATASET_FILES,
  type DatasetManifest,
  type QrelRecord,
  type QueryRecord,
  type QueryStratum,
} from "./dataset.ts";
import { DEFAULT_JUDGE_MODEL, RUBRIC_VERSION } from "./judge-prompts.ts";
import { fillJudgmentsForDataset, loadCorpusForPooling } from "./judge-fill.ts";

export const DEFAULT_TRAFFIC_SAMPLE = 300;
export const DEFAULT_LOWSIM_SAMPLE = 200;
export const DEFAULT_LOWSIM_THRESHOLD = 0.4;
export const LOWSIM_EVENT_RATIO = 0.5;
export const DEFAULT_WILD_SEED = 2026;
export const DEFAULT_WINDOW_DAYS = 90;

const F1_SQL_BIN = process.env.F1_SQL_BIN || "/google/bin/releases/f1-team/public/f1-sql";
const F1_TABLE = process.env.MWG_F1_TABLE || "gleam_core_team.ModernWebGuidanceLogs.all";
const F1_ACCESS_REASON = process.env.MWG_F1_ACCESS_REASON || "b/449859979 -- MWG telemetry dashboard";

export interface RawWildSearchEvent {
  query: string;
  topSimilarity?: number | null;
}

/**
 * Aggregates raw search telemetry events by normalized query text, excluding any queries
 * already present in `existingNormalizedQueries`, and samples:
 * 1) `trafficCount` queries weighted by frequency without replacement (Efraimidis-Spirakis)
 * 2) `lowSimCount` queries uniformly from distinct queries whose events mostly had `topSimilarity < lowSimThreshold`.
 */
export function sampleWildQueries(
  events: Iterable<RawWildSearchEvent>,
  existingNormalizedQueries: ReadonlySet<string>,
  options: {
    trafficCount?: number;
    lowSimCount?: number;
    lowSimThreshold?: number;
    seed?: number;
    idPrefix?: string;
  } = {}
): QueryRecord[] {
  const trafficCount = options.trafficCount ?? DEFAULT_TRAFFIC_SAMPLE;
  const lowSimCount = options.lowSimCount ?? DEFAULT_LOWSIM_SAMPLE;
  const lowSimThreshold = options.lowSimThreshold ?? DEFAULT_LOWSIM_THRESHOLD;
  const rand = createPrng(options.seed ?? DEFAULT_WILD_SEED);
  const idPrefix = options.idPrefix ?? "w";

  const stats = new Map<string, { count: number; raw: string; lowCount: number }>();
  for (const ev of events) {
    const norm = normalizeQuery(ev.query);
    if (!norm || existingNormalizedQueries.has(norm)) continue;
    const top = ev.topSimilarity == null ? NaN : Number(ev.topSimilarity);
    const isLow = Number.isFinite(top) && top < lowSimThreshold ? 1 : 0;
    const entry = stats.get(norm);
    if (entry) {
      entry.count++;
      entry.lowCount += isLow;
    } else {
      stats.set(norm, { count: 1, raw: ev.query.trim(), lowCount: isLow });
    }
  }

  const pool = [...stats.entries()];
  const sampled: QueryRecord[] = [];
  const taken = new Set<string>();
  const pushSample = (s: { raw: string; count: number }, stratum: QueryStratum) => {
    sampled.push(
      createQueryRecord({
        qid: `${idPrefix}${String(sampled.length).padStart(4, "0")}`,
        query: s.raw,
        stratum,
        freq: s.count,
      })
    );
  };

  const trafficRanked = pool
    .map(([norm, s]) => ({ norm, s, key: Math.pow(rand(), 1 / s.count) }))
    .sort((a, b) => b.key - a.key);

  for (const { norm, s } of trafficRanked) {
    if (sampled.length >= trafficCount) break;
    taken.add(norm);
    pushSample(s, "traffic");
  }

  const lowSimRanked = pool
    .filter(([norm, s]) => !taken.has(norm) && s.lowCount / s.count > LOWSIM_EVENT_RATIO)
    .map(([norm, s]) => ({ norm, s, key: rand() }))
    .sort((a, b) => a.key - b.key);

  for (const { s } of lowSimRanked) {
    if (sampled.length >= trafficCount + lowSimCount) break;
    pushSample(s, "lowsim");
  }

  return sampled;
}

function buildF1SearchExportSql(days: number): string {
  return `SET access_reason = '${F1_ACCESS_REASON}';
SELECT
  search_result.query AS query,
  IF(ARRAY_LENGTH(search_result.search_items) > 0, ROUND(CAST(search_result.search_items[OFFSET(0)].similarity AS NUMERIC), 4), NULL) AS top_similarity
FROM ${F1_TABLE}
WHERE search_result IS NOT NULL
  AND search_result.query IS NOT NULL
  AND TRIM(search_result.query) != ''
  AND _PARTITION_DATE >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY);
`;
}

function exportSearchEventsFromF1(days: number, workDir: string): string {
  fs.mkdirSync(workDir, { recursive: true });
  const sqlPath = path.join(workDir, "export-wild.sql");
  const jsonlPath = path.join(workDir, "export-wild.jsonl");
  fs.writeFileSync(sqlPath, buildF1SearchExportSql(days));
  execFileSync(F1_SQL_BIN, ["readonly", `--input_file=${sqlPath}`, `--output_file=${jsonlPath}`], {
    stdio: "inherit",
  });
  return jsonlPath;
}

async function readEventsJsonl(jsonlPath: string): Promise<RawWildSearchEvent[]> {
  const events: RawWildSearchEvent[] = [];
  const rl = readline.createInterface({ input: fs.createReadStream(jsonlPath) });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const parsed: unknown = JSON.parse(line);
    if (!isRecord(parsed) || typeof parsed.query !== "string") continue;
    const topSim = parsed.top_similarity ?? parsed.topSimilarity;
    events.push({
      query: parsed.query,
      topSimilarity: typeof topSim === "number" || typeof topSim === "string" ? Number(topSim) : null,
    });
  }
  return events;
}

async function fetchExistingWildState(
  bucketName = DEFAULT_RAG_EVALS_BUCKET,
  projectId = DEFAULT_GCP_PROJECT
): Promise<{ nextVersion: string; existingNormalized: Set<string> }> {
  const storage = new Storage({ projectId });
  const bucket = storage.bucket(bucketName);
  const [files] = await bucket.getFiles();

  const queryFiles = files.filter((f) => /^v\d+\/wild-queries\.jsonl$/.test(f.name));
  const versionNums = queryFiles.map((f) => Number(f.name.match(/^v(\d+)/)?.[1] ?? 0));

  const existingNormalized = new Set<string>();
  for (const file of queryFiles) {
    const [bytes] = await file.download();
    for (const q of parseQueriesJsonl(bytes.toString("utf8"), file.name)) {
      existingNormalized.add(normalizeQuery(q.query));
    }
  }

  const maxVersion = versionNums.length > 0 ? Math.max(...versionNums) : 0;
  return {
    nextVersion: `v${maxVersion + 1}`,
    existingNormalized,
  };
}

export interface RefreshWildOptions {
  targetVersion?: string;
  days?: number;
  fromJsonl?: string;
  dryRun?: boolean;
  live?: boolean;
}

export async function refreshWildDataset(
  options: RefreshWildOptions = {}
): Promise<{ version: string; queryCount: number }> {
  const days = options.days ?? DEFAULT_WINDOW_DAYS;
  const { nextVersion, existingNormalized } = await fetchExistingWildState();
  const targetVersion = options.targetVersion ?? nextVersion;
  const versionDir = path.join(DEFAULT_WILD_CACHE_DIR, targetVersion);
  fs.mkdirSync(versionDir, { recursive: true });

  const jsonlPath = options.fromJsonl ?? exportSearchEventsFromF1(days, path.join(outDir, "benchmarks/f1-tmp"));
  const events = await readEventsJsonl(jsonlPath);
  const sampled = sampleWildQueries(events, existingNormalized, { idPrefix: `${targetVersion}_` });

  const corpus = loadCorpusForPooling();
  const { qrels } = await fillJudgmentsForDataset(sampled, new Map<string, QrelRecord>(), corpus, {
    batch: !options.live,
  });

  const orderedQrels = sampled.map((q) => {
    const r = qrels.get(q.qid);
    if (!r) throw new Error(`Missing judgment for sampled query "${q.qid}"`);
    return r;
  });

  const queriesContent = serializeQueriesJsonl(sampled);
  const qrelsContent = serializeQrelsJsonl(orderedQrels);
  const manifest: DatasetManifest = {
    version: targetVersion,
    createdAt: new Date().toISOString(),
    window: `${days}d`,
    judgeModel: orderedQrels[0]?.judgeModel ?? DEFAULT_JUDGE_MODEL,
    rubricVersion: RUBRIC_VERSION,
    files: {
      "wild-queries.jsonl": { rows: sampled.length, sha256: sha256(queriesContent) },
      "wild-qrels.jsonl": { rows: orderedQrels.length, sha256: sha256(qrelsContent) },
    },
  };

  fs.writeFileSync(path.join(versionDir, "wild-queries.jsonl"), queriesContent);
  fs.writeFileSync(path.join(versionDir, "wild-qrels.jsonl"), qrelsContent);
  fs.writeFileSync(path.join(versionDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  if (!options.dryRun) {
    const storage = new Storage({ projectId: DEFAULT_GCP_PROJECT });
    const bucket = storage.bucket(DEFAULT_RAG_EVALS_BUCKET);
    for (const fileName of WILD_DATASET_FILES) {
      await bucket.upload(path.join(versionDir, fileName), {
        destination: `${targetVersion}/${fileName}`,
      });
    }
  }

  return { version: targetVersion, queryCount: sampled.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({
    options: {
      "from-jsonl": { type: "string" },
      version: { type: "string" },
      days: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      live: { type: "boolean", default: false },
    },
  });
  const result = await refreshWildDataset({
    fromJsonl: values["from-jsonl"],
    targetVersion: values.version,
    days: values.days ? Number(values.days) : undefined,
    dryRun: values["dry-run"],
    live: values.live,
  });
  console.log(`Refreshed ${result.version} (${result.queryCount} queries)`);
}
