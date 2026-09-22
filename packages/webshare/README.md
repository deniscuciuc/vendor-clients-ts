# @deniscuciuc/webshare

An unofficial client for the [Webshare](https://www.webshare.io) API — subscription, plans,
proxy list, replacement and capacity.

Errors come back as a `Result` from `neverthrow` rather than the tagged unions the other
packages in this repository use. That inconsistency is deliberate: the code was written and
covered that way, and rewriting 900 working lines for the sake of uniformity would have been a
bad trade ([ADR-0006](../../docs/adr/0006-two-error-conventions-beat-one-rewrite.md)). You do
not have to adopt `neverthrow` in your own code — `.match()` is enough.

```bash
pnpm add @deniscuciuc/webshare
```

Not affiliated with or endorsed by Webshare.

## How to use it

```ts
import { createWebshareClient } from '@deniscuciuc/webshare'

const webshare = createWebshareClient({ apiKey })
const proxies = await webshare.listProxies()

proxies.match(
  (page) => page.results.forEach(use),
  (error) => log.warn({ error }, 'Webshare is unavailable'),
)
```

Capacity and pricing live in a separate client, `createWebshareCapacityClient`: those endpoints
have their own response model and their own set of errors.

## What is worth knowing

| | |
| --- | --- |
| Two clients | The main one covers subscription, plans, proxies and replacements. The capacity one covers available resources and price calculation |
| Errors | A `Result` from `neverthrow`, not exceptions and not the tagged unions used in the other packages |
| Schemas | Responses are validated with zod at the boundary; an invalid response is an error, not a partially parsed object |
| Authentication | An API key, passed as an argument. The package does not read the environment |
| Timestamps | Webshare returns **microseconds**, not milliseconds. A schema written for the familiar format passes every inline test and fails on the first live response |
| `WebsharePlanUsage` | Traffic usage for a plan. The fields describe a Webshare response, not anyone's application domain |

More about the source in [docs/vendors/webshare.md](../../docs/vendors/webshare.md).

## Licence

[MIT](LICENSE). Part of [vendor-clients-ts](https://github.com/deniscuciuc/vendor-clients-ts).
