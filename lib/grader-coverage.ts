import fs from 'node:fs';
import path from 'node:path';
import { TfjsEmbedder } from '../serving/lib/tfjs-embedder.ts';

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
    .replace(/^\s*(?:\d+[.)]|-|\*)\s*/, '') // Remove list bullets/numbering
    .replace(/^should\s+/i, '')              // Remove "should" prefix
    .replace(/[`"']/g, '')                   // Strip backticks/quotes
    .replace(/\s+/g, ' ')
    .trim();
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
 * Validates that every expectation in expectations.md is covered by >= 1 test in the target grader.ts.
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

  if (expectations.length === 0) {
    return {
      isComplete: true,
      graderPath,
      expectationsPath,
      matches: [],
      missing: []
    };
  }

  if (testTitles.length === 0) {
    const missing: ExpectationMatch[] = expectations.map(exp => ({
      expectation: exp,
      isCovered: false,
      bestMatchTest: '',
      similarity: 0,
    }));
    return {
      isComplete: false,
      graderPath,
      expectationsPath,
      matches: missing,
      missing,
    };
  }

  const embedder = TfjsEmbedder.getInstance();
  await embedder.init();

  async function getVec(t: string): Promise<number[]> {
    let v = embedCache.get(t);
    if (!v) {
      v = await embedder.embed(t);
      embedCache.set(t, v);
    }
    return v;
  }

  const rawTestVectors = await Promise.all(testTitles.map(getVec));
  const cleanedTestVectors = await Promise.all(testTitles.map(t => getVec(cleanText(t))));

  const expectationEntries = expectations.map(exp => {
    const firstSentence = exp.split(/[.!?]\s+/)[0];
    return {
      exp,
      cleanedClause: cleanText(firstSentence),
    };
  });

  const rawExpVectors = await Promise.all(expectationEntries.map(e => getVec(e.exp)));
  const cleanedExpVectors = await Promise.all(expectationEntries.map(e => getVec(e.cleanedClause)));

  const matches: ExpectationMatch[] = [];

  for (let eIdx = 0; eIdx < expectations.length; eIdx++) {
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

  const details = result.missing.map((m, idx) => {
    const bestTestSnippet = m.bestMatchTest
      ? `"${m.bestMatchTest}" (similarity: ${m.similarity.toFixed(2)})`
      : 'None';

    return `${idx + 1}. Expectation: "${m.expectation}"
   Closest test found: ${bestTestSnippet}
   👉 Action required:
      - If this requirement is NOT yet tested in this grader: Add a test case verifying this behavior.
      - If this requirement IS already tested: Update/rephrase the test name in ${relGrader} so it more clearly describes the requirement.`;
  }).join('\n\n');

  return `${header}\n${details}`;
}
