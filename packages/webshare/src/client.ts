import { err, ok, type Result } from 'neverthrow'
import type { z } from 'zod'
import { WEBSHARE_BACKBONE_HOST, webshareEndpoints } from './endpoints.js'
import {
  websharePlansPageSchema,
  webshareProxyPageSchema,
  webshareReplacedProxyPageSchema,
  webshareReplacementSchema,
  webshareSubscriptionSchema,
} from './schemas.js'

export type WebshareEndpoint =
  | 'subscription'
  | 'plans'
  | 'proxy_list'
  | 'replacement'
  | 'replaced_proxy_list'

export interface WebshareClientError {
  readonly code:
    | 'authentication_failed'
    | 'payment_required'
    | 'rate_limited'
    | 'provider_http_error'
    | 'provider_unavailable'
    | 'invalid_response'
    | 'unsafe_pagination'
  readonly endpoint: WebshareEndpoint
  readonly retryable: boolean
  readonly status?: number | undefined
}

export interface WebshareSubscription {
  readonly id: string
  readonly activePlanId: string | null
  readonly term: 'monthly' | 'yearly'
  readonly startDate: string
  readonly endDate: string
  readonly renewalsEnabled: boolean
  readonly paused: boolean
  readonly throttled: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

export interface WebsharePlan {
  readonly id: string
  readonly status: 'active' | 'cancelled'
  readonly bandwidthLimitGb: number
  readonly proxyType: 'free' | 'shared' | 'semidedicated' | 'dedicated'
  readonly proxySubtype: 'default' | 'premium' | 'isp' | 'residential' | 'datacenter_and_isp'
  readonly proxyCount: number
  readonly proxyCountries: Readonly<Record<string, number>>
  readonly requiredSiteChecks: readonly string[]
  readonly refreshTotal: number
  readonly refreshUsed: number
  readonly refreshAvailable: number
  readonly replacementTotal: number
  readonly replacementUsed: number
  readonly replacementAvailable: number
  readonly createdAt: string
  readonly updatedAt: string
}

export interface WebshareProxyConnection {
  readonly providerObjectId: string
  readonly username: string
  readonly password: string
  readonly host: string
  readonly port: number
  readonly valid: boolean
  readonly countryCode: string | null
}

export interface WebshareProxyReplacement {
  readonly id: string
  readonly state: 'validating' | 'validated' | 'processing' | 'completed' | 'failed'
  readonly proxiesRemoved: number | null
  readonly proxiesAdded: number | null
}

export interface WebshareReplacedProxy {
  readonly previousAddress: string
  readonly replacementAddress: string
}

interface WebshareClientOptions {
  readonly apiKey: string
  readonly fetchImpl?: typeof fetch | undefined
  readonly requestTimeoutMs?: number | undefined
  readonly wait?: ((milliseconds: number) => Promise<void>) | undefined
  readonly retryPolicy?:
    | {
        readonly maximumAttempts: number
        readonly baseDelayMs: number
      }
    | undefined
  readonly observeRequest?:
    | ((observation: {
        readonly endpoint: WebshareEndpoint
        readonly outcome: 'succeeded' | 'failed' | 'retried'
        readonly status: number | null
        readonly durationMs: number
      }) => void)
    | undefined
}

const retryableStatus = (status: number): boolean => status === 429 || status >= 500

const httpError = (endpoint: WebshareEndpoint, status: number): WebshareClientError => ({
  code:
    status === 401 || status === 403
      ? 'authentication_failed'
      : status === 402
        ? 'payment_required'
        : status === 429
          ? 'rate_limited'
          : 'provider_http_error',
  endpoint,
  retryable: retryableStatus(status),
  status,
})

const invalidResponse = (endpoint: WebshareEndpoint): WebshareClientError => ({
  code: 'invalid_response',
  endpoint,
  retryable: false,
})

const assertSafePaginationUrl = (
  endpoint: WebshareEndpoint,
  next: string,
  first: URL,
): Result<URL, WebshareClientError> => {
  const candidate = new URL(next)
  if (
    first.protocol !== 'https:' ||
    candidate.protocol !== 'https:' ||
    candidate.origin !== first.origin ||
    !candidate.pathname.startsWith(first.pathname)
  ) {
    return err({ code: 'unsafe_pagination', endpoint, retryable: false })
  }
  return ok(candidate)
}

export const createWebshareClient = (options: WebshareClientOptions) => {
  const fetchImpl = options.fetchImpl ?? fetch
  const wait =
    options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)))
  const retryPolicy = options.retryPolicy ?? { maximumAttempts: 3, baseDelayMs: 1_000 }

  const requestJson = async <T extends z.ZodTypeAny>(
    endpoint: WebshareEndpoint,
    url: URL,
    schema: T,
    init?: RequestInit,
    allowRetry = true,
  ): Promise<Result<z.infer<T>, WebshareClientError>> => {
    for (let attempt = 1; attempt <= retryPolicy.maximumAttempts; attempt++) {
      const startedAt = Date.now()
      try {
        const response = await fetchImpl(url.toString(), {
          ...init,
          headers: {
            Authorization: `Token ${options.apiKey}`,
            ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          signal: AbortSignal.timeout(options.requestTimeoutMs ?? 15_000),
        })
        if (!response.ok) {
          const failure = httpError(endpoint, response.status)
          if (allowRetry && failure.retryable && attempt < retryPolicy.maximumAttempts) {
            options.observeRequest?.({
              endpoint,
              outcome: 'retried',
              status: response.status,
              durationMs: Math.max(0, Date.now() - startedAt),
            })
            const retryAfter = Number(response.headers.get('retry-after'))
            await wait(
              response.status === 429 && Number.isFinite(retryAfter) && retryAfter >= 0
                ? retryAfter * 1_000
                : retryPolicy.baseDelayMs * 2 ** (attempt - 1),
            )
            continue
          }
          options.observeRequest?.({
            endpoint,
            outcome: 'failed',
            status: response.status,
            durationMs: Math.max(0, Date.now() - startedAt),
          })
          return err(failure)
        }
        const parsed = schema.safeParse(await response.json())
        if (!parsed.success) return err(invalidResponse(endpoint))
        options.observeRequest?.({
          endpoint,
          outcome: 'succeeded',
          status: response.status,
          durationMs: Math.max(0, Date.now() - startedAt),
        })
        return ok(parsed.data)
      } catch {
        if (allowRetry && attempt < retryPolicy.maximumAttempts) {
          options.observeRequest?.({
            endpoint,
            outcome: 'retried',
            status: null,
            durationMs: Math.max(0, Date.now() - startedAt),
          })
          await wait(retryPolicy.baseDelayMs * 2 ** (attempt - 1))
          continue
        }
        return err({ code: 'provider_unavailable', endpoint, retryable: true })
      }
    }
    return err({ code: 'provider_unavailable', endpoint, retryable: true })
  }

  const readPages = async <T extends z.ZodTypeAny>(input: {
    readonly endpoint: WebshareEndpoint
    readonly first: URL
    readonly schema: T
    readonly maximumResults?: number | undefined
  }): Promise<Result<readonly z.infer<T>['results'][number][], WebshareClientError>> => {
    const values: z.infer<T>['results'][number][] = []
    let next: URL | null = input.first
    for (let page = 1; page <= 100 && next !== null; page++) {
      const response = await requestJson(input.endpoint, next, input.schema)
      if (response.isErr()) return err(response.error)
      values.push(...response.value.results)
      if (input.maximumResults !== undefined && values.length >= input.maximumResults) {
        return ok(values.slice(0, input.maximumResults))
      }
      if (response.value.next === null) next = null
      else {
        const safe = assertSafePaginationUrl(input.endpoint, response.value.next, input.first)
        if (safe.isErr()) return err(safe.error)
        next = safe.value
      }
    }
    if (next !== null)
      return err({ code: 'unsafe_pagination', endpoint: input.endpoint, retryable: false })
    return ok(values)
  }

  const normalizeReplacement = (
    value: z.infer<typeof webshareReplacementSchema>,
  ): WebshareProxyReplacement => ({
    id: String(value.id),
    state: value.state,
    proxiesRemoved: value.proxies_removed ?? null,
    proxiesAdded: value.proxies_added ?? null,
  })

  return {
    getSubscription: async (): Promise<Result<WebshareSubscription, WebshareClientError>> => {
      const response = await requestJson(
        'subscription',
        new URL(webshareEndpoints.subscription),
        webshareSubscriptionSchema,
      )
      if (response.isErr()) return err(response.error)
      const value = response.value
      return ok({
        id: String(value.id),
        activePlanId: value.plan === null ? null : String(value.plan),
        term: value.term,
        startDate: value.start_date,
        endDate: value.end_date,
        renewalsEnabled: value.renewals_enabled,
        paused: value.paused,
        throttled: value.throttled,
        createdAt: value.created_at,
        updatedAt: value.updated_at,
      })
    },
    listPlans: async (): Promise<Result<readonly WebsharePlan[], WebshareClientError>> => {
      const first = new URL(webshareEndpoints.plans)
      first.searchParams.set('page', '1')
      first.searchParams.set('page_size', '100')
      const response = await readPages({
        endpoint: 'plans',
        first,
        schema: websharePlansPageSchema,
      })
      if (response.isErr()) return err(response.error)
      return ok(
        response.value.map((value) => ({
          id: String(value.id),
          status: value.status,
          bandwidthLimitGb: value.bandwidth_limit,
          proxyType: value.proxy_type,
          // Webshare can return Rotating Residential bundles as shared/default and exposes the
          // runtime pool through pool_filter. The provider requires backbone mode for this value:
          // https://apidocs.webshare.io/proxy-list/download
          proxySubtype: value.pool_filter === 'residential' ? 'residential' : value.proxy_subtype,
          proxyCount: value.proxy_count,
          proxyCountries: value.proxy_countries,
          requiredSiteChecks: value.required_site_checks,
          refreshTotal: value.on_demand_refreshes_total,
          refreshUsed: value.on_demand_refreshes_used,
          refreshAvailable: value.on_demand_refreshes_available,
          replacementTotal: value.proxy_replacements_total,
          replacementUsed: value.proxy_replacements_used,
          replacementAvailable: value.proxy_replacements_available,
          createdAt: value.created_at,
          updatedAt: value.updated_at,
        })),
      )
    },
    listProxyConnections: async (input: {
      readonly planId: string
      readonly mode: 'direct' | 'backbone'
      readonly countryCodes?: readonly string[] | undefined
      readonly maximumConnections?: number | undefined
    }): Promise<Result<readonly WebshareProxyConnection[], WebshareClientError>> => {
      const first = new URL(webshareEndpoints.proxyList)
      first.searchParams.set('mode', input.mode)
      first.searchParams.set('page', '1')
      first.searchParams.set(
        'page_size',
        String(
          input.maximumConnections === undefined
            ? 100
            : Math.max(1, Math.min(100, Math.floor(input.maximumConnections))),
        ),
      )
      first.searchParams.set('plan_id', input.planId)
      if (input.countryCodes !== undefined && input.countryCodes.length > 0) {
        first.searchParams.set('country_code__in', input.countryCodes.join(','))
      }
      const response = await readPages({
        endpoint: 'proxy_list',
        first,
        schema: webshareProxyPageSchema,
        maximumResults: input.maximumConnections,
      })
      if (response.isErr()) return err(response.error)
      const values: WebshareProxyConnection[] = []
      for (const value of response.value) {
        const host = input.mode === 'backbone' ? WEBSHARE_BACKBONE_HOST : value.proxy_address
        if (host === null) return err(invalidResponse('proxy_list'))
        const port = input.mode === 'backbone' ? 80 : value.port
        values.push({
          providerObjectId: (
            value.id ?? `${input.planId}.${input.mode}.${host}.${String(port)}`
          ).toLowerCase(),
          username: value.username,
          password: value.password,
          host,
          port,
          valid: value.valid ?? true,
          countryCode: value.country_code?.toUpperCase() ?? null,
        })
      }
      return ok(values)
    },
    createProxyReplacement: async (input: {
      readonly planId: string
      readonly ipAddresses: readonly string[]
      readonly dryRun: boolean
    }): Promise<Result<WebshareProxyReplacement, WebshareClientError>> => {
      const url = new URL(webshareEndpoints.replacements)
      url.searchParams.set('plan_id', input.planId)
      const response = await requestJson(
        'replacement',
        url,
        webshareReplacementSchema,
        {
          method: 'POST',
          body: JSON.stringify({
            to_replace: { type: 'ip_address', ip_addresses: input.ipAddresses },
            replace_with: [{ type: 'any', count: input.ipAddresses.length }],
            dry_run: input.dryRun,
          }),
        },
        false,
      )
      if (response.isErr()) return err(response.error)
      return ok(normalizeReplacement(response.value))
    },
    getProxyReplacement: async (input: {
      readonly planId: string
      readonly replacementId: string
    }): Promise<Result<WebshareProxyReplacement, WebshareClientError>> => {
      const url = new URL(`${input.replacementId}/`, webshareEndpoints.replacements)
      url.searchParams.set('plan_id', input.planId)
      const response = await requestJson('replacement', url, webshareReplacementSchema)
      return response.map(normalizeReplacement)
    },
    listReplacedProxies: async (input: {
      readonly planId: string
      readonly replacementId: string
    }): Promise<Result<readonly WebshareReplacedProxy[], WebshareClientError>> => {
      const first = new URL(webshareEndpoints.replacedProxyList)
      first.searchParams.set('proxy_list_replacement', input.replacementId)
      first.searchParams.set('page_size', '100')
      first.searchParams.set('plan_id', input.planId)
      const response = await readPages({
        endpoint: 'replaced_proxy_list',
        first,
        schema: webshareReplacedProxyPageSchema,
      })
      return response.map((values) =>
        values.map((value) => ({
          previousAddress: value.proxy,
          replacementAddress: value.replaced_with,
        })),
      )
    },
  }
}
