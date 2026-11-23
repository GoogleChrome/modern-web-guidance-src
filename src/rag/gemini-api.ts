/**
 * Client helpers for calling Google Generative Language embedding APIs.
 */

export interface BatchEmbeddingResponse {
  embeddings: Array<{ values: number[] }>;
}

export interface VertexPredictionResponse {
  predictions: Array<{ embeddings: { values: number[] } }>;
}

export function isBatchEmbeddingResponse(val: unknown): val is BatchEmbeddingResponse {
  if (typeof val !== "object" || val === null || !("embeddings" in val)) return false;
  const emb = (val as { embeddings: unknown }).embeddings;
  return (
    Array.isArray(emb) &&
    emb.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "values" in item &&
        Array.isArray((item as { values: unknown }).values)
    )
  );
}

export function isVertexPredictionResponse(val: unknown): val is VertexPredictionResponse {
  if (typeof val !== "object" || val === null || !("predictions" in val)) return false;
  const preds = (val as { predictions: unknown }).predictions;
  return (
    Array.isArray(preds) &&
    preds.every((item) => {
      if (typeof item !== "object" || item === null || !("embeddings" in item)) return false;
      const emb = (item as { embeddings: unknown }).embeddings;
      return (
        typeof emb === "object" &&
        emb !== null &&
        "values" in emb &&
        Array.isArray((emb as { values: unknown }).values)
      );
    })
  );
}

export async function postWithRetry(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }).catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))));

    if (!(res instanceof Error) && res.ok) {
      return res.json();
    }
    const is429 = !(res instanceof Error) && res.status === 429;
    const retryable =
      res instanceof Error || res.status === 408 || res.status === 429 || res.status >= 500;
    const status =
      res instanceof Error ? res.message : `${res.status} ${(await res.text()).slice(0, 300)}`;
    if (!retryable || attempt >= 20) {
      throw new Error(`Gemini embedding HTTP failed after ${attempt} attempts: ${status}`);
    }
    await new Promise((r) => setTimeout(r, is429 ? 15_000 : 1_500 * attempt));
  }
}
