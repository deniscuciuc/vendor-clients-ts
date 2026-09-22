/**
 * Why it did not work, in a form the caller can make a decision from.
 *
 * `kind` is an enum rather than free-form text: branching on a substring of
 * the message is branching on the language the message happens to be in.
 *
 * FILL IN: add the cases specific to this vendor.
 */
export type __Vendor__ErrorKind =
  /** The network did not get there, or the timeout expired. Worth retrying. */
  | 'transport'
  /** A response arrived but was not 2xx. `status` is filled in. */
  | 'http'
  /** The response parsed, but does not contain what we called for. */
  | 'protocol'

export interface __Vendor__Error {
  readonly kind: __Vendor__ErrorKind
  readonly message: string
  readonly status?: number
}

/** Thrown by the transport on a non-2xx, so the client can tell it from a dropped connection. */
export class __Vendor__HttpError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`__VENDOR__ replied ${status} to ${path}`)
    this.name = '__Vendor__HttpError'
  }
}
