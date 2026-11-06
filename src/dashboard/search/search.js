/**
 * @typedef {'hit' | 'ndcg' | 'snr'} MetricKey
 * @typedef {'all' | 'short' | 'long' | 'nightly'} ViewKey
 * @typedef {[number, number, number]} SeriesPoint
 * @typedef {{ hit: SeriesPoint, ndcg: SeriesPoint, snr: SeriesPoint, leafRec: SeriesPoint }} MilestoneScores
 * @typedef {Record<string, MilestoneScores>} ViewScores
 * @typedef {{
 *   id: string,
 *   date?: string,
 *   label: string,
 *   sub: string,
 *   k: number,
 *   when: string,
 *   note: string,
 *   tone?: string,
 *   annotation?: string,
 *   counterfactual?: { id: string, note: string }
 * }} MilestoneDef
 * @typedef {{ x: number, y: number, ciLo: number, ciHi: number, val: number }} MilestonePointGeom
 * @typedef {{
 *   ms: MilestonePointGeom[],
 *   cfX0: number,
 *   cfY0: number,
 *   cfX: number,
 *   cfY: number,
 *   cfVal: number,
 *   xOct6: number,
 *   yOct6: number,
 *   isTime: boolean,
 *   view: ViewKey,
 *   metric: MetricKey,
 *   lo: number,
 *   tick: number
 * }} MilestoneGeom
 * @typedef {{
 *   name: string,
 *   pr?: number,
 *   prs?: number[],
 *   id?: string,
 *   same?: string,
 *   unmeasured?: boolean,
 *   oracle?: boolean,
 *   when: string,
 *   what: string,
 *   output: string,
 *   tone?: string
 * }} TableRowDef
 * @typedef {{
 *   label: string,
 *   sub: string,
 *   quality: string,
 *   ms: number,
 *   rss?: number,
 *   tarball?: number,
 *   tokens?: number,
 *   kind?: string,
 *   tone?: string,
 *   labelSide?: string,
 *   note?: string
 * }} SystemDef
 */

