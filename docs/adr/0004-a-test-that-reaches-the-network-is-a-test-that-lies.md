# ADR-0004. A test that reaches the network is a test that lies

## Status

Accepted

## Context

In a repository made of HTTP clients, a live call in a test gets written by accident: someone
forgot to pass a transport, left a real URL in a fixture, checked "maybe it works" and did not
take it out.

Such a test is green until the day the vendor has planned maintenance, the runner has no route
outside, or no rate is published because it is Saturday. It fails quietly, about something other
than our code — and it gets fixed by adding `skip`.

This is the same case as a test that silently skips itself when a database is absent: it reports
green about something it did not check.

## Decision

The shared Vitest setup replaces `globalThis.fetch` with a function that throws with an
explanation. A test that reaches the network fails loudly on the very first run.

The stub is installed by **plain assignment**, not through `vi.stubGlobal`. That detail carries
the guarantee: the test for `HttpTransport` itself substitutes `fetch` deliberately with
`vi.stubGlobal`, and because the thrower is what was there first, Vitest records the thrower as
the original. With `unstubGlobals` on, restoring hands back the thrower rather than the real
`fetch`, so the substitution neither leaks into the next file nor can ever undo the refusal.

Every package keeps a `test/fixtures/` directory with recorded vendor responses;
`scripts/rules/vendors.mjs` checks that it is there and not empty.

## Consequences

A full run takes seconds, does not depend on the internet, and is identical on a developer's
machine and on a runner.

Every package has a "the network is unreachable without an explicit stub" test — it guards the
stub itself: without it, disabling the setup would go unnoticed, because every other test would
carry on passing.

The cost: nothing checks that the fixtures still match real responses except the check date in
`docs/vendors/<name>.md`. A live check belongs to a schedule of its own rather than to the test
suite.
