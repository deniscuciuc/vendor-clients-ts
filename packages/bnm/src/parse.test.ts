import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseBnmXml } from './parse.js'

const fixture = (name: string) =>
  readFileSync(join(import.meta.dirname, '..', 'test', 'fixtures', name), 'utf8')

describe('parseBnmXml', () => {
  it('reads every currency the bank published', () => {
    const rates = parseBnmXml(fixture('rates.xml'))
    expect(Object.keys(rates).sort()).toEqual(['EUR', 'JPY', 'RON', 'USD'])
  })

  // @invariant 2
  it('divides by the nominal, which is the whole point', () => {
    const rates = parseBnmXml(fixture('rates.xml'))
    // 39.26 for ten Romanian lei, not for one.
    expect(rates.RON).toBeCloseTo(3.926, 10)
    // 11.53 for a hundred yen.
    expect(rates.JPY).toBeCloseTo(0.1153, 10)
  })

  it('treats a missing nominal as one rather than as zero', () => {
    const rates = parseBnmXml('<Valute><CharCode>EUR</CharCode><Value>19.5</Value></Valute>')
    expect(rates.EUR).toBe(19.5)
  })

  // @invariant 3
  it('leaves a currency out rather than guessing when the value is unreadable', () => {
    const rates = parseBnmXml(
      '<Valute><CharCode>EUR</CharCode><Nominal>1</Nominal><Value>n/a</Value></Valute>',
    )
    expect(rates).toEqual({})
  })

  it('leaves a currency out when the value is zero or negative', () => {
    expect(parseBnmXml('<Valute><CharCode>EUR</CharCode><Value>0</Value></Valute>')).toEqual({})
    expect(parseBnmXml('<Valute><CharCode>EUR</CharCode><Value>-3</Value></Valute>')).toEqual({})
  })

  it('leaves a currency out when the nominal would divide by zero or by a negative', () => {
    expect(
      parseBnmXml('<Valute><CharCode>EUR</CharCode><Nominal>0</Nominal><Value>19</Value></Valute>'),
    ).toEqual({})
    expect(
      parseBnmXml(
        '<Valute><CharCode>EUR</CharCode><Nominal>-1</Nominal><Value>19</Value></Valute>',
      ),
    ).toEqual({})
  })

  it('refuses a code that is not three letters, so nothing is keyed by junk', () => {
    expect(parseBnmXml('<Valute><CharCode>EURO</CharCode><Value>19</Value></Valute>')).toEqual({})
    expect(parseBnmXml('<Valute><CharCode>E</CharCode><Value>19</Value></Valute>')).toEqual({})
  })

  it('skips a block with no code at all', () => {
    expect(parseBnmXml('<Valute><Nominal>1</Nominal><Value>19</Value></Valute>')).toEqual({})
  })

  it('returns nothing for a day the bank published nothing, without throwing', () => {
    expect(parseBnmXml(fixture('weekend.xml'))).toEqual({})
  })

  it('returns nothing for an empty document or for something that is not one', () => {
    expect(parseBnmXml('')).toEqual({})
    expect(parseBnmXml('<html><body>503 Service Unavailable</body></html>')).toEqual({})
  })

  it('keeps the last block when the bank repeats a currency', () => {
    const rates = parseBnmXml(
      '<Valute><CharCode>EUR</CharCode><Value>19</Value></Valute>' +
        '<Valute><CharCode>EUR</CharCode><Value>20</Value></Valute>',
    )
    expect(rates.EUR).toBe(20)
  })
})