/** @type {Record<ViewKey, ViewScores>} */
const QUALITY = {
  all: {
    'pre-#528': { hit: [78.2, 75.4, 80.9], ndcg: [63.3, 60.7, 65.8], snr: [66.4, 63.9, 68.9], leafRec: [72.3, 69.6, 74.9] },
    '#528': { hit: [84, 81.5, 86.6], ndcg: [64.6, 62.1, 66.9], snr: [70.6, 68.2, 72.8], leafRec: [78.7, 76.1, 81.1] },
    '#824': { hit: [82.1, 79.4, 84.4], ndcg: [63.7, 61.2, 66], snr: [68.4, 66, 70.6], leafRec: [76.8, 74.1, 79.1] },
    '#1853-clean': { hit: [83.1, 80.6, 85.4], ndcg: [65.4, 62.9, 67.7], snr: [69.4, 67, 71.6], leafRec: [77.6, 74.9, 80] },
    'v0.0.195': { hit: [80.6, 77.8, 83], ndcg: [63.7, 61.1, 66.1], snr: [57, 54.7, 59.1], leafRec: [75, 72.2, 77.5] },
    '#2052': { hit: [86.1, 83.8, 88.3], ndcg: [67.1, 64.7, 69.3], snr: [71.5, 69.4, 73.7], leafRec: [80.2, 77.8, 82.6] },
    '#3048': { hit: [93.5, 91.9, 95.1], ndcg: [70.6, 68.4, 72.6], snr: [78.1, 76.3, 79.7], leafRec: [89.9, 88.1, 91.7] },
    '#3048+#3102-stem': { hit: [94.3, 92.7, 95.8], ndcg: [70.9, 68.8, 72.8], snr: [78.7, 77, 80.2], leafRec: [90.7, 88.8, 92.4] },
    '#3048+#3102-gate': { hit: [93.6, 92, 95.3], ndcg: [70.7, 68.5, 72.6], snr: [78.2, 76.5, 79.8], leafRec: [90.1, 88.2, 91.8] },
    '#3048+#3102': { hit: [94.5, 92.9, 96], ndcg: [71, 68.9, 72.9], snr: [78.8, 77.1, 80.3], leafRec: [90.8, 89, 92.5] },
    'rag-chunk-metadata': { hit: [94.7, 93.2, 96.2], ndcg: [72.3, 70.2, 74.3], snr: [79.4, 77.8, 81], leafRec: [91.2, 89.5, 92.9] },
    '#3089': { hit: [93.6, 91.9, 95.3], ndcg: [73.6, 71.5, 75.7], snr: [79, 77.3, 80.7], leafRec: [89.9, 88, 91.7] },
    '#3089+#3102': { hit: [95.3, 93.9, 96.5], ndcg: [74.1, 72.1, 76.1], snr: [80.2, 78.7, 81.7], leafRec: [91.6, 90, 93.2] },
    '#3089+#3102+meta': { hit: [95.4, 94, 96.6], ndcg: [75, 73.1, 77.1], snr: [80.6, 79.1, 82.1], leafRec: [91.8, 90.2, 93.4] },
    'Gemini 001': { hit: [96.9, 95.7, 97.9], ndcg: [81.3, 79.6, 83.1], snr: [84.8, 83.5, 86], leafRec: [95.1, 93.8, 96.4] },
    'Gemini Flash': { hit: [99.4, 98.8, 99.9], ndcg: [91.6, 90.3, 92.8], snr: [90.4, 89.7, 91], leafRec: [99, 98.3, 99.5] },
  },
  short: {
    'pre-#528': { hit: [79.2, 76.2, 82.3], ndcg: [65.6, 62.8, 68.5], snr: [68.2, 65.5, 71], leafRec: [73.9, 71.1, 77] },
    '#528': { hit: [84.9, 82.2, 87.5], ndcg: [66.6, 63.9, 69.3], snr: [72.4, 69.7, 74.9], leafRec: [80.4, 77.5, 83.1] },
    '#824': { hit: [83.8, 81.1, 86.5], ndcg: [66.3, 63.5, 69], snr: [70.9, 68.2, 73.4], leafRec: [79.2, 76.3, 82] },
    '#1853-clean': { hit: [84.9, 82.2, 87.6], ndcg: [68.1, 65.3, 70.8], snr: [72, 69.3, 74.5], leafRec: [80.1, 77.3, 82.9] },
    'v0.0.195': { hit: [82.5, 79.6, 85.3], ndcg: [66.6, 63.7, 69.3], snr: [59.6, 57.1, 61.9], leafRec: [77.7, 74.7, 80.6] },
    '#2052': { hit: [87.9, 85.5, 90.3], ndcg: [69.1, 66.5, 71.7], snr: [73.5, 71.1, 75.8], leafRec: [82.3, 79.6, 84.8] },
    '#3048': { hit: [94.6, 92.9, 96.2], ndcg: [72.5, 70.1, 74.7], snr: [79.4, 77.6, 81], leafRec: [91.1, 89.2, 92.9] },
    '#3048+#3102-stem': { hit: [95.3, 93.6, 96.7], ndcg: [72.8, 70.5, 74.9], snr: [80, 78.2, 81.6], leafRec: [91.8, 89.9, 93.5] },
    '#3048+#3102-gate': { hit: [94.6, 92.9, 96.2], ndcg: [72.5, 70.1, 74.7], snr: [79.4, 77.6, 81], leafRec: [91.1, 89.2, 92.9] },
    '#3048+#3102': { hit: [95.3, 93.6, 96.7], ndcg: [72.8, 70.5, 74.9], snr: [80, 78.2, 81.6], leafRec: [91.8, 89.9, 93.5] },
    'rag-chunk-metadata': { hit: [95.4, 93.7, 96.9], ndcg: [74, 71.7, 76.2], snr: [80.6, 78.9, 82.2], leafRec: [92.2, 90.3, 93.9] },
    '#3089': { hit: [93.3, 91.5, 95.2], ndcg: [75, 72.8, 77.3], snr: [79.4, 77.5, 81.2], leafRec: [89.8, 87.8, 91.8] },
    '#3089+#3102': { hit: [95, 93.3, 96.6], ndcg: [75.1, 72.8, 77.4], snr: [80.5, 78.8, 82.1], leafRec: [91.5, 89.7, 93.3] },
    '#3089+#3102+meta': { hit: [95.2, 93.6, 96.7], ndcg: [76.1, 73.8, 78.3], snr: [81, 79.3, 82.6], leafRec: [91.8, 90.1, 93.6] },
    'Gemini 001': { hit: [97, 95.7, 98.3], ndcg: [82.6, 80.6, 84.6], snr: [85.3, 84, 86.7], leafRec: [95.4, 93.9, 96.7] },
    'Gemini Flash': { hit: [99.3, 98.6, 99.9], ndcg: [92.6, 91.2, 93.8], snr: [90.5, 89.8, 91.2], leafRec: [98.7, 98, 99.4] },
  },
  long: {
    'pre-#528': { hit: [74.2, 67.3, 81.1], ndcg: [53.5, 47.5, 59.5], snr: [58.9, 52.9, 64.7], leafRec: [66, 59.2, 72.4] },
    '#528': { hit: [79.9, 73.6, 85.5], ndcg: [55, 49.3, 60.6], snr: [62.1, 56.5, 67.6], leafRec: [70.6, 64.4, 76.8] },
    '#824': { hit: [74.8, 67.9, 81.1], ndcg: [51.5, 45.5, 57.3], snr: [57.4, 51.5, 63.1], leafRec: [66, 59.2, 72.6] },
    '#1853-clean': { hit: [75.5, 68.6, 81.8], ndcg: [53, 47.3, 58.9], snr: [58.1, 52, 63.6], leafRec: [66.3, 59.5, 72.5] },
    'v0.0.195': { hit: [73, 66, 79.9], ndcg: [51.8, 46, 57.7], snr: [46.2, 40.8, 51.3], leafRec: [64.2, 57.1, 70.8] },
    '#2052': { hit: [78.6, 71.7, 84.9], ndcg: [57.7, 51.9, 63.4], snr: [62.8, 56.8, 68.3], leafRec: [71.3, 64.5, 77.6] },
    '#3048': { hit: [88.7, 83.6, 93.1], ndcg: [62.3, 57.3, 67.5], snr: [72.2, 67.7, 76.6], leafRec: [84.6, 79.3, 89.4] },
    '#3048+#3102-stem': { hit: [89.9, 84.9, 94.3], ndcg: [62.6, 57.7, 67.5], snr: [72.6, 68.3, 76.8], leafRec: [85.3, 80.3, 90.1] },
    '#3048+#3102-gate': { hit: [89.3, 84.3, 93.7], ndcg: [62.6, 57.7, 67.7], snr: [72.7, 68.2, 76.8], leafRec: [85.3, 80.2, 90] },
    '#3048+#3102': { hit: [90.6, 86.2, 95], ndcg: [62.9, 58.3, 67.6], snr: [73.1, 68.9, 77.2], leafRec: [85.9, 81, 90.5] },
    'rag-chunk-metadata': { hit: [91.2, 86.8, 95], ndcg: [64.5, 59.5, 69.5], snr: [74.1, 69.6, 78], leafRec: [86.7, 81.8, 91] },
    '#3089': { hit: [95, 91.2, 98.1], ndcg: [67.5, 62.9, 72.1], snr: [77.2, 73.5, 80.5], leafRec: [90.1, 86, 93.7] },
    '#3089+#3102': { hit: [96.2, 93.1, 98.7], ndcg: [69.2, 64.8, 73.6], snr: [78.6, 75.2, 81.6], leafRec: [91.6, 87.8, 94.8] },
    '#3089+#3102+meta': { hit: [96.2, 93.1, 98.7], ndcg: [70, 65.5, 74.4], snr: [78.8, 75.4, 81.9], leafRec: [91.6, 87.7, 94.8] },
    'Gemini 001': { hit: [96.2, 93.1, 98.7], ndcg: [76, 71.8, 80.3], snr: [82.2, 78.9, 85.1], leafRec: [93.7, 90, 96.8] },
    'Gemini Flash': { hit: [100, 100, 100], ndcg: [87.2, 84.1, 90.3], snr: [89.8, 88.8, 90.7], leafRec: [100, 100, 100] },
  },
  nightly: {
    'pre-#528': { hit: [93.9, 91.2, 96.6], ndcg: [83.1, 78.7, 87.2], snr: [84.3, 80.8, 87.6], leafRec: [90.5, 87.1, 93.6] },
    '#528': { hit: [95.1, 92.4, 97.4], ndcg: [84.3, 80.5, 87.8], snr: [86.2, 83.4, 88.7], leafRec: [93.2, 90.5, 95.5] },
    '#824': { hit: [94.5, 91.9, 97], ndcg: [84.1, 80, 88], snr: [84.9, 81.7, 87.9], leafRec: [92.4, 89.2, 95.3] },
    '#1853-clean': { hit: [94.9, 92.3, 97.4], ndcg: [84.4, 80.3, 88.2], snr: [85.2, 82, 88.2], leafRec: [92.7, 89.5, 95.7] },
    'v0.0.195': { hit: [94.1, 91.1, 96.9], ndcg: [83.9, 79.7, 87.8], snr: [72.9, 69.5, 76], leafRec: [91.7, 88.2, 94.9] },
    '#2052': { hit: [97, 94.6, 99], ndcg: [85.3, 82.1, 88.7], snr: [86.3, 83.8, 88.7], leafRec: [94.2, 91.6, 96.7] },
    '#3048': { hit: [99.2, 98.4, 99.8], ndcg: [86.9, 84.2, 89.9], snr: [88.5, 87.2, 89.8], leafRec: [98.3, 97.3, 99.2] },
    '#3048+#3102-stem': { hit: [99.2, 98.4, 99.8], ndcg: [87.8, 85, 90.7], snr: [88.9, 87.6, 90.2], leafRec: [98.5, 97.5, 99.4] },
    '#3048+#3102-gate': { hit: [99.2, 98.4, 99.8], ndcg: [86.9, 84.2, 89.9], snr: [88.5, 87.2, 89.8], leafRec: [98.3, 97.3, 99.2] },
    '#3048+#3102': { hit: [99.2, 98.4, 99.8], ndcg: [87.8, 85, 90.7], snr: [88.9, 87.6, 90.2], leafRec: [98.5, 97.5, 99.4] },
    'rag-chunk-metadata': { hit: [99.6, 99, 100], ndcg: [88.8, 86.4, 91.3], snr: [89.5, 88.4, 90.5], leafRec: [98.9, 98.1, 99.6] },
    '#3089': { hit: [99.6, 99, 100], ndcg: [89.5, 86.9, 92], snr: [89.5, 88.3, 90.5], leafRec: [98.7, 97.8, 99.4] },
    '#3089+#3102': { hit: [99.6, 99, 100], ndcg: [90.6, 88.3, 92.9], snr: [89.9, 88.9, 90.9], leafRec: [98.8, 97.9, 99.5] },
    '#3089+#3102+meta': { hit: [99.4, 98.7, 100], ndcg: [91.3, 89.1, 93.4], snr: [90.2, 89.2, 91.1], leafRec: [98.9, 98.1, 99.6] },
    'Gemini 001': { hit: [100, 100, 100], ndcg: [94, 92.1, 95.7], snr: [91.4, 90.8, 92.1], leafRec: [99.5, 99.1, 99.9] },
    'Gemini Flash': { hit: [99.4, 98.4, 100], ndcg: [96.8, 95.3, 98.1], snr: [91.8, 90.6, 92.8], leafRec: [98.8, 97.5, 99.7] },
  },
};

/** @type {Record<string, Array<[number, number, number, number, number]>>} */
const K_CURVES = {
  minilm_verbose: [[1, 105, 53.3, 45.4, 44], [2, 210, 68.7, 56.9, 58.3], [3, 315, 77.3, 62.5, 65.7], [5, 524, 86.1, 67.1, 71.5], [8, 839, 91.4, 69.7, 67.1], [10, 1049, 93.5, 70.6, 60.3], [15, 1573, 96.9, 72, 40.5], [20, 2098, 98.5, 72.5, 18.9]],
  minilm_compact: [[1, 53, 53.3, 45.4, 44], [2, 106, 68.7, 56.9, 58.7], [3, 159, 77.3, 62.5, 66.8], [5, 265, 86.1, 67.1, 73.9], [8, 424, 91.4, 69.7, 77.4], [10, 529, 93.5, 70.6, 78.1], [15, 794, 96.9, 72, 71.2], [20, 1059, 98.5, 72.5, 60.9]],
  static_compact: [[1, 53, 58.4, 50.4, 48.9], [2, 106, 73.6, 61.8, 63.4], [3, 159, 81.4, 67, 70.9], [5, 265, 86.8, 70.3, 75.4], [8, 424, 92.5, 73.1, 79.3], [10, 530, 93.6, 73.6, 79], [15, 795, 97.3, 75, 72.2], [20, 1060, 98.6, 75.6, 61.9]],
  gemini_001: [[1, 53, 68, 59.3, 57.6], [2, 106, 81.5, 70.8, 72], [3, 159, 87.3, 75.3, 78.2], [5, 265, 92.7, 78.7, 82.9], [8, 424, 96.3, 80.9, 85.3], [10, 530, 96.9, 81.3, 84.8], [15, 795, 97.8, 81.8, 75.6], [20, 1060, 98.6, 82.2, 64.8]],
};

