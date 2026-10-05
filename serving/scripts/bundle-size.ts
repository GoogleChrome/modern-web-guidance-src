import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

export interface PackageBreakdown {
  [pkg: string]: number;
}

export interface ShippedFileStats {
  rawBytes: number;
  gzipBytes: number;
}

export interface BundleSnapshot {
  timestamp: string;
  target: string;
  npmPack?: {
    size: number;
    unpackedSize: number;
    entryCount: number;
    topFiles: Array<{ path: string; size: number }>;
  };
  searchBundle: {
    rawBytes: number;
    gzipBytes: number;
    packages: PackageBreakdown;
  };
  shippedFiles: Record<string, ShippedFileStats>;
}

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_MAP = new Int8Array(128);
B64_MAP.fill(-1);
for (let i = 0; i < B64_CHARS.length; i++) {
  B64_MAP[B64_CHARS.charCodeAt(i)] = i;
}

export function getPackageName(source: string): string {
  if (!source.includes("node_modules")) {
    return "serving/lib";
  }
  const norm = source.replace(/\\/g, "/");
  const pnpmIdx = norm.indexOf("/.pnpm/");
  if (pnpmIdx !== -1) {
    const afterPnpm = norm.slice(pnpmIdx + "/.pnpm/".length);
    const innerNm = afterPnpm.lastIndexOf("/node_modules/");
    if (innerNm !== -1) {
      const afterInner = afterPnpm.slice(innerNm + "/node_modules/".length);
      const parts = afterInner.split("/");
      return parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
    }
    const top = afterPnpm.split("/")[0];
    if (top === "tfjs-core") return "@tensorflow/tfjs-core";
    if (top === "tfjs-backend-cpu") return "@tensorflow/tfjs-backend-cpu";
    const atIdx = top.indexOf("@", 1);
    const raw = atIdx !== -1 ? top.slice(0, atIdx) : top;
    return raw.replace("+", "/");
  }

  const nm = "node_modules/";
  const lastNm = norm.lastIndexOf(nm);
  const after = norm.slice(lastNm + nm.length);
  const parts = after.split("/");
  return parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
}

export function decodeSourcemapBreakdown(
  jsCode: string,
  mapJson: { sources: string[]; mappings: string }
): { packages: PackageBreakdown; totalAccounted: number } {
  const jsLines = jsCode.split("\n");
  const lineMappings = mapJson.mappings.split(";");
  const bytesPerSource = new Float64Array(mapJson.sources.length);
  let unmappedBytes = 0;

  let sourceIdx = 0;
  let origLine = 0;
  let origCol = 0;
  let nameIdx = 0;

  for (let lineIndex = 0; lineIndex < jsLines.length; lineIndex++) {
    const lineStr = jsLines[lineIndex] ?? "";
    const lineLen = Buffer.byteLength(lineStr, "utf8");
    const isLastLine = lineIndex === jsLines.length - 1;
    const newlineByte = isLastLine ? 0 : 1;

    if (lineIndex >= lineMappings.length || !lineMappings[lineIndex]) {
      unmappedBytes += lineLen + newlineByte;
      continue;
    }

    const lineMap = lineMappings[lineIndex];
    let genCol = 0;
    const segments: Array<{ genCol: number; sourceIdx: number }> = [];
    let pos = 0;

    while (pos < lineMap.length) {
      if (lineMap[pos] === ",") {
        pos++;
        continue;
      }
      let fieldCount = 0;
      const fields = [0, 0, 0, 0, 0];
      while (pos < lineMap.length && lineMap[pos] !== "," && lineMap[pos] !== ";") {
        let result = 0;
        let shift = 0;
        let cont = true;
        while (cont && pos < lineMap.length) {
          const digit = B64_MAP[lineMap.charCodeAt(pos++)];
          if (digit === -1) {
            throw new Error(`Invalid base64 character in sourcemap at line ${lineIndex}, pos ${pos}`);
          }
          cont = (digit & 32) !== 0;
          result += (digit & 31) * Math.pow(2, shift);
          shift += 5;
        }
        const isNeg = (result & 1) === 1;
        const val = Math.floor(result / 2);
        fields[fieldCount++] = isNeg ? -val : val;
      }

      genCol += fields[0];
      let segSource = -1;
      if (fieldCount > 1) {
        sourceIdx += fields[1];
        segSource = sourceIdx;
      }
      if (fieldCount > 2) origLine += fields[2];
      if (fieldCount > 3) origCol += fields[3];
      if (fieldCount > 4) nameIdx += fields[4];

      segments.push({ genCol, sourceIdx: segSource });
    }

    if (segments.length === 0) {
      unmappedBytes += lineLen + newlineByte;
      continue;
    }

    if (segments[0].genCol > 0) {
      unmappedBytes += Buffer.byteLength(lineStr.slice(0, segments[0].genCol), "utf8");
    }

    for (let i = 0; i < segments.length; i++) {
      const startCol = segments[i].genCol;
      const endCol = i + 1 < segments.length ? segments[i + 1].genCol : lineStr.length;
      const segBytes = Buffer.byteLength(lineStr.slice(startCol, endCol), "utf8");
      const s = segments[i].sourceIdx;
      if (s >= 0 && s < bytesPerSource.length) {
        bytesPerSource[s] += segBytes;
      } else {
        unmappedBytes += segBytes;
      }
    }

    if (!isLastLine) {
      const lastSeg = segments[segments.length - 1];
      if (lastSeg && lastSeg.sourceIdx >= 0 && lastSeg.sourceIdx < bytesPerSource.length) {
        bytesPerSource[lastSeg.sourceIdx] += 1;
      } else {
        unmappedBytes += 1;
      }
    }
  }

  let totalMappedBytes = 0;
  const packages: PackageBreakdown = {};
  for (let i = 0; i < mapJson.sources.length; i++) {
    totalMappedBytes += bytesPerSource[i];
    const pkg = getPackageName(mapJson.sources[i]);
    packages[pkg] = (packages[pkg] || 0) + bytesPerSource[i];
  }

  packages["<unmapped/license>"] = unmappedBytes;
  const totalAccounted = totalMappedBytes + unmappedBytes;

  return { packages, totalAccounted };
}

