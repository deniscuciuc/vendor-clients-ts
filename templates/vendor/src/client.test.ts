import { describe, expect, it } from 'vitest'
import { create__Vendor__Client } from './client.js'
import { __Vendor__HttpError } from './errors.js'
import type { __Vendor__Transport } from './transport.js'

/*
  FILL IN. The mandatory minimum of negative cases is in
  docs/operations/adding-a-vendor.md: a malformed response, a non-2xx, a
  timeout, an unknown enum value, and where a signature exists, the four
  forgery cases.

  Code without a failing test is useless.
*/

const transportThrowing = (cause: unknown): __Vendor__Transport => ({
  async get() {
    throw cause
  },
})

describe('the client', () => {
  it('returns what the vendor said', async () => {
    const client = create__Vendor__Client({
      transport: {
        async get() {
          return { id: 1 }
        },
      },
    })

    const result = await client.something()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({ id: 1 })
  })

  it('reports a non-2xx as http, with the status the caller can act on', async () => {
    const client = create__Vendor__Client({
      transport: transportThrowing(new __Vendor__HttpError(503, '/something')),
    })

    const result = await client.something()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('http')
    expect(result.error.status).toBe(503)
  })

  it('reports a dropped connection as transport, which is the retryable one', async () => {
    const client = create__Vendor__Client({
      transport: transportThrowing(new Error('The operation was aborted due to timeout')),
    })

    const result = await client.something()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('transport')
  })
})
