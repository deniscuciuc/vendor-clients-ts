import { BNR_RATES_PATH } from './endpoints.js'
import { type BnrError, BnrHttpError } from './errors.js'
import { type BnrQuotation, parseBnrXml } from './parse.js'
import { err, ok, type Result } from './result.js'
import { type BnrTransport, HttpBnrTransport } from './transport.js'

export interface BnrClientOptions {
  /** Substituted in tests; real HTTP by default. */
  readonly transport?: BnrTransport
}

export interface BnrClient {
  /**
   * The current reference rates.
   *
   * With no date argument, and that is not an oversight: at this URL the bank
   * serves only its latest publication. A method taking a date and silently
   * ignoring it would promise an archive that is not here — and the publication
   * date that comes back sits in `date`, so the caller can see which day the
   * rate is for.
   */
  rates(): Promise<Result<BnrQuotation, BnrError>>
}

export function createBnrClient(options: BnrClientOptions = {}): BnrClient {
  const transport = options.transport ?? new HttpBnrTransport()

  return {
    async rates() {
      let xml: string
      try {
        xml = await transport.get(BNR_RATES_PATH)
      } catch (cause) {
        if (cause instanceof BnrHttpError) {
          return err({ kind: 'http', message: cause.message, status: cause.status })
        }
        return err({
          kind: 'transport',
          message: cause instanceof Error ? cause.message : String(cause),
        })
      }

      const quotation = parseBnrXml(xml)
      if (Object.keys(quotation.rates).length === 0) {
        // Its own case, not a success with an empty map: "the bank published
        // nothing" and "we could not read it" call for different actions from
        // the caller.
        return err({ kind: 'empty', message: 'BNR published no rates at all' })
      }

      return ok(quotation)
    },
  }
}
