import { BNM_BASE_URL } from './endpoints.js'
import { BnmHttpError } from './errors.js'

/**
 * The wire, as a port.
 *
 * The only place in the package containing `fetch`. Everything that decides
 * anything — how to parse the document, what counts as an empty response —
 * lives above this line, where a test can reach it (ADR-0002).
 */
export interface BnmTransport {
  get(path: string): Promise<string>
}

/** How long to wait for the bank before deciding it will not answer. */
export const BNM_TIMEOUT_MS = 15_000

export class HttpBnmTransport implements BnmTransport {
  constructor(private readonly baseUrl: string = BNM_BASE_URL) {}

  async get(path: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      // The original went out with no timeout: a hung bank held the caller for
      // as long as it liked. Rates are fetched by a background job, but that job
      // shares a connection pool with the rest of the application.
      signal: AbortSignal.timeout(BNM_TIMEOUT_MS),
      headers: { accept: 'application/xml, text/xml, */*' },
    })
    if (!response.ok) {
      throw new BnmHttpError(response.status, response.statusText)
    }
    return response.text()
  }
}
