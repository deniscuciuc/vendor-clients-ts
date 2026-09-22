# ADR-0002. The transport is a port, and `fetch` lives in one file

## Status

Accepted

## Context

There is no contract with maib, no live credentials exist, and obtaining them by the time the
client was written was impossible. The same question is broader: a Webshare key costs money,
and a bank's response depends on the day of the week.

A guarantee that can only be checked with a live account and a real charge is a guarantee
nobody checks.

## Decision

Every package declares a transport interface — path, body, token — and an HTTP implementation of
it. `fetch` is called **only** in `transport.ts`; `scripts/rules/vendors.mjs` checks this.

Everything that makes a decision — what an amount looks like, when a token is refreshed, whether
to believe a callback, what counts as an empty response — lives above that line and is tested by
substituting a fake transport.

## Consequences

The maib client is verified in full without a single call to the acquirer: the tests cover token
reuse, refresh, rejection of a half-parsed response, amount conversion and four signature-forgery
cases. On the day keys appear, exactly one thing changes — which implementation is passed in.

The tests do not depend on whether the vendor is alive, whether the runner has internet, or
whether today is a working day.

The cost: every package carries an extra two-method interface, and the test for `HttpTransport`
itself has to be written separately by substituting `fetch`. That is one file per package.

The one-file rule for `fetch` matters more than it looks: as soon as the network appears in two
places, "pass a fake transport" stops being true, and that is discovered on the day a test first
fails through no fault of ours.
