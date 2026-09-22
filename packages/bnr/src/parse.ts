/**
 * Rates as the bank gives them: a three-letter currency code to the price of
 * **one unit** in lei.
 *
 * One unit. The bank publishes forint and yen per hundred, and the number from
 * the document is divided by `multiplier` here. Without that division the rate
 * comes out a hundred times off, and the accounting department notices it, not
 * the tests.
 */
export type BnrRates = Readonly<Record<string, number>>

export interface BnrQuotation {
  /**
   * The publication date, as the bank stamped it.
   *
   * Parsed and handed out, though the original discarded it. At this URL BNR
   * serves only the last working day: on a Monday morning it is still Friday,
   * and a caller who cannot see that will record the Friday rate as Monday's.
   */
  readonly date: string | null
  readonly rates: BnrRates
}

const CUBE_DATE = /<Cube\b[^>]*\bdate="([^"]+)"/
const RATE = /<Rate\b([^>]*)>([^<]*)<\/Rate>/g
const CURRENCY = /currency="([^"]+)"/
const MULTIPLIER = /multiplier="([^"]+)"/

/**
 * Parsing the bank's response.
 *
 * With regular expressions rather than an XML parser, deliberately: the
 * document is flat and has not changed in years, and a dependency for it would
 * cost more. Anything that fails to parse is **skipped** rather than
 * approximated: a rate computed from rubbish is worse than a missing one,
 * because a missing one is visible.
 */
export function parseBnrXml(xml: string): BnrQuotation {
  const rates: Record<string, number> = {}

  for (const match of xml.matchAll(RATE)) {
    const attributes = match[1]
    const valueText = match[2]
    if (attributes === undefined || valueText === undefined) continue

    const currency = CURRENCY.exec(attributes)?.[1]
    const multiplier = Number(MULTIPLIER.exec(attributes)?.[1] ?? 1)
    const value = Number(valueText)

    if (currency === undefined || currency.length !== 3) continue
    if (!Number.isFinite(value) || value <= 0) continue
    if (!Number.isFinite(multiplier) || multiplier <= 0) continue

    rates[currency] = value / multiplier
  }

  return { date: CUBE_DATE.exec(xml)?.[1] ?? null, rates }
}
