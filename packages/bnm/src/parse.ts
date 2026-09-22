/**
 * Rates as the bank gives them: a three-letter currency code to the price of
 * **one unit**.
 *
 * One unit, not the nominal: the bank publishes, say, 100 Japanese yen on a
 * single line, and the number from the document is divided by the nominal here.
 * Without that division a currency with a nominal of 100 comes out a hundred
 * times off, and the accounting department notices it, not the tests.
 */
export type BnmRates = Readonly<Record<string, number>>

const VALUTE_BLOCK = /<Valute\b[^>]*>([\s\S]*?)<\/Valute>/g
const CHAR_CODE = /<CharCode>([^<]+)<\/CharCode>/
const NOMINAL = /<Nominal>([^<]+)<\/Nominal>/
const VALUE = /<Value>([^<]+)<\/Value>/

/**
 * Parsing the bank's response.
 *
 * With regular expressions rather than an XML parser, deliberately: the
 * document is flat, that has been its only shape for twenty years, and a
 * dependency for it would cost more. Anything that fails to parse is
 * **skipped** rather than approximated: a rate computed from rubbish is worse
 * than a missing rate, because a missing one is visible.
 */
export function parseBnmXml(xml: string): BnmRates {
  const rates: Record<string, number> = {}

  for (const match of xml.matchAll(VALUTE_BLOCK)) {
    const block = match[1]
    if (block === undefined) continue

    const charCode = CHAR_CODE.exec(block)?.[1]
    const nominal = Number(NOMINAL.exec(block)?.[1] ?? 1)
    const value = Number(VALUE.exec(block)?.[1])

    if (charCode === undefined || charCode.length !== 3) continue
    if (!Number.isFinite(value) || value <= 0) continue
    if (!Number.isFinite(nominal) || nominal <= 0) continue

    rates[charCode] = value / nominal
  }

  return rates
}
