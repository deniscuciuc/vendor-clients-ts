import { z } from 'zod'
import { websharePlanSchema, webshareSubscriptionSchema } from './schemas.js'

export const webshareCapacityPlanSchema = websharePlanSchema.extend({
  monthly_price: z.number().nonnegative(),
  yearly_price: z.number().nonnegative(),
})

export const webshareCapacityPlansPageSchema = z.object({
  count: z.number().int().nonnegative(),
  next: z.string().url().nullable(),
  previous: z.string().url().nullable(),
  results: z.array(webshareCapacityPlanSchema),
})

export const webshareCapacitySubscriptionSchema = webshareSubscriptionSchema

export const webshareAggregateStatsSchema = z.object({
  bandwidth_projected: z.number().nonnegative(),
  bandwidth_total: z.number().nonnegative(),
  bandwidth_average: z.number().nonnegative().nullable(),
  requests_total: z.number().int().nonnegative(),
  requests_successful: z.number().int().nonnegative(),
  requests_failed: z.number().int().nonnegative(),
  error_reasons: z.array(z.unknown()),
  countries_used: z.record(z.string(), z.number().int().nonnegative()),
  number_of_proxies_used: z.number().int().nonnegative(),
  protocols_used: z.record(z.string(), z.number().int().nonnegative()),
  average_concurrency: z.number().nonnegative(),
  average_rps: z.number().nonnegative(),
  last_request_sent_at: z.string().datetime({ offset: true }).nullable(),
})

const availableAssetSchema = z.object({
  total_subnets: z.number().int().nonnegative(),
  available_countries: z.record(z.string(), z.number().int().nonnegative()),
})

export const webshareAvailableAssetsSchema = z.record(
  z.string(),
  z.record(z.string(), availableAssetSchema),
)

export const websharePricingSchema = z.object({
  discount_percentage: z.number().nonnegative(),
  non_discounted_price: z.number().nonnegative(),
  price: z.number().nonnegative(),
  paid_today: z.number().nonnegative(),
  credits_added: z.number().nonnegative(),
  credits_used: z.number().nonnegative(),
  promo_discount: z.number().nonnegative(),
})
