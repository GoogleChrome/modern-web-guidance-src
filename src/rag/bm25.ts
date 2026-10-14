// Zero-dependency Okapi BM25 over whole guides, used alongside dense retrieval in search.ts.
// Dense MiniLM embeddings blur literal terms (API names like `user-invalid`, acronyms like `LCP`, product nouns);
// a lexical ranking recovers those, and reciprocal rank fusion combines the two without score calibration.

const STOPWORDS = new Set(
  "the a an and or of to in for with on by is are be as it this that from at use using your you can how when which into not"
    .split(" ")
);

export const DEFAULT_BM25_K1 = 1.2;
export const DEFAULT_BM25_B = 0.75;
export const DEFAULT_RRF_K = 60;

/** Lowercase word tokens (letters/digits, inner hyphens kept so `user-invalid` stays one token), minus stopwords. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9-]+/g) ?? []).filter((t) => !STOPWORDS.has(t));
}

export interface Bm25Doc {
  id: string;
  length: number;
  freqs: Map<string, number>;
}

export interface Bm25Index {
  docs: Bm25Doc[];
  docFreq: Map<string, number>;
  avgDocLength: number;
}

export function buildBm25Index(docs: { id: string; text: string }[]): Bm25Index {
  if (docs.length === 0) throw new Error("buildBm25Index: no documents");
  const docFreq = new Map<string, number>();
  const indexDocs = docs.map((doc) => {
    const tokens = tokenize(doc.text);
    const freqs = new Map<string, number>();
    for (const t of tokens) freqs.set(t, (freqs.get(t) ?? 0) + 1);
    for (const t of freqs.keys()) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
    return { id: doc.id, length: tokens.length, freqs };
  });
  const avgDocLength = indexDocs.reduce((sum, d) => sum + d.length, 0) / indexDocs.length;
  return { docs: indexDocs, docFreq, avgDocLength };
}

/** Documents with a positive BM25 score for `query`, best first. */
export function rankBm25(
  index: Bm25Index,
  query: string,
  k1 = DEFAULT_BM25_K1,
  b = DEFAULT_BM25_B
): { id: string; score: number }[] {
  const n = index.docs.length;
  const termIdfs = [...new Set(tokenize(query))].map((term) => {
    const df = index.docFreq.get(term) ?? 0;
    return { term, idf: Math.log(1 + (n - df + 0.5) / (df + 0.5)) };
  });

  const results: { id: string; score: number }[] = [];
  for (const doc of index.docs) {
    let score = 0;
    for (const { term, idf } of termIdfs) {
      const f = doc.freqs.get(term);
      if (!f) continue;
      score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * doc.length) / index.avgDocLength));
    }
    if (score > 0) results.push({ id: doc.id, score });
  }
  return results.sort((x, y) => y.score - x.score);
}

/** Reciprocal rank fusion: score(id) = Σ 1 / (k + rank), rank 1-based within each list. */
export function reciprocalRankFusion(rankings: string[][], k = DEFAULT_RRF_K): { id: string; score: number }[] {
  const scores = new Map<string, number>();
  for (const ranking of rankings) {
    ranking.forEach((id, i) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1)));
  }
  return [...scores].map(([id, score]) => ({ id, score })).sort((x, y) => y.score - x.score);
}
