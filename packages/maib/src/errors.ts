/**
 * Why it did not work.
 *
 * An enum rather than text: payments have different recovery paths, and
 * choosing between them by a substring of the message means choosing by the
 * language the message is in.
 */
export type MaibErrorKind =
  /** The network did not get there, or the timeout expired. The payment's state is unknown. */
  | 'transport'
  /** A response arrived but was not 2xx. `status` is filled in. */
  | 'http'
  /** The response parsed, but lacks what we called for: a token, a link. */
  | 'protocol'
  /** We refused ourselves without contacting the acquirer: amount below the minimum, identifier too long. */
  | 'refused'
  /** The callback signature did not match. The body is not from maib, or was altered after signing. */
  | 'signature'
  /** The callback is correctly signed, but could not be read. */
  | 'unreadable'

export interface MaibError {
  readonly kind: MaibErrorKind
  readonly message: string
  readonly status?: number
}

/** Thrown by the transport on a non-2xx, so the client can tell it from a dropped connection. */
export class MaibHttpError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`maib replied ${status} to ${path}`)
    this.name = 'MaibHttpError'
  }
}
