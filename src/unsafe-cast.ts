/**
 * @fileoverview Sanctioned type escape hatch utility adhering to ~/.gemini/STYLE.md.
 *
 * In strict configurations where both `any` and `unknown` are restricted (via oxlint
 * `no-explicit-any` and `typescript/no-restricted-types`), unsafe type coercion must
 * never be performed with uninspected `as any`, double casts (`as unknown as T`), or
 * non-null assertions (`!`).
 *
 * `unsafeCast<T>()` provides a single, audited escape valve. The `reason` argument is
 * strictly required at compile-time and runtime to ensure every escape is self-documenting
 * and grep-auditable.
 *
 * Zero-dependency runtime minimalism: fully self-contained, copyable into any repo.
 */

/**
 * Coerces a value to target type `T` with an explicit, required explanation.
 *
 * @template T Target type
 * @param value The value to be cast
 * @param reason Explicit rationale explaining why the type checker cannot prove safety
 * @returns The cast value typed as `T`
 *
 * @example
 * ```ts
 * import { unsafeCast } from "./unsafe-cast.ts";
 *
 * // Valid: documented reason explaining why the cast is safe
 * const payload = unsafeCast<WireEvent>(rawJson, "Wire payload validated by ajv upstream");
 * ```
 */
export function unsafeCast<T>(value: unknown, reason: string): T {
  if (typeof reason !== "string" || reason.trim().length === 0) {
    throw new Error(
      "unsafeCast requires an explicit, non-empty reason documenting why the cast is safe."
    );
  }
  return value as any;
}
