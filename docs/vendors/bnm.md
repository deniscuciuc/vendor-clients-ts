# National Bank of Moldova

Official exchange rates. Public data, no authentication needed.

| | |
| --- | --- |
| Package | `@deniscuciuc/bnm` |
| URL | `https://www.bnm.md/md/official_exchange_rates?get_xml=1&date=DD.MM.YYYY` |
| Format | XML, flat: `ValCurs` → `Valute` → `CharCode`, `Nominal`, `Value` |
| Version | The bank publishes none. Checked on `BNM_SPEC_CHECKED` |
| Cost | Free |
| Quotas | Not stated. Once a day is enough; a rate does not change within a day |

## Quirks

**The date in the URL is in the bank's own format.** `DD.MM.YYYY`, not ISO. The conversion
happens inside the package, which takes ISO. An invalid format throws before any network call
rather than returning empty: an earlier version of this code parsed the date by destructuring
without a check, and on unexpected input silently went to a URL containing
`undefined.undefined.undefined`, getting back a response indistinguishable from a weekend.

**The nominal.** Some currencies are published in batches: the Romanian leu per 10, the Japanese
yen per 100. The package divides and always returns a rate per single unit. Skipping that
division is an error by a factor of a hundred, and the accounting department is what finds it.

**Weekends and holidays.** The bank answers with a document holding no rates — not with an
error. The package tells that apart from a failure:
`{ ok: false, error: { kind: 'empty' } }`. A caller should take the previous working day's rate
rather than raise an alarm.

**The currency set.** Everything the bank published is returned. Narrowing to what an
application needs is the caller's business. An earlier version of this code had a loop here that
appeared to filter down to five currencies but in fact only deleted keys that were already
absent, and so did nothing at all; it did not move across.

## When it fails

A rate does not change within a day, so the right behaviour is almost always to take the last
known one. An alarm makes sense if there has been no rate for several working days running.
