import { MAIB_BASE_URL } from './endpoints.js'
import { MaibHttpError } from './errors.js'

/**
 * The wire, as a port.
 *
 * Deliberately stupid: path, body, token. Everything that decides anything —
 * what an amount looks like, when a token is refreshed, whether to believe a
 * callback — lives above this line, where a test can reach it.
 *
 * This is the only reason the package exists in this shape at all: there is no
 * contract with maib, there are no live keys, and everything written here is
 * verified without a single call to the acquirer. A guarantee that can only be
 * checked with a live account and a real charge is a guarantee nobody checks
 * (ADR-0002).
 */
export interface MaibTransport {
  post(path: string, body: unknown, accessToken?: string): Promise<unknown>
  get(path: string, accessToken: string): Promise<unknown>
}

/** An acquirer that stopped answering must not hold up a checkout. */
export const MAIB_TIMEOUT_MS = 15_000

export class HttpMaibTransport implements MaibTransport {
  constructor(private readonly baseUrl: string = MAIB_BASE_URL) {}

  async post(path: string, body: unknown, accessToken?: string): Promise<unknown> {
    return this.send(path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    })
  }

  async get(path: string, accessToken: string): Promise<unknown> {
    return this.send(path, { headers: { authorization: `Bearer ${accessToken}` } })
  }

  private async send(path: string, init: RequestInit): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(MAIB_TIMEOUT_MS),
    })
    if (!response.ok) {
      throw new MaibHttpError(response.status, path)
    }
    return response.json()
  }
}