/** @type {MilestoneDef[]} */
const MILESTONES = [
  { id: 'pre-#528', date: '2026-03-23', label: 'pre-#528', sub: 'whole guide', k: 5, when: 'Shipped through v0.0.26', note: 'One embedding per guide; long guides were truncated.' },
  { id: '#528', date: '2026-04-10', label: '#528', sub: 'chunk max-pool', k: 5, when: 'Released Apr 10 in v0.0.27', note: 'Splits guides into chunks and scores each guide by its best chunk.' },
  { id: '#824', date: '2026-05-14', label: '#824', sub: '+ features', k: 5, when: 'Released v0.0.138 through v0.0.194', note: 'Adds each guide’s features list to its chunk embeddings.' },
  {
    id: 'v0.0.195', date: '2026-10-19', label: 'v0.0.195', sub: '#1853 gate', k: 5, when: 'Released · tagged Oct 19',
    note: '#1853 cleaned up chunks but added a 0.35 floor and a 0.38 top-1 hurdle; anything below returns [].', tone: 'bad',
    counterfactual: { id: '#1853-clean', note: 'The same #1853 chunk cleanup (title + description instead of raw YAML, bare headings merged) without the gate.' },
  },
  { id: '#2052', date: '2026-10-21', label: 'v0.0.196', sub: '#2052 BM25', k: 5, when: 'Shipped Oct 26 in v0.0.196 (with #2130’s dialog guide)', note: 'Replaces the 0.38 gate with a 0.30 MiniLM floor; fuses BM25 with MiniLM via reciprocal rank fusion.' },
  { id: '#3048', date: '2026-10-26', label: '#3048', sub: 'top-10', k: 10, when: 'Shipped Nov 2 in v0.0.197', note: 'Returns 10 compact {id, description} results instead of 5 verbose ones.', annotation: 'segment' },
  { id: '#3048+#3102', date: '2026-10-30', label: '#3102', sub: 'BM25 stem', k: 10, when: 'Shipped Nov 2 in v0.0.197', note: 'Lucene EnglishMinimalStemmer in tokenizeBm25(), BM25-aware 0.30 similarity gate, and sub-floor dense exclusion on BM25 rescues.' },
  { id: 'rag-chunk-metadata', date: '2026-10-31', label: '#3172', sub: 'chunk meta', k: 10, when: 'Merged Nov 2 · on main', note: 'Prepends guide title, ID, category, and raw + unslugged web-feature IDs to every chunk for MiniLM and BM25 indexing.' },
  { id: '#3089+#3102+meta', date: '2026-11-04', label: '#3089', sub: 'static 256-d', k: 10, when: 'Merged Nov 4 · on main', note: '256-d Int8 static query vectors against build-time gemini-embedding-001 chunk vectors + BM25 rescue gate (0.30 floor), stacked on #3102 and #3172 (3.2× faster cold start, −58% RAM, −64% tarball).', tone: 'current', annotation: 'below' },
  { id: 'Gemini 001', label: 'gemini-001', sub: 'online 768-d', k: 10, when: 'Online API · not an offline option', note: '768-d gemini-embedding-001 alone, embedding every query online.', tone: 'research' },
  { id: 'Gemini Flash', label: 'gemini-flash', sub: 'online catalog', k: 10, when: 'Online LLM · not an offline option', note: 'gemini-3.8-flash reading all 192 guide descriptions (~8.1k tokens) and ranking the top 10 per query. Note: also graded qrels from full guide cards.', tone: 'ceiling' },
];

const PHASES = [
  { label: 'In npm', from: 0, to: 6 },
  { label: 'On main', from: 7, to: 8, shaded: true },
  { label: 'Reference', from: 9, to: 10 },
];

/** @type {Record<MetricKey, { name: string, short: string }>} */
const METRICS = {
  hit: { name: 'Right guide shown', short: 'Hit@K' },
  ndcg: { name: 'Leaf nDCG@K', short: 'Leaf nDCG' },
  snr: { name: 'Signal-to-noise', short: 'Signal-to-noise' },
};

/** @type {Record<ViewKey, { name: string, detail: string }>} */
const VIEWS = {
  all: { name: 'Wild-v2 test', detail: '865 of 2,000 held-out queries (#3106) · gemini-3.8-flash judge' },
  short: { name: 'Short queries', detail: '2–5 words · 702 test queries, 81% of test split' },
  long: { name: 'Long queries', detail: '6+ words · 159 test queries' },
  nightly: { name: 'Agent test', detail: '494 of 514 held-out task queries (#3106) · 70 guide clusters' },
};

/** @type {Record<ViewKey, (v: (id: string) => number, m: string) => string>} */
const VIEW_NOTES = {
  all: (v, m) => `${m}: the gate cost ${pp(v('v0.0.195') - v('#1853-clean'))} vs. the same cleanup without it; top-10 added ${pp(v('#3048') - v('#2052'))}; #3102 + #3172 + #3089 added ${pp(v('#3089+#3102+meta') - v('#3048'))}.`,
  short: (v, m) => `${m} on 2–5 word queries: #1853 cleanup ${pp(v('#1853-clean') - v('#824'))}, gate ${pp(v('v0.0.195') - v('#1853-clean'))}, #3089 vs #3048 ${pp(v('#3089+#3102+meta') - v('#3048'))}.`,
  long: (v, m) => `${m} on 6+ word queries (n=159): #3089 ${v('#3089+#3102+meta').toFixed(1)}% vs #3048 ${v('#3048').toFixed(1)}% (${pp(v('#3089+#3102+meta') - v('#3048'))}).`,
  nightly: (v, m) => `${m} on held-out agent task queries (#3106, 70 clusters): #3048 ${v('#3048').toFixed(1)}%, #3089 ${v('#3089+#3102+meta').toFixed(1)}% (${pp(v('#3089+#3102+meta') - v('#3048'))}).`,
};

const PR_URL = 'https://github.com/GoogleChrome/modern-web-guidance-src/pull/';
/** @type {TableRowDef[]} */
const TABLE_ROWS = [
  { name: 'pre-#528', id: 'pre-#528', when: 'through v0.0.26', what: 'One MiniLM-L6-v2 embedding per guide; long guides truncated', output: 'top-5 verbose' },
  { name: '#528', pr: 528, id: '#528', when: 'Apr 10 · v0.0.27', what: 'Splits guides into chunks; scores each guide by its best chunk', output: 'top-5 verbose' },
  { name: '#824', pr: 824, id: '#824', when: 'May 14 · v0.0.138', what: 'Prepends each guide’s features list to its chunk embeddings', output: 'top-5 verbose' },
  { name: '#1718', pr: 1718, same: '#824', when: 'Oct 6 · v0.0.193', what: 'In-tree tokenizer replaces @xenova/transformers', output: 'top-5 verbose' },
  { name: '#1853 cleanup, no gate', pr: 1853, id: '#1853-clean', when: 'counterfactual', what: 'Drops bare-heading chunks; embeds title + description instead of raw YAML', output: 'top-5 verbose', tone: 'cf' },
  { name: 'v0.0.195', prs: [1853, 1850], id: 'v0.0.195', when: 'Oct 19', what: 'Adds a strict similarity gate (returns [] below 0.38); SKILL.md asks for 2–5 word queries', output: 'top-5 verbose', tone: 'bad' },
  { name: 'v0.0.196', prs: [2052, 2130], id: '#2052', when: 'Oct 26 · v0.0.196', what: 'Replaces the gate with BM25 + MiniLM hybrid search (RRF); adds dialog guide', output: 'top-5 verbose' },
  { name: '#3048', pr: 3048, id: '#3048', when: 'Shipped Nov 2 in v0.0.197', what: 'Returns 10 compact {id, description} results instead of 5 verbose; compacts <code>list</code>', output: 'top-10 compact' },
  { name: '#3102', pr: 3102, id: '#3048+#3102', when: 'Shipped Nov 2 in v0.0.197', what: 'BM25 plural stemming (EnglishMinimalStemmer) + never return [] when BM25 has matches', output: 'top-10 compact' },
  { name: '#3172', pr: 3172, id: 'rag-chunk-metadata', when: 'Merged Nov 2 · on main', what: 'Prepends guide title, category, and web-feature IDs to every chunk for MiniLM & BM25', output: 'top-10 compact' },
  { name: '#3089', pr: 3089, id: '#3089+#3102+meta', when: 'Merged Nov 4 · on main', what: '256-d static query vectors × build-time gemini-embedding-001 chunks on top of #3102 + #3172 (3.2× faster, −58% RAM, −64% tarball; 93.6% Hit / 73.6% nDCG before #3102+#3172)', output: 'top-10 compact', tone: 'current' },
  { name: '#3103', pr: 3103, unmeasured: true, when: 'Merged · SKILL.md', what: 'SKILL.md: name implied UI components and rephrase once before <code>list</code>', output: '—' },
  { name: 'gemini-embedding-001', id: 'Gemini 001', when: 'reference', what: 'Online 768-d embedding API per query', output: 'top-10 compact', tone: 'research' },
  { name: 'gemini-3.8-flash', id: 'Gemini Flash', when: 'reference', what: 'Online LLM ranks top 10 from the 192-guide {id, description} <code>list</code> catalog', output: 'top-10 compact', tone: 'ceiling' },
  { name: 'Perfect LLM router', oracle: true, when: 'theoretical', what: 'Oracle upper bound: returns only the relevant leaf guides', output: '~1.4 results', tone: 'oracle' },
];

