import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { webshareSubscriptionSchema } from './schemas.js'

/**
 * The schemas against a recorded response.
 *
 * The other tests in this package build responses inline. This one checks
 * something else: that the schema accepts **the** shape Webshare actually
 * returns — including the small details schemas usually break on.
 *
 * Here that is a fractional second of six digits: Webshare returns
 * microseconds, not milliseconds, and a schema written for the familiar format
 * would pass every inline test and fail on the first live response.
 */
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(import.meta.dirname, '..', 'test', 'fixtures', name), 'utf8'))

describe('the recorded subscription', () => {
  it('passes the schema, microsecond timestamps and all', () => {
    const parsed = webshareSubscriptionSchema.safeParse(fixture('subscription.json'))
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
  })

  it('is refused when a field the schema requires goes missing', () => {
    // A schema that accepts an incomplete response is not a schema but documentation.
    const { term: _term, ...withoutTerm } = fixture('subscription.json') as Record<string, unknown>
    expect(webshareSubscriptionSchema.safeParse(withoutTerm).success).toBe(false)
  })

  it('is refused when a field changes type, which is how a vendor breaks you quietly', () => {
    const changed = { ...(fixture('subscription.json') as Record<string, unknown>), id: '1234' }
    expect(webshareSubscriptionSchema.safeParse(changed).success).toBe(false)
  })
})
