# Sources

One page per vendor. A page answers the questions that come up not while writing the client but
a year later: what this API is, which version of it we looked at, what it costs, where its
limits are, and what to do when it fails.

| Package | Vendor | What it gives | Authentication | Version |
| --- | --- | --- | --- | --- |
| [`@deniscuciuc/maib`](maib.md) | maib e-commerce | Card payments in MDL | A project key pair plus a separate signature key | `v1` in the URL |
| [`@deniscuciuc/webshare`](webshare.md) | Webshare | Proxies: subscription, plans, list, replacement, capacity | An API key | `v2` and `v3` by endpoint |
| [`@deniscuciuc/bnm`](bnm.md) | National Bank of Moldova | Official exchange rates | None | None; a check date |
| [`@deniscuciuc/bnr`](bnr.md) | National Bank of Romania | Reference rates | None | None; a check date |

All four are **unofficial**. None of these vendors publishes a package of its own, and none of
them endorses these.

## What a page here has to cover

A new page is not finished until it answers all of:

- the endpoint and the shape of its responses
- which version we read, or the date the format was checked
- what it costs and what its quotas are
- **quirks** — the things that are true and surprising, the ones that cost an afternoon
- **when it fails** — what a caller should actually do, which is rarely "raise an alarm"

The quirks and the failure playbook are the reason these pages exist. The rest can be
reconstructed from the vendor's own documentation; those two cannot.
