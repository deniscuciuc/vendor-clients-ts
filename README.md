# vendor-clients-ts

Unofficial TypeScript clients for vendor APIs that ship none of their own — card acquiring,
proxies and central-bank exchange rates.

[![CI](https://github.com/deniscuciuc/vendor-clients-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/deniscuciuc/vendor-clients-ts/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js 22+](https://img.shields.io/badge/node-22%2B-339933?logo=node.js)](https://nodejs.org/)

Each package installs on its own and drags nothing behind it — no shared library, no domain
model. A client for someone else's API knows nothing about organizations, tenants or invoices,
and that is its defining property rather than an accident.

## Packages

| Package | Vendor | What it gives | npm |
| --- | --- | --- | --- |
| [`@deniscuciuc/maib`](packages/maib) | maib e-commerce | Card payments in MDL: payment, signed callback, status | [![npm](https://img.shields.io/npm/v/@deniscuciuc/maib?logo=npm&color=cb3837&label=%20)](https://www.npmjs.com/package/@deniscuciuc/maib) |
| [`@deniscuciuc/webshare`](packages/webshare) | Webshare | Proxies: subscription, plans, list, replacement, capacity | [![npm](https://img.shields.io/npm/v/@deniscuciuc/webshare?logo=npm&color=cb3837&label=%20)](https://www.npmjs.com/package/@deniscuciuc/webshare) |
| [`@deniscuciuc/bnm`](packages/bnm) | National Bank of Moldova | Official exchange rates | [![npm](https://img.shields.io/npm/v/@deniscuciuc/bnm?logo=npm&color=cb3837&label=%20)](https://www.npmjs.com/package/@deniscuciuc/bnm) |
| [`@deniscuciuc/bnr`](packages/bnr) | National Bank of Romania | Reference rates | [![npm](https://img.shields.io/npm/v/@deniscuciuc/bnr?logo=npm&color=cb3837&label=%20)](https://www.npmjs.com/package/@deniscuciuc/bnr) |

```bash
pnpm add @deniscuciuc/bnm
```

Public npm, no registry configuration and no token. What each source is, what its quotas are and
where it surprises you: [docs/vendors/](docs/vendors/README.md).

## Unofficial, and what that means

None of these vendors publishes a package, and none of them endorses these. They are written
against published specifications and against recorded responses.

**Read this before adopting `@deniscuciuc/maib`:** there is no contract with maib behind it, no
live credentials exist, and not one line of it has ever spoken to the acquirer. It is verified
entirely by substituting the transport. That is deliberate — it is why the transport is a port —
but it makes the package a starting point to verify against your own account, not a proven
integration. The other three read public, unauthenticated endpoints and are exercised against
recorded responses.

## Two properties worth knowing about

**No test reaches the network.** The shared Vitest setup replaces `globalThis.fetch` with a
throwing stub, so the suite runs in seconds, needs no internet and does not care whether today
is a working day
([ADR-0004](docs/adr/0004-a-test-that-reaches-the-network-is-a-test-that-lies.md)).

**Credentials arrive as arguments.** Not one `process.env` in any package. A package does not
know where it is deployed, and one process can hold two clients with different keys
([ADR-0003](docs/adr/0003-credentials-are-arguments-not-environment.md)).

## Working on this repository

```bash
pnpm install
pnpm verify
```

Needs **Node 22+** and **pnpm 11**. No database, no Docker, no vendor keys: everything builds and
tests without a network.

```bash
pnpm build / typecheck / test    # through Turborepo
pnpm check / check:fix           # Biome
pnpm verify                      # everything, before you push

pnpm repo:check                  # all rules: api, docs, invariants, vendors
pnpm repo:check vendors          # only the vendor-package house rules
pnpm api:snapshot                # record the public-surface snapshot
pnpm test:scripts                # tests for the validators themselves
```

A single package: `pnpm --filter @deniscuciuc/maib test`

## How a package is shaped

```
packages/<vendor>/src/
├── index.ts        explicit re-exports, no export *
├── endpoints.ts    URLs; an API version or a dated _SPEC_CHECKED constant
├── transport.ts    the port + HTTP. The only file containing fetch
├── errors.ts       a kind enum, not text
└── <area>.ts       one file per area of the API
```

The shape is identical across all four, and it is held by a linter rather than by agreement: the
`vendors` rule checks everything from the absence of `process.env` to the presence of a page in
`docs/vendors/`.

Why it is this way, and why `Result` is duplicated in every package instead of shared:
[docs/architecture/overview.md](docs/architecture/overview.md) and
[docs/adr/](docs/adr/0001-a-vendor-package-depends-on-nothing-of-ours.md).

## Adding a vendor

```bash
cp -r templates/vendor packages/<name>
```

Then follow the checklist in
[docs/operations/adding-a-vendor.md](docs/operations/adding-a-vendor.md).

One rule is worth knowing before you start: **a client is not written against a specification we
do not have.** Such a client compiles, looks like it works, and is verified by nothing.

## Contributing

Pull requests welcome — see [CONTRIBUTING.md](CONTRIBUTING.md),
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [SECURITY.md](SECURITY.md).

## Documentation

| Document | When you need it |
| --- | --- |
| [AGENTS.md](AGENTS.md) | The rules. They win on any disagreement |
| [docs/architecture/overview.md](docs/architecture/overview.md) | How it is put together, and why |
| [docs/vendors/](docs/vendors/README.md) | A page per source |
| [docs/operations/publishing.md](docs/operations/publishing.md) | Registry and release |
| [docs/operations/adding-a-vendor.md](docs/operations/adding-a-vendor.md) | The checklist for a new package |
| [docs/qa/test-strategy.md](docs/qa/test-strategy.md) | What is covered, and what will not be |
| [docs/adr/](docs/adr/0001-a-vendor-package-depends-on-nothing-of-ours.md) | Six decisions and their consequences |

## Licence

[MIT](LICENSE)
