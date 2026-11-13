// Tolerant parsing of user-supplied guide IDs and "did you mean" suggestions for unknown ones.
// Agents often pass IDs as paths (`guides/forms/switch/guide.md`), in a different case, or with typos;
// `retrieve` normalizes the former and answers the latter with the closest real IDs.

const MAX_SUGGESTIONS = 3;
// Below this score a candidate is noise: hopeless input (e.g. `zzzz-qqq`) gets no suggestions.
const MIN_SUGGESTION_SCORE = 0.5;
// Word-level matches weaker than this (e.g. `media` vs `menu`) count as no match at all.
const MIN_TOKEN_SIMILARITY = 0.6;
// Credit for a word that is a prefix of the other (e.g. `reauth` vs `reauthentication`), if the
// shorter word has at least MIN_PREFIX_LENGTH characters (so `app` does not match `apple`).
const PREFIX_TOKEN_SIMILARITY = 0.8;
const MIN_PREFIX_LENGTH = 4;
// Discount for a query whose words all closely match words of a longer ID (e.g. `popovr` in
// `declarative-dialog-popover-control`): enough to clear the threshold, ranked below whole-ID matches.
// Queries shorter than MIN_PARTIAL_MATCH_LENGTH (e.g. `a`) are too ambiguous for partial matching.
const PARTIAL_MATCH_WEIGHT = 0.65;
const MIN_PARTIAL_MATCH_LENGTH = 4;

/**
 * Normalizes a guide ID as typed: case-insensitive, with an optional leading `guides/<category>/`
 * or `<category>/` path and an optional trailing `.md` or `/guide.md`.
 * `guides/forms/Switch/guide.md`, `forms/switch.md` and `SWITCH` all normalize to `switch`.
 * Trailing slashes are ignored, so a directory path such as `guides/forms/` names the `forms` guide.
 */
export function normalizeGuideId(raw: string): string {
  const path = raw
    .trim()
    .toLowerCase()
    .replaceAll("\\", "/")
    .replace(/(\/guide)?\.md$/, "")
    .replace(/\/+$/, "");
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * Returns up to three guide IDs from `candidates` that most resemble `query`, most similar first.
 * Similarity blends whole-ID edit distance (typos, transpositions) with word overlap on `-`-separated
 * words (missing, extra or truncated words); candidates scoring below a fixed threshold are dropped.
 */
export function suggestGuideIds(query: string, candidates: readonly string[]): string[] {
  const normalized = normalizeGuideId(query);
  if (!normalized) return [];
  return candidates
    .map((id) => ({ id, score: idSimilarity(normalized, id) }))
    .filter(({ score }) => score >= MIN_SUGGESTION_SCORE)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, MAX_SUGGESTIONS)
    .map(({ id }) => id);
}

/**
 * Similarity in [0, 1]: the mean of whole-string edit similarity and two-way word overlap, or, if
 * higher, how well the query's words are covered by the ID's words (discounted).
 */
function idSimilarity(query: string, id: string): number {
  const queryWords = query.split("-");
  const idWords = id.split("-");
  const queryCoverage = wordCoverage(queryWords, idWords);
  const wordOverlap = (queryCoverage + wordCoverage(idWords, queryWords)) / 2;
  const score = (editSimilarity(query, id) + wordOverlap) / 2;
  return query.length >= MIN_PARTIAL_MATCH_LENGTH ? Math.max(score, PARTIAL_MATCH_WEIGHT * queryCoverage) : score;
}

/** 1 minus the optimal-string-alignment distance, scaled by the longer string's length. */
function editSimilarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  return maxLength === 0 ? 1 : 1 - editDistance(a, b) / maxLength;
}

/**
 * Optimal string alignment distance: Levenshtein distance that also counts an adjacent
 * transposition (`dialgo` -> `dialog`) as a single edit.
 */
export function editDistance(a: string, b: string): number {
  let prevPrev: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        curr[j] = Math.min(curr[j], prevPrev[j - 2] + 1);
      }
    }
    prevPrev = prev;
    prev = curr;
  }
  return prev[b.length];
}

/** Mean over `from` of each word's best similarity to a word in `to`. */
function wordCoverage(from: string[], to: string[]): number {
  return from.reduce((sum, word) => sum + Math.max(...to.map((other) => wordSimilarity(word, other))), 0) / from.length;
}

function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const similarity = editSimilarity(a, b);
  if (Math.min(a.length, b.length) >= MIN_PREFIX_LENGTH && (a.startsWith(b) || b.startsWith(a))) {
    return Math.max(PREFIX_TOKEN_SIMILARITY, similarity);
  }
  return similarity >= MIN_TOKEN_SIMILARITY ? similarity : 0;
}
