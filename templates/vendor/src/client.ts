import { __VENDOR_UPPER___PATHS } from './endpoints.js'
import { type __Vendor__Error, __Vendor__HttpError } from './errors.js'
import { err, ok, type Result } from './result.js'
import { type __Vendor__Transport, Http__Vendor__Transport } from './transport.js'

export interface __Vendor__ClientOptions {
  /**
   * FILL IN: credentials arrive here as arguments.
   *
   * Not one `process.env` in the package: it must not know where it is deployed
   * (ADR-0003).
   */
  readonly apiKey?: string
  /** Substituted in tests; real HTTP by default. */
  readonly transport?: __Vendor__Transport
}

export interface __Vendor__Client {
  something(): Promise<Result<unknown, __Vendor__Error>>
}

export function create__Vendor__Client(options: __Vendor__ClientOptions = {}): __Vendor__Client {
  const transport = options.transport ?? new Http__Vendor__Transport()

  return {
    async something() {
      try {
        return ok(await transport.get(__VENDOR_UPPER___PATHS.something))
      } catch (cause) {
        if (cause instanceof __Vendor__HttpError) {
          return err({ kind: 'http', message: cause.message, status: cause.status })
        }
        return err({
          kind: 'transport',
          message: cause instanceof Error ? cause.message : String(cause),
        })
      }
    },
  }
}
