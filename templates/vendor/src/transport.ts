import { __VENDOR_UPPER___BASE_URL } from './endpoints.js'
import { __Vendor__HttpError } from './errors.js'

/**
 * The wire, as a port.
 *
 * **The only file in the package containing `fetch`** — the `vendors` rule
 * checks this. Everything that makes decisions lives above this line, where a
 * test can reach it without a network (ADR-0002).
 */
export interface __Vendor__Transport {
  get(path: string): Promise<unknown>
}

/** A vendor that stopped answering must not hold the caller. */
export const __VENDOR_UPPER___TIMEOUT_MS = 15_000

export class Http__Vendor__Transport implements __Vendor__Transport {
  constructor(private readonly baseUrl: string = __VENDOR_UPPER___BASE_URL) {}

  async get(path: string): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      signal: AbortSignal.timeout(__VENDOR_UPPER___TIMEOUT_MS),
      headers: { accept: 'application/json' },
    })
    if (!response.ok) {
      throw new __Vendor__HttpError(response.status, path)
    }
    return response.json()
  }
}
