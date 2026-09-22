import { describe, expect, it, vi } from 'vitest'
import { createWebshareCapacityClient } from './capacity-client.js'

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const planResponse = {
  id: 42,
  status: 'active',
  bandwidth_limit: 5_000,
  monthly_price: 299,
  yearly_price: 2_990,
  proxy_type: 'shared',
  proxy_subtype: 'default',
  proxy_count: 1_000,
  proxy_countries: { RO: 50, ZZ: 950 },
  required_site_checks: [],
  on_demand_refreshes_total: 0,
  on_demand_refreshes_used: 0,
  on_demand_refreshes_available: 0,
  proxy_replacements_total: 0,
  proxy_replacements_used: 0,
  proxy_replacements_available: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
}

const createLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })

describe('createWebshareCapacityClient', () => {
  it('retrieves the current subscription billing period with GET', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        id: 12,
        plan: 42,
        term: 'monthly',
        start_date: '2026-08-01T00:00:00Z',
        end_date: '2026-09-01T00:00:00Z',
        renewals_enabled: true,
        paused: false,
        throttled: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      }),
    )
    const client = createWebshareCapacityClient({
      config: { apiKey: 'capacity-secret' },
      fetchImpl,
      logger: createLogger(),
    })

    const result = await client.getSubscription()

    expect(result._unsafeUnwrap()).toEqual({
      activePlanId: '42',
      term: 'monthly',
      periodStartAt: '2026-08-01T00:00:00Z',
      periodEndAt: '2026-09-01T00:00:00Z',
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://proxy.webshare.io/api/v2/subscription/',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('discovers active capacity plans through the GET-only client', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ count: 1, next: null, previous: null, results: [planResponse] }),
      )
    const client = createWebshareCapacityClient({
      config: { apiKey: 'capacity-secret' },
      fetchImpl,
      logger: createLogger(),
    })

    const result = await client.listPlans()

    expect(result._unsafeUnwrap()).toEqual([
      expect.objectContaining({ planId: '42', proxySubtype: 'default' }),
    ])
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe('GET')
  })

  it('retrieves sanitized plan details with GET', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(planResponse))
    const client = createWebshareCapacityClient({
      config: { apiKey: 'capacity-secret' },
      fetchImpl,
      logger: createLogger(),
    })

    const result = await client.getPlanDetails({ planId: '42' })

    expect(result._unsafeUnwrap()).toEqual({
      planId: '42',
      status: 'active',
      bandwidthLimitGb: 5_000,
      bandwidthUnlimited: false,
      monthlyPriceUsd: 299,
      yearlyPriceUsd: 2_990,
      proxyType: 'shared',
      proxySubtype: 'default',
      proxyCount: 1_000,
      proxyCountries: { RO: 50, ZZ: 950 },
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://proxy.webshare.io/api/v2/subscription/plan/42/',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('combines plan capacity with aggregate byte usage without exposing provider details', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(planResponse))
      .mockResolvedValueOnce(
        jsonResponse({
          bandwidth_projected: 4_000_000_000,
          bandwidth_total: 1_500_000_000,
          bandwidth_average: null,
          requests_total: 100,
          requests_successful: 90,
          requests_failed: 10,
          error_reasons: [],
          countries_used: { RO: 100 },
          number_of_proxies_used: 4,
          protocols_used: { http: 100 },
          average_concurrency: 1,
          average_rps: 0.5,
          last_request_sent_at: '2026-08-28T09:00:00Z',
        }),
      )
    const client = createWebshareCapacityClient({
      config: { apiKey: 'capacity-secret' },
      fetchImpl,
      logger: createLogger(),
      now: () => new Date('2026-08-28T10:00:00Z'),
    })

    const result = await client.getPlanUsage({
      planId: '42',
      periodStartAt: '2026-08-01T00:00:00Z',
      periodEndAt: '2026-09-01T00:00:00Z',
    })

    expect(result._unsafeUnwrap()).toEqual({
      planId: '42',
      bandwidthLimitGb: 5_000,
      bandwidthUnlimited: false,
      bandwidthUsedGb: 1.5,
      bandwidthRemainingGb: 4_998.5,
      observedAt: '2026-08-28T10:00:00.000Z',
    })
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain('/api/v2/stats/aggregate/')
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain('plan_id=42')
  })

  it('maps Webshare zero bandwidth to explicit unlimited capacity', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ ...planResponse, bandwidth_limit: 0 }))
      .mockResolvedValueOnce(jsonResponse({ ...planResponse, bandwidth_limit: 0 }))
      .mockResolvedValueOnce(
        jsonResponse({
          bandwidth_projected: 4_000_000_000,
          bandwidth_total: 1_500_000_000,
          bandwidth_average: 750_000_000,
          requests_total: 100,
          requests_successful: 90,
          requests_failed: 10,
          error_reasons: [],
          countries_used: { RO: 100 },
          number_of_proxies_used: 4,
          protocols_used: { http: 100 },
          average_concurrency: 1,
          average_rps: 0.5,
          last_request_sent_at: '2026-08-28T09:00:00Z',
        }),
      )
    const client = createWebshareCapacityClient({
      config: { apiKey: 'capacity-secret' },
      fetchImpl,
      logger: createLogger(),
      now: () => new Date('2026-08-28T10:00:00Z'),
    })

    const details = await client.getPlanDetails({ planId: '42' })
    const usage = await client.getPlanUsage({ planId: '42' })

    expect(details._unsafeUnwrap()).toMatchObject({
      bandwidthLimitGb: null,
      bandwidthUnlimited: true,
    })
    expect(usage._unsafeUnwrap()).toMatchObject({
      bandwidthLimitGb: null,
      bandwidthUnlimited: true,
      bandwidthRemainingGb: null,
    })
  })

  it('retrieves and flattens available assets with GET', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        shared: {
          default: { total_subnets: 12, available_countries: { RO: 500 } },
          isp: { total_subnets: 3, available_countries: { RO: 20 } },
        },
      }),
    )
    const client = createWebshareCapacityClient({
      config: { apiKey: 'capacity-secret' },
      fetchImpl,
      logger: createLogger(),
    })

    const result = await client.getAvailableAssets()

    expect(result._unsafeUnwrap()).toEqual([
      {
        proxyType: 'shared',
        proxySubtype: 'default',
        totalSubnets: 12,
        availableCountries: { RO: 500 },
      },
      {
        proxyType: 'shared',
        proxySubtype: 'isp',
        totalSubnets: 3,
        availableCountries: { RO: 20 },
      },
    ])
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe('GET')
  })

  it('quotes pricing with a JSON-encoded GET query and never calls a mutation endpoint', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        discount_percentage: 10,
        non_discounted_price: 320,
        price: 288,
        paid_today: 288,
        credits_added: 0,
        credits_used: 0,
        promo_discount: 0,
        proxy_count_discount_tiers: [],
        bandwidth_discount_tiers: [],
        features: [],
        tax_breakdown: [],
        coupon_discount: null,
      }),
    )
    const client = createWebshareCapacityClient({
      config: { apiKey: 'capacity-secret' },
      fetchImpl,
      logger: createLogger(),
    })

    const result = await client.quotePricing({
      proxyType: 'shared',
      proxySubtype: 'default',
      proxyCountries: { RO: 50, ZZ: 950 },
      proxyCount: 1_000,
      bandwidthLimitGb: 5_000,
      term: 'monthly',
    })

    expect(result._unsafeUnwrap()).toEqual({
      discountPercentage: 10,
      nonDiscountedPriceUsd: 320,
      priceUsd: 288,
      paidTodayUsd: 288,
      creditsAddedUsd: 0,
      creditsUsedUsd: 0,
      promoDiscountUsd: 0,
    })
    const [url, init] = fetchImpl.mock.calls[0] ?? []
    expect(String(url)).toContain('/api/v2/subscription/pricing/?query=')
    expect(init?.method).toBe('GET')
  })

  it.each([
    [401, 'authentication_failed'],
    [429, 'rate_limited'],
    [500, 'provider_http_error'],
  ] as const)('maps HTTP %s to a sanitized %s error', async (status, code) => {
    const logger = createLogger()
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ detail: 'capacity-secret https://secret.invalid' }, status))
    const client = createWebshareCapacityClient({
      config: { apiKey: 'capacity-secret' },
      fetchImpl,
      logger,
    })

    const result = await client.getAvailableAssets()

    expect(result._unsafeUnwrapErr()).toMatchObject({ code, endpoint: 'available_assets' })
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('capacity-secret')
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('secret.invalid')
  })

  it('maps malformed provider JSON without leaking the response', async () => {
    const logger = createLogger()
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ credential: 'capacity-secret' }))
    const client = createWebshareCapacityClient({
      config: { apiKey: 'capacity-secret' },
      fetchImpl,
      logger,
    })

    const result = await client.getAvailableAssets()

    expect(result._unsafeUnwrapErr()).toEqual({
      code: 'invalid_response',
      endpoint: 'available_assets',
      retryable: false,
    })
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('capacity-secret')
  })
})
