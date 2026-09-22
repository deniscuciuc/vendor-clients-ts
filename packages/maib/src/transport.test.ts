import { describe, expect, it, vi } from 'vitest'
import { MaibHttpError } from './errors.js'
import { HttpMaibTransport, MAIB_TIMEOUT_MS } from './transport.js'

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })

describe('HttpMaibTransport', () => {
  it('posts JSON to the configured host and parses the answer', async () => {
    const fetchMock = vi.fn(async (_url: string | URL, _init?: RequestInit) =>
      jsonResponse({ result: { payId: 'pay-1' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const answer = await new HttpMaibTransport('https://maib.test/v1').post('/pay', {
      amount: '1.00',
    })

    expect(answer).toEqual({ result: { payId: 'pay-1' } })
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://maib.test/v1/pay')

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('{"amount":"1.00"}')
  })

  it('sends the bearer token only when it has one', async () => {
    const fetchMock = vi.fn(async (_url: string | URL, _init?: RequestInit) => jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    const transport = new HttpMaibTransport('https://maib.test/v1')

    // The token request goes without the header: the token is what we are asking for.
    await transport.post('/generate-token', { projectId: 'p' })
    const first = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    expect((first?.headers as Record<string, string> | undefined)?.authorization).toBeUndefined()

    await transport.post('/pay', {}, 'access-1')
    const second = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined
    expect((second?.headers as Record<string, string> | undefined)?.authorization).toBe(
      'Bearer access-1',
    )
  })

  // @invariant 5
  it('carries a timeout, so an acquirer that stopped answering does not hold the checkout', async () => {
    // What is checked is the presence of the signal, not its firing: a timeout
    // that actually fires in a test means a fifteen-second wait, and nobody
    // keeps a test like that.
    const fetchMock = vi.fn(async (_url: string | URL, _init?: RequestInit) => jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    await new HttpMaibTransport('https://maib.test/v1').get('/pay-info/pay-1', 'access-1')

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(MAIB_TIMEOUT_MS).toBe(15_000)
  })

  it('raises a typed error on a non-2xx, naming the path it failed on', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL, _init?: RequestInit) =>
        jsonResponse({}, { status: 502, statusText: 'Bad Gateway' }),
      ),
    )

    const transport = new HttpMaibTransport('https://maib.test/v1')
    await expect(transport.post('/pay', {})).rejects.toBeInstanceOf(MaibHttpError)
    await expect(transport.post('/pay', {})).rejects.toMatchObject({
      status: 502,
      path: '/pay',
    })
  })

  it('is the only reason a test may touch fetch at all', async () => {
    // The stub from the shared setup throws. If this test ever starts passing
    // without vi.stubGlobal, the guard against reaching the network has stopped
    // working.
    await expect(new HttpMaibTransport('https://maib.test/v1').post('/pay', {})).rejects.toThrow(
      /reached the network/,
    )
  })
})
