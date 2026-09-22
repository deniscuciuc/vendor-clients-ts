# maib e-commerce

Card payments in Moldovan lei. The acquirer is Moldova Agroindbank.

| | |
| --- | --- |
| Package | `@deniscuciuc/maib` |
| URL | `https://api.maibmerchants.md/v1` |
| Version | `v1`, baked into `MAIB_BASE_URL`. A `v2` will be a new major of the package |
| Authentication | `projectId` + `projectSecret` → an access token and a refresh token |
| Callback signature | A separate `signatureKey`, issued separately |
| Currency | MDL by default |
| Minimum | 100 bani |

## There is no contract

At the time of writing no contract with maib is signed, no live credentials exist, and not one
line of this client has ever spoken to the acquirer. It is written against the published
specification and verified in full by substituting the transport.

This is not a temporary state to be fixed — it is the reason the transport here is a port. On
the day keys appear, exactly one thing changes: which implementation is passed in. A guarantee
that can only be checked with a live account and a real charge is a guarantee nobody checks.

**If you are adopting this package, treat it as a starting point to verify against your own
account, not as a proven integration.**

## Quirks

**Two keys, and confusing them is expensive.** `projectSecret` proves us to them;
`signatureKey` proves them to us. Put in each other's place they give you an acquirer that can
take money and cannot confirm that it did.

**The signature is in the body, not a header.** What arrives is `{ result, signature }`. The
algorithm is theirs: sort the keys of `result`, join the values with colons, append the
signature key, take SHA-256 of the bytes, encode as base64. The comparison is constant-time:
comparing base64 with `===` leaks the expected value a byte at a time to anyone willing to
measure.

**`orderId` is 36 characters.** Exactly the length of a UUID, which is luck rather than design.
The package refuses a long identifier rather than truncating it: a silently shortened identifier
is a correctly signed callback with nothing to reconcile it against.

Put the identifier you will find the invoice by in there, not its human-readable number.

**The amount is a decimal string.** Whole bani on the way in, with a string-based conversion.
Dividing floats is correct for almost every value and wrong for a few — and those few turn into
support tickets.

**The callback amount is compared outside.** The package carries it up in bani and compares it
to nothing: a correctly signed message naming a different amount is not a payment but a message
about something else, and the comparison belongs to whoever holds the invoice.

**The description is a field of the call.** It is truncated to 124 characters.

## When it fails

`transport` — the payment's state is **unknown**. Do not treat it as a failure: ask `payInfo`
by `payId`, or you risk having a customer who paid and an invoice claiming otherwise.

A `signature` failure on a callback is not an integration fault but an attempt to forge a
payment. That belongs in the security log, not the error log.
