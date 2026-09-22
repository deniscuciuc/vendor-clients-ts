/**
 * Traffic usage for a plan, as Webshare counts it.
 *
 * This type used to live in an application's shared domain types, which was the
 * wrong place: the fields describe a Webshare response, not any application's
 * domain. It moved here — otherwise the package would drag a whole foreign
 * domain behind it for the sake of one interface (ADR-0001).
 */
export interface WebsharePlanUsage {
  readonly planId: string
  readonly bandwidthLimitGb: number | null
  readonly bandwidthUnlimited: boolean
  readonly bandwidthUsedGb: number
  readonly bandwidthRemainingGb: number | null
  readonly observedAt: string
}
