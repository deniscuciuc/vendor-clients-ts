import { describe, expect, it } from 'vitest'
import { baniFromDecimal, formatMaibAmount } from './amount.js'

/*
  The one conversion where our money leaves the system. Internally everything
  is whole bani; maib wants a decimal string, and dividing floats is correct for
  almost every value and wrong for a few — exactly the few that turn into
  support tickets.
*/
describe('formatMaibAmount', () => {
  it.each([
    [100, '1.00'],
    [1049, '10.49'],
    [99_999, '999.99'],
    [100_000, '1000.00'],
    [1, '0.01'],
    [0, '0.00'],
    [29_900, '299.00'],
  ])('turns %i bani into "%s"', (bani, expected) => {
    expect(formatMaibAmount(bani)).toBe(expected)
  })

  it('refuses anything that is not whole bani', () => {
    // Throws rather than returning a result: non-integer bani are a defect in
    // the caller, not a state of the world.
    expect(() => formatMaibAmount(10.5)).toThrow(/amount in bani/)
    expect(() => formatMaibAmount(-100)).toThrow(/amount in bani/)
    expect(() => formatMaibAmount(Number.NaN)).toThrow(/amount in bani/)
  })

  it('round-trips through their decimal form without drifting', () => {
    for (const bani of [1, 99, 100, 1049, 33_333, 99_999, 100_000, 1_234_567]) {
      expect(baniFromDecimal(formatMaibAmount(bani))).toBe(bani)
    }
  })
})

describe('baniFromDecimal', () => {
  it('accepts the shapes their documentation allows', () => {
    expect(baniFromDecimal('10.49')).toBe(1049)
    expect(baniFromDecimal('10.4')).toBe(1040)
    expect(baniFromDecimal('10')).toBe(1000)
    expect(baniFromDecimal(' 10.49 ')).toBe(1049)
  })

  it('refuses anything else rather than guessing', () => {
    for (const value of ['', 'ten', '10.499', '-10.00', '1e3', '10,49']) {
      expect(baniFromDecimal(value), value).toBeNull()
    }
  })
})
