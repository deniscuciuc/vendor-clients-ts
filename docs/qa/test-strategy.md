# Test strategy

The repository consists of HTTP clients. Everything else follows from that.

## The one hard rule

**No test reaches the network.** The shared Vitest setup replaces `globalThis.fetch` with a
throwing stub; a test that goes outside fails loudly and immediately
([ADR-0004](../adr/0004-a-test-that-reaches-the-network-is-a-test-that-lies.md)).

The check on `HttpTransport` itself substitutes `fetch` deliberately, through `vi.stubGlobal`.
`unstubGlobals` is on, so the substitution does not leak into the next file. Note that the setup
installs the stub by plain assignment rather than through `vi.stubGlobal`: that way Vitest records
the *thrower* as the original, and restoring can never hand back the real `fetch`.

Every package has a "the network is unreachable without an explicit stub" test. It does not check
our code — it guards the stub: without it, disabling the setup would go unnoticed, because every
other test would carry on passing.

## What is covered

| Package | Test files | About |
| --- | --- | --- |
| `maib` | 5 | Amounts and round-trip, token lifecycle, four signature-forgery cases, pre-network rejections, transport |
| `webshare` | 2 | The client and the capacity client |
| `bnm` | 4 | Parsing with the nominal, date format, client branches, transport |
| `bnr` | 4 | Parsing with the multiplier, publication date, client branches, transport |

## Mandatory negative cases

Code without a failing test is useless. For every package, at minimum:

- a malformed or incomplete vendor response
- a non-2xx
- a timeout or a dropped connection
- an unknown enum value
- where a signature exists — the wrong key, a body altered after signing, no signature at all, a
  signature of the wrong length
- where arithmetic exists — the multiplier, zero, negative, a missing field

## What is tested deliberately, because it has already lied

These cases are in the suite not for completeness but because the corresponding code was wrong or
missing in the sources the packages came from:

- **dividing by the nominal and the multiplier** in both banks. There were no tests; without the
  division a currency with a nominal of 100 comes out a hundred times off, and the accounting
  department is what finds it
- **the presence of a timeout** in the transport. In both rate clients `fetch` went out with no
  signal at all
- **the publication date** at BNR. It was discarded, so on a Monday the Friday rate was recorded
  as Monday's
- **the date format** at BNM. It was parsed by destructuring without a check: on unexpected input
  the request went to a URL containing `undefined` and got back a response indistinguishable from
  a weekend
- **rejection before the network** in maib. Checking the amount and the `orderId` length should
  not cost a round trip to the acquirer
- **a caller's defect is not disguised as a network failure.** The very first version of `bnm`
  threw an invalid date inside the `try` and returned `kind: 'transport'` — a caller would have
  set up a retry and retried the same invalid date forever. Caught by a test before the first
  commit

## What is not covered, and why

**Whether the fixtures still match real responses.** A recorded response does not diverge from a
live one until the day it does. The only handle on this is the spec-check date in
`docs/vendors/<name>.md`.

**There are no coverage thresholds.** The packages are new; there is nothing yet to ratchet
against. They will appear once there is something to start from.

## Tests are type-checked

`typecheck` runs against `tsconfig.test.json`, which includes the tests. The main `tsconfig.json`
excludes them so they never reach `dist` — and that left a hole: test files were type-checked by
nothing at all. Vitest only transpiles them, so a mistake in a test was visible only when it
failed at runtime, and never visible if the test passed.

The hole turned up in a sibling repository this configuration had been copied into. The first
honest run here found two real errors in **already published** packages:

- the `fetch` stub was declared as `vi.fn(async () => ...)`, with no parameters. That typed
  `mock.calls[0]` as an empty tuple, so reading `[0]` and `[1]` was a type error. The tests
  passed: at runtime the arguments are there, the types just did not know about them
- in `maib/client.test.ts` the call array declared `token?: string` but received
  `string | undefined` — under `exactOptionalPropertyTypes` those are different things

Neither broke behaviour. Both meant the tests of those packages were checking less than they
appeared to, and the next edit could have broken them silently.

## Invariants

Each one must name a test with an `@invariant N` tag in a comment; the `invariants` rule in
`scripts/repo-check.mjs` checks this, and it fails in both directions — on an invariant with no
tag, and on a tag pointing at a number that does not exist.

Before they were numbered this document was prose: the things listed below were checked, but
nobody could say which.

New ones are appended **at the end**: inserting into the middle renumbers every tag after it.

1. No test in the main suite reaches the network without an explicit stub
2. A rate is divided by the nominal or the multiplier, or it comes out a hundred times off
3. A value that could not be read drops the currency rather than substituting zero
4. The publication date comes from the vendor, not from the caller's clock
5. Every request to a vendor carries a timeout
6. A day with no rates is distinguishable from a day that could not be read
7. A caller's defect is not disguised as a network failure
8. A signature that fails on key, length or an altered body is rejected
9. An amount or identifier the vendor will not accept is rejected before contacting it
10. Nothing is silently truncated to fit someone else's limit
11. A vendor package depends on nothing of ours
12. The public surface is listed explicitly, without `export *`

## Validator tests

The shared rules — `api`, `docs`, `invariants` — live in `scripts/repo-check.mjs`. This
repository's own rule is `scripts/rules/vendors.mjs`, and every clause of it has a failing test:
`pnpm test:scripts`. A rule that has never been made to fail is a rule nobody knows works at all.