const K_SERIES = [
  { key: 'minilm_verbose', label: '#2052 verbose', sub: '105 tok/result', color: 'var(--nightly)', dash: '5 4' },
  { key: 'minilm_compact', label: '#3048 compact', sub: '53 tok/result', color: 'var(--warm)', dash: '' },
  { key: 'static_compact', label: '#3089 static × gemini-emb', sub: '53 tok/result', color: 'var(--accent)', dash: '' },
  { key: 'gemini_001', label: 'gemini-embedding-001', sub: 'online API', color: 'var(--text)', dash: '2 3' },
];
/** @type {Record<MetricKey, 2 | 3 | 4>} */
const K_COLUMN = { hit: 2, ndcg: 3, snr: 4 };
const ORACLE = { k: 1.4, tokens: 74 };

/** @type {SystemDef[]} */
const SYSTEMS = [
  { label: 'v0.0.157', sub: 'npm', quality: '#824', ms: 795, rss: 324, tarball: 22.3, tokens: 507, kind: 'history' },
  { label: 'v0.0.193', sub: 'npm', quality: '#824', ms: 700, rss: 343, tarball: 23.0, tokens: 507, kind: 'history' },
  { label: 'v0.0.195', sub: 'gate', quality: 'v0.0.195', ms: 685, rss: 342, tarball: 23.1, tokens: 507, tone: 'bad', labelSide: 'left' },
  { label: '#3048', sub: 'RRF + top-10', quality: '#3048', ms: 770, rss: 346, tarball: 23.4, tokens: 528 },
  { label: '#3089', sub: 'static', quality: '#3089+#3102+meta', ms: 240, rss: 145, tarball: 8.3, tokens: 528, tone: 'current', labelSide: 'left' },
];
/** @type {SystemDef[]} */
const SYSTEMS_REFERENCE = [
  { label: 'gemini-embedding-001', sub: 'online API', quality: 'Gemini 001', ms: 450, note: 'Measured separately: 450 ms cold (423 ms is the API round trip), 68 MB RSS. Needs network and an API key.' },
];
const R_MAX = 20;
const RESEARCH_R = 7;

/* ───── Helpers ───── */
/** @param {string} id */
function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

/**
 * @param {[number, number]} domain
 * @param {[number, number]} range
 */
const linear = ([d0, d1], [r0, r1]) => (/** @type {number} */ v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
/** @param {number} d */
const pp = (d) => `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(1)} pp`;
/** @param {number} n */
const num = (n) => n.toLocaleString('en-US');
/** @param {string} [t] */
const toneClass = (t) => (t ? `is-${t}` : '');

/* ───── Tooltip (mouse enhancement; every value is also labeled on the chart) ───── */
const tipEl = $('tip');
/** @type {Map<string, string>} */
const TIPS = new Map();
/** @type {Map<string, string> | null} */
let BASE_TIPS = null;

/** @param {string} html */
function tip(html) {
  const id = `t${TIPS.size}`;
  TIPS.set(id, html);
  return `data-tip="${id}"`;
}

/** @param {Element} target */
function showTip(target) {
  const id = target.getAttribute('data-tip');
  if (!id) return;
  tipEl.innerHTML = TIPS.get(id) ?? '';
  tipEl.hidden = false;
  const r = target.getBoundingClientRect();
  const t = tipEl.getBoundingClientRect();
  const left = Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), innerWidth - t.width - 8);
  const top = r.top - t.height - 10 >= 8 ? r.top - t.height - 10 : r.bottom + 10;
  tipEl.style.translate = `${Math.round(left)}px ${Math.round(top)}px`;
}

const hideTip = () => { tipEl.hidden = true; };
document.addEventListener('pointerover', (e) => {
  if (!(e.target instanceof Element)) return;
  const target = e.target.closest('[data-tip]');
  if (target instanceof Element) showTip(target);
});
document.addEventListener('pointerout', (e) => {
  if (!(e.target instanceof Element)) return;
  const target = e.target.closest('[data-tip]');
  if (target && (!(e.relatedTarget instanceof Node) || !target.contains(e.relatedTarget))) hideTip();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });
addEventListener('scroll', hideTip, { passive: true });

/* ───── Section 1 (A) · Right guide in what agents saw ───── */
/** @type {{ metric: MetricKey, view: ViewKey, xAxis: 'milestone' | 'time', kMetric: MetricKey, bY: MetricKey }} */
const state = { metric: 'hit', view: 'all', xAxis: 'milestone', kMetric: 'snr', bY: 'hit' };
/** @param {string | undefined} d */
const parseDate = (d) => new Date(`${d ?? '2026-01-01'}T00:00:00Z`).getTime();
const research = MILESTONES.findIndex((m) => m.tone === 'research');
const T_MIN = parseDate(MILESTONES[0].date);
const T_MAX = parseDate(MILESTONES[research - 1].date);
const MONTH_TICKS = [
  { name: 'Apr', date: '2026-04-01' },
  { name: 'May', date: '2026-05-01' },
  { name: 'Jun', date: '2026-06-01' },
  { name: 'Jul', date: '2026-07-01' },
  { name: 'Aug', date: '2026-08-01' },
  { name: 'Sep', date: '2026-09-01' },
  { name: 'Oct', date: '2026-10-01' },
];

/**
 * @param {ViewKey} view
 * @param {string} id
 * @param {MetricKey} [metric]
 */
const q = (view, id, metric = state.metric) => QUALITY[view][id][metric];
/** @type {Record<MetricKey, string>} */
const METRIC_ROW_LABEL = { hit: 'Hit@K', ndcg: 'nDCG', snr: 'SNR' };

/**
 * @param {string} name
 * @param {SeriesPoint} s
 */
function seriesCell(name, s) {
  return `<span>${name}</span><b>${s[0].toFixed(1)}%<small>${s[1]}–${s[2]}</small></b>`;
}

/**
 * @param {ViewKey} view
 * @param {string} id
 */
function metricCells(view, id) {
  /** @type {Array<[MetricKey, { name: string, short: string }]>} */
  const entries = [
    ['hit', METRICS.hit],
    ['ndcg', METRICS.ndcg],
    ['snr', METRICS.snr],
  ];
  return entries.map(([key, m]) => seriesCell(m.short, q(view, id, key))).join('');
}

/**
 * @param {MilestoneDef} m
 * @param {MilestoneDef} [prev]
 */
function milestoneTip(m, prev) {
  return `<div class="tip-title">${m.label} · ${m.sub} · top-${m.k}</div>
    <div class="tip-grid">${metricCells(state.view, m.id)}</div>
    <div class="tip-meta">${VIEWS[state.view].name}${prev ? ` · ${pp(q(state.view, m.id)[0] - q(state.view, prev.id)[0])} vs ${prev.label}` : ''}</div>
    <div class="tip-note">${m.note}</div>
    <div class="tip-meta">${m.when}</div>`;
}

/** @param {MilestoneDef} m */
function counterfactualTip(m) {
  const c = m.counterfactual;
  if (!c) return '';
  return `<div class="tip-title">#1853 cleanup without the gate</div>
    <div class="tip-grid">${metricCells(state.view, c.id)}</div>
    <div class="tip-note">${c.note}</div>
    <div class="tip-meta">Counterfactual · the shipped gate cost ${pp(q(state.view, m.id)[0] - q(state.view, c.id)[0])}</div>`;
}

const W = 1000, H = 420, pad = { t: 46, r: 30, b: 90, l: 56 }, inset = 34;
const base = H - pad.b;
const step = (W - pad.l - pad.r - 2 * inset) / (MILESTONES.length - 1);
const gate = MILESTONES.findIndex((m) => Boolean(m.counterfactual));
const cfId = MILESTONES[gate].counterfactual?.id ?? '#1853-clean';

