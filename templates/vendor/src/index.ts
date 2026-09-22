/*
 * The package's public surface.
 *
 * Explicit re-exports only: `export *` will not pass the `vendors` rule,
 * because the API snapshot would have nothing to compare and a removed export
 * would ride out in a minor version to somebody who is not at the review.
 *
 * After editing, run `pnpm api:snapshot`.
 */
export {
  type __Vendor__Client,
  type __Vendor__ClientOptions,
  create__Vendor__Client,
} from './client.js'
export {
  __VENDOR_UPPER___BASE_URL,
  __VENDOR_UPPER___PATHS,
  __VENDOR_UPPER___SPEC_CHECKED,
} from './endpoints.js'
export { type __Vendor__Error, type __Vendor__ErrorKind, __Vendor__HttpError } from './errors.js'
export { type Err, err, type Ok, ok, type Result } from './result.js'
export {
  __VENDOR_UPPER___TIMEOUT_MS,
  type __Vendor__Transport,
  Http__Vendor__Transport,
} from './transport.js'
