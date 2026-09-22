/** maib refuses anything under one leu, so we refuse first and say why. */
export const MAIB_MINIMUM_BANI = 100

/** Their `orderId` is capped at 36 characters, which is exactly the length of a UUID. */
export const MAIB_ORDER_ID_MAX = 36

/**
 * Bani into the decimal string maib wants.
 *
 * By integer arithmetic, never by dividing floats: `1049 / 100` is `10.49`
 * today and `10.489999999999998` for a value that lands badly, and a payment
 * request that differs from the invoice by one ban is a discrepancy nobody will
 * find. Money is whole bani everywhere; this is the one place it becomes a
 * string, and no precision is lost here.
 *
 * Throws rather than returning a result: non-integer bani are a defect in the
 * caller, not a state of the world. That is fixed by editing code, and hiding
 * it in a branch is how the branch survives to production.
 */
export function formatMaibAmount(bani: number): string {
  if (!Number.isInteger(bani) || bani < 0) {
    throw new Error(`Not an amount in bani: ${bani}`)
  }
  const whole = Math.trunc(bani / 100)
  const fraction = bani % 100
  return `${whole}.${String(fraction).padStart(2, '0')}`
}

/**
 * A decimal string of lei back into whole bani.
 *
 * By parsing the string rather than `Math.round(Number(value) * 100)`, for the
 * same reason `formatMaibAmount` avoids division: going through a float is
 * correct for almost every value and wrong for a few, and those few turn into
 * support tickets.
 */
export function baniFromDecimal(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim())
  const whole = match?.[1]
  if (whole === undefined) return null
  const fraction = (match?.[2] ?? '0').padEnd(2, '0')
  return Number(whole) * 100 + Number(fraction)
}
