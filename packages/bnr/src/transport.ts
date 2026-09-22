import { BNR_BASE_URL } from './endpoints.js'
import { BnrHttpError } from './errors.js'

/**
 * The wire, as a port.
 *
 * The only place in the package containing `fetch`. Everything that decides
 * anything lives above this line, where a test can reach it (ADR-0002).
 */
export interface BnrTransport {
  get(path: string): Promise<string>
}

/** How long to wait for the bank before deciding it will not answer. */
export const BNR_TIMEOUT_MS = 15_000

export class HttpBnrTransport implements BnrTransport {
  constructor(private readonly baseUrl: string = BNR_BASE_URL) {}

  async get(path: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      // The original went out with no timeout: a hung bank held the caller for
      // as long as it liked.
      signal: AbortSignal.timeout(BNR_TIMEOUT_MS),
      headers: { accept: 'application/xml, text/xml, */*' },
    })
    if (!response.ok) {
      throw new BnrHttpError(response.status, response.statusText)
    }
    return response.text()
  }
}
