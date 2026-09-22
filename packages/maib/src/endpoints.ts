/**
 * The maib e-commerce URLs.
 *
 * The version is part of the base URL, and that is not decoration: a `v2` at
 * the acquirer will be a new major of this package, not a quiet edit to a
 * constant. The rule from ADR-0005.
 */
export const MAIB_BASE_URL = 'https://api.maibmerchants.md/v1'

export const MAIB_PATHS = {
  generateToken: '/generate-token',
  pay: '/pay',
  /** `pay-info` takes the payment identifier in the path. */
  payInfo: (payId: string) => `/pay-info/${encodeURIComponent(payId)}`,
} as const
