import { type MaibCredentials, MaibTokens } from './auth.js'
import { MAIB_PATHS } from './endpoints.js'
import { type MaibError, MaibHttpError } from './errors.js'
import { asString, payload } from './json.js'
import { checkPayInput, type PayInput, payRequestBody } from './pay.js'
import { err, ok, type Result } from './result.js'
import { HttpMaibTransport, type MaibTransport } from './transport.js'

export interface MaibClientOptions extends MaibCredentials {
  /** Where maib returns the payer, and where it calls us. */
  readonly callbackUrl: string
  readonly okUrl: string
  readonly failUrl: string
  /** Substituted in tests; real HTTP by default. */
  readonly transport?: MaibTransport
  /** Substituted so token expiry can be tested without waiting. */
  readonly clock?: () => number
}

export interface MaibPayment {
  /** Where to send the payer. */
  readonly payUrl: string
  /** Their identifier for the attempt. The same one arrives in the callback. */
  readonly payId: string
}

export interface MaibClient {
  pay(input: PayInput): Promise<Result<MaibPayment, MaibError>>
  /**
   * Ask maib what it thinks happened.
   *
   * For the case where the callback never arrived — a deploy at an unlucky
   * minute, a network that lost it — where the alternative is a customer who
   * paid and an invoice claiming otherwise.
   */
  payInfo(payId: string): Promise<Result<Record<string, unknown>, MaibError>>
}

function toError(cause: unknown): MaibError {
  if (cause instanceof MaibHttpError) {
    return { kind: 'http', message: cause.message, status: cause.status }
  }
  return { kind: 'transport', message: cause instanceof Error ? cause.message : String(cause) }
}

export function createMaibClient(options: MaibClientOptions): MaibClient {
  const transport = options.transport ?? new HttpMaibTransport()
  const tokens = new MaibTokens(
    transport,
    { projectId: options.projectId, projectSecret: options.projectSecret },
    options.clock ?? Date.now,
  )

  const authorised = async (): Promise<Result<string, MaibError>> => {
    try {
      const token = await tokens.access()
      return token === null
        ? err({ kind: 'protocol', message: 'maib returned no usable token' })
        : ok(token)
    } catch (cause) {
      return err(toError(cause))
    }
  }

  return {
    async pay(input) {
      // Our own rules are checked before the network: a rejection we can give
      // immediately should not cost a call to the acquirer and a fifteen-second
      // wait.
      const refused = checkPayInput(input)
      if (refused) return refused

      const token = await authorised()
      if (!token.ok) return token

      let answer: unknown
      try {
        answer = await transport.post(
          MAIB_PATHS.pay,
          payRequestBody(input, {
            callbackUrl: options.callbackUrl,
            okUrl: options.okUrl,
            failUrl: options.failUrl,
          }),
          token.value,
        )
      } catch (cause) {
        return err(toError(cause))
      }

      const result = payload(answer)
      const payUrl = asString(result.payUrl)
      const payId = asString(result.payId)
      if (!payUrl || !payId) {
        // A rejection rather than a redirect to nowhere: a payment page with
        // no URL is a white screen instead of a form, and the customer will
        // conclude that we are the ones who broke.
        return err({ kind: 'protocol', message: 'maib returned no payment link' })
      }

      return ok({ payUrl, payId })
    },

    async payInfo(payId) {
      const token = await authorised()
      if (!token.ok) return token

      try {
        return ok(payload(await transport.get(MAIB_PATHS.payInfo(payId), token.value)))
      } catch (cause) {
        return err(toError(cause))
      }
    },
  }
}
