import { MAIB_PATHS } from './endpoints.js'
import { asNumber, asString, payload } from './json.js'
import type { MaibTransport } from './transport.js'

export interface MaibCredentials {
  readonly projectId: string
  readonly projectSecret: string
}

interface TokenSet {
  accessToken: string
  /** Epoch seconds. */
  expiresAt: number
  refreshToken: string
  refreshExpiresAt: number
}

/**
 * A token, fetched or refreshed as needed.
 *
 * Refreshed thirty seconds early: a token that expires between our check and
 * their read is a failed payment that looks like an outage.
 *
 * Held on the instance rather than fetched per call: the client is built once
 * at process start.
 */
export class MaibTokens {
  private tokens: TokenSet | null = null

  constructor(
    private readonly transport: MaibTransport,
    private readonly credentials: MaibCredentials,
    private readonly clock: () => number = Date.now,
  ) {}

  private now(): number {
    return Math.floor(this.clock() / 1000)
  }

  /** A valid access token, or `null` if maib gave nothing usable. */
  async access(): Promise<string | null> {
    const now = this.now()
    if (this.tokens && this.tokens.expiresAt - 30 > now) return this.tokens.accessToken

    const useRefresh = this.tokens !== null && this.tokens.refreshExpiresAt - 30 > now
    const body = useRefresh
      ? { refreshToken: this.tokens?.refreshToken }
      : { projectId: this.credentials.projectId, projectSecret: this.credentials.projectSecret }

    const result = payload(await this.transport.post(MAIB_PATHS.generateToken, body))

    const accessToken = asString(result.accessToken)
    const refreshToken = asString(result.refreshToken)
    if (!accessToken || !refreshToken) {
      /*
        Clearing the cache here matters more than it looks. A half-parsed
        response left in place would make every subsequent call refresh with a
        token we do not have — and the only fix would be restarting the
        process.
      */
      this.tokens = null
      return null
    }

    this.tokens = {
      accessToken,
      expiresAt: now + asNumber(result.expiresIn, 0),
      refreshToken,
      refreshExpiresAt: now + asNumber(result.refreshExpiresIn, 0),
    }
    return accessToken
  }
}
