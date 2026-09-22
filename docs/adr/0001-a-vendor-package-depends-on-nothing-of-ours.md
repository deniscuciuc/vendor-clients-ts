# ADR-0001. A vendor package depends on nothing of ours

## Status

Accepted

## Context

This repository began as shared ground between several applications. The reason the shared
thing became vendor clients rather than a library of domain code: in two of those applications,
each around 630 thousand lines, there were 24 packages sitting at identical paths, and not one
file matched byte for byte. Shared code where it has already diverged is version coordination
rather than reuse.

Clients for other people's APIs are the exception: they have no domain concepts and no tenants,
and their versioning is dictated by the vendor rather than by anyone's roadmap.

The temptation to set up a shared `vendor-kit` with a transport port, a timeout and a `Result`
type arrives with the second package: it is thirty lines duplicated four times.

## Decision

A vendor package depends on nothing of ours — not on shared infrastructure, not on an
application, not on a neighbouring vendor package. Nothing of ours is permitted even in
`devDependencies`; the shared TypeScript configuration and the Vitest preset are files in this
repository, reached by a relative path.

There is no shared runtime package inside this repository and there will not be. `Result`,
`Transport` and the timeout constant are duplicated in every package.

Domain types do not move in here alongside a client: if a type describes a vendor's response it
becomes a type of the package (`WebsharePlanUsage`); if it describes an application's domain it
stays in the application (`Bani`, `Currency`).

Enforced by `scripts/rules/vendors.mjs` and by the `noRestrictedImports` rule in Biome.

## Consequences

Any package here can be published on its own, and a consumer who installs one package gets one
package.

The cost is twenty or thirty duplicated lines per package, and the fact that an improvement to
one `Transport` does not propagate to the others automatically. That is accepted deliberately: a
shared package would cost exactly the version train this repository exists to avoid.

The rule also defines the boundary of the repository. The moment a package needs to know about
an organization, a tenant or an invoice, it is not a vendor client and does not live here.
