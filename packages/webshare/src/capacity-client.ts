import { err, ok, type Result } from 'neverthrow'
import type { z } from 'zod'
import {
  webshareAggregateStatsSchema,
  webshareAvailableAssetsSchema,
  webshareCapacityPlanSchema,
  webshareCapacityPlansPageSchema,
  webshareCapacitySubscriptionSchema,
  websharePricingSchema,
} from './capacity-schemas.js'
import { webshareEndpoints } from './endpoints.js'
import type { WebsharePlanUsage } from './plan-usage.js'

export type WebshareCapacityEndpoint =
  | 'subscription'
  | 'plan_discovery'
  | 'plan_details'
  | 'plan_usage'
  | 'available_assets'
  | 'pricing_quote'

export interface WebshareCapacityClientError {
  readonly code:
    | 'authentication_failed'
    | 'rate_limited'
    | 'provider_http_error'
    | 'provider_unavailable'
    | 'invalid_response'
  readonly endpoint: WebshareCapacityEndpoint
  readonly retryable: boolean
  readonly status?: number | undefined
}

export interface WebshareCapacityPlanDetails {
  readonly planId: string
  readonly status: 'active' | 'cancelled'
  readonly bandwidthLimitGb: number | null
  readonly bandwidthUnlimited: boolean
  readonly monthlyPriceUsd: number
  readonly yearlyPriceUsd: number
  readonly proxyType: 'free' | 'shared' | 'semidedicated' | 'dedicated'
  readonly proxySubtype: 'default' | 'premium' | 'isp' | 'residential' | 'datacenter_and_isp'
  readonly proxyCount: number
  readonly proxyCountries: Readonly<Record<string, number>>
}

export interface WebshareCapacitySubscription {
  readonly activePlanId: string | null
  readonly term: 'monthly' | 'yearly'
  readonly periodStartAt: string
  readonly periodEndAt: string
}

export interface WebshareAvailableAsset {
  readonly proxyType: string
  readonly proxySubtype: string
  readonly totalSubnets: number
  readonly availableCountries: Readonly<Record<string, number>>
}

export interface WebsharePricingQuoteInput {
  readonly proxyType: 'free' | 'shared' | 'semidedicated' | 'dedicated'
  readonly proxySubtype: 'default' | 'premium' | 'isp' | 'residential' | 'datacenter_and_isp'
  readonly proxyCountries: Readonly<Record<string, number>>
  readonly proxyCount: number
  readonly bandwidthLimitGb: number
  readonly term: 'monthly' | 'yearly'
  readonly planId?: string | undefined
}

export interface WebsharePricingQuote {
  readonly discountPercentage: number
  readonly nonDiscountedPriceUsd: number
  readonly priceUsd: number
  readonly paidTodayUsd: number
  readonly creditsAddedUsd: number
  readonly creditsUsedUsd: number
  readonly promoDiscountUsd: number
}

interface WebshareCapacityLogger {
  info(fields: Readonly<Record<string, unknown>>, message: string): void
  warn(fields: Readonly<Record<string, unknown>>, message: string): void
  error(fields: Readonly<Record<string, unknown>>, message: string): void
}

export interface WebshareCapacityClientConfig {
  readonly apiKey: string
  readonly requestTimeoutMs?: number | undefined
}

const errorForStatus = (
  endpoint: WebshareCapacityEndpoint,
  status: number,
): WebshareCapacityClientError => ({
  code:
    status === 401 || status === 403
      ? 'authentication_failed'
      : status === 429
        ? 'rate_limited'
        : 'provider_http_error',
  endpoint,
  retryable: status === 429 || status >= 500,
  status,
})

const invalidResponse = (endpoint: WebshareCapacityEndpoint): WebshareCapacityClientError => ({
  code: 'invalid_response',
  endpoint,
  retryable: false,
})

