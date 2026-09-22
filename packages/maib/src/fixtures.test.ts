import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCallback } from './callback.js'
import { createMaibClient } from './client.js'
import { maibSignature } from './signature.js'
import type { MaibTransport } from './transport.js'

/**
 * The client against recorded acquirer responses.
 *
 * The other tests build responses inline, which is convenient for edge cases
 * and says nothing about whether we read **the** shape described in the spec.
 * Here it is the other way round: the shapes live in `test/fixtures/` as
 * separate documents, and when maib changes them what changes is a file, not an
 * expression buried in the middle of a suite.
 *
 * There is no contract and no live keys exist, so these were recorded from the
 * documentation rather than captured off the wire. The check date is in
 * docs/vendors/maib.md.
 */
const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(import.meta.dirname, '..', 'test', 'fixtures', name), 'utf8'))

const SIGNATURE_KEY = 'the-signature-key'

describe('against the recorded answers', () => {
  it('reads a token and a checkout link out of the documented shapes', async () => {
    const answers: Record<string, unknown> = {
      '/generate-token': fixture('generate-token.json'),
      '/pay': fixture('pay.json'),
    }
    const transport: MaibTransport = {
      async post(path) {
        return answers[path] ?? {}
      },
      async get(path) {
        return answers[path] ?? {}
      },
    }

    const client = createMaibClient({
      projectId: 'project',
      projectSecret: 'secret',
      callbackUrl: 'https://api.test/callback',
      okUrl: 'https://shop.test/done',
      failUrl: 'https://shop.test/checkout',
      transport,
      clock: () => 1_757_000_000_000,
    })

    const result = await client.pay({
      orderId: 'invoice-1',
      amountBani: 29_900,
      description: 'Order INV-000123',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({
      payUrl: 'https://maib.example/checkout/pay-1',
      payId: 'pay-1',
    })
  })

  it('reads the recorded callback once it carries a signature we can compute', () => {
    /*
      The signature in the file is a placeholder with an explanation, not a
      real one: it is computed from a key we do not have, and a recorded "real"
      signature would be a signature by somebody else's key, which is to say an
      invention. The test recomputes it from a known key using their own
      algorithm — the only way to check the checker without a live account.
    */
    const recorded = fixture('callback.json')
    const result = recorded.result as Record<string, unknown>

    const parsed = parseCallback(
      { result, signature: maibSignature(result, SIGNATURE_KEY) },
      SIGNATURE_KEY,
    )

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

  it('refuses the recorded callback with the placeholder signature left in place', () => {
    // The file sits in the repository with an unverifiable signature, and that
    // is fine exactly as long as nobody mistakes it for a real one.
    const parsed = parseCallback(fixture('callback.json'), SIGNATURE_KEY)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error.kind).toBe('signature')
  })
})
