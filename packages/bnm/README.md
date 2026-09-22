# @deniscuciuc/bnm

An unofficial client for the official exchange rates of the National Bank of Moldova.

Parses the XML the bank serves at `official_exchange_rates` and returns rates **per single
unit** of currency — the number from the document has already been divided by the nominal.

```bash
pnpm add @deniscuciuc/bnm
```

Not affiliated with or endorsed by the Banca Națională a Moldovei. It reads their public,
unauthenticated rates endpoint.

## How to use it

```ts
import { createBnmClient } from '@deniscuciuc/bnm'

const bnm = createBnmClient()
const result = await bnm.rates('2026-09-09')

if (result.ok) {
  console.log(result.value.EUR) // 19.5432
} else if (result.error.kind === 'empty') {
  // A weekend or a holiday: the bank published no rates for this date.
  // Take the previous working day.
} else {
  // 'http' or 'transport' — the bank is unreachable, worth retrying.
}
```

The parser is available on its own, with no network:

```ts
import { parseBnmXml } from '@deniscuciuc/bnm'
const rates = parseBnmXml(xml)
```

## What is worth knowing

| | |
| --- | --- |
| Date | ISO `YYYY-MM-DD`. The conversion to the bank's `DD.MM.YYYY` happens inside; an invalid format throws before any network call |
| Nominal | Accounted for. The Romanian leu is published per 10 and the Japanese yen per 100 — the output is always per single unit |
| Weekends | The bank returns a document with no rates. That is `{ ok: false, error: { kind: 'empty' } }` rather than an empty map: "did not publish" and "could not read" call for different actions |
| Currency set | Everything the bank published is returned. Narrowing to what your application needs is the caller's business |
| Timeout | 15 seconds |
| Authentication | None needed; the data is public |
| API version | The bank does not publish one. The format was checked on `BNM_SPEC_CHECKED` |

More about the source in [docs/vendors/bnm.md](../../docs/vendors/bnm.md).

## Licence

[MIT](LICENSE). Part of [vendor-clients-ts](https://github.com/deniscuciuc/vendor-clients-ts).
