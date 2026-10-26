/**
 * Runs `fn` over `items` with at most `limit` in flight, as a worker pool:
 * a slow item does not hold up the others the way fixed-size batches do.
 * Results are returned in input order.
 *
 * On the first rejection no further items are started, the items already in
 * flight are allowed to finish (so nothing is left half-written), and then
 * that first error is rethrown.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  let firstError: unknown;
  let failed = false;

  async function worker(): Promise<void> {
    while (!failed && next < items.length) {
      const index = next++;
      try {
        results[index] = await fn(items[index], index);
      } catch (err) {
        if (!failed) {
          failed = true;
          firstError = err;
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failed) {
    throw firstError;
  }
  return results;
}
