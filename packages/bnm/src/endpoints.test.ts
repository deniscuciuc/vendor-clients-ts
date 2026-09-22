import { describe, expect, it } from 'vitest'
import { ratesPath, toBnmDate } from './endpoints.js'

describe('toBnmDate', () => {
  it('turns an ISO date into the form the bank reads', () => {
    expect(toBnmDate('2026-09-09')).toBe('09.09.2026')
  })

  it('refuses anything else rather than building a URL out of undefined', () => {
    // The original silently assembled `undefined.undefined.undefined` and got
    // back an empty response, indistinguishable from a weekend.
    expect(() => toBnmDate('today')).toThrow(/Not an ISO date/)
    expect(() => toBnmDate('09.09.2026')).toThrow(/Not an ISO date/)
    expect(() => toBnmDate('2026-9-9')).toThrow(/Not an ISO date/)
    expect(() => toBnmDate('')).toThrow(/Not an ISO date/)
  })
})

describe('ratesPath', () => {
  it('carries the date in the form the bank reads', () => {
    expect(ratesPath('2026-09-09')).toBe('/md/official_exchange_rates?get_xml=1&date=09.09.2026')
  })
})
