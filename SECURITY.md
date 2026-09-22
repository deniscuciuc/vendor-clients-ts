# Security Policy

## Reporting a Vulnerability

**Please do not open a public issue for a security vulnerability.**

Report it through GitHub's private vulnerability reporting, which is the preferred channel:

<https://github.com/deniscuciuc/vendor-clients-ts/security/advisories/new>

If you cannot use GitHub, email **denis@deniscuciuc.dev** instead.

Please include a description of the vulnerability and its impact, steps to reproduce or a
proof of concept, the affected package, and any suggested mitigation.

## What to Expect

| Stage | Target |
|---|---|
| Acknowledgement of your report | Within 48 hours |
| Initial assessment and severity triage | Within 5 working days |
| Fix released for a high or critical issue | Within 30 days of triage |
| Fix released for a moderate or low issue | Next scheduled release |

If you have not heard back within 48 hours, please follow up — an unanswered report usually
means it did not arrive.

## Supported Versions

| Version | Supported |
|---|---|
| 0.1.x   | Yes |
| < 0.1.0 | No  |

Each package is versioned independently, so a fix ships as a new patch of the affected package
only.

## Scope

In scope: the packages in this repository. The highest-value targets, roughly in order:

- **`@deniscuciuc/maib`, signature verification** — `parseCallback` decides whether an incoming
  callback is a genuine payment notification. Anything that makes it accept a body that was not
  signed with the given key, or that was altered after signing, is a vulnerability. So is
  anything that reintroduces a timing-variable comparison: the constant-time check and the
  length rejection before it are both load-bearing.
- **`@deniscuciuc/maib`, pre-network validation** — the amount and `orderId` checks. A silently
  truncated identifier produces a correctly signed callback that cannot be reconciled against
  an invoice.
- **`@deniscuciuc/webshare`, pagination guard** — `assertSafePaginationUrl` stops an
  attacker-controlled `next` URL in a response from redirecting a subsequent request, carrying
  the API key, to a host of the attacker's choosing.
- **Credential handling anywhere**, including whether a key or token can end up in a thrown
  error message or a log line.

Out of scope: vulnerabilities in `neverthrow`, `zod`, or in the vendor APIs themselves — report
those upstream, though we would still like to know so the version can be pinned or worked
around. The skeleton under `templates/` is also out of scope.

A note on what these packages are: they are **unofficial** clients, and `@deniscuciuc/maib` in
particular has never been run against a live acquirer. A report that it does not match maib's
real behaviour is valuable and welcome, but it is a correctness bug rather than a vulnerability
unless it has a security consequence.

## Dependency Advisories

There are two runtime dependencies in the entire repository, `neverthrow` and `zod`, both used
only by `@deniscuciuc/webshare`. The other three packages have none, which is deliberate
([ADR-0001](docs/adr/0001-a-vendor-package-depends-on-nothing-of-ours.md)) and is the main
reason the supply-chain surface here is small.

Dependabot is enabled for npm and GitHub Actions, CodeQL runs on every push to `main` and
weekly, and gitleaks scans the full history on every push and pull request.
