/**
 * Reading somebody else's JSON.
 *
 * Not exported outside the package: these are internal helpers, not part of the
 * contract. Each returns a usable value or nothing — no casts, because a cast
 * here would mean confidence in a response we did not write.
 */

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Numbers and booleans as they look in JSON, so our concatenation matches theirs. */
export function stringify(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return String(value)
}

/**
 * A maib response puts the useful part either in `result` or at the root.
 *
 * Both shapes appear in their documentation, and unwrapping it at every call
 * site means forgetting at one of them.
 */
export function payload(answer: unknown): Record<string, unknown> {
  const record = asRecord(answer)
  return asRecord(record.result ?? record)
}