const xStart = pad.l + inset;
const xEnd = 760;

/**
 * @param {ViewKey} view
 * @param {MetricKey} metric
 * @param {boolean} isTime
 * @returns {MilestoneGeom}
 */
function computeMilestoneGeom(view, metric, isTime) {
  /** @param {number} i */
  const getX = (i) => {
    if (!isTime) return pad.l + inset + i * step;
    if (i < research) {
      const t = parseDate(MILESTONES[i].date);
      return xStart + ((t - T_MIN) / (T_MAX - T_MIN)) * (xEnd - xStart);
    }
    return i === research ? 830 : 938;
  };
  const ids = [...MILESTONES.map((m) => m.id), cfId];
  const lo = Math.floor((Math.min(...ids.map((id) => q(view, id, metric)[1])) - 1) / 5) * 5;
  const tick = 100 - lo > 35 ? 10 : 5;
  const y = linear([lo, 100], [base, pad.t]);

  const tOct6 = parseDate('2026-10-06');
  const xOct6 = isTime ? xStart + ((tOct6 - T_MIN) / (T_MAX - T_MIN)) * (xEnd - xStart) : getX(2);
  /** @param {number} i */
  const v = (i) => q(view, MILESTONES[i].id, metric)[0];
  const yOct6 = y(v(2));

  const ms = MILESTONES.map((m, i) => {
    const qData = q(view, m.id, metric);
    const val = qData[0];
    const x = getX(i);
    const cy = y(val);
    const ciLo = y(qData[1]);
    const ciHi = y(qData[2]);
    return { x, y: cy, ciLo, ciHi, val };
  });

  const cfVal = q(view, cfId, metric)[0];
  const cfX0 = isTime ? xOct6 : getX(gate - 1);
  const cfY0 = y(v(gate - 1));
  const cfX = getX(gate);
  const cfY = y(cfVal);

  return {
    ms,
    cfX0,
    cfY0,
    cfX,
    cfY,
    cfVal,
    xOct6,
    yOct6,
    isTime,
    view,
    metric,
    lo,
    tick,
  };
}

/**
 * @param {MilestoneGeom} a
 * @param {MilestoneGeom} b
 * @param {number} t
 * @returns {MilestoneGeom}
 */
function interpolateGeom(a, b, t) {
  /**
   * @param {number} v1
   * @param {number} v2
   */
  const lerp = (v1, v2) => v1 + (v2 - v1) * t;
  const ms = b.ms.map((bm, i) => {
    const am = a.ms[i] || bm;
    return {
      x: lerp(am.x, bm.x),
      y: lerp(am.y, bm.y),
      ciLo: lerp(am.ciLo, bm.ciLo),
      ciHi: lerp(am.ciHi, bm.ciHi),
      val: bm.val,
    };
  });
  return {
    ms,
    cfX0: lerp(a.cfX0, b.cfX0),
    cfY0: lerp(a.cfY0, b.cfY0),
    cfX: lerp(a.cfX, b.cfX),
    cfY: lerp(a.cfY, b.cfY),
    cfVal: b.cfVal,
    xOct6: lerp(a.xOct6, b.xOct6),
    yOct6: lerp(a.yOct6, b.yOct6),
    isTime: b.isTime,
    view: b.view,
    metric: b.metric,
    lo: b.lo,
    tick: b.tick,
  };
}

/** @type {MilestoneGeom | null} */
let prevGeom = null;
/** @type {MilestoneGeom | null} */
let currentGeom = null;
/** @type {number | null} */
let animFrameId = null;

/**
 * @param {MilestoneGeom} geom
 * @param {boolean} isFinal
 * @param {boolean} isFirst
 */
