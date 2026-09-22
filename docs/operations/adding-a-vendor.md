# How to add a vendor

The most important document in the repository: everything else describes what already exists,
this describes how the next thing appears. A fifth package will drift away from the four not out
of malice but because the template gets copied while the rules get read once. Hence a checklist
here, and a linter next to it checking the same things.

## Before you start

**The specification must exist and we must have it.** A client written against documentation
nobody gave us is fiction, and it compiles.

**Check that this is a vendor package.** If it needs to know about an organization, a tenant, an
invoice or a tender, it is not a vendor package. That belongs in the application.

## Steps

### 1. The skeleton

```bash
cp -r templates/vendor packages/<name>
```

Replace `__VENDOR__` (lower case, the package name) and `__Vendor__` (for types) in every file
and in the file names. Fill in `description`, `repository.directory`, keywords, and version
`0.1.0`. Copy `LICENSE` in from the repository root.

### 2. The source page

`docs/vendors/<name>.md`, following its neighbours. What the API is, a link to the spec and the
date it was checked, authentication, cost, quotas, **quirks**, and what to do when it fails.

The quirks are the most valuable part and the only one that cannot be reconstructed by reading
the code: in a year nobody will remember that maib's `orderId` is exactly 36 characters, that
BNR serves Friday's rates on a Monday, or that Webshare returns microseconds.

Add a row to the table in [docs/vendors/README.md](../vendors/README.md).

### 3. URLs and version

`src/endpoints.ts`: the base URL and the paths. Either a version segment in the URL or a
`<VENDOR>_SPEC_CHECKED` constant holding the check date — see
[ADR-0005](../adr/0005-the-vendors-api-version-is-part-of-the-package.md).

### 4. The transport

`src/transport.ts` — the port and its HTTP implementation. **The only file containing `fetch`.**
`AbortSignal.timeout` is mandatory: a vendor that stopped answering must not hold the caller.

A non-2xx throws a typed error carrying the status, so the client can tell it from a dropped
connection.

### 5. Parsing and the client

One file per area of the API. Everything that arrived over the network is validated before it
becomes a type. Errors are a tagged union with a `kind` enum
([ADR-0006](../adr/0006-two-error-conventions-beat-one-rewrite.md)).

Credentials arrive as arguments. Not one `process.env`.

### 6. Fixtures and tests

`test/fixtures/` — recorded vendor responses.

The mandatory minimum of negative cases:

- a malformed or incomplete response
- a non-2xx
- a timeout or a dropped connection
- an unknown enum value
- where a signature exists — four cases: the wrong key, a body altered after signing, no
  signature, a signature of the wrong length
- where arithmetic exists — the boundary values. The multiplier, zero, negative

Plus the "the network is unreachable without an explicit stub" test: it guards the stub itself.

### 7. The surface

`src/index.ts` — explicit re-exports, no `export *`. Then:

```bash
pnpm api:snapshot
```

### 8. The package README

Installation, ten lines of example, a "what is worth knowing" table, a link to the source page,
and a licence line. This is the page npm renders, so say plainly that the client is unofficial.

### 9. Changeset and verification

```bash
pnpm changeset
pnpm verify
```

## What the linter will catch

`pnpm repo:check vendors` will not let through:

- a dependency on anything in the `@deniscuciuc` scope, `devDependencies` included
- `process.env` in `src/`
- `fetch` outside `transport.ts`
- `export *` in `index.ts`
- neither a version in the URL nor a `_SPEC_CHECKED` constant
- a missing `README.md`, `docs/vendors/<name>.md` or `test/fixtures/`
- a manifest without `description`, `files`, `exports`, `publishConfig.access: "public"`,
  `repository.directory`, or with a licence other than MIT
- a package name that does not match its folder

`pnpm repo:check api` will not let through a removed or renamed export.

`pnpm repo:check docs` will not let through a broken link or an ADR with no decision.

The full list of rules and the reasons behind them is in [AGENTS.md](../../AGENTS.md).
