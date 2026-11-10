/**
 * Pure vector quantization, dequantization, and buffer alignment utilities.
 * Independent of filesystem or runtime paths to safely bundle into client search scripts.
 */

export const STATIC_DIMS = 256;
export const STATIC_EMBEDDING_DIMS = STATIC_DIMS;

/**
 * Normalizes an array-like vector to unit L2 norm in-place.
 */
export function l2Normalize(v: Float32Array): Float32Array {
  let sumSq = 0;
  for (let i = 0; i < v.length; i++) sumSq += v[i] * v[i];
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

/**
 * Slices a buffer to a fresh 4-byte-aligned ArrayBuffer and returns a Float32Array view.
 * Guarantees 4-byte alignment regardless of Node Buffer slab pooling.
 */
export function toAlignedFloat32Array(buf: Uint8Array): Float32Array {
  const aligned = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Float32Array(aligned);
}

/**
 * Returns an Int8Array view over a byte buffer.
 */
export function toInt8Array(buf: Uint8Array): Int8Array {
  return new Int8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/**
 * Dequantizes a single vector row from symmetric Int8 to unit Float32Array.
 * If the row's scale is zero (e.g. empty fallback vector), returns an empty Float32Array(0).
 */
export function dequantizeVectorRow(
  qTable: Int8Array,
  scales: Float32Array,
  index: number,
  dims = STATIC_DIMS
): Float32Array {
  const scale = scales[index];
  if (!scale) {
    return new Float32Array(0);
  }
  const offset = index * dims;
  const vec = new Float32Array(dims);
  for (let k = 0; k < dims; k++) {
    vec[k] = qTable[offset + k] * scale;
  }
  return l2Normalize(vec);
}

/**
 * Symmetric per-row Int8 quantization with per-row maxAbs / 127 scale factors.
 * Empty or all-zero rows get scale = 0 and zeros in the qTable.
 */
export function quantizeVectors(
  vectors: Array<ArrayLike<number>>,
  dims = STATIC_DIMS
): { qTable: Int8Array; scales: Float32Array } {
  const N = vectors.length;
  const qTable = new Int8Array(N * dims);
  const scales = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const v = vectors[i];
    if (!v || v.length === 0) {
      scales[i] = 0;
      continue;
    }
    let maxAbs = 0;
    for (let k = 0; k < dims; k++) {
      const a = Math.abs(v[k] || 0);
      if (a > maxAbs) maxAbs = a;
    }
    if (maxAbs === 0) {
      scales[i] = 0;
      continue;
    }
    const scale = maxAbs / 127;
    scales[i] = scale;
    const offset = i * dims;
    for (let k = 0; k < dims; k++) {
      const q = Math.round((v[k] || 0) / scale);
      qTable[offset + k] = Math.max(-127, Math.min(127, q));
    }
  }

  return { qTable, scales };
}

/**
 * Truncates an embedding vector to 256 dimensions (MRL) and L2-normalizes it.
 */
export function truncateAndNormalize256(v: ArrayLike<number>): Float32Array {
  const t = new Float32Array(STATIC_DIMS);
  for (let i = 0; i < STATIC_DIMS; i++) t[i] = v[i] || 0;
  return l2Normalize(t);
}