function renderMilestonesFrame(geom, isFinal, isFirst) {
  const svg = $('svg-a');
  TIPS.clear();
  if (BASE_TIPS) {
    for (const [k, v] of BASE_TIPS) TIPS.set(k, v);
  }

  const parts = ['<defs><linearGradient id="a-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" class="a-fill-0"/><stop offset="1" class="a-fill-1"/></linearGradient></defs>'];

  if (!geom.isTime) {
    /**
     * @param {number} i
     * @param {number} side
     */
    const edge = (i, side) => {
      const j = i + side;
      if (j < 0) return pad.l;
      if (j >= MILESTONES.length) return W - pad.r;
      return (geom.ms[i].x + geom.ms[j].x) / 2;
    };
    for (const p of PHASES) {
      const x0 = edge(p.from, -1), x1 = edge(p.to, 1);
      if (p.shaded) parts.push(`<rect class="a-phase" x="${x0}" y="${pad.t}" width="${x1 - x0}" height="${base - pad.t}"/>`);
      parts.push(`<line class="a-phase-rule" x1="${x0 + 8}" x2="${x1 - 8}" y1="${pad.t - 10}" y2="${pad.t - 10}"/>`,
        `<text class="a-phase-label" x="${(x0 + x1) / 2}" y="${pad.t - 18}" text-anchor="middle">${p.label}</text>`);
    }
  } else {
    const x0 = pad.l, x1 = (geom.ms[research - 1].x + geom.ms[research].x) / 2;
    parts.push(
      `<line class="a-phase-rule" x1="${x0 + 8}" x2="${x1 - 8}" y1="${pad.t - 10}" y2="${pad.t - 10}"/>`,
      `<text class="a-phase-label" x="${(x0 + x1) / 2}" y="${pad.t - 18}" text-anchor="middle">Mar – Nov 2026 (releases &amp; main)</text>`,
      `<line class="a-phase-rule" x1="${x1 + 8}" x2="${W - pad.r - 8}" y1="${pad.t - 10}" y2="${pad.t - 10}"/>`,
      `<text class="a-phase-label" x="${(x1 + W - pad.r) / 2}" y="${pad.t - 18}" text-anchor="middle">Reference</text>`,
      `<line class="grid" x1="${x1}" x2="${x1}" y1="${pad.t}" y2="${base}" stroke-dasharray="3,3"/>`
    );
  }

  const y = linear([geom.lo, 100], [base, pad.t]);
  for (let t = geom.lo + ((geom.tick - (geom.lo % geom.tick)) % geom.tick); t <= 100; t += geom.tick) {
    parts.push(`<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/>`,
      `<text class="axis" x="${pad.l - 10}" y="${y(t) + 4}" text-anchor="end">${t}%</text>`);
  }
  parts.push(`<line class="baseline" x1="${pad.l}" x2="${W - pad.r}" y1="${base}" y2="${base}"/>`);

  MILESTONES.forEach((_m, i) => {
    const { x: cx, ciLo, ciHi } = geom.ms[i];
    parts.push(`<path class="a-ci" d="M${cx},${ciLo}V${ciHi}M${cx - 4},${ciLo}h8M${cx - 4},${ciHi}h8"/>`);
  });

  const wildPts = [];
  for (let i = 0; i < research; i++) {
    wildPts.push([geom.ms[i].x, geom.ms[i].y]);
    if (i === 2) wildPts.push([geom.xOct6, geom.yOct6]);
  }
  const wild = wildPts.map(([px, py], k) => `${k ? 'L' : 'M'}${px},${py}`).join('');
  const x0 = geom.ms[0].x;
  const xPeak = geom.ms[research - 1].x;
  parts.push(`<path class="a-area a-reveal" style="--i:${research}" d="${wild}L${xPeak},${base}L${x0},${base}Z"/>`,
    `<path class="a-line" d="${wild}"/>`);

  const researchPts = [];
  for (let i = research - 1; i < MILESTONES.length; i++) {
    researchPts.push([geom.ms[i].x, geom.ms[i].y]);
  }
  const researchLine = researchPts.map(([px, py], k) => `${k ? 'L' : 'M'}${px},${py}`).join('');
  parts.push(`<path class="a-line-research a-reveal" style="--i:${research}" d="${researchLine}"/>`);

  parts.push(`<path class="a-cf-line a-reveal" style="--i:${gate}" d="M${geom.cfX0},${geom.cfY0}L${geom.cfX},${geom.cfY}"/>`);
  const gateY = geom.ms[gate].y;
  if (gateY - geom.cfY > 16) {
    parts.push(`<line class="a-gate-drop a-reveal" style="--i:${gate}" x1="${geom.cfX}" x2="${geom.cfX}" y1="${geom.cfY + 7}" y2="${gateY - 8}"/>`);
  }

  MILESTONES.forEach((m, i) => {
    const { x: cx, y: cy } = geom.ms[i];
    const current = m.tone === 'current';
    parts.push(`<g class="a-pt ${toneClass(m.tone)} a-reveal" style="--i:${i}" ${tip(milestoneTip(m, MILESTONES[i - 1]))}>
      ${current ? `<circle class="a-ring" cx="${cx}" cy="${cy}" r="13"/>` : ''}
      <circle class="hit" cx="${cx}" cy="${cy}" r="16"/>
      <circle class="dot" cx="${cx}" cy="${cy}" r="${current ? 7 : 5.5}"/></g>`);
  });

  parts.push(`<g class="a-pt is-cf a-reveal" style="--i:${gate}" ${tip(counterfactualTip(MILESTONES[gate]))}><circle class="hit" cx="${geom.cfX}" cy="${geom.cfY}" r="16"/><circle class="dot" cx="${geom.cfX}" cy="${geom.cfY}" r="5.5"/></g>`);

  if (!geom.isTime) {
    const gateVal = geom.ms[gate].val;
    const cfVal = geom.cfVal;
    parts.push(
      `<text class="a-cf-label halo a-reveal" style="--i:${gate}" x="${geom.cfX}" y="${geom.cfY - 13}" text-anchor="middle">${cfVal.toFixed(1)}% without gate</text>`,
      `<text class="a-delta halo is-bad a-reveal" style="--i:${gate}" x="${geom.cfX}" y="${gateY + 23}" text-anchor="middle">gate ${pp(gateVal - cfVal)}</text>`
    );

    MILESTONES.forEach((m, i) => {
      if (!m.annotation) return;
      const d = geom.ms[i].val - geom.ms[i - 1].val, text = pp(d), tone = d < 0 ? 'muted' : 'good';
      const x1 = geom.ms[i].x, y1 = geom.ms[i].y;
      if (m.annotation === 'below') {
        parts.push(`<text class="a-delta halo is-${tone} a-reveal" style="--i:${i}" x="${x1}" y="${y1 + 24}" text-anchor="middle">${text}</text>`);
        return;
      }
      const x0 = geom.ms[i - 1].x, y0 = geom.ms[i - 1].y;
      const len = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / len, ny = (x1 - x0) / len, OFFSET = 16;
      parts.push(`<text class="a-delta halo is-${tone} a-reveal" style="--i:${i}" x="${(x0 + x1) / 2 + nx * OFFSET}" y="${(y0 + y1) / 2 + ny * OFFSET + 4}" text-anchor="${nx > 0.3 ? 'start' : nx < -0.3 ? 'end' : 'middle'}">${text}</text>`);
    });

    const rowY = base + 27;
    parts.push(`<text class="a-row-label is-accent" x="${pad.l - 10}" y="${rowY}" text-anchor="end">${METRIC_ROW_LABEL[geom.metric]}</text>`);
    MILESTONES.forEach((m, i) => {
      const mx = geom.ms[i].x;
      parts.push(`<text class="a-row ${toneClass(m.tone)}" x="${mx}" y="${rowY}" text-anchor="middle">${geom.ms[i].val.toFixed(1)}%</text>`,
        `<text class="a-x mono ${toneClass(m.tone)}" x="${mx}" y="${base + 57}" text-anchor="middle">${m.label}</text>`,
        `<text class="a-x-sub" x="${mx}" y="${base + 73}" text-anchor="middle">${m.sub}</text>`);
    });
  } else {
    for (let i = 0; i <= 2; i++) {
      const m = MILESTONES[i];
      const { x: mx, y: my, val } = geom.ms[i];
      parts.push(
        `<text class="a-x mono halo a-reveal" style="--i:${i}" x="${mx}" y="${my - 14}" text-anchor="middle">${m.label}</text>`,
        `<text class="a-row halo a-reveal" style="--i:${i}" x="${mx}" y="${my + 22}" text-anchor="middle">${val.toFixed(1)}%</text>`
      );
    }
    const gateVal = geom.ms[gate].val;
    parts.push(`<text class="a-x mono halo is-bad a-reveal" style="--i:${gate}" x="${geom.cfX - 10}" y="${gateY + 16}" text-anchor="end">${MILESTONES[gate].label} · ${gateVal.toFixed(1)}%</text>`);

    const i3048 = MILESTONES.findIndex((m) => m.id === '#3048');
    parts.push(`<text class="a-x mono halo a-reveal" style="--i:${i3048}" x="${geom.ms[i3048].x - 10}" y="${geom.ms[i3048].y + 16}" text-anchor="end">${MILESTONES[i3048].label} · ${geom.ms[i3048].val.toFixed(1)}%</text>`);

    const iPeak = research - 1;
    parts.push(`<text class="a-x mono halo is-current a-reveal" style="--i:${iPeak}" x="${geom.ms[iPeak].x - 10}" y="${geom.ms[iPeak].y - 12}" text-anchor="end">${MILESTONES[iPeak].label} · ${geom.ms[iPeak].val.toFixed(1)}%</text>`);

    const rowY = base + 27;
    parts.push(`<text class="a-row-label" x="${pad.l - 10}" y="${base + 22}" text-anchor="end">2026</text>`);
    for (const m of MONTH_TICKS) {
      const t = parseDate(m.date);
      const tx = xStart + ((t - T_MIN) / (T_MAX - T_MIN)) * (xEnd - xStart);
      parts.push(
        `<line class="grid" x1="${tx}" x2="${tx}" y1="${base}" y2="${base + 6}"/>`,
        `<text class="axis mono" x="${tx}" y="${base + 22}" text-anchor="middle">${m.name}</text>`
      );
    }
    for (let i = research; i < MILESTONES.length; i++) {
      const m = MILESTONES[i];
      const mx = geom.ms[i].x;
      parts.push(
        `<text class="a-row ${toneClass(m.tone)}" x="${mx}" y="${rowY}" text-anchor="middle">${geom.ms[i].val.toFixed(1)}%</text>`,
        `<text class="a-x mono ${toneClass(m.tone)}" x="${mx}" y="${base + 57}" text-anchor="middle">${m.label}</text>`,
        `<text class="a-x-sub" x="${mx}" y="${base + 73}" text-anchor="middle">${m.sub}</text>`
      );
    }
  }

  svg.innerHTML = parts.join('');
  svg.classList.toggle('is-static', !isFirst);
  if (isFinal) {
    svg.setAttribute('aria-label', `${METRICS[geom.metric].name}, ${VIEWS[geom.view].name}: ${MILESTONES.map((m, i) => `${m.label} ${geom.ms[i].val}%`).join(', ')}.`);
    const line = svg.querySelector('.a-line');
    if (line instanceof SVGGeometryElement) {
      line.style.setProperty('--len', line.getTotalLength().toFixed(1));
    }
  }
}

function renderMilestones() {
  const svg = $('svg-a');
  const firstRender = !svg.hasChildNodes();
  const view = state.view;
  const metric = state.metric;
  const isTime = state.xAxis === 'time';

  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  $('a-legend').innerHTML = `<li>${VIEWS[view].name} <small>${VIEWS[view].detail}</small></li>`;
  $('a-note').textContent = VIEW_NOTES[view]((id) => q(view, id, metric)[0], METRICS[metric].short);
  for (const p of document.querySelectorAll('#a [data-metric-note]')) {
    if (p instanceof HTMLElement) {
      p.hidden = p.dataset.metricNote !== metric;
    }
  }
  renderSparks();

  const targetGeom = computeMilestoneGeom(view, metric, isTime);
  const shouldAnimate = !firstRender && prevGeom && !matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!shouldAnimate) {
    currentGeom = targetGeom;
    prevGeom = targetGeom;
    renderMilestonesFrame(targetGeom, true, firstRender);
    return;
  }

  const fromGeom = currentGeom || prevGeom;
  if (!fromGeom) return;
  const startTime = performance.now();
  const duration = 280;

  /** @param {number} now */
  function frame(now) {
    if (!fromGeom) return;
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const ease = 1 - Math.pow(1 - progress, 3);
    const isEnd = progress >= 1;
    currentGeom = isEnd ? targetGeom : interpolateGeom(fromGeom, targetGeom, ease);
    renderMilestonesFrame(currentGeom, isEnd, false);
    if (!isEnd) {
      animFrameId = requestAnimationFrame(frame);
    } else {
      animFrameId = null;
      prevGeom = targetGeom;
    }
  }
  animFrameId = requestAnimationFrame(frame);
}

