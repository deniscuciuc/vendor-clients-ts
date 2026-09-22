# National Bank of Romania

Reference rates. Public data, no authentication needed.

| | |
| --- | --- |
| Package | `@deniscuciuc/bnr` |
| URL | `https://www.bnr.ro/nbrfxrates.xml` |
| Format | XML: `Cube date="..."` → `Rate currency="EUR" multiplier="100"` |
| Version | The bank publishes none. Checked on `BNR_SPEC_CHECKED` |
| Cost | Free |
| Quotas | Not stated |

## Quirks

**Today only.** This URL holds the latest publication and nothing else. There is deliberately no
"rate on a date" method in the package: the archive lives at a different URL in a different
format, and a method that took a date and ignored it would promise an archive that does not
exist here. An earlier version of this code had exactly such a method — the port passed a date
in and the adapter dropped it on the floor.

**The publication date matters.** On a Monday morning this URL still holds Friday's rates. The
package hands out the `date` from the document so the caller can see which day the rate is for —
an earlier version discarded it, and the Friday rate got recorded as Monday's.

**The multiplier.** Forint and yen are published per 100. The package divides and always returns
per single unit.

**The base currency is the Romanian leu.** A rate means "how many lei per unit of currency", not
the other way round.

## When it fails

The same as BNM: take the last known rate. An alarm is for silence lasting several working days
running.
