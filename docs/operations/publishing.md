# Publishing and installing

The packages are published to the public npm registry under the `@deniscuciuc` scope. Installing
one needs no registry configuration, no token and no `.npmrc` — that is the whole point of
publishing them publicly.

```bash
pnpm add @deniscuciuc/bnm
```

## How a package reaches the registry

Two steps, deliberately separate.

**1. A "Version Packages" pull request.** Every change that touches a published package needs a
changeset:

```bash
pnpm changeset
```

On a push to `main` the `Version` workflow runs `changeset version`, which raises versions and
writes each package's `CHANGELOG.md`, and opens or updates a pull request with the result.
Nothing is published at this stage, and opening a pull request is reversible.

**2. Publishing.** After that pull request is merged, the `Publish` workflow is started by hand:

```bash
gh workflow run publish.yml
```

It is gated on the `npm` GitHub environment, which has a required reviewer. Both the manual
start and the gate exist for the same reason: **a published version cannot be recalled fast
enough that nobody has installed it**, so "this version goes out" has to be its own decision.

Publishing uses `NPM_TOKEN` together with npm provenance, which needs `id-token: write` on the
publishing job. Provenance publishes a signed attestation linking the tarball to the workflow
run that produced it.

**Do not publish by hand from a local machine.** That is a rule rather than a technical
restriction: a local publish sends whatever is in the working directory to the registry,
uncommitted changes included.

### Versions

Each package is versioned independently: a vendor changes its API, one package goes major and
the other three are untouched.

What counts as a major is defined by
[ADR-0005](../adr/0005-the-vendors-api-version-is-part-of-the-package.md) (the vendor moving to
a new version) and by the `api` rule (an export removed or renamed).

### Tags and releases

`changeset publish` creates the tags, and the workflow pushes them and creates a GitHub Release
per tag from that package's changelog section.

The workflow sets a git identity before publishing, and that is not cosmetic: `changeset
publish` creates its tags with `git tag <name> -m <name>` — an annotated tag, which needs a
committer. Without an identity the command fails, changesets does not check its exit code, and
the log is left with a cheerful `New tag:` and no tag at all. After a release, check the
repository rather than the log.

### The changelog needs a token locally

`.changeset/config.json` uses `@changesets/changelog-github`, which calls the GitHub API while
versioning to turn commits into links to their pull request and author. In CI the workflow
already provides `GITHUB_TOKEN`. Running it locally needs one too:

```bash
GITHUB_TOKEN=$(gh auth token) pnpm changeset version
```

## Rolling back

A published version is not deleted — it is superseded. Unpublishing is technically possible, but
anyone who already installed it and wrote it into a lockfile gets a broken build instead of a
warning.

The correct rollback is to release a new version restoring the behaviour, and to say in the
changelog why.
