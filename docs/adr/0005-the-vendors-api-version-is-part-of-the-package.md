# ADR-0005. The vendor's API version is part of the package

## Status

Accepted

## Context

These packages are published, and they are installed by somebody who is not at the review. When
a vendor releases a new API version, the temptation is to edit the URL constant and ship a
patch. The consumer updates through `^`, gets a different protocol, and finds out in production.

A separate difficulty: not everyone has a version. maib has it in the path (`/v1`). Webshare
versions each endpoint separately, with `v2` and `v3` alive in the same set. Neither bank has a
version at all: BNM serves XML from a URL with no version, and BNR serves `nbrfxrates.xml`,
whose format has not changed in years and is not marked in any way.

## Decision

A package must declare one of two things in `src/endpoints.ts`:

- a version segment in the base URL (`MAIB_BASE_URL = '.../v1'`), or
- a `<VENDOR>_SPEC_CHECKED` constant holding an ISO date — the date the response format was
  checked against the specification or against a live response.

Enforced by `scripts/rules/vendors.mjs`.

A vendor moving to a new version is a **major** version of the package, not an edit to a
constant.

## Consequences

The answer to "what were we even looking at when this was written" exists in the code rather
than in somebody's memory. For the banks, which have no version, it is the only handle there is:
the format will change one day, and the date shows how long it has been since anyone checked.

A major version on a vendor's migration means consumers will not update silently. That is
deliberately slow.

The cost: the check date is a manual artefact and it goes stale. The validator checks that it
exists and is a date, but cannot check that anyone actually looked. The rule works exactly as
far as it is followed — which is why it is repeated in the definition-of-done checklist.
