/**
 * The vendor's URLs.
 *
 * FILL IN one of the two, or the `vendors` rule will not let it through
 * (ADR-0005):
 *
 *   - a version segment in the base URL: '.../v1'
 *   - or a `_SPEC_CHECKED` constant with the date the spec was checked
 *
 * The second is for vendors that publish no version at all. Without one of
 * them the format changes one day and nobody remembers what we were ever
 * looking at.
 */
export const __VENDOR_UPPER___BASE_URL = 'https://api.example.com/v1'

/** The date the response format was last checked against the spec. */
export const __VENDOR_UPPER___SPEC_CHECKED = '2026-01-01'

export const __VENDOR_UPPER___PATHS = {
  something: '/something',
} as const
