/**
 * The result of a call that may not work out.
 *
 * Declared inside the package rather than taken from a shared library, and
 * deliberately so: a vendor package installs on its own and drags nothing of
 * ours behind it (ADR-0001).
 *
 * `Result` carries back whatever depends on the other side. An invalid
 * argument is not a result but a defect in the caller, and that throws.
 */
export type Ok<T> = { readonly ok: true; readonly value: T }
export type Err<E> = { readonly ok: false; readonly error: E }
export type Result<T, E> = Ok<T> | Err<E>

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value })
export const err = <E>(error: E): Err<E> => ({ ok: false, error })
