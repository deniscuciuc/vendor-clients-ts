import { baniFromDecimal } from './amount.js'
import type { MaibError } from './errors.js'
import { asRecord, asString } from './json.js'
import { err, ok, type Result } from './result.js'
import { signatureMatches } from './signature.js'

export interface MaibCallback {
  /** Their payment identifier. Repeats are deduplicated by it. */
  readonly payId: string
  /** What we put in `orderId` when the payment was created. */
  readonly orderId: string
  /**
   * The amount from the callback, in whole bani.
   *
   * Carried up so the caller can compare it against the invoice. A callback
   * that verifies by signature but names a different amount is not a payment
   * but a correctly signed message about something else, and the comparison
   * belongs to whoever holds the invoice, not to this package.
   */
  readonly amountBani: number
  readonly status: string
  readonly outcome: 'succeeded' | 'failed'
}

/**
 * Whether to believe the callback.
 *
 * The signature sits in the **body**, not in a header — `{ result, signature }`
 * — so headers are not passed in here at all.
 *
 * Returns a result rather than `null`: the reason for rejection is part of the
 * answer. A bad signature means somebody is trying to forge a payment, and that
 * belongs in the log differently from a callback whose amount could not be
 * read.
 */
export function parseCallback(
  body: unknown,
  signatureKey: string,
): Result<MaibCallback, MaibError> {
  const envelope = asRecord(body)
  const result = asRecord(envelope.result)
  const given = asString(envelope.signature)

  if (!given) return err({ kind: 'signature', message: 'The callback carries no signature' })
  if (Object.keys(result).length === 0) {
    return err({ kind: 'unreadable', message: 'The callback carries no body' })
  }
  if (!signatureMatches(result, given, signatureKey)) {
    return err({ kind: 'signature', message: 'The callback signature did not match' })
  }

  const payId = asString(result.payId)
  const orderId = asString(result.orderId)
  const status = asString(result.status)
  if (!payId || !orderId || !status) {
    return err({ kind: 'unreadable', message: 'The callback has no payId, orderId or status' })
  }

  const amountBani = baniFromDecimal(asString(result.amount) ?? String(result.amount ?? ''))
  if (amountBani === null) {
    return err({ kind: 'unreadable', message: `Not an amount: ${String(result.amount)}` })
  }

  return ok({
    payId,
    orderId,
    amountBani,
    status,
    outcome: status.toUpperCase() === 'OK' ? 'succeeded' : 'failed',
  })
}
