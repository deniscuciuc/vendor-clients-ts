import { describe, expect, it, vi } from 'vitest'
import { BnrHttpError } from './errors.js'
import { BNR_TIMEOUT_MS, HttpBnrTransport } from './transport.js'

describe('HttpBnrTransport', () => {
  it('returns the body and asks the configured host', async () => {
    const fetchMock = vi.fn(
      async (_url: string | URL, _init?: RequestInit) =>
        new Response('<ValCurs/>', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const body = await new HttpBnrTransport('https://bank.test').get('/nbrfxrates.xml')

    expect(body).toBe('<ValCurs/>')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://bank.test/nbrfxrates.xml')
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

    await new HttpBnrTransport('https://bank.test').get('/nbrfxrates.xml')

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(BNR_TIMEOUT_MS).toBe(15_000)
  })

  it('raises a typed error on a non-2xx, so the client can tell it from a dropped connection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (_url: string | URL, _init?: RequestInit) =>
          new Response('nope', { status: 503, statusText: 'Service Unavailable' }),
      ),
    )

    const transport = new HttpBnrTransport('https://bank.test')
    await expect(transport.get('/nbrfxrates.xml')).rejects.toBeInstanceOf(BnrHttpError)
    await expect(transport.get('/nbrfxrates.xml')).rejects.toMatchObject({ status: 503 })
  })

  it('is the only reason a test may touch fetch at all', async () => {
    // The stub from the shared setup throws: if this test ever starts passing
    // without vi.stubGlobal, the guard against reaching the network has stopped
    // working.
    await expect(new HttpBnrTransport('https://bank.test').get('/nbrfxrates.xml')).rejects.toThrow(
      /reached the network/,
    )
  })
})
