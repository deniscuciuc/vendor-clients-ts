# @deniscuciuc/maib

An unofficial client for **maib e-commerce** acquiring — taking card payments in Moldovan lei.

> **Never run against a live acquirer.** There is no contract with maib behind this package, no
> live credentials exist, and not one line of it has ever spoken to the acquirer. It is written
> against the published specification and verified entirely by substituting the transport. That
> is not a temporary state to be fixed — it is why the transport is a port: on the day keys
> appear, exactly one thing changes, which implementation is passed in. Treat it as a starting
> point you must verify against your own account, not as a proven integration.

Not affiliated with or endorsed by Moldova Agroindbank.

```bash
pnpm add @deniscuciuc/maib
```

## How to use it

```ts
import { createMaibClient, parseCallback } from '@deniscuciuc/maib'

const maib = createMaibClient({
  projectId, projectSecret,
  callbackUrl: 'https://api.example.md/payments/maib/callback',
  okUrl: 'https://example.md/checkout/done',
  failUrl: 'https://example.md/checkout',
})

const payment = await maib.pay({
  orderId: invoice.id,          // not the invoice number — see below
  amountBani: 29_900,           // whole bani, never a float
  description: `Order ${invoice.number}`,
})

if (payment.ok) redirect(payment.value.payUrl)
```

The callback is verified by a standalone function needing neither a client nor a network:

```ts
const parsed = parseCallback(request.body, signatureKey)
if (!parsed.ok) {
  // 'signature'  — somebody is trying to forge a payment; this goes in the security log
  // 'unreadable' — the signature matched, but the body cannot be read
  return reply.code(400).send()
}
// Compare parsed.value.amountBani against the invoice: a signed message about a
// different amount is not a payment.
```

## What is worth knowing

| | |
| --- | --- |
| `orderId` | Put the identifier you will find the invoice by in here, not its human-readable number. It comes back in the callback, and a correctly signed callback leading nowhere is the worst outcome |
| `orderId` length | 36 characters, exactly the length of a UUID. Longer is a `refused` error, not a silent truncation |
| Minimum | 100 bani. The refusal is issued before contacting the acquirer |
| Amounts | Whole bani on the way in, a decimal string on the wire. The conversion is string-based, not through a float |
| Signature | In the **body**, not a header: `{ result, signature }`. Compared in constant time |
| Two keys | `projectSecret` proves us to them, `signatureKey` proves them to us. Swapped, they give you an acquirer that can take money and cannot confirm it |
| Token | Fetched once per process, refreshed 30 seconds before expiry |
| Timeout | 15 seconds |
| API version | `v1`, baked into `MAIB_BASE_URL`. A `v2` will be a new major of this package |

More about the source in [docs/vendors/maib.md](../../docs/vendors/maib.md).

## Licence

[MIT](LICENSE). Part of [vendor-clients-ts](https://github.com/deniscuciuc/vendor-clients-ts).
