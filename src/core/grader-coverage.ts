import fs from 'node:fs';
import path from 'node:path';
// Native ONNX (onnxruntime-node). TfjsEmbedder exists for the published bundle, which can't ship
// native binaries, but its pure-JS CPU backend is ~100x slower here.
import { Embedder } from '../rag/transformers-embedder.ts';

const embedCache = new Map<string, number[]>();

function dotProduct(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

function calculateNorm(v: number[]): number {
  let sum = 0;
  for (const val of v) {
    sum += val * val;
  }
  return Math.sqrt(sum);
}

export function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  const normA = calculateNorm(vectorA);
  const normB = calculateNorm(vectorB);
  if (normA === 0 || normB === 0) return 0;
  return dotProduct(vectorA, vectorB) / (normA * normB);
}

export function cleanText(text: string): string {
  return text
    .replace(/^\s*(?:(?:Expectation|Exp)\s+\d+[a-z]?(?:\s*\([^)]*\))?\s*[:.)-]?|\d+[.)]|-|\*)\s*/i, '') // Remove list bullets/numbering and Expectation N prefixes
    .replace(/^should\s+/i, '')              // Remove "should" prefix
    .replace(/[`"']/g, '')                   // Strip backticks/quotes
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ManifestExpectationEntry {
  status: 'TESTED' | 'SKIPPED';
  reason: string;
}

const MANIFEST_ENTRY_REGEX =
  /^\s*(?:\/\/|\/?\*+)\s*(?:[-*]\s*)?(?:(?:Expectations?|Exp)\s+)?(\d+)(?:\s*[-–]\s*(\d+))?(?:\s*\([^)]*\))?\s*(?:[:.)]|[-–—]+)?\s*\b(TESTED|SKIPPED)\b(?:\s*[:—–-]+\s*(.*)|\s+(.*))?$/i;

/**
 * Extracts top-of-file manifest entries (`Expectation N: TESTED ...` or `Expectation N: SKIPPED: <reason>`)
 * keyed by 1-based expectation number.
 */
export function extractManifestEntries(graderFilePath: string): Map<number, ManifestExpectationEntry> {
  const entries = new Map<number, ManifestExpectationEntry>();
  if (!fs.existsSync(graderFilePath)) return entries;
  const content = fs.readFileSync(graderFilePath, 'utf8');

  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/\*\/\s*$/, '').trimEnd();
    const match = MANIFEST_ENTRY_REGEX.exec(line);
    if (!match) continue;

    const start = Number.parseInt(match[1], 10);
    const end = match[2] ? Number.parseInt(match[2], 10) : start;
    const status = match[3].toUpperCase() === 'SKIPPED' ? 'SKIPPED' : 'TESTED';
    const reason = (match[4] ?? match[5] ?? '').trim();

    for (let num = start; num <= end; num++) {
      entries.set(num, { status, reason });
    }
  }

  return entries;
}


/**
 * Extracts test titles from a Playwright grader.ts file.
 */
export function extractTestTitles(graderFilePath: string): string[] {
  if (!fs.existsSync(graderFilePath)) return [];
  const content = fs.readFileSync(graderFilePath, 'utf8');

  const titles: string[] = [];
  const testRegex = /(?:^|\s)test(?:\.(?:only|skip))?\s*\(\s*(['"`])([\s\S]*?)\1\s*,/g;
  let match: RegExpExecArray | null;
  while ((match = testRegex.exec(content)) !== null) {
    const rawTitle = match[2].trim();
    titles.push(rawTitle.replace(/\s+/g, ' '));
  }
  return titles;
}

/**
 * Extracts top-level verifiable expectations from expectations.md.
 * Combines any indented sub-bullets into their parent expectation.
 */
export function parseVerifiableExpectations(content: string): string[] {
  const lines = content.split('\n');
  const items: string[] = [];

  for (const rawLine of lines) {
    // Top-level bullet / numbered item (starts at column 0)
    const topMatch = rawLine.match(/^([-*]|\d+[.)])\s+(.+)$/);
    if (topMatch) {
      items.push(topMatch[2].trim());
      continue;
    }

    // Indented sub-bullet (has leading whitespace)
    const subMatch = rawLine.match(/^\s+([-*]|\d+[.)])\s+(.+)$/);
    if (subMatch && items.length > 0) {
      items[items.length - 1] += ` ${subMatch[2].trim()}`;
    }
  }

  return items;
}

export interface ExpectationMatch {
  expectation: string;
  isCovered: boolean;
  bestMatchTest: string;
  similarity: number;
}

export interface GraderCoverageResult {
  isComplete: boolean;
  graderPath: string;
  expectationsPath: string;
  matches: ExpectationMatch[];
  missing: ExpectationMatch[];
}

/**
 * Validates that every expectation in expectations.md is covered by >= 1 test in the target grader.ts
 * or by a manifest SKIPPED entry with a non-empty reason.
 */
