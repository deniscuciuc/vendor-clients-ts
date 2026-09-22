import { z } from 'zod'

const isoDateTime = z.string().datetime({ offset: true })

export const webshareSubscriptionSchema = z.object({
  id: z.number().int().nonnegative(),
  plan: z.number().int().nonnegative().nullable(),
  term: z.enum(['monthly', 'yearly']),
  start_date: isoDateTime,
  end_date: isoDateTime,
  renewals_enabled: z.boolean(),
  paused: z.boolean(),
  throttled: z.boolean(),
  created_at: isoDateTime,
  updated_at: isoDateTime,
})

export const websharePlanSchema = z.object({
  id: z.number().int().nonnegative(),
  status: z.enum(['active', 'cancelled']),
  bandwidth_limit: z.number().nonnegative(),
  proxy_type: z.enum(['free', 'shared', 'semidedicated', 'dedicated']),
  proxy_subtype: z.enum(['default', 'premium', 'isp', 'residential', 'datacenter_and_isp']),
  pool_filter: z.string().nullable().optional(),
  proxy_count: z.number().int().nonnegative(),
  proxy_countries: z.record(z.string(), z.number().int().nonnegative()),
  required_site_checks: z.array(z.string()),
  on_demand_refreshes_total: z.number().int().nonnegative(),
  on_demand_refreshes_used: z.number().int().nonnegative(),
  on_demand_refreshes_available: z.number().int().nonnegative(),
  proxy_replacements_total: z.number().int().nonnegative(),
  proxy_replacements_used: z.number().int().nonnegative(),
  proxy_replacements_available: z.number().int().nonnegative(),
  created_at: isoDateTime,
  updated_at: isoDateTime,
})

const webshareProxySchema = z.object({
  id: z.string().min(1).optional(),
  username: z.string().min(1),
  password: z.string().min(1),
  proxy_address: z.string().min(1).nullable(),
  port: z.number().int().positive(),
  valid: z.boolean().optional(),
  country_code: z.string().min(2).max(2).nullable().optional(),
  created_at: isoDateTime.optional(),
})

const paginated = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    count: z.number().int().nonnegative(),
    next: z.string().url().nullable(),
    previous: z.string().url().nullable(),
    results: z.array(item),
  })

export const websharePlansPageSchema = paginated(websharePlanSchema)
export const webshareProxyPageSchema = paginated(webshareProxySchema)

export const webshareReplacementSchema = z.object({
  id: z.number().int().nonnegative(),
  state: z.enum(['validating', 'validated', 'processing', 'completed', 'failed']),
  proxies_removed: z.number().int().nonnegative().nullable().optional(),
  proxies_added: z.number().int().nonnegative().nullable().optional(),
})

export const webshareReplacedProxyPageSchema = paginated(
  z.object({
    proxy: z.string().min(1),
    replaced_with: z.string().min(1),
  }),
)
