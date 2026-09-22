const WEBSHARE_API_ORIGIN = 'https://proxy.webshare.io'

/**
 * The date this set of endpoints was checked against apidocs.webshare.io.
 *
 * There is no version in the base URL: Webshare versions each endpoint
 * separately, and this set spans `v2` and `v3` at once — proxy replacement has
 * already moved to the third, the rest stayed on the second. A single version
 * that could be baked into the origin simply does not exist, so a date is
 * recorded instead (ADR-0005).
 */
export const WEBSHARE_SPEC_CHECKED = '2026-09-09'

export const WEBSHARE_BACKBONE_HOST = 'p.webshare.io'

export const webshareEndpoints = {
  /** @see https://apidocs.webshare.io/subscription */
  subscription: `${WEBSHARE_API_ORIGIN}/api/v2/subscription/`,
  /** @see https://apidocs.webshare.io/subscription/plan */
  plans: `${WEBSHARE_API_ORIGIN}/api/v2/subscription/plan/`,
  /** @see https://apidocs.webshare.io/proxystats/aggregate */
  aggregateStats: `${WEBSHARE_API_ORIGIN}/api/v2/stats/aggregate/`,
  /** @see https://apidocs.webshare.io/subscription/assets */
  availableAssets: `${WEBSHARE_API_ORIGIN}/api/v2/subscription/available_assets/`,
  /** @see https://apidocs.webshare.io/subscription/pricing */
  pricing: `${WEBSHARE_API_ORIGIN}/api/v2/subscription/pricing/`,
  /** @see https://apidocs.webshare.io/proxy-list/list */
  proxyList: `${WEBSHARE_API_ORIGIN}/api/v2/proxy/list/`,
  /** @see https://apidocs.webshare.io/proxy-list/replacement */
  replacements: `${WEBSHARE_API_ORIGIN}/api/v3/proxy/replace/`,
  /** @see https://apidocs.webshare.io/proxy-list/replaced */
  replacedProxyList: `${WEBSHARE_API_ORIGIN}/api/v2/proxy/list/replaced/`,
} as const
