# Contributing

Thanks for taking an interest. This repository holds unofficial clients for vendor APIs that
publish none of their own, and the most useful contributions are usually the least glamorous:
a quirk you hit in production, a response shape that has changed, a negative test that was
missing.

## Prerequisites

Node 22 or newer and pnpm 11. Nothing else — no database, no Docker, no vendor credentials.

## Setup

```bash
pnpm install
pnpm verify
```

`verify` chains format and lint, type-checking, build, tests, the repository rules and the tests
for those rules. It is what CI runs, so a green `verify` locally means a green CI.

## Code style

Biome handles formatting, linting and import order; `pnpm check:fix` applies it. Commits follow
[Conventional Commits](https://www.conventionalcommits.org/) (`feat(maib): …`,
`fix(bnr): …`), which commitlint enforces on commit.

Comments, test names and error messages are in English. Keep a pull request to a single
concern.

## Architecture

Read [AGENTS.md](AGENTS.md) before a first change of any size — it is the rulebook, and it wins
over every other document. The short version:

- A package depends on nothing else in this repository. `Result` and `Transport` are duplicated
  per package on purpose ([ADR-0001](docs/adr/0001-a-vendor-package-depends-on-nothing-of-ours.md))
- `transport.ts` is the only file containing `fetch` ([ADR-0002](docs/adr/0002-the-transport-is-a-port.md))
- Credentials arrive as arguments; no `process.env` in `src/` ([ADR-0003](docs/adr/0003-credentials-are-arguments-not-environment.md))
- **No test reaches the network** ([ADR-0004](docs/adr/0004-a-test-that-reaches-the-network-is-a-test-that-lies.md))

Most of these are enforced by `pnpm repo:check`, so you will usually be told rather than
discover it at review.

## Tests

New behaviour and bug fixes need tests, and a bug fix should come with the test that fails
without it.

Vendor responses are exercised through recorded fixtures in each package's `test/fixtures/`.
If you are fixing a parsing bug, the most valuable thing you can add is the real response shape
that broke it — with anything identifying removed. The mandatory negative cases for a package
are listed in [docs/qa/test-strategy.md](docs/qa/test-strategy.md).

If a change touches a numbered invariant in that document, tag the test with `@invariant N`;
the `invariants` rule fails in both directions if you do not.

## Adding a vendor

There is a checklist and a working skeleton:
[docs/operations/adding-a-vendor.md](docs/operations/adding-a-vendor.md). Open an issue first —
a new package is a maintenance commitment, and the one rule that cannot be worked around is
that a client is never written against a specification nobody has.

## Pull requests

- A changeset is required for anything that changes a published package: `pnpm changeset`
- Note breaking changes explicitly; removing or renaming an export is a major, and the `api`
  rule will fail until the snapshot is updated deliberately with `pnpm api:snapshot`
- `pnpm verify` must be green

## Releasing

Maintainers only, and in two steps: the `Version` workflow opens a "Version Packages" pull
request, and after it is merged the `Publish` workflow is started by hand behind a required
review. See [docs/operations/publishing.md](docs/operations/publishing.md).

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Security issues go through
[SECURITY.md](SECURITY.md) rather than a public issue.
