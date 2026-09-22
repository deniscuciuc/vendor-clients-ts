import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseBnrXml } from './parse.js'

const fixture = (name: string) =>
  readFileSync(join(import.meta.dirname, '..', 'test', 'fixtures', name), 'utf8')

describe('parseBnrXml', () => {
  it('reads every currency the bank published', () => {
    const { rates } = parseBnrXml(fixture('rates.xml'))
    expect(Object.keys(rates).sort()).toEqual(['EUR', 'HUF', 'JPY', 'USD'])
  })

  // @invariant 2
  it('divides by the multiplier, which is the whole point', () => {
    const { rates } = parseBnrXml(fixture('rates.xml'))
    // 1.2604 for a hundred forint, not for one.
    expect(rates.HUF).toBeCloseTo(0.012604, 12)
    expect(rates.JPY).toBeCloseTo(0.02941, 12)
    // The euro has no multiplier at all.
    expect(rates.EUR).toBe(4.9756)
  })

  // @invariant 4
  it('carries the publication date, which the caller needs on a Monday', () => {
    // This URL holds the last working day: on a Monday morning it is still
    // Friday. The original discarded the date.
    expect(parseBnrXml(fixture('rates.xml')).date).toBe('2026-09-09')
  })

  it('says the date is unknown rather than inventing one', () => {
    expect(parseBnrXml('<Rate currency="EUR">4.9</Rate>').date).toBeNull()
  })

  it('treats a missing multiplier as one rather than as zero', () => {
    expect(parseBnrXml('<Rate currency="EUR">4.9</Rate>').rates.EUR).toBe(4.9)
  })

  it('leaves a currency out rather than guessing when the value is unreadable', () => {
    expect(parseBnrXml('<Rate currency="EUR">n/a</Rate>').rates).toEqual({})
  })

  it('leaves a currency out when the value is zero or negative', () => {
    expect(parseBnrXml('<Rate currency="EUR">0</Rate>').rates).toEqual({})
    expect(parseBnrXml('<Rate currency="EUR">-4.9</Rate>').rates).toEqual({})
  })

  it('leaves a currency out when the multiplier would divide by zero or by a negative', () => {
    expect(parseBnrXml('<Rate currency="EUR" multiplier="0">4.9</Rate>').rates).toEqual({})
    expect(parseBnrXml('<Rate currency="EUR" multiplier="-1">4.9</Rate>').rates).toEqual({})
  })

  it('refuses a code that is not three letters, so nothing is keyed by junk', () => {
    expect(parseBnrXml('<Rate currency="EURO">4.9</Rate>').rates).toEqual({})
    expect(parseBnrXml('<Rate currency="E">4.9</Rate>').rates).toEqual({})
  })

  it('skips a rate with no currency at all', () => {
    expect(parseBnrXml('<Rate multiplier="1">4.9</Rate>').rates).toEqual({})
  })

  it('returns nothing for an empty document or for something that is not one', () => {
    expect(parseBnrXml('').rates).toEqual({})
    expect(parseBnrXml('<html><body>503</body></html>').rates).toEqual({})
  })
})
