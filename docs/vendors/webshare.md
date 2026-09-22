# Webshare

Proxies: subscription, plans, address list, replacement and capacity.

| | |
| --- | --- |
| Package | `@deniscuciuc/webshare` |
| URL | `https://proxy.webshare.io/api/...` |
| Documentation | apidocs.webshare.io |
| Version | Per endpoint: proxy replacement on `v3`, the rest on `v2`. There is no single version; checked on `WEBSHARE_SPEC_CHECKED` |
| Authentication | An API key, passed as an argument |
| Cost | Paid, by plan and traffic |
| Backbone | `p.webshare.io` — the host the proxies themselves run through |

## Quirks

**Two clients, not one.** `createWebshareClient` covers subscription, plans, the proxy list and
replacements. `createWebshareCapacityClient` covers available resources and price calculation.
They have different response models and different error sets, and forcing them into one
interface would produce a union in which half the fields are always empty.

**Versions are mixed.** `v2` almost everywhere, `v3` for proxy replacement. That is their
decision, not ours; the package stores URLs per endpoint and does not pretend the API has a
single version.

**Timestamps are in microseconds.** Six digits of fractional second, not three. A schema written
for the familiar millisecond format passes every inline test and fails on the first live
response — which is why there is a fixture test reading a recorded document rather than an
inline one.

**Errors through `neverthrow`.** The only package in this repository that does this. Rewriting
900 test-covered lines for the sake of uniformity is a bad trade
([ADR-0006](../adr/0006-two-error-conventions-beat-one-rewrite.md)). You do not have to adopt
`neverthrow` in your own code: `.match()` is enough.

**zod schemas at the boundary.** A response that fails its schema is an error, not a partially
parsed object. For a paid API with shifting endpoints that is the difference between "a field
disappeared" and "a field became `undefined` in three places further down the stack".

**Traffic is a paid resource.** `WebsharePlanUsage` gives the remaining allowance on a plan.

## When it fails

A proxy provider that has stopped answering means collection stops, not that data is lost. The
client already retries internally; an error reaching the outside means the retries ran out.

Worth watching separately: the remaining traffic allowance. An exhausted plan looks like proxy
failures rather than an API failure, and people start looking for the cause in the wrong place.