const planDetails = (
  value: z.infer<typeof webshareCapacityPlanSchema>,
): WebshareCapacityPlanDetails => {
  const bandwidthUnlimited = value.bandwidth_limit === 0
  return {
    planId: String(value.id),
    status: value.status,
    bandwidthLimitGb: bandwidthUnlimited ? null : value.bandwidth_limit,
    bandwidthUnlimited,
    monthlyPriceUsd: value.monthly_price,
    yearlyPriceUsd: value.yearly_price,
    proxyType: value.proxy_type,
    proxySubtype: value.proxy_subtype,
    proxyCount: value.proxy_count,
    proxyCountries: value.proxy_countries,
  }
}

export const createWebshareCapacityClient = (options: {
  readonly config: WebshareCapacityClientConfig
  readonly fetchImpl?: typeof fetch | undefined
  readonly logger: WebshareCapacityLogger
  readonly now?: (() => Date) | undefined
}) => {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.config.requestTimeoutMs ?? 15_000
  const now = options.now ?? (() => new Date())

  const requestJson = async <T>(
    endpoint: WebshareCapacityEndpoint,
    url: URL,
    schema: z.ZodType<T>,
  ): Promise<Result<T, WebshareCapacityClientError>> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(url.toString(), {
        method: 'GET',
        headers: { Authorization: `Token ${options.config.apiKey}` },
        signal: controller.signal,
      })
      if (!response.ok) {
        const mapped = errorForStatus(endpoint, response.status)
        options.logger.error(
          {
            endpoint: mapped.endpoint,
            code: mapped.code,
            status: mapped.status,
            retryable: mapped.retryable,
          },
          'webshare.capacity_request_failed',
        )
        return err(mapped)
      }
      let body: unknown
      try {
        body = await response.json()
      } catch {
        const mapped = invalidResponse(endpoint)
        options.logger.error(
          { endpoint: mapped.endpoint, code: mapped.code, retryable: mapped.retryable },
          'webshare.capacity_request_failed',
        )
        return err(mapped)
      }
      const parsed = schema.safeParse(body)
      if (!parsed.success) {
        const mapped = invalidResponse(endpoint)
        options.logger.error(
          { endpoint: mapped.endpoint, code: mapped.code, retryable: mapped.retryable },
          'webshare.capacity_request_failed',
        )
        return err(mapped)
      }
      return ok(parsed.data)
    } catch {
      const mapped = {
        code: 'provider_unavailable',
        endpoint,
        retryable: true,
      } as const
      options.logger.error(mapped, 'webshare.capacity_request_failed')
      return err(mapped)
    } finally {
      clearTimeout(timeout)
    }
  }

  const getPlanDetails = async (input: {
    readonly planId: string
  }): Promise<Result<WebshareCapacityPlanDetails, WebshareCapacityClientError>> => {
    const result = await requestJson(
      'plan_details',
      new URL(`${encodeURIComponent(input.planId)}/`, webshareEndpoints.plans),
      webshareCapacityPlanSchema,
    )
    return result.map(planDetails)
  }

  return {
    getSubscription: async (): Promise<
      Result<WebshareCapacitySubscription, WebshareCapacityClientError>
    > => {
      const result = await requestJson(
        'subscription',
        new URL(webshareEndpoints.subscription),
        webshareCapacitySubscriptionSchema,
      )
      return result.map((subscription) => ({
        activePlanId: subscription.plan === null ? null : String(subscription.plan),
        term: subscription.term,
        periodStartAt: subscription.start_date,
        periodEndAt: subscription.end_date,
      }))
    },
    listPlans: async (): Promise<
      Result<readonly WebshareCapacityPlanDetails[], WebshareCapacityClientError>
    > => {
      const first = new URL(webshareEndpoints.plans)
      first.searchParams.set('page', '1')
      first.searchParams.set('page_size', '100')
      let next: URL | null = first
      const plans: WebshareCapacityPlanDetails[] = []
      while (next !== null) {
        const current: URL = next
        const result = await requestJson('plan_discovery', current, webshareCapacityPlansPageSchema)
        if (result.isErr()) return err(result.error)
        plans.push(...result.value.results.map(planDetails))
        if (result.value.next === null) {
          next = null
        } else {
          const candidate = new URL(result.value.next)
          if (
            candidate.protocol !== 'https:' ||
            candidate.origin !== first.origin ||
            !candidate.pathname.startsWith(first.pathname)
          ) {
            return err({
              code: 'invalid_response',
              endpoint: 'plan_discovery',
              retryable: false,
            })
          }
          next = candidate
        }
      }
      return ok(plans)
    },
    getPlanDetails,
    getPlanUsage: async (input: {
      readonly planId: string
      readonly periodStartAt?: string | undefined
      readonly periodEndAt?: string | undefined
    }): Promise<Result<WebsharePlanUsage, WebshareCapacityClientError>> => {
      const planResult = await getPlanDetails({ planId: input.planId })
      if (planResult.isErr()) return err(planResult.error)
      const url = new URL(webshareEndpoints.aggregateStats)
      url.searchParams.set('plan_id', input.planId)
      if (input.periodStartAt !== undefined) {
        url.searchParams.set('timestamp__gte', input.periodStartAt)
      }
      if (input.periodEndAt !== undefined) {
        url.searchParams.set('timestamp__lte', input.periodEndAt)
      }
      const statsResult = await requestJson('plan_usage', url, webshareAggregateStatsSchema)
      if (statsResult.isErr()) return err(statsResult.error)
      const bandwidthUsedGb = statsResult.value.bandwidth_total / 1_000_000_000
      return ok({
        planId: input.planId,
        bandwidthLimitGb: planResult.value.bandwidthLimitGb,
        bandwidthUnlimited: planResult.value.bandwidthUnlimited,
        bandwidthUsedGb,
        bandwidthRemainingGb:
          planResult.value.bandwidthLimitGb === null
            ? null
            : Math.max(0, planResult.value.bandwidthLimitGb - bandwidthUsedGb),
        observedAt: now().toISOString(),
      })
    },
    getAvailableAssets: async (): Promise<
      Result<readonly WebshareAvailableAsset[], WebshareCapacityClientError>
    > => {
      const result = await requestJson(
        'available_assets',
        new URL(webshareEndpoints.availableAssets),
        webshareAvailableAssetsSchema,
      )
      return result.map((assets) =>
        Object.entries(assets).flatMap(([proxyType, subtypes]) =>
          Object.entries(subtypes).map(([proxySubtype, asset]) => ({
            proxyType,
            proxySubtype,
            totalSubnets: asset.total_subnets,
            availableCountries: asset.available_countries,
          })),
        ),
      )
    },
    quotePricing: async (
      input: WebsharePricingQuoteInput,
    ): Promise<Result<WebsharePricingQuote, WebshareCapacityClientError>> => {
      const url = new URL(webshareEndpoints.pricing)
      url.searchParams.set(
        'query',
        JSON.stringify({
          behavior: 'add',
          proxy_type: input.proxyType,
          proxy_subtype: input.proxySubtype,
          proxy_countries: input.proxyCountries,
          proxy_count: input.proxyCount,
          bandwidth_limit: input.bandwidthLimitGb,
          on_demand_refreshes_total: 0,
          automatic_refresh_frequency: 0,
          proxy_replacements_total: 0,
          subusers_total: 0,
          term: input.term,
          is_unlimited_ip_authorizations: false,
          is_high_concurrency: false,
          is_2x_concurrency: false,
          is_high_priority_network: false,
          high_quality_ips_only: false,
          with_tax: false,
        }),
      )
      if (input.planId !== undefined) url.searchParams.set('plan_id', input.planId)
      const result = await requestJson('pricing_quote', url, websharePricingSchema)
      return result.map((quote) => ({
        discountPercentage: quote.discount_percentage,
        nonDiscountedPriceUsd: quote.non_discounted_price,
        priceUsd: quote.price,
        paidTodayUsd: quote.paid_today,
        creditsAddedUsd: quote.credits_added,
        creditsUsedUsd: quote.credits_used,
        promoDiscountUsd: quote.promo_discount,
      }))
    },
  }
}