function renderSparks() {
  const SW = 300, SH = 64, spad = 7;
  const isTime = state.xAxis === 'time';
  const current = MILESTONES.findIndex((m) => m.tone === 'current');
  /** @type {MetricKey[]} */
  const metricKeys = ['hit', 'ndcg', 'snr'];
  for (const metric of metricKeys) {
    const vals = MILESTONES.map((m) => q(state.view, m.id, metric)[0]);
    const cf = q(state.view, cfId, metric)[0];
    const y = linear([Math.min(...vals, cf) - 2, Math.max(...vals, cf) + 2], [SH - spad, spad]);
    /** @param {number} i */
    const x = (i) => {
      if (!isTime) return spad + i * ((SW - 2 * spad) / (MILESTONES.length - 1));
      if (i < research) {
        const t = parseDate(MILESTONES[i].date);
        const xS = spad + 4, xE = spad + Math.round((SW - 2 * spad) * 0.77);
        return xS + ((t - T_MIN) / (T_MAX - T_MIN)) * (xE - xS);
      }
      return i === research ? spad + Math.round((SW - 2 * spad) * 0.88) : SW - spad - 4;
    };
    /**
     * @param {number} from
     * @param {number} to
     */
    const line = (from, to) => {
      if (!isTime || from !== 0 || to !== research - 1) {
        return vals.slice(from, to + 1).map((val, k) => `${k ? 'L' : 'M'}${x(from + k)},${y(val)}`).join('');
      }
      const tOct6 = parseDate('2026-10-06');
      const xS = spad + 4, xE = spad + Math.round((SW - 2 * spad) * 0.77);
      const xOct6 = xS + ((tOct6 - T_MIN) / (T_MAX - T_MIN)) * (xE - xS);
      const pts = [];
      for (let i = 0; i < research; i++) {
        pts.push([x(i), y(vals[i])]);
        if (i === 2) pts.push([xOct6, y(vals[2])]);
      }
      return pts.map(([px, py], k) => `${k ? 'L' : 'M'}${px},${py}`).join('');
    };
    const dots = MILESTONES.map((m, i) => `<circle class="spark-dot ${toneClass(m.tone)}" cx="${x(i)}" cy="${y(vals[i])}" r="${i === current ? 3.5 : 2.5}"/>`).join('');
    $(`spark-${metric}`).innerHTML = `<path class="spark-line" d="${line(0, research - 1)}"/><path class="spark-line is-research" d="${line(research - 1, MILESTONES.length - 1)}"/>
      <circle class="spark-dot is-cf" cx="${x(gate)}" cy="${y(cf)}" r="2.5"/>${dots}`;
    const btn = document.querySelector(`.spark[data-metric="${metric}"]`);
    if (btn) btn.setAttribute('aria-pressed', String(metric === state.metric));
  }
}

/* ───── Section 3 (A2) · Result horizon ───── */
function renderHorizon() {
  const svg = $('svg-k'), col = K_COLUMN[state.kMetric];
  const KW = 1000, KH = 360, kpad = { t: 24, r: 30, b: 50, l: 56 };
  const kbase = KH - kpad.b;
  const lo = state.kMetric === 'snr' ? 0 : 40, tick = state.kMetric === 'snr' ? 20 : 10;
  const ks = K_CURVES.minilm_compact.map((r) => r[0]);
  const lastK = ks[ks.length - 1] ?? 20;
  /** @param {number} k */
  const x = (k) => kpad.l + (Math.log(k) / Math.log(lastK)) * (KW - kpad.l - kpad.r);
  const y = linear([lo, 100], [kbase, kpad.t]);
  const parts = [];
  for (let t = lo; t <= 100; t += tick) {
    parts.push(`<line class="grid" x1="${kpad.l}" x2="${KW - kpad.r}" y1="${y(t)}" y2="${y(t)}"/>`, `<text class="axis" x="${kpad.l - 10}" y="${y(t) + 4}" text-anchor="end">${t}%</text>`);
  }
  for (const k of ks) parts.push(`<text class="axis" x="${x(k)}" y="${kbase + 20}" text-anchor="middle">${k}</text>`);
  parts.push(`<text class="axis-title" x="${(kpad.l + KW - kpad.r) / 2}" y="${kbase + 42}" text-anchor="middle">Results returned per search (K, log scale)</text>`);
  /** @type {Array<[number, string]>} */
  const kGuides = [[5, 'K=5 · through v0.0.196'], [10, 'K=10 · from #3048']];
  for (const [k, label] of kGuides) {
    parts.push(`<line class="k-guide" x1="${x(k)}" x2="${x(k)}" y1="${kpad.t}" y2="${kbase}"/>`, `<text class="k-guide-label" x="${x(k) + 6}" y="${kbase - 8}">${label}</text>`);
  }
  for (const sr of K_SERIES) {
    const rows = K_CURVES[sr.key];
    const peak = rows.reduce((best, r) => (r[col] > best[col] ? r : best));
    parts.push(`<path class="k-line" style="stroke:${sr.color};${sr.dash ? `stroke-dasharray:${sr.dash}` : ''}" d="${rows.map((r, i) => `${i ? 'L' : 'M'}${x(r[0])},${y(r[col])}`).join('')}"/>`);
    for (const r of rows) {
      const isPeak = r === peak;
      parts.push(`<g ${tip(`<div class="tip-title">${sr.label} · K=${r[0]}</div><div class="tip-grid"><span>Hit@K</span><b>${r[2]}%</b><span>Leaf nDCG</span><b>${r[3]}%</b><span>Signal-to-noise</span><b>${r[4]}%</b><span>Stdout tokens</span><b>${num(r[1])}</b></div>`)}>
        <circle class="hit" cx="${x(r[0])}" cy="${y(r[col])}" r="9"/>
        ${isPeak ? `<circle class="k-peak" style="stroke:${sr.color}" cx="${x(r[0])}" cy="${y(r[col])}" r="7"/>` : ''}
        <circle class="k-dot" style="fill:${sr.color}" cx="${x(r[0])}" cy="${y(r[col])}" r="${isPeak ? 3.5 : 2.5}"/></g>`);
    }
  }
  const ox = x(ORACLE.k), oy = y(100);
  parts.push(`<g ${tip(`<div class="tip-title">Perfect LLM router (oracle)</div><div class="tip-note">A generative router, such as an LLM reading the guide catalog, that returns only the right leaf guides: ${ORACLE.k} per query on average (≈${ORACLE.tokens} tokens). Every metric is 100% by definition. A theoretical bound, not a measured system.</div>`)}><rect class="k-oracle" x="${ox - 5}" y="${oy - 5}" width="10" height="10" transform="rotate(45 ${ox} ${oy})"/></g>`,
    `<text class="k-oracle-label" x="${ox + 12}" y="${oy + 4}">Perfect LLM router (oracle) · ${ORACLE.k} guides ≈ ${ORACLE.tokens} tok · 100% by definition</text>`);
  svg.innerHTML = parts.join('');
  svg.setAttribute('aria-label', `${METRICS[state.kMetric].name} by K. ${K_SERIES.map((sr) => { const p = K_CURVES[sr.key].reduce((b, r) => (r[col] > b[col] ? r : b)); return `${sr.label} peaks at K=${p[0]} with ${p[col]}%`; }).join('; ')}.`);
  $('k-legend').innerHTML = K_SERIES.map((sr) => {
    const p = K_CURVES[sr.key].reduce((b, r) => (r[col] > b[col] ? r : b));
    return `<li style="--c:${sr.color}" class="${sr.dash ? 'is-dashed' : ''}">${sr.label} <small>${sr.sub} · peak K=${p[0]}, ${p[col]}%</small></li>`;
  }).join('');
}

/* ───── Section 2 · Milestones table ───── */
function renderTable() {
  /** @param {number} n */
  const link = (n) => `<a href="${PR_URL}${n}">#${n}</a>`;
  /** @param {TableRowDef} r */
  const name = (r) => (r.prs ? `${r.name} · ${r.prs.map(link).join(' + ')}` : r.pr ? r.name.replace(`#${r.pr}`, link(r.pr)) : r.name);
  /** @param {TableRowDef} r */
  const cells = (r) => {
    if (r.oracle) return '<td class="n">100%</td><td class="n">100%</td><td class="n">100%</td>';
    if (r.same) return `<td class="n same" colspan="3">same as ${r.same}</td>`;
    if (r.unmeasured) return '<td class="n same" colspan="3">not measurable offline</td>';
    const rowId = r.id ?? '';
    /** @type {MetricKey[]} */
    const cols = ['hit', 'ndcg', 'snr'];
    return cols.map((m) => `<td class="n">${QUALITY.all[rowId][m][0].toFixed(1)}%</td>`).join('');
  };
  const table = $('m-table');
  if (!(table instanceof HTMLTableElement) || !table.tBodies[0]) return;
  table.tBodies[0].innerHTML = TABLE_ROWS.map((r) => `<tr class="${toneClass(r.tone)}">
    <td class="m-name">${name(r)}</td><td class="when">${r.when}</td><td>${r.what}</td><td class="when">${r.output}</td>${cells(r)}</tr>`).join('');
}

