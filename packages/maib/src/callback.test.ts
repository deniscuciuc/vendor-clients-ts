import { describe, expect, it } from 'vitest'
import { parseCallback } from './callback.js'
import { maibSignature } from './signature.js'

/*
  The signature sits in the body rather than a header — `{ result, signature }`
  — and the algorithm is theirs: sort the keys, join the values with colons,
  append the signature key, take SHA-256 of the bytes, encode as base64.
*/
const SIGNATURE_KEY = 'the-signature-key'

const result = {
  payId: 'pay-1',
  orderId: 'invoice-1',
  status: 'OK',
  statusCode: '000',
  amount: '299.00',
  currency: 'MDL',
}

const signed = (over: Record<string, unknown> = {}, key = SIGNATURE_KEY) => {
  const body = { ...result, ...over }
  return { result: body, signature: maibSignature(body, key) }
}

describe('parseCallback', () => {
  it('believes a correctly signed success', () => {
    const parsed = parseCallback(signed(), SIGNATURE_KEY)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value).toEqual({
      payId: 'pay-1',
      orderId: 'invoice-1',
      amountBani: 29_900,
      status: 'OK',
      outcome: 'succeeded',
    })
  })

  it('reads a non-OK status as a failure rather than ignoring the callback', () => {
    const parsed = parseCallback(signed({ status: 'FAILED' }), SIGNATURE_KEY)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.outcome).toBe('failed')
    // The original status is carried verbatim: "not OK" and "FAILED
    // specifically" are different facts, and support needs the second.
    expect(parsed.value.status).toBe('FAILED')
  })

  // @invariant 8
  it('refuses a body signed with the wrong key, and says it was the signature', () => {
    const parsed = parseCallback(signed({}, 'somebody-elses-key'), SIGNATURE_KEY)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    // The reason is part of the answer. A forged signature belongs in the log
    // differently from an unreadable amount: the first means somebody is trying
    // to forge a payment.
    expect(parsed.error.kind).toBe('signature')
  })

  it('refuses a body altered after signing', () => {
    // This is the whole point: the amount is part of the signed material, so
    // raising it invalidates the signature rather than raising the payment.
    const message = signed()
    message.result.amount = '2990.00'
    const parsed = parseCallback(message, SIGNATURE_KEY)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error.kind).toBe('signature')
  })

  it('refuses a body with no signature at all', () => {
    for (const body of [{ result }, { signature: 'x' }, null, undefined, 'a string', []]) {
      const parsed = parseCallback(body, SIGNATURE_KEY)
      expect(parsed.ok, JSON.stringify(body)).toBe(false)
    }
  })

  it('refuses a signature of the wrong length without comparing it', () => {
    // timingSafeEqual throws on buffers of different lengths, so the length is
    // rejected before the comparison — and a refusal stays a refusal rather
    // than becoming an exception.
    const parsed = parseCallback({ result, signature: 'short' }, SIGNATURE_KEY)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error.kind).toBe('signature')
  })

  it('refuses an amount it cannot read exactly, and calls that unreadable', () => {
    const parsed = parseCallback(signed({ amount: 'a lot' }), SIGNATURE_KEY)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error.kind).toBe('unreadable')
  })

  it('refuses a signed body that is missing payId, orderId or status', () => {
    for (const key of ['payId', 'orderId', 'status']) {
      const body: Record<string, unknown> = { ...result }
      delete body[key]
      const parsed = parseCallback(
        { result: body, signature: maibSignature(body, SIGNATURE_KEY) },
        SIGNATURE_KEY,
      )
      expect(parsed.ok, key).toBe(false)
      if (parsed.ok) continue
      expect(parsed.error.kind, key).toBe('unreadable')
    }
  })

  it('carries the amount through as bani, so the caller can compare it', () => {
    // A correctly signed message naming a different amount is not a payment.
    // The comparison belongs to whoever holds the invoice; carrying the number
    // up is all that makes that comparison possible.
    const parsed = parseCallback(signed({ amount: '1.00' }), SIGNATURE_KEY)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.amountBani).toBe(100)
  })

  it('reads an amount maib sent as a number rather than a string', () => {
    const parsed = parseCallback(signed({ amount: 299 }), SIGNATURE_KEY)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.amountBani).toBe(29_900)
  })
})
