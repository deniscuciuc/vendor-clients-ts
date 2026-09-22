# AGENTS.md

The canonical rulebook for this repository. On any disagreement with another file, this one
wins.

Orientation and commands are in [CLAUDE.md](CLAUDE.md). For a human reader,
[README.md](README.md).

---

## 1. What this repository is

Unofficial clients for vendor APIs that ship none of their own. Nothing of anyone's domain: no
organizations, no tenants, no business rules.

A package from here installs into an application as an ordinary dependency and drags nothing
behind it. The adapter wiring a client to an application's ports lives **in the application**,
not here.

## 2. Sources of truth

| What | Where | Rule |
| --- | --- | --- |
| The shape of a vendor's API | The vendor's published specification | The link and the check date go in `docs/vendors/<name>.md` |
| Which version we are looking at | `src/endpoints.ts` | Either a version segment in the URL or a dated `_SPEC_CHECKED` constant |
| A package's public surface | `src/index.ts` | Explicit re-exports. The snapshot is `api.snapshot.json` |
| What exists in the repository at all | [docs/vendors/README.md](docs/vendors/README.md) | Including what is absent, and why |

## 3. Conventions that are not up for discussion

**A package depends on nothing of ours.** Not on an application, not on a neighbouring vendor
package, and not even in `devDependencies` — the shared TypeScript configuration and the Vitest
preset are files in this repository. Twenty duplicated lines of `Result` across several packages
is the right side to err on
([ADR-0001](docs/adr/0001-a-vendor-package-depends-on-nothing-of-ours.md)).

**The transport is a port.** The only file containing `fetch` is `transport.ts`. Everything that
makes a decision lives above it and is tested by substituting a fake
([ADR-0002](docs/adr/0002-the-transport-is-a-port.md)).

**Credentials arrive as arguments.** Not one `process.env` in `src/`. A package does not know
where it is deployed ([ADR-0003](docs/adr/0003-credentials-are-arguments-not-environment.md)).

**A test does not reach the network.** `globalThis.fetch` is replaced by a throwing stub in the
shared setup, by plain assignment rather than `vi.stubGlobal` so that restoring can never hand
back the real `fetch`
([ADR-0004](docs/adr/0004-a-test-that-reaches-the-network-is-a-test-that-lies.md)).

**A vendor's API version is part of the package.** A vendor's `v2` is a new major, not an edit
to a constant ([ADR-0005](docs/adr/0005-the-vendors-api-version-is-part-of-the-package.md)).

**Errors.** New packages return tagged unions `{ ok: true, value } | { ok: false, error }`,
where `kind` is an enum rather than text. `webshare` stayed on `neverthrow`
([ADR-0006](docs/adr/0006-two-error-conventions-beat-one-rewrite.md)).

**Exceptions are for a defect in the caller.** Non-integer bani, a non-ISO date: that is fixed
by editing code. Hiding it in a result branch lets it survive to production.

**Everything that arrived over the network is validated before it becomes a type.** A cast here
would mean confidence in a response we did not write.

**English everywhere.** Comments, test names, the messages the code prints, and all
documentation.

**Publishing happens only from a workflow.** By hand from a local machine: never.

**The package that does not exist.** A client written against a specification nobody gave us is
fiction, and it compiles. No specification, no package.

## 4. What an agent does without asking

- Writes negative tests: a malformed response, a non-2xx, a timeout, an unknown enum value, and
  where a signature exists, the four forgery cases. Code without a failing test is useless
- Puts recorded fixtures in `test/fixtures/`
- Opens a changeset for every change that touches a published package
- Updates `api.snapshot.json` when an export is added

## 5. What an agent must ask a human about

- A new vendor package
- Changing a vendor's base URL or API version
- Removing or renaming an export of a published package
- Publishing a package
- Adding a dependency that will land in a consumer's dependency tree

## 6. What an agent never does

- Does not write a client against a specification we do not have
- Does not read `process.env` inside `src/`
- Does not reach the network from a test
- Does not add a dependency on anything of ours
- Does not publish by hand from a local machine
- Does not silently truncate what did not fit someone else's field — it refuses and says why
- Does not put domain concepts in a package: an organization, a tenant, an invoice, a device

## 7. Definition of done for a new package

- [ ] The same shape as the others: `index`, `endpoints`, `transport`, `errors`, one file per area
- [ ] `transport.ts` is the only place with `fetch`
- [ ] Credentials as arguments; no `process.env`
- [ ] A version in the URL, or `_SPEC_CHECKED` with a date
- [ ] Negative tests, timeout and non-2xx included
- [ ] `test/fixtures/` with recorded responses
- [ ] The package's `README.md` and `docs/vendors/<name>.md`
- [ ] `LICENSE` copied into the package directory
- [ ] `pnpm api:snapshot`
- [ ] A changeset
- [ ] `pnpm verify` green

Step by step: [docs/operations/adding-a-vendor.md](docs/operations/adding-a-vendor.md).

## 8. Anti-patterns

| Do not | Why |
| --- | --- |
| Depend on anything of ours from a vendor package | Brings back the version coordination this whole thing exists to avoid |
| `export *` in `index.ts` | The API snapshot has nothing to compare, and a breaking change rides out in a minor version |
| `fetch` outside `transport.ts` | "Pass a fake transport" stops being true, and a test starts depending on the vendor being alive |
| Read `process.env` | The package learns where it is deployed and stops being usable anywhere else |
| A live call in a test | Green until the day the vendor has planned maintenance, then failing quietly about someone else's code |
| A `Result` where the caller has a defect | A branch you hide a programmer's error in survives to production |
| An empty result instead of "there is no data" | "The bank did not publish" and "we could not read it" call for different actions |
| Silently truncating a value to someone else's limit | A shortened identifier is a payment with nothing to reconcile it against |
| Dividing money as floats | Correct for almost every value and wrong for a few — the few that reach support |
| An error string instead of an enum | Branching on a substring is branching on the language of the message |
| Source maps in a tarball with no sources | Go-to-definition breaks silently instead of being absent |
| A domain type in a vendor package | Drags a foreign domain behind it for the sake of one interface |
| A shared package for the sake of thirty lines | Kills the defining property: any package publishes on its own |

## 9. Glossary

**SDK** — what this is. A client for someone else's API, knowing nothing about any application.

**Adapter** — what this is not. A class in an application wiring an SDK to an application port:
`MaibProvider implements PaymentProvider` lives in the application, not here.

**Port** — an interface whose implementation is substituted. In every package that is at least
`Transport`.

**Fixture** — a recorded vendor response in `test/fixtures/`. The only source of
network-shaped data in the tests.

**API snapshot** — `api.snapshot.json`, the list of exported names. Removing a name fails the
build and requires a major version.
