import { describe, expect, it } from 'vitest'
import { createBnrClient } from './client.js'
import { BNR_RATES_PATH } from './endpoints.js'
import { BnrHttpError } from './errors.js'
import type { BnrTransport } from './transport.js'

const transportReturning = (xml: string): BnrTransport => ({
  async get() {
    return xml
  },
})

const transportThrowing = (cause: unknown): BnrTransport => ({
  async get() {
    throw cause
  },
})

describe('the client', () => {
  it('asks for the only document the bank publishes', async () => {
    const paths: string[] = []
    const client = createBnrClient({
      transport: {
        async get(path) {
          paths.push(path)
          return '<Rate currency="EUR">4.9</Rate>'
        },
      },
    })

    await client.rates()
    expect(paths).toEqual([BNR_RATES_PATH])
  })

  it('returns the rates together with the day they belong to', async () => {
    const client = createBnrClient({
      transport: transportReturning(
        '<Cube date="2026-09-04"><Rate currency="EUR">4.9756</Rate></Cube>',
      ),
    })

    const result = await client.rates()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.date).toBe('2026-09-04')
    expect(result.value.rates.EUR).toBe(4.9756)
  })

  it('distinguishes a document with no rates from one it could not fetch', async () => {
    const client = createBnrClient({ transport: transportReturning('<DataSet></DataSet>') })

    const result = await client.rates()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('empty')
  })

  it('reports a non-2xx as http, with the status the caller can act on', async () => {
    const client = createBnrClient({
      transport: transportThrowing(new BnrHttpError(500, 'Internal Server Error')),
    })

    const result = await client.rates()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('http')
    expect(result.error.status).toBe(500)
  })

  it('reports a dropped connection as transport, which is the retryable one', async () => {
    const client = createBnrClient({
      transport: transportThrowing(new Error('The operation was aborted due to timeout')),
    })

    const result = await client.rates()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('transport')
  })

  it('survives a transport that threw something that is not an Error', async () => {
    const client = createBnrClient({ transport: transportThrowing('dropped') })

    const result = await client.rates()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toEqual({ kind: 'transport', message: 'dropped' })
  })
})
