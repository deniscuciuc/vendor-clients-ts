import { describe, expect, it } from 'vitest'
import { createBnmClient } from './client.js'
import { BnmHttpError } from './errors.js'
import type { BnmTransport } from './transport.js'

const transportReturning = (xml: string): BnmTransport => ({
  async get() {
    return xml
  },
})

const transportThrowing = (cause: unknown): BnmTransport => ({
  async get() {
    throw cause
  },
})

describe('the client', () => {
  it('asks for the date it was given, in the bank form', async () => {
    const paths: string[] = []
    const client = createBnmClient({
      transport: {
        async get(path) {
          paths.push(path)
          return '<Valute><CharCode>EUR</CharCode><Value>19</Value></Valute>'
        },
      },
    })

    await client.rates('2026-09-09')
    expect(paths).toEqual(['/md/official_exchange_rates?get_xml=1&date=09.09.2026'])
  })

  it('returns every currency the bank published, unfiltered', async () => {
    const client = createBnmClient({
      transport: transportReturning(
        '<Valute><CharCode>EUR</CharCode><Value>19.5</Value></Valute>' +
          '<Valute><CharCode>JPY</CharCode><Nominal>100</Nominal><Value>11.53</Value></Valute>',
      ),
    })

    const result = await client.rates('2026-09-09')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.keys(result.value).sort()).toEqual(['EUR', 'JPY'])
    expect(result.value.JPY).toBeCloseTo(0.1153, 10)
  })

  // @invariant 6
  it('distinguishes a day with no rates from a day it could not read', async () => {
    // A weekend: the bank answers with a document holding no rates. The caller
    // will take the previous day's rate — but only if it tells this case apart
    // from a failure.
    const client = createBnmClient({ transport: transportReturning('<ValCurs></ValCurs>') })

    const result = await client.rates('2026-09-12')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('empty')
  })

  it('reports a non-2xx as http, with the status the caller can act on', async () => {
    const client = createBnmClient({
      transport: transportThrowing(new BnmHttpError(503, 'Service Unavailable')),
    })

    const result = await client.rates('2026-09-09')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('http')
    expect(result.error.status).toBe(503)
  })

  it('reports a dropped connection as transport, which is the retryable one', async () => {
    const client = createBnmClient({
      transport: transportThrowing(new Error('The operation was aborted due to timeout')),
    })

    const result = await client.rates('2026-09-09')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('transport')
    expect(result.error.message).toMatch(/timeout/)
  })

  it('survives a transport that threw something that is not an Error', async () => {
    const client = createBnmClient({ transport: transportThrowing('dropped') })

    const result = await client.rates('2026-09-09')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toEqual({ kind: 'transport', message: 'dropped' })
  })

  // @invariant 7
  it('refuses a date it cannot convert before touching the network', async () => {
    let called = false
    const client = createBnmClient({
      transport: {
        async get() {
          called = true
          return ''
        },
      },
    })

    await expect(client.rates('yesterday')).rejects.toThrow(/Not an ISO date/)
    expect(called).toBe(false)
  })
})
