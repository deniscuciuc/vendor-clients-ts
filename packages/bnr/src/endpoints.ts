/**
 * BNR's URLs.
 *
 * There is no version in the path — the bank does not publish one — so what is
 * recorded instead is the date the document format was checked against the
 * bank's response. The rule from ADR-0005: either a version in the URL or a
 * check date, but not silence.
 */
export const BNR_BASE_URL = 'https://www.bnr.ro'

/** The date the XML format was last checked against the bank's response. */
export const BNR_SPEC_CHECKED = '2026-09-09'

/**
 * The only document the bank serves.
 *
 * There is no date in the URL and there cannot be: BNR publishes only the
 * current reference rates. The archive lives at a different URL in a different
 * format, and pretending this client can read it by date would be promising
 * something that is not there.
 */
export const BNR_RATES_PATH = '/nbrfxrates.xml'
