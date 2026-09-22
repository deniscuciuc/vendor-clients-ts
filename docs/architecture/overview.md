# How this is put together

Four clients for other people's APIs. Each publishes separately and depends on nothing of ours.

```
vendor-clients-ts
├── packages/
│   ├── maib/        MDL card acquiring
│   ├── webshare/    proxies
│   ├── bnm/         National Bank of Moldova rates
│   └── bnr/         National Bank of Romania rates
├── scripts/         the repository's own validators
├── templates/       the skeleton of a new package
└── test-setup/      the network-refusing stub every package's tests load
```

## What belongs here

One rule decides it: **a package here has zero ties to any application's domain.** The moment a
package needs to know about an organization, a tenant or an invoice, it is not a vendor client
and belongs in the application instead.

That rule is what makes these packages worth publishing at all. A vendor's API is versioned by
the vendor rather than by anyone's roadmap, and it carries no domain concepts — so a client for
it is the rare piece of code that genuinely is the same for everybody.

## The shape of a package

Identical across all four, and that is the whole scaling mechanism:

```
packages/<vendor>/
├── src/
│   ├── index.ts        the public surface, explicit re-exports
│   ├── endpoints.ts    URLs and the vendor's API version
│   ├── transport.ts    the port + HTTP. The only file containing fetch
│   ├── errors.ts       the normalised shape of an error
│   └── <area>.ts       one file per area of the API
├── test/fixtures/      recorded responses
├── api.snapshot.json   the list of exports
└── package.json  tsconfig.json  vitest.config.ts  README.md
```

There are no layers inside a package and none are needed: a client for someone else's API is
parsing, URL assembly and one port. Copying the structure of a domain package in here would mean
four directories, three of them holding a single file.

## The three lines that hold the shape

**The transport port** separates decisions from the network. Everything above it is verified
with no internet, no keys and no live contract with the vendor
([ADR-0002](../adr/0002-the-transport-is-a-port.md)).

**The absence of dependencies** makes a package installable on its own
([ADR-0001](../adr/0001-a-vendor-package-depends-on-nothing-of-ours.md)).

**The public-surface snapshot** turns a removed export into a failed build. These packages are
installed by somebody who is not at the review, and without the snapshot a breaking change would
ride out in a minor version.

## What does not live here

Adapters. A `MaibProvider implements PaymentProvider` is a class in the application, not here:
the `PaymentProvider` interface belongs to the application, and a package that knew about it
would stop being a vendor client.

Domain types. A type describing a vendor's response moves into the package
(`WebsharePlanUsage`); a type describing an application's domain stays outside (`Bani`,
`Currency`).

A shared runtime. `Result` and `Transport` are duplicated in every package deliberately — see
[ADR-0001](../adr/0001-a-vendor-package-depends-on-nothing-of-ours.md).