/* ───── Section 4 (B) · Price vs. quality ───── */
/** @param {SystemDef} p */
function systemTip(p) {
  const qv = QUALITY.all[p.quality];
  const sizes = p.rss && p.tarball !== undefined ? `<span>Peak RSS</span><b>${p.rss} MB</b><span>npm tarball</span><b>${p.tarball.toFixed(1)} MB</b><span>Tokens / search</span><b>${p.tokens ?? ''}</b>` : '';
  return `<div class="tip-title">${p.label} · ${p.sub}</div>
    <div class="tip-grid"><span>Cold search</span><b>${p.ms} ms</b>${sizes}<span>Hit@K</span><b>${qv.hit[0]}%</b><span>Signal-to-noise</span><b>${qv.snr[0]}%</b></div>
    ${p.note ? `<div class="tip-note">${p.note}</div>` : ''}${p.kind === 'history' ? `<div class="tip-meta">Ships #824 search</div>` : ''}`;
}

function renderSystems() {
  const svg = $('svg-b'), metric = state.bY;
  const BW = 680, BH = 420, bpad = { t: 28, r: 24, b: 58, l: 52 };
  const bbase = BH - bpad.b;
  const x = linear([0, 1000], [bpad.l, BW - bpad.r]);
  /** @param {SystemDef} p */
  const val = (p) => QUALITY.all[p.quality][metric][0];
  const all = [...SYSTEMS, ...SYSTEMS_REFERENCE];
  const lo = Math.floor((Math.min(...all.map(val)) - 3) / 5) * 5, hi = Math.min(100, Math.ceil((Math.max(...all.map(val)) + 2) / 5) * 5);
  const y = linear([lo, hi], [bbase, bpad.t]);
  const parts = ['<defs><marker id="b-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="b-arrowhead" d="M0,1L9,5L0,9Z"/></marker></defs>'];
  for (let t = lo; t <= hi; t += 5) {
    parts.push(`<line class="grid" x1="${bpad.l}" x2="${BW - bpad.r}" y1="${y(t)}" y2="${y(t)}"/>`, `<text class="axis" x="${bpad.l - 10}" y="${y(t) + 4}" text-anchor="end">${t}%</text>`);
  }
  for (let ms = 0; ms <= 1000; ms += 250) {
    parts.push(`<line class="grid" x1="${x(ms)}" x2="${x(ms)}" y1="${bpad.t}" y2="${bbase}"/>`, `<text class="axis" x="${x(ms)}" y="${bbase + 20}" text-anchor="middle">${ms}</text>`);
  }
  parts.push(`<text class="axis-title" x="${(bpad.l + BW - bpad.r) / 2}" y="${bbase + 44}" text-anchor="middle">Cold search latency (ms)</text>`,
    `<text class="b-better" x="${bpad.l + 10}" y="${bpad.t + 16}">↖ better</text>`);

  const history = SYSTEMS.filter((p) => p.kind === 'history');
  const hx = history.map((p) => x(p.ms)), hy = y(val(history[0]));
  parts.push(`<g ${tip(history.map(systemTip).join('<hr>'))}><line class="b-band" x1="${Math.min(...hx)}" x2="${Math.max(...hx)}" y1="${hy}" y2="${hy}"/>${hx.map((px) => `<circle class="b-history" cx="${px}" cy="${hy}" r="4"/>`).join('')}</g>`,
    `<text class="b-sub" x="${Math.max(...hx) + 12}" y="${hy + 4}">v0.0.157 · v0.0.193</text>`);

  const bubbles = SYSTEMS.filter((p) => p.kind !== 'history');
  const [gateSys, best, current] = bubbles;
  /** @param {SystemDef} p */
  const pt = (p) => [x(p.ms), y(val(p))];
  const [[gx, gy], [bx, by], [cx, cy]] = [gateSys, best, current].map(pt);
  const len = Math.hypot(cx - bx, cy - by), gap = R_MAX + 6;
  parts.push(`<path class="b-path" d="M${gx},${gy}L${bx},${by}"/>`,
    `<path class="b-path" d="M${bx + ((cx - bx) / len) * gap},${by + ((cy - by) / len) * gap}L${cx + ((bx - cx) / len) * gap},${cy + ((by - cy) / len) * gap}" marker-end="url(#b-arrow)"/>`,
    `<text class="b-anno" x="${(bx + cx) / 2}" y="${(by + cy) / 2 + 26}" text-anchor="middle">${(best.ms / current.ms).toFixed(1)}× faster</text>`,
    `<text class="b-anno" x="${Math.min(gx, bx) - R_MAX - 14}" y="${(gy + by) / 2}" text-anchor="end">${pp(val(best) - val(gateSys))}</text>`,
    `<text class="b-anno-sub" x="${Math.min(gx, bx) - R_MAX - 14}" y="${(gy + by) / 2 + 15}" text-anchor="end">same TF.js runtime</text>`);
  const maxRss = Math.max(...bubbles.map((p) => p.rss ?? 1));
  bubbles.forEach((p) => {
    const [px, py] = pt(p), r = (R_MAX * Math.sqrt((p.rss ?? 1) / maxRss)).toFixed(2);
    const left = p.labelSide === 'left';
    const lx = px + (left ? -1 : 1) * (R_MAX + 10), anchor = left ? 'end' : 'start';
    parts.push(`<g class="b-pt ${toneClass(p.tone)}" ${tip(systemTip(p))}><circle class="bubble" cx="${px}" cy="${py}" r="${r}"/><circle class="b-core" cx="${px}" cy="${py}" r="2.5"/></g>`,
      `<text class="b-label mono" x="${lx}" y="${py - 2}" text-anchor="${anchor}">${p.label}</text>`,
      `<text class="b-sub" x="${lx}" y="${py + 13}" text-anchor="${anchor}">${val(p).toFixed(1)}% · ${p.sub}</text>`);
  });
  for (const p of SYSTEMS_REFERENCE) {
    const [px, py] = pt(p), ceiling = p.quality === 'Gemini 001';
    parts.push(`<g class="b-pt" ${tip(systemTip(p))}><circle class="b-research${ceiling ? ' is-ceiling' : ''}" cx="${px}" cy="${py}" r="${RESEARCH_R}"/></g>`,
      ceiling
        ? `<text class="b-label" x="${px + RESEARCH_R + 10}" y="${py - 2}">${p.label}</text><text class="b-sub" x="${px + RESEARCH_R + 10}" y="${py + 13}">${val(p).toFixed(1)}% · ${p.sub}</text>`
        : `<text class="b-sub" x="${px}" y="${py - 13}" text-anchor="middle">${p.label} · ${val(p).toFixed(1)}%</text>`);
  }
  svg.innerHTML = parts.join('');
  svg.setAttribute('aria-label', `${METRICS[metric].name} against cold search latency: ${all.map((p) => `${p.label} ${val(p)}% at ${p.ms} ms`).join(', ')}.`);
}

/* ───── Boot ───── */
renderMilestones();
renderTable();
renderHorizon();
renderSystems();
BASE_TIPS = new Map(TIPS);

$('a-x').addEventListener('change', (e) => {
  if (e.target instanceof HTMLInputElement && (e.target.value === 'milestone' || e.target.value === 'time')) {
    state.xAxis = e.target.value;
    renderMilestones();
  }
});
$('a-view').addEventListener('change', (e) => {
  if (e.target instanceof HTMLInputElement && (e.target.value === 'all' || e.target.value === 'short' || e.target.value === 'long' || e.target.value === 'nightly')) {
    state.view = e.target.value;
    renderMilestones();
  }
});
const sparksContainer = document.querySelector('.sparks');
if (sparksContainer) {
  sparksContainer.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    const spark = e.target.closest('.spark');
    if (!(spark instanceof HTMLElement)) return;
    const m = spark.dataset.metric;
    if (m === 'hit' || m === 'ndcg' || m === 'snr') {
      state.metric = m;
      renderMilestones();
    }
  });
}
$('k-metric').addEventListener('change', (e) => {
  if (e.target instanceof HTMLInputElement && (e.target.value === 'hit' || e.target.value === 'ndcg' || e.target.value === 'snr')) {
    state.kMetric = e.target.value;
    renderHorizon();
  }
});
$('b-y').addEventListener('change', (e) => {
  if (e.target instanceof HTMLInputElement && (e.target.value === 'hit' || e.target.value === 'snr')) {
    state.bY = e.target.value;
    renderSystems();
  }
});

export {};
