import { createHash, timingSafeEqual } from 'node:crypto'
import { stringify } from './json.js'

/**
 * `Base64(SHA256(implode(':', sort_by_key(values) + signatureKey)))`.
 *
 * Exported so a test can build a signature the same way maib builds it:
 * without a live account that is the only way to check the checker.
 */
export function maibSignature(result: Record<string, unknown>, signatureKey: string): string {
  const values = Object.keys(result)
    .sort()
    .map((key) => stringify(result[key]))
  return createHash('sha256')
    .update([...values, signatureKey].join(':'))
    .digest('base64')
}

/**
 * A constant-time comparison.
 *
 * Comparing base64 with `===` leaks the expected value a byte at a time to
 * anyone willing to measure response times. Differing lengths are rejected
 * before the comparison, because `timingSafeEqual` throws on buffers of
 * different lengths.
 */
export function signatureMatches(
  result: Record<string, unknown>,
  given: string,
  signatureKey: string,
): boolean {
  const expected = maibSignature(result, signatureKey)
  const a = Buffer.from(given, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}
