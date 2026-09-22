import { describe, expect, it, vi } from 'vitest'
import { createWebshareClient } from './client.js'

const jsonResponse = (
  body: unknown,
  status = 200,
  headers?: Readonly<Record<string, string>>,
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })

describe('createWebshareClient', () => {
  it('retrieves and normalizes the subscription through the documented endpoint', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        id: 12,
        plan: 34,
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
    const client = createWebshareClient({ apiKey: 'secret', fetchImpl })

    const result = await client.getSubscription()

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toMatchObject({
      id: '12',
      activePlanId: '34',
      term: 'monthly',
      renewalsEnabled: true,
      paused: false,
      throttled: false,
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://proxy.webshare.io/api/v2/subscription/',
      expect.objectContaining({ headers: { Authorization: 'Token secret' } }),
    )
  })

  it('paginates and normalizes every plan without exposing provider pricing', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          count: 2,
          next: 'https://proxy.webshare.io/api/v2/subscription/plan/?page=2',
          previous: null,
          results: [
            {
              id: 1,
              status: 'active',
              bandwidth_limit: 50,
              monthly_price: 99,
              yearly_price: 999,
              proxy_type: 'shared',
              proxy_subtype: 'isp',
              proxy_count: 10,
              proxy_countries: { MD: 10 },
              required_site_checks: [],
              on_demand_refreshes_total: 0,
              on_demand_refreshes_used: 0,
              on_demand_refreshes_available: 0,
              proxy_replacements_total: 10,
              proxy_replacements_used: 2,
              proxy_replacements_available: 8,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-08-01T00:00:00Z',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          count: 2,
          next: null,
          previous: 'https://proxy.webshare.io/api/v2/subscription/plan/?page=1',
          results: [
            {
              id: 2,
              status: 'cancelled',
              bandwidth_limit: 0,
              proxy_type: 'shared',
              proxy_subtype: 'default',
              pool_filter: 'residential',
              proxy_count: 1,
              proxy_countries: { ZZ: 1 },
              required_site_checks: [],
              on_demand_refreshes_total: 0,
              on_demand_refreshes_used: 0,
              on_demand_refreshes_available: 0,
              proxy_replacements_total: 0,
              proxy_replacements_used: 0,
              proxy_replacements_available: 0,
              created_at: '2026-02-01T00:00:00Z',
              updated_at: '2026-08-01T00:00:00Z',
            },
          ],
        }),
      )
    const client = createWebshareClient({ apiKey: 'secret', fetchImpl })

    const result = await client.listPlans()

    expect(result._unsafeUnwrap()).toEqual([
      expect.objectContaining({
        id: '1',
        status: 'active',
        proxySubtype: 'isp',
        proxyCount: 10,
        replacementAvailable: 8,
      }),
      expect.objectContaining({ id: '2', status: 'cancelled', proxySubtype: 'residential' }),
    ])
    expect(result._unsafeUnwrap()[0]).not.toHaveProperty('monthlyPrice')
  })

  it('rejects pagination that escapes the documented endpoint origin and path', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        count: 1,
        next: 'https://attacker.example/steal',
        previous: null,
        results: [],
      }),
    )
    const client = createWebshareClient({ apiKey: 'secret', fetchImpl })

    const result = await client.listPlans()

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'unsafe_pagination' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('normalizes direct and residential proxy connections for one explicit plan', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 'd-1',
              username: 'user',
              password: 'password',
              proxy_address: '192.0.2.10',
              port: 8123,
              valid: true,
              country_code: 'md',
              created_at: '2026-01-01T00:00:00Z',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 'b-GB-1',
              username: 'backbone',
              password: 'password',
              proxy_address: null,
              port: 9999,
              valid: true,
              country_code: null,
              created_at: '2026-01-01T00:00:00Z',
            },
          ],
        }),
      )
    const client = createWebshareClient({ apiKey: 'secret', fetchImpl })

    const direct = await client.listProxyConnections({ planId: '10', mode: 'direct' })
    const backbone = await client.listProxyConnections({ planId: '20', mode: 'backbone' })

    expect(direct._unsafeUnwrap()[0]).toMatchObject({
      providerObjectId: 'd-1',
      host: '192.0.2.10',
      port: 8123,
      countryCode: 'MD',
    })
    expect(backbone._unsafeUnwrap()[0]).toMatchObject({
      providerObjectId: 'b-gb-1',
      host: 'p.webshare.io',
      port: 80,
      countryCode: null,
    })
    expect(backbone._unsafeUnwrap()[0]?.providerObjectId).toMatch(/^[a-z0-9][a-z0-9._-]{0,127}$/)
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('mode=direct')
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('plan_id=10')
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain('mode=backbone')
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain('plan_id=20')
  })

  it('stops backbone pagination after the requested number of generated connections', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        count: 200_000,
        next: 'https://proxy.webshare.io/api/v2/proxy/list/?mode=backbone&page=2&page_size=100&plan_id=30',
        previous: null,
        results: [
          {
            id: 'residential-endpoint-1',
            username: 'account-user',
            password: 'password',
            proxy_address: null,
            port: 80,
            valid: true,
            country_code: null,
            created_at: '2026-08-29T00:00:00Z',
          },
        ],
      }),
    )
    const client = createWebshareClient({ apiKey: 'secret', fetchImpl })

    const result = await client.listProxyConnections({
      planId: '30',
      mode: 'backbone',
      maximumConnections: 1,
    })

    expect(result._unsafeUnwrap()).toHaveLength(1)
    expect(result._unsafeUnwrap()[0]).toMatchObject({
      providerObjectId: 'residential-endpoint-1',
      host: 'p.webshare.io',
      port: 80,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const requestUrl = new URL(String(fetchImpl.mock.calls[0]?.[0]))
    expect(requestUrl.searchParams.get('page_size')).toBe('1')
  })

  it('honors Retry-After once for rate-limited idempotent requests', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ detail: 'rate limited' }, 429, { 'retry-after': '2' }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 12,
          plan: 34,
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
    const wait = vi.fn().mockResolvedValue(undefined)
    const client = createWebshareClient({
      apiKey: 'secret',
      fetchImpl,
      wait,
      retryPolicy: { maximumAttempts: 2, baseDelayMs: 10 },
    })

    const result = await client.getSubscription()

    expect(result.isOk()).toBe(true)
    expect(wait).toHaveBeenCalledWith(2_000)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('returns a sanitized invalid-response error when the provider contract drifts', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ id: 'unexpected' }))
    const client = createWebshareClient({ apiKey: 'secret', fetchImpl })

    const result = await client.getSubscription()

    expect(result._unsafeUnwrapErr()).toEqual({
      code: 'invalid_response',
      endpoint: 'subscription',
      retryable: false,
    })
  })

  it('creates an ISP replacement through the documented v3 endpoint', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        id: 77,
        state: 'validating',
        proxies_removed: null,
        proxies_added: null,
      }),
    )
    const client = createWebshareClient({ apiKey: 'secret', fetchImpl })

    const result = await client.createProxyReplacement({
      planId: '10',
      ipAddresses: ['192.0.2.10'],
      dryRun: true,
    })

    expect(result._unsafeUnwrap()).toEqual({
      id: '77',
      state: 'validating',
      proxiesRemoved: null,
      proxiesAdded: null,
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://proxy.webshare.io/api/v3/proxy/replace/?plan_id=10',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Token secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to_replace: { type: 'ip_address', ip_addresses: ['192.0.2.10'] },
          replace_with: [{ type: 'any', count: 1 }],
          dry_run: true,
        }),
      }),
    )
  })

  it('retrieves replacement state and paginated replaced-proxy history', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ id: 77, state: 'completed', proxies_removed: 1, proxies_added: 1 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          count: 1,
          next: null,
          previous: null,
          results: [{ proxy: '192.0.2.10', replaced_with: '192.0.2.20' }],
        }),
      )
    const client = createWebshareClient({ apiKey: 'secret', fetchImpl })

    const replacement = await client.getProxyReplacement({ planId: '10', replacementId: '77' })
    const history = await client.listReplacedProxies({ planId: '10', replacementId: '77' })

    expect(replacement._unsafeUnwrap()).toMatchObject({ id: '77', state: 'completed' })
    expect(history._unsafeUnwrap()).toEqual([
      { previousAddress: '192.0.2.10', replacementAddress: '192.0.2.20' },
    ])
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'https://proxy.webshare.io/api/v3/proxy/replace/77/?plan_id=10',
    )
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain('proxy_list_replacement=77')
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain('plan_id=10')
  })
})