export async function validateGraderExpectationCoverage(
  expectationsPath: string,
  graderPath: string,
  threshold = 0.50
): Promise<GraderCoverageResult> {
  if (!fs.existsSync(expectationsPath) || !fs.existsSync(graderPath)) {
    return {
      isComplete: true,
      graderPath,
      expectationsPath,
      matches: [],
      missing: []
    };
  }

  const expectations = parseVerifiableExpectations(fs.readFileSync(expectationsPath, 'utf8'));
  const testTitles = extractTestTitles(graderPath);
  const manifestEntries = extractManifestEntries(graderPath);

  if (expectations.length === 0) {
    return {
      isComplete: true,
      graderPath,
      expectationsPath,
      matches: [],
      missing: []
    };
  }

  const hasNonSkippedExpectation = expectations.some((_, idx) => manifestEntries.get(idx + 1)?.status !== 'SKIPPED');

  let rawTestVectors: number[][] = [];
  let cleanedTestVectors: number[][] = [];
  let rawExpVectors: number[][] = [];
  let cleanedExpVectors: number[][] = [];

  if (testTitles.length > 0 && hasNonSkippedExpectation) {
    const embedder = Embedder.getInstance();
    await embedder.init();

    async function getVec(t: string): Promise<number[]> {
      let v = embedCache.get(t);
      if (!v) {
        v = await embedder.embed(t);
        embedCache.set(t, v);
      }
      return v;
    }

    rawTestVectors = await Promise.all(testTitles.map(getVec));
    cleanedTestVectors = await Promise.all(testTitles.map(t => getVec(cleanText(t))));

    const expectationEntries = expectations.map(exp => {
      const withoutExamples = exp.replace(/\s*\((?:e\.g\.[,:]?|such as\b)(?:[^()]|\([^()]*\))*\)/gi, '');
      const firstSentence = withoutExamples.split(/[.!?]\s+/)[0];
      return {
        exp,
        cleanedClause: cleanText(firstSentence),
      };
    });

    rawExpVectors = await Promise.all(expectationEntries.map(e => getVec(e.exp)));
    cleanedExpVectors = await Promise.all(expectationEntries.map(e => getVec(e.cleanedClause)));
  }

  const matches: ExpectationMatch[] = [];

  // Skips are keyed by bullet position, so honor them only when the manifest lists
  // every expectation number 1..N.
  const manifestIsComplete = manifestEntries.size === expectations.length
    && [...manifestEntries.keys()].every(n => n >= 1 && n <= expectations.length);

  for (let eIdx = 0; eIdx < expectations.length; eIdx++) {
    const manifestEntry = manifestEntries.get(eIdx + 1);
    if (manifestEntry?.status === 'SKIPPED') {
      const hasReason = manifestEntry.reason.length > 0;
      const isCovered = hasReason && manifestIsComplete;
      let bestMatchTest = `SKIPPED: ${manifestEntry.reason}`;
      if (!hasReason) bestMatchTest = 'SKIPPED (missing reason)';
      else if (!manifestIsComplete) bestMatchTest = `SKIPPED, but the manifest lists ${manifestEntries.size} entries for ${expectations.length} expectations`;
      matches.push({
        expectation: expectations[eIdx],
        isCovered,
        bestMatchTest,
        similarity: isCovered ? 1 : 0,
      });
      continue;
    }

    if (testTitles.length === 0) {
      matches.push({
        expectation: expectations[eIdx],
        isCovered: false,
        bestMatchTest: '',
        similarity: 0,
      });
      continue;
    }

    const rawExpVec = rawExpVectors[eIdx];
    const cleanedExpVec = cleanedExpVectors[eIdx];

    let bestScore = -1;
    let bestTestTitle = '';

    for (let i = 0; i < testTitles.length; i++) {
      const rawSim = cosineSimilarity(rawExpVec, rawTestVectors[i]);
      const cleanedSim = cosineSimilarity(cleanedExpVec, cleanedTestVectors[i]);
      const currentScore = Math.max(rawSim, cleanedSim);

      if (currentScore > bestScore) {
        bestScore = currentScore;
        bestTestTitle = testTitles[i];
      }
    }

    matches.push({
      expectation: expectations[eIdx],
      isCovered: bestScore >= threshold,
      bestMatchTest: bestTestTitle,
      similarity: parseFloat(bestScore.toFixed(4)),
    });
  }

  const missing = matches.filter(m => !m.isCovered);

  return {
    isComplete: missing.length === 0,
    graderPath,
    expectationsPath,
    matches,
    missing,
  };
}

/**
 * Formats a clear, actionable failure message when expectations are missing coverage in a grader.
 */
export function formatCoverageFailureMessage(result: GraderCoverageResult, repoRoot = ''): string {
  const relGrader = repoRoot ? path.relative(repoRoot, result.graderPath) : result.graderPath;
  const relExp = repoRoot ? path.relative(repoRoot, result.expectationsPath) : result.expectationsPath;

  const header = `❌ Uncovered expectation(s) found in grader: ${relGrader}\nSpec: ${relExp}\n`;

  const totalExpectations = result.matches.length;
  const details = result.missing.map((m, idx) => {
    const expIdx = result.matches.indexOf(m);
    const expNumber = expIdx >= 0 ? expIdx + 1 : idx + 1;
    const bestTestSnippet = m.bestMatchTest
      ? `"${m.bestMatchTest}" (similarity: ${m.similarity.toFixed(2)})`
      : 'None';

    return `${idx + 1}. Expectation ${expNumber}: "${m.expectation}"
   Closest test found: ${bestTestSnippet}
   👉 Action required:
      - If this requirement is NOT yet tested in this grader: Add a test case verifying this behavior.
      - If this requirement IS already tested: Update/rephrase the test name in ${relGrader} so it more clearly describes the requirement.
      - If this requirement's precondition is absent from both the target app and task: Ensure the top-of-file manifest in ${relGrader} lists all expectations (1..${totalExpectations || 'N'}) and records "// Expectation ${expNumber}: SKIPPED: <missing precondition>".`;
  }).join('\n\n');

  return `${header}\n${details}`;
}
