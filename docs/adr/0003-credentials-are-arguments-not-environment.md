# ADR-0003. Credentials arrive as arguments, not from the environment

## Status

Accepted

## Context

The familiar shape for an application is to read a key from `process.env` where it is needed.
In an application that works: there is one environment, one schema of variables, and it is
validated at startup.

A package installed by five different applications stops being reusable in that shape: it
dictates variable names to its consumer, requires them to be present at import time, and makes
two clients with different keys in one process impossible.

## Decision

Not one `process.env` in a vendor package's `src/`. Credentials, URLs and timeouts arrive as
arguments to a constructor or a factory.

Enforced by `scripts/rules/vendors.mjs`.

## Consequences

The package does not know where it is deployed, and one process can hold two clients with
different keys — which is needed the day a second organization turns up with its own contract.

The schema of environment variables stays the application's business: it already validates it at
startup, and a second place where a variable is "required" would drift from the first.

The cost: composing a client becomes explicit work for the application — somewhere there must be
code that takes a key from configuration and passes it in here. That is the right place for such
code.
