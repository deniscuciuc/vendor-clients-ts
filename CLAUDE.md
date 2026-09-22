# CLAUDE.md

Orientation and commands. The working rules are in [AGENTS.md](AGENTS.md), which wins over this
file on any disagreement.

For a human reader, start at [README.md](README.md).

## What this is

Unofficial clients for vendor APIs that ship none of their own. Nothing of anyone's domain: no
organizations, no tenants, no business rules. A package installs into an application as an
ordinary dependency and drags nothing behind it.

Adapters — the classes wiring a client to an application's ports — live **in the application**.

Four packages: `maib` (MDL acquiring), `webshare` (proxies), `bnm` and `bnr` (exchange rates).
What is here and what is deliberately absent: [docs/vendors/README.md](docs/vendors/README.md).

## Setup

```bash
pnpm install
```

Needs Node 22+ and pnpm 11. No database, no Docker, no keys: the packages build and test with no
network.

## Commands

```bash
pnpm build / typecheck / test    # through Turborepo
pnpm check / check:fix           # Biome: format, lint, import order
pnpm verify                      # everything, before you push

pnpm repo:check                  # all rules: api, docs, invariants, vendors
pnpm repo:check vendors          # only the vendor-package house rules
pnpm api:snapshot                # record the public-surface snapshot
pnpm test:scripts                # tests for the validators themselves

pnpm changeset                   # open a changeset for a change
```

A single package: `pnpm --filter @deniscuciuc/maib test`
A single file: `pnpm exec vitest run packages/maib/src/amount.test.ts`

## Where things are

| Path | What |
| --- | --- |
| `packages/*` | The vendor packages. Everything here is published |
| `templates/vendor/` | The skeleton of a new package, with `__VENDOR__` placeholders |
| `scripts/repo-kit/` | The rule engine: api, docs and invariants rules, and the CLI |
| `scripts/rules/` | This repository's own rule, and tests for each way it fails |
| `repo-check.config.mjs` | The lists the rules read |
| `tsconfig.base.json`, `vitest.preset.ts`, `test-setup/` | The toolchain, as files rather than dependencies |
| `docs/vendors/` | A page per source: quotas, quirks, what to do when it fails |
| `docs/adr/` | Six decisions and their consequences |
| `docs/operations/` | Publishing, and how to add a vendor |

## The shape of a package

Identical across all four — that is the scaling mechanism:

```
packages/<vendor>/src/
├── index.ts        explicit re-exports, no export *
├── endpoints.ts    URLs; an API version or a _SPEC_CHECKED constant
├── transport.ts    the port + HTTP. The only file containing fetch
├── errors.ts       a kind enum, not text
└── <area>.ts       one file per area of the API
```

## What breaks the build

`fetch` outside `transport.ts` · `process.env` in `src/` · `export *` in `index.ts` · a
dependency on anything in the `@deniscuciuc` scope · a package without `README.md`, a page in
`docs/vendors/`, or `test/fixtures/` · a removed export without an updated snapshot · a broken
link in the markdown · an ADR with no `## Decision` section · a package whose licence is not MIT.

The reasons are in [AGENTS.md](AGENTS.md).

## Adding a vendor

The checklist is in
[docs/operations/adding-a-vendor.md](docs/operations/adding-a-vendor.md). In short: copy
`templates/vendor`, replace the placeholders, add a page in `docs/vendors/`, write the negative
tests, run `pnpm api:snapshot`, open a changeset.

A client is never written against a specification we do not have.

## Publishing

Two steps: the `Version` workflow opens a "Version Packages" pull request on a push to `main`,
and after it is merged the `Publish` workflow is started by hand and gated on the `npm`
environment.

The detail, including why the git identity matters,
is in [docs/operations/publishing.md](docs/operations/publishing.md).
