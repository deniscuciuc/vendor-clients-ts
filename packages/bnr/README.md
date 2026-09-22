# @deniscuciuc/bnr

An unofficial client for the reference exchange rates of the National Bank of Romania.

Parses `nbrfxrates.xml` and returns rates **per single unit** of currency — the number from the
document has already been divided by `multiplier` — together with the publication date.

```bash
pnpm add @deniscuciuc/bnr
```

Not affiliated with or endorsed by the Banca Națională a României. It reads their public,
unauthenticated rates document.

## How to use it

```ts
import { createBnrClient } from '@deniscuciuc/bnr'

const bnr = createBnrClient()
const result = await bnr.rates()

if (result.ok) {
  console.log(result.value.date)      // '2026-09-09' — which day the rate is for
  console.log(result.value.rates.EUR) // 4.9756
}
```

## What is worth knowing

| | |
| --- | --- |
| No date argument | At this URL the bank serves only its latest publication. There is deliberately no "rate on a date" method: the archive lives at a different URL in a different format |
| Publication date | Returned in `date`. On a Monday morning it is still Friday — a caller who cannot see that will record the Friday rate as Monday's |
| Multiplier | Accounted for. Forint and yen are published per 100 — the output is always per single unit |
| Base currency | The Romanian leu. A rate is how many lei per unit of currency |
| Timeout | 15 seconds |
| Authentication | None needed; the data is public |
| API version | The bank does not publish one. The format was checked on `BNR_SPEC_CHECKED` |

More about the source in [docs/vendors/bnr.md](../../docs/vendors/bnr.md).

## Licence

[MIT](LICENSE). Part of [vendor-clients-ts](https://github.com/deniscuciuc/vendor-clients-ts).
