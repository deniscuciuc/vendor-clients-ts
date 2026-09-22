import { ratesPath } from './endpoints.js'
import { type BnmError, BnmHttpError } from './errors.js'
import { type BnmRates, parseBnmXml } from './parse.js'
import { err, ok, type Result } from './result.js'
import { type BnmTransport, HttpBnmTransport } from './transport.js'

export interface BnmClientOptions {
  /** Substituted in tests; real HTTP by default. */
  readonly transport?: BnmTransport
}

export interface BnmClient {
  /**
   * The official rates for a date in `YYYY-MM-DD` form.
   *
   * Returns **everything** the bank published. Narrowing to the currencies an
   * application needs is the caller's business: the package does not know which
   * currencies anyone needs, and must not.
   */
  rates(isoDate: string): Promise<Result<BnmRates, BnmError>>
}

export function createBnmClient(options: BnmClientOptions = {}): BnmClient {
  const transport = options.transport ?? new HttpBnmTransport()

  return {
    async rates(isoDate) {
      /*
        The path is built **before** the try, and that is not cosmetic. Inside
        the block an exception from `toBnmDate` would turn into
        `{ kind: 'transport' }` — a defect in the caller would become
        indistinguishable from a dropped connection, the caller would set up a
        retry, and the same invalid date would be retried forever.
      */
      const path = ratesPath(isoDate)

      let xml: string
      try {
        xml = await transport.get(path)
      } catch (cause) {
        if (cause instanceof BnmHttpError) {
          return err({ kind: 'http', message: cause.message, status: cause.status })
        }
        return err({
          kind: 'transport',
          message: cause instanceof Error ? cause.message : String(cause),
        })
      }

      const rates = parseBnmXml(xml)
      if (Object.keys(rates).length === 0) {
        /*
          An empty result is its own case, not a success holding an empty
          object. The bank has no rates on weekends and holidays, and the caller
          must tell "the bank published nothing" from "we could not read it": in
          the first case you take the previous day's rate, in the second you
          raise an alarm. Hence `kind: 'empty'` with a message, not an empty
          map.
        */
        return err({ kind: 'empty', message: `BNM published no rates for ${isoDate}` })
      }

      return ok(rates)
    },
  }
}