function findFile(dir: string, fileName: string): string | null {
  const direct = path.join(dir, fileName);
  try {
    if (fs.statSync(direct).isFile()) return direct;
  } catch {}

  const queue = [dir];
  while (queue.length > 0) {
    const current = queue.shift()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== ".git") {
          queue.push(full);
        }
      } else if (entry.isFile() && entry.name === fileName) {
        return full;
      }
    }
  }
  return null;
}

export function measureDirectory(dir: string): BundleSnapshot {
  const searchPath = findFile(dir, "search.mjs");
  if (!searchPath) {
    throw new Error(`Could not find search.mjs in ${dir}`);
  }
  const searchMapPath = findFile(dir, "search.mjs.map");
  if (!searchMapPath) {
    throw new Error(`Could not find search.mjs.map in ${dir}`);
  }

  const searchRaw = fs.readFileSync(searchPath, "utf8");
  const searchRawBytes = Buffer.byteLength(searchRaw, "utf8");
  const searchGzipBytes = zlib.gzipSync(Buffer.from(searchRaw, "utf8")).length;

  const mapJson = JSON.parse(fs.readFileSync(searchMapPath, "utf8"));
  const { packages, totalAccounted } = decodeSourcemapBreakdown(searchRaw, mapJson);

  // Hard assertion: accounted bytes must match raw file size
  if (totalAccounted !== searchRawBytes) {
    throw new Error(
      `Reconciliation assertion failed: decoded accounted bytes (${totalAccounted}) !== search.mjs file size (${searchRawBytes})`
    );
  }

  // Scan shipped files
  const shippedFiles: Record<string, ShippedFileStats> = {};
  const scanQueue = [dir];
  while (scanQueue.length > 0) {
    const current = scanQueue.shift()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== ".git") {
          scanQueue.push(full);
        }
      } else if (entry.isFile()) {
        const rel = path.relative(dir, full).replace(/\\/g, "/");
        const content = fs.readFileSync(full);
        shippedFiles[rel] = {
          rawBytes: content.length,
          gzipBytes: zlib.gzipSync(content).length,
        };
      }
    }
  }

  // Run npm pack --dry-run --json if package.json exists in target directory
  let npmPackData: BundleSnapshot["npmPack"] = undefined;
  const pkgJsonPath = path.join(dir, "package.json");
  let hasPkgJson = false;
  try {
    hasPkgJson = fs.statSync(pkgJsonPath).isFile();
  } catch {}

  if (hasPkgJson) {
    try {
      const packOutput = execFileSync("npm", ["pack", "--dry-run", "--json"], {
        cwd: dir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const parsed = JSON.parse(packOutput);
      const pkgInfo = Array.isArray(parsed) ? parsed[0] : parsed;
      if (pkgInfo) {
        const sortedFiles = (pkgInfo.files || []).sort((a: any, b: any) => b.size - a.size);
        npmPackData = {
          size: pkgInfo.size,
          unpackedSize: pkgInfo.unpackedSize,
          entryCount: pkgInfo.entryCount,
          topFiles: sortedFiles.slice(0, 15).map((f: any) => ({
            path: f.path,
            size: f.size,
          })),
        };
      }
    } catch (err) {
      console.warn("Notice: npm pack --dry-run failed:", (err as Error).message);
    }
  }

  return {
    timestamp: new Date().toISOString(),
    target: dir,
    npmPack: npmPackData,
    searchBundle: {
      rawBytes: searchRawBytes,
      gzipBytes: searchGzipBytes,
      packages,
    },
    shippedFiles,
  };
}

export function measureTarget(targetPath: string): { snapshot: BundleSnapshot; cleanup?: () => void } {
  const resolved = path.resolve(targetPath);
  const stat = fs.statSync(resolved);

  if (stat.isFile() && (resolved.endsWith(".tgz") || resolved.endsWith(".tar.gz"))) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-size-"));
    execFileSync("tar", ["-xzf", resolved, "-C", tmpDir]);
    const pkgDir = path.join(tmpDir, "package");
    const dirToMeasure = fs.existsSync(pkgDir) ? pkgDir : tmpDir;
    const snapshot = measureDirectory(dirToMeasure);
    // When measuring a .tgz directly, record the packed .tgz file size
    if (!snapshot.npmPack) {
      snapshot.npmPack = {
        size: stat.size,
        unpackedSize: Object.values(snapshot.shippedFiles).reduce((sum, f) => sum + f.rawBytes, 0),
        entryCount: Object.keys(snapshot.shippedFiles).length,
        topFiles: Object.entries(snapshot.shippedFiles)
          .sort((a, b) => b[1].rawBytes - a[1].rawBytes)
          .slice(0, 15)
          .map(([p, s]) => ({ path: p, size: s.rawBytes })),
      };
    } else {
      snapshot.npmPack.size = stat.size;
    }
    snapshot.target = resolved;
    return {
      snapshot,
      cleanup: () => {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {}
      },
    };
  }

  if (stat.isDirectory()) {
    const snapshot = measureDirectory(resolved);
    return { snapshot };
  }

  throw new Error(`Target ${targetPath} is neither a directory nor a .tgz file`);
}

