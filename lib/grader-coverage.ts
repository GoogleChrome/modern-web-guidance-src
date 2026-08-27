import fs from 'node:fs';
import path from 'node:path';
import { TfjsEmbedder } from '../serving/lib/tfjs-embedder.ts';
import { dotProduct, calculateNorm } from '../serving/lib/search.ts';

const embedCache = new Map<string, number[]>();

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
 * Ignores indented sub-bullets and skips non-testable authoring rules.
 */
export function parseVerifiableExpectations(content: string): string[] {
  const lines = content.split('\n');
  const items: string[] = [];

  const hasStructured = /^##\s+(Must pass)/im.test(content);
  let inMustPass = !hasStructured;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (/^##\s+Must pass/i.test(trimmed)) {
      inMustPass = true;
      continue;
    } else if (/^##\s+/i.test(trimmed)) {
      inMustPass = false;
      continue;
    }

    if (!inMustPass) continue;

    // Must be at start of line without indentation (top-level only)
    const match = rawLine.match(/^([-*]|\d+[.)])\s+(.+)$/);
    if (match) {
      const text = match[2].trim();
      // Skip authoring notes like "DO NOT assume ..."
      if (!/^DO NOT (?:assume|write|require)/i.test(text)) {
        items.push(text);
      }
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

  const matches: ExpectationMatch[] = [];

  for (const exp of expectations) {
    const rawExpVec = await getVec(exp);
    const firstSentence = exp.split(/[.!?]\s+/)[0];
    const cleanedExpVec = await getVec(cleanText(firstSentence));

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
      expectation: exp,
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
