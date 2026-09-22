# ADR-0006. Two error conventions beat one rewrite

## Status

Accepted

## Context

The packages arrived from two codebases with different habits. `webshare` was built on
`neverthrow` and returns a `Result`: around 900 lines of source and 700 of tests, all working.
`maib` threw exceptions and returned `null` where things did not work out.

Neither was acceptable as it stood: `null` does not say why it failed, and the difference
between "the signature was forged" and "the amount could not be read" is the difference between
a security log and an error log.

Uniformity within a repository is a good thing. Here it would have cost rewriting 1,600
test-covered lines for a property no consumer would notice.

## Decision

`webshare` stays on `neverthrow`. Nothing is rewritten.

Every other package — `maib`, `bnm`, `bnr` and anything new — returns a tagged union
`{ ok: true, value } | { ok: false, error }` declared inside the package. The `kind` field of an
error is an enum, not text.

Exceptions remain for a defect in the caller: non-integer bani, a non-ISO date. That is fixed by
editing code, and a result branch would let it survive to production.

## Consequences

The repository is not uniform, and that is visible at a glance across two neighbouring packages.
In exchange, a week was not spent on a refactor that would not have added a single check.

`neverthrow` lands in the dependency tree of anyone installing `webshare`. Adopting the library
in your own code is not required: a `Result` is a value, and `.match()` is enough.

The rule for new packages is written down and checked at review rather than by a linter:
telling a `neverthrow` `Result` from our own union statically is possible, but a rule about
**new** packages cannot be expressed to a linter without an exemption list — which is precisely
the construct such lists go on to breed.