function formatBytes(bytes: number): string {
  if (Math.abs(bytes) >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (Math.abs(bytes) >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

function formatDelta(current: number, baseline: number): string {
  const delta = current - baseline;
  if (baseline === 0) return delta === 0 ? "0 B" : `+${formatBytes(delta)}`;
  const pct = ((delta / baseline) * 100).toFixed(1);
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatBytes(delta)} (${sign}${pct}%)`;
}

export function printSnapshot(snapshot: BundleSnapshot, baseline?: BundleSnapshot): void {
  console.log("\n=======================================================");
  console.log(`📦 BUNDLE SIZE SNAPSHOT: ${snapshot.target}`);
  console.log(`🕒 Timestamp: ${snapshot.timestamp}`);
  console.log("=======================================================\n");

  if (snapshot.npmPack) {
    console.log("--- NPM PACKAGE ---");
    if (baseline?.npmPack) {
      console.log(`  Pack Size:     ${formatBytes(snapshot.npmPack.size).padEnd(12)} (Baseline: ${formatBytes(baseline.npmPack.size)}, Delta: ${formatDelta(snapshot.npmPack.size, baseline.npmPack.size)})`);
      console.log(`  Unpacked Size: ${formatBytes(snapshot.npmPack.unpackedSize).padEnd(12)} (Baseline: ${formatBytes(baseline.npmPack.unpackedSize)}, Delta: ${formatDelta(snapshot.npmPack.unpackedSize, baseline.npmPack.unpackedSize)})`);
      console.log(`  Entry Count:   ${snapshot.npmPack.entryCount} files (Baseline: ${baseline.npmPack.entryCount})`);
    } else {
      console.log(`  Pack Size:     ${formatBytes(snapshot.npmPack.size)} (${snapshot.npmPack.size.toLocaleString()} bytes)`);
      console.log(`  Unpacked Size: ${formatBytes(snapshot.npmPack.unpackedSize)} (${snapshot.npmPack.unpackedSize.toLocaleString()} bytes)`);
      console.log(`  Entry Count:   ${snapshot.npmPack.entryCount} files`);
    }
    console.log();
  }

  console.log("--- SEARCH BUNDLE (search.mjs) ---");
  if (baseline) {
    console.log(`  Raw Size:      ${formatBytes(snapshot.searchBundle.rawBytes).padEnd(12)} (Baseline: ${formatBytes(baseline.searchBundle.rawBytes)}, Delta: ${formatDelta(snapshot.searchBundle.rawBytes, baseline.searchBundle.rawBytes)})`);
    console.log(`  Gzip Size:     ${formatBytes(snapshot.searchBundle.gzipBytes).padEnd(12)} (Baseline: ${formatBytes(baseline.searchBundle.gzipBytes)}, Delta: ${formatDelta(snapshot.searchBundle.gzipBytes, baseline.searchBundle.gzipBytes)})`);
  } else {
    console.log(`  Raw Size:      ${formatBytes(snapshot.searchBundle.rawBytes)} (${snapshot.searchBundle.rawBytes.toLocaleString()} bytes)`);
    console.log(`  Gzip Size:     ${formatBytes(snapshot.searchBundle.gzipBytes)} (${snapshot.searchBundle.gzipBytes.toLocaleString()} bytes)`);
  }
  console.log();

  console.log("--- PER-PACKAGE BREAKDOWN (search.mjs) ---");
  const allPkgs = new Set([
    ...Object.keys(snapshot.searchBundle.packages),
    ...(baseline ? Object.keys(baseline.searchBundle.packages) : []),
  ]);
  const sortedPkgs = Array.from(allPkgs).sort((a, b) => {
    const bytesA = snapshot.searchBundle.packages[a] || 0;
    const bytesB = snapshot.searchBundle.packages[b] || 0;
    return bytesB - bytesA;
  });

  const totalRaw = snapshot.searchBundle.rawBytes;
  if (baseline) {
    console.log(
      `${"Package".padEnd(32)} ${"Current".padStart(12)} ${"Share".padStart(8)} ${"Baseline".padStart(12)} ${"Delta".padStart(20)}`
    );
    console.log("-".repeat(88));
    for (const pkg of sortedPkgs) {
      const cur = snapshot.searchBundle.packages[pkg] || 0;
      const base = baseline.searchBundle.packages[pkg] || 0;
      const share = totalRaw > 0 ? `${((cur / totalRaw) * 100).toFixed(1)}%` : "0%";
      console.log(
        `${pkg.padEnd(32)} ${formatBytes(cur).padStart(12)} ${share.padStart(8)} ${formatBytes(base).padStart(12)} ${formatDelta(cur, base).padStart(20)}`
      );
    }
  } else {
    console.log(`${"Package".padEnd(32)} ${"Bytes".padStart(12)} ${"Formatted".padStart(12)} ${"Share".padStart(8)}`);
    console.log("-".repeat(68));
    for (const pkg of sortedPkgs) {
      const bytes = snapshot.searchBundle.packages[pkg] || 0;
      const share = totalRaw > 0 ? `${((bytes / totalRaw) * 100).toFixed(1)}%` : "0%";
      console.log(
        `${pkg.padEnd(32)} ${bytes.toLocaleString().padStart(12)} ${formatBytes(bytes).padStart(12)} ${share.padStart(8)}`
      );
    }
  }
  console.log();

  console.log("--- SHIPPED KEY ARTIFACTS ---");
  const keyArtifactPatterns = [
    /search\.mjs$/,
    /search\.mjs\.map$/,
    /modern-web\.mjs$/,
    /tfjs_model_minilm/,
    /vectors\.gen\.json\.gz$/,
    /tokenizer.*\.json/,
    /watchdog/,
  ];
  const allShippedKeys = Object.keys(snapshot.shippedFiles).filter((file) =>
    keyArtifactPatterns.some((pattern) => pattern.test(file))
  );
  allShippedKeys.sort();

  if (baseline) {
    console.log(
      `${"Artifact".padEnd(46)} ${"Current (Raw / Gz)".padStart(24)} ${"Baseline (Raw)".padStart(16)} ${"Delta".padStart(20)}`
    );
    console.log("-".repeat(110));
    for (const file of allShippedKeys) {
      const cur = snapshot.shippedFiles[file];
      const base = baseline.shippedFiles[file];
      const isAlreadyGz = file.endsWith(".gz") || file.endsWith(".tgz");
      const gzStr = isAlreadyGz ? "—" : formatBytes(cur.gzipBytes);
      const curStr = `${formatBytes(cur.rawBytes)} / ${gzStr}`;
      const baseStr = base ? formatBytes(base.rawBytes) : "(absent)";
      const deltaStr = base ? formatDelta(cur.rawBytes, base.rawBytes) : "+NEW";
      console.log(
        `${file.padEnd(46)} ${curStr.padStart(24)} ${baseStr.padStart(16)} ${deltaStr.padStart(20)}`
      );
    }
  } else {
    console.log(`${"Artifact".padEnd(48)} ${"Raw Size".padStart(14)} ${"Gzip Size".padStart(14)}`);
    console.log("-".repeat(78));
    for (const file of allShippedKeys) {
      const f = snapshot.shippedFiles[file];
      const isAlreadyGz = file.endsWith(".gz") || file.endsWith(".tgz");
      const gzStr = isAlreadyGz ? "—" : formatBytes(f.gzipBytes);
      console.log(
        `${file.padEnd(48)} ${formatBytes(f.rawBytes).padStart(14)} ${gzStr.padStart(14)}`
      );
    }
  }
  console.log();
}

function printHelp(): void {
  console.log(`
Usage: bundle-size [dist-dir-or-tarball] [options]

Measures bundle and package sizes with sourcemap breakdown and npm pack analysis.

Arguments:
  [dist-dir-or-tarball]    Path to dist directory or .tgz tarball (default: <repo-root>/dist/skills-cli)

Options:
  --compare <baseline.json> Compare current measurements against a saved baseline JSON
  --json [output.json]      Save current measurements to JSON snapshot file
  -h, --help                Show this help message
`);
}

async function main(): Promise<void> {
  const options = {
    compare: { type: "string" as const },
    json: { type: "string" as const },
    help: { type: "boolean" as const, short: "h" },
  };

  const { values, positionals } = parseArgs({
    options,
    allowPositionals: true,
    strict: true,
  });

  if (values.help) {
    printHelp();
    return;
  }

  const defaultTarget = path.resolve(import.meta.dirname, "../../dist/skills-cli");
  const targetPath = positionals[0] ? path.resolve(process.cwd(), positionals[0]) : defaultTarget;
  const comparePath = values.compare ? path.resolve(process.cwd(), values.compare) : null;
  const jsonPath = values.json !== undefined
    ? path.resolve(process.cwd(), values.json || "bundle-size-snapshot.json")
    : null;

  const { snapshot, cleanup } = measureTarget(targetPath);
  try {
    let baseline: BundleSnapshot | undefined = undefined;
    if (comparePath) {
      const baselineRaw = fs.readFileSync(comparePath, "utf8");
      baseline = JSON.parse(baselineRaw) as BundleSnapshot;
    }

    if (jsonPath) {
      fs.writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2), "utf8");
      console.log(`Saved bundle snapshot to ${jsonPath}`);
    }

    printSnapshot(snapshot, baseline);
  } finally {
    if (cleanup) cleanup();
  }
}

if (process.argv[1] === import.meta.filename) {
  main().catch((err) => {
    console.error("Bundle size measurement failed:", err);
    process.exit(1);
  });
}
