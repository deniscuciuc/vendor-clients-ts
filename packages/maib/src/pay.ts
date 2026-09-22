import { formatMaibAmount, MAIB_MINIMUM_BANI, MAIB_ORDER_ID_MAX } from './amount.js'
import type { MaibError } from './errors.js'
import { type Err, err } from './result.js'

export interface PayInput {
  /**
   * What comes back in the callback as `orderId`.
   *
   * Put the identifier you will find the invoice by in here, not its
   * human-readable number: a correctly signed callback leading nowhere is the
   * worst possible outcome.
   */
  readonly orderId: string
  readonly amountBani: number
  /** What a person will see on their statement. Truncated to 124 characters. */
  readonly description: string
  /** ISO 4217. `MDL` by default. */
  readonly currency?: string
  /** The language of the payment page. `ro` by default. */
  readonly language?: string
}

/** How many characters of description maib accepts. */
export const MAIB_DESCRIPTION_MAX = 124

/**
 * The checks that are cheaper to do before contacting the acquirer.
 *
 * Its own function so they can be run with no transport at all, and because a
 * rejection by our rule and a rejection by theirs are different things: the
 * first is reproducible and fixable, the second needs investigation.
 */
export function checkPayInput(input: PayInput): Err<MaibError> | null {
  if (input.amountBani < MAIB_MINIMUM_BANI) {
    return err({
      kind: 'refused',
      message: `maib will not accept less than ${MAIB_MINIMUM_BANI} bani, and this is ${input.amountBani}`,
    })
  }
  if (input.orderId.length > MAIB_ORDER_ID_MAX) {
    /*
      The length is checked, not truncated. A UUID is exactly the 36 characters
      they accept, which is luck rather than design; a silently shortened
      identifier is a payment there is later nothing to reconcile against.
    */
    return err({
      kind: 'refused',
      message: `Identifier does not fit orderId: ${input.orderId.length} characters against a limit of ${MAIB_ORDER_ID_MAX}`,
    })
  }
  return null
}

/** The `/pay` request body, separate from sending it — so it can be checked. */
export function payRequestBody(
  input: PayInput,
  urls: { callbackUrl: string; okUrl: string; failUrl: string },
): Record<string, unknown> {
  return {
    amount: formatMaibAmount(input.amountBani),
    currency: input.currency ?? 'MDL',
    orderId: input.orderId,
    description: input.description.slice(0, MAIB_DESCRIPTION_MAX),
    callbackUrl: urls.callbackUrl,
    okUrl: urls.okUrl,
    failUrl: urls.failUrl,
    language: input.language ?? 'ro',
  }
}
