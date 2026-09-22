import { describe, expect, it, vi } from 'vitest'
import { BnmHttpError } from './errors.js'
import { BNM_TIMEOUT_MS, HttpBnmTransport } from './transport.js'

describe('HttpBnmTransport', () => {
  it('returns the body and asks the configured host', async () => {
    const fetchMock = vi.fn(
      async (_url: string | URL, _init?: RequestInit) =>
        new Response('<ValCurs/>', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const body = await new HttpBnmTransport('https://bank.test').get('/rates')

    expect(body).toBe('<ValCurs/>')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://bank.test/rates')
  })

  // @invariant 5
  it('carries a timeout, so a bank that stopped answering does not hold the caller', async () => {
    // The original went out with no signal at all. What is checked is the
    // presence, not the firing: a timeout that actually fires in a test means a
    // fifteen-second wait, and nobody will keep that in the suite.
    const fetchMock = vi.fn(
      async (_url: string | URL, _init?: RequestInit) => new Response('ok', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await new HttpBnmTransport('https://bank.test').get('/rates')

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(BNM_TIMEOUT_MS).toBe(15_000)
  })

  it('raises a typed error on a non-2xx, so the client can tell it from a dropped connection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (_url: string | URL, _init?: RequestInit) =>
          new Response('nope', { status: 503, statusText: 'Service Unavailable' }),
      ),
    )

    const transport = new HttpBnmTransport('https://bank.test')
    await expect(transport.get('/rates')).rejects.toBeInstanceOf(BnmHttpError)
    await expect(transport.get('/rates')).rejects.toMatchObject({ status: 503 })
  })

  // @invariant 1
  it('is the only reason a test may touch fetch at all', async () => {
    // The stub from the shared setup throws: if this test ever starts passing
    // without vi.stubGlobal, the guard against reaching the network has stopped
    // working.
    await expect(new HttpBnmTransport('https://bank.test').get('/rates')).rejects.toThrow(
      /reached the network/,
    )
  })
})
