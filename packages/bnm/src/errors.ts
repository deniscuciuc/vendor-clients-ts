/**
 * Why it did not work, in a form the caller can make a decision from.
 *
 * `kind` is an enum rather than free-form text: "retry later" and "the bank
 * returned rubbish" call for different actions, and telling them apart by the
 * error text means telling them apart by the language the text is in.
 */
export type BnmErrorKind =
  /** The network did not get there, or the timeout expired. Worth retrying. */
  | 'transport'
  /** A response arrived but was not 2xx. `status` is filled in. */
  | 'http'
  /** The document parsed, but holds no rates. */
  | 'empty'

export interface BnmError {
  readonly kind: BnmErrorKind
  readonly message: string
  readonly status?: number
}

/** Thrown by the transport on a non-2xx, so the client can tell it from a dropped connection. */
export class BnmHttpError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
  ) {
    super(`BNM replied ${status} ${statusText}`)
    this.name = 'BnmHttpError'
  }
}
