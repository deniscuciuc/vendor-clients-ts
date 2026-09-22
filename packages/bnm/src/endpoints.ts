/**
 * BNM's URLs.
 *
 * There is no version in the path — the bank does not publish one — so what is
 * recorded instead is the date the document format was checked against the
 * bank's page. The rule from ADR-0005: either a version in the URL or a
 * check date, but not silence.
 */
export const BNM_BASE_URL = 'https://www.bnm.md'

/** The date the XML format was last checked against the bank's response. */
export const BNM_SPEC_CHECKED = '2026-09-09'

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * An ISO date in the form the bank understands.
 *
 * Its own function, and checked, because the original parsed the string by
 * destructuring without a check: given "today" instead of `2026-09-09` it would
 * silently have gone to a URL containing `undefined.undefined.undefined` and
 * got back an empty response, indistinguishable from a weekend.
 */
export function toBnmDate(isoDate: string): string {
  const match = ISO_DATE.exec(isoDate)
  const year = match?.[1]
  const month = match?.[2]
  const day = match?.[3]
  if (!year || !month || !day) {
    throw new Error(`Not an ISO date: ${isoDate}`)
  }
  return `${day}.${month}.${year}`
}

/** The path to the official rates for a date. */
export function ratesPath(isoDate: string): string {
  return `/md/official_exchange_rates?get_xml=1&date=${toBnmDate(isoDate)}`
}
