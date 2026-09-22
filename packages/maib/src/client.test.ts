import { describe, expect, it } from 'vitest'
import { createMaibClient } from './client.js'
import { MaibHttpError } from './errors.js'
import { MAIB_DESCRIPTION_MAX } from './pay.js'
import type { MaibTransport } from './transport.js'

const TOKEN_ANSWER = {
  '/generate-token': {
    result: {
      accessToken: 'access-1',
      expiresIn: 3600,
      refreshToken: 'refresh-1',
      refreshExpiresIn: 86_400,
    },
  },
}

function clientWith(answers: Record<string, unknown>, thrown?: Record<string, unknown>) {
  const calls: { path: string; body?: unknown; token: string | undefined }[] = []
  const transport: MaibTransport = {
    async post(path, body, accessToken) {
      calls.push({ path, body, token: accessToken })
      if (thrown?.[path]) throw thrown[path]
      return answers[path] ?? {}
    },
    async get(path, accessToken) {
      calls.push({ path, token: accessToken })
      if (thrown?.[path]) throw thrown[path]
      return answers[path] ?? {}
    },
  }

  const client = createMaibClient({
    projectId: 'project',
    projectSecret: 'secret',
    callbackUrl: 'https://api.test/payments/maib/callback',
    okUrl: 'https://shop.test/checkout/done',
    failUrl: 'https://shop.test/checkout',
    transport,
    clock: () => 1_757_000_000_000,
  })
  return { client, calls }
}

const PAYMENT = {
  orderId: 'invoice-1',
  amountBani: 29_900,
  description: 'Order INV-000123',
}

const bodyOf = (calls: { path: string; body?: unknown }[], path: string) =>
  calls.find((call) => call.path === path)?.body as Record<string, unknown>

describe('pay', () => {
  it('sends the amount as a decimal string and returns their checkout link', async () => {
    const { client, calls } = clientWith({
      ...TOKEN_ANSWER,
      '/pay': { result: { payId: 'pay-1', payUrl: 'https://maib.example/checkout/pay-1' } },
    })

    const result = await client.pay(PAYMENT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({
      payUrl: 'https://maib.example/checkout/pay-1',
      payId: 'pay-1',
    })

    const pay = bodyOf(calls, '/pay')
    expect(pay.amount).toBe('299.00')
    expect(pay.currency).toBe('MDL')
    expect(pay.orderId).toBe('invoice-1')
    expect(pay.language).toBe('ro')
    expect(calls.find((call) => call.path === '/pay')?.token).toBe('access-1')
  })

  it('takes the description from the caller instead of naming a product', async () => {
    /*
      In the application this came from, a product name was hard-coded here —
      the single coupling that made the package impossible to reuse. It is now
      a field of the call, and its presence is checked rather than assumed.
    */
    const { client, calls } = clientWith({
      ...TOKEN_ANSWER,
      '/pay': { result: { payId: 'p', payUrl: 'https://maib.example/p' } },
    })

    await client.pay({ ...PAYMENT, description: 'September subscription' })

    expect(bodyOf(calls, '/pay').description).toBe('September subscription')
  })

  it('trims a description to what maib accepts', async () => {
    const { client, calls } = clientWith({
      ...TOKEN_ANSWER,
      '/pay': { result: { payId: 'p', payUrl: 'https://maib.example/p' } },
    })

    await client.pay({ ...PAYMENT, description: 'x'.repeat(300) })

    expect(String(bodyOf(calls, '/pay').description)).toHaveLength(MAIB_DESCRIPTION_MAX)
  })

  it('honours a currency and language the caller chose', async () => {
    const { client, calls } = clientWith({
      ...TOKEN_ANSWER,
      '/pay': { result: { payId: 'p', payUrl: 'https://maib.example/p' } },
    })

    await client.pay({ ...PAYMENT, currency: 'EUR', language: 'en' })

    const pay = bodyOf(calls, '/pay')
    expect(pay.currency).toBe('EUR')
    expect(pay.language).toBe('en')
  })

  // @invariant 9
  it('refuses an amount below their minimum without spending a request', async () => {
    const { client, calls } = clientWith(TOKEN_ANSWER)

    const result = await client.pay({ ...PAYMENT, amountBani: 99 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('refused')
    // Not one call: a rejection by our own rule should not cost fifteen
    // seconds of waiting on the acquirer.
    expect(calls).toHaveLength(0)
  })

  // @invariant 10
  it('refuses an order id that does not fit their field, rather than truncating it', async () => {
    // A silently shortened identifier is a payment there is later nothing to
    // reconcile against.
    const { client, calls } = clientWith(TOKEN_ANSWER)

    const result = await client.pay({ ...PAYMENT, orderId: 'i'.repeat(37) })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('refused')
    expect(calls).toHaveLength(0)
  })

  it('refuses an answer with no link rather than redirecting nowhere', async () => {
    const { client } = clientWith({ ...TOKEN_ANSWER, '/pay': { result: { ok: false } } })

    const result = await client.pay(PAYMENT)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('protocol')
  })

  it('reports a token maib would not give as protocol, not as a payment failure', async () => {
    const { client } = clientWith({ '/generate-token': { result: {} } })

    const result = await client.pay(PAYMENT)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('protocol')
  })

  it('reports a non-2xx as http, with the status', async () => {
    const { client } = clientWith(TOKEN_ANSWER, { '/pay': new MaibHttpError(502, '/pay') })

    const result = await client.pay(PAYMENT)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('http')
    expect(result.error.status).toBe(502)
  })

  it('reports a dropped connection as transport, where the payment state is unknown', async () => {
    const { client } = clientWith(TOKEN_ANSWER, {
      '/pay': new Error('The operation was aborted due to timeout'),
    })

    const result = await client.pay(PAYMENT)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('transport')
  })
})

describe('payInfo', () => {
  it('asks about one payment, with the id escaped into the path', async () => {
    const { client, calls } = clientWith({
      ...TOKEN_ANSWER,
      '/pay-info/pay%2F1': { result: { status: 'OK' } },
    })

    const result = await client.payInfo('pay/1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({ status: 'OK' })
    // An unescaped identifier would send the request down a different path.
    expect(calls.some((call) => call.path === '/pay-info/pay%2F1')).toBe(true)
  })

  it('reports a failure rather than pretending the payment is unknown', async () => {
    const { client } = clientWith(TOKEN_ANSWER, {
      '/pay-info/pay-1': new MaibHttpError(404, '/pay-info/pay-1'),
    })

    const result = await client.payInfo('pay-1')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.status).toBe(404)
  })
})
